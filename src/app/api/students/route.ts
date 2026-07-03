// ──────────────────────────────────────────────
// EduPay — Students List API Route (GET)
// ──────────────────────────────────────────────
// Returns all non-deleted students for the authenticated school.

import { NextRequest } from 'next/server';
import { verifyAuthToken, unauthorized } from '@/lib/auth-helpers';
import { getAdminDb } from '@/lib/firebase-admin';
import type { Student } from '@/types';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  // 1. Verify auth token
  const decoded = await verifyAuthToken(request);
  if (!decoded) return unauthorized();

  const adminDb = getAdminDb();

  // 2. Query Firestore for this school's students
  const snapshot = await adminDb
    .collection('students')
    .where('schoolId', '==', decoded.uid)
    .orderBy('fullName', 'asc')
    .get();

  // 3. Filter out soft-deleted students
  const students: Student[] = snapshot.docs
    .map((doc) => doc.data() as Student)
    .filter((s) => !s.deletedAt);

  // 4. Return
  return Response.json({ students }, { status: 200 });
}
