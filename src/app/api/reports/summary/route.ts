// ──────────────────────────────────────────────
// EduPay — Reports Summary API Route (Stage 8)
// ──────────────────────────────────────────────
// GET /api/reports/summary?term=X&session=Y
// Returns school-level and class-level collection statistics.

import { NextRequest } from 'next/server';
import { verifyAuthToken, unauthorized, badRequest } from '@/lib/auth-helpers';
import { getAdminDb } from '@/lib/firebase-admin';
import {
  buildClassReport,
  buildStudentReport,
  calculateCollectionRate,
} from '@/lib/report-helpers';
import type { Invoice, Student } from '@/types';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  let step = 'init';
  try {
    // 1. Verify auth token → schoolId
    step = 'auth';
    const decoded = await verifyAuthToken(request);
    if (!decoded) return unauthorized();

    const schoolId = decoded.uid;

    step = 'firestore-init';
    const adminDb = getAdminDb();

    // 2. Validate query params
    step = 'params';
    const { searchParams } = new URL(request.url);
    const term = searchParams.get('term');
    const session = searchParams.get('session');

    if (!term || !session) {
      return badRequest('Both "term" and "session" query parameters are required');
    }

    // 3. Fetch invoices for this school + term + session
    step = 'fetch-invoices';
    const invoicesSnap = await adminDb
      .collection('invoices')
      .where('schoolId', '==', schoolId)
      .where('term', '==', term)
      .where('session', '==', session)
      .get();

    const invoices = invoicesSnap.docs.map((d) => d.data() as Invoice);

    // 4. Fetch all students for the school
    step = 'fetch-students';
    const studentsSnap = await adminDb
      .collection('students')
      .where('schoolId', '==', schoolId)
      .get();

    const students = studentsSnap.docs.map((d) => d.data() as Student);

    // 5. Build report data
    step = 'build-report';
    const byClass = buildClassReport(invoices, students);
    const byStudent = buildStudentReport(invoices, students);

    const totalDue = byClass.reduce((sum, row) => sum + row.totalDue, 0);
    const totalCollected = byClass.reduce(
      (sum, row) => sum + row.totalCollected,
      0
    );
    const collectionRate = calculateCollectionRate(totalDue, totalCollected);

    // 6. Return response
    return Response.json({
      totalDue,
      totalCollected,
      collectionRate,
      byClass,
      byStudent,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const stack = err instanceof Error ? err.stack : undefined;
    console.error(`[reports-summary-api] Error at step="${step}":`, err);
    return Response.json(
      { error: `[${step}] ${message}`, stack },
      { status: 500 }
    );
  }
}
