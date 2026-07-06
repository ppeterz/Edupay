'use client';

// ──────────────────────────────────────────────
// EduPay — Student Table
// ──────────────────────────────────────────────
// Displays all students with balances and status badges.

import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Users } from 'lucide-react';
import { kobotoNaira } from '@/lib/constants';
import type { Student } from '@/types';
import { usePayments } from '@/hooks/usePayments';


// ── Props ────────────────────────────────────

interface StudentTableProps {
  students: Student[];
  onRowClick: (student: Student) => void;
}

// ── Status badge logic ───────────────────────

function getStatusBadge(student: Student, totalPaid: number) {
  if (student.outstandingBalance === 0) {
    return (
      <Badge
        variant="secondary"
        className="border-green-200 bg-green-50 text-xs text-green-700 font-semibold"
      >
        Paid
      </Badge>
    );
  }
  
  if (totalPaid > 0) {
    return (
      <Badge
        variant="secondary"
        className="border-amber-200 bg-amber-50 text-xs text-amber-700 font-semibold"
      >
        Partial
      </Badge>
    );
  }

  if (student.creditBalance > 0) {
    return (
      <Badge
        variant="secondary"
        className="border-blue-200 bg-blue-50 text-xs text-blue-700 font-semibold"
      >
        Credit
      </Badge>
    );
  }

  return (
    <Badge variant="destructive" className="text-xs font-semibold">
      Outstanding
    </Badge>
  );
}

// ── Component ────────────────────────────────

export function StudentTable({ students, onRowClick }: StudentTableProps) {
  const { payments, loading: paymentsLoading } = usePayments();

  // ── Empty state ────────────────────────────

  if (students.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-[24px] border border-dashed border-slate-200 bg-white py-16 px-4">
        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-slate-50 border border-slate-100">
          <Users className="h-6 w-6 text-slate-400" />
        </div>
        <h3 className="text-sm font-bold text-slate-900">
          No students found
        </h3>
        <p className="mt-1 text-xs text-slate-500 font-medium">
          Try adjusting your search query or add a new student.
        </p>
      </div>
    );
  }

  // ── Table ──────────────────────────────────

  return (
    <div className="rounded-[24px] border border-slate-200/50 bg-white overflow-hidden shadow-sm">
      <Table>
        <TableHeader className="bg-slate-50/70">
          <TableRow className="hover:bg-transparent border-b border-slate-100">
            <TableHead className="text-slate-500 font-bold text-xs uppercase tracking-wider py-4 pl-6">Full Name</TableHead>
            <TableHead className="text-slate-500 font-bold text-xs uppercase tracking-wider py-4">Class</TableHead>
            <TableHead className="text-slate-500 font-bold text-xs uppercase tracking-wider py-4">Admission No.</TableHead>
            <TableHead className="text-slate-500 font-bold text-xs uppercase tracking-wider py-4">Virtual Account No.</TableHead>
            <TableHead className="text-slate-500 font-bold text-xs uppercase tracking-wider py-4">Bank</TableHead>
            <TableHead className="text-slate-500 font-bold text-xs uppercase tracking-wider py-4 text-right">Outstanding</TableHead>
            <TableHead className="text-slate-500 font-bold text-xs uppercase tracking-wider py-4 text-right">Paid Amount</TableHead>
            <TableHead className="text-slate-500 font-bold text-xs uppercase tracking-wider py-4 pr-6">Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {students.map((student) => {
            const studentPayments = payments.filter(
              (p) => p.studentId === student.id && p.paymentStatus === 'processed'
            );
            const totalPaid = studentPayments.reduce((sum, p) => sum + p.amount, 0);

            return (
              <TableRow
                key={student.id}
                className="cursor-pointer hover:bg-slate-50/80 transition-colors border-b border-slate-50 last:border-0"
                onClick={() => onRowClick(student)}
              >
                <TableCell className="font-bold text-slate-900 py-4 pl-6">
                  {student.fullName}
                </TableCell>
                <TableCell className="font-semibold text-slate-600">{student.class}</TableCell>
                <TableCell className="font-mono text-xs text-slate-500 font-semibold">
                  {student.admissionNumber}
                </TableCell>
                <TableCell
                  className="font-mono text-xs text-slate-500 font-semibold"
                  title={student.virtualAccountNumber}
                >
                  {student.virtualAccountNumber}
                </TableCell>
                <TableCell className="text-xs font-semibold text-slate-500">
                  {student.virtualAccountBankName}
                </TableCell>
                <TableCell
                  className={`text-right font-bold font-mono text-xs tabular-nums py-4 ${
                    student.outstandingBalance > 0
                      ? 'text-red-650'
                      : 'text-green-700'
                  }`}
                >
                  {kobotoNaira(student.outstandingBalance)}
                </TableCell>
                <TableCell className="text-right font-bold font-mono text-xs tabular-nums text-emerald-700 py-4">
                  {kobotoNaira(totalPaid)}
                </TableCell>
                <TableCell className="py-4 pr-6">{getStatusBadge(student, totalPaid)}</TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
