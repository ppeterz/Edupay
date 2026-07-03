// ──────────────────────────────────────────────
// EduPay — Reconciliation Engine (Stage 6)
// ──────────────────────────────────────────────
// Pure function for allocating funds across invoice line items by priority.
// No Firestore imports — keep it pure and testable.

import {
  Student,
  Invoice,
  InvoiceLineItem,
  PaymentAllocation,
  ReconciliationEvent,
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

export function reconcile(
  student: Student,
  amountReceivedKobo: number,
  invoice: Invoice
): ReconciliationResult {
  // Guard against non-positive amounts to prevent negative allocations or zero-allocations loops
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

  // Step A — combine available funds: incoming payment + any existing credit balance
  let creditConsumed = 0;
  let availableFunds = amountReceivedKobo;
  if (student.creditBalance > 0) {
    creditConsumed = student.creditBalance;
    availableFunds += creditConsumed;
  }


  // Step B — allocate across line items by priority ascending
  const sortedLineItems = sortLineItemsByPriority(invoice.lineItems);
  const allocations: PaymentAllocation[] = [];
  const updatedLineItems: InvoiceLineItem[] = [];

  for (const item of sortedLineItems) {
    const remaining = item.amountDue - item.amountPaid;
    const allocate = Math.min(Math.max(remaining, 0), availableFunds);
    availableFunds -= allocate;

    if (allocate > 0) {
      allocations.push({
        lineItemId: item.id,
        description: item.description,
        amountAllocated: allocate,
      });
    }

    const newAmountPaid = item.amountPaid + allocate;
    updatedLineItems.push({
      ...item,
      amountPaid: newAmountPaid,
      status:
        newAmountPaid >= item.amountDue
          ? 'paid'
          : newAmountPaid > 0
          ? 'partial'
          : 'unpaid',
    });
  }

  // Step C — totals
  const newTotalAmountPaid = updatedLineItems.reduce(
    (sum, li) => sum + li.amountPaid,
    0
  );
  const newOutstandingBalance = Math.max(
    invoice.totalAmountDue - newTotalAmountPaid,
    0
  );

  // Step D — overpayment becomes new credit; leftover after allocating everything
  const creditGenerated = availableFunds > 0 ? availableFunds : 0;
  const newStudentCreditBalance =
    student.creditBalance - creditConsumed + creditGenerated;

  // Step E — derive invoice status
  let newInvoiceStatus: Invoice['status'];
  if (newTotalAmountPaid === 0) {
    newInvoiceStatus = 'unpaid';
  } else if (creditGenerated > 0 && newOutstandingBalance === 0) {
    newInvoiceStatus = 'overpaid';
  } else if (newOutstandingBalance === 0) {
    newInvoiceStatus = 'paid';
  } else {
    newInvoiceStatus = 'partial';
  }

  // Step F — derive event type for audit trail
  let eventType: ReconciliationEvent['eventType'];
  if (creditGenerated > 0) {
    eventType = 'overpayment';
  } else if (newOutstandingBalance > 0) {
    eventType = 'underpayment';
  } else {
    eventType = creditConsumed > 0 ? 'credit_applied' : 'full_payment';
  }

  return {
    allocations,
    updatedLineItems,
    newInvoiceStatus,
    newTotalAmountPaid,
    newOutstandingBalance,
    creditGenerated,
    newStudentCreditBalance,
    eventType,
  };
}
