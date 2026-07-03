// ──────────────────────────────────────────────
// EduPay — Webhook Integration Verification
// ──────────────────────────────────────────────
// Run this script locally to test signature verification,
// student matching, and idempotency checks.
//
// Usage: node scratch/test-webhook.js

const http = require('http');

const BASE_URL = 'http://localhost:3000';

async function post(path, headers, bodyObj) {
  return new Promise((resolve, reject) => {
    const dataStr = JSON.stringify(bodyObj);
    const url = new URL(path, BASE_URL);
    const options = {
      hostname: url.hostname,
      port: url.port || 80,
      path: url.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(dataStr),
        ...headers,
      },
    };

    const req = http.request(options, (res) => {
      let responseBody = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => {
        responseBody += chunk;
      });
      res.on('end', () => {
        resolve({
          status: res.statusCode,
          headers: res.headers,
          body: responseBody,
        });
      });
    });

    req.on('error', (e) => reject(e));
    req.write(dataStr);
    req.end();
  });
}

async function runTests() {
  console.log('🚀 Starting Webhook Integration Tests...');

  const transactionId = `tx-test-${Date.now()}`;
  const mockPayload = {
    event_type: 'payment_success',
    requestId: `req-test-${Date.now()}`,
    data: {
      merchant: {
        walletId: 'test-wallet-id',
        walletBalance: 100000,
        userId: 'test-user-id',
      },
      terminal: {},
      transaction: {
        transactionId: transactionId,
        transactionAmount: 5000.0, // ₦5,000
        aliasAccountReference: 'UNKNOWN_REF_123',
        aliasAccountNumber: '0000000000',
        aliasAccountName: 'Test Student',
        aliasAccountType: 'virtual',
        fee: 0,
        sessionId: `sess-${Date.now()}`,
        type: 'collection',
        responseCode: '00',
        originatingFrom: 'test',
        narration: 'School fees payment',
        time: new Date().toISOString(),
      },
      customer: {
        bankCode: '000',
        senderName: 'Test Sender',
        bankName: 'Test Bank',
        accountNumber: '1234567890',
      },
    },
  };

  // ── TEST 1: Wrong Signature (Direct to route) ──
  console.log('\n--- Test 1: Direct Webhook POST with Invalid Signature ---');
  try {
    const res1 = await post(
      '/api/webhooks/nomba',
      {
        'nomba-signature': 'bad-signature-base64-here',
        'nomba-timestamp': new Date().toISOString(),
      },
      mockPayload
    );
    console.log(`Status Code: ${res1.status} (Expected: 401)`);
    console.log(`Response: ${res1.body}`);
  } catch (err) {
    console.error('Test 1 failed:', err.message);
  }

  // ── TEST 2: Valid Signed Webhook (Through dev test route) ──
  console.log('\n--- Test 2: Valid Signed Webhook via /api/webhooks/nomba/test ---');
  try {
    const res2 = await post('/api/webhooks/nomba/test', {}, mockPayload);
    console.log(`Status Code: ${res2.status} (Expected: 200)`);
    const parsed = JSON.parse(res2.body);
    console.log(`Webhook Response Status: ${parsed.webhookStatus} (Expected: 200)`);
    console.log(`Webhook Response Body:`, JSON.stringify(parsed.webhookResponse));
  } catch (err) {
    console.error('Test 2 failed:', err.message);
  }

  // ── TEST 3: Duplicate Webhook Check ──
  console.log('\n--- Test 3: Duplicate Webhook with same transactionId ---');
  try {
    const res3 = await post('/api/webhooks/nomba/test', {}, mockPayload);
    console.log(`Status Code: ${res3.status} (Expected: 200)`);
    const parsed = JSON.parse(res3.body);
    console.log(`Webhook Response Status: ${parsed.webhookStatus} (Expected: 200)`);
    console.log(`Webhook Response Body:`, JSON.stringify(parsed.webhookResponse));
    console.log('\n✅ Tests finished. Now check Firestore webhook_log and webhook_errors collections.');
  } catch (err) {
    console.error('Test 3 failed:', err.message);
  }
}

runTests();
