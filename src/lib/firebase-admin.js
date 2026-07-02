"use strict";
// ──────────────────────────────────────────────
// EduPay — Firebase Admin SDK (Server-Side Only)
// ──────────────────────────────────────────────
// This module must only be imported from server-side code
// (API routes, server components, server actions).
// Do NOT import from client components.
//
// Uses lazy initialisation to avoid crashing at module-evaluation
// time during `next build` when env vars aren't available.
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAdminApp = getAdminApp;
exports.getAdminDb = getAdminDb;
exports.getAdminAuth = getAdminAuth;
const app_1 = require("firebase-admin/app");
const firestore_1 = require("firebase-admin/firestore");
const auth_1 = require("firebase-admin/auth");
let _app = null;
function ensureApp() {
    if (_app)
        return _app;
    if ((0, app_1.getApps)().length > 0) {
        _app = (0, app_1.getApps)()[0];
        return _app;
    }
    const privateKey = process.env.FIREBASE_PRIVATE_KEY;
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
    if (!privateKey || !clientEmail || !projectId) {
        throw new Error('Missing Firebase Admin env vars. Set FIREBASE_PRIVATE_KEY, ' +
            'FIREBASE_CLIENT_EMAIL, and NEXT_PUBLIC_FIREBASE_PROJECT_ID in .env.local');
    }
    _app = (0, app_1.initializeApp)({
        credential: (0, app_1.cert)({
            projectId,
            clientEmail,
            // .env files store \n as literal chars — replace with real newlines
            privateKey: privateKey.replace(/\\n/g, '\n'),
        }),
    });
    return _app;
}
/** Lazily initialised Firebase Admin App */
function getAdminApp() {
    return ensureApp();
}
/** Lazily initialised Firestore instance */
function getAdminDb() {
    return (0, firestore_1.getFirestore)(ensureApp());
}
/** Lazily initialised Auth instance */
function getAdminAuth() {
    return (0, auth_1.getAuth)(ensureApp());
}
