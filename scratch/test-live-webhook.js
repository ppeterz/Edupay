const fs = require('fs');
const path = require('path');
const https = require('https');
const crypto = require('crypto');

// ── 1. Load Environment Variables from .env.local ──
const envPath = path.join(__dirname, '../.env.local');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const splitIdx = trimmed.indexOf('=');
    if (splitIdx === -1) continue;
    const key = trimmed.slice(0, splitIdx).trim();
    let val = trimmed.slice(splitIdx + 1).trim();
    if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
    process.env[key] = val;
  }
}

// Config
const TARGET_URL = 'https://edupay-five.vercel.app/api/webhooks/nomba';
const WEBHOOK_SECRET = process.env.NOMBA_WEBHOOK_SECRET || 'NombaHackathon2026';

console.log(`📡 Preparing test payload signed with secret: "${WEBHOOK_SECRET}"...`);
console.log(`🔗 Target URL: ${TARGET_URL}\n`);

// ── 2. Construct Mock Webhook Payload ──
const now = new Date().toISOString();
const payload = {
  event_type: 'payment_success',
  requestId: `req-live-test-${Date.now()}`,
  data: {
    merchant: {
      walletId: 'test-wallet-id',
      walletBalance: 100000,
      userId: 'test-user-id'
    },
    terminal: {},
    transaction: {
      transactionId: `tx-live-test-${Date.now()}`,
      transactionAmount: 10.00, // ₦10.00 test payment
      aliasAccountReference: 'iddnz92uwbzjg5v97qkn5kcbndn2-adm006', // kay alaba reference
      aliasAccountNumber: '1402774708',
      aliasAccountName: 'kay alaba',
      aliasAccountType: 'virtual',
      fee: 0,
      sessionId: `sess-live-test-${Date.now()}`,
      type: 'collection',
      responseCode: '00',
      originatingFrom: 'test',
      narration: 'Live webhook verification test',
      time: now
    },
    customer: {
      bankCode: '000',
      senderName: 'WEBHOOK VERIFIER SCRIPT',
      bankName: 'VERIFIER BANK',
      accountNumber: '1234567890'
    }
  }
};

const rawBody = JSON.stringify(payload);

// ── 3. Build Hashing Payload & Sign (Base64) ──
function buildHashingPayload(p, timestamp) {
  const t = p.data.transaction;
  const m = p.data.merchant;
  const responseCode = t.responseCode === 'null' ? '' : (t.responseCode ?? '');
  return [
    p.event_type,
    p.requestId,
    m.userId,
    m.walletId,
    t.transactionId,
    t.type,
    t.time,
    responseCode,
    timestamp
  ].join(':');
}

const hashingPayload = buildHashingPayload(payload, now);
const signature = crypto
  .createHmac('sha256', WEBHOOK_SECRET)
  .update(hashingPayload)
  .digest('base64');

// ── 4. Make HTTPS Request to Vercel Endpoint ──
const parsedUrl = new URL(TARGET_URL);
const options = {
  hostname: parsedUrl.hostname,
  port: 443,
  path: parsedUrl.pathname,
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'nomba-signature': signature,
    'nomba-timestamp': now,
    'Content-Length': rawBody.length
  }
};

const req = https.request(options, (res) => {
  let body = '';
  res.on('data', (chunk) => body += chunk);
  res.on('end', () => {
    console.log(`📥 Response Status: ${res.statusCode} ${res.statusMessage}`);
    console.log(`📥 Response Body: ${body}\n`);

    if (res.statusCode === 200) {
      console.log('✅ SUCCESS: The webhook endpoint is working and signature verification succeeded!');
    } else if (res.statusCode === 401) {
      console.error('❌ ERROR (401): Signature mismatch or missing headers.');
      console.error('👉 Make sure NOMBA_WEBHOOK_SECRET is set to "NombaHackathon2026" on Vercel.');
    } else if (res.statusCode === 404) {
      console.error('❌ ERROR (404): Endpoint not found.');
      console.error(`👉 Double-check that your webhook URL on Nomba dashboard is exactly: ${TARGET_URL}`);
    } else if (res.statusCode === 500) {
      console.error('❌ ERROR (500): Server error on Vercel.');
      console.error('👉 Check your Vercel Dashboard logs to diagnose the crash.');
    } else {
      console.error(`⚠️ UNEXPECTED STATUS (${res.statusCode}): Check webhook_log in Firestore.`);
    }
  });
});

req.on('error', (e) => {
  console.error('🚨 Network error calling live URL:', e);
});

req.write(rawBody);
req.end();
