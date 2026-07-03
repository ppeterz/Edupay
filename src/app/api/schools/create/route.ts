// ──────────────────────────────────────────────
// EduPay — School Create API Route
// ──────────────────────────────────────────────

import { NextRequest } from 'next/server';
import { getAdminAuth, getAdminDb } from '@/lib/firebase-admin';
import type { School } from '@/types';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  const adminAuth = getAdminAuth();
  const adminDb = getAdminDb();

  // 1. Extract and verify Bearer token
  const authHeader = request.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const token = authHeader.split('Bearer ')[1];

  let decoded;
  try {
    decoded = await adminAuth.verifyIdToken(token);
  } catch {
    return Response.json({ error: 'Invalid token' }, { status: 401 });
  }

  // 2. Parse and validate body
  let body: { schoolName?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const { schoolName } = body;
  if (!schoolName || typeof schoolName !== 'string' || !schoolName.trim()) {
    return Response.json({ error: 'schoolName is required' }, { status: 400 });
  }

  // 3. Check if school already exists
  const existing = await adminDb.collection('schools').doc(decoded.uid).get();
  if (existing.exists) {
    return Response.json(
      { error: 'School already registered' },
      { status: 409 }
    );
  }

  // 4. Create school document
  const school: School = {
    id: decoded.uid,
    name: schoolName.trim(),
    email: decoded.email ?? '',
    createdAt: new Date().toISOString(),
  };

  await adminDb.collection('schools').doc(decoded.uid).set(school);

  return Response.json({ school }, { status: 201 });
}
