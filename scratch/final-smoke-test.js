const fs = require('fs');
const path = require('path');
const https = require('https');
const crypto = require('crypto');

// Load env variables
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

const admin = require('firebase-admin');
const { cert, getApps, initializeApp } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

if (getApps().length === 0) {
  initializeApp({
    credential: cert({
      projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    }),
  });
}

const db = getFirestore();

const targetBaseUrl = process.argv[2] || 'https://edupay-five.vercel.app';
console.log(`🚀 Starting Final Smoke Test against URL: ${targetBaseUrl}\n`);

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function request(url, options, bodyObj = null) {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(url);
    const requestOptions = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port || (parsedUrl.protocol === 'https:' ? 443 : 80),
      path: parsedUrl.pathname + parsedUrl.search,
      method: options.method || 'GET',
      headers: options.headers || {},
    };

    const client = parsedUrl.protocol === 'https:' ? https : require('http');
    const req = client.request(requestOptions, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        let parsed = null;
        try {
          parsed = JSON.parse(data);
        } catch {
          parsed = { raw: data };
        }
        resolve({ status: res.statusCode, body: parsed });
      });
    });

    req.on('error', reject);
    if (bodyObj) {
      req.write(JSON.stringify(bodyObj));
    }
    req.end();
  });
}

async function runSmokeTests() {
  let failed = false;

  // 1. GET /api/health → 200, { status: 'ok' }
  console.log('1. Checking GET /api/health...');
  try {
    const res = await request(`${targetBaseUrl}/api/health`, { method: 'GET' });
    if (res.status === 200 && res.body.status === 'ok') {
      console.log('  ✅ Passed!');
    } else {
      console.error(`  ❌ Failed! Status: ${res.status}, Body:`, res.body);
      failed = true;
    }
  } catch (err) {
    console.error('  ❌ Failed with error:', err.message);
    failed = true;
  }

  // 2. POST /api/webhooks/nomba with no signature → 401 (not 500)
  console.log('\n2. Checking POST /api/webhooks/nomba with no signature...');
  try {
    const res = await request(`${targetBaseUrl}/api/webhooks/nomba`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, { test: true });
    if (res.status === 401) {
      console.log('  ✅ Passed! Returned 401 Unauthorized.');
    } else {
      console.error(`  ❌ Failed! Expected 401, got status: ${res.status}, Body:`, res.body);
      failed = true;
    }
  } catch (err) {
    console.error('  ❌ Failed with error:', err.message);
    failed = true;
  }

  // 3. GET /api/students (no auth header) → 401
  console.log('\n3. Checking GET /api/students (no auth header)...');
  try {
    const res = await request(`${targetBaseUrl}/api/students`, { method: 'GET' });
    if (res.status === 401) {
      console.log('  ✅ Passed! Returned 401 Unauthorized.');
    } else {
      console.error(`  ❌ Failed! Expected 401, got status: ${res.status}, Body:`, res.body);
      failed = true;
    }
  } catch (err) {
    console.error('  ❌ Failed with error:', err.message);
    failed = true;
  }

  // 4. GET /api/receipts/nonexistent-id → 404 (proves public, not 401)
  console.log('\n4. Checking GET /api/receipts/nonexistent-id (public endpoint check)...');
  try {
    const res = await request(`${targetBaseUrl}/api/receipts/nonexistent-id-123456`, { method: 'GET' });
    if (res.status === 404) {
      console.log('  ✅ Passed! Returned 404 Not Found (proves it is a public endpoint, not 401).');
    } else {
      console.error(`  ❌ Failed! Expected 404, got status: ${res.status}, Body:`, res.body);
      failed = true;
    }
  } catch (err) {
    console.error('  ❌ Failed with error:', err.message);
    failed = true;
  }

  // 5. Send a valid self-signed payload → 200, then poll Firestore
  console.log('\n5. Sending valid self-signed webhook payload and verifying end-to-end processing...');
  try {
    const transactionId = `tx-smoke-${Date.now()}`;
    const now = new Date().toISOString();
    const mockPayload = {
      event_type: 'payment_success',
      requestId: `req-smoke-${Date.now()}`,
      data: {
        merchant: {
          walletId: 'test-wallet-id',
          walletBalance: 100000,
          userId: 'test-user-id'
        },
        terminal: {},
        transaction: {
          transactionId: transactionId,
          transactionAmount: 10.00, // ₦10.00 test payment
          aliasAccountReference: 'iddnz92uwbzjg5v97qkn5kcbndn2-adm006', // Kay Alaba
          aliasAccountNumber: '1402774708',
          aliasAccountName: 'kay alaba',
          aliasAccountType: 'virtual',
          fee: 0,
          sessionId: `sess-smoke-${Date.now()}`,
          type: 'collection',
          responseCode: '00',
          originatingFrom: 'test',
          narration: 'Production smoke test execution',
          time: now
        },
        customer: {
          bankCode: '000',
          senderName: 'SMOKE TEST VERIFIER SCRIPT',
          bankName: 'VERIFIER BANK',
          accountNumber: '1234567890'
        }
      }
    };

    const webhookSecret = process.env.NOMBA_WEBHOOK_SECRET || 'NombaHackathon2026';
    const t = mockPayload.data.transaction;
    const m = mockPayload.data.merchant;
    const responseCode = t.responseCode === 'null' ? '' : (t.responseCode ?? '');
    
    const hashingPayload = [
      mockPayload.event_type,
      mockPayload.requestId,
      m.userId,
      m.walletId,
      t.transactionId,
      t.type,
      t.time,
      responseCode,
      now
    ].join(':');

    const signature = crypto
      .createHmac('sha256', webhookSecret)
      .update(hashingPayload)
      .digest('base64');

    const res = await request(`${targetBaseUrl}/api/webhooks/nomba`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'nomba-signature': signature,
        'nomba-timestamp': now
      }
    }, mockPayload);

    if (res.status === 200) {
      console.log('  ✅ Webhook accepted (200 OK). Polling Firestore payments collection...');
      
      const paymentId = `txn_${transactionId}`;
      let paymentDoc = null;
      const startPoll = Date.now();
      
      while (Date.now() - startPoll < 15000) {
        const snap = await db.collection('payments').doc(paymentId).get();
        if (snap.exists) {
          paymentDoc = snap.data();
          if (paymentDoc.paymentStatus === 'processed') {
            break;
          }
        }
        await sleep(1000);
      }

      if (paymentDoc && paymentDoc.paymentStatus === 'processed') {
        console.log(`  ✅ Passed! Payment ${paymentId} found and processed successfully in Firestore.`);
      } else {
        console.error(`  ❌ Failed! Payment document not found or status not processed in 15 seconds. Actual:`, paymentDoc);
        failed = true;
      }
    } else {
      console.error(`  ❌ Failed to submit webhook! Status: ${res.status}, Body:`, res.body);
      failed = true;
    }
  } catch (err) {
    console.error('  ❌ Failed with error:', err.message);
    failed = true;
  }

  if (failed) {
    console.error('\n🚨 Smoke test suite failed!');
    process.exit(1);
  } else {
    console.log('\n🎉 All smoke tests passed successfully!');
    process.exit(0);
  }
}

runSmokeTests().catch(console.error);
