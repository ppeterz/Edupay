'use client';

// ──────────────────────────────────────────────
// EduPay — useInvoices Hook
// ──────────────────────────────────────────────
// Real-time Firestore listener for a student's invoices.
// Returns invoices sorted by createdAt descending (most recent first).
//
// IMPORTANT: The query MUST include schoolId == user.uid to satisfy
// Firestore Security Rules (which require schoolId ownership on reads).

import { useEffect, useState } from 'react';
import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
} from 'firebase/firestore';
import { getFirebaseDb, isFirebaseConfigured } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';
import type { Invoice } from '@/types';

export function useInvoices(studentId: string | undefined) {
  const { user } = useAuth();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!studentId || !user || !isFirebaseConfigured()) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLoading(false);
      return;
    }

    const db = getFirebaseDb();

    const q = query(
      collection(db, 'invoices'),
      where('studentId', '==', studentId),
      where('schoolId', '==', user.uid),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        setInvoices(snapshot.docs.map((doc) => doc.data() as Invoice));
        setLoading(false);
      },
      (err) => {
        setError(err.message);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [studentId, user]);

  return { invoices, loading, error };
}

