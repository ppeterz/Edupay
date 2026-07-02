// ──────────────────────────────────────────────
// EduPay — Server-side Auth Helpers
// ──────────────────────────────────────────────

import { getAdminAuth } from './firebase-admin';
import { NextRequest } from 'next/server';

/**
 * Verify the Bearer token from an incoming request.
 * Returns decoded uid + email on success, null on failure.
 */
export async function verifyAuthToken(
  request: NextRequest
): Promise<{ uid: string; email: string } | null> {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;

  const token = authHeader.split('Bearer ')[1];
  try {
    const decoded = await getAdminAuth().verifyIdToken(token);
    return { uid: decoded.uid, email: decoded.email ?? '' };
  } catch {
    return null;
  }
}

/** Standard 401 Unauthorized response */
export function unauthorized() {
  return Response.json({ error: 'Unauthorized' }, { status: 401 });
}

/** Standard 400 Bad Request response */
export function badRequest(message: string) {
  return Response.json({ error: message }, { status: 400 });
}
