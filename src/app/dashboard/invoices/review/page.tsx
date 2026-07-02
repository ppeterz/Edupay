'use client';

// ──────────────────────────────────────────────
// EduPay — Class Invoice Review Page
// ──────────────────────────────────────────────
// Dedicated page to review and modify generated student invoices for a class.

import { Suspense, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { getFirebaseAuth } from '@/lib/firebase';
import { SkippedStudentReview } from '@/components/invoices/SkippedStudentReview';
import type { SkippedClassGroup } from '@/lib/invoice-helpers';
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
  const className = searchParams.get('class') || '';

  const [term, setTerm] = useState('First Term');
  const [session, setSession] = useState('2025/2026');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [reviewData, setReviewData] = useState<SkippedClassGroup[] | null>(null);

  async function loadInvoices() {
    if (!className) return;
    setLoading(true);
    setError('');

    try {
      const auth = getFirebaseAuth();
      const token = await auth.currentUser?.getIdToken();
      if (!token) {
        setError('Not authenticated. Please sign in again.');
        setLoading(false);
        return;
      }

      const res = await fetch(
        `/api/invoices/class-review?class=${encodeURIComponent(
          className
        )}&term=${encodeURIComponent(term)}&session=${encodeURIComponent(
          session
        )}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? 'Failed to load invoices');
        setLoading(false);
        return;
      }

      const data = await res.json();
      const list = data.students || [];

      // Filter to only students who have invoices
      const hasInvoice = list.filter((s: any) => s.existingInvoice !== null);

      if (hasInvoice.length === 0) {
        setError('No invoices found for this class, term, and session.');
        setLoading(false);
        return;
      }

      const grouped: SkippedClassGroup[] = [
        {
          className: className,
          students: hasInvoice.map((s: any) => ({
            studentId: s.studentId,
            studentName: s.studentName,
            class: s.class,
            existingInvoice: s.existingInvoice,
          })),
        },
      ];

      setReviewData(grouped);
    } catch {
      setError('Connection failed. Please check your internet connection.');
    } finally {
      setLoading(false);
    }
  }

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
    <div className="p-6 lg:p-8 max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button
          variant="outline"
          size="icon"
          onClick={() => {
            if (reviewData) {
              setReviewData(null);
            } else {
              router.push('/dashboard/invoices');
            }
          }}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Invoice Review — {className}
          </h1>
          <p className="text-sm text-gray-500">
            Review and selectively update existing student invoices and their priorities
          </p>
        </div>
      </div>

      {reviewData ? (
        <Card>
          <CardContent className="pt-6">
            <SkippedStudentReview
              skippedByClass={reviewData}
              onDone={() => router.push('/dashboard/invoices')}
            />
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="space-y-6 pt-6">
            <div className="rounded-md border border-gray-100 bg-gray-50 p-4">
              <p className="text-sm text-gray-600">
                Specify the term and session to retrieve the generated student invoices
                for <span className="font-semibold">{className}</span>.
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
                      <SelectItem key={t} value={t}>
                        {t}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="review-session">Session</Label>
                <Input
                  id="review-session"
                  placeholder="2025/2026"
                  value={session}
                  onChange={(e) => setSession(e.target.value)}
                />
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
              <Button onClick={loadInvoices} disabled={loading}>
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Loading Invoices…
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
    <Suspense fallback={
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    }>
      <ReviewContent />
    </Suspense>
  );
}
