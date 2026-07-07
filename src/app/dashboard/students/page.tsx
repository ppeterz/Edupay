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
      <div className="rounded-2xl border border-red-250/20 bg-red-50 p-6 flex items-center gap-3 text-red-750">
        <AlertCircle className="h-5 w-5" />
        <div>
          <p className="font-bold text-sm">Failed to load students</p>
          <p className="text-xs mt-0.5 text-red-600 font-semibold">{error}</p>
        </div>
      </div>
    );
  }

  // ── Main content ───────────────────────────
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-950 tracking-tight">Students</h1>
          <p className="text-xs text-slate-500 font-medium mt-0.5">Manage students and track their fee payments</p>
        </div>
        <Button 
          onClick={() => setDialogOpen(true)}
          className="rounded-xl bg-slate-950 text-white font-bold hover:bg-slate-900 shadow-md shadow-slate-950/10 h-10 px-4"
        >
          <Plus className="mr-2 h-4.5 w-4.5" />
          Add Student
        </Button>
      </div>

      {/* Filter / Search Bar */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search by name or admission number..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full h-10 rounded-xl border border-slate-200 bg-white pl-10 pr-4 text-sm font-semibold text-slate-950 placeholder:text-slate-400 focus:border-slate-950 focus:outline-none shadow-sm"
          />
        </div>

        {/* Class Filter Dropdown */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">
            <SlidersHorizontal className="h-3.5 w-3.5" />
            <span>Class:</span>
          </div>
          <Select value={selectedClass} onValueChange={setSelectedClass}>
            <SelectTrigger className="w-44 h-10 border-slate-200 bg-white text-slate-750 rounded-xl shadow-sm font-semibold text-xs">
              <SelectValue placeholder="All Classes" />
            </SelectTrigger>
            <SelectContent className="rounded-xl">
              <SelectItem value="all" className="text-xs font-semibold">All Classes</SelectItem>
              {ALL_CLASSES.map((cls) => (
                <SelectItem key={cls} value={cls} className="text-xs font-semibold">
                  {cls}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-slate-200/50 bg-[#e2edf8]/30 px-5 py-4 flex flex-col justify-between shadow-sm">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
            Total Students
          </p>
          <p className="mt-2 text-2xl font-extrabold text-slate-950 tracking-tight">
            {filteredStudents.length}
          </p>
        </div>
        <div className="rounded-2xl border border-slate-200/50 bg-[#e2edf8]/30 px-5 py-4 flex flex-col justify-between shadow-sm">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
            Total Outstanding
          </p>
          <p
            className={`mt-2 text-2xl font-extrabold font-mono tracking-tight ${
              totalOutstanding > 0 ? 'text-red-650' : 'text-green-700'
            }`}
          >
            {kobotoNaira(totalOutstanding)}
          </p>
        </div>
        <div className="rounded-2xl border border-slate-200/50 bg-[#e2edf8]/30 px-5 py-4 flex flex-col justify-between shadow-sm">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
            Total Paid
          </p>
          <p className="mt-2 text-2xl font-extrabold text-emerald-700 font-mono tracking-tight">
            {kobotoNaira(totalPaidAmount)}
          </p>
        </div>
      </div>

      {/* Student table */}
      <StudentTable students={filteredStudents} onRowClick={handleRowClick} />

      {/* Add student dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md rounded-2xl p-6">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-slate-950">Add New Student</DialogTitle>
          </DialogHeader>
          <AddStudentForm
            onSuccess={() => {
              setDialogOpen(false);
            }}
            onCancel={() => setDialogOpen(false)}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}

