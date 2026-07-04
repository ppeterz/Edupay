'use client';

// ──────────────────────────────────────────────
// EduPay — Bulk Invoice Results Page
// ──────────────────────────────────────────────
// Lightweight summary card shown after bulk invoice creation.
//
// Route: /dashboard/invoices/results/[runId]
// If runId === "fallback" → reads from sessionStorage (populated by the wizard
//   when runId was null). If sessionStorage is empty (tab closed/reopened),
//   shows a graceful "no longer available" message rather than crashing.

import { Suspense, use, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { doc, getDoc } from 'firebase/firestore';
import { getFirebaseDb, getFirebaseAuth } from '@/lib/firebase';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  Home,
  Loader2,
} from 'lucide-react';

// ── Shape of a bulk run result ───────────────

interface RunResult {
  runId: string | null;
  created: number;
  skipped: number;
  // We only need counts and runId on this page
}

// ── Data loading ─────────────────────────────

async function loadResult(runId: string): Promise<RunResult | null> {
  if (runId === 'fallback') {
    try {
      const raw = sessionStorage.getItem('bulk_run_fallback');
      if (!raw) return null;
      const data = JSON.parse(raw);
      return {
        runId: null,
        created: data.created ?? 0,
        skipped: data.skipped ?? 0,
      };
    } catch {
      return null;
    }
  }

  // Fetch from Firestore
  try {
    const auth = getFirebaseAuth();
    const db = getFirebaseDb();
    const user = auth.currentUser;
    if (!user) return null;

    const snap = await getDoc(doc(db, 'bulk_invoice_runs', runId));
    if (!snap.exists()) return null;
    const data = snap.data();
    if (data.schoolId !== user.uid) return null;
    return { runId, created: data.created ?? 0, skipped: data.skipped ?? 0 };
  } catch {
    return null;
  }
}

// ── Content component ────────────────────────

function ResultsContent({ params }: { params: Promise<{ runId: string }> }) {
  const { runId } = use(params);
  const router = useRouter();
  const [result, setResult] = useState<RunResult | null | 'loading'>('loading');

  useEffect(() => {
    loadResult(runId).then(setResult);
  }, [runId]);

  if (result === 'loading') {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Fallback path with empty sessionStorage (tab closed and reopened)
  if (result === null) {
    return (
      <Card className="max-w-lg mx-auto">
        <CardContent className="pt-6 space-y-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
            <div>
              <h2 className="font-semibold text-gray-900">Result no longer available</h2>
              <p className="mt-1 text-sm text-gray-600">
                Invoices were created successfully, but the skipped-student details couldn&apos;t
                be recovered (the session was closed before they could be saved). Check the
                Payments or Reports view to see outstanding balances.
              </p>
            </div>
          </div>
          <Button
            variant="outline"
            className="w-full"
            onClick={() => router.push('/dashboard/invoices')}
          >
            <Home className="mr-2 h-4 w-4" />
            Go to Invoices
          </Button>
        </CardContent>
      </Card>
    );
  }

  const skippedPath =
    runId === 'fallback'
      ? '/dashboard/invoices/review-skipped/fallback'
      : `/dashboard/invoices/review-skipped/${runId}`;

  return (
    <Card className="max-w-lg mx-auto">
      <CardContent className="pt-6 space-y-5">
        {/* Icon + headline */}
        <div className="flex items-start gap-3">
          <CheckCircle2 className="h-6 w-6 text-green-500 shrink-0 mt-0.5" />
          <div>
            <h2 className="text-lg font-bold text-gray-900">Invoices Created</h2>
            <p className="mt-1 text-sm text-gray-600">
              <span className="font-semibold text-gray-900">{result.created}</span>{' '}
              invoice{result.created !== 1 ? 's' : ''} created.{' '}
              {result.skipped > 0 ? (
                <>
                  <span className="font-semibold text-amber-700">{result.skipped}</span>{' '}
                  student{result.skipped !== 1 ? 's' : ''} skipped (already had an invoice
                  for this term).
                </>
              ) : (
                'No students were skipped.'
              )}
            </p>
          </div>
        </div>

        {/* CTA */}
        <div className="flex flex-col gap-2">
          {result.skipped > 0 && (
            <Button
              className="w-full"
              onClick={() => router.push(skippedPath)}
            >
              Review skipped students
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          )}
          <Button
            variant="outline"
            className="w-full"
            onClick={() => router.push('/dashboard/invoices')}
          >
            <Home className="mr-2 h-4 w-4" />
            Back to Invoices
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ── Page ─────────────────────────────────────

export default function ResultsPage({ params }: { params: Promise<{ runId: string }> }) {
  return (
    <div className="p-6 lg:p-8 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Bulk Invoice Results</h1>
      <Suspense
        fallback={
          <div className="flex h-64 items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        }
      >
        <ResultsContent params={params} />
      </Suspense>
    </div>
  );
}
