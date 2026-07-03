// ──────────────────────────────────────────────
// EduPay — StudentBalanceSummary Component (Stage 7)
// ──────────────────────────────────────────────
// Renders the balance summaries (outstanding and credit) along with a real-time
// payment timeline history for a specific student.

'use client';

import { useEffect, useState } from 'react';
import { collection, query, where, orderBy, onSnapshot } from 'firebase/firestore';
import { getFirebaseDb } from '@/lib/firebase';
import { kobotoNaira } from '@/lib/constants';
import { paymentStatusColor } from '@/lib/dashboard-helpers';
import type { Student, Payment } from '@/types';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { AlertCircle, CreditCard, HelpCircle } from 'lucide-react';

interface StudentBalanceSummaryProps {
  student: Student;
}

export function StudentBalanceSummary({ student }: StudentBalanceSummaryProps) {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const db = getFirebaseDb();
    
    // Explicitly filter by schoolId to align with security rules, and omit orderBy
    // to bypass the requirement for creating a new composite index.
    const q = query(
      collection(db, 'payments'),
      where('schoolId', '==', student.schoolId),
      where('studentId', '==', student.id)
    );

    const unsub = onSnapshot(
      q,
      (snap) => {
        const list = snap.docs.map((d) => d.data() as Payment);
        // Sort descending by creation date client-side
        list.sort((a, b) => {
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        });
        setPayments(list);
        setLoading(false);
      },
      (err) => {
        console.error('[StudentBalanceSummary] Payments listener error:', err);
        setLoading(false);
      }
    );

    return () => unsub();
  }, [student.id]);

  return (
    <div className="space-y-6">
      {/* Balances Card */}
      <Card className="border-slate-200 shadow-sm">
        <CardHeader className="pb-3 border-b border-slate-100">
          <h3 className="text-sm font-semibold text-slate-900">Ledger Balances</h3>
        </CardHeader>
        <CardContent className="pt-5 space-y-4">
          {/* Outstanding Balance */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Outstanding Balance
            </p>
            {student.outstandingBalance > 0 ? (
              <p className="mt-1 font-mono text-xl font-bold text-red-600 tabular-nums">
                {kobotoNaira(student.outstandingBalance)}
              </p>
            ) : (
              <p className="mt-1 text-base font-semibold text-emerald-600">
                Paid
              </p>
            )}
          </div>

          {/* Credit Balance */}
          {student.creditBalance > 0 && (
            <div className="rounded-lg border border-blue-100 bg-blue-50/50 px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-blue-600">
                Available Wallet Credit
              </p>
              <p className="mt-1 font-mono text-xl font-bold text-blue-700 tabular-nums">
                {kobotoNaira(student.creditBalance)}
              </p>
              <p className="mt-1 text-[11px] text-blue-600">
                Will be automatically applied to clear future school fee invoices.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Payment Timeline Feed */}
      <Card className="border-slate-200 shadow-sm">
        <CardHeader className="pb-3 border-b border-slate-100">
          <h3 className="text-sm font-semibold text-slate-900">Payment Timeline</h3>
        </CardHeader>
        <CardContent className="pt-5">
          {loading ? (
            <div className="space-y-4">
              {Array.from({ length: 2 }).map((_, idx) => (
                <div key={idx} className="flex gap-4 animate-pulse">
                  <div className="w-8 h-8 rounded-full bg-slate-100" />
                  <div className="flex-1 space-y-1.5 py-1">
                    <div className="h-4 w-1/4 rounded bg-slate-100" />
                    <div className="h-3 w-1/2 rounded bg-slate-50" />
                  </div>
                </div>
              ))}
            </div>
          ) : payments.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-slate-50">
                <CreditCard className="h-5 w-5 text-slate-400" />
              </div>
              <p className="text-sm text-slate-500 font-medium">
                No payments recorded for this student
              </p>
              <p className="text-xs text-slate-400 mt-1 max-w-[200px]">
                Incoming virtual account payments will display here in real-time.
              </p>
            </div>
          ) : (
            <div className="relative pl-6 border-l border-slate-100 space-y-6">
              {payments.map((pay) => {
                const badge = paymentStatusColor(pay.paymentStatus);
                const date = new Date(pay.processedAt ?? pay.createdAt);
                
                return (
                  <div key={pay.id} className="relative">
                    {/* Circle Node indicator */}
                    <span className="absolute -left-[31px] top-1.5 flex h-4.5 w-4.5 items-center justify-center rounded-full border-2 border-white bg-slate-200">
                      <span className={`h-2.5 w-2.5 rounded-full ${
                        pay.paymentStatus === 'processed' ? 'bg-emerald-500' :
                        pay.paymentStatus === 'pending' ? 'bg-amber-500' :
                        pay.paymentStatus === 'failed' ? 'bg-red-500' : 'bg-slate-400'
                      }`} />
                    </span>

                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="text-xs font-semibold text-slate-900">
                          Payment Received
                        </p>
                        <p className="text-[11px] text-slate-400 mt-0.5">
                          {date.toLocaleDateString('en-NG', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </p>
                        <p className="font-mono text-[10px] text-slate-500 mt-1 truncate max-w-[140px] md:max-w-xs">
                          ID: {pay.transactionId}
                        </p>
                      </div>

                      <div className="text-right space-y-1">
                        <p className="font-mono text-sm font-semibold tabular-nums text-slate-900">
                          {kobotoNaira(pay.amount)}
                        </p>
                        <span className={`inline-flex items-center rounded border px-1.5 py-0.5 text-[9px] font-medium capitalize ${badge.bg} ${badge.text}`}>
                          {badge.label}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
