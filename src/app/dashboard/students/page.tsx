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
import { Plus, AlertCircle, Search, SlidersHorizontal } from 'lucide-react';
import { kobotoNaira, ALL_CLASSES } from '@/lib/constants';
import type { Student } from '@/types';
import { usePayments } from '@/hooks/usePayments';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

export default function StudentsPage() {
  const router = useRouter();
  const { students, loading: studentsLoading, error } = useStudents();
  const { payments, loading: paymentsLoading } = usePayments();
  const [dialogOpen, setDialogOpen] = useState(false);

  const loading = studentsLoading || paymentsLoading;

  // Filter & Search states
  const [selectedClass, setSelectedClass] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // ── Apply filters client-side ────────────────
  const filteredStudents = students.filter((s) => {
    const matchesClass = selectedClass === 'all' || s.class === selectedClass;
    const matchesSearch =
      !searchQuery.trim() ||
      s.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.admissionNumber.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesClass && matchesSearch;
  });

  // ── Stats ──────────────────────────────────
  const totalOutstanding = filteredStudents.reduce(
    (sum, s) => sum + s.outstandingBalance,
    0
  );

  const totalPaidAmount = filteredStudents.reduce((sum, student) => {
    const studentPayments = payments.filter(
      (p) => p.studentId === student.id && p.paymentStatus === 'processed'
    );
    return sum + studentPayments.reduce((s, p) => s + p.amount, 0);
  }, 0);

  function handleRowClick(student: Student) {
    router.push(`/dashboard/students/${student.id}`);
  }

  // ── Loading state ──────────────────────────
  if (loading) {
    return (
      <div className="p-6 lg:p-8 space-y-6">
        {/* Header skeleton */}
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-10 w-36" />
        </div>
        {/* Filters skeleton */}
        <div className="flex flex-col gap-3 md:flex-row">
          <Skeleton className="h-10 w-full md:max-w-md rounded" />
          <Skeleton className="h-10 w-40 rounded" />
        </div>
        {/* Stats skeleton */}
        <div className="flex gap-6">
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
    <div className="p-6 lg:p-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Students</h1>
        <Button onClick={() => setDialogOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Add Student
        </Button>
      </div>

      {/* Filter / Search Bar */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search by student name or admission number..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-md border border-slate-200 bg-white py-2 pl-9 pr-4 text-sm text-slate-900 placeholder:text-slate-400 focus:border-slate-900 focus:outline-none"
          />
        </div>

        {/* Class Filter Dropdown */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
            <SlidersHorizontal className="h-3.5 w-3.5" />
            <span>Class:</span>
          </div>
          <Select value={selectedClass} onValueChange={setSelectedClass}>
            <SelectTrigger className="w-44 border-slate-200 bg-white text-slate-700">
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

      {/* Stats bar */}
      <div className="flex flex-wrap gap-4">
        <div className="rounded-lg border border-gray-200 bg-white px-5 py-3">
          <p className="text-xs font-medium uppercase tracking-wider text-gray-500">
            Total Students
          </p>
          <p className="mt-1 text-xl font-bold text-gray-900">
            {filteredStudents.length}
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
        <div className="rounded-lg border border-gray-200 bg-white px-5 py-3">
          <p className="text-xs font-medium uppercase tracking-wider text-gray-500">
            Total Paid
          </p>
          <p className="mt-1 text-xl font-bold text-green-700 font-mono tabular-nums">
            {kobotoNaira(totalPaidAmount)}
          </p>
        </div>
      </div>

      {/* Student table */}
      <StudentTable students={filteredStudents} onRowClick={handleRowClick} />

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

