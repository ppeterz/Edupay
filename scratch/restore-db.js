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

async function restoreData() {
  console.log('🔄 Restoring original student records, invoices, and payments...');

  // 1. Restore Students
  const students = [
    {
      id: "iddnz92uwbzjg5v97qkn5kcbndn2-adm004",
      fullName: "tosin black",
      admissionNumber: "ADM004",
      class: "JSS 2",
      virtualAccountNumber: "5528068891",
      virtualAccountReference: "iddnz92uwbzjg5v97qkn5kcbndn2-adm004",
      virtualAccountBankName: "Nomba Bank",
      schoolId: "iddnz92uwbzjg5v97qkn5kcbndn2",
      outstandingBalance: 4490000,
      creditBalance: 0,
      createdAt: "2026-07-05T04:00:00.000Z"
    },
    {
      id: "iddnz92uwbzjg5v97qkn5kcbndn2-adm006",
      fullName: "kay alaba",
      admissionNumber: "ADM006",
      class: "Primary 1",
      virtualAccountNumber: "1402774708",
      virtualAccountReference: "iddnz92uwbzjg5v97qkn5kcbndn2-adm006",
      virtualAccountBankName: "Nomba Bank",
      schoolId: "iddnz92uwbzjg5v97qkn5kcbndn2",
      outstandingBalance: 4980000,
      creditBalance: 0,
      createdAt: "2026-07-05T12:00:00.000Z"
    }
  ];

  for (const s of students) {
    await db.collection('students').doc(s.id).set(s);
    console.log(`- Restored student: ${s.fullName} (${s.id})`);
  }

  // 2. Restore Invoices
  const invoices = [
    {
      id: "inv_tosin_1",
      studentId: "iddnz92uwbzjg5v97qkn5kcbndn2-adm004",
      schoolId: "iddnz92uwbzjg5v97qkn5kcbndn2",
      term: "First Term",
      session: "2025/2026",
      totalAmountDue: 4500000,
      totalAmountPaid: 10000,
      outstandingBalance: 4490000,
      status: "partial",
      lineItems: [
        {
          id: "li_tuition_tosin",
          description: "Tuition",
          amountDue: 4500000,
          amountPaid: 10000,
          priority: 1,
          status: "partial"
        }
      ],
      createdAt: "2026-07-05T04:10:00.000Z",
      updatedAt: "2026-07-05T04:53:36.270Z"
    },
    {
      id: "inv_kay_1",
      studentId: "iddnz92uwbzjg5v97qkn5kcbndn2-adm006",
      schoolId: "iddnz92uwbzjg5v97qkn5kcbndn2",
      term: "First Term",
      session: "2025/2026",
      totalAmountDue: 4500000,
      totalAmountPaid: 4500000,
      outstandingBalance: 0,
      status: "paid",
      lineItems: [
        {
          id: "li_tuition_kay1",
          description: "Tuition",
          amountDue: 4000000,
          amountPaid: 4000000,
          priority: 1,
          status: "paid"
        },
        {
          id: "li_exam_kay1",
          description: "Exam Fees",
          amountDue: 500000,
          amountPaid: 500000,
          priority: 2,
          status: "paid"
        }
      ],
      createdAt: "2026-07-05T12:05:00.000Z",
      updatedAt: "2026-07-05T12:10:11.699Z"
    },
    {
      id: "inv_kay_2",
      studentId: "iddnz92uwbzjg5v97qkn5kcbndn2-adm006",
      schoolId: "iddnz92uwbzjg5v97qkn5kcbndn2",
      term: "Second Term",
      session: "2025/2026",
      totalAmountDue: 5000000,
      totalAmountPaid: 20000,
      outstandingBalance: 4980000,
      status: "partial",
      lineItems: [
        {
          id: "li_tuition_kay2",
          description: "Tuition",
          amountDue: 4500000,
          amountPaid: 20000,
          priority: 1,
          status: "partial"
        },
        {
          id: "li_sports_kay2",
          description: "Sports",
          amountDue: 500000,
          amountPaid: 0,
          priority: 2,
          status: "unpaid"
        }
      ],
      createdAt: "2026-07-05T12:05:00.000Z",
      updatedAt: "2026-07-05T12:39:22.896Z"
    }
  ];

  for (const inv of invoices) {
    await db.collection('invoices').doc(inv.id).set(inv);
    console.log(`- Restored invoice: ${inv.id} for student: ${inv.studentId}`);
  }

  // 3. Restore Payments
  const payments = [
    {
      id: "txn_2073551404854390784",
      transactionId: "2073551404854390784",
      studentId: "iddnz92uwbzjg5v97qkn5kcbndn2-adm004",
      schoolId: "iddnz92uwbzjg5v97qkn5kcbndn2",
      amount: 10000,
      invoiceIds: ["inv_tosin_1"],
      invoiceId: "inv_tosin_1",
      paymentStatus: "processed",
      paymentMethod: "virtual_account",
      sessionRef: "090405260705003554559199128919",
      transactionTime: "2026-07-05T04:53:34.487Z",
      senderName: "PELUMI PETER ILESANMI",
      senderBank: "MONIEPOINT",
      senderAccount: "unknown",
      createdAt: "2026-07-05T04:53:36.270Z",
      allocations: [
        {
          lineItemId: "li_tuition_tosin",
          description: "Tuition",
          amountAllocated: 10000,
          invoiceId: "inv_tosin_1"
        }
      ],
      rawPayload: {
        event_type: "payment_success",
        requestId: "req-test-1783227214493",
        data: {
          merchant: {
            walletId: "test-wallet-id",
            walletBalance: 100000,
            userId: "test-user-id"
          },
          terminal: {},
          transaction: {
            transactionId: "2073551404854390784",
            transactionAmount: 100,
            aliasAccountReference: "iddnz92uwbzjg5v97qkn5kcbndn2-adm004",
            aliasAccountNumber: "5528068891",
            aliasAccountName: "tosin black",
            aliasAccountType: "virtual",
            fee: 0,
            sessionId: "090405260705003554559199128919",
            type: "collection",
            responseCode: "00",
            originatingFrom: "test",
            narration: "School fees payment",
            time: "2026-07-05T04:53:34.487Z"
          },
          customer: {
            bankCode: "000",
            senderName: "PELUMI PETER ILESANMI",
            bankName: "MONIEPOINT",
            accountNumber: "unknown"
          }
        }
      }
    },
    {
      id: "txn_API-VACT_TRA-A08CD-3b205b80-9011-4a83-ad13-4ad4a6ef4d78",
      transactionId: "API-VACT_TRA-A08CD-3b205b80-9011-4a83-ad13-4ad4a6ef4d78",
      studentId: "iddnz92uwbzjg5v97qkn5kcbndn2-adm006",
      schoolId: "iddnz92uwbzjg5v97qkn5kcbndn2",
      amount: 20000,
      invoiceIds: ["inv_kay_2"],
      invoiceId: "inv_kay_2",
      paymentStatus: "processed",
      paymentMethod: "virtual_account",
      sessionRef: "100033260705123918824778079405",
      transactionTime: "2026-07-05T12:39:22Z",
      senderName: "PELUMI PETER ILESANMI",
      senderBank: "Palmpay",
      senderAccount: "8100567880",
      createdAt: "2026-07-05T12:39:22.896Z",
      allocations: [
        {
          lineItemId: "li_tuition_kay2",
          description: "Tuition",
          amountAllocated: 20000,
          invoiceId: "inv_kay_2"
        }
      ],
      rawPayload: {
        event_type: "payment_success",
        requestId: "56b40497-9ffa-49de-94b9-3d51b1f324d7",
        data: {
          merchant: {
            walletId: "6a3be0c474957164eb0cc22d",
            walletBalance: 280,
            userId: "a08cd98c-4fed-4eda-be0f-243728041e9b"
          },
          terminal: {},
          transaction: {
            aliasAccountNumber: "1402774708",
            fee: 10,
            sessionId: "100033260705123918824778079405",
            type: "vact_transfer",
            transactionId: "API-VACT_TRA-A08CD-3b205b80-9011-4a83-ad13-4ad4a6ef4d78",
            aliasAccountName: "Nomba/kay alaba",
            responseCode: "",
            originatingFrom: "api",
            transactionAmount: 200,
            narration: "PELUMI PETER ILESANMI:8100567880",
            time: "2026-07-05T12:39:22Z",
            aliasAccountReference: "iddnz92uwbzjg5v97qkn5kcbndn2-adm006",
            aliasAccountType: "VIRTUAL"
          },
          customer: {
            bankCode: "100033",
            senderName: "PELUMI PETER ILESANMI",
            bankName: "Palmpay",
            accountNumber: "8100567880"
          }
        }
      }
    },
    {
      id: "txn_API-VACT_TRA-A08CD-6f4237fa-bdeb-4ab1-aa94-8f7765055534",
      transactionId: "API-VACT_TRA-A08CD-6f4237fa-bdeb-4ab1-aa94-8f7765055534",
      studentId: "iddnz92uwbzjg5v97qkn5kcbndn2-adm006",
      schoolId: "iddnz92uwbzjg5v97qkn5kcbndn2",
      amount: 10000,
      invoiceIds: ["inv_kay_1"],
      invoiceId: "inv_kay_1",
      paymentStatus: "processed",
      paymentMethod: "virtual_account",
      sessionRef: "100033260705121007403880711145",
      transactionTime: "2026-07-05T12:10:10Z",
      senderName: "PELUMI PETER ILESANMI",
      senderBank: "Palmpay",
      senderAccount: "8100567880",
      createdAt: "2026-07-05T12:10:11.699Z",
      allocations: [
        {
          lineItemId: "li_tuition_kay1",
          description: "Tuition",
          amountAllocated: 10000,
          invoiceId: "inv_kay_1"
        }
      ],
      rawPayload: {
        event_type: "payment_success",
        requestId: "407cfe67-35c3-43e7-a1c3-da121bd4dbe3",
        data: {
          merchant: {
            walletId: "6a3be0c474957164eb0cc22d",
            walletBalance: 90,
            userId: "a08cd98c-4fed-4eda-be0f-243728041e9b"
          },
          terminal: {},
          transaction: {
            aliasAccountNumber: "1402774708",
            fee: 10,
            sessionId: "100033260705121007403880711145",
            type: "vact_transfer",
            transactionId: "API-VACT_TRA-A08CD-6f4237fa-bdeb-4ab1-aa94-8f7765055534",
            aliasAccountName: "Nomba/kay alaba",
            responseCode: "",
            originatingFrom: "api",
            transactionAmount: 100,
            narration: "PELUMI PETER ILESANMI:8100567880",
            time: "2026-07-05T12:10:10Z",
            aliasAccountReference: "iddnz92uwbzjg5v97qkn5kcbndn2-adm006",
            aliasAccountType: "VIRTUAL"
          },
          customer: {
            bankCode: "100033",
            senderName: "PELUMI PETER ILESANMI",
            bankName: "Palmpay",
            accountNumber: "8100567880"
          }
        }
      }
    }
  ];

  for (const p of payments) {
    await db.collection('payments').doc(p.id).set(p);
    console.log(`- Restored payment: ${p.id} for student: ${p.studentId}`);
  }

  // 4. Restore Webhook Logs
  const logs = [
    {
      id: "DwLf6twZCuxiVJbKORPR",
      transactionId: "2073551404854390784",
      aliasAccountReference: "iddnz92uwbzjg5v97qkn5kcbndn2-adm004",
      amount: 10000,
      status: "processed",
      createdAt: "2026-07-05T04:53:36.270Z",
      rawPayload: payments[0].rawPayload
    },
    {
      id: "vaTYtt8s0XuuySfIVNy0",
      transactionId: "API-VACT_TRA-A08CD-3b205b80-9011-4a83-ad13-4ad4a6ef4d78",
      aliasAccountReference: "iddnz92uwbzjg5v97qkn5kcbndn2-adm006",
      amount: 20000,
      status: "processed",
      createdAt: "2026-07-05T12:39:22.896Z",
      rawPayload: payments[1].rawPayload
    },
    {
      id: "vn1rMZq01m6vuae7cgN0",
      transactionId: "API-VACT_TRA-A08CD-6f4237fa-bdeb-4ab1-aa94-8f7765055534",
      aliasAccountReference: "iddnz92uwbzjg5v97qkn5kcbndn2-adm006",
      amount: 10000,
      status: "processed",
      createdAt: "2026-07-05T12:10:11.699Z",
      rawPayload: payments[2].rawPayload
    },
    {
      id: "dB7b8EBrpx6qonissJuk",
      transactionId: "API-TRANSFER-AE431-976a85a2-8664-4542-be95-59b9dcdc0931",
      aliasAccountReference: "",
      amount: 5000,
      schoolId: "",
      status: "error",
      createdAt: "2026-07-06T09:14:23.250Z",
      rawPayload: {
        event_type: "payout_success",
        requestId: "cab0dd32-83fe-474d-a4e4-0e531845dfde",
        data: {
          merchant: {
            walletId: "6a3be0c474957164eb0cc22d",
            walletBalance: 210,
            userId: "a08cd98c-4fed-4eda-be0f-243728041e9b"
          },
          terminal: {},
          transaction: {
            fee: 20,
            sessionId: "090645260706091417397388249288",
            type: "transfer",
            transactionId: "API-TRANSFER-AE431-976a85a2-8664-4542-be95-59b9dcdc0931",
            responseCode: "",
            originatingFrom: "api",
            merchantTxRef: "wd_test_1783329255698",
            transactionAmount: 50,
            narration: "Hackathon ₦50",
            time: "2026-07-06T09:14:20Z"
          },
          customer: {
            bankCode: "100033",
            senderName: "EduPay Hackath - Nomba Hackathon 2026/pelumi Ilesanmi",
            recipientName: "PELUMI PETER ILESANMI",
            bankName: "Palmpay",
            accountNumber: "8100567880"
          }
        }
      }
    }
  ];

  for (const log of logs) {
    await db.collection('webhook_log').doc(log.id).set(log);
    console.log(`- Restored webhook log: ${log.id}`);
  }

  // 5. Restore Webhook Errors
  const errors = [
    {
      id: "QSesOoDPdYxdzIkltfCM",
      aliasAccountReference: "",
      transactionId: "API-TRANSFER-AE431-976a85a2-8664-4542-be95-59b9dcdc0931",
      payload: logs[3].rawPayload,
      error: "Webhook payload missing aliasAccountReference for transactionId API-TRANSFER-AE431-976a85a2-8664-4542-be95-59b9dcdc0931",
      createdAt: "2026-07-06T09:14:24.410Z"
    }
  ];

  for (const err of errors) {
    await db.collection('webhook_errors').doc(err.id).set(err);
    console.log(`- Restored webhook error: ${err.id}`);
  }

  console.log('\n=======================================');
  console.log(`✨ DATABASE RESTORATION COMPLETE!`);
  console.log('=======================================');
}

restoreData().catch(console.error);
