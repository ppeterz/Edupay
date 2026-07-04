// ──────────────────────────────────────────────
// EduPay — Report Helpers Tests
// ──────────────────────────────────────────────
// Verifies that the reports page computes accurate data
// from the underlying invoice/student collections.

import { describe, test, expect } from 'vitest';
import {
  buildClassReport,
  buildStudentReport,
  calculateCollectionRate,
} from './report-helpers';
import type { Invoice, Student } from '@/types';

// ── Factories ────────────────────────────────

function createStudent(overrides: Partial<Student> = {}): Student {
  return {
    id: 'student-1',
    schoolId: 'school-1',
    fullName: 'Jane Doe',
    class: 'Primary 1',
    admissionNumber: 'ADM-001',
    virtualAccountNumber: '1234567890',
    virtualAccountReference: 'school-1-adm-001',
    virtualAccountBankName: 'Test Bank',
    outstandingBalance: 0,
    creditBalance: 0,
    createdAt: new Date().toISOString(),
    deletedAt: null,
    ...overrides,
  };
}

function createInvoice(overrides: Partial<Invoice> = {}): Invoice {
  return {
    id: 'invoice-1',
    studentId: 'student-1',
    schoolId: 'school-1',
    term: 'First Term',
    session: '2025/2026',
    lineItems: [],
    totalAmountDue: 5000000, // ₦50,000
    totalAmountPaid: 0,
    outstandingBalance: 5000000,
    status: 'unpaid',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

// ── buildClassReport ─────────────────────────

describe('buildClassReport', () => {
  test('aggregates single class correctly', () => {
    const students = [
      createStudent({ id: 'stu-1', class: 'Primary 1' }),
      createStudent({ id: 'stu-2', fullName: 'Tola Babs', class: 'Primary 1' }),
    ];
    const invoices = [
      createInvoice({
        id: 'inv-1',
        studentId: 'stu-1',
        totalAmountDue: 5000000,
        totalAmountPaid: 5000000,
        outstandingBalance: 0,
        status: 'paid',
      }),
      createInvoice({
        id: 'inv-2',
        studentId: 'stu-2',
        totalAmountDue: 5000000,
        totalAmountPaid: 3000000,
        outstandingBalance: 2000000,
        status: 'partial',
      }),
    ];

    const result = buildClassReport(invoices, students);

    expect(result).toHaveLength(1);
    expect(result[0].class).toBe('Primary 1');
    expect(result[0].totalDue).toBe(10000000); // ₦100,000
    expect(result[0].totalCollected).toBe(8000000); // ₦80,000
    expect(result[0].paidCount).toBe(1);
    expect(result[0].partialCount).toBe(1);
    expect(result[0].unpaidCount).toBe(0);
  });

  test('aggregates multiple classes correctly and sorts alphabetically', () => {
    const students = [
      createStudent({ id: 'stu-1', class: 'Primary 2' }),
      createStudent({ id: 'stu-2', class: 'Primary 1' }),
      createStudent({ id: 'stu-3', class: 'Primary 2' }),
    ];
    const invoices = [
      createInvoice({
        id: 'inv-1',
        studentId: 'stu-1',
        totalAmountDue: 3000000,
        totalAmountPaid: 3000000,
        status: 'paid',
      }),
      createInvoice({
        id: 'inv-2',
        studentId: 'stu-2',
        totalAmountDue: 5000000,
        totalAmountPaid: 0,
        status: 'unpaid',
      }),
      createInvoice({
        id: 'inv-3',
        studentId: 'stu-3',
        totalAmountDue: 4000000,
        totalAmountPaid: 4000000,
        status: 'paid',
      }),
    ];

    const result = buildClassReport(invoices, students);

    expect(result).toHaveLength(2);
    // Should be sorted alphabetically: Primary 1 before Primary 2
    expect(result[0].class).toBe('Primary 1');
    expect(result[1].class).toBe('Primary 2');

    // Primary 1: 1 student, ₦50,000 due, ₦0 collected
    expect(result[0].totalDue).toBe(5000000);
    expect(result[0].totalCollected).toBe(0);
    expect(result[0].unpaidCount).toBe(1);

    // Primary 2: 2 students, ₦30,000 + ₦40,000 = ₦70,000 due, all collected
    expect(result[1].totalDue).toBe(7000000);
    expect(result[1].totalCollected).toBe(7000000);
    expect(result[1].paidCount).toBe(2);
  });

  test('skips invoices whose studentId is not found in students array', () => {
    const students = [createStudent({ id: 'stu-1' })];
    const invoices = [
      createInvoice({ id: 'inv-1', studentId: 'stu-1', totalAmountDue: 5000000 }),
      createInvoice({ id: 'inv-2', studentId: 'UNKNOWN', totalAmountDue: 9000000 }),
    ];

    const result = buildClassReport(invoices, students);

    expect(result).toHaveLength(1);
    // Only stu-1's invoice should be counted
    expect(result[0].totalDue).toBe(5000000);
  });

  test('handles overpaid status in paid count', () => {
    const students = [createStudent({ id: 'stu-1' })];
    const invoices = [
      createInvoice({
        studentId: 'stu-1',
        totalAmountDue: 5000000,
        totalAmountPaid: 6000000,
        status: 'overpaid',
      }),
    ];

    const result = buildClassReport(invoices, students);

    expect(result[0].paidCount).toBe(1); // overpaid counts as paid
    expect(result[0].totalCollected).toBe(6000000);
  });

  test('returns empty array when no invoices', () => {
    const students = [createStudent({ id: 'stu-1' })];
    const result = buildClassReport([], students);
    expect(result).toEqual([]);
  });

  test('returns empty array when no students match any invoice', () => {
    const students = [createStudent({ id: 'stu-99' })];
    const invoices = [createInvoice({ studentId: 'stu-1' })];
    const result = buildClassReport(invoices, students);
    expect(result).toEqual([]);
  });
});

// ── buildStudentReport ───────────────────────

describe('buildStudentReport', () => {
  test('maps invoice outstanding to student rows correctly', () => {
    const students = [
      createStudent({ id: 'stu-1', fullName: 'Jane Doe', class: 'Primary 1' }),
      createStudent({ id: 'stu-2', fullName: 'Tola Babs', class: 'JSS 1' }),
    ];
    const invoices = [
      createInvoice({
        studentId: 'stu-1',
        outstandingBalance: 2000000,
        status: 'partial',
      }),
      createInvoice({
        studentId: 'stu-2',
        outstandingBalance: 5000000,
        status: 'unpaid',
      }),
    ];

    const result = buildStudentReport(invoices, students);

    expect(result).toHaveLength(2);
    // Sorted by outstanding descending — Tola Babs (₦50,000) first
    expect(result[0].fullName).toBe('Tola Babs');
    expect(result[0].outstanding).toBe(5000000);
    expect(result[0].status).toBe('unpaid');
    expect(result[0].class).toBe('JSS 1');

    expect(result[1].fullName).toBe('Jane Doe');
    expect(result[1].outstanding).toBe(2000000);
    expect(result[1].status).toBe('partial');
  });

  test('skips invoices with unknown studentId', () => {
    const students = [createStudent({ id: 'stu-1' })];
    const invoices = [
      createInvoice({ studentId: 'stu-1', outstandingBalance: 1000000 }),
      createInvoice({ studentId: 'MISSING', outstandingBalance: 9999999 }),
    ];

    const result = buildStudentReport(invoices, students);
    expect(result).toHaveLength(1);
    expect(result[0].studentId).toBe('stu-1');
  });

  test('excludes paid students (outstanding = 0) — correct for Outstanding Students table', () => {
    const students = [createStudent({ id: 'stu-1' })];
    const invoices = [
      createInvoice({
        studentId: 'stu-1',
        outstandingBalance: 0,
        status: 'paid',
      }),
    ];

    const result = buildStudentReport(invoices, students);
    // Paid students (outstandingBalance = 0) are intentionally filtered out
    // because this powers the "Outstanding Students" table
    expect(result).toHaveLength(0);
  });

  test('student with multiple invoices appears as ONE row with summed outstanding', () => {
    const students = [createStudent({ id: 'stu-1', fullName: 'Jane Doe' })];
    const invoices = [
      createInvoice({
        id: 'inv-1',
        studentId: 'stu-1',
        outstandingBalance: 3000000,
        status: 'partial',
      }),
      createInvoice({
        id: 'inv-2',
        studentId: 'stu-1',
        outstandingBalance: 1000000,
        status: 'partial',
      }),
    ];

    const result = buildStudentReport(invoices, students);
    // Should be aggregated: one row per student, outstanding summed
    expect(result).toHaveLength(1);
    expect(result[0].studentId).toBe('stu-1');
    expect(result[0].outstanding).toBe(4000000); // 3,000,000 + 1,000,000
    expect(result[0].status).toBe('partial');
  });

  test('multi-invoice aggregation uses worst status', () => {
    const students = [createStudent({ id: 'stu-1', fullName: 'Jane Doe' })];
    const invoices = [
      createInvoice({
        id: 'inv-1',
        studentId: 'stu-1',
        outstandingBalance: 0,
        status: 'paid',
      }),
      createInvoice({
        id: 'inv-2',
        studentId: 'stu-1',
        outstandingBalance: 2000000,
        status: 'unpaid',
      }),
    ];

    const result = buildStudentReport(invoices, students);
    expect(result).toHaveLength(1);
    expect(result[0].outstanding).toBe(2000000);
    // unpaid is worse than paid, so it should reflect unpaid
    expect(result[0].status).toBe('unpaid');
  });
});

// ── calculateCollectionRate ──────────────────

describe('calculateCollectionRate', () => {
  test('100% collection', () => {
    expect(calculateCollectionRate(10000000, 10000000)).toBe(100);
  });

  test('0% collection', () => {
    expect(calculateCollectionRate(10000000, 0)).toBe(0);
  });

  test('partial collection rounds to 2 decimal places', () => {
    // 3,000,000 / 10,000,000 = 30%
    expect(calculateCollectionRate(10000000, 3000000)).toBe(30);
    // 3,333,333 / 10,000,000 = 33.33%
    expect(calculateCollectionRate(10000000, 3333333)).toBe(33.33);
  });

  test('guards against divide-by-zero', () => {
    expect(calculateCollectionRate(0, 0)).toBe(0);
    expect(calculateCollectionRate(0, 5000000)).toBe(0);
  });

  test('overpayment can exceed 100%', () => {
    expect(calculateCollectionRate(5000000, 6000000)).toBe(120);
  });
});

// ── End-to-end data pipeline accuracy ────────

describe('Full pipeline accuracy (simulates API route logic)', () => {
  test('totalDue and totalCollected from byClass match direct invoice sums', () => {
    const students = [
      createStudent({ id: 'stu-1', class: 'Primary 1' }),
      createStudent({ id: 'stu-2', class: 'Primary 2' }),
      createStudent({ id: 'stu-3', class: 'Primary 1' }),
    ];
    const invoices = [
      createInvoice({
        studentId: 'stu-1',
        totalAmountDue: 5000000,
        totalAmountPaid: 5000000,
        outstandingBalance: 0,
        status: 'paid',
      }),
      createInvoice({
        studentId: 'stu-2',
        totalAmountDue: 3000000,
        totalAmountPaid: 1000000,
        outstandingBalance: 2000000,
        status: 'partial',
      }),
      createInvoice({
        studentId: 'stu-3',
        totalAmountDue: 4000000,
        totalAmountPaid: 0,
        outstandingBalance: 4000000,
        status: 'unpaid',
      }),
    ];

    // Replicate exact API route logic
    const byClass = buildClassReport(invoices, students);
    const byStudent = buildStudentReport(invoices, students);

    const totalDue = byClass.reduce((sum, row) => sum + row.totalDue, 0);
    const totalCollected = byClass.reduce(
      (sum, row) => sum + row.totalCollected,
      0
    );
    const collectionRate = calculateCollectionRate(totalDue, totalCollected);

    // Verify aggregated totals match raw invoice sums
    const rawTotalDue = invoices.reduce((s, i) => s + i.totalAmountDue, 0);
    const rawTotalPaid = invoices.reduce((s, i) => s + i.totalAmountPaid, 0);

    expect(totalDue).toBe(rawTotalDue); // 12,000,000 kobo = ₦120,000
    expect(totalCollected).toBe(rawTotalPaid); // 6,000,000 kobo = ₦60,000
    expect(totalDue).toBe(12000000);
    expect(totalCollected).toBe(6000000);
    expect(collectionRate).toBe(50);

    // Student report only includes invoices with outstanding > 0
    // stu-1 is fully paid (outstanding=0), so only stu-2 and stu-3 appear
    expect(byStudent).toHaveLength(2);
    // Outstanding sum from student report matches sum of UNPAID invoices only
    const unpaidInvoices = invoices.filter((i) => i.outstandingBalance > 0);
    const rawOutstanding = unpaidInvoices.reduce((s, i) => s + i.outstandingBalance, 0);
    const reportOutstanding = byStudent.reduce((s, r) => s + r.outstanding, 0);
    expect(reportOutstanding).toBe(rawOutstanding);
    expect(reportOutstanding).toBe(6000000); // ₦20,000 + ₦40,000
  });
});
