// ──────────────────────────────────────────────
// EduPay — CSV Export Utilities (Stage 8)
// ──────────────────────────────────────────────
// Generates CSV strings for browser download. Outputs raw Naira numbers
// (no ₦ symbol) so spreadsheet software can sum/sort the columns.

import type { StudentReportRow } from './report-helpers';

/**
 * Convert student report rows to a CSV string.
 * - Outstanding values are raw Naira numbers (kobo / 100), no currency symbol
 * - Student names containing commas or quotes are properly escaped
 * - Includes Term and Session columns when provided for context
 */
export function studentsToCSV(
  rows: StudentReportRow[],
  options?: { term?: string; session?: string }
): string {
  const header = 'Name,Class,Outstanding (NGN),Status,Term,Session\n';
  const term = options?.term ?? '';
  const session = options?.session ?? '';
  const body = rows
    .map((r) => {
      const outstandingNaira = (r.outstanding / 100).toFixed(2);
      const escapedName = `"${r.fullName.replace(/"/g, '""')}"`;
      return `${escapedName},${r.class},${outstandingNaira},${r.status},${term},${session}`;
    })
    .join('\n');
  return header + body;
}
