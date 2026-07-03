// ──────────────────────────────────────────────
// EduPay — Firebase Admin SDK (Server-Side Only)
// ──────────────────────────────────────────────
// This module must only be imported from server-side code
// (API routes, server components, server actions).
// Do NOT import from client components.
//
// Uses lazy initialisation to avoid crashing at module-evaluation
// time during `next build` when env vars aren't available.

import {
  initializeApp,
  getApps,
  cert,
  type App,
} from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import { getStorage } from 'firebase-admin/storage';

let _app: App | null = null;

function ensureApp(): App {
  if (_app) return _app;

  if (getApps().length > 0) {
    _app = getApps()[0];
    return _app;
  }

  const privateKey = process.env.FIREBASE_PRIVATE_KEY;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;

  if (!privateKey || !clientEmail || !projectId) {
    throw new Error(
      'Missing Firebase Admin env vars. Set FIREBASE_PRIVATE_KEY, ' +
        'FIREBASE_CLIENT_EMAIL, and NEXT_PUBLIC_FIREBASE_PROJECT_ID in .env.local'
    );
  }

  _app = initializeApp({
    credential: cert({
      projectId,
      clientEmail,
      // .env files store \n as literal chars — replace with real newlines
      privateKey: privateKey.replace(/\\n/g, '\n'),
    }),
  });

  return _app;
}

/** Lazily initialised Firebase Admin App */
export function getAdminApp() {
  return ensureApp();
}

/** Lazily initialised Firestore instance */
export function getAdminDb() {
  return getFirestore(ensureApp());
}

/** Lazily initialised Auth instance */
export function getAdminAuth() {
  return getAuth(ensureApp());
}

/** Lazily initialised Storage instance */
export function getAdminStorage() {
  return getStorage(ensureApp());
}
