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

// ── Props ────────────────────────────────────

interface StudentTableProps {
  students: Student[];
  onRowClick: (student: Student) => void;
}

// ── Status badge logic ───────────────────────

function getStatusBadge(student: Student) {
  if (student.outstandingBalance > 0) {
    return (
      <Badge variant="destructive" className="text-xs">
        Outstanding
      </Badge>
    );
  }
  if (student.creditBalance > 0) {
    return (
      <Badge
        variant="secondary"
        className="border-blue-200 bg-blue-50 text-xs text-blue-700"
      >
        Credit
      </Badge>
    );
  }
  return (
    <Badge
      variant="secondary"
      className="border-green-200 bg-green-50 text-xs text-green-700"
    >
      Clear
    </Badge>
  );
}

// ── Component ────────────────────────────────

export function StudentTable({ students, onRowClick }: StudentTableProps) {
  // ── Empty state ────────────────────────────

  if (students.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-gray-300 bg-white py-16">
        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gray-100">
          <Users className="h-8 w-8 text-gray-400" />
        </div>
        <h3 className="text-lg font-medium text-gray-900">
          No students yet
        </h3>
        <p className="mt-1 text-sm text-gray-500">
          Add your first student to get started
        </p>
      </div>
    );
  }

  // ── Table ──────────────────────────────────

  return (
    <div className="rounded-lg border border-gray-200 bg-white">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Full Name</TableHead>
            <TableHead>Class</TableHead>
            <TableHead>Admission No.</TableHead>
            <TableHead>Virtual Account No.</TableHead>
            <TableHead>Bank</TableHead>
            <TableHead className="text-right">Outstanding</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {students.map((student) => (
            <TableRow
              key={student.id}
              className="cursor-pointer hover:bg-gray-50"
              onClick={() => onRowClick(student)}
            >
              <TableCell className="font-medium text-gray-900">
                {student.fullName}
              </TableCell>
              <TableCell>{student.class}</TableCell>
              <TableCell className="font-mono text-xs">
                {student.admissionNumber}
              </TableCell>
              <TableCell
                className="font-mono text-xs"
                title={student.virtualAccountNumber}
              >
                {student.virtualAccountNumber}
              </TableCell>
              <TableCell className="text-xs text-gray-500">
                {student.virtualAccountBankName}
              </TableCell>
              <TableCell
                className={`text-right font-medium ${
                  student.outstandingBalance > 0
                    ? 'text-red-600'
                    : 'text-green-600'
                }`}
              >
                {kobotoNaira(student.outstandingBalance)}
              </TableCell>
              <TableCell>{getStatusBadge(student)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
