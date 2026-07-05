// ──────────────────────────────────────────────
// EduPay — Next.js Proxy (replaces middleware.ts)
// ──────────────────────────────────────────────
// Protects /dashboard and /api routes.
// Runs on the Node.js runtime — but cannot use firebase-admin
// (avoid heavy init on every request at the proxy layer).
// Auth is checked via the auth-token cookie set by AuthContext.

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Always allow public paths through
  const publicPaths = ['/login', '/register', '/api/webhooks', '/api/receipts', '/api/health'];
  const isPublic = publicPaths.some((path) => pathname.startsWith(path));
  if (isPublic) return NextResponse.next();

  // Protect /dashboard and /api routes (except webhooks)
  if (pathname.startsWith('/dashboard') || pathname.startsWith('/api')) {
    const token = request.cookies.get('auth-token')?.value;

    if (!token) {
      // Redirect to login for page routes
      if (pathname.startsWith('/dashboard')) {
        return NextResponse.redirect(new URL('/login', request.url));
      }
      // Return 401 for API routes
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/dashboard/:path*', '/api/:path*'],
};
