// ──────────────────────────────────────────────
// EduPay — StudentBalanceSummary Component (Stage 7)
// ──────────────────────────────────────────────
// Renders the balance summaries (outstanding and credit) along with a real-time
// payment timeline history for a specific student.

'use client';

import { useEffect, useState } from 'react';
import { collection, doc, query, where, orderBy, onSnapshot } from 'firebase/firestore';
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

  // Live balance state — overrides prop values once the listener fires
  const [liveOutstanding, setLiveOutstanding] = useState<number>(student.outstandingBalance);
  const [liveCredit, setLiveCredit] = useState<number>(student.creditBalance);

  // Sync prop values when parent re-fetches a different student
  useEffect(() => {
    setLiveOutstanding(student.outstandingBalance);
    setLiveCredit(student.creditBalance);
  }, [student.id, student.outstandingBalance, student.creditBalance]);

  // Real-time listener on the student document for instant balance updates
  useEffect(() => {
    const db = getFirebaseDb();
    const studentRef = doc(db, 'students', student.id);

    const unsub = onSnapshot(
      studentRef,
      (snap) => {
        if (snap.exists()) {
          const data = snap.data();
          if (typeof data.outstandingBalance === 'number') {
            setLiveOutstanding(data.outstandingBalance);
          }
          if (typeof data.creditBalance === 'number') {
            setLiveCredit(data.creditBalance);
          }
        }
      },
      (err) => {
        console.error('[StudentBalanceSummary] Student doc listener error:', err);
      }
    );

    return () => unsub();
  }, [student.id]);

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
  }, [student.id, student.schoolId]);

  return (
    <div className="space-y-6">
      {/* Balances Card */}
      <Card className="border-slate-200/50 shadow-sm rounded-[24px]">
        <CardHeader className="pb-3 border-b border-slate-100/70">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">Account Balance</h3>
        </CardHeader>
        <CardContent className="pt-5 space-y-4">
          {/* Outstanding Balance */}
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Outstanding Balance
            </p>
            {liveOutstanding > 0 ? (
              <p className="mt-1.5 font-mono text-2xl font-extrabold text-red-650 tracking-tight">
                {kobotoNaira(liveOutstanding)}
              </p>
            ) : (
              <p className="mt-1.5 text-base font-bold text-emerald-600">
                Fully Paid
              </p>
            )}
          </div>

          {/* Credit Balance */}
          {liveCredit > 0 && (
            <div className="rounded-2xl border border-blue-100 bg-blue-50/50 px-4 py-3">
              <p className="text-[10px] font-bold uppercase tracking-wider text-blue-600">
                Credit Balance (Overpayment)
              </p>
              <p className="mt-1 font-mono text-xl font-extrabold text-blue-700 tracking-tight">
                {kobotoNaira(liveCredit)}
              </p>
              <p className="mt-1 text-[10px] text-blue-600 font-semibold">
                Will be automatically used to pay future school fees.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Payment Timeline Feed */}
      <Card className="border-slate-200/50 shadow-sm rounded-[24px]">
        <CardHeader className="pb-3 border-b border-slate-100/70">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">Payment Timeline</h3>
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
            <div className="flex flex-col items-center justify-center py-10 text-center select-none">
              <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-slate-50 border border-slate-100">
                <CreditCard className="h-5 w-5 text-slate-400" />
              </div>
              <p className="text-xs text-slate-550 font-bold">
                No payments logged yet
              </p>
              <p className="text-[10px] text-slate-400 mt-1 max-w-[200px] leading-relaxed">
                Incoming payments will show up here as they come in.
              </p>
            </div>
          ) : (
            <div className="relative pl-5 border-l border-slate-100 space-y-6">
              {payments.map((pay) => {
                const badge = paymentStatusColor(pay.paymentStatus);
                const date = new Date(pay.processedAt ?? pay.createdAt);
                
                return (
                  <div key={pay.id} className="relative">
                    {/* Circle Node indicator */}
                    <span className="absolute -left-[28.5px] top-1 flex h-4.5 w-4.5 items-center justify-center rounded-full border-2 border-white bg-slate-200">
                      <span className={`h-2.5 w-2.5 rounded-full ${
                        pay.paymentStatus === 'processed' ? 'bg-emerald-500' :
                        pay.paymentStatus === 'pending' ? 'bg-amber-500' :
                        pay.paymentStatus === 'failed' ? 'bg-red-500' : 'bg-slate-400'
                      }`} />
                    </span>

                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-xs font-bold text-slate-950">
                          Payment Received
                        </p>
                        <p className="text-[10px] text-slate-400 mt-0.5 font-medium">
                          {date.toLocaleDateString('en-NG', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </p>
                        <p className="font-mono text-[9px] text-slate-400 mt-1 truncate max-w-[140px] md:max-w-[160px]">
                          ID: {pay.transactionId}
                        </p>
                      </div>

                      <div className="text-right space-y-1 shrink-0">
                        <p className="font-mono text-xs font-bold tabular-nums text-slate-950">
                          {kobotoNaira(pay.amount)}
                        </p>
                        <span className={`inline-flex items-center rounded-full px-2 py-0.2 text-[9px] font-bold capitalize ${badge.bg} ${badge.text}`}>
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
