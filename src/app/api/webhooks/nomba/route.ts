// ──────────────────────────────────────────────
// EduPay — Nomba Webhook Receiver
// POST /api/webhooks/nomba
// ──────────────────────────────────────────────
//
// Execution order (non-negotiable):
//   1. Read raw body as TEXT — do NOT parse JSON yet
//   2. Verify Nomba HMAC-SHA256 signature (base64, field-based hashing payload)
//   3. Parse JSON
//   4. Write `webhook_log` entry (status = 'received') — synchronous audit trail
//   5. Return 200 immediately
//   6. after() → processWebhookAsync(payload)   ← async, does NOT block response
//
// Signature algorithm per: https://developer.nomba.com/docs/api-basics/webhook

import { NextRequest, NextResponse, after } from 'next/server';
import crypto from 'crypto';
import { getAdminDb } from '@/lib/firebase-admin';
import { processWebhookAsync } from '@/lib/webhook-processor';
import { buildHashingPayload } from '@/lib/webhook-helpers';
import { nairaToKobo } from '@/lib/constants';
import type { NombaWebhookPayload, WebhookLog } from '@/types';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  // ── 1. Read raw body ──────────────────────────
  const rawBody = await request.text();

  // ── 2. Verify Nomba signature ─────────────────
  const signatureHeader = request.headers.get('nomba-signature');
  const timestampHeader = request.headers.get('nomba-timestamp');

  if (!signatureHeader || !timestampHeader) {
    return NextResponse.json(
      { error: 'Missing signature headers' },
      { status: 401 }
    );
  }

  const webhookSecret = process.env.NOMBA_WEBHOOK_SECRET || '';
  if (!webhookSecret) {
    console.error('[webhook] NOMBA_WEBHOOK_SECRET is not set');
    return NextResponse.json(
      { error: 'Webhook secret not configured' },
      { status: 500 }
    );
  }

  // ── 3. Parse JSON ─────────────────────────────
  let payload: NombaWebhookPayload;
  try {
    payload = JSON.parse(rawBody) as NombaWebhookPayload;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  // ── Verify HMAC-SHA256 (base64) ───────────────
  try {
    const hashingPayload = buildHashingPayload(payload, timestampHeader);
    const computedSignature = crypto
      .createHmac('sha256', webhookSecret)
      .update(hashingPayload)
      .digest('base64'); // BASE64, not hex

    const sigBuffer = Buffer.from(signatureHeader, 'base64');
    const computedBuffer = Buffer.from(computedSignature, 'base64');

    if (
      sigBuffer.length !== computedBuffer.length ||
      !crypto.timingSafeEqual(sigBuffer, computedBuffer)
    ) {
      console.warn('[webhook] Signature mismatch — rejecting request');
      return NextResponse.json(
        { error: 'Invalid signature' },
        { status: 401 }
      );
    }
  } catch (err) {
    console.error('[webhook] Signature verification error:', err);
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }

  // ── Extract key fields ────────────────────────
  const txn = payload.data.transaction;
  const transactionId = txn.transactionId;
  const aliasAccountReference = txn.aliasAccountReference ?? '';
  const amountInKobo = nairaToKobo(txn.transactionAmount);

  if (!transactionId) {
    return NextResponse.json(
      { error: 'Missing required field: data.transaction.transactionId' },
      { status: 400 }
    );
  }

  // ── 4. Write audit log synchronously BEFORE returning 200 ──
  try {
    const adminDb = getAdminDb();
    const logId = adminDb.collection('webhook_log').doc().id;

    // Fetch matching student to get schoolId for scoping
    let schoolId = '';
    if (aliasAccountReference) {
      const studentSnap = await adminDb
        .collection('students')
        .where('virtualAccountReference', '==', aliasAccountReference)
        .limit(1)
        .get();
      if (!studentSnap.empty) {
        schoolId = studentSnap.docs[0].data().schoolId || '';
      }
    }

    const logEntry: WebhookLog & { schoolId?: string } = {
      id: logId,
      transactionId,
      aliasAccountReference,
      amount: amountInKobo,
      status: 'received',
      rawPayload: payload,
      createdAt: new Date().toISOString(),
      schoolId,
    };

    await adminDb.collection('webhook_log').doc(logId).set(logEntry);
  } catch (err) {
    // Non-fatal — we still return 200 to Nomba so they don't retry
    console.error('[webhook] Failed to write audit log:', err);
  }

  // ── 5. Return 200 IMMEDIATELY ─────────────────
  // ── 6. Async processing via after() ───────────
  after(async () => {
    await processWebhookAsync(payload);
  });

  return NextResponse.json({ received: true }, { status: 200 });
}
