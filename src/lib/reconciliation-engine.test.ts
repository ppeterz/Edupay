// ──────────────────────────────────────────────
// EduPay — Reconciliation Engine Tests
// ──────────────────────────────────────────────

import { describe, test, expect } from 'vitest';
import { reconcile } from './reconciliation-engine';
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


function createMockInvoice(lineItems: InvoiceLineItem[]): Invoice {
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
        lineItemId: 'li-tuition',
        description: 'Tuition',
        amountAllocated: 1500000,
      },
      {
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
});
