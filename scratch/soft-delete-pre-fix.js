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

const brokenAdmissions = ['ADM002', 'ADM003', 'ADM004', 'ADM005'];

async function softDeleteBrokenStudents() {
  console.log('Querying for pre-fix broken student accounts (ADM002 - ADM005)...');
  
  const studentsSnap = await db.collection('students').get();
  let deletedCount = 0;
  
  for (const doc of studentsSnap.docs) {
    const s = doc.data();
    if (brokenAdmissions.includes(s.admissionNumber)) {
      console.log(`Soft-deleting student: ${s.fullName} (${s.admissionNumber}) - ID: ${doc.id}`);
      await doc.ref.update({
        deletedAt: new Date().toISOString()
      });
      deletedCount++;
    }
  }
  
  console.log(`Soft-deletion complete. Total students soft-deleted: ${deletedCount}`);
}

softDeleteBrokenStudents().catch(console.error);
