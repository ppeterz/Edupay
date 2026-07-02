'use client';

// ──────────────────────────────────────────────
// EduPay — Reports Page (Placeholder)
// ──────────────────────────────────────────────

import { BarChart2 } from 'lucide-react';

export default function ReportsPage() {
  return (
    <div className="flex h-full items-center justify-center p-6">
      <div className="text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gray-100">
          <BarChart2 className="h-8 w-8 text-gray-400" />
        </div>
        <h2 className="text-lg font-semibold text-gray-900">Reports</h2>
        <p className="mt-2 text-sm text-gray-500">
          Financial reports &mdash; coming in Stage 8
        </p>
      </div>
    </div>
  );
}
