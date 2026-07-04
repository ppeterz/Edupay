'use client';

// ──────────────────────────────────────────────
// EduPay — useStudents Hook
// ──────────────────────────────────────────────
// Real-time Firestore listener for student data.
// Auto-updates when students are added, modified, or soft-deleted.

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
import type { Student } from '@/types';

export function useStudents() {
  const { user } = useAuth();
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user || !isFirebaseConfigured()) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLoading(false);
      return;
    }

    const db = getFirebaseDb();

    const q = query(
      collection(db, 'students'),
      where('schoolId', '==', user.uid),
      orderBy('fullName', 'asc')
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const data = snapshot.docs
          .map((doc) => doc.data() as Student)
          .filter((s) => !s.deletedAt); // exclude soft-deleted
        setStudents(data);
        setLoading(false);
      },
      (err) => {
        setError(err.message);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [user]);

  return { students, loading, error };
}
