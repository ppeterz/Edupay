const fs = require('fs');
const path = require('path');

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
    if (val.startsWith('"') && val.endsWith('"')) {
      val = val.slice(1, -1);
    }
    process.env[key] = val;
  }
}

const admin = require('firebase-admin');
const { cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

admin.initializeApp({
  credential: cert({
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
  }),
});

const db = getFirestore();

async function inspectDb() {
  console.log('--- Students ---');
  const students = await db.collection('students').get();
  students.forEach(doc => {
    console.log(`Student ID: ${doc.id}, Name: ${doc.data().fullName}, email: ${doc.data().email}`);
  });

  console.log('\n--- Webhook Logs ---');
  const logs = await db.collection('webhook_log').get();
  console.log(`Total webhook logs: ${logs.size}`);
  logs.docs.slice(0, 10).forEach(doc => {
    console.log(`Log ID: ${doc.id}, data:`, JSON.stringify(doc.data()));
  });

  console.log('\n--- Webhook Errors ---');
  const errors = await db.collection('webhook_errors').get();
  console.log(`Total webhook errors: ${errors.size}`);
  errors.docs.slice(0, 10).forEach(doc => {
    console.log(`Error ID: ${doc.id}, data:`, JSON.stringify(doc.data()));
  });
}

inspectDb().catch(console.error);
