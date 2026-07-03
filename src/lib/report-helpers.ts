// ──────────────────────────────────────────────
// EduPay — Report Helper Functions (Stage 8)
// ──────────────────────────────────────────────
// Pure functions for building class-level and student-level report data.
// No Firestore calls — these operate on pre-fetched arrays.

import type { Invoice, Student } from '@/types';

export interface ClassReportRow {
  class: string;
  totalDue: number;
  totalCollected: number;
  paidCount: number;
  partialCount: number;
  unpaidCount: number;
}

export interface StudentReportRow {
  studentId: string;
  fullName: string;
  class: string;
  outstanding: number;
  status: Invoice['status'];
}

/**
 * Aggregate invoice data by class for the school-level collection report.
 */
export function buildClassReport(
  invoices: Invoice[],
  students: Student[]
): ClassReportRow[] {
  const studentsById = new Map(students.map((s) => [s.id, s]));
  const byClass = new Map<string, ClassReportRow>();

  for (const invoice of invoices) {
    const student = studentsById.get(invoice.studentId);
    if (!student) continue;

    const className = student.class;
    const row = byClass.get(className) ?? {
      class: className,
      totalDue: 0,
      totalCollected: 0,
      paidCount: 0,
      partialCount: 0,
      unpaidCount: 0,
    };

    row.totalDue += invoice.totalAmountDue;
    row.totalCollected += invoice.totalAmountPaid;

    if (invoice.status === 'paid' || invoice.status === 'overpaid') {
      row.paidCount++;
    } else if (invoice.status === 'partial') {
      row.partialCount++;
    } else {
      row.unpaidCount++;
    }

    byClass.set(className, row);
  }

  return Array.from(byClass.values()).sort((a, b) =>
    a.class.localeCompare(b.class)
  );
}

/**
 * Build per-student outstanding report from invoice data.
 * Sorted descending by outstanding balance (worst offenders first).
 */
export function buildStudentReport(
  invoices: Invoice[],
  students: Student[]
): StudentReportRow[] {
  const studentsById = new Map(students.map((s) => [s.id, s]));

  return invoices
    .filter((inv) => inv.outstandingBalance > 0)
    .map((inv) => {
      const student = studentsById.get(inv.studentId);
      if (!student) return null;
      return {
        studentId: student.id,
        fullName: student.fullName,
        class: student.class,
        outstanding: inv.outstandingBalance,
        status: inv.status,
      };
    })
    .filter((r): r is StudentReportRow => r !== null)
    .sort((a, b) => b.outstanding - a.outstanding);
}

/**
 * Calculate the collection rate as a percentage (2 decimal places).
 * Guards against divide-by-zero (returns 0, not NaN or Infinity).
 */
export function calculateCollectionRate(
  totalDue: number,
  totalCollected: number
): number {
  if (totalDue === 0) return 0;
  return Math.round((totalCollected / totalDue) * 10000) / 100;
}
