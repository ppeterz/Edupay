'use client';

// ──────────────────────────────────────────────
// EduPay — Class Invoicing Page (Grid)
// ──────────────────────────────────────────────
// Shows every class with its invoicing status at a glance.
// Uses TWO Firestore queries (students + invoices) and groups
// everything client-side — no N+1 reads per class card.

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { getFirebaseDb, getFirebaseAuth } from '@/lib/firebase';
import { CLASS_CATEGORIES, kobotoNaira } from '@/lib/constants';
import type { ClassCategory } from '@/lib/constants';
import { useAuth } from '@/contexts/AuthContext';
import { ClassStatusDot, type ClassStatus } from '@/components/invoices/ClassStatusDot';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Plus, FileText, Users, Loader2, RefreshCw } from 'lucide-react';
import type { Student, Invoice } from '@/types';

const CATEGORY_KEYS = Object.keys(CLASS_CATEGORIES) as ClassCategory[];
const TERM_OPTIONS = ['First Term', 'Second Term', 'Third Term'];

// ── Per-class aggregated data ─────────────────

interface ClassStats {
  studentCount: number;
  status: ClassStatus;
  totalDue: number;   // kobo
  totalPaid: number;  // kobo
}

function computeClassStatus(
  studentCount: number,
  invoiceCount: number,
  totalDue: number,
  totalPaid: number
): ClassStatus {
  if (invoiceCount === 0) return 'not_invoiced';
  if (invoiceCount < studentCount || totalPaid < totalDue) return 'partial';
  return 'complete';
}

// ── Component ────────────────────────────────

export default function InvoicingPage() {
  const router = useRouter();
  const { user, school } = useAuth();

  const lastUsed = school?.lastUsedTermSession;
  const [term, setTerm] = useState(lastUsed?.term ?? '');
  const [session, setSession] = useState(lastUsed?.session ?? '');
  const [loading, setLoading] = useState(false);
  const [statsMap, setStatsMap] = useState<Record<string, ClassStats> | null>(null);

  // ── Fetch & compute stats ─────────────────

  const loadStats = useCallback(async () => {
    if (!user || !term || !session) return;
    setLoading(true);

    try {
      const db = getFirebaseDb();
      const schoolId = user.uid;

      // Query 1: All non-deleted students for this school
      const studentsSnap = await getDocs(
        query(
          collection(db, 'students'),
          where('schoolId', '==', schoolId)
        )
      );
      const students = studentsSnap.docs
        .map((d) => d.data() as Student)
        .filter((s) => !s.deletedAt);

      // Build student count per class
      const studentsByClass = new Map<string, number>();
      for (const s of students) {
        studentsByClass.set(s.class, (studentsByClass.get(s.class) ?? 0) + 1);
      }

      // Query 2: All invoices for this school/term/session
      const invoicesSnap = await getDocs(
        query(
          collection(db, 'invoices'),
          where('schoolId', '==', schoolId),
          where('term', '==', term),
          where('session', '==', session)
        )
      );
      const invoices = invoicesSnap.docs.map((d) => d.data() as Invoice);

      // Aggregate per class
      const dueByClass = new Map<string, number>();
      const paidByClass = new Map<string, number>();
      const countByClass = new Map<string, number>();

      // We need to get class for each invoice via student map
      const studentClassMap = new Map<string, string>();
      for (const s of students) {
        studentClassMap.set(s.id, s.class);
      }

      for (const inv of invoices) {
        const cls = studentClassMap.get(inv.studentId);
        if (!cls) continue;
        dueByClass.set(cls, (dueByClass.get(cls) ?? 0) + inv.totalAmountDue);
        paidByClass.set(cls, (paidByClass.get(cls) ?? 0) + inv.totalAmountPaid);
        countByClass.set(cls, (countByClass.get(cls) ?? 0) + 1);
      }

      // Build final stats map for all known classes
      const allClasses = Object.values(CLASS_CATEGORIES).flat() as string[];
      const result: Record<string, ClassStats> = {};
      for (const cls of allClasses) {
        const studentCount = studentsByClass.get(cls) ?? 0;
        const invoiceCount = countByClass.get(cls) ?? 0;
        const totalDue = dueByClass.get(cls) ?? 0;
        const totalPaid = paidByClass.get(cls) ?? 0;
        result[cls] = {
          studentCount,
          totalDue,
          totalPaid,
          status: computeClassStatus(studentCount, invoiceCount, totalDue, totalPaid),
        };
      }
      setStatsMap(result);
    } finally {
      setLoading(false);
    }
  }, [user, term, session]);

  // Auto-load when term+session are present
  useEffect(() => {
    if (term && session) {
      loadStats();
    }
  }, [term, session, loadStats]);

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-950 tracking-tight">Class Invoicing</h1>
          <p className="text-xs text-slate-500 font-medium mt-0.5">
            Invoice status at a glance — select a term and session to load
          </p>
        </div>
        <Button 
          onClick={() => router.push('/dashboard/invoices/create')}
          className="rounded-xl bg-slate-950 text-white font-bold hover:bg-slate-900 shadow-md shadow-slate-950/10 h-10 px-4 text-xs"
        >
          <Plus className="mr-2 h-4 w-4" />
          Create Bulk Invoice
        </Button>
      </div>

      {/* Term / Session selector */}
      <Card className="rounded-[24px] border-slate-200/50 bg-[#e2edf8]/20 shadow-none">
        <CardContent className="p-5">
          <div className="flex flex-wrap items-end gap-4">
            <div className="space-y-1.5 min-w-[160px]">
              <Label htmlFor="grid-term" className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Term</Label>
              <Select value={term} onValueChange={setTerm}>
                <SelectTrigger id="grid-term" className="w-[180px] h-10 rounded-xl border-slate-200 bg-white shadow-sm font-semibold text-xs text-slate-800">
                  <SelectValue placeholder="Select term" />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  {TERM_OPTIONS.map((t) => (
                    <SelectItem key={t} value={t} className="text-xs font-semibold">{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5 min-w-[140px]">
              <Label htmlFor="grid-session" className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Session</Label>
              <Input
                id="grid-session"
                placeholder="2025/2026"
                value={session}
                onChange={(e) => setSession(e.target.value)}
                className="w-[160px] h-10 rounded-xl border-slate-200 bg-white shadow-sm font-semibold text-xs text-slate-850 px-3.5"
              />
            </div>

            <Button
              onClick={loadStats}
              disabled={!term || !session || loading}
              variant="outline"
              className="rounded-xl border-slate-200 bg-white hover:bg-slate-50 font-bold text-xs h-10 px-4 shadow-sm"
            >
              {loading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin text-slate-550" />
              ) : (
                <RefreshCw className="mr-2 h-4 w-4 text-slate-550" />
              )}
              Load Status
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Class structure grid */}
      <div className="space-y-4 pt-2">
        <div>
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500">Class Structure</h2>
          <p className="text-[11px] text-slate-450 font-semibold mt-0.5">
            Click any class to review and update existing invoices
          </p>
        </div>

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {CATEGORY_KEYS.map((category) => (
            <Card key={category} className="rounded-[24px] border-slate-200/50 shadow-sm bg-white overflow-hidden">
              <CardHeader className="pb-3 border-b border-slate-50/50 px-5 pt-5">
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">{category}</h3>
              </CardHeader>
              <CardContent className="space-y-2.5 p-5">
                {CLASS_CATEGORIES[category].map((cls) => {
                  const stats = statsMap?.[cls];
                  return (
                    <button
                      key={cls}
                      type="button"
                      onClick={() =>
                        router.push(
                          `/dashboard/invoices/review?class=${encodeURIComponent(cls)}`
                        )
                      }
                      className="w-full rounded-2xl bg-slate-50 border border-slate-100/50 px-4 py-3 text-left transition-all hover:bg-slate-100 hover:scale-[1.02] active:scale-[0.98] group flex flex-col justify-between min-h-[64px]"
                    >
                      {/* Class name row */}
                      <div className="flex items-center justify-between w-full">
                        <span className="text-xs font-bold text-slate-900 group-hover:text-black">
                          {cls}
                        </span>
                        {stats && (
                          <span className="flex items-center gap-1.5 text-[10px] text-slate-400 font-bold">
                            <Users className="h-3 w-3" />
                            {stats.studentCount}
                          </span>
                        )}
                      </div>

                      {/* Status + amounts row */}
                      {stats && statsMap ? (
                        <div className="mt-2 space-y-1 w-full">
                          <ClassStatusDot status={stats.status} />
                          {stats.totalDue > 0 && (
                            <p className="text-[10px] text-slate-450 font-mono font-semibold tabular-nums mt-1">
                              {kobotoNaira(stats.totalPaid)} / {kobotoNaira(stats.totalDue)}
                            </p>
                          )}
                        </div>
                      ) : loading ? (
                        <div className="mt-2 flex items-center gap-1.5 text-[10px] text-slate-400 font-semibold">
                          <Loader2 className="h-2.5 w-2.5 animate-spin" />
                          <span>Loading…</span>
                        </div>
                      ) : null}
                    </button>
                  );
                })}
              </CardContent>
            </Card>
          ))}
        </div>

        {!statsMap && !loading && (
          <div className="flex flex-col items-center justify-center py-14 select-none">
            <FileText className="h-8 w-8 text-slate-400 mb-2" />
            <p className="text-xs text-slate-550 font-bold text-center">
              Select a term and session above, then click &quot;Load Status&quot; to see invoicing progress.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
