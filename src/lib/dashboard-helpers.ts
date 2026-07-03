// ──────────────────────────────────────────────
// EduPay — Dashboard Helper Functions (Stage 7)
// ──────────────────────────────────────────────
// Pure utility functions for calculating analytics stats and mapping statuses
// to colors/labels for clean, visual presentation.

import type {
  Student,
  Invoice,
  Payment,
  ReconciliationEvent,
  DashboardStats,
} from '@/types';

/**
 * Aggregate real-time statistics from school collection data.
 */
export function computeDashboardStats(
  students: Student[],
  invoices: Invoice[],
  payments: Payment[]
): DashboardStats {
  const totalStudents = students.length;

  // Total revenue is the sum of all successfully processed payments
  const totalRevenue = payments
    .filter((p) => p.paymentStatus === 'processed')
    .reduce((sum, p) => sum + p.amount, 0);

  // Sum outstanding balance across all current students
  const outstandingTotal = students.reduce(
    (sum, s) => sum + s.outstandingBalance,
    0
  );

  // Status counts across all school invoices
  const paidCount = invoices.filter(
    (i) => i.status === 'paid' || i.status === 'overpaid'
  ).length;
  const partialCount = invoices.filter((i) => i.status === 'partial').length;
  const unpaidCount = invoices.filter((i) => i.status === 'unpaid').length;

  return {
    totalStudents,
    totalRevenue,
    outstandingTotal,
    paidCount,
    partialCount,
    unpaidCount,
  };
}

/**
 * Map reconciliation event types to accessible styling assets and user-friendly labels.
 * 
 * NOTE ON DUPLICATES:
 * 'duplicate_rejected' is a type definition in ReconciliationEvent, but the transaction engine 
 * skips duplicate transactions before writing events. Duplicate webhook calls are logged in 
 * `webhook_log` but do not generate `reconciliation_events`.
 */
export function eventTypeColor(eventType: ReconciliationEvent['eventType']): {
  bg: string;
  text: string;
  label: string;
} {
  switch (eventType) {
    case 'full_payment':
      return { bg: 'bg-green-50 border-green-200', text: 'text-green-800 border', label: 'Full Payment' };
    case 'underpayment':
      return { bg: 'bg-amber-50 border-amber-200', text: 'text-amber-800 border', label: 'Underpayment' };
    case 'overpayment':
      return { bg: 'bg-blue-50 border-blue-200', text: 'text-blue-800 border', label: 'Overpayment' };
    case 'credit_applied':
      return { bg: 'bg-blue-50 border-blue-200', text: 'text-blue-800 border', label: 'Credit Applied' };
    case 'duplicate_rejected':
      return { bg: 'bg-slate-50 border-slate-200', text: 'text-slate-600 border', label: 'Duplicate' };
    default:
      return { bg: 'bg-slate-50 border-slate-200', text: 'text-slate-600 border', label: eventType };
  }
}

/**
 * Map payment ingestion statuses to badge styling properties and readable labels.
 */
export function paymentStatusColor(status: Payment['paymentStatus']): {
  bg: string;
  text: string;
  label: string;
} {
  switch (status) {
    case 'processed':
      return { bg: 'bg-green-50 border-green-200', text: 'text-green-800 border', label: 'Processed' };
    case 'pending':
      return { bg: 'bg-amber-50 border-amber-200', text: 'text-amber-800 border', label: 'Pending' };
    case 'failed':
      return { bg: 'bg-red-50 border-red-200', text: 'text-red-800 border', label: 'Failed' };
    case 'duplicate':
      return { bg: 'bg-slate-50 border-slate-200', text: 'text-slate-600 border', label: 'Duplicate' };
    default:
      return { bg: 'bg-slate-50 border-slate-200', text: 'text-slate-600 border', label: status };
  }
}
