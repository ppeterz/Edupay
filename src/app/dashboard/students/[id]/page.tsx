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
import { toast } from 'sonner';


export default function StudentDetailPage() {
  const router = useRouter();
  const params = useParams();
  const studentId = params.id as string;
  const { user, school } = useAuth();

  const [student, setStudent] = useState<Student | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingInvoice, setEditingInvoice] = useState<Invoice | null>(null);
  const [copied, setCopied] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const { invoices, loading: invoicesLoading, error: invoicesError } = useInvoices(studentId);

  async function handleDeleteStudent() {
    const confirmed = window.confirm(
      `Are you sure you want to delete ${student?.fullName} and all associated invoices, payments, and logs? This action is permanent and cannot be undone.`
    );
    if (!confirmed) return;

    setDeleting(true);
    try {
      const currentUser = user;
      if (!currentUser) return;
      const token = await currentUser.getIdToken();

      const res = await fetch(`/api/students/${studentId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        const errData = await res.json();
        toast.error(errData.error || 'Failed to delete student');
        return;
      }

      toast.success('Student and all related data successfully deleted.');
      router.push('/dashboard/students');
    } catch {
      toast.error('Network connection error');
    } finally {
      setDeleting(false);
    }
  }

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

  if (loading) {
    return (
      <div className="space-y-6 animate-pulse">
        <Skeleton className="h-9 w-40 rounded-xl" />
        <div className="flex justify-between items-center">
          <Skeleton className="h-8 w-48 rounded-xl" />
          <Skeleton className="h-10 w-32 rounded-xl" />
        </div>
        <Skeleton className="h-32 w-full rounded-[28px]" />
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-4">
            <Skeleton className="h-44 w-full rounded-[24px]" />
          </div>
          <div className="lg:col-span-1 space-y-4">
            <Skeleton className="h-44 w-full rounded-[24px]" />
          </div>
        </div>
      </div>
    );
  }

  // ── Error state ────────────────────────────

  if (error || !student) {
    return (
      <div className="space-y-6">
        <Button
          variant="ghost"
          onClick={() => router.push('/dashboard/students')}
          className="rounded-xl text-slate-550 hover:text-slate-900 border border-slate-200"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Students
        </Button>
        <div className="rounded-2xl border border-red-200 bg-red-50 p-6 flex items-center gap-3 text-red-700">
          <AlertCircle className="h-5 w-5" />
          <p className="font-bold text-sm">{error || 'Student not found'}</p>
        </div>
      </div>
    );
  }

  // ── Main content ───────────────────────────

  return (
    <div className="space-y-6">
      {/* Back link */}
      <Button
        variant="ghost"
        onClick={() => router.push('/dashboard/students')}
        className="rounded-xl text-slate-550 hover:text-slate-950 hover:bg-slate-50 border border-transparent hover:border-slate-200/55 h-9 px-3"
      >
        <ArrowLeft className="mr-2 h-4 w-4" />
        Back to Students
      </Button>

      {/* Header row */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between pb-4 border-b border-slate-100">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-955 tracking-tight">
            {student.fullName}
          </h1>
          <p className="text-xs text-slate-500 font-semibold mt-1">
            Class: <span className="text-slate-900">{student.class}</span> &middot; Admission No: <span className="font-mono text-slate-900">{student.admissionNumber}</span>
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <Button
            variant="outline"
            onClick={handleDeleteStudent}
            disabled={deleting}
            className="rounded-xl border-red-200 text-red-650 hover:bg-red-50 hover:text-red-700 h-10 px-4 font-semibold text-xs"
          >
            {deleting ? 'Deleting...' : 'Delete Student'}
          </Button>
          <Button 
            onClick={() => setDialogOpen(true)}
            className="rounded-xl bg-slate-950 text-white font-bold hover:bg-slate-900 shadow-md shadow-slate-950/10 h-10 px-4 text-xs"
          >
            <Plus className="mr-2 h-4 w-4" />
            Create Invoice
          </Button>
        </div>
      </div>

      {/* Virtual account info card styled like a premium credit card */}
      <div className="relative rounded-[28px] bg-gradient-to-br from-slate-900 via-slate-950 to-slate-900 text-white p-6 shadow-xl overflow-hidden border border-slate-850 select-none">
        <div className="absolute top-0 right-0 w-44 h-44 rounded-full bg-blue-500/5 blur-3xl pointer-events-none" />
        <div className="flex justify-between items-start">
          <div>
            <p className="text-[9px] uppercase font-bold text-slate-500 tracking-wider">Edupay Virtual Account</p>
            <h3 className="text-sm font-bold text-slate-350 mt-1">{student.virtualAccountBankName ?? 'Nomba Partner Bank'}</h3>
          </div>
          <span className="text-lg font-extrabold tracking-tight text-white opacity-80">₦</span>
        </div>

        <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-3 items-end">
          <div>
            <p className="text-[8px] uppercase font-bold text-slate-500 tracking-wider">Account Number</p>
            <div className="mt-1.5 flex items-center gap-2">
              <span className="font-mono text-xl font-bold tracking-wider text-white">
                {student.virtualAccountNumber}
              </span>
              <button
                type="button"
                className="p-1 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
                onClick={copyAccountNumber}
                title="Copy account number"
              >
                <Copy className="h-3.5 w-3.5" />
              </button>
              {copied && (
                <span className="text-[10px] text-emerald-400 font-bold animate-pulse">Copied!</span>
              )}
            </div>
          </div>
          
          <div>
            <p className="text-[8px] uppercase font-bold text-slate-500 tracking-wider">Account Reference</p>
            <p className="mt-1.5 font-mono text-xs text-slate-350 truncate">
              {student.virtualAccountReference}
            </p>
          </div>

          <div className="text-left sm:text-right">
            <span className="inline-flex items-center rounded-full bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-0.5 text-[9px] font-bold text-emerald-400 uppercase tracking-wide">
              Active Virtual Account
            </span>
          </div>
        </div>
      </div>

      {/* Balances, Timeline & Invoices Grid */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3 items-start">
        {/* Invoices List */}
        <div className="lg:col-span-2 space-y-4">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500">
            Student Invoices
          </h2>

          {invoicesError ? (
            <div className="rounded-2xl border border-red-200 bg-red-50 p-5 flex items-center gap-3 text-red-700">
              <AlertCircle className="h-5 w-5" />
              <div>
                <p className="text-xs font-bold">Failed to load invoices</p>
                <p className="text-[10px] mt-0.5 text-red-650 font-semibold">{invoicesError}</p>
              </div>
            </div>
          ) : invoicesLoading ? (
            <div className="space-y-4">
              <Skeleton className="h-44 w-full rounded-[24px]" />
              <Skeleton className="h-44 w-full rounded-[24px]" />
            </div>
          ) : invoices.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-[24px] border border-dashed border-slate-200 bg-white py-12 px-4 select-none">
              <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-slate-50 border border-slate-100">
                <FileText className="h-6 w-6 text-slate-400" />
              </div>
              <h3 className="text-xs font-bold text-slate-900">
                No invoices created yet
              </h3>
              <p className="mt-1 text-[10px] text-slate-500 font-medium">
                Create the first invoice to start tracking payments.
              </p>
              <Button
                className="mt-4 rounded-xl bg-slate-950 text-white font-bold hover:bg-slate-900 shadow text-xs h-9 px-4"
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
                <InvoiceCard
                  key={inv.id}
                  invoice={inv}
                  student={student}
                  schoolName={school?.name || 'School'}
                  onEdit={setEditingInvoice}
                />
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
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg rounded-2xl p-6">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-slate-950">Create Invoice</DialogTitle>
          </DialogHeader>
          <CreateInvoiceForm
            studentId={studentId}
            studentName={student.fullName}
            onSuccess={() => {
              setDialogOpen(false);
              fetchStudentData();
            }}
            onCancel={() => setDialogOpen(false)}
          />
        </DialogContent>
      </Dialog>

      {/* Edit invoice dialog */}
      <Dialog open={!!editingInvoice} onOpenChange={(open) => !open && setEditingInvoice(null)}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg rounded-2xl p-6">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-slate-950">Edit Invoice</DialogTitle>
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
