'use client';

// ──────────────────────────────────────────────
// EduPay — Students Management Page
// ──────────────────────────────────────────────

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useStudents } from '@/hooks/useStudents';
import { StudentTable } from '@/components/students/StudentTable';
import { AddStudentForm } from '@/components/students/AddStudentForm';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { Plus, AlertCircle } from 'lucide-react';
import { kobotoNaira } from '@/lib/constants';
import type { Student } from '@/types';

export default function StudentsPage() {
  const router = useRouter();
  const { students, loading, error } = useStudents();
  const [dialogOpen, setDialogOpen] = useState(false);

  // ── Stats ──────────────────────────────────

  const totalOutstanding = students.reduce(
    (sum, s) => sum + s.outstandingBalance,
    0
  );

  function handleRowClick(student: Student) {
    router.push(`/dashboard/students/${student.id}`);
  }

  // ── Loading state ──────────────────────────

  if (loading) {
    return (
      <div className="p-6 lg:p-8">
        {/* Header skeleton */}
        <div className="mb-6 flex items-center justify-between">
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-10 w-36" />
        </div>
        {/* Stats skeleton */}
        <div className="mb-6 flex gap-6">
          <Skeleton className="h-16 w-48 rounded-lg" />
          <Skeleton className="h-16 w-48 rounded-lg" />
        </div>
        {/* Table skeleton */}
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  // ── Error state ────────────────────────────

  if (error) {
    return (
      <div className="p-6 lg:p-8">
        <div className="rounded-lg border border-red-200 bg-red-50 p-6">
          <div className="flex items-center gap-3 text-red-700">
            <AlertCircle className="h-5 w-5" />
            <p className="font-medium">
              Failed to load students. Please refresh the page.
            </p>
          </div>
          <p className="mt-2 text-sm text-red-600">{error}</p>
        </div>
      </div>
    );
  }

  // ── Main content ───────────────────────────

  return (
    <div className="p-6 lg:p-8">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Students</h1>
        <Button onClick={() => setDialogOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Add Student
        </Button>
      </div>

      {/* Stats bar */}
      <div className="mb-6 flex gap-4">
        <div className="rounded-lg border border-gray-200 bg-white px-5 py-3">
          <p className="text-xs font-medium uppercase tracking-wider text-gray-500">
            Total Students
          </p>
          <p className="mt-1 text-xl font-bold text-gray-900">
            {students.length}
          </p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white px-5 py-3">
          <p className="text-xs font-medium uppercase tracking-wider text-gray-500">
            Total Outstanding
          </p>
          <p
            className={`mt-1 text-xl font-bold ${
              totalOutstanding > 0 ? 'text-red-600' : 'text-green-600'
            }`}
          >
            {kobotoNaira(totalOutstanding)}
          </p>
        </div>
      </div>

      {/* Student table */}
      <StudentTable students={students} onRowClick={handleRowClick} />

      {/* Add student dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add New Student</DialogTitle>
          </DialogHeader>
          <AddStudentForm
            onSuccess={() => {
              // Table auto-updates via onSnapshot — no manual refetch needed
            }}
            onCancel={() => setDialogOpen(false)}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
