// ──────────────────────────────────────────────
// EduPay — Dashboard Home Page (Stage 7)
// ──────────────────────────────────────────────
// Shows live stats, a real-time reconciliation event feed, and raw webhook
// developer panels updating dynamically as transactions are processed.

'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useDashboardStats } from '@/hooks/useDashboardStats';
import { useRecentEvents } from '@/hooks/useRecentEvents';
import { RecentWebhookLog } from '@/components/dashboard/RecentWebhookLog';
import { eventTypeColor } from '@/lib/dashboard-helpers';
import { kobotoNaira } from '@/lib/constants';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import {
  Users,
  TrendingDown,
  CheckCircle2,
  AlertCircle,
  Clock,
  Sparkles,
  FileCheck,
} from 'lucide-react';

function formatRelativeTime(dateStr: string): string {
  try {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    
    if (diffMs < 0) return 'Just now';

    const diffSecs = Math.floor(diffMs / 1000);
    const diffMins = Math.floor(diffSecs / 60);
    const diffHours = Math.floor(diffMins / 60);

    if (diffSecs < 10) return 'Just now';
    if (diffSecs < 60) return `${diffSecs}s ago`;
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    
    return date.toLocaleDateString('en-NG', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return 'Pending';
  }
}

export default function DashboardPage() {
  const { school } = useAuth();
  const { stats, students, loading: statsLoading } = useDashboardStats();
  const { events, loading: eventsLoading } = useRecentEvents(10);

  const loading = statsLoading || eventsLoading;

  // ── Loading state ──────────────────────────
  if (loading) {
    return (
      <div className="p-6 lg:p-8 space-y-8">
        <div>
          <Skeleton className="h-8 w-48 mb-2" />
          <Skeleton className="h-4 w-72" />
        </div>

        {/* Stats Grid Skeletons */}
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, idx) => (
            <Skeleton key={idx} className="h-28 rounded-lg" />
          ))}
        </div>

        {/* Content Columns Skeleton */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-4">
            <Skeleton className="h-6 w-36" />
            <Skeleton className="h-96 rounded-lg" />
          </div>
          <div className="lg:col-span-1 space-y-4">
            <Skeleton className="h-6 w-36" />
            <Skeleton className="h-96 rounded-lg" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8 space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900">
          {school?.name ?? 'Admin Dashboard'}
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Real-time financial reconciliation overview
        </p>
      </div>

      {/* Stats Cards Row */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {/* Total Students */}
        <Card className="border-slate-200 bg-white shadow-sm">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg border border-slate-100 bg-slate-50">
                <Users className="h-6 w-6 text-slate-600" />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Total Students
                </p>
                <p className="text-2xl font-bold text-slate-900 mt-0.5">
                  {stats.totalStudents}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Total Revenue */}
        <Card className="border-slate-200 bg-white shadow-sm">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg border border-green-100 bg-green-50/50">
                <Sparkles className="h-6 w-6 text-green-600" />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Total Revenue
                </p>
                <p className="text-2xl font-bold text-slate-900 mt-0.5 font-mono tabular-nums">
                  {kobotoNaira(stats.totalRevenue)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Total Outstanding */}
        <Card className="border-slate-200 bg-white shadow-sm">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg border border-slate-100 bg-slate-50">
                <TrendingDown className={`h-6 w-6 ${stats.outstandingTotal > 0 ? 'text-red-500' : 'text-slate-400'}`} />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Outstanding Balance
                </p>
                <p className={`text-2xl font-bold mt-0.5 font-mono tabular-nums ${stats.outstandingTotal > 0 ? 'text-red-600' : 'text-slate-900'}`}>
                  {kobotoNaira(stats.outstandingTotal)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Collection Status */}
        <Card className="border-slate-200 bg-white shadow-sm">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg border border-slate-100 bg-slate-50">
                <FileCheck className="h-6 w-6 text-slate-500" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Collection Status
                </p>
                <div className="flex items-center justify-between text-xs mt-2 text-slate-600 font-medium">
                  <span className="text-green-600 font-semibold">{stats.paidCount} Paid</span>
                  <span className="text-amber-600 font-semibold">{stats.partialCount} Partial</span>
                  <span className="text-red-600 font-semibold">{stats.unpaidCount} Unpaid</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main split sections */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Left column: Live event logs feed */}
        <div className="lg:col-span-2 flex flex-col rounded-lg border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 px-5 py-4">
            <h3 className="text-sm font-semibold text-slate-900">Recent Activity Logs</h3>
          </div>
          
          <div className="flex-1 overflow-y-auto max-h-[460px] p-5">
            {events.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-slate-50">
                  <Clock className="h-6 w-6 text-slate-400" />
                </div>
                <p className="text-sm font-medium text-slate-500">No payment activity yet</p>
                <p className="text-xs text-slate-400 mt-1">This feed updates in real-time as payments arrive.</p>
              </div>
            ) : (
              <div className="space-y-4" aria-live="polite">
                {events.map((event) => {
                  const student = students.find((s) => s.id === event.studentId);
                  const studentName = student ? student.fullName : `Student ID: ${event.studentId.slice(0, 8)}...`;
                  const badge = eventTypeColor(event.eventType);

                  return (
                    <div
                      key={event.id}
                      className="flex items-center justify-between border-b border-slate-50 pb-3 last:border-0 last:pb-0"
                    >
                      <div className="space-y-1">
                        <p className="text-xs font-semibold text-slate-900">
                          {studentName}
                        </p>
                        <div className="flex items-center gap-2 text-[10px]">
                          <span className={`inline-flex items-center rounded border px-1.5 py-0.2 text-[9px] font-medium capitalize ${badge.bg} ${badge.text}`}>
                            {badge.label}
                          </span>
                          <span className="text-slate-400">
                            {formatRelativeTime(event.createdAt)}
                          </span>
                        </div>
                      </div>

                      <div className="text-right space-y-1">
                        <p className="font-mono text-xs font-semibold tabular-nums text-slate-900">
                          {kobotoNaira(event.amountReceived)}
                        </p>
                        {event.creditGenerated > 0 && (
                          <p className="text-[10px] text-blue-600 font-semibold">
                            + {kobotoNaira(event.creditGenerated)} credit
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right column: Raw Webhook Diagnostics */}
        <div className="lg:col-span-1">
          <RecentWebhookLog />
        </div>
      </div>
    </div>
  );
}
