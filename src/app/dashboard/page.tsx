// ──────────────────────────────────────────────
// EduPay — Redesigned Premium Dashboard Page
// ──────────────────────────────────────────────

'use client';

import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useDashboardStats } from '@/hooks/useDashboardStats';
import { useRecentEvents } from '@/hooks/useRecentEvents';
import { RecentWebhookLog } from '@/components/dashboard/RecentWebhookLog';
import { eventTypeColor } from '@/lib/dashboard-helpers';
import { kobotoNaira } from '@/lib/constants';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent } from '@/components/ui/card';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import {
  Users,
  TrendingDown,
  CheckCircle2,
  Clock,
  Sparkles,
  FileCheck,
  MoreHorizontal,
  ChevronRight,
  TrendingUp,
  AlertCircle,
} from 'lucide-react';
import Link from 'next/link';

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

  // Group events by day to render a live collection chart
  const getCollectionTrend = () => {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const dayMap: Record<string, number> = {};
    
    // Initialize last 7 days
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const name = days[d.getDay()];
      dayMap[name] = 0;
    }
    
    // Populate with real event values
    events.forEach((evt) => {
      try {
        const date = new Date(evt.createdAt);
        const name = days[date.getDay()];
        if (dayMap[name] !== undefined) {
          dayMap[name] += evt.amountReceived / 100; // in Naira
        }
      } catch (e) {}
    });

    return Object.keys(dayMap).map((name) => ({
      name,
      Naira: dayMap[name],
    }));
  };

  const trendData = getCollectionTrend();

  // Compute stats metrics
  const totalTuition = stats.totalRevenue + stats.outstandingTotal;
  const collectionRate = totalTuition > 0 ? (stats.totalRevenue / totalTuition) * 100 : 0;

  if (loading) {
    return (
      <div className="space-y-8 animate-pulse">
        {/* Stats Grid Skeletons */}
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, idx) => (
            <Skeleton key={idx} className="h-28 rounded-3xl" />
          ))}
        </div>

        {/* Content Columns Skeleton */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-4">
            <Skeleton className="h-6 w-36" />
            <Skeleton className="h-96 rounded-3xl" />
          </div>
          <div className="lg:col-span-1 space-y-4">
            <Skeleton className="h-6 w-36" />
            <Skeleton className="h-96 rounded-3xl" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* ── 1. Stats Cards Row ── */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {/* Total Students */}
        <Card className="border-0 bg-[#e2edf8]/40 shadow-none rounded-[28px] relative overflow-hidden group hover:scale-[1.01] transition-transform">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div className="flex h-11 w-11 items-center justify-center rounded-full bg-white shadow-sm border border-slate-100/50">
                <Users className="h-5 w-5 text-blue-600" />
              </div>
              <button className="text-slate-400 hover:text-slate-650">
                <MoreHorizontal className="h-4 w-4" />
              </button>
            </div>
            <div className="mt-6">
              <p className="text-3xl font-extrabold tracking-tight text-slate-950 font-sans">
                {stats.totalStudents}
              </p>
              <p className="text-xs font-semibold text-slate-500 mt-1 uppercase tracking-wider">
                Total Students
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Total Revenue */}
        <Card className="border-0 bg-[#e2edf8]/40 shadow-none rounded-[28px] relative overflow-hidden group hover:scale-[1.01] transition-transform">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div className="flex h-11 w-11 items-center justify-center rounded-full bg-white shadow-sm border border-slate-100/50">
                <Sparkles className="h-5 w-5 text-emerald-600" />
              </div>
              <button className="text-slate-400 hover:text-slate-650">
                <MoreHorizontal className="h-4 w-4" />
              </button>
            </div>
            <div className="mt-6">
              <p className="text-2xl font-extrabold tracking-tight text-slate-950 font-mono">
                {kobotoNaira(stats.totalRevenue)}
              </p>
              <p className="text-xs font-semibold text-slate-500 mt-1 uppercase tracking-wider">
                Total Revenue
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Total Outstanding */}
        <Card className="border-0 bg-[#e2edf8]/40 shadow-none rounded-[28px] relative overflow-hidden group hover:scale-[1.01] transition-transform">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div className="flex h-11 w-11 items-center justify-center rounded-full bg-white shadow-sm border border-slate-100/50">
                <TrendingDown className={`h-5 w-5 ${stats.outstandingTotal > 0 ? 'text-red-500' : 'text-slate-400'}`} />
              </div>
              <button className="text-slate-400 hover:text-slate-650">
                <MoreHorizontal className="h-4 w-4" />
              </button>
            </div>
            <div className="mt-6">
              <p className={`text-2xl font-extrabold tracking-tight font-mono ${stats.outstandingTotal > 0 ? 'text-red-650' : 'text-slate-950'}`}>
                {kobotoNaira(stats.outstandingTotal)}
              </p>
              <p className="text-xs font-semibold text-slate-500 mt-1 uppercase tracking-wider">
                Outstanding Balance
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Invoicing Stage Counts */}
        <Card className="border-0 bg-[#e2edf8]/40 shadow-none rounded-[28px] relative overflow-hidden group hover:scale-[1.01] transition-transform">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div className="flex h-11 w-11 items-center justify-center rounded-full bg-white shadow-sm border border-slate-100/50">
                <FileCheck className="h-5 w-5 text-indigo-600" />
              </div>
              <button className="text-slate-400 hover:text-slate-650">
                <MoreHorizontal className="h-4 w-4" />
              </button>
            </div>
            <div className="mt-6 flex justify-between gap-1 items-baseline font-mono">
              <div>
                <p className="text-lg font-bold text-emerald-600">{stats.paidCount}</p>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Paid</p>
              </div>
              <div>
                <p className="text-lg font-bold text-amber-600">{stats.partialCount}</p>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Partial</p>
              </div>
              <div>
                <p className="text-lg font-bold text-red-550">{stats.unpaidCount}</p>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Unpaid</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── 2. Middle Row: Graph and Reconciliation Progress ── */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Left: Recharts Area Chart */}
        <div className="lg:col-span-2 rounded-[28px] border border-slate-200/50 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500">Money Collected</h3>
              <p className="text-xs text-slate-400 font-medium mt-0.5">Payments received in the last 7 days</p>
            </div>
            <div className="flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-[10px] font-bold text-emerald-700">
              <TrendingUp className="h-3.5 w-3.5" />
              <span>Live updates</span>
            </div>
          </div>
          
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trendData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorNaira" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.25}/>
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.005}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis 
                  dataKey="name" 
                  tickLine={false} 
                  axisLine={false} 
                  stroke="#94a3b8" 
                  fontSize={11} 
                  fontWeight={600}
                />
                <YAxis 
                  tickLine={false} 
                  axisLine={false} 
                  stroke="#94a3b8" 
                  fontSize={11} 
                  fontWeight={600}
                />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: '#0f172a', 
                    borderRadius: '16px', 
                    border: 'none', 
                    color: '#fff', 
                    fontSize: '12px',
                    fontWeight: 'bold',
                    boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)'
                  }} 
                  labelClassName="text-slate-400"
                  formatter={(value) => [`₦${Number(value).toLocaleString()}`, 'Revenue']}
                />
                <Area 
                  type="monotone" 
                  dataKey="Naira" 
                  stroke="#2563eb" 
                  strokeWidth={2.5} 
                  fillOpacity={1} 
                  fill="url(#colorNaira)" 
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Right: Formation/Collection status widget */}
        <div className="lg:col-span-1 rounded-[28px] bg-slate-950 text-white p-6 shadow-xl relative overflow-hidden border border-slate-900 flex flex-col justify-between">
          <div className="absolute top-0 right-0 w-32 h-32 rounded-full bg-blue-500/10 blur-2xl pointer-events-none" />
          
          <div>
            <div className="flex items-center justify-between pb-4 border-b border-slate-850">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Collection Progress</span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-900 border border-slate-800 text-slate-350">
                Current Term
              </span>
            </div>

            <div className="mt-6 space-y-4">
              <div className="flex items-baseline justify-between">
                <h4 className="text-3xl font-extrabold font-mono">{collectionRate.toFixed(1)}%</h4>
                <p className="text-xs text-slate-400 font-semibold">of fees collected</p>
              </div>
              
              {/* Thick slider progress capsule */}
              <div className="w-full h-3.5 bg-slate-900 rounded-full overflow-hidden border border-slate-850">
                <div 
                  className="h-full bg-white rounded-full transition-all duration-500 shadow-[0_0_12px_rgba(255,255,255,0.4)]"
                  style={{ width: `${Math.max(3, collectionRate)}%` }}
                />
              </div>

              <div className="flex items-center gap-2 text-xs text-slate-400 font-medium">
                <Clock className="h-4 w-4 text-slate-500" />
                <span>Estimated collection time: 1–2 school weeks</span>
              </div>
            </div>
          </div>

          <div className="mt-8 pt-5 border-t border-slate-850">
            <Link 
              href="/dashboard/invoices/review"
              className="flex w-full items-center justify-between rounded-2xl bg-white text-slate-950 px-4 py-3 font-bold text-xs shadow hover:bg-slate-100 active:scale-[0.98] transition-all"
            >
              <span>Review pending invoices</span>
              <ChevronRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </div>

      {/* ── 3. Bottom Row: Recent activity and diagnostics ── */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Left: Recent Activity list */}
        <div className="lg:col-span-2 flex flex-col rounded-[28px] border border-slate-200/50 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between pb-4 border-b border-slate-100">
            <div>
              <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500">Recent Payments</h3>
              <p className="text-xs text-slate-450 font-medium mt-0.5">Latest payment activity</p>
            </div>
            <Link 
              href="/dashboard/payments"
              className="text-xs font-bold text-blue-600 hover:text-blue-700 flex items-center gap-0.5"
            >
              <span>View all payments</span>
              <ChevronRight className="h-3.5 w-3.5" />
            </Link>
          </div>
          
          <div className="flex-1 overflow-y-auto max-h-[350px] mt-4 pr-1">
            {events.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-full bg-slate-50 border border-slate-100">
                  <Clock className="h-5 w-5 text-slate-455" />
                </div>
                <p className="text-xs font-bold text-slate-500">No payments received yet</p>
                <p className="text-[10px] text-slate-400 mt-1">Payments will appear here once parents start paying.</p>
              </div>
            ) : (
              <div className="space-y-3.5" aria-live="polite">
                {events.map((event) => {
                  const student = students.find((s) => s.id === event.studentId);
                  const studentName = student ? student.fullName : `Student ID: ${event.studentId.slice(0, 8)}...`;
                  const badge = eventTypeColor(event.eventType);

                  // Initials for avatar
                  const initials = studentName.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase();

                  return (
                    <div
                      key={event.id}
                      className="flex items-center justify-between border-b border-slate-50 pb-3 last:border-0 last:pb-0"
                    >
                      <div className="flex items-center gap-3">
                        <div className="h-9 w-9 rounded-full bg-slate-100 border border-slate-200/40 font-bold text-slate-700 flex items-center justify-center text-xs">
                          {initials}
                        </div>
                        <div className="space-y-0.5">
                          <p className="text-xs font-bold text-slate-950">
                            {studentName}
                          </p>
                          <div className="flex items-center gap-2 text-[10px] font-semibold">
                            <span className={`inline-flex items-center rounded-full px-2 py-0.2 text-[9px] font-bold capitalize ${badge.bg} ${badge.text}`}>
                              {badge.label}
                            </span>
                            <span className="text-slate-450">
                              {formatRelativeTime(event.createdAt)}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="text-right space-y-0.5">
                        <p className="font-mono text-xs font-bold tabular-nums text-slate-950">
                          {kobotoNaira(event.amountReceived)}
                        </p>
                        {event.creditGenerated > 0 && (
                          <p className="text-[9px] text-blue-600 font-bold">
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

        {/* Right: payment processing feed */}
        <div className="lg:col-span-1">
          <RecentWebhookLog />
        </div>
      </div>
    </div>
  );
}
