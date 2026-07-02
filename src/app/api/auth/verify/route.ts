// ──────────────────────────────────────────────
// EduPay — Auth Verify API Route
// ──────────────────────────────────────────────

import { NextRequest } from 'next/server';
import { getAdminAuth } from '@/lib/firebase-admin';

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return Response.json({ error: 'Invalid token' }, { status: 401 });
  }

  const token = authHeader.split('Bearer ')[1];

  try {
    const decoded = await getAdminAuth().verifyIdToken(token);
    return Response.json(
      { uid: decoded.uid, email: decoded.email },
      { status: 200 }
    );
  } catch {
    return Response.json({ error: 'Invalid token' }, { status: 401 });
  }
}
