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

  // Auto-load when term+session are present (including from lastUsedTermSession)
  useEffect(() => {
    if (term && session) {
      loadStats();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // run once on mount with pre-filled values

  return (
    <div className="p-6 lg:p-8 space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Class Invoicing</h1>
          <p className="mt-1 text-sm text-gray-500">
            Invoice status at a glance — select a term and session to load
          </p>
        </div>
        <Button onClick={() => router.push('/dashboard/invoices/create')}>
          <Plus className="mr-2 h-4 w-4" />
          Create Bulk Invoice
        </Button>
      </div>

      {/* Term / Session selector */}
      <Card>
        <CardContent className="pt-5 pb-5">
          <div className="flex flex-wrap items-end gap-4">
            <div className="space-y-1.5 min-w-[160px]">
              <Label htmlFor="grid-term">Term</Label>
              <Select value={term} onValueChange={setTerm}>
                <SelectTrigger id="grid-term" className="w-[180px]">
                  <SelectValue placeholder="Select term" />
                </SelectTrigger>
                <SelectContent>
                  {TERM_OPTIONS.map((t) => (
                    <SelectItem key={t} value={t}>{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5 min-w-[140px]">
              <Label htmlFor="grid-session">Session</Label>
              <Input
                id="grid-session"
                placeholder="2025/2026"
                value={session}
                onChange={(e) => setSession(e.target.value)}
                className="w-[160px]"
              />
            </div>

            <Button
              onClick={loadStats}
              disabled={!term || !session || loading}
              variant="outline"
            >
              {loading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="mr-2 h-4 w-4" />
              )}
              Load Status
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Class structure grid */}
      <div className="space-y-3">
        <h2 className="text-base font-semibold text-gray-900">Class Structure</h2>
        <p className="text-sm text-gray-500">
          Click any class to review and update existing invoices
        </p>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {CATEGORY_KEYS.map((category) => (
            <Card key={category}>
              <CardHeader className="pb-2">
                <h3 className="text-sm font-semibold text-gray-900">{category}</h3>
              </CardHeader>
              <CardContent className="space-y-1.5">
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
                      className="w-full rounded-md bg-gray-50 px-3 py-2 text-left transition-colors hover:bg-gray-100 group"
                    >
                      {/* Class name row */}
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-gray-800 group-hover:text-gray-900">
                          {cls}
                        </span>
                        {stats && (
                          <span className="flex items-center gap-1 text-xs text-gray-500">
                            <Users className="h-3 w-3" />
                            {stats.studentCount}
                          </span>
                        )}
                      </div>

                      {/* Status + amounts row */}
                      {stats && statsMap ? (
                        <div className="mt-1 space-y-0.5">
                          <ClassStatusDot status={stats.status} />
                          {stats.totalDue > 0 && (
                            <p className="text-[11px] text-gray-500 tabular-nums">
                              {kobotoNaira(stats.totalPaid)} / {kobotoNaira(stats.totalDue)} collected
                            </p>
                          )}
                        </div>
                      ) : loading ? (
                        <div className="mt-1 flex items-center gap-1 text-[11px] text-gray-400">
                          <Loader2 className="h-2.5 w-2.5 animate-spin" />
                          Loading…
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
          <p className="text-center text-sm text-gray-400 pt-4">
            Select a term and session above, then click "Load Status" to see invoicing progress.
          </p>
        )}
      </div>
    </div>
  );
}
