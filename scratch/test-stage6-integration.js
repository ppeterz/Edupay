// ──────────────────────────────────────────────
// EduPay — Stage 6 Integration Test Suite (Robust / Edge-Case Coverage)
// ──────────────────────────────────────────────
// Runs local integration tests for the Transaction Engine and
// Reconciliation Engine against REAL Firestore + the live
// /api/webhooks/nomba/test endpoint (requires `npm run dev` running).
//
// Each scenario creates its own isolated student + invoice (unique IDs)
// so tests never bleed into each other's state, and can be re-run safely.
//
// Usage: node scratch/test-stage6-integration.js

const fs = require('fs');
const path = require('path');
const http = require('http');

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

// ── 2. Initialise Firebase Admin SDK ──
const admin = require('firebase-admin');
const { cert, getApps, initializeApp } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

const privateKey = process.env.FIREBASE_PRIVATE_KEY;
const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;

if (!privateKey || !clientEmail || !projectId) {
  console.error('❌ Missing Firebase Admin environment variables.');
  process.exit(1);
}

if (getApps().length === 0) {
  initializeApp({
    credential: cert({
      projectId,
      clientEmail,
      privateKey: privateKey.replace(/\\n/g, '\n'),
    }),
  });
}

const db = getFirestore();
const BASE_URL = 'http://localhost:3000';
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// ── 3. Assertion tracking ──
let passCount = 0;
let failCount = 0;
const failures = [];

function assert(label, actual, expected) {
  const pass = JSON.stringify(actual) === JSON.stringify(expected);
  if (pass) {
    passCount++;
    console.log(`  ✅ ${label}: ${JSON.stringify(actual)}`);
  } else {
    failCount++;
    failures.push(`${label} — expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
    console.log(`  ❌ ${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

function assertTrue(label, condition, detail = '') {
  if (condition) {
    passCount++;
    console.log(`  ✅ ${label} ${detail}`);
  } else {
    failCount++;
    failures.push(`${label} ${detail}`);
    console.log(`  ❌ ${label} ${detail}`);
  }
}

// ── 4. HTTP helper ──
function postJson(urlPath, bodyObj) {
  return new Promise((resolve, reject) => {
    const dataStr = JSON.stringify(bodyObj);
    const url = new URL(urlPath, BASE_URL);
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

// ── 5. Fixture helpers — each scenario gets fully isolated data ──
let fixtureCounter = 0;
function uniqueId(prefix) {
  fixtureCounter++;
  return `${prefix}-${Date.now()}-${fixtureCounter}`;
}

async function createStudent(overrides = {}) {
  const id = uniqueId('stu');
  const accountRef = uniqueId('ref');
  const suffix = id.slice(id.lastIndexOf('-') + 1); // scenario incremental suffix
  const student = {
    id,
    schoolId: 'IddNZ92uWbZjg5V97qkn5KCbNDn2',
    fullName: `Jane Ife (Scenario ${suffix})`,
    class: 'JSS 2',
    admissionNumber: `ADM-${suffix.padStart(3, '0')}`,
    virtualAccountNumber: `6747${Math.floor(100000 + Math.random() * 900000)}`,
    virtualAccountReference: accountRef,
    virtualAccountBankName: 'Nombank MFB',
    outstandingBalance: 0,
    creditBalance: 0,
    createdAt: new Date().toISOString(),
    ...overrides,
  };
  await db.collection('students').doc(id).set(student);
  return { id, accountRef, student };
}

async function createInvoice(studentId, schoolId, { lineItems, status = 'unpaid', overrides = {} }) {
  const id = uniqueId('inv');
  const totalAmountDue = lineItems.reduce((s, li) => s + li.amountDue, 0);
  const totalAmountPaid = lineItems.reduce((s, li) => s + li.amountPaid, 0);
  const invoice = {
    id,
    studentId,
    schoolId: 'IddNZ92uWbZjg5V97qkn5KCbNDn2', // Override to use real logged-in school ID so they display on dashboard
    term: 'First Term',
    session: '2026/2027',
    totalAmountDue,
    totalAmountPaid,
    outstandingBalance: totalAmountDue - totalAmountPaid,
    status,
    lineItems,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
  await db.collection('invoices').doc(id).set(invoice);
  return { id, invoice };
}

async function sendWebhook(accountRef, transactionId, transactionAmount) {
  return postJson('/api/webhooks/nomba/test', {
    data: {
      transaction: {
        transactionId,
        transactionAmount,
        aliasAccountReference: accountRef,
      },
    },
  });
}

async function getStudent(id) {
  const snap = await db.collection('students').doc(id).get();
  return snap.exists ? snap.data() : null;
}

async function getInvoice(id) {
  const snap = await db.collection('invoices').doc(id).get();
  return snap.exists ? snap.data() : null;
}

async function getPaymentByTxnId(transactionId) {
  const snap = await db.collection('payments').where('transactionId', '==', transactionId).get();
  return snap.docs.map((d) => d.data());
}

async function getEventsByPaymentId(paymentId) {
  const snap = await db.collection('reconciliation_events').where('paymentId', '==', paymentId).get();
  return snap.docs.map((d) => d.data());
}

async function getWebhookErrorsByTxnId(transactionId) {
  const snap = await db.collection('webhook_errors').where('transactionId', '==', transactionId).get();
  return snap.docs.map((d) => d.data());
}

// ── 5B. Polling Helpers to avoid background task latency races ──
async function pollInvoiceOutstanding(invoiceId, expectedOutstanding, maxWaitMs = 5000) {
  const start = Date.now();
  while (Date.now() - start < maxWaitMs) {
    const inv = await getInvoice(invoiceId);
    if (inv && inv.outstandingBalance === expectedOutstanding) {
      return inv;
    }
    await sleep(150);
  }
  return await getInvoice(invoiceId);
}

async function pollStudentCredit(studentId, expectedCredit, maxWaitMs = 5000) {
  const start = Date.now();
  while (Date.now() - start < maxWaitMs) {
    const stu = await getStudent(studentId);
    if (stu && stu.creditBalance === expectedCredit) {
      return stu;
    }
    await sleep(150);
  }
  return await getStudent(studentId);
}

async function pollPaymentsCount(txnId, expectedCount, maxWaitMs = 5000) {
  const start = Date.now();
  while (Date.now() - start < maxWaitMs) {
    const p = await getPaymentByTxnId(txnId);
    if (p.length === expectedCount) {
      return p;
    }
    await sleep(150);
  }
  return await getPaymentByTxnId(txnId);
}

async function pollPaymentProcessed(txnId, maxWaitMs = 5000) {
  const start = Date.now();
  while (Date.now() - start < maxWaitMs) {
    const p = await getPaymentByTxnId(txnId);
    if (p.length === 1 && p[0].paymentStatus === 'processed') {
      return p;
    }
    await sleep(150);
  }
  return await getPaymentByTxnId(txnId);
}


// ── 6. Scenarios ──

async function scenario1_underpayment() {
  console.log('\n--- Scenario 1: Underpayment (₦30,000 against ₦50,000) ---');
  const { id: studentId, accountRef } = await createStudent({ outstandingBalance: 5000000 });
  const { id: invoiceId } = await createInvoice(studentId, 'school-st6-edge', {
    lineItems: [
      { id: 'li-1', description: 'Tuition', amountDue: 3500000, amountPaid: 0, priority: 1, status: 'unpaid' },
      { id: 'li-2', description: 'Examination Fees', amountDue: 1000000, amountPaid: 0, priority: 2, status: 'unpaid' },
      { id: 'li-3', description: 'Transport Fees', amountDue: 500000, amountPaid: 0, priority: 3, status: 'unpaid' },
    ],
  });

  const txnId = uniqueId('tx');
  await sendWebhook(accountRef, txnId, 30000);
  
  const invoice = await pollInvoiceOutstanding(invoiceId, 2000000);
  const student = await getStudent(studentId);
  const payments = await getPaymentByTxnId(txnId);

  assert('Invoice outstandingBalance', invoice?.outstandingBalance, 2000000);
  assert('Invoice status', invoice?.status, 'partial');
  assert('Student outstandingBalance', student?.outstandingBalance, 2000000);
  assert('Student creditBalance', student?.creditBalance, 0);
  assertTrue('Exactly 1 payment doc created', payments.length === 1);
  if (payments[0]) {
    assert('Payment status', payments[0].paymentStatus, 'processed');
  }
}

async function scenario2_duplicateTransactionId() {
  console.log('\n--- Scenario 2: Duplicate transactionId (idempotency) ---');
  const { id: studentId, accountRef } = await createStudent({ outstandingBalance: 5000000 });
  await createInvoice(studentId, 'school-st6-edge', {
    lineItems: [{ id: 'li-1', description: 'Tuition', amountDue: 5000000, amountPaid: 0, priority: 1, status: 'unpaid' }],
  });

  const txnId = uniqueId('tx');
  await sendWebhook(accountRef, txnId, 30000);
  await pollPaymentsCount(txnId, 1);
  
  await sendWebhook(accountRef, txnId, 30000); // exact same transactionId, fired sequentially
  await sleep(1000);

  const payments = await getPaymentByTxnId(txnId);
  assertTrue('Exactly 1 payment doc despite 2 webhook deliveries', payments.length === 1, `(found ${payments.length})`);
}

async function scenario2b_concurrentDuplicates() {
  console.log('\n--- Scenario 2b: TRUE concurrent duplicate (race condition) ---');
  const { id: studentId, accountRef } = await createStudent({ outstandingBalance: 5000000 });
  await createInvoice(studentId, 'school-st6-edge', {
    lineItems: [{ id: 'li-1', description: 'Tuition', amountDue: 5000000, amountPaid: 0, priority: 1, status: 'unpaid' }],
  });

  const txnId = uniqueId('tx');
  // Fire both requests without awaiting the first — genuine race condition
  await Promise.all([
    sendWebhook(accountRef, txnId, 30000),
    sendWebhook(accountRef, txnId, 30000),
  ]);
  
  const payments = await pollPaymentsCount(txnId, 1); // should settle on exactly 1 document
  assertTrue(
    'Exactly 1 payment doc despite CONCURRENT identical webhooks',
    payments.length === 1,
    `(found ${payments.length} — if >1, idempotency check has a race condition)`
  );
}

async function scenario3_overpayment() {
  console.log('\n--- Scenario 3: Overpayment (₦60,000 against ₦50,000) ---');
  const { id: studentId, accountRef } = await createStudent({ outstandingBalance: 5000000 });
  const { id: invoiceId } = await createInvoice(studentId, 'school-st6-edge', {
    lineItems: [{ id: 'li-1', description: 'Tuition', amountDue: 5000000, amountPaid: 0, priority: 1, status: 'unpaid' }],
  });

  const txnId = uniqueId('tx');
  await sendWebhook(accountRef, txnId, 60000);
  
  const invoice = await pollInvoiceOutstanding(invoiceId, 0);
  const student = await getStudent(studentId);

  assert('Invoice outstandingBalance', invoice?.outstandingBalance, 0);
  assert('Invoice status', invoice?.status, 'overpaid');
  assert('Student outstandingBalance', student?.outstandingBalance, 0);
  assert('Student creditBalance (₦10,000 overpay)', student?.creditBalance, 1000000);
}

async function scenario4_exactFullPayment() {
  console.log('\n--- Scenario 4: Exact full payment (no overpay, no credit) ---');
  const { id: studentId, accountRef } = await createStudent({ outstandingBalance: 5000000 });
  const { id: invoiceId } = await createInvoice(studentId, 'school-st6-edge', {
    lineItems: [{ id: 'li-1', description: 'Tuition', amountDue: 5000000, amountPaid: 0, priority: 1, status: 'unpaid' }],
  });

  const txnId = uniqueId('tx');
  await sendWebhook(accountRef, txnId, 50000);
  
  const invoice = await pollInvoiceOutstanding(invoiceId, 0);
  const student = await getStudent(studentId);

  assert('Invoice status is exactly "paid" (not "overpaid")', invoice?.status, 'paid');
  assert('Invoice outstandingBalance', invoice?.outstandingBalance, 0);
  assert('Student creditBalance stays 0 on exact payment', student?.creditBalance, 0);
}

async function scenario5_creditCarryForward() {
  console.log('\n--- Scenario 5: Pre-existing credit + new payment (via real webhook) ---');
  const { id: studentId, accountRef } = await createStudent({
    outstandingBalance: 5000000,
    creditBalance: 500000, // ₦5,000 pre-existing credit
  });
  const { id: invoiceId } = await createInvoice(studentId, 'school-st6-edge', {
    lineItems: [{ id: 'li-1', description: 'Tuition', amountDue: 5000000, amountPaid: 0, priority: 1, status: 'unpaid' }],
  });

  const txnId = uniqueId('tx');
  await sendWebhook(accountRef, txnId, 45000); // ₦45,000 + ₦5,000 credit = exactly ₦50,000
  
  const invoice = await pollInvoiceOutstanding(invoiceId, 0);
  const student = await pollStudentCredit(studentId, 0);

  assert('Invoice fully paid using credit + payment', invoice?.status, 'paid');
  assert('Invoice outstandingBalance', invoice?.outstandingBalance, 0);
  assert('Student creditBalance consumed to 0', student?.creditBalance, 0);
}

async function scenario6_priorityAllocation() {
  console.log('\n--- Scenario 6: Priority allocation across 3 line items ---');
  const { id: studentId, accountRef } = await createStudent({ outstandingBalance: 2500000 });
  const { id: invoiceId } = await createInvoice(studentId, 'school-st6-edge', {
    lineItems: [
      { id: 'li-1', description: 'Tuition', amountDue: 1500000, amountPaid: 0, priority: 1, status: 'unpaid' },
      { id: 'li-2', description: 'Examination Fees', amountDue: 1000000, amountPaid: 0, priority: 2, status: 'unpaid' },
    ],
  });

  const txnId = uniqueId('tx');
  await sendWebhook(accountRef, txnId, 20000); // ₦20,000 against ₦25,000 total
  
  const invoice = await pollInvoiceOutstanding(invoiceId, 500000);
  const tuition = invoice?.lineItems.find((li) => li.id === 'li-1');
  const exam = invoice?.lineItems.find((li) => li.id === 'li-2');

  assert('Tuition (priority 1) fully paid', tuition?.status, 'paid');
  assert('Tuition amountPaid', tuition?.amountPaid, 1500000);
  assert('Exam (priority 2) partially paid', exam?.status, 'partial');
  assert('Exam amountPaid (remainder)', exam?.amountPaid, 500000);
  assert('Invoice outstandingBalance', invoice?.outstandingBalance, 500000);
  assert('Invoice status', invoice?.status, 'partial');
}

async function scenario7_multipleInstallments() {
  console.log('\n--- Scenario 7: 3 sequential installments summing to full payment ---');
  const { id: studentId, accountRef } = await createStudent({ outstandingBalance: 5000000 });
  const { id: invoiceId } = await createInvoice(studentId, 'school-st6-edge', {
    lineItems: [{ id: 'li-1', description: 'Tuition', amountDue: 5000000, amountPaid: 0, priority: 1, status: 'unpaid' }],
  });

  await sendWebhook(accountRef, uniqueId('tx'), 20000);
  let invoice = await pollInvoiceOutstanding(invoiceId, 3000000);
  assert('After installment 1 — outstanding', invoice?.outstandingBalance, 3000000);
  assert('After installment 1 — status', invoice?.status, 'partial');

  await sendWebhook(accountRef, uniqueId('tx'), 15000);
  invoice = await pollInvoiceOutstanding(invoiceId, 1500000);
  assert('After installment 2 — outstanding', invoice?.outstandingBalance, 1500000);
  assert('After installment 2 — status', invoice?.status, 'partial');

  await sendWebhook(accountRef, uniqueId('tx'), 15000);
  invoice = await pollInvoiceOutstanding(invoiceId, 0);
  assert('After installment 3 — outstanding', invoice?.outstandingBalance, 0);
  assert('After installment 3 — status (fully paid)', invoice?.status, 'paid');

  const student = await getStudent(studentId);
  assert('Student outstandingBalance after all installments', student?.outstandingBalance, 0);
}

async function scenario8_unknownAccountRef() {
  console.log('\n--- Scenario 8: Unknown accountRef (student does not exist) ---');
  const txnId = uniqueId('tx');
  const fakeRef = uniqueId('nonexistent-ref');

  const res = await sendWebhook(fakeRef, txnId, 10000);
  await sleep(1500);

  assert('Webhook still returns 200 (per spec — always ack fast)', res.body?.webhookStatus ?? res.status, 200);

  const payments = await getPaymentByTxnId(txnId);
  assertTrue('NO payment document created for unknown accountRef', payments.length === 0, `(found ${payments.length})`);

  const errors = await getWebhookErrorsByTxnId(txnId);
  assertTrue('webhook_errors document WAS created', errors.length >= 1, `(found ${errors.length})`);
}

async function scenario9_noActiveInvoice() {
  console.log('\n--- Scenario 9: Student exists but has NO unpaid/partial invoice ---');
  const { id: studentId, accountRef } = await createStudent({ outstandingBalance: 0 });
  // Deliberately create only a fully-paid invoice — no active invoice exists
  await createInvoice(studentId, 'school-st6-edge', {
    lineItems: [{ id: 'li-1', description: 'Tuition', amountDue: 5000000, amountPaid: 5000000, priority: 1, status: 'paid' }],
    status: 'paid',
  });

  const txnId = uniqueId('tx');
  await sendWebhook(accountRef, txnId, 10000);
  const payments = await pollPaymentProcessed(txnId);
  assertTrue('A payment document IS created', payments.length === 1, `(found ${payments.length})`);
  if (payments[0]) {
    assert('Payment status is "processed"', payments[0].paymentStatus, 'processed');
  }


  // Poll student credit balance and assert it has increased by the payment amount
  const student = await pollStudentCredit(studentId, 1000000);
  assert('Student creditBalance (₦10,000 credit)', student?.creditBalance, 1000000);
  assert('Student outstandingBalance remains unchanged', student?.outstandingBalance, 0);
}


async function scenario10_zeroAmount() {
  console.log('\n--- Scenario 10: Zero-amount payment (malformed/malicious payload) ---');
  const { id: studentId, accountRef } = await createStudent({ outstandingBalance: 5000000 });
  await createInvoice(studentId, 'school-st6-edge', {
    lineItems: [{ id: 'li-1', description: 'Tuition', amountDue: 5000000, amountPaid: 0, priority: 1, status: 'unpaid' }],
  });

  const txnId = uniqueId('tx');
  const res = await sendWebhook(accountRef, txnId, 0);
  await sleep(1500);

  const payments = await getPaymentByTxnId(txnId);
  const student = await getStudent(studentId);

  console.log(`  ℹ️  Webhook HTTP response: ${res.status}`);
  console.log(`  ℹ️  Payment docs created: ${payments.length}`);
  console.log(`  ℹ️  Student outstandingBalance unchanged: ${student?.outstandingBalance === 5000000}`);
  assertTrue(
    'Zero-amount payment does NOT reduce outstanding balance',
    student?.outstandingBalance === 5000000,
    `(actual: ${student?.outstandingBalance})`
  );
}

async function scenario11_negativeAmount() {
  console.log('\n--- Scenario 11: Negative amount payload (adversarial input) ---');
  const { id: studentId, accountRef } = await createStudent({ outstandingBalance: 5000000 });
  await createInvoice(studentId, 'school-st6-edge', {
    lineItems: [{ id: 'li-1', description: 'Tuition', amountDue: 5000000, amountPaid: 0, priority: 1, status: 'unpaid' }],
  });

  const txnId = uniqueId('tx');
  await sendWebhook(accountRef, txnId, -5000);
  await sleep(1500);

  const student = await getStudent(studentId);
  assertTrue(
    'Negative amount does NOT increase outstandingBalance above original',
    (student?.outstandingBalance ?? 0) <= 5000000,
    `(actual: ${student?.outstandingBalance})`
  );
}

async function scenario12_decimalKoboRounding() {
  console.log('\n--- Scenario 12: Fractional Naira amount (kobo rounding) ---');
  const { id: studentId, accountRef } = await createStudent({ outstandingBalance: 5000000 });
  const { id: invoiceId } = await createInvoice(studentId, 'school-st6-edge', {
    lineItems: [{ id: 'li-1', description: 'Tuition', amountDue: 5000000, amountPaid: 0, priority: 1, status: 'unpaid' }],
  });

  const txnId = uniqueId('tx');
  // ₦333.335 → nairaToKobo should round sensibly (33333 or 33334 kobo, never NaN)
  await sendWebhook(accountRef, txnId, 333.335);
  
  const invoice = await pollInvoiceOutstanding(invoiceId, 5000000 - 33334); // rounds 333.335 to 33334
  const payments = await getPaymentByTxnId(txnId);

  assertTrue(
    'Fractional kobo amount does not produce NaN or crash',
    typeof invoice?.outstandingBalance === 'number' && !Number.isNaN(invoice.outstandingBalance)
  );
  if (payments[0]) {
    console.log(`  ℹ️  Recorded amount (kobo): ${payments[0].amount}`);
  }
}

// ── 7. Run all scenarios ──
async function runAll() {
  console.log('🚀 Stage 6 Edge-Case Integration Suite — starting...');
  console.log('   (requires `npm run dev` running on localhost:3000)\n');

  const scenarios = [
    scenario1_underpayment,
    scenario2_duplicateTransactionId,
    scenario2b_concurrentDuplicates,
    scenario3_overpayment,
    scenario4_exactFullPayment,
    scenario5_creditCarryForward,
    scenario6_priorityAllocation,
    scenario7_multipleInstallments,
    scenario8_unknownAccountRef,
    scenario9_noActiveInvoice,
    scenario10_zeroAmount,
    scenario11_negativeAmount,
    scenario12_decimalKoboRounding,
  ];

  for (const scenario of scenarios) {
    try {
      await scenario();
    } catch (err) {
      failCount++;
      failures.push(`${scenario.name} threw an exception: ${err.message}`);
      console.log(`  💥 ${scenario.name} threw: ${err.message}`);
    }
  }

  // ── Post-run Cleanup ──
  // (Disabled so you can review transactions, logs, and student ledger timelines on the Dashboard pages)
  /*
  console.log('\n🧹 Cleaning up temporary test records from Firestore...');
  try {
    const studentsSnap = await db.collection('students').get();
    for (const doc of studentsSnap.docs) {
      if (doc.id.startsWith('stu-')) {
        const studentId = doc.id;
        
        // Delete invoices
        const invSnap = await db.collection('invoices').where('studentId', '==', studentId).get();
        for (const invDoc of invSnap.docs) {
          await invDoc.ref.delete();
        }

        // Delete payments
        const paySnap = await db.collection('payments').where('studentId', '==', studentId).get();
        for (const payDoc of paySnap.docs) {
          await payDoc.ref.delete();
        }

        // Delete student
        await doc.ref.delete();
      }
    }
    console.log('✅ Temporary test records removed.');
  } catch (err) {
    console.error('⚠️ Post-run cleanup encountered an error:', err.message);
  }
  */


  console.log('\n=======================================');
  console.log(`✨ SUITE COMPLETE — ${passCount} passed, ${failCount} failed`);
  console.log('=======================================');
  if (failures.length > 0) {
    console.log('\nFailures:');
    failures.forEach((f, i) => console.log(`  ${i + 1}. ${f}`));
    process.exitCode = 1;
  }
}


runAll().catch((err) => {
  console.error('Fatal error running suite:', err);
  process.exit(1);
});