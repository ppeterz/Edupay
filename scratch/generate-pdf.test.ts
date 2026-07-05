import { test, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { generateReceiptPdfBuffer } from '../src/lib/receipt-generator';
import type { Payment, Student, Invoice, School } from '../src/types';

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
    if (val.startsWith('"') && val.endsWith('"')) {
      val = val.slice(1, -1);
    }
    process.env[key] = val;
  }
}

import admin from 'firebase-admin';
import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

if (getApps().length === 0) {
  initializeApp({
    credential: cert({
      projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    }),
  });
}

const db = getFirestore();

test('Generate Kay Alaba receipt PDF', async () => {
  const paymentId = 'txn_API-VACT_TRA-A08CD-3b205b80-9011-4a83-ad13-4ad4a6ef4d78';
  
  // 1. Fetch Payment
  const paymentDoc = await db.collection('payments').doc(paymentId).get();
  expect(paymentDoc.exists).toBe(true);
  const payment = paymentDoc.data() as Payment;

  // 2. Fetch Student
  const studentDoc = await db.collection('students').doc(payment.studentId).get();
  expect(studentDoc.exists).toBe(true);
  const student = studentDoc.data() as Student;

  // 3. Fetch School
  const schoolDoc = await db.collection('schools').doc(student.schoolId).get();
  expect(schoolDoc.exists).toBe(true);
  const school = schoolDoc.data() as School;

  // 4. Fetch Invoices
  const invoiceIds = payment.invoiceIds || [payment.invoiceId];
  const invoices: Invoice[] = [];
  for (const invId of invoiceIds) {
    if (!invId) continue;
    const invoiceDoc = await db.collection('invoices').doc(invId).get();
    if (invoiceDoc.exists) {
      invoices.push(invoiceDoc.data() as Invoice);
    }
  }

  console.log(`Generating receipt for ${student.fullName} with ${invoices.length} invoices...`);
  const buffer = await generateReceiptPdfBuffer(payment, student, invoices, school);
  
  const outputPath = path.join(__dirname, 'receipt-temp.pdf');
  try {
    fs.writeFileSync(outputPath, buffer);
    console.log(`PDF written to: ${outputPath}`);
    expect(fs.existsSync(outputPath)).toBe(true);
  } catch (err) {
    console.warn(`Could not write PDF to disk due to lock: ${err.message}`);
  }
}, 30000);

test('Generate Partial Payment and Fallback Bank Receipt PDF', async () => {
  const paymentId = 'txn_API-VACT_TRA-A08CD-3b205b80-9011-4a83-ad13-4ad4a6ef4d78';
  
  const paymentDoc = await db.collection('payments').doc(paymentId).get();
  expect(paymentDoc.exists).toBe(true);
  const payment = { ...paymentDoc.data() } as Payment;

  const studentDoc = await db.collection('students').doc(payment.studentId).get();
  expect(studentDoc.exists).toBe(true);
  const student = { ...studentDoc.data() } as Student;

  const schoolDoc = await db.collection('schools').doc(student.schoolId).get();
  expect(schoolDoc.exists).toBe(true);
  const school = schoolDoc.data() as School;

  // Mock student virtualAccountBankName to empty to trigger N/A fallback
  student.virtualAccountBankName = '';

  // Mock invoice to have outstanding balance
  const invoices: Invoice[] = [
    {
      id: 'mock-inv-partial',
      studentId: student.id,
      schoolId: student.schoolId,
      term: 'Third Term',
      session: '2025/2026',
      lineItems: [
        {
          id: 'li-mock-tuition',
          description: 'Tuition',
          amountDue: 50000,
          amountPaid: 15000,
          priority: 1,
          status: 'partial'
        }
      ],
      totalAmountDue: 50000,
      totalAmountPaid: 15000,
      outstandingBalance: 35000,
      status: 'partial',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
  ];

  payment.allocations = [
    {
      lineItemId: 'li-mock-tuition',
      description: 'Tuition (Partial)',
      amountAllocated: 15000,
      invoiceId: 'mock-inv-partial'
    }
  ];
  payment.amount = 15000;

  console.log(`Generating mock partial payment receipt...`);
  const buffer = await generateReceiptPdfBuffer(payment, student, invoices, school);
  
  const outputPath = path.join(__dirname, 'receipt-partial-temp.pdf');
  try {
    fs.writeFileSync(outputPath, buffer);
    console.log(`PDF written to: ${outputPath}`);
    expect(fs.existsSync(outputPath)).toBe(true);
  } catch (err) {
    console.warn(`Could not write PDF to disk due to lock: ${err.message}`);
  }
}, 30000);

