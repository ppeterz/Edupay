// ──────────────────────────────────────────────
// EduPay — Class Invoice Review API Route (GET)
// ──────────────────────────────────────────────
// Fetches all students in a class and their existing invoices for a term/session.

import { NextRequest } from 'next/server';
import { verifyAuthToken, unauthorized, badRequest } from '@/lib/auth-helpers';
import { getAdminDb } from '@/lib/firebase-admin';
import type { Student, Invoice } from '@/types';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  // 1. Verify auth token
  const decoded = await verifyAuthToken(request);
  if (!decoded) return unauthorized();

  const schoolId = decoded.uid;
  const adminDb = getAdminDb();

  // 2. Parse query parameters
  const { searchParams } = new URL(request.url);
  const className = searchParams.get('class');
  const term = searchParams.get('term');
  const session = searchParams.get('session');

  if (!className) return badRequest('class query parameter is required');
  if (!term) return badRequest('term query parameter is required');
  if (!session) return badRequest('session query parameter is required');

  // 3. Fetch students in this class
  const studentsSnapshot = await adminDb
    .collection('students')
    .where('schoolId', '==', schoolId)
    .where('class', '==', className)
    .get();

  const students = studentsSnapshot.docs
    .map((doc) => doc.data() as Student)
    .filter((s) => !s.deletedAt);

  if (students.length === 0) {
    return Response.json({ students: [] });
  }

  // 4. Fetch invoices for these students (in chunks of 30 due to Firestore 'in' limit)
  const studentIds = students.map((s) => s.id);
  const invoicePromises = [];
  const chunkSize = 30;

  for (let i = 0; i < studentIds.length; i += chunkSize) {
    const chunk = studentIds.slice(i, i + chunkSize);
    invoicePromises.push(
      adminDb
        .collection('invoices')
        .where('schoolId', '==', schoolId)
        .where('term', '==', term)
        .where('session', '==', session)
        .where('studentId', 'in', chunk)
        .get()
    );
  }

  const invoiceSnapshots = await Promise.all(invoicePromises);
  const invoices = invoiceSnapshots.flatMap((snap) =>
    snap.docs.map((doc) => doc.data() as Invoice)
  );

  // 5. Match students to invoices
  const results = students.map((student) => {
    const existingInvoice = invoices.find((inv) => inv.studentId === student.id);
    return {
      studentId: student.id,
      studentName: student.fullName,
      class: student.class,
      existingInvoice: existingInvoice || null,
    };
  });

  return Response.json({ students: results });
}
