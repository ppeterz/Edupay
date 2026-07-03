// ──────────────────────────────────────────────
// EduPay — Webhook Test Endpoint (DEV only)
// POST /api/webhooks/nomba/test
// ──────────────────────────────────────────────
// Allows local testing of the webhook pipeline without ngrok.
// Signs a mock payload with NOMBA_WEBHOOK_SECRET using Nomba's
// real signature algorithm and calls the main webhook handler.
//
// ⚠️  ONLY active when NODE_ENV !== 'production'.
//     Returns 404 in production builds.

import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { buildHashingPayload } from '@/lib/webhook-helpers';
import type { NombaWebhookPayload } from '@/types';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  // Hard gate — never expose in production
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const webhookSecret = process.env.NOMBA_WEBHOOK_SECRET || '';
  if (!webhookSecret) {
    return NextResponse.json(
      { error: 'NOMBA_WEBHOOK_SECRET is not set in .env.local' },
      { status: 500 }
    );
  }

  // ── Parse the mock payload ────────────────────
  let input: Partial<NombaWebhookPayload>;
  try {
    input = (await request.json()) as Partial<NombaWebhookPayload>;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  // Apply defaults so callers only need to provide the interesting fields
  const now = new Date().toISOString();
  const mergedPayload: NombaWebhookPayload = {
    event_type: input.event_type ?? 'payment_success',
    requestId: input.requestId ?? `req-test-${Date.now()}`,
    data: {
      merchant: {
        walletId: input.data?.merchant?.walletId ?? 'test-wallet-id',
        walletBalance: input.data?.merchant?.walletBalance ?? 100000,
        userId: input.data?.merchant?.userId ?? 'test-user-id',
      },
      terminal: input.data?.terminal ?? {},
      transaction: {
        transactionId:
          input.data?.transaction?.transactionId ?? `test-txn-${Date.now()}`,
        transactionAmount:
          input.data?.transaction?.transactionAmount ?? 5000.0, // ₦5,000
        aliasAccountReference:
          input.data?.transaction?.aliasAccountReference ?? 'UNKNOWN_REF',
        aliasAccountNumber:
          input.data?.transaction?.aliasAccountNumber ?? '0000000000',
        aliasAccountName:
          input.data?.transaction?.aliasAccountName ?? 'Test Student',
        aliasAccountType:
          input.data?.transaction?.aliasAccountType ?? 'virtual',
        fee: input.data?.transaction?.fee ?? 0,
        sessionId:
          input.data?.transaction?.sessionId ?? `sess-${Date.now()}`,
        type: input.data?.transaction?.type ?? 'collection',
        responseCode: input.data?.transaction?.responseCode ?? '00',
        originatingFrom:
          input.data?.transaction?.originatingFrom ?? 'test',
        narration:
          input.data?.transaction?.narration ?? 'School fees payment',
        time: input.data?.transaction?.time ?? now,
        merchantTxRef: input.data?.transaction?.merchantTxRef,
      },
      customer: {
        bankCode: input.data?.customer?.bankCode ?? '000',
        senderName: input.data?.customer?.senderName ?? 'Test Sender',
        bankName: input.data?.customer?.bankName ?? 'Test Bank',
        accountNumber: input.data?.customer?.accountNumber ?? '1234567890',
      },
    },
  };

  const rawBody = JSON.stringify(mergedPayload);

  // ── Sign exactly as Nomba would ───────────────
  const timestamp = now;
  const hashingPayload = buildHashingPayload(mergedPayload, timestamp);
  const signature = crypto
    .createHmac('sha256', webhookSecret)
    .update(hashingPayload)
    .digest('base64'); // BASE64, matching Nomba's real format

  // ── Call the main webhook handler via internal fetch ──
  const baseUrl = request.nextUrl.origin;
  const webhookUrl = `${baseUrl}/api/webhooks/nomba`;

  const webhookResponse = await fetch(webhookUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'nomba-signature': signature,
      'nomba-timestamp': timestamp,
    },
    body: rawBody,
  });

  const responseBody = await webhookResponse.json();

  return NextResponse.json(
    {
      testPayload: mergedPayload,
      signature,
      timestamp,
      webhookStatus: webhookResponse.status,
      webhookResponse: responseBody,
    },
    { status: 200 }
  );
}
