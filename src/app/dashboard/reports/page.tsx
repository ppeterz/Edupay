'use client';

// ──────────────────────────────────────────────
// EduPay — Reports Page (Stage 8)
// ──────────────────────────────────────────────
// School-level and class-level collection reporting with:
// - Term/Session selectors
// - Summary cards (Total Due, Total Collected, Collection Rate)
// - Bar chart by class (recharts)
// - Outstanding students table with class filter + CSV export

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { kobotoNaira, ALL_CLASSES } from '@/lib/constants';
import { studentsToCSV } from '@/lib/export';
import {
  buildClassReport,
  buildStudentReport,
  calculateCollectionRate,
} from '@/lib/report-helpers';
import type { ClassReportRow, StudentReportRow } from '@/lib/report-helpers';
import type { Invoice, Student } from '@/types';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import {
  Download,
  TrendingUp,
  AlertCircle,
  BarChart3,
  SlidersHorizontal,
  FileText,
} from 'lucide-react';

// ── Constants ────────────────────────────────

const TERMS = ['First Term', 'Second Term', 'Third Term'] as const;
const DEFAULT_SESSION = '2025/2026';

// ── Types ────────────────────────────────────

interface ReportData {
  totalDue: number;
  totalCollected: number;
  collectionRate: number;
  byClass: ClassReportRow[];
  byStudent: StudentReportRow[];
}

// ── Status badge helper ──────────────────────

function statusBadge(status: string) {
  switch (status) {
    case 'paid':
    case 'overpaid':
      return (
        <Badge className="border-green-200 bg-green-50 text-xs text-green-700 font-semibold">
          Paid
        </Badge>
      );
    case 'partial':
      return (
        <Badge className="border-amber-200 bg-amber-50 text-xs text-amber-700 font-semibold">
          Partial
        </Badge>
      );
    default:
      return (
        <Badge variant="destructive" className="text-xs font-semibold">
          Unpaid
        </Badge>
      );
  }
}

// ── Chart tooltip formatter ──────────────────

function chartTooltipFormatter(value: unknown) {
  if (value === undefined || value === null) return '';
  return kobotoNaira(Number(value));
}

// ── Component ────────────────────────────────

export default function ReportsPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();

  const [rawInvoices, setRawInvoices] = useState<Invoice[]>([]);
  const [rawStudents, setRawStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filter Mode: 'single' | 'range'
  const [filterMode, setFilterMode] = useState<'single' | 'range'>('single');

  // Single Session Mode Filters
  const [session, setSession] = useState<string>(DEFAULT_SESSION);
  const [term, setTerm] = useState<string>('All Terms');

  // Range Mode Filters
  const [startSession, setStartSession] = useState<string>(DEFAULT_SESSION);
  const [startTerm, setStartTerm] = useState<string>('First Term');
  const [endSession, setEndSession] = useState<string>(DEFAULT_SESSION);
  const [endTerm, setEndTerm] = useState<string>('Third Term');

  // Outstanding Students Class Filter
  const [classFilter, setClassFilter] = useState<string>('all');

  // ── Fetch all data once ──────────────────────

  const fetchReportData = useCallback(async () => {
    if (!user) return;

    setLoading(true);
    setError(null);

    try {
      const token = await user.getIdToken();
      const res = await fetch('/api/reports/summary', {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `HTTP ${res.status}`);
      }

      const json = await res.json();
      setRawInvoices(json.invoices || []);
      setRawStudents(json.students || []);
    } catch (err) {
      console.error('[ReportsPage] Fetch error:', err);
      setError(err instanceof Error ? err.message : 'Failed to load report data');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (!authLoading && user) {
      fetchReportData();
    }
  }, [authLoading, user, fetchReportData]);

  // ── Dynamically extract unique sessions from invoices ──

  const sessionsList = useMemo(() => {
    const set = new Set<string>();
    rawInvoices.forEach((inv) => {
      if (inv.session) set.add(inv.session);
    });
    if (set.size === 0) {
      set.add('2024/2025');
      set.add('2025/2026');
      set.add('2026/2027');
    }
    return Array.from(set).sort().reverse();
  }, [rawInvoices]);

  // Sync state values with available sessions once loaded
  useEffect(() => {
    if (sessionsList.length > 0) {
      if (!sessionsList.includes(session)) {
        setSession(sessionsList[0]);
      }
      if (!sessionsList.includes(startSession)) {
        setStartSession(sessionsList[sessionsList.length - 1] || sessionsList[0]);
      }
      if (!sessionsList.includes(endSession)) {
        setEndSession(sessionsList[0]);
      }
    }
  }, [sessionsList, session, startSession, endSession]);

  // ── Client-side Range & Filter Computations ──

  const { filteredInvoices, activeFilterLabel } = useMemo(() => {
    const getSessionYear = (s: string) => {
      const match = s?.match(/^(\d{4})/);
      return match ? parseInt(match[1], 10) : 0;
    };

    const getTermWeight = (t: string) => {
      const val = t?.toLowerCase().trim() || '';
      if (val.includes('first')) return 1;
      if (val.includes('second')) return 2;
      if (val.includes('third')) return 3;
      return 4;
    };

    const getScore = (s: string, t: string) => {
      return getSessionYear(s) * 10 + getTermWeight(t);
    };

    if (filterMode === 'single') {
      const filtered = rawInvoices.filter((inv) => {
        const matchesSession = inv.session === session;
        const matchesTerm = term === 'All Terms' || inv.term === term;
        return matchesSession && matchesTerm;
      });
      const label = term === 'All Terms' ? `${session} (All Terms)` : `${term} ${session}`;
      return { filteredInvoices: filtered, activeFilterLabel: label };
    } else {
      const startScore = getScore(startSession, startTerm);
      const endScore = getScore(endSession, endTerm);
      const minScore = Math.min(startScore, endScore);
      const maxScore = Math.max(startScore, endScore);

      const filtered = rawInvoices.filter((inv) => {
        const score = getScore(inv.session, inv.term);
        return score >= minScore && score <= maxScore;
      });
      const label = `Range: ${startTerm} ${startSession} to ${endTerm} ${endSession}`;
      return { filteredInvoices: filtered, activeFilterLabel: label };
    }
  }, [rawInvoices, filterMode, session, term, startSession, startTerm, endSession, endTerm]);

  // Compute final reports metrics from the filtered invoices
  const { totalDue, totalCollected, collectionRate, byClass, byStudent } = useMemo(() => {
    const bc = buildClassReport(filteredInvoices, rawStudents);
    const bs = buildStudentReport(filteredInvoices, rawStudents);

    const tDue = bc.reduce((sum, row) => sum + row.totalDue, 0);
    const tColl = bc.reduce((sum, row) => sum + row.totalCollected, 0);
    const rate = calculateCollectionRate(tDue, tColl);

    return {
      totalDue: tDue,
      totalCollected: tColl,
      collectionRate: rate,
      byClass: bc,
      byStudent: bs,
    };
  }, [filteredInvoices, rawStudents]);

  // ── CSV export ─────────────────────────────

  function handleExportCSV() {
    if (filteredStudents.length === 0) return;

    const csvTerm = filterMode === 'single' ? term : `${startTerm} - ${endTerm}`;
    const csvSession = filterMode === 'single' ? session : `${startSession} - ${endSession}`;

    const csv = studentsToCSV(filteredStudents, { term: csvTerm, session: csvSession });
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;

    const classSlug = classFilter !== 'all' ? `-${classFilter.replace(/\s+/g, '-').toLowerCase()}` : '';
    const termSlug = csvTerm.replace(/\s+/g, '-').toLowerCase();
    const sessionSlug = csvSession.replace(/\//g, '-').replace(/\s+/g, '');

    a.download = `outstanding-${termSlug}-${sessionSlug}${classSlug}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // ── Filtered student data ──────────────────

  const filteredStudents = useMemo(() => {
    return classFilter === 'all'
      ? byStudent
      : byStudent.filter((s) => s.class === classFilter);
  }, [byStudent, classFilter]);

  // ── Chart data ─────────────────────────────

  const chartData = useMemo(() => {
    return byClass.map((row) => ({
      class: row.class,
      'Total Due': row.totalDue,
      'Total Collected': row.totalCollected,
    }));
  }, [byClass]);

  // ── Loading State ──────────────────────────

  if ((authLoading || loading) && rawInvoices.length === 0) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-9 w-48 rounded-xl" />
          <Skeleton className="h-10 w-32 rounded-xl" />
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-28 rounded-[24px]" />
          ))}
        </div>
        <Skeleton className="h-72 rounded-[28px]" />
        <Skeleton className="h-64 rounded-[28px]" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-100">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-950 tracking-tight">
            Financial Reports
          </h1>
          <p className="text-xs text-slate-500 font-medium mt-0.5">
            Fee collection summary &amp; unpaid balances
          </p>
        </div>
        <Button
          variant="outline"
          onClick={handleExportCSV}
          disabled={filteredStudents.length === 0}
          className="rounded-xl border-slate-200 bg-white hover:bg-slate-50 font-bold text-xs h-10 px-4 gap-2 shadow-sm"
        >
          <Download className="h-4 w-4 text-slate-500" />
          Export CSV
        </Button>
      </div>

      {/* Filter Mode Tabs & Controls */}
      <div className="space-y-4 rounded-[24px] border border-slate-250/60 bg-[#e2edf8]/10 p-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          {/* Segmented Mode Button */}
          <div className="flex rounded-xl bg-slate-100 p-1 border border-slate-200/50 w-full sm:w-auto">
            <button
              onClick={() => setFilterMode('single')}
              className={`flex-1 sm:flex-none py-1.5 px-4 text-xs font-bold rounded-lg transition-all ${
                filterMode === 'single'
                  ? 'bg-white text-slate-950 shadow-sm'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Single Session
            </button>
            <button
              onClick={() => setFilterMode('range')}
              className={`flex-1 sm:flex-none py-1.5 px-4 text-xs font-bold rounded-lg transition-all ${
                filterMode === 'range'
                  ? 'bg-white text-slate-950 shadow-sm'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Range Filter
            </button>
          </div>

          {/* Active Filter Title */}
          <div className="text-xs font-bold text-slate-600 bg-slate-100 px-3.5 py-1.5 rounded-xl border border-slate-200/40">
            Active view: <span className="text-slate-950 font-extrabold">{activeFilterLabel}</span>
          </div>
        </div>

        {/* Dynamic Selector Controls */}
        {filterMode === 'single' ? (
          <div className="flex flex-wrap gap-4 items-end pt-2">
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                Session
              </label>
              <Select value={session} onValueChange={setSession}>
                <SelectTrigger className="w-44 h-10 rounded-xl border-slate-250 bg-white font-semibold text-xs text-slate-800 shadow-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  {sessionsList.map((s) => (
                    <SelectItem key={s} value={s} className="text-xs font-semibold">
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                Term filter
              </label>
              <Select value={term} onValueChange={setTerm}>
                <SelectTrigger className="w-44 h-10 rounded-xl border-slate-250 bg-white font-semibold text-xs text-slate-800 shadow-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  <SelectItem value="All Terms" className="text-xs font-semibold">All Terms</SelectItem>
                  {TERMS.map((t) => (
                    <SelectItem key={t} value={t} className="text-xs font-semibold">
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-2 border-t border-slate-200/50 mt-2">
            {/* Start point */}
            <div className="space-y-3">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 bg-slate-100 px-2.5 py-1 rounded-lg">From</span>
              <div className="flex gap-4">
                <div className="flex-1">
                  <label className="block text-[9px] font-bold uppercase text-slate-400 mb-1.5">Session</label>
                  <Select value={startSession} onValueChange={setStartSession}>
                    <SelectTrigger className="w-full h-10 rounded-xl border-slate-250 bg-white font-semibold text-xs text-slate-800 shadow-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl">
                      {sessionsList.map((s) => (
                        <SelectItem key={s} value={s} className="text-xs font-semibold">
                          {s}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex-1">
                  <label className="block text-[9px] font-bold uppercase text-slate-400 mb-1.5">Term</label>
                  <Select value={startTerm} onValueChange={setStartTerm}>
                    <SelectTrigger className="w-full h-10 rounded-xl border-slate-250 bg-white font-semibold text-xs text-slate-800 shadow-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl">
                      {TERMS.map((t) => (
                        <SelectItem key={t} value={t} className="text-xs font-semibold">
                          {t}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* End point */}
            <div className="space-y-3">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 bg-slate-100 px-2.5 py-1 rounded-lg">To</span>
              <div className="flex gap-4">
                <div className="flex-1">
                  <label className="block text-[9px] font-bold uppercase text-slate-400 mb-1.5">Session</label>
                  <Select value={endSession} onValueChange={setEndSession}>
                    <SelectTrigger className="w-full h-10 rounded-xl border-slate-250 bg-white font-semibold text-xs text-slate-800 shadow-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl">
                      {sessionsList.map((s) => (
                        <SelectItem key={s} value={s} className="text-xs font-semibold">
                          {s}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex-1">
                  <label className="block text-[9px] font-bold uppercase text-slate-400 mb-1.5">Term</label>
                  <Select value={endTerm} onValueChange={setEndTerm}>
                    <SelectTrigger className="w-full h-10 rounded-xl border-slate-250 bg-white font-semibold text-xs text-slate-800 shadow-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl">
                      {TERMS.map((t) => (
                        <SelectItem key={t} value={t} className="text-xs font-semibold">
                          {t}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Error state */}
      {error && (
        <div className="flex items-center gap-3 rounded-2xl border border-red-200 bg-red-50/50 px-4 py-3 text-xs text-red-750 font-bold">
          <AlertCircle className="h-4.5 w-4.5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Empty state */}
      {byClass.length === 0 && !loading && (
        <div className="flex flex-col items-center justify-center rounded-[28px] border border-dashed border-slate-200 bg-white py-16 px-4 select-none">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-slate-50 border border-slate-100">
            <FileText className="h-7 w-7 text-slate-400" />
          </div>
          <h3 className="text-xs font-bold text-slate-900">
            No invoices found
          </h3>
          <p className="mt-1 text-[10px] text-slate-500 font-medium text-center">
            No invoices fit the criteria for <span className="font-bold text-slate-800">{activeFilterLabel}</span>.
          </p>
          <Button
            variant="link"
            className="mt-3 text-xs font-bold text-blue-650 hover:text-blue-700"
            onClick={() => router.push('/dashboard/invoices')}
          >
            Create invoices from the Class Invoicing page →
          </Button>
        </div>
      )}

      {/* Summary Cards */}
      {byClass.length > 0 && (
        <>
          <div className="grid gap-5 sm:grid-cols-3">
            {/* Total Due */}
            <Card className="rounded-[24px] border-slate-200/50 shadow-sm bg-white overflow-hidden">
              <CardHeader className="pb-2 pt-5 px-5">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Total Due
                </p>
              </CardHeader>
              <CardContent className="pb-5 px-5">
                <p className="text-2xl font-extrabold text-slate-950 font-mono tracking-tight">
                  {kobotoNaira(totalDue)}
                </p>
              </CardContent>
            </Card>

            {/* Total Collected */}
            <Card className="rounded-[24px] border-slate-200/50 shadow-sm bg-white overflow-hidden">
              <CardHeader className="pb-2 pt-5 px-5">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Total Collected
                </p>
              </CardHeader>
              <CardContent className="pb-5 px-5">
                <p className="text-2xl font-extrabold text-emerald-600 font-mono tracking-tight">
                  {kobotoNaira(totalCollected)}
                </p>
              </CardContent>
            </Card>

            {/* Collection Rate — visually prominent */}
            <Card className="rounded-[24px] bg-slate-950 text-white shadow-xl shadow-slate-950/10 overflow-hidden">
              <CardHeader className="pb-2 pt-5 px-5">
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-emerald-400" />
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Collection Rate
                  </p>
                </div>
              </CardHeader>
              <CardContent className="pb-5 px-5">
                <p className="text-3xl font-black text-white font-mono tracking-tight">
                  {collectionRate}%
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Bar Chart — Collection by Class */}
          <Card className="rounded-[28px] border-slate-200/50 shadow-sm bg-white overflow-hidden">
            <CardHeader className="border-b border-slate-50/50 pb-3 p-5">
              <div className="flex items-center gap-2">
                <BarChart3 className="h-4.5 w-4.5 text-slate-500" />
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                  Collection by Class
                </h3>
              </div>
            </CardHeader>
            <CardContent className="pt-6 p-5">
              <ResponsiveContainer width="100%" height={320}>
                <BarChart
                  data={chartData}
                  margin={{ top: 5, right: 20, left: 10, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis
                    dataKey="class"
                    tick={{ fontSize: 10, fill: '#64748b', fontWeight: 600 }}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 10, fill: '#64748b', fontWeight: 600 }}
                    tickLine={false}
                    tickFormatter={(v: number) => `₦${(v / 100).toLocaleString()}`}
                  />
                  <Tooltip
                    formatter={chartTooltipFormatter}
                    labelStyle={{ fontWeight: 700, fontSize: '11px', color: '#0f172a' }}
                    contentStyle={{
                      borderRadius: '16px',
                      border: '1px solid #e2e8f0',
                      boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
                      padding: '8px 12px',
                    }}
                  />
                  <Legend
                    wrapperStyle={{ fontSize: '11px', paddingTop: '16px', fontWeight: 600 }}
                  />
                  <Bar
                    dataKey="Total Due"
                    fill="#cbd5e1"
                    radius={[6, 6, 0, 0]}
                  />
                  <Bar
                    dataKey="Total Collected"
                    fill="#3b82f6"
                    radius={[6, 6, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Outstanding Students Table */}
          <Card className="rounded-[28px] border-slate-200/50 shadow-sm bg-white overflow-hidden">
            <CardHeader className="border-b border-slate-50/50 pb-3 p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                  Outstanding Students
                </h3>
                <div className="flex items-center gap-2.5 text-xs text-slate-500 font-semibold">
                  <SlidersHorizontal className="h-3.5 w-3.5 text-slate-450" />
                  <span>Class:</span>
                  <Select
                    value={classFilter}
                    onValueChange={setClassFilter}
                  >
                    <SelectTrigger className="w-40 h-8 text-xs font-semibold border-slate-200 bg-white rounded-lg">
                      <SelectValue placeholder="All Classes" />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl">
                      <SelectItem value="all" className="text-xs font-semibold">All Classes</SelectItem>
                      {ALL_CLASSES.map((cls) => (
                        <SelectItem key={cls} value={cls} className="text-xs font-semibold">
                          {cls}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {filteredStudents.length === 0 ? (
                <div className="py-12 text-center text-xs font-semibold text-slate-500">
                  No outstanding students in this category
                </div>
              ) : (
                <Table>
                  <TableHeader className="bg-slate-50/50">
                    <TableRow>
                      <TableHead className="text-[10px] font-bold text-slate-500 uppercase tracking-wider pl-6">Name</TableHead>
                      <TableHead className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Class</TableHead>
                      <TableHead className="text-[10px] font-bold text-slate-500 uppercase tracking-wider text-right">
                        Outstanding
                      </TableHead>
                      <TableHead className="text-[10px] font-bold text-slate-500 uppercase tracking-wider pr-6">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredStudents.map((row) => (
                      <TableRow
                        key={row.studentId}
                        className="cursor-pointer hover:bg-slate-50/40 border-b border-slate-100/50 last:border-b-0"
                        onClick={() =>
                          router.push(
                            `/dashboard/students/${row.studentId}`
                          )
                        }
                      >
                        <TableCell className="font-bold text-slate-900 pl-6 text-sm">
                          {row.fullName}
                        </TableCell>
                        <TableCell className="text-slate-600 text-xs font-semibold">
                          {row.class}
                        </TableCell>
                        <TableCell className="text-right font-mono font-extrabold text-red-650 tracking-tight">
                          {kobotoNaira(row.outstanding)}
                        </TableCell>
                        <TableCell className="pr-6">{statusBadge(row.status)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
