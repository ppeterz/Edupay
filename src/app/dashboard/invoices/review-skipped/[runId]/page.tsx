'use client';

// ──────────────────────────────────────────────
// EduPay — Review Skipped Students Page
// ──────────────────────────────────────────────
// Full-page table of skipped students grouped by diff signature.
//
// Route: /dashboard/invoices/review-skipped/[runId]
// If runId === "fallback" → reads from sessionStorage (same data the
//   wizard stored). Same empty-state guard as results/[runId].
// If skipped count is 0 → redirects to /dashboard/invoices with success toast.

import { Suspense, use, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { doc, getDoc } from 'firebase/firestore';
import { toast } from 'sonner';
import { getFirebaseDb, getFirebaseAuth } from '@/lib/firebase';
import { StudentInvoiceTable } from '@/components/invoices/StudentInvoiceTable';
import { SkipMergeActions, GroupSkipMergeActions } from '@/components/invoices/SkipMergeActions';
import type { StudentWithInvoice, BulkTemplate } from '@/components/invoices/StudentInvoiceTable';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ArrowLeft, Loader2, AlertTriangle, Home } from 'lucide-react';

// ── Run data shape ───────────────────────────

interface RunData {
  bulkTemplate: BulkTemplate;
  skippedByClass: {
    className: string;
    students: StudentWithInvoice[];
  }[];
}

// ── Data loading ─────────────────────────────

async function loadRunData(runId: string): Promise<RunData | null> {
  if (runId === 'fallback') {
    try {
      const raw = sessionStorage.getItem('bulk_run_fallback');
      if (!raw) return null;
      const data = JSON.parse(raw);
      return {
        bulkTemplate: data.bulkTemplate,
        skippedByClass: data.skippedByClass ?? [],
      };
    } catch {
      return null;
    }
  }

  try {
    const auth = getFirebaseAuth();
    const db = getFirebaseDb();
    const user = auth.currentUser;
    if (!user) return null;

    const snap = await getDoc(doc(db, 'bulk_invoice_runs', runId));
    if (!snap.exists()) return null;
    const data = snap.data();
    if (data.schoolId !== user.uid) return null;
    return {
      bulkTemplate: data.bulkTemplate,
      skippedByClass: data.skippedByClass ?? [],
    };
  } catch {
    return null;
  }
}

// ── Content component ────────────────────────

function ReviewSkippedContent({ params }: { params: Promise<{ runId: string }> }) {
  const { runId } = use(params);
  const router = useRouter();
  const [runData, setRunData] = useState<RunData | null | 'loading'>('loading');

  useEffect(() => {
    loadRunData(runId).then((data) => {
      if (data !== null) {
        // If no skipped students, redirect immediately
        const total = data.skippedByClass.reduce(
          (n, g) => n + g.students.length,
          0
        );
        if (total === 0) {
          toast.success('All invoices created — no skipped students.');
          router.replace('/dashboard/invoices');
          return;
        }
      }
      setRunData(data);
    });
  }, [runId, router]);

  if (runData === 'loading') {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Fallback path with empty sessionStorage
  if (runData === null) {
    return (
      <Card className="max-w-lg">
        <CardContent className="pt-6 space-y-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
            <div>
              <h2 className="font-semibold text-gray-900">Result no longer available</h2>
              <p className="mt-1 text-sm text-gray-600">
                Invoices were created successfully, but the skipped-student details
                couldn&apos;t be recovered (the session was closed before they could be
                saved). Check the Payments or Reports view to see outstanding balances.
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

  // Flatten students for the table
  const allStudents: StudentWithInvoice[] = runData.skippedByClass.flatMap(
    (g) => g.students
  );

  return (
    <div className="space-y-6">
      {/* Info banner */}
      <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 p-3">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
        <div>
          <p className="text-sm font-medium text-amber-800">
            {allStudents.length} student{allStudents.length !== 1 ? 's' : ''} skipped
          </p>
          <p className="mt-0.5 text-xs text-amber-700">
            Students are grouped by what&apos;s missing or different on their existing invoice.
            Use the group action to resolve all students with the same pattern at once.
          </p>
        </div>
      </div>

      <StudentInvoiceTable
        students={allStudents}
        groupingKey="skipReason"
        bulkTemplate={runData.bulkTemplate}
        actionsComponent={(student) => (
          <SkipMergeActions student={student} template={runData.bulkTemplate} />
        )}
        groupActionsComponent={(students, groupId) => (
          <GroupSkipMergeActions
            students={students}
            template={runData.bulkTemplate}
            groupId={groupId}
          />
        )}
      />

      <Button
        variant="outline"
        onClick={() => router.push('/dashboard/invoices')}
      >
        Done Reviewing
      </Button>
    </div>
  );
}

// ── Page ─────────────────────────────────────

export default function ReviewSkippedPage({
  params,
}: {
  params: Promise<{ runId: string }>;
}) {
  const router = useRouter();

  return (
    <div className="p-6 lg:p-8 max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button
          variant="outline"
          size="icon"
          onClick={() => router.back()}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Review Skipped Students</h1>
          <p className="text-sm text-gray-500">
            Add missing line items or update amounts for students who already had an invoice
          </p>
        </div>
      </div>

      <Suspense
        fallback={
          <div className="flex h-64 items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        }
      >
        <ReviewSkippedContent params={params} />
      </Suspense>
    </div>
  );
}
