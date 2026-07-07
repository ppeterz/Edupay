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
  Printer,
} from 'lucide-react';
import { kobotoNaira } from '@/lib/constants';
import type { Student, Invoice, Payment } from '@/types';
import { sortLineItemsByPriority } from '@/lib/invoice-helpers';
import { StudentBalanceSummary } from '@/components/dashboard/StudentBalanceSummary';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { getFirebaseDb } from '@/lib/firebase';
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
  const [payments, setPayments] = useState<Payment[]>([]);

  useEffect(() => {
    if (!user || !studentId) return;
    const db = getFirebaseDb();
    const q = query(
      collection(db, 'payments'),
      where('schoolId', '==', user.uid),
      where('studentId', '==', studentId)
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        setPayments(snap.docs.map((d) => d.data() as Payment));
      },
      (err) => {
        console.error('[StudentDetailPage] Payments fetch error:', err);
      }
    );
    return () => unsub();
  }, [user, studentId]);

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

  // ── Print Session Receipt (all invoices) ────

  function handlePrintSessionReceipt() {
    if (!student || invoices.length === 0) return;

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert('Please allow popups to print receipts.');
      return;
    }

    const sName = school?.name || 'EduPay School';

    const sortInvoicesChronologically = (invs: typeof invoices) => {
      const getSessionYear = (session: string) => {
        const match = session.match(/^(\d{4})/);
        return match ? parseInt(match[1], 10) : 0;
      };

      const getTermWeight = (term: string) => {
        const t = term.toLowerCase().trim();
        if (t.includes('first')) return 1;
        if (t.includes('second')) return 2;
        if (t.includes('third')) return 3;
        return 4;
      };

      return [...invs].sort((a, b) => {
        const sA = getSessionYear(a.session);
        const sB = getSessionYear(b.session);
        if (sA !== sB) return sA - sB;

        const tA = getTermWeight(a.term);
        const tB = getTermWeight(b.term);
        return tA - tB;
      });
    };

    const chronologicalInvoices = sortInvoicesChronologically(invoices);

    // Group invoices by session
    const bySession = new Map<string, typeof invoices>();
    for (const inv of chronologicalInvoices) {
      const key = `${inv.session}`;
      const list = bySession.get(key) ?? [];
      list.push(inv);
      bySession.set(key, list);
    }

    // Grand totals across all invoices
    const grandDue = invoices.reduce((s, inv) => s + inv.totalAmountDue, 0);
    const grandPaid = invoices.reduce((s, inv) => s + inv.totalAmountPaid, 0);
    const grandOutstanding = invoices.reduce((s, inv) => s + inv.outstandingBalance, 0);

    interface LedgerRow {
      term: string;
      session: string;
      openingOutstanding: number;
      newCharges: number;
      paymentsReceived: number;       // applied to current term charges
      pastOutstandingCleared: number; // applied to prior outstanding balance
      closingOutstanding: number;
    }

    const ledgerRows: LedgerRow[] = [];
    let runningOutstanding = 0;

    for (let k = 0; k < chronologicalInvoices.length; k++) {
      const inv = chronologicalInvoices[k];
      const termStart = new Date(inv.createdAt).getTime();
      const termEnd = k < chronologicalInvoices.length - 1
        ? new Date(chronologicalInvoices[k + 1].createdAt).getTime()
        : Infinity;

      const openingOutstanding = runningOutstanding;
      const newCharges = inv.totalAmountDue;

      let paymentsReceived = 0;
      let pastOutstandingCleared = 0;

      for (const payment of payments) {
        const payTime = new Date(payment.processedAt ?? payment.createdAt).getTime();
        // Payment fell inside this term's duration
        if (payTime >= termStart && payTime < termEnd) {
          for (const alloc of payment.allocations) {
            if (alloc.invoiceId === inv.id) {
              paymentsReceived += alloc.amountAllocated;
            } else {
              // Check if allocation went to a prior invoice in chronological list
              const isPriorInvoice = chronologicalInvoices
                .slice(0, k)
                .some((pInv) => pInv.id === alloc.invoiceId);
              if (isPriorInvoice) {
                pastOutstandingCleared += alloc.amountAllocated;
              }
            }
          }
        }
      }

      // Closing Outstanding = Opening Outstanding - Past Outstanding Cleared + New Charges - Payments Received
      const closingOutstanding = Math.max(0, openingOutstanding - pastOutstandingCleared + newCharges - paymentsReceived);

      ledgerRows.push({
        term: inv.term,
        session: inv.session,
        openingOutstanding,
        newCharges,
        paymentsReceived,
        pastOutstandingCleared,
        closingOutstanding,
      });

      runningOutstanding = closingOutstanding;
    }

    // Build carry-forward ledger HTML
    const ledgerHtml = `
      <div class="ledger-section">
        <div class="ledger-title">Balance Carry-Forward Ledger</div>
        <p class="ledger-subtitle">Chronological ledger showing how past outstanding and credit balances were cleared from term to term</p>
        <table class="ledger-table">
          <thead>
            <tr>
              <th>Term / Session</th>
              <th class="text-right">Opening Outstanding</th>
              <th class="text-right">New Charges</th>
              <th class="text-right">Total Received</th>
              <th class="text-right">Applied to New Charges</th>
              <th class="text-right">Applied to Past Outstanding</th>
              <th class="text-right">Closing Outstanding</th>
            </tr>
          </thead>
          <tbody>
            ${ledgerRows.map((row, idx) => {
              const isLast = idx === ledgerRows.length - 1;
              const totalReceived = row.paymentsReceived + row.pastOutstandingCleared;
              return `
                <tr style="${isLast ? 'font-weight: 600;' : ''}">
                  <td>
                    <span style="font-weight: 600;">${row.term}</span>
                    <span style="color: #64748b; font-size: 11px; margin-left: 6px;">${row.session}</span>
                  </td>
                  <td class="text-right" style="color: ${row.openingOutstanding > 0 ? '#dc2626' : '#94a3b8'};">
                    ${row.openingOutstanding > 0 ? kobotoNaira(row.openingOutstanding) : '—'}
                  </td>
                  <td class="text-right">${kobotoNaira(row.newCharges)}</td>
                  <td class="text-right" style="font-weight: 600; color: #0f172a;">
                    ${totalReceived > 0 ? kobotoNaira(totalReceived) : '—'}
                  </td>
                  <td class="text-right" style="color: #16a34a;">
                    ${row.paymentsReceived > 0 ? kobotoNaira(row.paymentsReceived) : '—'}
                  </td>
                  <td class="text-right" style="color: ${row.pastOutstandingCleared > 0 ? '#2563eb' : '#94a3b8'}; font-weight: ${row.pastOutstandingCleared > 0 ? '600' : 'normal'};">
                    ${row.pastOutstandingCleared > 0 ? `−${kobotoNaira(row.pastOutstandingCleared)}` : '—'}
                  </td>
                  <td class="text-right" style="font-weight: 700; color: ${row.closingOutstanding > 0 ? '#dc2626' : '#16a34a'};">
                    ${row.closingOutstanding > 0 ? kobotoNaira(row.closingOutstanding) : 'SETTLED'}
                  </td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
        ${student.creditBalance > 0 ? `
          <div class="credit-note">
            <span style="font-weight: 700; color: #1d4ed8;">Available Wallet Credit: ${kobotoNaira(student.creditBalance)}</span>
            <span style="color: #64748b; font-size: 11px; margin-left: 8px;">Will automatically clear future invoices</span>
          </div>
        ` : ''}
      </div>
    `;

    // Build invoice sections HTML
    let invoiceSectionsHtml = '';
    for (const [sessionKey, sessionInvoices] of bySession) {
      for (const inv of sessionInvoices) {
        const sorted = sortLineItemsByPriority(inv.lineItems);
        const statusLabel = inv.status.toUpperCase();
        const statusColor = inv.status === 'paid' || inv.status === 'overpaid' ? '#16a34a' : inv.status === 'partial' ? '#d97706' : '#dc2626';

        invoiceSectionsHtml += `
          <div class="invoice-section">
            <div class="invoice-header">
              <div>
                <span class="term-label">${inv.term}</span>
                <span class="session-label">${sessionKey}</span>
              </div>
              <span class="status-badge" style="background: ${statusColor}15; color: ${statusColor}; border: 1px solid ${statusColor}30;">${statusLabel}</span>
            </div>
            <table>
              <thead>
                <tr>
                  <th>Description</th>
                  <th class="text-right">Priority</th>
                  <th class="text-right">Amount Due</th>
                  <th class="text-right">Amount Paid</th>
                  <th class="text-right">Outstanding</th>
                </tr>
              </thead>
              <tbody>
                ${sorted.map(li => {
                  const outstanding = li.amountDue - li.amountPaid;
                  return `
                    <tr>
                      <td>${li.description}</td>
                      <td class="text-right">P${li.priority}</td>
                      <td class="text-right">${kobotoNaira(li.amountDue)}</td>
                      <td class="text-right" style="color: #16a34a;">${kobotoNaira(li.amountPaid)}</td>
                      <td class="text-right" style="font-weight: 600; ${outstanding > 0 ? 'color: #dc2626;' : 'color: #94a3b8;'}">
                        ${outstanding > 0 ? kobotoNaira(outstanding) : '—'}
                      </td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
            <div class="invoice-subtotal">
              <div class="subtotal-row">
                <span>Term Due</span>
                <span class="subtotal-value">${kobotoNaira(inv.totalAmountDue)}</span>
              </div>
              <div class="subtotal-row">
                <span>Term Paid</span>
                <span class="subtotal-value" style="color: #16a34a;">${kobotoNaira(inv.totalAmountPaid)}</span>
              </div>
              <div class="subtotal-row">
                <span>Term Outstanding</span>
                <span class="subtotal-value" style="color: ${inv.outstandingBalance > 0 ? '#dc2626' : '#16a34a'}; font-weight: 700;">
                  ${inv.outstandingBalance > 0 ? kobotoNaira(inv.outstandingBalance) : 'SETTLED'}
                </span>
              </div>
            </div>
          </div>
        `;
      }
    }

    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <title>Session Fee Receipt - ${student.fullName}</title>
  <style>
    body {
      font-family: system-ui, -apple-system, sans-serif;
      color: #1e293b;
      margin: 40px;
      line-height: 1.5;
    }
    .header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      border-bottom: 2px solid #0f172a;
      padding-bottom: 20px;
      margin-bottom: 30px;
    }
    .school-name {
      font-size: 24px;
      font-weight: 800;
      color: #0f172a;
    }
    .doc-title {
      font-size: 18px;
      font-weight: 700;
      color: #475569;
    }
    .doc-subtitle {
      font-size: 11px;
      color: #64748b;
      margin-top: 4px;
    }
    .details {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 20px;
      margin-bottom: 30px;
    }
    .details-section h3 {
      font-size: 11px;
      font-weight: 700;
      color: #64748b;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      margin-bottom: 8px;
      border-bottom: 1px solid #e2e8f0;
      padding-bottom: 6px;
    }
    .field {
      font-size: 13px;
      margin-bottom: 5px;
    }
    .field-label {
      color: #64748b;
      font-weight: 500;
      display: inline-block;
      min-width: 120px;
    }
    .field-value {
      font-weight: 600;
    }
    .invoice-section {
      margin-bottom: 30px;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      overflow: hidden;
    }
    .invoice-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      background: #f8fafc;
      padding: 10px 16px;
      border-bottom: 1px solid #e2e8f0;
    }
    .term-label {
      font-size: 14px;
      font-weight: 700;
      color: #0f172a;
    }
    .session-label {
      font-size: 12px;
      color: #64748b;
      margin-left: 10px;
    }
    .status-badge {
      font-size: 10px;
      font-weight: 700;
      padding: 3px 10px;
      border-radius: 12px;
      text-transform: uppercase;
      letter-spacing: 0.03em;
    }
    table {
      width: 100%;
      border-collapse: collapse;
    }
    th {
      background-color: #f1f5f9;
      font-size: 11px;
      font-weight: 700;
      color: #475569;
      text-transform: uppercase;
      padding: 8px 14px;
      text-align: left;
      border-bottom: 1px solid #cbd5e1;
    }
    td {
      padding: 10px 14px;
      font-size: 13px;
      border-bottom: 1px solid #f1f5f9;
    }
    .text-right {
      text-align: right;
    }
    .invoice-subtotal {
      background: #f8fafc;
      padding: 10px 16px;
      border-top: 1px solid #e2e8f0;
    }
    .subtotal-row {
      display: flex;
      justify-content: space-between;
      font-size: 13px;
      margin-bottom: 4px;
    }
    .subtotal-row:last-child {
      margin-bottom: 0;
    }
    .subtotal-value {
      font-weight: 600;
    }
    .grand-summary {
      margin-top: 20px;
      border: 2px solid #0f172a;
      border-radius: 8px;
      padding: 16px 20px;
      background: #f8fafc;
    }
    .grand-title {
      font-size: 12px;
      font-weight: 700;
      text-transform: uppercase;
      color: #64748b;
      letter-spacing: 0.05em;
      margin-bottom: 10px;
    }
    .grand-row {
      display: flex;
      justify-content: space-between;
      font-size: 14px;
      margin-bottom: 6px;
    }
    .grand-row:last-child {
      margin-bottom: 0;
    }
    .grand-divider {
      border-bottom: 1px solid #e2e8f0;
      margin: 8px 0;
    }
    .grand-label {
      font-weight: 600;
      color: #334155;
    }
    .grand-value {
      font-weight: 800;
      font-size: 16px;
    }
    .ledger-section {
      margin-bottom: 30px;
      border: 1px solid #cbd5e1;
      border-radius: 8px;
      overflow: hidden;
      background: #fefce8;
    }
    .ledger-title {
      font-size: 13px;
      font-weight: 700;
      color: #0f172a;
      padding: 12px 16px 0;
    }
    .ledger-subtitle {
      font-size: 11px;
      color: #64748b;
      padding: 2px 16px 10px;
      margin: 0;
    }
    .ledger-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 12px;
    }
    .ledger-table th {
      background: #fef9c3;
      font-size: 10px;
      font-weight: 700;
      color: #713f12;
      text-transform: uppercase;
      padding: 8px 12px;
      text-align: left;
      border-bottom: 1px solid #fde68a;
    }
    .ledger-table th.text-right {
      text-align: right;
    }
    .ledger-table td {
      padding: 9px 12px;
      font-size: 12px;
      border-bottom: 1px solid #fef3c7;
    }
    .ledger-table td.text-right {
      text-align: right;
    }
    .credit-note {
      padding: 10px 16px;
      border-top: 1px solid #fde68a;
      background: #fef9c3;
      font-size: 12px;
    }
    .footer {
      margin-top: 50px;
      font-size: 11px;
      color: #94a3b8;
      text-align: center;
      border-top: 1px solid #e2e8f0;
      padding-top: 15px;
    }
    @media print {
      body { margin: 20px; }
      .invoice-section { break-inside: avoid; }
      .ledger-section { break-inside: avoid; }
    }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <div class="school-name">${sName}</div>
      <div class="doc-subtitle">Session Fee Statement</div>
    </div>
    <div style="text-align: right;">
      <div class="doc-title">FEE RECEIPT</div>
      <div class="doc-subtitle">Generated ${new Date().toLocaleDateString('en-NG', { month: 'long', day: 'numeric', year: 'numeric' })}</div>
    </div>
  </div>

  <div class="details">
    <div class="details-section">
      <h3>Student Details</h3>
      <div class="field">
        <span class="field-label">Full Name:</span>
        <span class="field-value">${student.fullName}</span>
      </div>
      <div class="field">
        <span class="field-label">Class:</span>
        <span class="field-value">${student.class}</span>
      </div>
      <div class="field">
        <span class="field-label">Admission No:</span>
        <span class="field-value">${student.admissionNumber || 'N/A'}</span>
      </div>
    </div>
    <div class="details-section" style="text-align: right;">
      <h3>Account Details</h3>
      <div class="field">
        <span class="field-value">${student.virtualAccountNumber}</span>
      </div>
      <div class="field">
        <span class="field-label">Bank:</span>
        <span class="field-value">${student.virtualAccountBankName || 'N/A'}</span>
      </div>
      <div class="field">
        <span class="field-label">Total Invoices:</span>
        <span class="field-value">${invoices.length}</span>
      </div>
    </div>
  </div>

  ${invoiceSectionsHtml}

  ${ledgerHtml}

  <div class="grand-summary">
    <div class="grand-title">Session Summary — All Terms</div>
    <div class="grand-row">
      <span class="grand-label">Total Amount Due</span>
      <span class="grand-value" style="color: #0f172a;">${kobotoNaira(grandDue)}</span>
    </div>
    <div class="grand-row">
      <span class="grand-label">Total Amount Paid</span>
      <span class="grand-value" style="color: #16a34a;">${kobotoNaira(grandPaid)}</span>
    </div>
    <div class="grand-divider"></div>
    <div class="grand-row">
      <span class="grand-label">Total Outstanding Balance</span>
      <span class="grand-value" style="color: ${grandOutstanding > 0 ? '#dc2626' : '#16a34a'};">
        ${grandOutstanding > 0 ? kobotoNaira(grandOutstanding) : 'FULLY SETTLED'}
      </span>
    </div>
  </div>

  <div class="footer">
    Generated by ${sName} Financial Reconciliation System &middot; Powered by EduPay
  </div>

  <script>
    window.onload = function() {
      setTimeout(function() {
        window.print();
      }, 500);
    };
  </script>
</body>
</html>
    `;

    printWindow.document.open();
    printWindow.document.write(htmlContent);
    printWindow.document.close();
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
            variant="outline"
            onClick={handlePrintSessionReceipt}
            disabled={invoices.length === 0}
            className="rounded-xl border-slate-200 text-slate-700 hover:bg-slate-50 h-10 px-4 font-semibold text-xs gap-2"
          >
            <Printer className="h-4 w-4" />
            Print Session Receipt
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
                  allInvoices={invoices}
                  payments={payments}
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
