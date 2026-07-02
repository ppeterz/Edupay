'use client';

// ──────────────────────────────────────────────
// EduPay — Dashboard Home
// ──────────────────────────────────────────────

import { useAuth } from '@/contexts/AuthContext';
import { useStudents } from '@/hooks/useStudents';
import { Skeleton } from '@/components/ui/skeleton';
import { Users, TrendingDown, CheckCircle2 } from 'lucide-react';
import { kobotoNaira } from '@/lib/constants';

export default function DashboardPage() {
  const { school } = useAuth();
  const { students, loading } = useStudents();

  const totalStudents = students.length;
  const totalOutstanding = students.reduce(
    (sum, s) => sum + s.outstandingBalance,
    0
  );
  const paidCount = students.filter(
    (s) => s.outstandingBalance === 0
  ).length;

  if (loading) {
    return (
      <div className="p-6 lg:p-8">
        <Skeleton className="mb-2 h-8 w-48" />
        <Skeleton className="mb-8 h-4 w-72" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Skeleton className="h-28 rounded-lg" />
          <Skeleton className="h-28 rounded-lg" />
          <Skeleton className="h-28 rounded-lg" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">
          {school?.name ?? 'Dashboard'}
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          Financial Reconciliation Dashboard
        </p>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-lg border border-gray-200 bg-white p-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50">
              <Users className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-gray-500">
                Total Students
              </p>
              <p className="text-2xl font-bold text-gray-900">
                {totalStudents}
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-gray-200 bg-white p-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-50">
              <TrendingDown className="h-5 w-5 text-red-600" />
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-gray-500">
                Total Outstanding
              </p>
              <p
                className={`text-2xl font-bold ${
                  totalOutstanding > 0
                    ? 'text-red-600'
                    : 'text-green-600'
                }`}
              >
                {kobotoNaira(totalOutstanding)}
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-gray-200 bg-white p-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-50">
              <CheckCircle2 className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-gray-500">
                Fully Paid
              </p>
              <p className="text-2xl font-bold text-gray-900">
                {paidCount}
                <span className="ml-1 text-sm font-normal text-gray-400">
                  / {totalStudents}
                </span>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
