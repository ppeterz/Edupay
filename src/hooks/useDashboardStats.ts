// ──────────────────────────────────────────────
// EduPay — useDashboardStats Hook (Stage 7)
// ──────────────────────────────────────────────
// Client-side hook for real-time dashboard analytics.
// Uses three parallel Firestore onSnapshot listeners to dynamically
// aggregate metrics for students, invoices, and payments.

'use client';

import { useEffect, useState } from 'react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { getFirebaseDb } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';
import type { Student, Invoice, Payment, DashboardStats } from '@/types';
import { computeDashboardStats } from '@/lib/dashboard-helpers';

export function useDashboardStats() {
  const { user } = useAuth();
  const [students, setStudents] = useState<Student[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const db = getFirebaseDb();

    let loadedCount = 0;
    const markLoaded = () => {
      loadedCount++;
      if (loadedCount >= 3) {
        setLoading(false);
      }
    };

    // 1. Listen to students list (excluding soft-deleted)
    const unsubStudents = onSnapshot(
      query(collection(db, 'students'), where('schoolId', '==', user.uid)),
      (snap) => {
        const studentList = snap.docs
          .map((d) => d.data() as Student)
          .filter((s) => !s.deletedAt);
        setStudents(studentList);
        markLoaded();
      },
      (err) => {
        console.error('[useDashboardStats] Students listener error:', err);
        markLoaded();
      }
    );

    // 2. Listen to invoices
    const unsubInvoices = onSnapshot(
      query(collection(db, 'invoices'), where('schoolId', '==', user.uid)),
      (snap) => {
        const invoiceList = snap.docs.map((d) => d.data() as Invoice);
        setInvoices(invoiceList);
        markLoaded();
      },
      (err) => {
        console.error('[useDashboardStats] Invoices listener error:', err);
        markLoaded();
      }
    );

    // 3. Listen to payments
    const unsubPayments = onSnapshot(
      query(collection(db, 'payments'), where('schoolId', '==', user.uid)),
      (snap) => {
        const paymentList = snap.docs.map((d) => d.data() as Payment);
        setPayments(paymentList);
        markLoaded();
      },
      (err) => {
        console.error('[useDashboardStats] Payments listener error:', err);
        markLoaded();
      }
    );

    return () => {
      unsubStudents();
      unsubInvoices();
      unsubPayments();
    };
  }, [user]);

  const stats: DashboardStats = computeDashboardStats(students, invoices, payments);

  return {
    stats,
    students, // Expose raw students list for join resolutions downstream
    loading,
  };
}
