'use client';

// ──────────────────────────────────────────────
// EduPay — Student Detail Page
// ──────────────────────────────────────────────
// Shows student info, virtual account, balances, and all invoices.

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useInvoices } from '@/hooks/useInvoices';
import { InvoiceCard } from '@/components/invoices/InvoiceCard';
import { CreateInvoiceForm } from '@/components/invoices/CreateInvoiceForm';
import { EditInvoiceForm } from '@/components/invoices/EditInvoiceForm';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import {
  ArrowLeft,
  AlertCircle,
  Plus,
  Copy,
  FileText,
} from 'lucide-react';
import { kobotoNaira } from '@/lib/constants';
import type { Student, Invoice } from '@/types';
import { StudentBalanceSummary } from '@/components/dashboard/StudentBalanceSummary';


export default function StudentDetailPage() {
  const router = useRouter();
  const params = useParams();
  const studentId = params.id as string;
  const { user } = useAuth();

  const [student, setStudent] = useState<Student | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingInvoice, setEditingInvoice] = useState<Invoice | null>(null);
  const [copied, setCopied] = useState(false);

  const { invoices, loading: invoicesLoading, error: invoicesError } = useInvoices(studentId);

  // ── Fetch student data ─────────────────────

  useEffect(() => {
    if (!user) return; // Wait for auth to restore session
    const currentUser = user;

    async function fetchStudent() {
      try {
        const token = await currentUser.getIdToken();

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
  }, [studentId, user]);

  // ── Copy account number ────────────────────

  async function copyAccountNumber() {
    if (!student) return;
    try {
      await navigator.clipboard.writeText(student.virtualAccountNumber);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API may not be available
    }
  }

  // ── Loading state ──────────────────────────

  if (loading) {
    return (
      <div className="p-6 lg:p-8">
        <Skeleton className="mb-6 h-8 w-48" />
        <Skeleton className="mb-4 h-6 w-64" />
        <div className="space-y-3">
          <Skeleton className="h-32 w-full rounded-lg" />
          <Skeleton className="h-24 w-full rounded-lg" />
          <Skeleton className="h-48 w-full rounded-lg" />
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

  // ── Main content ───────────────────────────

  return (
    <div className="p-6 lg:p-8">
      {/* Back link */}
      <Button
        variant="ghost"
        onClick={() => router.push('/dashboard/students')}
        className="mb-4"
      >
        <ArrowLeft className="mr-2 h-4 w-4" />
        Back to Students
      </Button>

      {/* Header row */}
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {student.fullName}
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            {student.class} &middot; {student.admissionNumber}
          </p>
        </div>
        <Button onClick={() => setDialogOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Create Invoice
        </Button>
      </div>

      {/* Virtual account info card */}
      <Card className="mb-6">
        <CardHeader className="pb-2">
          <h2 className="text-sm font-semibold text-gray-900">
            Virtual Account
          </h2>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-gray-500">
                Account Number
              </p>
              <div className="mt-1 flex items-center gap-2">
                <span className="font-mono text-base font-bold text-gray-900">
                  {student.virtualAccountNumber}
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={copyAccountNumber}
                  title="Copy account number"
                >
                  <Copy className="h-3.5 w-3.5" />
                </Button>
                {copied && (
                  <span className="text-xs text-green-600">Copied!</span>
                )}
              </div>
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-gray-500">
                Bank
              </p>
              <p className="mt-1 text-sm font-medium text-gray-900">
                {student.virtualAccountBankName}
              </p>
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-gray-500">
                Reference
              </p>
              <p className="mt-1 font-mono text-xs text-gray-500">
                {student.virtualAccountReference}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Balances, Timeline & Invoices Grid */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3 items-start">
        {/* Invoices List */}
        <div className="lg:col-span-2">
          <h2 className="mb-4 text-lg font-semibold text-gray-900">
            Invoices
          </h2>

          {invoicesError ? (
            <div className="rounded-lg border border-red-200 bg-red-50 p-4">
              <div className="flex items-center gap-2 text-red-700">
                <AlertCircle className="h-4 w-4" />
                <p className="text-sm font-medium">Failed to load invoices</p>
              </div>
              <p className="mt-1 text-xs text-red-600">{invoicesError}</p>
            </div>
          ) : invoicesLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-48 w-full rounded-lg" />
              <Skeleton className="h-48 w-full rounded-lg" />
            </div>
          ) : invoices.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-gray-300 bg-white py-12">
              <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-gray-100">
                <FileText className="h-7 w-7 text-gray-400" />
              </div>
              <h3 className="text-base font-medium text-gray-900">
                No invoices created yet
              </h3>
              <p className="mt-1 text-sm text-gray-500">
                Create the first invoice to start tracking payments
              </p>
              <Button
                className="mt-4"
                size="sm"
                onClick={() => setDialogOpen(true)}
              >
                <Plus className="mr-2 h-4 w-4" />
                Create Invoice
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {invoices.map((inv) => (
                <InvoiceCard key={inv.id} invoice={inv} onEdit={setEditingInvoice} />
              ))}
            </div>
          )}
        </div>

        {/* Ledger Balances & Timeline Column */}
        <div className="lg:col-span-1">
          <StudentBalanceSummary student={student} />
        </div>
      </div>


      {/* Create invoice dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Create Invoice</DialogTitle>
          </DialogHeader>
          <CreateInvoiceForm
            studentId={studentId}
            studentName={student.fullName}
            onSuccess={() => {
              setDialogOpen(false);
              // Invoice list auto-updates via onSnapshot
              // Re-fetch student to get updated outstandingBalance
              fetchStudentData();
            }}
            onCancel={() => setDialogOpen(false)}
          />
        </DialogContent>
      </Dialog>

      {/* Edit invoice dialog */}
      <Dialog open={!!editingInvoice} onOpenChange={(open) => !open && setEditingInvoice(null)}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Invoice</DialogTitle>
          </DialogHeader>
          {editingInvoice && (
            <EditInvoiceForm
              invoice={editingInvoice}
              studentName={student.fullName}
              onSuccess={() => {
                setEditingInvoice(null);
                fetchStudentData();
              }}
              onCancel={() => setEditingInvoice(null)}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );

  // ── Helper to re-fetch student after invoice creation ──

  async function fetchStudentData() {
    if (!user) return;
    const currentUser = user;
    try {
      const token = await currentUser.getIdToken();

      const res = await fetch(`/api/students/${studentId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setStudent(data.student);
      }
    } catch {
      // Silently fail — student data will refresh on next page load
    }
  }
}
