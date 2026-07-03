// ──────────────────────────────────────────────
// EduPay — Nomba Webhook Receiver
// POST /api/webhooks/nomba
// ──────────────────────────────────────────────
//
// Execution order (non-negotiable):
//   1. Read raw body as TEXT — do NOT parse JSON yet
//   2. Verify HMAC-SHA256 signature → 401 if invalid
//   3. Parse JSON
//   4. Write `webhook_log` entry (status = 'received') — synchronous audit trail
//   5. Return 200 immediately
//   6. after() → processWebhookAsync(payload)   ← async, does NOT block response

import { NextRequest, NextResponse, after } from 'next/server';
import { createHmac, timingSafeEqual } from 'crypto';
import { getAdminDb } from '@/lib/firebase-admin';
import { processWebhookAsync } from '@/lib/webhook-processor';
import type { NombaWebhookPayload, WebhookLog } from '@/types';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  // ── 1. Read raw body ──────────────────────────
  const rawBody = await request.text();

  // ── 2. Verify HMAC-SHA256 signature ──────────
  const webhookSecret = process.env.NOMBA_WEBHOOK_SECRET || '';

  // Nomba may use either header name — try both
  const signature =
    request.headers.get('x-nomba-signature') ||
    request.headers.get('x-webhook-signature') ||
    '';

  if (!webhookSecret) {
    // Hard fail in all environments if the secret is not configured
    console.error('[webhook] NOMBA_WEBHOOK_SECRET is not set');
    return NextResponse.json(
      { error: 'Webhook secret not configured' },
      { status: 500 }
    );
  }

  const expectedHmac = createHmac('sha256', webhookSecret)
    .update(rawBody, 'utf8')
    .digest('hex');

  // timingSafeEqual requires equal-length buffers
  const sigBuffer = Buffer.from(signature, 'utf8');
  const expBuffer = Buffer.from(expectedHmac, 'utf8');

  const signatureValid =
    sigBuffer.length === expBuffer.length &&
    timingSafeEqual(sigBuffer, expBuffer);

  if (!signatureValid) {
    console.warn('[webhook] Signature mismatch — rejecting request');
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }

  // ── 3. Parse JSON ─────────────────────────────
  let payload: NombaWebhookPayload;
  try {
    payload = JSON.parse(rawBody) as NombaWebhookPayload;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { transactionId, accountRef, amount } = payload.data;

  if (!transactionId || !accountRef) {
    return NextResponse.json(
      { error: 'Missing required payload fields: transactionId, accountRef' },
      { status: 400 }
    );
  }

  // ── 4. Write audit log synchronously BEFORE returning 200 ──
  try {
    const adminDb = getAdminDb();
    const logId = adminDb.collection('webhook_log').doc().id;

    const logEntry: WebhookLog = {
      id: logId,
      transactionId,
      accountRef,
      amount: amount ?? 0,
      status: 'received',
      rawPayload: payload,
      createdAt: new Date().toISOString(),
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
