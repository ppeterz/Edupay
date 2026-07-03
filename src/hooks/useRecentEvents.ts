// ──────────────────────────────────────────────
// EduPay — useRecentEvents Hook (Stage 7)
// ──────────────────────────────────────────────
// Real-time listener for the latest fee reconciliation logs.
// Order is descending by creation date. Requires composite index:
//   reconciliation_events: schoolId (asc), createdAt (desc)

'use client';

import { useEffect, useState } from 'react';
import {
  collection,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
} from 'firebase/firestore';
import { getFirebaseDb } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';
import type { ReconciliationEvent } from '@/types';

export function useRecentEvents(count = 10) {
  const { user } = useAuth();
  const [events, setEvents] = useState<ReconciliationEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    const db = getFirebaseDb();

    const q = query(
      collection(db, 'reconciliation_events'),
      where('schoolId', '==', user.uid),
      orderBy('createdAt', 'desc'),
      limit(count)
    );

    const unsub = onSnapshot(
      q,
      (snap) => {
        const eventList = snap.docs.map((d) => d.data() as ReconciliationEvent);
        setEvents(eventList);
        setLoading(false);
      },
      (err) => {
        console.error('[useRecentEvents] Firestore listener error:', err);
        setError(err.message);
        setLoading(false);
      }
    );

    return () => unsub();
  }, [user, count]);

  return { events, loading, error };
}
