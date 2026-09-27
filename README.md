# EduPay — Financial Reconciliation Infrastructure for Schools

EduPay is a production-hardened transaction engine and automated fee reconciliation platform designed for schools. It maps virtual bank accounts to students, handles multi-invoice allocation by line-item priority, carries forward overpayments as student credit, and automates receipt generation.

## Architecture

```
  Nomba Virtual Account (sub-account-scoped, LIVE credentials)
         ↓ parent sends real bank transfer
  Nomba Webhook (nomba-signature: HMAC-SHA256, base64, colon-joined field string)
         ↓
  Webhook Handler (/api/webhooks/nomba) — verify signature → write webhook_log → return 200
         ↓ (Next.js after() API)
  Webhook Processor — idempotency check → match student by virtualAccountReference
         ↓
  Transaction Engine — fetch ALL active invoices (oldest-first), deterministic payment id (txn_{transactionId})
         ↓
  Reconciliation Engine (pure function, reconcileMultiple) — allocate by line-item priority,
  spill across MULTIPLE invoices in one payment, carry forward leftover credit for overpayment
         ↓
  Firestore atomic transaction — every touched invoice, student balance, payment record, all in one runTransaction()
         ↓
  Reconciliation Event (audit trail) + Receipt (Cloudinary with on-demand fallback) + Live Dashboard
```

## Key Design Decisions (For Judges)

- **Reliable Student Matching**: Students are matched to payments using a permanent `virtualAccountReference` (which corresponds to Nomba's `aliasAccountReference`). Matching never relies on brittle student names or exact transfer amounts.
- **Multi-Invoice Spillover**: A single webhook payment can settle multiple open invoices across different terms, oldest-first, with correct per-invoice breakdown. This is fully validated against 13 synthetic integration scenarios and a real bank transfer.
- **Line-Item Priority Allocation**: Allocates payments down to individual invoice items based on their priority (e.g. Tuition (P1) is settled before Transport (P3)).
- **Overpayment Credit Handling**: Any excess payment amount is saved as `creditBalance` on the student ledger and is automatically carried forward to apply to their next invoice.
- **Deterministic Idempotency**: Payment documents are written with a deterministic ID: `txn_${transactionId}`. This guarantees that duplicate webhook deliveries are discarded at the database level.
- **On-Demand Receipt Fallback**: Receipt PDFs are uploaded to Cloudinary, but if Cloudinary is unavailable, they regenerate on-demand at a public, stateless endpoint (`/api/receipts/[id]`).
- **Nomba API Sub-account Discovery**: We discovered and resolved a undocumented Nomba API subtlety during development: virtual accounts must be created using the sub-account-scoped endpoint (`POST /accounts/virtual/{subAccountId}`) rather than the parent endpoint, otherwise payment notifications will not fire. This resolved integration issues faced by multiple teams.

- ## For Reviewers — Demo Access

**Live app:** https://edupay-five.vercel.app

**Login credentials:**
- Email: `peterdamilola45@gmail.com`
- Password: `pelumi12`

No signup needed — log in directly with the credentials above to view the
full admin dashboard, students, invoices, payments, and reports.

⚠️ **Important — this is a LIVE production account with real data, not a
sandbox.** This account has genuine Nomba virtual accounts and has processed
real bank transfers as proof of concept. Please do **not** submit the
"Request Withdrawal" form on the Withdrawals page — this would trigger a
real bank transfer out of our live Nomba sub-account. Everything else is
completely safe to click through and explore.

### What to look at

- **Dashboard** (`/dashboard`) — real-time stats and activity feed
- **Students** (`/dashboard/students`) — click into "kay alaba" to see a
  student with real, live-verified payment history
- **Payments** (`/dashboard/payments`) — click any row to see the full
  allocation breakdown (which fee line items were funded and how much)
- **Reports** (`/dashboard/reports`) — collection rate and class-level
  breakdown
- **Invoicing** (`/dashboard/invoices`) — bulk class invoicing tool

### API keys / test accounts

No additional API keys are needed to review the deployed app — the demo
login above gives full access to everything. If you want to inspect the
codebase's integration with Nomba's API directly, our full documentation
(architecture, real API discoveries, and testing performed) is in
`EduPay-Project-Documentation.md` at the repository root.

## Setup

1. **Clone the repository** and install dependencies:
   ```bash
   npm install
   ```
2. **Configure Environment Variables**:
   Copy `.env.example` to `.env.local` and fill in the values described in [DEPLOY_CHECKLIST.md](file:///c:/Users/DELL/Desktop/edupay/DEPLOY_CHECKLIST.md).
3. **Start local development**:
   ```bash
   npm run dev
   ```

## Testing

EduPay features a robust, multi-tier testing framework:
- **Unit Tests**: Run unit tests covering fee reconciliation logic and multi-invoice allocations:
  ```bash
  npm test
  ```
- **Integration Tests**: Execute the 13-scenario integration test suite simulating full-pipeline payments against a real local Firestore database (requires local dev server running):
  ```bash
  node scratch/test-stage6-integration.js
  ```
- **Live Webhook Test**: Send a self-signed payment webhook payload to verify signature checking and processing against the live Vercel deployment:
  ```bash
  node scratch/test-live-webhook.js
  ```
- **Final Smoke Test**: Verify endpoint statuses, public receipt endpoints, health checks, and end-to-end webhook processing:
  ```bash
  node scratch/final-smoke-test.js https://edupay-five.vercel.app
  ```

## Deployment

1. **Deploy to Vercel**: Import the repository and set up environment variables in Vercel settings.
2. **Deploy Firestore Security Rules**:
   Ensure security rules are deployed using the Firebase CLI to prevent client-side writes:
   ```bash
   firebase deploy --only firestore:rules
   ```

## API Reference

- `POST /api/webhooks/nomba` (Public) - Main Nomba payment webhook. Verifies HMAC signature, registers transaction, and reconciles payments asynchronously.
- `POST /api/webhooks/nomba/test` (Dev Only) - Helper to post self-signed webhook payloads locally.
- `GET /api/health` (Public) - Simple service health check.
- `GET /api/receipts/[id]` (Public) - Serves generated PDF receipts for parents.
- `GET /api/students` (Auth Required) - Lists all non-deleted students.
- `POST /api/students/create` (Auth Required) - Adds a student and provisions a Nomba virtual account.
- `DELETE /api/students/[id]` (Auth Required) - Soft-deletes a student doc, preserving payments for audit history.
- `GET /api/invoices` (Auth Required) - Retrieves invoices.
- `POST /api/invoices/create` (Auth Required) - Creates a new invoice.
- `PATCH /api/invoices/[id]/merge` (Auth Required) - Performs invoice template merging/reconciliation.
- `POST /api/invoices/bulk-create` (Auth Required) - Generates invoices in bulk.
- `GET /api/reports/summary` (Auth Required) - Retrives financial summaries.
- `GET /api/alerts` (Auth Required) - Returns system activity alerts.

## Demo Narrative

> "Most teams built a payment dashboard. We built financial infrastructure.
> Every student has a permanent, sub-account-scoped virtual account. When a parent transfers funds, our transaction engine identifies the student via `virtualAccountReference`, runs reconciliation across ALL their open invoices (oldest-first), allocates by line-item priority, carries forward any overpayment as credit, and generates a receipt, all triggered by a single verified webhook. We've proven this against real bank transfers on live Nomba infrastructure, including a single payment settling two separate terms' invoices in one transaction."
