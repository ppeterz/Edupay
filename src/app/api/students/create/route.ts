// ──────────────────────────────────────────────
// EduPay — Student Create API Route (POST)
// ──────────────────────────────────────────────
// Creates a student record with a Nomba virtual account.
// The accountRef is the PERMANENT identity link — it never changes.

import { NextRequest } from 'next/server';
import { verifyAuthToken, unauthorized, badRequest } from '@/lib/auth-helpers';
import { getAdminDb } from '@/lib/firebase-admin';
import { createVirtualAccount } from '@/lib/nomba';
import type { Student } from '@/types';

export async function POST(request: NextRequest) {
  // 1. Verify auth token
  const decoded = await verifyAuthToken(request);
  if (!decoded) return unauthorized();

  const adminDb = getAdminDb();

  // 2. Parse and validate body
  let body: {
    fullName?: string;
    studentClass?: string;
    admissionNumber?: string;
    schoolId?: string;
  };
  try {
    body = await request.json();
  } catch {
    return badRequest('Invalid request body');
  }

  const { fullName, studentClass, admissionNumber, schoolId } = body;

  if (!fullName || typeof fullName !== 'string' || !fullName.trim()) {
    return badRequest('fullName is required');
  }
  if (
    !studentClass ||
    typeof studentClass !== 'string' ||
    !studentClass.trim()
  ) {
    return badRequest('studentClass is required');
  }
  if (
    !admissionNumber ||
    typeof admissionNumber !== 'string' ||
    !admissionNumber.trim()
  ) {
    return badRequest('admissionNumber is required');
  }
  // Validate admission number format: alphanumeric + hyphens only
  if (!/^[a-zA-Z0-9-]+$/.test(admissionNumber.trim())) {
    return badRequest(
      'admissionNumber must contain only letters, numbers, and hyphens'
    );
  }
  if (!schoolId || schoolId !== decoded.uid) {
    return Response.json({ error: 'Forbidden' }, { status: 403 });
  }

  // 3. Check admission number uniqueness within the school
  const existing = await adminDb
    .collection('students')
    .where('schoolId', '==', schoolId)
    .where('admissionNumber', '==', admissionNumber.trim().toUpperCase())
    .where('deletedAt', '==', null)
    .get();

  if (!existing.empty) {
    return Response.json(
      { error: 'A student with this admission number already exists' },
      { status: 409 }
    );
  }

  // 4. Generate accountRef — PERMANENT identity link
  let accountRef = `${schoolId}-${admissionNumber}`
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-');

  // Max 50 characters (Nomba requirement) — truncate schoolId portion, keep admissionNumber
  if (accountRef.length > 50) {
    const admPart = admissionNumber.toLowerCase().replace(/[^a-z0-9-]/g, '-');
    const maxSchoolLen = 50 - admPart.length - 1; // -1 for the separator
    const schoolPart = schoolId
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, '-')
      .slice(0, maxSchoolLen);
    accountRef = `${schoolPart}-${admPart}`;
  }

  // 5. Call Nomba API to create virtual account
  let accountNumber: string;
  let bankName: string;

  try {
    const nombaResponse = await createVirtualAccount({
      accountName: fullName.trim(),
      accountRef: accountRef,
      // DO NOT set expectedAmount
    });

    accountNumber = nombaResponse.responseBody.accountNumber;
    bankName = nombaResponse.responseBody.bankName;
  } catch (nombaError) {
    console.error('Nomba virtual account creation failed:', nombaError);
    return Response.json(
      {
        error: 'Failed to create virtual account',
        details: String(nombaError),
      },
      { status: 502 }
    );
  }

  // 6. Only after Nomba succeeds — write student to Firestore
  const studentId = adminDb.collection('students').doc().id;
  const student: Student = {
    id: studentId,
    schoolId,
    fullName: fullName.trim(),
    class: studentClass.trim(),
    admissionNumber: admissionNumber.trim().toUpperCase(),
    virtualAccountNumber: accountNumber,
    virtualAccountReference: accountRef,
    virtualAccountBankName: bankName,
    outstandingBalance: 0,
    creditBalance: 0,
    createdAt: new Date().toISOString(),
    deletedAt: null,
  };

  await adminDb.collection('students').doc(studentId).set(student);

  // 7. Return created student
  return Response.json({ student }, { status: 201 });
}
