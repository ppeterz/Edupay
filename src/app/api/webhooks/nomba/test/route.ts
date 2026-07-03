// ──────────────────────────────────────────────
// EduPay — Webhook Test Endpoint (DEV only)
// POST /api/webhooks/nomba/test
// ──────────────────────────────────────────────
// Allows local testing of the webhook pipeline without ngrok.
// Signs a mock payload with NOMBA_WEBHOOK_SECRET and calls the
// main webhook handler internally.
//
// ⚠️  ONLY active when NODE_ENV !== 'production'.
//     Returns 404 in production builds.

import { NextRequest, NextResponse } from 'next/server';
import { createHmac } from 'crypto';
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
  let mockPayload: NombaWebhookPayload;
  try {
    mockPayload = (await request.json()) as NombaWebhookPayload;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  // Apply defaults so callers only need to provide the interesting fields
  const defaultPayload: NombaWebhookPayload = {
    event: 'collection.successful',
    data: {
      transactionId: `test-txn-${Date.now()}`,
      amount: 500000, // ₦5,000 in kobo
      accountRef: mockPayload.data?.accountRef ?? 'UNKNOWN_REF',
      accountNumber: mockPayload.data?.accountNumber ?? '0000000000',
      narration: 'School fees payment',
      currency: 'NGN',
      transactionDate: new Date().toISOString(),
      senderName: mockPayload.data?.senderName ?? 'Test Sender',
      senderBank: mockPayload.data?.senderBank ?? 'Test Bank',
    },
  };

  const mergedPayload: NombaWebhookPayload = {
    event: mockPayload.event ?? defaultPayload.event,
    data: {
      ...defaultPayload.data,
      ...mockPayload.data,
    },
  };

  const rawBody = JSON.stringify(mergedPayload);

  // ── Sign exactly as Nomba would ───────────────
  const signature = createHmac('sha256', webhookSecret)
    .update(rawBody, 'utf8')
    .digest('hex');

  // ── Call the main webhook handler via internal fetch ──
  const baseUrl = request.nextUrl.origin;
  const webhookUrl = `${baseUrl}/api/webhooks/nomba`;

  const webhookResponse = await fetch(webhookUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-nomba-signature': signature,
    },
    body: rawBody,
  });

  const responseBody = await webhookResponse.json();

  return NextResponse.json(
    {
      testPayload: mergedPayload,
      signature,
      webhookStatus: webhookResponse.status,
      webhookResponse: responseBody,
    },
    { status: 200 }
  );
}
