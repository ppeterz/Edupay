// ──────────────────────────────────────────────
// EduPay — Webhook Processor (Stage 5 → 6)
// ──────────────────────────────────────────────
// Async processing after the webhook handler returns 200.
//
// Algorithm:
//   1. Idempotency check — skip if transactionId already in `payments`
//   2. Match student by virtualAccountReference (aliasAccountReference) — NEVER name/amount
//   3. Delegate to transaction engine (processPayment)
//
// On any failure: write to `webhook_errors` collection (audit trail)

import { getAdminDb } from '@/lib/firebase-admin';
import { processPayment } from '@/lib/transaction-engine';
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
  // ── Guard: only process incoming virtual-account payments ──
  // Nomba sends payout_success / payout_failed / payout_refund / payment_failed /
  // payment_reversal to the SAME webhook URL. Those payloads have no
  // aliasAccountReference and are NOT incoming student payments. Skip them
  // immediately to avoid false webhook_errors and unmatched_payment alerts.
  const eventType = payload.event_type;
  if (eventType !== 'payment_success') {
    console.log(
      `[webhook] Ignoring non-collection event_type="${eventType}" (requestId=${payload.requestId})`
    );
    return;
  }

  const adminDb = getAdminDb();
  const txn = payload.data.transaction;
  const transactionId = txn.transactionId;
  const aliasAccountReference = txn.aliasAccountReference ?? '';

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

    // 2. Find student by virtualAccountReference (aliasAccountReference)
    //    CRITICAL: Match by aliasAccountReference ONLY — never by name or amount
    if (!aliasAccountReference) {
      const msg = `Webhook payload missing aliasAccountReference for transactionId ${transactionId}`;
      console.error(`[webhook] ${msg}`);
      await writeWebhookError(aliasAccountReference, transactionId, payload, msg);
      await patchWebhookLogStatus(transactionId, 'error');
      return;
    }

    const studentSnap = await adminDb
      .collection('students')
      .where('virtualAccountReference', '==', aliasAccountReference)
      .limit(1)
      .get();

    if (studentSnap.empty) {
      const msg = `No student found with virtualAccountReference = ${aliasAccountReference}`;
      console.error(`[webhook] ${msg}`);
      await writeWebhookError(aliasAccountReference, transactionId, payload, msg);
      await patchWebhookLogStatus(transactionId, 'error');
      return;
    }

    const student = studentSnap.docs[0].data() as Student;

    // 3. Delegate to transaction engine (Stage 6)
    await processPayment(student, payload);

    // 4. Mark webhook log as processed
    await patchWebhookLogStatus(transactionId, 'processed');
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
 * Write a structured error document to the `webhook_errors` collection.
 */
async function writeWebhookError(
  aliasAccountReference: string,
  transactionId: string,
  payload: NombaWebhookPayload,
  error: string
): Promise<void> {
  const adminDb = getAdminDb();
  const errorId = adminDb.collection('webhook_errors').doc().id;
  const errorDoc: WebhookError = {
    id: errorId,
    aliasAccountReference,
    transactionId,
    payload,
    error,
    createdAt: new Date().toISOString(),
  };
  await adminDb.collection('webhook_errors').doc(errorId).set(errorDoc);
}

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
