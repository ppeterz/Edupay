# Deployment Checklist

## Environment variables (Vercel → Settings → Environment Variables)

### Firebase (client)
- `NEXT_PUBLIC_FIREBASE_API_KEY`
- `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
- `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
- `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` (Legacy/Optional. Firebase Storage is not active as receipts use Cloudinary with an on-demand fallback PDF generation route)
- `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
- `NEXT_PUBLIC_FIREBASE_APP_ID`

### Firebase (server, Admin SDK) — real pattern
- `FIREBASE_PRIVATE_KEY` (PEM format, literal \n newlines, unescaped at runtime)
- `FIREBASE_CLIENT_EMAIL`

### Nomba — LIVE credentials
- `NOMBA_CLIENT_ID` = `e5e85b13-f560-4643-814e-c87435dbbc15`
- `NOMBA_CLIENT_SECRET` = (live private key)
- `NOMBA_ACCOUNT_ID` = `f666ef9b-888e-4799-85ce-acb505b28023` (PARENT — always in the accountId header, every call)
- `NOMBA_SUB_ACCOUNT_ID` = `a08cd98c-4fed-4eda-be0f-243728041e9b` (REQUIRED — virtual account creation fails without it)
- `NOMBA_WEBHOOK_SECRET` = `NombaHackathon2026` (shared hackathon signing key)

### Cloudinary (optional)
- `CLOUDINARY_CLOUD_NAME`
- `CLOUDINARY_API_KEY`
- `CLOUDINARY_API_SECRET`
Currently invalid (401) — system falls back to on-demand PDF generation at `/api/receipts/[id]` automatically. Fixing this is optional polish.

## Firestore composite indexes required
Confirm ALL FOUR exist (auto-generated links appear in Vercel logs on first query — click once each):
- `invoices`: `studentId` (asc), `status` (asc), `createdAt` (asc)
- `invoices`: `schoolId` (asc), `term` (asc), `session` (asc)
- `reconciliation_events`: `schoolId` (asc), `createdAt` (desc)
- `payments`: `schoolId` (asc), `createdAt` (desc)

## Firestore security rules
Deployed via: `firebase deploy --only firestore:rules`
All writes to `students`/`invoices`/`payments`/`reconciliation_events`/`alerts`/`webhook_log`/`webhook_errors`/`bulk_invoice_runs` are Admin-SDK-only (`write: false` in rules) — confirmed no client-side writes exist anywhere in the codebase.

## Webhook registration
URL: `https://edupay-five.vercel.app/api/webhooks/nomba`
Confirmed working against real bank transfers (live money test passed, including multi-invoice spillover with credit generation). Only resubmit via the hackathon Google Form if this domain changes.

## Known limitations (documented, not blockers)
- Rate limiting on the webhook endpoint is best-effort in-memory — does not hold under truly distributed load across multiple Vercel container instances.
- Cloudinary is not currently authenticating — on-demand PDF fallback is the effective primary path for receipts.
- Four pre-fix student accounts (ADM002-005) have permanently dead virtual accounts from before the sub-account scoping discovery — soft-deleted, kept in Firestore for audit history but hidden from the dashboard.
