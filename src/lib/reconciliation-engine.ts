// ──────────────────────────────────────────────
// EduPay — Reconciliation Engine (Stage 6 → Multi-Invoice)
// ──────────────────────────────────────────────
// Pure functions for allocating funds across invoice line items by priority.
// No Firestore imports — keep it pure and testable.

import {
  Student,
  Invoice,
  InvoiceLineItem,
  PaymentAllocation,
  ReconciliationEvent,
  PerInvoiceReconciliation,
  MultiInvoiceReconciliationResult,
} from '@/types';
import { sortLineItemsByPriority } from './invoice-helpers';

export interface ReconciliationResult {
  allocations: PaymentAllocation[];
  updatedLineItems: InvoiceLineItem[]; // full lineItems array with amountPaid/status updated
  newInvoiceStatus: Invoice['status'];
  newTotalAmountPaid: number; // kobo
  newOutstandingBalance: number; // kobo (invoice-level, can be 0)
  creditGenerated: number; // kobo (0 unless overpayment)
  newStudentCreditBalance: number; // kobo — existing creditBalance + creditGenerated - creditConsumed
  eventType: ReconciliationEvent['eventType'];
}

// ── Private helper: allocate funds across a single invoice's line items ──

function allocateToLineItems(
  lineItems: InvoiceLineItem[],
  availableFunds: number
): { allocations: Omit<PaymentAllocation, 'invoiceId'>[]; updatedLineItems: InvoiceLineItem[]; fundsUsed: number } {
  const sorted = sortLineItemsByPriority(lineItems);
  const allocations: Omit<PaymentAllocation, 'invoiceId'>[] = [];
  const updatedLineItems: InvoiceLineItem[] = [];
  let remaining = availableFunds;
  let fundsUsed = 0;

  for (const item of sorted) {
    const owed = item.amountDue - item.amountPaid;
    const allocate = Math.min(Math.max(owed, 0), remaining);
    remaining -= allocate;
    fundsUsed += allocate;

    if (allocate > 0) {
      allocations.push({ lineItemId: item.id, description: item.description, amountAllocated: allocate });
    }

    const newAmountPaid = item.amountPaid + allocate;
    updatedLineItems.push({
      ...item,
      amountPaid: newAmountPaid,
      status: newAmountPaid >= item.amountDue ? 'paid' : newAmountPaid > 0 ? 'partial' : 'unpaid',
    });
  }

  return { allocations, updatedLineItems, fundsUsed };
}

// ── Multi-invoice reconciliation ─────────────

export function reconcileMultiple(
  student: Student,
  amountReceivedKobo: number,
  invoices: Invoice[] // MUST be pre-sorted oldest-first by the caller (createdAt asc)
): MultiInvoiceReconciliationResult {
  let creditConsumed = 0;
  let availableFunds = amountReceivedKobo;
  if (student.creditBalance > 0) {
    creditConsumed = student.creditBalance;
    availableFunds += creditConsumed;
  }

  const perInvoice: PerInvoiceReconciliation[] = [];
  let totalAllocated = 0;
  let anyUnderpayment = false;

  for (const invoice of invoices) {
    if (availableFunds <= 0) break; // no funds left — remaining invoices untouched entirely

    const { allocations, updatedLineItems, fundsUsed } = allocateToLineItems(invoice.lineItems, availableFunds);
    availableFunds -= fundsUsed;
    totalAllocated += fundsUsed;

    const newTotalAmountPaid = updatedLineItems.reduce((s, li) => s + li.amountPaid, 0);
    const newOutstandingBalance = Math.max(invoice.totalAmountDue - newTotalAmountPaid, 0);
    if (newOutstandingBalance > 0) anyUnderpayment = true;

    const newInvoiceStatus: Invoice['status'] =
      newTotalAmountPaid === 0 ? 'unpaid' : newOutstandingBalance > 0 ? 'partial' : 'paid';

    perInvoice.push({
      invoiceId: invoice.id,
      allocations: allocations.map(a => ({ ...a, invoiceId: invoice.id })), // tag with invoiceId
      updatedLineItems,
      newInvoiceStatus,
      newTotalAmountPaid,
      newOutstandingBalance,
      outstandingBefore: invoice.outstandingBalance,
    });
  }

  const creditGenerated = availableFunds > 0 ? availableFunds : 0;
  const newStudentCreditBalance = student.creditBalance - creditConsumed + creditGenerated;

  // Post-loop correction: if there's leftover credit and the last touched
  // invoice is fully paid, mark it 'overpaid' — this is where the overpayment
  // becomes visible.
  if (creditGenerated > 0 && perInvoice.length > 0) {
    const lastTouched = perInvoice[perInvoice.length - 1];
    if (lastTouched.newInvoiceStatus === 'paid') {
      lastTouched.newInvoiceStatus = 'overpaid';
    }
  }

  let eventType: ReconciliationEvent['eventType'];
  if (creditGenerated > 0) eventType = 'overpayment';
  else if (anyUnderpayment) eventType = 'underpayment';
  else eventType = creditConsumed > 0 ? 'credit_applied' : 'full_payment';

  return { perInvoice, creditGenerated, newStudentCreditBalance, eventType, totalAllocated };
}

// ── Single-invoice wrapper (backward compat) ─

export function reconcile(
  student: Student,
  amountReceivedKobo: number,
  invoice: Invoice
): ReconciliationResult {
  // Guard against non-positive amounts — preserve original early-return behavior
  if (amountReceivedKobo <= 0) {
    return {
      allocations: [],
      updatedLineItems: invoice.lineItems,
      newInvoiceStatus: invoice.status,
      newTotalAmountPaid: invoice.totalAmountPaid,
      newOutstandingBalance: invoice.outstandingBalance,
      creditGenerated: 0,
      newStudentCreditBalance: student.creditBalance,
      eventType: 'underpayment',
    };
  }

  const result = reconcileMultiple(student, amountReceivedKobo, [invoice]);
  const single = result.perInvoice[0];

  // If the invoice received zero funds (shouldn't happen given the guard above,
  // but defensive), return a zero-change result matching old behavior
  if (!single) {
    return {
      allocations: [],
      updatedLineItems: invoice.lineItems,
      newInvoiceStatus: invoice.status,
      newTotalAmountPaid: invoice.totalAmountPaid,
      newOutstandingBalance: invoice.outstandingBalance,
      creditGenerated: result.creditGenerated,
      newStudentCreditBalance: result.newStudentCreditBalance,
      eventType: result.eventType,
    };
  }

  return {
    allocations: single.allocations,
    updatedLineItems: single.updatedLineItems,
    newInvoiceStatus: single.newInvoiceStatus,
    newTotalAmountPaid: single.newTotalAmountPaid,
    newOutstandingBalance: single.newOutstandingBalance,
    creditGenerated: result.creditGenerated,
    newStudentCreditBalance: result.newStudentCreditBalance,
    eventType: result.eventType,
  };
}
