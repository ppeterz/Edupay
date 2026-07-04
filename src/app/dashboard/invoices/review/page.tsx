'use client';

// ──────────────────────────────────────────────
// EduPay — Class Invoice Review Page
// ──────────────────────────────────────────────
// Per-class review table — shows all students with invoices for a given
// term/session, grouped by payment status (Paid / Partial / Unpaid).
// Uses the shared StudentInvoiceTable with InvoiceEditActions injected.

import { Suspense, useState, useEffect, useCallback, useMemo } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { getFirebaseDb, getFirebaseAuth } from '@/lib/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { useAuth } from '@/contexts/AuthContext';
import { StudentInvoiceTable } from '@/components/invoices/StudentInvoiceTable';
import { InvoiceEditActions } from '@/components/invoices/InvoiceEditActions';
import type { StudentWithInvoice } from '@/components/invoices/StudentInvoiceTable';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ArrowLeft, Loader2, AlertTriangle } from 'lucide-react';

const TERM_OPTIONS = ['First Term', 'Second Term', 'Third Term'];

function ReviewContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { user, school } = useAuth();
  const className = searchParams.get('class') || '';

  const lastUsed = school?.lastUsedTermSession;
  const [term, setTerm] = useState(lastUsed?.term ?? 'First Term');
  const [session, setSession] = useState(lastUsed?.session ?? '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [students, setStudents] = useState<StudentWithInvoice[] | null>(null);

  // unique sessions state
  const [availableSessions, setAvailableSessions] = useState<string[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(false);

  // Fetch unique sessions from existing invoices
  useEffect(() => {
    async function fetchSessions() {
      if (!user) return;
      setSessionsLoading(true);
      try {
        const db = getFirebaseDb();
        const snap = await getDocs(
          query(
            collection(db, 'invoices'),
            where('schoolId', '==', user.uid)
          )
        );
        const sessions = new Set<string>();
        snap.forEach((doc) => {
          const s = doc.data().session;
          if (s) sessions.add(s);
        });
        setAvailableSessions(Array.from(sessions));
      } catch (err) {
        console.error('Failed to fetch unique sessions:', err);
      } finally {
        setSessionsLoading(false);
      }
    }
    fetchSessions();
  }, [user]);

  // Combine unique sessions + last used + default sessions as fallback
  const sessionsList = useMemo(() => {
    const set = new Set<string>(availableSessions);
    if (lastUsed?.session) {
      set.add(lastUsed.session);
    }
    if (set.size === 0) {
      set.add('2024/2025');
      set.add('2025/2026');
      set.add('2026/2027');
    }
    return Array.from(set).sort().reverse();
  }, [availableSessions, lastUsed]);

  const loadInvoices = useCallback(async (targetTerm = term, targetSession = session) => {
    if (!className) return;
    setLoading(true);
    setError('');
    setStudents(null);

    try {
      const auth = getFirebaseAuth();
      const token = await auth.currentUser?.getIdToken();
      if (!token) {
        setError('Not authenticated. Please sign in again.');
        setLoading(false);
        return;
      }

      const res = await fetch(
        `/api/invoices/class-review?class=${encodeURIComponent(className)}&term=${encodeURIComponent(targetTerm)}&session=${encodeURIComponent(targetSession)}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? 'Failed to load invoices');
        setLoading(false);
        return;
      }

      const data = await res.json();
      const list: { studentId: string; studentName: string; class: string; existingInvoice: unknown }[] = data.students ?? [];

      const withInvoices = list.filter((s) => s.existingInvoice !== null) as StudentWithInvoice[];

      if (withInvoices.length === 0) {
        setError('No invoices found for this class, term, and session.');
        setLoading(false);
        return;
      }

      setStudents(withInvoices);
    } catch {
      setError('Connection failed. Please check your internet connection.');
    } finally {
      setLoading(false);
    }
  }, [className, term, session]);

  // Pre-fill state when school data arrives/updates
  useEffect(() => {
    if (school?.lastUsedTermSession) {
      setTerm(school.lastUsedTermSession.term);
      setSession(school.lastUsedTermSession.session);
    }
  }, [school]);

  // Automatically trigger loading on page load if term & session are available
  useEffect(() => {
    if (className && school?.lastUsedTermSession?.term && school?.lastUsedTermSession?.session) {
      loadInvoices(school.lastUsedTermSession.term, school.lastUsedTermSession.session);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [className, school]);

  if (!className) {
    return (
      <div className="p-6">
        <p className="text-red-500">No class selected for review.</p>
        <Button onClick={() => router.push('/dashboard/invoices')} className="mt-4">
          Go Back
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button
          variant="outline"
          size="icon"
          onClick={() => (students ? setStudents(null) : router.push('/dashboard/invoices'))}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Invoice Review — {className}
          </h1>
          <p className="text-sm text-gray-500">
            Review and selectively update existing student invoices
          </p>
        </div>
      </div>

      {students ? (
        /* Review table */
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-600">
              Showing <span className="font-medium">{students.length}</span> students with invoices for{' '}
              <span className="font-medium">{term} — {session}</span>
            </p>
            <Button variant="outline" size="sm" onClick={() => setStudents(null)}>
              Change term/session
            </Button>
          </div>

          <StudentInvoiceTable
            students={students}
            groupingKey="paymentStatus"
            actionsComponent={(student) => (
              <InvoiceEditActions student={student} />
            )}
          />

          <Button variant="outline" onClick={() => router.push('/dashboard/invoices')}>
            Done
          </Button>
        </div>
      ) : (
        /* Term/session selector */
        <Card>
          <CardContent className="space-y-6 pt-6">
            <div className="rounded-md border border-gray-100 bg-gray-50 p-4">
              <p className="text-sm text-gray-600">
                Specify the term and session to retrieve generated student invoices for{' '}
                <span className="font-semibold">{className}</span>.
                {lastUsed && (
                  <span className="block mt-1 text-xs text-gray-400">
                    Pre-filled from your last invoice action.
                  </span>
                )}
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="review-term">Term</Label>
                <Select value={term} onValueChange={setTerm}>
                  <SelectTrigger id="review-term">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TERM_OPTIONS.map((t) => (
                      <SelectItem key={t} value={t}>{t}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="review-session">Session</Label>
                {sessionsLoading ? (
                  <div className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Loading sessions…
                  </div>
                ) : (
                  <Select value={session} onValueChange={setSession}>
                    <SelectTrigger id="review-session">
                      <SelectValue placeholder="Select session" />
                    </SelectTrigger>
                    <SelectContent>
                      {sessionsList.map((s) => (
                        <SelectItem key={s} value={s}>{s}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            </div>

            {error && (
              <div className="flex items-center gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                {error}
              </div>
            )}

            <div className="flex justify-end gap-3 border-t border-gray-100 pt-4">
              <Button
                variant="outline"
                onClick={() => router.push('/dashboard/invoices')}
                disabled={loading}
              >
                Cancel
              </Button>
              <Button onClick={() => loadInvoices()} disabled={loading || !session}>
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Loading…
                  </>
                ) : (
                  'Load Invoices'
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default function ReviewPage() {
  return (
    <div className="p-6 lg:p-8 max-w-4xl mx-auto">
      <Suspense
        fallback={
          <div className="flex h-screen items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        }
      >
        <ReviewContent />
      </Suspense>
    </div>
  );
}
