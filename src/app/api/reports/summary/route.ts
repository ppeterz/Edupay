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

    // 3. Fetch all invoices for the school
    step = 'fetch-invoices';
    const invoicesSnap = await adminDb
      .collection('invoices')
      .where('schoolId', '==', schoolId)
      .get();

    const invoices = invoicesSnap.docs.map((d) => d.data() as Invoice);

    // 4. Fetch all students for the school
    step = 'fetch-students';
    const studentsSnap = await adminDb
      .collection('students')
      .where('schoolId', '==', schoolId)
      .get();

    const students = studentsSnap.docs.map((d) => d.data() as Student);

    // 5. Return lists to the client
    return Response.json({
      invoices,
      students,
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
