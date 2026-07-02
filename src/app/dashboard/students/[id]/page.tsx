'use client';

// ──────────────────────────────────────────────
// EduPay — Student Detail Page (Placeholder)
// ──────────────────────────────────────────────
// Full implementation (invoices, payment history) comes in Stage 4.

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { getFirebaseAuth } from '@/lib/firebase';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowLeft, AlertCircle } from 'lucide-react';
import { kobotoNaira } from '@/lib/constants';
import type { Student } from '@/types';

export default function StudentDetailPage() {
  const router = useRouter();
  const params = useParams();
  const studentId = params.id as string;

  const [student, setStudent] = useState<Student | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function fetchStudent() {
      try {
        const auth = getFirebaseAuth();
        const token = await auth.currentUser?.getIdToken();
        if (!token) {
          setError('Not authenticated');
          setLoading(false);
          return;
        }

        const res = await fetch(`/api/students/${studentId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (!res.ok) {
          if (res.status === 404) {
            setError('Student not found');
          } else {
            setError('Failed to load student');
          }
          setLoading(false);
          return;
        }

        const data = await res.json();
        setStudent(data.student);
      } catch {
        setError('Connection failed');
      } finally {
        setLoading(false);
      }
    }

    fetchStudent();
  }, [studentId]);

  // ── Loading state ──────────────────────────

  if (loading) {
    return (
      <div className="p-6 lg:p-8">
        <Skeleton className="mb-6 h-8 w-48" />
        <Skeleton className="mb-4 h-6 w-64" />
        <div className="space-y-3">
          <Skeleton className="h-32 w-full rounded-lg" />
          <Skeleton className="h-32 w-full rounded-lg" />
        </div>
      </div>
    );
  }

  // ── Error state ────────────────────────────

  if (error || !student) {
    return (
      <div className="p-6 lg:p-8">
        <Button
          variant="ghost"
          onClick={() => router.push('/dashboard/students')}
          className="mb-6"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Students
        </Button>
        <div className="rounded-lg border border-red-200 bg-red-50 p-6">
          <div className="flex items-center gap-3 text-red-700">
            <AlertCircle className="h-5 w-5" />
            <p className="font-medium">{error || 'Student not found'}</p>
          </div>
        </div>
      </div>
    );
  }

  // ── Detail view ────────────────────────────

  return (
    <div className="p-6 lg:p-8">
      {/* Back button */}
      <Button
        variant="ghost"
        onClick={() => router.push('/dashboard/students')}
        className="mb-6"
      >
        <ArrowLeft className="mr-2 h-4 w-4" />
        Back to Students
      </Button>

      {/* Page title */}
      <h1 className="mb-6 text-2xl font-bold text-gray-900">
        {student.fullName}
      </h1>

      {/* Info card */}
      <div className="mb-6 rounded-lg border border-gray-200 bg-white p-6">
        <h2 className="mb-4 text-lg font-semibold text-gray-900">
          Student Information
        </h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-gray-500">
              Class
            </p>
            <p className="mt-1 text-sm font-medium text-gray-900">
              {student.class}
            </p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-gray-500">
              Admission Number
            </p>
            <p className="mt-1 font-mono text-sm font-medium text-gray-900">
              {student.admissionNumber}
            </p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-gray-500">
              Virtual Account Number
            </p>
            <p className="mt-1 font-mono text-sm font-bold text-gray-900">
              {student.virtualAccountNumber}
            </p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-gray-500">
              Bank Name
            </p>
            <p className="mt-1 text-sm font-medium text-gray-900">
              {student.virtualAccountBankName}
            </p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-gray-500">
              Outstanding Balance
            </p>
            <p
              className={`mt-1 text-sm font-bold ${
                student.outstandingBalance > 0
                  ? 'text-red-600'
                  : 'text-green-600'
              }`}
            >
              {kobotoNaira(student.outstandingBalance)}
            </p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-gray-500">
              Credit Balance
            </p>
            <p
              className={`mt-1 text-sm font-bold ${
                student.creditBalance > 0
                  ? 'text-blue-600'
                  : 'text-gray-400'
              }`}
            >
              {kobotoNaira(student.creditBalance)}
            </p>
          </div>
        </div>
      </div>

      {/* Invoices placeholder */}
      <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 p-8 text-center">
        <p className="text-sm text-gray-500">
          Invoices &mdash; coming soon
        </p>
      </div>
    </div>
  );
}
