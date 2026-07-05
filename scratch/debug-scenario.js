const fs = require('fs');
const path = require('path');
const http = require('http');

// Load Env
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

// HTTP helper
function postJson(urlPath, bodyObj) {
  return new Promise((resolve, reject) => {
    const dataStr = JSON.stringify(bodyObj);
    const url = new URL(urlPath, 'http://localhost:3000');
    const options = {
      hostname: url.hostname,
      port: url.port || 80,
      path: url.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(dataStr),
      },
    };
    const req = http.request(options, (res) => {
      let responseBody = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => (responseBody += chunk));
      res.on('end', () => {
        let parsed = null;
        try {
          parsed = responseBody ? JSON.parse(responseBody) : null;
        } catch {
          parsed = { raw: responseBody };
        }
        resolve({ status: res.statusCode, body: parsed });
      });
    });
    req.on('error', reject);
    req.write(dataStr);
    req.end();
  });
}

async function debugScenario11() {
  console.log('Running Scenario 11 debug...');
  // Let's print the actual exception
  try {
    const snap = await db.collection('students').limit(1).get();
    console.log('Firestore connection OK. Students count:', snap.size);
    
    // Check if server is running
    const res = await postJson('/api/health', {});
    console.log('Server health:', res);
  } catch (err) {
    console.error('Initial checks failed:', err);
  }
}

debugScenario11().catch(console.error);
