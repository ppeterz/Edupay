// ──────────────────────────────────────────────
// EduPay — usePayments Hook (Stage 7)
// ──────────────────────────────────────────────
// Real-time listener for all school payment records. Exposes
// list of payments, error/loading states, and an async getter
// to retrieve audit reconciliation events on demand.

'use client';

import { useEffect, useState } from 'react';
import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  getDocs,
  limit,
} from 'firebase/firestore';
import { getFirebaseDb } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';
import type { Payment, ReconciliationEvent } from '@/types';

export function usePayments() {
  const { user } = useAuth();
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    const db = getFirebaseDb();

    const q = query(
      collection(db, 'payments'),
      where('schoolId', '==', user.uid),
      orderBy('createdAt', 'desc')
    );

    const unsub = onSnapshot(
      q,
      (snap) => {
        const paymentList = snap.docs.map((d) => d.data() as Payment);
        setPayments(paymentList);
        setLoading(false);
      },
      (err) => {
        console.error('[usePayments] Firestore listener error:', err);
        setError(err.message);
        setLoading(false);
      }
    );

    return () => unsub();
  }, [user]);

  return { payments, loading, error };
}

/**
 * Fetches the matching ReconciliationEvent for a given payment ID.
 * Primarily used by detail sheets or slide panels for audit review.
 */
export async function fetchReconciliationEventForPayment(
  paymentId: string,
  schoolId: string
): Promise<ReconciliationEvent | null> {
  const db = getFirebaseDb();
  const q = query(
    collection(db, 'reconciliation_events'),
    where('schoolId', '==', schoolId),
    where('paymentId', '==', paymentId),
    limit(1)
  );
  
  const snap = await getDocs(q);
  if (snap.empty) return null;
  return snap.docs[0].data() as ReconciliationEvent;
}
