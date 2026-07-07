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
import { Card, CardContent } from '@/components/ui/card';

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
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col gap-1 pb-4 border-b border-slate-100">
        <h1 className="text-2xl font-extrabold text-slate-950 tracking-tight">Payments</h1>
        <p className="text-xs text-slate-500 font-medium mt-0.5">
          Track all payments received and how they were applied to student fees.
        </p>
      </div>

      {/* Filter / Search Bar */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search by student name or payment reference..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-4 text-xs font-semibold text-slate-900 placeholder:text-slate-400 focus:border-slate-300 focus:ring-1 focus:ring-slate-300/30 focus:outline-none transition-all shadow-sm"
          />
        </div>

        {/* Filter Dropdown */}
        <div className="flex items-center gap-3.5">
          <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">
            <SlidersHorizontal className="h-3.5 w-3.5 text-slate-450" />
            <span>Filter Status</span>
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-44 h-10 rounded-xl border-slate-200 bg-white font-semibold text-xs text-slate-700 shadow-sm">
              <SelectValue placeholder="All" />
            </SelectTrigger>
            <SelectContent className="rounded-xl">
              <SelectItem value="all" className="text-xs font-semibold">All Payments</SelectItem>
              <SelectItem value="processed" className="text-xs font-semibold">Processed</SelectItem>
              <SelectItem value="pending" className="text-xs font-semibold">Pending</SelectItem>
              <SelectItem value="failed" className="text-xs font-semibold">Failed</SelectItem>
              <SelectItem value="duplicate" className="text-xs font-semibold">Duplicate</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Main Tables Ledger Card */}
      <Card className="rounded-[28px] border-slate-200/50 bg-white shadow-sm overflow-hidden">
        {error ? (
          <div className="flex flex-col items-center justify-center py-14 px-4 text-center select-none">
            <AlertCircle className="h-9 w-9 text-red-500 mb-2" />
            <h3 className="text-xs font-bold text-slate-900">Failed to load payments</h3>
            <p className="text-[10px] text-slate-500 font-semibold mt-0.5">{error}</p>
          </div>
        ) : isLoading ? (
          <div className="p-5 space-y-4">
            {Array.from({ length: 4 }).map((_, idx) => (
              <Skeleton key={idx} className="h-12 w-full rounded-2xl" />
            ))}
          </div>
        ) : filteredPayments.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 px-4 text-center select-none">
            <Info className="h-9 w-9 text-slate-300 mb-2" />
            <h3 className="text-xs font-bold text-slate-905">No payments found</h3>
            <p className="text-[10px] text-slate-450 font-semibold mt-0.5 max-w-[280px]">
              No payments match your query. Incoming bank transfers will appear automatically.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-slate-50/50 border-b border-slate-100">
                <TableRow>
                  <TableHead className="text-[10px] font-bold text-slate-500 uppercase tracking-wider pl-6">Student</TableHead>
                  <TableHead className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Payment ID</TableHead>
                  <TableHead className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Status</TableHead>
                  <TableHead className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Date Received</TableHead>
                  <TableHead className="text-[10px] font-bold text-slate-500 uppercase tracking-wider text-right pr-6">Amount</TableHead>
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
                      className="cursor-pointer hover:bg-slate-50/40 transition-colors border-b border-slate-100/50 last:border-b-0"
                    >
                      {/* Student Info */}
                      <TableCell className="py-3.5 pl-6">
                        <div className="font-bold text-slate-900 text-sm tracking-tight">{studentName}</div>
                        {student && (
                          <div className="text-[10px] text-slate-455 font-semibold mt-0.5">
                            Class: {student.class} &middot; Adm No: {student.admissionNumber}
                          </div>
                        )}
                      </TableCell>

                      {/* Transaction ID truncated */}
                      <TableCell className="py-3.5">
                        <div className="flex items-center gap-1.5 font-mono text-xs text-slate-600 font-semibold">
                          <span>{pay.transactionId.slice(0, 12)}...</span>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-6 w-6 rounded-lg text-slate-400 hover:text-slate-900 hover:bg-slate-100/70"
                            onClick={(e) => {
                              e.stopPropagation();
                              copyToClipboard(pay.transactionId, pay.id);
                            }}
                          >
                            {copiedId === pay.id ? (
                              <Check className="h-3 w-3 text-emerald-600" />
                            ) : (
                              <Copy className="h-3 w-3" />
                            )}
                          </Button>
                        </div>
                      </TableCell>

                      {/* Status badge */}
                      <TableCell className="py-3.5">
                        <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${statusBadge.bg} ${statusBadge.text}`}>
                          {statusBadge.label}
                        </span>
                      </TableCell>

                      {/* Date */}
                      <TableCell className="py-3.5 text-slate-500 font-semibold text-xs">
                        {displayDate.toLocaleDateString('en-NG', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </TableCell>

                      {/* Amount Tabular right-aligned */}
                      <TableCell className="py-3.5 text-right font-mono font-extrabold tracking-tight text-slate-950 pr-6">
                        {kobotoNaira(pay.amount)}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </Card>

      {/* ── Detailed Reconciliation Dialog ── */}
      <Dialog open={!!selectedPayment} onOpenChange={(open) => !open && setSelectedPayment(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg rounded-2xl p-6 border-slate-100 bg-white">
          <DialogHeader className="pb-3 border-b border-slate-100">
            <DialogTitle className="text-slate-950 text-lg font-bold">Payment Details</DialogTitle>
            <DialogDescription className="text-slate-400 text-xs font-semibold">
              See how this payment was applied to the student&apos;s fees.
            </DialogDescription>
          </DialogHeader>

          {selectedPayment && (
            <div className="space-y-6 pt-4">
              {/* Header Details Grid */}
              <div className="grid grid-cols-2 gap-4 rounded-2xl bg-[#e2edf8]/25 p-4 border border-blue-100/30">
                <div>
                  <p className="text-[9px] font-bold uppercase tracking-wider text-slate-500">
                    Payment ID
                  </p>
                  <p className="font-mono text-xs font-bold text-slate-900 mt-0.5 truncate max-w-[180px]">
                    {selectedPayment.transactionId}
                  </p>
                </div>
                <div>
                  <p className="text-[9px] font-bold uppercase tracking-wider text-slate-500">
                    Payment Reference
                  </p>
                  <p className="font-mono text-xs font-bold text-slate-900 mt-0.5 truncate max-w-[180px]">
                    {selectedPayment.transactionReference || 'N/A'}
                  </p>
                </div>
              </div>

              {/* Loader or Event detail block */}
              {loadingEvent ? (
                <div className="space-y-3 py-4">
                  <Skeleton className="h-6 w-full rounded-xl" />
                  <Skeleton className="h-20 w-full rounded-[18px]" />
                </div>
              ) : reconEvent ? (
                <div className="space-y-5">
                  {/* Event type and Summary Balances */}
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Payment Type</p>
                      <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide mt-1.5 ${eventTypeColor(reconEvent.eventType).bg} ${eventTypeColor(reconEvent.eventType).text}`}>
                        {eventTypeColor(reconEvent.eventType).label}
                      </span>
                    </div>
                    {reconEvent.creditGenerated > 0 && (
                      <div className="text-right">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-blue-600">Overpayment Credit</p>
                        <p className="text-sm font-extrabold text-blue-700 font-mono mt-1 tabular-nums">
                          + {kobotoNaira(reconEvent.creditGenerated)}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Ledger Transition Details */}
                  <div className="grid grid-cols-3 gap-4 border-y border-slate-100 py-4">
                    <div>
                      <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">
                        Paid Amount
                      </p>
                      <p className="font-mono text-sm font-extrabold text-slate-950 mt-0.5 tabular-nums">
                        {kobotoNaira(reconEvent.amountReceived)}
                      </p>
                    </div>
                    <div>
                      <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">
                        Applied to Fees
                      </p>
                      <p className="font-mono text-sm font-extrabold text-slate-950 mt-0.5 tabular-nums">
                        {kobotoNaira(reconEvent.amountAllocated)}
                      </p>
                    </div>
                    <div>
                      <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">
                        Balance Change
                      </p>
                      <div className="flex items-center gap-1 mt-0.5 font-mono text-[11px] font-bold text-slate-950">
                        <p className="text-slate-400 line-through">
                          ₦{reconEvent.outstandingBefore / 100}
                        </p>
                        <span className="text-slate-400 font-normal">&rarr;</span>
                        <p className="text-red-650">
                          ₦{reconEvent.outstandingAfter / 100}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50/45 p-4">
                  <TrendingDown className="h-5 w-5 text-amber-600 flex-shrink-0" />
                  <div>
                    <h4 className="text-xs font-bold text-amber-850">No fee adjustment recorded</h4>
                    <p className="text-[11px] text-amber-700 leading-relaxed font-semibold mt-0.5">
                      This payment was received but not applied to any outstanding fees (e.g., stored as credit for future use).
                    </p>
                  </div>
                </div>
              )}

              {/* Allocations breakdown */}
              <div className="space-y-2">
                <h4 className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Payment Breakdown
                </h4>
                {selectedPayment.allocations && selectedPayment.allocations.length > 0 ? (
                  <div className="rounded-2xl border border-slate-100 overflow-hidden">
                    <Table>
                      <TableHeader className="bg-slate-50/50">
                        <TableRow>
                          <TableHead className="text-[10px] font-bold uppercase py-2.5 pl-4">Line Item</TableHead>
                          <TableHead className="text-[10px] font-bold uppercase text-right py-2.5 pr-4">Allocated Amount</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {selectedPayment.allocations.map((alloc, i) => (
                          <TableRow key={i} className="border-b border-slate-50 last:border-b-0">
                            <TableCell className="py-2.5 text-xs font-bold text-slate-700 pl-4">
                              {alloc.description}
                            </TableCell>
                            <TableCell className="py-2.5 text-right font-mono text-xs font-extrabold tabular-nums text-slate-950 pr-4">
                              {kobotoNaira(alloc.amountAllocated)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  <p className="text-xs text-slate-400 italic">No fee breakdown available.</p>
                )}
              </div>

              {/* Receipt actions footer */}
              <div className="flex items-center justify-between border-t border-slate-100 pt-5 mt-4">
                <span className="flex items-center gap-1.5 text-xs text-slate-500 font-semibold">
                  <Receipt className="h-4.5 w-4.5 text-slate-400" />
                  {selectedPayment.receiptUrl ? (
                    <span className="text-emerald-600 font-bold flex items-center gap-1">
                      Receipt available <FileCheck className="h-4 w-4" />
                    </span>
                  ) : (
                    <span>Receipt pending</span>
                  )}
                </span>
                {selectedPayment.receiptUrl && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="rounded-xl border-slate-200 text-slate-800 bg-white font-bold text-xs h-9 shadow-sm"
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
