// ──────────────────────────────────────────────
// EduPay — Nomba Webhook Signature Helpers
// ──────────────────────────────────────────────
// Shared between the webhook route and the dev test route.
// Signature algorithm per: https://developer.nomba.com/docs/api-basics/webhook

import type { NombaWebhookPayload } from '@/types';

/**
 * Builds the deterministic hashing payload string that Nomba uses
 * for HMAC-SHA256 webhook signature verification.
 *
 * Fields are joined with ':' in this exact order.
 */
export function buildHashingPayload(
  payload: NombaWebhookPayload,
  timestamp: string
): string {
  const t = payload.data.transaction;
  const m = payload.data.merchant;
  const responseCode =
    t.responseCode === 'null' ? '' : (t.responseCode ?? '');

  return [
    payload.event_type,
    payload.requestId,
    m.userId,
    m.walletId,
    t.transactionId,
    t.type,
    t.time,
    responseCode,
    timestamp,
  ].join(':');
}
