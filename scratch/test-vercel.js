// ──────────────────────────────────────────────────
// EduPay — Test Vercel Webhook Deployment
// ──────────────────────────────────────────────────
// This script signs a payload and sends it to your live Vercel endpoint.
//
// Run using: node scratch/test-vercel.js

const https = require('https');
const crypto = require('crypto');

// Target deployed webhook URL
const targetUrl = 'https://edupay-five.vercel.app/api/webhooks/nomba';

// The secret configured on your Vercel env variables (we'll read from your local .env.local)
let secret = 'https://edupay-five.vercel.app/api/webhooks/nomba';

// Read .env.local to find what secret is currently set
const fs = require('fs');
try {
  const envContent = fs.readFileSync('.env.local', 'utf8');
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim();
    if (trimmed.startsWith('NOMBA_WEBHOOK_SECRET=')) {
      secret = trimmed.replace('NOMBA_WEBHOOK_SECRET=', '').trim();
      if (secret.startsWith('"') && secret.endsWith('"')) {
        secret = secret.slice(1, -1);
      }
      break;
    }
  }
} catch (e) {
  console.warn('Could not read .env.local, using default secret.');
}

console.log(`Using secret key for signature calculation: "${secret}"`);

// Mock Webhook Payload (Replace accountRef with a valid student ref if you want it to process)
const payload = {
  event: 'collection.successful',
  data: {
    transactionId: `vercel-test-${Date.now()}`,
    amount: 150000, // ₦1,500 in kobo
    accountRef: 'iddnz92uwbzjg5v97qkn5kcbndn2-adm002', // Change this to a real reference in your DB
    accountNumber: '1012023034',
    narration: 'Vercel live test payment',
    currency: 'NGN',
    transactionDate: new Date().toISOString(),
  },
};

const rawBody = JSON.stringify(payload);

// Calculate signature
const signature = crypto
  .createHmac('sha256', secret)
  .update(rawBody, 'utf8')
  .digest('hex');

console.log(`Sending signed payload to ${targetUrl}...`);
console.log(`Calculated Signature: ${signature}\n`);

const req = https.request(
  targetUrl,
  {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(rawBody),
      'x-nomba-signature': signature,
    },
  },
  (res) => {
    let body = '';
    res.on('data', (chunk) => (body += chunk));
    res.on('end', () => {
      console.log(`=== RESPONSE FROM VERCEL ===`);
      console.log(`Status Code: ${res.statusCode}`);
      console.log(`Headers:`, res.headers);
      console.log(`Response Body: ${body}`);
      console.log(`=============================`);
      if (res.statusCode === 200) {
        console.log('\n✅ Success! The webhook endpoint returned HTTP 200.');
        console.log('Check your Vercel logs and Firestore `webhook_log` collection to confirm async processing.');
      } else {
        console.log('\n❌ Failed. Please check that NOMBA_WEBHOOK_SECRET matches exactly on Vercel.');
      }
    });
  }
);

req.on('error', (err) => {
  console.error('Request failed:', err);
});

req.write(rawBody);
req.end();
