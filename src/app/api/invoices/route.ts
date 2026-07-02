// ──────────────────────────────────────────────
// EduPay — Invoices List API Route (GET)
// ──────────────────────────────────────────────
// Returns all invoices for a specific student.
// Query param: ?studentId=xxx (required)

import { NextRequest } from 'next/server';
import { verifyAuthToken, unauthorized, badRequest } from '@/lib/auth-helpers';
import { getAdminDb } from '@/lib/firebase-admin';
import type { Student, Invoice } from '@/types';

export async function GET(request: NextRequest) {
  // 1. Verify auth token
  const decoded = await verifyAuthToken(request);
  if (!decoded) return unauthorized();

  const adminDb = getAdminDb();

  // 2. Extract studentId from URL search params
  const { searchParams } = new URL(request.url);
  const studentId = searchParams.get('studentId');
  if (!studentId) {
    return badRequest('studentId query parameter is required');
  }

  // 3. Verify student belongs to this school
  const studentDoc = await adminDb.collection('students').doc(studentId).get();
  if (!studentDoc.exists) {
    return Response.json({ error: 'Student not found' }, { status: 404 });
  }
  const student = studentDoc.data() as Student;
  if (student.schoolId !== decoded.uid) {
    return Response.json({ error: 'Forbidden' }, { status: 403 });
  }

  // 4. Query invoices for this student
  const snapshot = await adminDb
    .collection('invoices')
    .where('studentId', '==', studentId)
    .orderBy('createdAt', 'desc')
    .get();

  const invoices: Invoice[] = snapshot.docs.map(
    (doc) => doc.data() as Invoice
  );

  // 5. Return
  return Response.json({ invoices }, { status: 200 });
}
