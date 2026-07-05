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

async function searchKayAlaba() {
  console.log('Searching for Kay Alaba in students...');
  const studentsSnap = await db.collection('students').get();
  let foundStudent = null;
  for (const doc of studentsSnap.docs) {
    const s = doc.data();
    if (s.fullName.toLowerCase().includes('alaba') || s.fullName.toLowerCase().includes('kay')) {
      console.log(`Found Student:`, s);
      foundStudent = s;
    }
  }

  if (foundStudent) {
    console.log('Searching for payments for student:', foundStudent.id);
    const paymentsSnap = await db.collection('payments').where('studentId', '==', foundStudent.id).get();
    for (const doc of paymentsSnap.docs) {
      console.log(`Found Payment:`, doc.data());
    }

    console.log('Searching for invoices for student:', foundStudent.id);
    const invoicesSnap = await db.collection('invoices').where('studentId', '==', foundStudent.id).get();
    for (const doc of invoicesSnap.docs) {
      console.log(`Found Invoice:`, doc.data());
    }
  } else {
    console.log('No student matching Kay Alaba found. Let us list some recent students to see who we have.');
    const limitSnap = await db.collection('students').limit(5).get();
    for (const doc of limitSnap.docs) {
      console.log(doc.id, doc.data().fullName);
    }
  }
}

searchKayAlaba().catch(console.error);
