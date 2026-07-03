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

function chartTooltipFormatter(value: any) {
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
      fetchReport();
    }
  }, [authLoading, user, fetchReport]);

  // ── CSV export ─────────────────────────────

  function handleExportCSV() {
    if (!data) return;
    const csv = studentsToCSV(data.byStudent);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `outstanding-${term.replace(/\s+/g, '-').toLowerCase()}-${session.replace('/', '-')}.csv`;
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
      <div className="p-6 lg:p-8 space-y-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-10 w-32" />
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-28 rounded-lg" />
          ))}
        </div>
        <Skeleton className="h-72 rounded-lg" />
        <Skeleton className="h-64 rounded-lg" />
      </div>
    );
  }

  // ── Render ─────────────────────────────────

  return (
    <div className="p-6 lg:p-8 space-y-6">
      {/* Page Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            Financial Reports
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            School collection analytics &amp; outstanding balances
          </p>
        </div>
        <Button
          variant="outline"
          onClick={handleExportCSV}
          disabled={!data || data.byStudent.length === 0}
          className="gap-2"
        >
          <Download className="h-4 w-4" />
          Export CSV
        </Button>
      </div>

      {/* Term / Session Selectors */}
      <div className="flex flex-wrap items-end gap-4">
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5">
            Term
          </label>
          <Select value={term} onValueChange={setTerm}>
            <SelectTrigger className="w-44 border-slate-200 bg-white">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TERMS.map((t) => (
                <SelectItem key={t} value={t}>
                  {t}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5">
            Session
          </label>
          <input
            type="text"
            value={session}
            onChange={(e) => setSession(e.target.value)}
            className="h-9 w-36 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-400"
            placeholder="e.g. 2025/2026"
          />
        </div>
      </div>

      {/* Error state */}
      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          {error}
        </div>
      )}

      {/* Empty state */}
      {data && data.byClass.length === 0 && !loading && (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-slate-300 bg-white py-16">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-slate-100">
            <FileText className="h-8 w-8 text-slate-400" />
          </div>
          <h3 className="text-lg font-medium text-slate-900">
            No invoices found
          </h3>
          <p className="mt-2 text-sm text-slate-500">
            No invoices found for {term} — {session}.
          </p>
          <Button
            variant="link"
            className="mt-3 text-slate-700"
            onClick={() => router.push('/dashboard/invoices')}
          >
            Create one from the Invoicing page →
          </Button>
        </div>
      )}

      {/* Summary Cards */}
      {data && data.byClass.length > 0 && (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            {/* Total Due */}
            <Card className="border-slate-200 shadow-sm">
              <CardHeader className="pb-2">
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Total Due
                </p>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-slate-900 font-mono tabular-nums">
                  {kobotoNaira(data.totalDue)}
                </p>
              </CardContent>
            </Card>

            {/* Total Collected */}
            <Card className="border-slate-200 shadow-sm">
              <CardHeader className="pb-2">
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Total Collected
                </p>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-green-700 font-mono tabular-nums">
                  {kobotoNaira(data.totalCollected)}
                </p>
              </CardContent>
            </Card>

            {/* Collection Rate — visually prominent */}
            <Card className="border-slate-700 bg-slate-900 shadow-md">
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-slate-400" />
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                    Collection Rate
                  </p>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-extrabold text-white font-mono tabular-nums">
                  {data.collectionRate}%
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Bar Chart — Collection by Class */}
          <Card className="border-slate-200 shadow-sm">
            <CardHeader className="border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-slate-500" />
                <h3 className="text-sm font-semibold text-slate-900">
                  Collection by Class
                </h3>
              </div>
            </CardHeader>
            <CardContent className="pt-6">
              <ResponsiveContainer width="100%" height={320}>
                <BarChart
                  data={chartData}
                  margin={{ top: 5, right: 20, left: 10, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis
                    dataKey="class"
                    tick={{ fontSize: 11, fill: '#64748b' }}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: '#64748b' }}
                    tickLine={false}
                    tickFormatter={(v: number) => `₦${(v / 100).toLocaleString()}`}
                  />
                  <Tooltip
                    formatter={chartTooltipFormatter}
                    labelStyle={{ fontWeight: 600 }}
                    contentStyle={{
                      borderRadius: '8px',
                      border: '1px solid #e2e8f0',
                      boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
                    }}
                  />
                  <Legend
                    wrapperStyle={{ fontSize: '12px', paddingTop: '12px' }}
                  />
                  <Bar
                    dataKey="Total Due"
                    fill="#cbd5e1"
                    radius={[4, 4, 0, 0]}
                  />
                  <Bar
                    dataKey="Total Collected"
                    fill="#1e40af"
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Outstanding Students Table */}
          <Card className="border-slate-200 shadow-sm">
            <CardHeader className="border-b border-slate-100 pb-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h3 className="text-sm font-semibold text-slate-900">
                  Outstanding Students
                </h3>
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <SlidersHorizontal className="h-3.5 w-3.5" />
                  <span>Class:</span>
                  <Select
                    value={classFilter}
                    onValueChange={setClassFilter}
                  >
                    <SelectTrigger className="w-40 h-8 text-xs border-slate-200 bg-white">
                      <SelectValue placeholder="All Classes" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Classes</SelectItem>
                      {ALL_CLASSES.map((cls) => (
                        <SelectItem key={cls} value={cls}>
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
                <div className="py-12 text-center text-sm text-slate-500">
                  No outstanding students in this category
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Class</TableHead>
                      <TableHead className="text-right">
                        Outstanding
                      </TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredStudents.map((row) => (
                      <TableRow
                        key={row.studentId}
                        className="cursor-pointer hover:bg-slate-50"
                        onClick={() =>
                          router.push(
                            `/dashboard/students/${row.studentId}`
                          )
                        }
                      >
                        <TableCell className="font-semibold text-slate-900">
                          {row.fullName}
                        </TableCell>
                        <TableCell className="text-slate-600">
                          {row.class}
                        </TableCell>
                        <TableCell className="text-right font-mono font-semibold tabular-nums text-red-600">
                          {kobotoNaira(row.outstanding)}
                        </TableCell>
                        <TableCell>{statusBadge(row.status)}</TableCell>
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
