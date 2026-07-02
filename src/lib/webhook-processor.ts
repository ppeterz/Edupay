// ──────────────────────────────────────────────
// EduPay — Webhook Processor (Stage 5)
// ──────────────────────────────────────────────
// Async processing after the webhook handler returns 200.
//
// Algorithm:
//   1. Idempotency check — skip if transactionId already in `payments`
//   2. Match student by virtualAccountReference (accountRef) — NEVER name/amount
//   3. Delegate to processPayment (stubbed until Stage 6)
//
// On any failure: write to `webhook_errors` collection (audit trail)

import { getAdminDb } from '@/lib/firebase-admin';
import type {
  NombaWebhookPayload,
  Student,
  WebhookLog,
  WebhookError,
} from '@/types';

// ── Public Entry Point ────────────────────────

export async function processWebhookAsync(
  payload: NombaWebhookPayload
): Promise<void> {
  const adminDb = getAdminDb();
  const { transactionId, accountRef, amount } = payload.data;

  try {
    // 1. Idempotency — was this transactionId already processed?
    const existingPayment = await adminDb
      .collection('payments')
      .where('transactionId', '==', transactionId)
      .limit(1)
      .get();

    if (!existingPayment.empty) {
      console.log(
        `[webhook] Duplicate transactionId ${transactionId} — skipping`
      );
      await patchWebhookLogStatus(transactionId, 'duplicate');
      return;
    }

    // 2. Find student by virtualAccountReference (accountRef)
    //    CRITICAL: Match by accountRef ONLY — never by name or amount
    const studentSnap = await adminDb
      .collection('students')
      .where('virtualAccountReference', '==', accountRef)
      .limit(1)
      .get();

    if (studentSnap.empty) {
      const msg = `No student found with virtualAccountReference = ${accountRef}`;
      console.error(`[webhook] ${msg}`);

      // Write structured error to webhook_errors
      const errorId = adminDb.collection('webhook_errors').doc().id;
      const errorDoc: WebhookError = {
        id: errorId,
        accountRef,
        transactionId,
        payload,
        error: msg,
        createdAt: new Date().toISOString(),
      };
      await adminDb.collection('webhook_errors').doc(errorId).set(errorDoc);
      await patchWebhookLogStatus(transactionId, 'error');
      return;
    }

    const student = studentSnap.docs[0].data() as Student;

    // 3. Delegate to payment engine
    await processPayment(student, payload, amount);
  } catch (err) {
    // Catch-all: log and mark error without crashing the process
    console.error(
      `[webhook] Unhandled error processing transactionId ${transactionId}:`,
      err
    );
    try {
      await patchWebhookLogStatus(transactionId, 'error');
    } catch {
      // Silently swallow — we already logged the main error
    }
  }
}

// ── Helpers ───────────────────────────────────

/**
 * Update the status field on the existing webhook_log entry for this transactionId.
 * Uses a query rather than a doc ID since we write the log before returning 200
 * (and thus know the transactionId but not the generated doc ID here).
 */
async function patchWebhookLogStatus(
  transactionId: string,
  status: WebhookLog['status']
): Promise<void> {
  const adminDb = getAdminDb();
  const snap = await adminDb
    .collection('webhook_log')
    .where('transactionId', '==', transactionId)
    .limit(1)
    .get();

  if (!snap.empty) {
    await snap.docs[0].ref.update({ status });
  }
}

// ── Payment Engine Stub (replaced in Stage 6) ─

/**
 * Stub for the full payment reconciliation engine (Stage 6).
 * Logs the intent and marks the webhook log as processed.
 */
async function processPayment(
  student: Student,
  payload: NombaWebhookPayload,
  amount: number
): Promise<void> {
  console.log(
    `[webhook] Processing payment ${payload.data.transactionId} ` +
      `for student "${student.fullName}" (${student.id}), ` +
      `amount: ${amount} kobo`
  );

  // TODO: Stage 6 — full reconciliation logic goes here:
  //   - Find matching unpaid/partial invoices
  //   - Apply payment to line items by priority order
  //   - Write Payment doc + ReconciliationEvent
  //   - Update student.outstandingBalance / creditBalance

  await patchWebhookLogStatus(payload.data.transactionId, 'processed');
}
