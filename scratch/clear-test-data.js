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

async function clearTestData() {
  console.log('🧹 Sweeping Firestore collections to remove all test data...');

  let studentsDeleted = 0;
  let invoicesDeleted = 0;
  let paymentsDeleted = 0;
  let eventsDeleted = 0;
  let logsDeleted = 0;
  let errorsDeleted = 0;

  // 1. Clean Students matching test patterns
  const studentsSnap = await db.collection('students').get();
  const testStudentIds = new Set();

  for (const doc of studentsSnap.docs) {
    const s = doc.data();
    const isTestId = doc.id.startsWith('stu-') || doc.id.startsWith('st6-');
    const isTestName = s.fullName === 'Jane ife' || s.fullName === 'Edge Case Student' || s.fullName === 'Integration Test Student' || s.fullName === 'Test Student';
    
    if (isTestId || isTestName) {
      testStudentIds.add(doc.id);
      await doc.ref.delete();
      studentsDeleted++;
      console.log(`- Deleted test student: ${s.fullName} (${doc.id})`);
    }
  }

  // 2. Clean Invoices matching test patterns or belonging to test students
  const invoicesSnap = await db.collection('invoices').get();
  for (const doc of invoicesSnap.docs) {
    const inv = doc.data();
    const isTestInvoice = doc.id.startsWith('inv-') || doc.id.startsWith('st6-');
    const belongsToTestStudent = testStudentIds.has(inv.studentId);

    if (isTestInvoice || belongsToTestStudent) {
      await doc.ref.delete();
      invoicesDeleted++;
      console.log(`- Deleted test invoice: ${doc.id}`);
    }
  }

  // 3. Clean Payments matching test patterns or belonging to test students
  const paymentsSnap = await db.collection('payments').get();
  for (const doc of paymentsSnap.docs) {
    const pay = doc.data();
    const isTestPayment = doc.id.startsWith('txn_tx-') || doc.id.startsWith('txn_st6') || pay.transactionId.startsWith('tx-');
    const belongsToTestStudent = testStudentIds.has(pay.studentId);

    if (isTestPayment || belongsToTestStudent) {
      await doc.ref.delete();
      paymentsDeleted++;
      console.log(`- Deleted test payment: ${doc.id}`);
    }
  }

  // 4. Clean Reconciliation Events belonging to test students
  const eventsSnap = await db.collection('reconciliation_events').get();
  for (const doc of eventsSnap.docs) {
    const event = doc.data();
    const belongsToTestStudent = testStudentIds.has(event.studentId);

    if (belongsToTestStudent || doc.id.startsWith('st6-')) {
      await doc.ref.delete();
      eventsDeleted++;
      console.log(`- Deleted reconciliation event: ${doc.id}`);
    }
  }

  // 5. Clean Webhook Logs matching test transaction IDs
  const logsSnap = await db.collection('webhook_log').get();
  for (const doc of logsSnap.docs) {
    const log = doc.data();
    const isTestLog = log.transactionId.startsWith('tx-') || log.transactionId.startsWith('tx_') || log.transactionId.startsWith('st6-');
    if (isTestLog) {
      await doc.ref.delete();
      logsDeleted++;
      console.log(`- Deleted webhook log: ${log.transactionId}`);
    }
  }

  // 6. Clean Webhook Errors matching test transaction IDs
  const errorsSnap = await db.collection('webhook_errors').get();
  for (const doc of errorsSnap.docs) {
    const err = doc.data();
    const isTestError = err.transactionId.startsWith('tx-') || err.transactionId.startsWith('tx_') || err.transactionId.startsWith('st6-');
    if (isTestError) {
      await doc.ref.delete();
      errorsDeleted++;
      console.log(`- Deleted webhook error log: ${err.transactionId}`);
    }
  }

  console.log('\n=======================================');
  console.log(`✨ DATABASE CLEANUP SUCCESSFUL!`);
  console.log(`   - Students deleted: ${studentsDeleted}`);
  console.log(`   - Invoices deleted: ${invoicesDeleted}`);
  console.log(`   - Payments deleted: ${paymentsDeleted}`);
  console.log(`   - Reconciliation events deleted: ${eventsDeleted}`);
  console.log(`   - Webhook logs deleted: ${logsDeleted}`);
  console.log(`   - Webhook errors deleted: ${errorsDeleted}`);
  console.log('=======================================');
}

clearTestData().catch(console.error);
