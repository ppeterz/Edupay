'use client';

// ──────────────────────────────────────────────
// EduPay — Bulk Invoice Result Summary
// ──────────────────────────────────────────────
// Shown after a successful bulk invoice creation.
// Success summary first, then interactive skipped-student review below.

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { CheckCircle2, ExternalLink } from 'lucide-react';
import { SkippedStudentReview } from '@/components/invoices/SkippedStudentReview';
import type { BulkInvoiceResult } from '@/components/invoices/BulkInvoiceForm';

interface BulkInvoiceResultSummaryProps {
  result: BulkInvoiceResult;
  onClose: () => void;
}

const MAX_VISIBLE = 20;

export function BulkInvoiceResultSummary({
  result,
  onClose,
}: BulkInvoiceResultSummaryProps) {
  const visibleDetails =
    result.details.length <= MAX_VISIBLE
      ? result.details
      : result.details.slice(0, MAX_VISIBLE);
  const remainingCount = Math.max(0, result.details.length - MAX_VISIBLE);

  return (
    <div className="space-y-5">
      {/* Success header */}
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-green-100">
          <CheckCircle2 className="h-5 w-5 text-green-600" />
        </div>
        <div>
          <h3 className="text-lg font-bold text-gray-900">
            {result.created} invoice{result.created !== 1 ? 's' : ''} created
          </h3>
          {result.skipped > 0 && (
            <p className="text-sm text-gray-500">
              {result.skipped} student{result.skipped !== 1 ? 's' : ''} had existing invoices — see below
            </p>
          )}
        </div>
      </div>

      {/* Created invoices list */}
      {result.created > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-medium text-gray-700">Created invoices</p>
          <div className="max-h-48 overflow-y-auto rounded-md border border-gray-200">
            {visibleDetails.map((d) => (
              <div
                key={d.invoiceId}
                className="flex items-center justify-between border-b border-gray-100 px-3 py-2 last:border-b-0"
              >
                <span className="text-sm text-gray-900">{d.studentName}</span>
                <Link
                  href={`/dashboard/students/${d.studentId}`}
                  className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800"
                >
                  View
                  <ExternalLink className="h-3 w-3" />
                </Link>
              </div>
            ))}

            {remainingCount > 0 && (
              <div className="bg-gray-50 px-3 py-2 text-center text-xs text-gray-500">
                …and {remainingCount} more
              </div>
            )}
          </div>
        </div>
      )}

      {/* Skipped students — interactive review */}
      {result.skippedByClass.length > 0 && (
        <SkippedStudentReview
          skippedByClass={result.skippedByClass}
          bulkTemplate={result.bulkTemplate}
          onDone={onClose}
        />
      )}

      {/* Done button — only show if no skipped students (otherwise SkippedStudentReview has its own) */}
      {result.skippedByClass.length === 0 && (
        <Button onClick={onClose} className="w-full">
          Done
        </Button>
      )}
    </div>
  );
}

