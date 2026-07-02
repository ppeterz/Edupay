'use client';

// ──────────────────────────────────────────────
// EduPay — Payments Page (Placeholder)
// ──────────────────────────────────────────────

import { CreditCard } from 'lucide-react';

export default function PaymentsPage() {
  return (
    <div className="flex h-full items-center justify-center p-6">
      <div className="text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gray-100">
          <CreditCard className="h-8 w-8 text-gray-400" />
        </div>
        <h2 className="text-lg font-semibold text-gray-900">Payments</h2>
        <p className="mt-2 text-sm text-gray-500">
          Payment tracking &mdash; coming in Stage 7
        </p>
      </div>
    </div>
  );
}
