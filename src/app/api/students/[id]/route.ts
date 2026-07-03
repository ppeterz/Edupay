// ──────────────────────────────────────────────
// EduPay — Student Detail API Route (GET, PATCH, DELETE)
// ──────────────────────────────────────────────
// GET: fetch a single student by ID
// PATCH: update allowed fields (class only — name and accountRef are immutable)
// DELETE: soft-delete (never hard delete — payment history must be preserved)

import { NextRequest } from 'next/server';
import { verifyAuthToken, unauthorized, badRequest } from '@/lib/auth-helpers';
import { getAdminDb } from '@/lib/firebase-admin';
import type { Student } from '@/types';

export const runtime = 'nodejs';

interface RouteContext {
  params: Promise<{ id: string }>;
}

// ── GET — fetch single student ───────────────

export async function GET(request: NextRequest, context: RouteContext) {
  const decoded = await verifyAuthToken(request);
  if (!decoded) return unauthorized();

  const { id } = await context.params;
  const adminDb = getAdminDb();

  const doc = await adminDb.collection('students').doc(id).get();
  if (!doc.exists) {
    return Response.json({ error: 'Student not found' }, { status: 404 });
  }

  const student = doc.data() as Student;

  // Ownership check
  if (student.schoolId !== decoded.uid) {
    return Response.json({ error: 'Forbidden' }, { status: 403 });
  }

  return Response.json({ student }, { status: 200 });
}

// ── PATCH — update allowed fields ────────────

export async function PATCH(request: NextRequest, context: RouteContext) {
  const decoded = await verifyAuthToken(request);
  if (!decoded) return unauthorized();

  const { id } = await context.params;
  const adminDb = getAdminDb();

  // Fetch and verify ownership
  const doc = await adminDb.collection('students').doc(id).get();
  if (!doc.exists) {
    return Response.json({ error: 'Student not found' }, { status: 404 });
  }

  const student = doc.data() as Student;
  if (student.schoolId !== decoded.uid) {
    return Response.json({ error: 'Forbidden' }, { status: 403 });
  }

  // Parse body
  let body: { studentClass?: string };
  try {
    body = await request.json();
  } catch {
    return badRequest('Invalid request body');
  }

  const { studentClass } = body;
  if (
    !studentClass ||
    typeof studentClass !== 'string' ||
    !studentClass.trim()
  ) {
    return badRequest('studentClass is required');
  }

  // Only class is updatable — fullName and virtualAccountReference are IMMUTABLE
  await adminDb
    .collection('students')
    .doc(id)
    .update({ class: studentClass.trim() });

  return Response.json({ updated: true }, { status: 200 });
}

// ── DELETE — soft delete ─────────────────────

export async function DELETE(request: NextRequest, context: RouteContext) {
  const decoded = await verifyAuthToken(request);
  if (!decoded) return unauthorized();

  const { id } = await context.params;
  const adminDb = getAdminDb();

  // Fetch and verify ownership
  const doc = await adminDb.collection('students').doc(id).get();
  if (!doc.exists) {
    return Response.json({ error: 'Student not found' }, { status: 404 });
  }

  const student = doc.data() as Student;
  if (student.schoolId !== decoded.uid) {
    return Response.json({ error: 'Forbidden' }, { status: 403 });
  }

  // NEVER hard delete — payment history must be preserved
  await adminDb
    .collection('students')
    .doc(id)
    .update({ deletedAt: new Date().toISOString() });

  return Response.json({ deleted: true }, { status: 200 });
}
