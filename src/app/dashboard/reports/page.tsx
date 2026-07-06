'use client';

// ──────────────────────────────────────────────
// EduPay — Reports Page (Stage 8)
// ──────────────────────────────────────────────
// School-level and class-level collection reporting with:
// - Term/Session selectors
// - Summary cards (Total Due, Total Collected, Collection Rate)
// - Bar chart by class (recharts)
// - Outstanding students table with class filter + CSV export

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { kobotoNaira, ALL_CLASSES } from '@/lib/constants';
import { studentsToCSV } from '@/lib/export';
import type { ClassReportRow, StudentReportRow } from '@/lib/report-helpers';
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
  const [term, setTerm] = useState<string>(TERMS[0]);
  const [session, setSession] = useState<string>(DEFAULT_SESSION);
  const [data, setData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [classFilter, setClassFilter] = useState<string>('all');

  // ── Fetch report data ──────────────────────

  const fetchReport = useCallback(async () => {
    if (!user) return;

    setLoading(true);
    setError(null);

    try {
      const token = await user.getIdToken();
      const params = new URLSearchParams({ term, session });
      const res = await fetch(`/api/reports/summary?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `HTTP ${res.status}`);
      }

      const json: ReportData = await res.json();
      setData(json);
    } catch (err) {
      console.error('[ReportsPage] Fetch error:', err);
      setError(err instanceof Error ? err.message : 'Failed to load report');
    } finally {
      setLoading(false);
    }
  }, [user, term, session]);

  useEffect(() => {
    // Only fetch once auth is resolved and user is available
    if (!authLoading && user) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      fetchReport();
    }
  }, [authLoading, user, fetchReport]);

  // ── CSV export ─────────────────────────────

  function handleExportCSV() {
    if (!data) return;
    const csv = studentsToCSV(filteredStudents, { term, session });
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const classSlug = classFilter !== 'all' ? `-${classFilter.replace(/\s+/g, '-').toLowerCase()}` : '';
    a.download = `outstanding-${term.replace(/\s+/g, '-').toLowerCase()}-${session.replace('/', '-')}${classSlug}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // ── Filtered student data ──────────────────

  const filteredStudents = data
    ? classFilter === 'all'
      ? data.byStudent
      : data.byStudent.filter((s) => s.class === classFilter)
    : [];

  // ── Chart data ─────────────────────────────

  const chartData = data
    ? data.byClass.map((row) => ({
        class: row.class,
        'Total Due': row.totalDue,
        'Total Collected': row.totalCollected,
      }))
    : [];

  // ── Loading state ──────────────────────────

  if ((authLoading || loading) && !data) {
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

  // ── Render ─────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-100">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-950 tracking-tight">
            Financial Reports
          </h1>
          <p className="text-xs text-slate-500 font-medium mt-0.5">
            School collection analytics &amp; outstanding balances
          </p>
        </div>
        <Button
          variant="outline"
          onClick={handleExportCSV}
          disabled={!data || data.byStudent.length === 0}
          className="rounded-xl border-slate-200 bg-white hover:bg-slate-50 font-bold text-xs h-10 px-4 gap-2 shadow-sm"
        >
          <Download className="h-4 w-4 text-slate-500" />
          Export CSV
        </Button>
      </div>

      {/* Term / Session Selectors */}
      <div className="flex flex-wrap items-end gap-4">
        <div>
          <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
            Term
          </label>
          <Select value={term} onValueChange={setTerm}>
            <SelectTrigger className="w-44 h-10 rounded-xl border-slate-200 bg-white font-semibold text-xs text-slate-800 shadow-sm">
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
        <div>
          <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
            Session
          </label>
          <input
            type="text"
            value={session}
            onChange={(e) => setSession(e.target.value)}
            className="h-10 w-36 rounded-xl border border-slate-200 bg-white px-3.5 text-xs font-semibold text-slate-800 shadow-sm focus:outline-none focus:ring-1 focus:ring-slate-300"
            placeholder="e.g. 2025/2026"
          />
        </div>
      </div>

      {/* Error state */}
      {error && (
        <div className="flex items-center gap-3 rounded-2xl border border-red-200 bg-red-50/50 px-4 py-3 text-xs text-red-750 font-bold">
          <AlertCircle className="h-4.5 w-4.5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Empty state */}
      {data && data.byClass.length === 0 && !loading && (
        <div className="flex flex-col items-center justify-center rounded-[28px] border border-dashed border-slate-200 bg-white py-16 px-4 select-none">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-slate-50 border border-slate-100">
            <FileText className="h-7 w-7 text-slate-400" />
          </div>
          <h3 className="text-xs font-bold text-slate-900">
            No invoices found
          </h3>
          <p className="mt-1 text-[10px] text-slate-500 font-medium text-center">
            No active invoices found for {term} &middot; {session}.
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
      {data && data.byClass.length > 0 && (
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
                  {kobotoNaira(data.totalDue)}
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
                  {kobotoNaira(data.totalCollected)}
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
                  {data.collectionRate}%
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
