// ──────────────────────────────────────────────
// EduPay — Reconciliation Engine Tests
// ──────────────────────────────────────────────

import { describe, test, expect } from 'vitest';
import { reconcile, reconcileMultiple } from './reconciliation-engine';
import type { Student, Invoice, InvoiceLineItem } from '@/types';

function createMockStudent(creditBalance = 0): Student {
  return {
    id: 'student-123',
    schoolId: 'school-123',
    fullName: 'Jane Doe',
    class: 'Primary 1',
    admissionNumber: 'ADM-123',
    virtualAccountNumber: '9998887776',
    virtualAccountReference: 'student-123-ref',
    virtualAccountBankName: 'Test Bank',
    outstandingBalance: 0,
    creditBalance,
    createdAt: new Date().toISOString(),
    deletedAt: null,
  };
}


function createMockInvoice(lineItems: InvoiceLineItem[], overrides: Partial<Invoice> = {}): Invoice {
  const totalAmountDue = lineItems.reduce((sum, item) => sum + item.amountDue, 0);
  const totalAmountPaid = lineItems.reduce((sum, item) => sum + item.amountPaid, 0);
  return {
    id: 'invoice-123',
    studentId: 'student-123',
    schoolId: 'school-123',
    term: 'First Term',
    session: '2026/2027',
    lineItems,
    totalAmountDue,
    totalAmountPaid,
    outstandingBalance: totalAmountDue - totalAmountPaid,
    status: 'unpaid',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

describe('Reconciliation Engine Tests', () => {
  // TEST 1 — Full payment:
  // Invoice: 1 line item, Tuition, amountDue=5000000 (₦50,000), amountPaid=0, priority=1
  // Student: creditBalance=0
  // Payment: amountReceivedKobo=5000000
  test('TEST 1 — Full payment', () => {
    const student = createMockStudent(0);
    const invoice = createMockInvoice([
      {
        id: 'li-tuition',
        description: 'Tuition',
        amountDue: 5000000,
        amountPaid: 0,
        priority: 1,
        status: 'unpaid',
      },
    ]);

    const result = reconcile(student, 5000000, invoice);

    expect(result.newInvoiceStatus).toBe('paid');
    expect(result.newOutstandingBalance).toBe(0);
    expect(result.creditGenerated).toBe(0);
    expect(result.eventType).toBe('full_payment');
    expect(result.allocations).toEqual([
      {
        invoiceId: 'invoice-123',
        lineItemId: 'li-tuition',
        description: 'Tuition',
        amountAllocated: 5000000,
      },
    ]);
  });

  // TEST 2 — Underpayment:
  // Invoice: same ₦50,000 invoice
  // Payment: amountReceivedKobo=3000000 (₦30,000)
  test('TEST 2 — Underpayment', () => {
    const student = createMockStudent(0);
    const invoice = createMockInvoice([
      {
        id: 'li-tuition',
        description: 'Tuition',
        amountDue: 5000000,
        amountPaid: 0,
        priority: 1,
        status: 'unpaid',
      },
    ]);

    const result = reconcile(student, 3000000, invoice);

    expect(result.newInvoiceStatus).toBe('partial');
    expect(result.newOutstandingBalance).toBe(2000000);
    expect(result.creditGenerated).toBe(0);
    expect(result.eventType).toBe('underpayment');
    expect(result.allocations).toEqual([
      {
        invoiceId: 'invoice-123',
        lineItemId: 'li-tuition',
        description: 'Tuition',
        amountAllocated: 3000000,
      },
    ]);
  });

  // TEST 3 — Overpayment:
  // Invoice: same ₦50,000 invoice
  // Payment: amountReceivedKobo=6000000 (₦60,000)
  test('TEST 3 — Overpayment', () => {
    const student = createMockStudent(0);
    const invoice = createMockInvoice([
      {
        id: 'li-tuition',
        description: 'Tuition',
        amountDue: 5000000,
        amountPaid: 0,
        priority: 1,
        status: 'unpaid',
      },
    ]);

    const result = reconcile(student, 6000000, invoice);

    expect(result.newInvoiceStatus).toBe('overpaid');
    expect(result.newOutstandingBalance).toBe(0);
    expect(result.creditGenerated).toBe(1000000);
    expect(result.newStudentCreditBalance).toBe(1000000);
    expect(result.eventType).toBe('overpayment');
    expect(result.allocations).toEqual([
      {
        invoiceId: 'invoice-123',
        lineItemId: 'li-tuition',
        description: 'Tuition',
        amountAllocated: 5000000,
      },
    ]);
  });

  // TEST 4 — Multiple installments
  test('TEST 4 — Multiple installments', () => {
    const student = createMockStudent(0);
    let invoice = createMockInvoice([
      {
        id: 'li-tuition',
        description: 'Tuition',
        amountDue: 5000000,
        amountPaid: 0,
        priority: 1,
        status: 'unpaid',
      },
    ]);

    // Payment 1: ₦20,000
    let result = reconcile(student, 2000000, invoice);
    expect(result.newInvoiceStatus).toBe('partial');
    expect(result.newOutstandingBalance).toBe(3000000);

    // Apply first payment outputs to next step
    invoice = {
      ...invoice,
      lineItems: result.updatedLineItems,
      totalAmountPaid: result.newTotalAmountPaid,
      outstandingBalance: result.newOutstandingBalance,
      status: result.newInvoiceStatus,
    };

    // Payment 2: ₦15,000
    result = reconcile(student, 1500000, invoice);
    expect(result.newInvoiceStatus).toBe('partial');
    expect(result.newOutstandingBalance).toBe(1500000);

    invoice = {
      ...invoice,
      lineItems: result.updatedLineItems,
      totalAmountPaid: result.newTotalAmountPaid,
      outstandingBalance: result.newOutstandingBalance,
      status: result.newInvoiceStatus,
    };

    // Payment 3: ₦15,000
    result = reconcile(student, 1500000, invoice);
    expect(result.newInvoiceStatus).toBe('paid');
    expect(result.newOutstandingBalance).toBe(0);
  });

  // TEST 5 — Priority allocation:
  // Invoice: 2 line items — Tuition (₦15,000, priority 1), Exam (₦10,000, priority 2)
  // Payment: ₦20,000
  test('TEST 5 — Priority allocation', () => {
    const student = createMockStudent(0);
    const invoice = createMockInvoice([
      {
        id: 'li-exam',
        description: 'Exam',
        amountDue: 1000000,
        amountPaid: 0,
        priority: 2,
        status: 'unpaid',
      },
      {
        id: 'li-tuition',
        description: 'Tuition',
        amountDue: 1500000,
        amountPaid: 0,
        priority: 1,
        status: 'unpaid',
      },
    ]);

    const result = reconcile(student, 2000000, invoice);

    expect(result.newInvoiceStatus).toBe('partial');
    expect(result.newOutstandingBalance).toBe(500000);

    const tuitionItem = result.updatedLineItems.find((li) => li.id === 'li-tuition');
    const examItem = result.updatedLineItems.find((li) => li.id === 'li-exam');

    expect(tuitionItem?.amountPaid).toBe(1500000);
    expect(tuitionItem?.status).toBe('paid');

    expect(examItem?.amountPaid).toBe(500000);
    expect(examItem?.status).toBe('partial');

    expect(result.allocations).toEqual([
      {
        invoiceId: 'invoice-123',
        lineItemId: 'li-tuition',
        description: 'Tuition',
        amountAllocated: 1500000,
      },
      {
        invoiceId: 'invoice-123',
        lineItemId: 'li-exam',
        description: 'Exam',
        amountAllocated: 500000,
      },
    ]);
  });

  // TEST 6 — Credit carry-forward:
  // Student: creditBalance=500000 (₦5,000, from a prior overpayment)
  // Invoice: ₦50,000 due, nothing paid yet
  // Payment: amountReceivedKobo=4500000 (₦45,000)
  test('TEST 6 — Credit carry-forward', () => {
    const student = createMockStudent(500000);
    const invoice = createMockInvoice([
      {
        id: 'li-tuition',
        description: 'Tuition',
        amountDue: 5000000,
        amountPaid: 0,
        priority: 1,
        status: 'unpaid',
      },
    ]);

    const result = reconcile(student, 4500000, invoice);

    expect(result.newTotalAmountPaid).toBe(5000000);
    expect(result.newStudentCreditBalance).toBe(0);
    expect(result.newOutstandingBalance).toBe(0);
    expect(result.newInvoiceStatus).toBe('paid');
  });

  // ── Multi-invoice tests (reconcileMultiple) ─────────

  // TEST 7 — Two invoices, payment settles both fully
  test('TEST 7 — Two invoices, payment settles both fully', () => {
    const student = createMockStudent(0);
    const invoiceA = createMockInvoice(
      [
        { id: 'li-tuition-a', description: 'Tuition', amountDue: 1000000, amountPaid: 0, priority: 1, status: 'unpaid' },
      ],
      { id: 'invoice-A', term: 'First Term', createdAt: '2026-01-01T00:00:00.000Z' }
    );
    const invoiceB = createMockInvoice(
      [
        { id: 'li-tuition-b', description: 'Tuition', amountDue: 5000000, amountPaid: 0, priority: 1, status: 'unpaid' },
      ],
      { id: 'invoice-B', term: 'Second Term', createdAt: '2026-04-01T00:00:00.000Z' }
    );

    const result = reconcileMultiple(student, 6000000, [invoiceA, invoiceB]);

    expect(result.perInvoice).toHaveLength(2);
    expect(result.perInvoice[0].invoiceId).toBe('invoice-A');
    expect(result.perInvoice[0].newInvoiceStatus).toBe('paid');
    expect(result.perInvoice[0].newOutstandingBalance).toBe(0);
    expect(result.perInvoice[1].invoiceId).toBe('invoice-B');
    expect(result.perInvoice[1].newInvoiceStatus).toBe('paid');
    expect(result.perInvoice[1].newOutstandingBalance).toBe(0);
    expect(result.creditGenerated).toBe(0);
    expect(result.totalAllocated).toBe(6000000);
    expect(result.eventType).toBe('full_payment');
  });

  // TEST 8 — Two invoices, payment only covers the first + partially the second
  test('TEST 8 — Two invoices, partial second invoice', () => {
    const student = createMockStudent(0);
    const invoiceA = createMockInvoice(
      [
        { id: 'li-tuition-a', description: 'Tuition', amountDue: 1000000, amountPaid: 0, priority: 1, status: 'unpaid' },
      ],
      { id: 'invoice-A', term: 'First Term', createdAt: '2026-01-01T00:00:00.000Z' }
    );
    const invoiceB = createMockInvoice(
      [
        { id: 'li-tuition-b', description: 'Tuition', amountDue: 5000000, amountPaid: 0, priority: 1, status: 'unpaid' },
      ],
      { id: 'invoice-B', term: 'Second Term', createdAt: '2026-04-01T00:00:00.000Z' }
    );

    const result = reconcileMultiple(student, 3500000, [invoiceA, invoiceB]);

    expect(result.perInvoice).toHaveLength(2);
    expect(result.perInvoice[0].invoiceId).toBe('invoice-A');
    expect(result.perInvoice[0].newInvoiceStatus).toBe('paid');
    expect(result.perInvoice[1].invoiceId).toBe('invoice-B');
    expect(result.perInvoice[1].newInvoiceStatus).toBe('partial');
    expect(result.perInvoice[1].newTotalAmountPaid).toBe(2500000);
    expect(result.creditGenerated).toBe(0);
    expect(result.eventType).toBe('underpayment');
  });

  // TEST 9 — Two invoices, payment doesn't even cover the first
  test('TEST 9 — Two invoices, payment insufficient for first', () => {
    const student = createMockStudent(0);
    const invoiceA = createMockInvoice(
      [
        { id: 'li-tuition-a', description: 'Tuition', amountDue: 1000000, amountPaid: 0, priority: 1, status: 'unpaid' },
      ],
      { id: 'invoice-A', term: 'First Term', createdAt: '2026-01-01T00:00:00.000Z' }
    );
    const invoiceB = createMockInvoice(
      [
        { id: 'li-tuition-b', description: 'Tuition', amountDue: 5000000, amountPaid: 0, priority: 1, status: 'unpaid' },
      ],
      { id: 'invoice-B', term: 'Second Term', createdAt: '2026-04-01T00:00:00.000Z' }
    );

    const result = reconcileMultiple(student, 500000, [invoiceA, invoiceB]);

    // Only invoice A appears in perInvoice (partial), invoice B received zero funds
    expect(result.perInvoice).toHaveLength(1);
    expect(result.perInvoice[0].invoiceId).toBe('invoice-A');
    expect(result.perInvoice[0].newInvoiceStatus).toBe('partial');
    expect(result.perInvoice[0].newTotalAmountPaid).toBe(500000);
    expect(result.creditGenerated).toBe(0);
    expect(result.eventType).toBe('underpayment');
  });

  // TEST 10 — Regression check: reconcile() wrapper still matches old behavior
  test('TEST 10 — reconcile() wrapper regression (full payment, single invoice)', () => {
    const student = createMockStudent(0);
    const invoice = createMockInvoice([
      {
        id: 'li-tuition',
        description: 'Tuition',
        amountDue: 5000000,
        amountPaid: 0,
        priority: 1,
        status: 'unpaid',
      },
    ]);

    const result = reconcile(student, 5000000, invoice);

    // Identical shape/values to original Test 1
    expect(result.newInvoiceStatus).toBe('paid');
    expect(result.newOutstandingBalance).toBe(0);
    expect(result.newTotalAmountPaid).toBe(5000000);
    expect(result.creditGenerated).toBe(0);
    expect(result.newStudentCreditBalance).toBe(0);
    expect(result.eventType).toBe('full_payment');
    expect(result.allocations).toEqual([
      {
        invoiceId: 'invoice-123',
        lineItemId: 'li-tuition',
        description: 'Tuition',
        amountAllocated: 5000000,
      },
    ]);
  });

  // TEST 11 — reconcileMultiple() directly: overpaid status on single invoice
  test('TEST 11 — reconcileMultiple() overpaid status (single invoice, direct call)', () => {
    const student = createMockStudent(0);
    const invoice = createMockInvoice(
      [
        { id: 'li-tuition', description: 'Tuition', amountDue: 5000000, amountPaid: 0, priority: 1, status: 'unpaid' },
      ],
      { id: 'invoice-overpay' }
    );

    const result = reconcileMultiple(student, 6000000, [invoice]);

    expect(result.perInvoice).toHaveLength(1);
    expect(result.perInvoice[0].newInvoiceStatus).toBe('overpaid');
    expect(result.perInvoice[0].newOutstandingBalance).toBe(0);
    expect(result.creditGenerated).toBe(1000000);
    expect(result.newStudentCreditBalance).toBe(1000000);
    expect(result.eventType).toBe('overpayment');
    expect(result.totalAllocated).toBe(5000000);
  });
});
