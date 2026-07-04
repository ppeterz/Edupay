// ──────────────────────────────────────────────
// EduPay — Payments Auditing Page (Stage 7)
// ──────────────────────────────────────────────
// Real-time table displaying all processed virtual account payments for the school.
// Supports filtering, detail sheet modal overlays, fee allocation breakdowns,
// outstanding balance adjustments, and developer webhook auditing records.

'use client';

import { useEffect, useState } from 'react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { getFirebaseDb } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';
import { usePayments, fetchReconciliationEventForPayment } from '@/hooks/usePayments';
import { paymentStatusColor, eventTypeColor } from '@/lib/dashboard-helpers';
import { kobotoNaira } from '@/lib/constants';
import type { Student, Payment, ReconciliationEvent } from '@/types';

// UI components
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';

import {
  Copy,
  Check,
  Search,
  SlidersHorizontal,
  ExternalLink,
  Receipt,
  FileCheck,
  TrendingDown,
  Info,
  AlertCircle,
} from 'lucide-react';


export default function PaymentsPage() {
  const { user } = useAuth();
  const { payments, loading: paymentsLoading, error } = usePayments();

  // Local state
  const [students, setStudents] = useState<Student[]>([]);
  const [studentsLoading, setStudentsLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  
  // Modal / Detailed Audit Panel State
  const [selectedPayment, setSelectedPayment] = useState<Payment | null>(null);
  const [reconEvent, setReconEvent] = useState<ReconciliationEvent | null>(null);
  const [loadingEvent, setLoadingEvent] = useState(false);

  // ── 1. Fetch Students in real-time for Client-side Joins ──
  useEffect(() => {
    if (!user) return;
    const db = getFirebaseDb();
    const q = query(
      collection(db, 'students'),
      where('schoolId', '==', user.uid)
    );

    const unsub = onSnapshot(
      q,
      (snap) => {
        setStudents(snap.docs.map((d) => d.data() as Student));
        setStudentsLoading(false);
      },
      (err) => {
        console.error('[PaymentsPage] Failed to fetch students reference list:', err);
        setStudentsLoading(false);
      }
    );

    return () => unsub();
  }, [user]);

  // ── 2. Handle Details Sheet Trigger ──
  async function handleRowClick(payment: Payment) {
    setSelectedPayment(payment);
    setReconEvent(null);
    setLoadingEvent(true);
    try {
      const event = await fetchReconciliationEventForPayment(payment.id, payment.schoolId);
      setReconEvent(event);
    } catch (err) {
      console.error('[PaymentsPage] Error loading audit event details:', err);
    } finally {
      setLoadingEvent(false);
    }
  }

  // ── 3. Copy Handler ──
  async function copyToClipboard(text: string, id: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 1500);
    } catch {
      // Ignore fallback
    }
  }

  // ── 4. Apply Filters & Searches Client-side ──
  const filteredPayments = payments.filter((pay) => {
    // A. Filter by PaymentStatus Select dropdown
    if (statusFilter !== 'all' && pay.paymentStatus !== statusFilter) {
      return false;
    }

    // B. Search by Transaction ID, Reference, or Joined Student Name
    if (searchQuery.trim()) {
      const queryLower = searchQuery.toLowerCase();
      const student = students.find((s) => s.id === pay.studentId);
      const studentName = student ? student.fullName.toLowerCase() : '';
      const txnId = pay.transactionId.toLowerCase();
      const ref = pay.transactionReference.toLowerCase();

      return (
        studentName.includes(queryLower) ||
        txnId.includes(queryLower) ||
        ref.includes(queryLower)
      );
    }

    return true;
  });

  const isLoading = paymentsLoading || studentsLoading;

  return (
    <div className="p-6 lg:p-8 space-y-6">
      {/* Page Header */}
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold text-slate-900">Payments</h1>
        <p className="text-sm text-slate-500">
          Review virtual account incoming triggers and allocations.
        </p>
      </div>

      {/* Filter / Search Bar */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search by student, transaction ID, or session reference..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-md border border-slate-200 bg-white py-2 pl-9 pr-4 text-sm text-slate-900 placeholder:text-slate-400 focus:border-slate-900 focus:outline-none"
          />
        </div>

        {/* Filter Dropdown */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
            <SlidersHorizontal className="h-3.5 w-3.5" />
            <span>Filter Status:</span>
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-40 border-slate-200 bg-white text-slate-700">
              <SelectValue placeholder="All" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Payments</SelectItem>
              <SelectItem value="processed">Processed</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="failed">Failed</SelectItem>
              <SelectItem value="duplicate">Duplicate</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Main Tables Ledger Card */}
      <div className="rounded-lg border border-slate-200 bg-white shadow-sm overflow-hidden">
        {error ? (
          <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
            <AlertCircle className="h-10 w-10 text-red-500 mb-2" />
            <h3 className="text-sm font-semibold text-slate-900">Failed to load payments</h3>
            <p className="text-xs text-slate-400 mt-1">{error}</p>
          </div>
        ) : isLoading ? (
          <div className="p-6 space-y-4">
            {Array.from({ length: 5 }).map((_, idx) => (
              <Skeleton key={idx} className="h-12 w-full rounded" />
            ))}
          </div>
        ) : filteredPayments.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
            <Info className="h-10 w-10 text-slate-300 mb-2" />
            <h3 className="text-sm font-semibold text-slate-800">No payment logs found</h3>
            <p className="text-xs text-slate-400 mt-1 max-w-[280px]">
              No payments match your current query. Payments stream automatically as they arrive.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-slate-50/75 border-b border-slate-100">
                <TableRow>
                  <TableHead className="text-xs font-semibold text-slate-500">Student</TableHead>
                  <TableHead className="text-xs font-semibold text-slate-500">Transaction ID</TableHead>
                  <TableHead className="text-xs font-semibold text-slate-500">Status</TableHead>
                  <TableHead className="text-xs font-semibold text-slate-500">Date Received</TableHead>
                  <TableHead className="text-xs font-semibold text-slate-500 text-right">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredPayments.map((pay) => {
                  const student = students.find((s) => s.id === pay.studentId);
                  const studentName = student ? student.fullName : `ID: ${pay.studentId.slice(0, 8)}...`;
                  const statusBadge = paymentStatusColor(pay.paymentStatus);
                  const displayDate = new Date(pay.processedAt ?? pay.createdAt);

                  return (
                    <TableRow
                      key={pay.id}
                      onClick={() => handleRowClick(pay)}
                      className="cursor-pointer hover:bg-slate-50/50 transition-colors"
                    >
                      {/* Student Info */}
                      <TableCell className="py-3.5">
                        <div className="font-semibold text-slate-900 text-sm">{studentName}</div>
                        {student && (
                          <div className="text-[11px] text-slate-400 mt-0.5">
                            Class: {student.class} &bull; Adm: {student.admissionNumber}
                          </div>
                        )}
                      </TableCell>

                      {/* Transaction ID truncated */}
                      <TableCell className="py-3.5">
                        <div className="flex items-center gap-1.5 font-mono text-xs text-slate-600">
                          <span>{pay.transactionId.slice(0, 16)}...</span>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-6 w-6 text-slate-400 hover:text-slate-900"
                            onClick={(e) => {
                              e.stopPropagation(); // prevent row click opening dialog
                              copyToClipboard(pay.transactionId, pay.id);
                            }}
                          >
                            {copiedId === pay.id ? (
                              <Check className="h-3 w-3 text-green-600" />
                            ) : (
                              <Copy className="h-3 w-3" />
                            )}
                          </Button>
                        </div>
                      </TableCell>

                      {/* Status badge */}
                      <TableCell className="py-3.5">
                        <span className={`inline-flex items-center rounded border px-2 py-0.5 text-xs font-medium capitalize ${statusBadge.bg} ${statusBadge.text}`}>
                          {statusBadge.label}
                        </span>
                      </TableCell>

                      {/* Date */}
                      <TableCell className="py-3.5 text-slate-500 text-xs">
                        {displayDate.toLocaleDateString('en-NG', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </TableCell>

                      {/* Amount Tabular right-aligned */}
                      <TableCell className="py-3.5 text-right font-mono font-semibold tabular-nums text-slate-900">
                        {kobotoNaira(pay.amount)}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      {/* ── Detailed Reconciliation Dialog ── */}
      <Dialog open={!!selectedPayment} onOpenChange={(open) => !open && setSelectedPayment(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg border-slate-200 bg-white">
          <DialogHeader>
            <DialogTitle className="text-slate-900 text-base font-bold">Reconciliation Details</DialogTitle>
            <DialogDescription className="text-slate-400 text-xs">
              Transaction audit records and tuition breakdown allocations.
            </DialogDescription>
          </DialogHeader>

          {selectedPayment && (
            <div className="space-y-6 pt-2">
              {/* Header Details */}
              <div className="grid grid-cols-2 gap-4 rounded-lg bg-slate-50 p-4 border border-slate-100">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                    Transaction ID
                  </p>
                  <p className="font-mono text-xs font-semibold text-slate-800 mt-0.5 truncate max-w-[180px]">
                    {selectedPayment.transactionId}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                    Session Reference
                  </p>
                  <p className="font-mono text-xs font-semibold text-slate-800 mt-0.5 truncate max-w-[180px]">
                    {selectedPayment.transactionReference || 'N/A'}
                  </p>
                </div>
              </div>

              {/* Loader for event matching */}
              {loadingEvent ? (
                <div className="space-y-3 py-4">
                  <Skeleton className="h-6 w-full" />
                  <Skeleton className="h-20 w-full" />
                </div>
              ) : reconEvent ? (
                <div className="space-y-5">
                  {/* Event type and Summary Balances */}
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-semibold text-slate-500">Event Action</p>
                      <span className={`inline-flex items-center rounded border px-2 py-0.5 text-xs font-semibold capitalize mt-1 ${eventTypeColor(reconEvent.eventType).bg} ${eventTypeColor(reconEvent.eventType).text}`}>
                        {eventTypeColor(reconEvent.eventType).label}
                      </span>
                    </div>
                    {reconEvent.creditGenerated > 0 && (
                      <div className="text-right">
                        <p className="text-xs font-semibold text-slate-500">Wallet Credit Generated</p>
                        <p className="text-sm font-bold text-blue-600 font-mono mt-1 tabular-nums">
                          + {kobotoNaira(reconEvent.creditGenerated)}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Ledger Transition Details */}
                  <div className="grid grid-cols-3 gap-4 border-y border-slate-100 py-3.5">
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                        Paid Amount
                      </p>
                      <p className="font-mono text-sm font-bold text-slate-900 mt-0.5 tabular-nums">
                        {kobotoNaira(reconEvent.amountReceived)}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                        Allocated
                      </p>
                      <p className="font-mono text-sm font-bold text-slate-900 mt-0.5 tabular-nums">
                        {kobotoNaira(reconEvent.amountAllocated)}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                        Outstanding Adjustment
                      </p>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <p className="font-mono text-xs text-slate-400 line-through">
                          {reconEvent.outstandingBefore / 100}
                        </p>
                        <span className="text-xs text-slate-400">&rarr;</span>
                        <p className="font-mono text-xs font-semibold text-slate-900">
                          {reconEvent.outstandingAfter / 100}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-3 rounded-lg border border-amber-100 bg-amber-50/50 p-4">
                  <TrendingDown className="h-5 w-5 text-amber-600 flex-shrink-0" />
                  <div>
                    <h4 className="text-xs font-semibold text-amber-800">No matching audit event</h4>
                    <p className="text-[11px] text-amber-700 mt-0.5">
                      This transaction was processed without creating a direct balance adjustment record (e.g. duplicate webhook logs).
                    </p>
                  </div>
                </div>
              )}

              {/* Allocations breakdown */}
              <div>
                <h4 className="text-xs font-semibold text-slate-900 mb-2 uppercase tracking-wider">
                  Tuition Allocation Breakdown
                </h4>
                {selectedPayment.allocations && selectedPayment.allocations.length > 0 ? (
                  <div className="rounded-md border border-slate-100 overflow-hidden">
                    <Table>
                      <TableHeader className="bg-slate-50/75">
                        <TableRow>
                          <TableHead className="text-[10px] font-semibold py-2">Line Item</TableHead>
                          <TableHead className="text-[10px] font-semibold text-right py-2">Allocated</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {selectedPayment.allocations.map((alloc, i) => (
                          <TableRow key={i}>
                            <TableCell className="py-2.5 text-xs text-slate-700">
                              {alloc.description}
                            </TableCell>
                            <TableCell className="py-2.5 text-right font-mono text-xs tabular-nums text-slate-900">
                              {kobotoNaira(alloc.amountAllocated)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  <p className="text-xs text-slate-400 italic">No direct tuition lines allocated.</p>
                )}
              </div>

              {/* Receipt actions footer */}
              <div className="flex items-center justify-between border-t border-slate-100 pt-4 mt-2">
                <span className="flex items-center gap-1.5 text-xs text-slate-500">
                  <Receipt className="h-4 w-4 text-slate-400" />
                  {selectedPayment.receiptUrl ? (
                    <span className="text-green-600 font-semibold flex items-center gap-1">
                      Receipt generated <FileCheck className="h-3.5 w-3.5" />
                    </span>
                  ) : (
                    <span>Receipt not yet generated</span>
                  )}
                </span>
                {selectedPayment.receiptUrl && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="border-slate-200 text-slate-700 bg-white"
                    onClick={() => window.open(selectedPayment.receiptUrl, '_blank')}
                  >
                    <span>View Receipt</span>
                    <ExternalLink className="ml-1.5 h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
