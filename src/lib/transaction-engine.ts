// ──────────────────────────────────────────────
// EduPay — Transaction Engine (Stage 6 → Multi-Invoice)
// ──────────────────────────────────────────────
// Orchestrates the full payment processing pipeline:
//   1. Idempotency check (defense in depth — webhook-processor also checks)
//   2. Find active invoices for student (oldest-first, up to 10)
//   3. Record pending payment
//   4. Run pure reconciliation (multi-invoice)
//   5. Atomic Firestore transaction for all balance updates
//   6. Write reconciliation event (audit trail)

import { getAdminDb } from './firebase-admin';
import { reconcileMultiple } from './reconciliation-engine';
import { generateReceipt } from './receipt-generator';
import { nairaToKobo } from './constants';
import type {
  Student,
  School,
  Invoice,
  Payment,
  NombaWebhookPayload,
  ReconciliationEvent,
} from '@/types';

export async function processPayment(
  student: Student,
  payload: NombaWebhookPayload
): Promise<void> {
  const adminDb = getAdminDb();
  const txn = payload.data.transaction;
  const transactionId = txn.transactionId;
  const amountReceivedKobo = nairaToKobo(txn.transactionAmount);

  // Validate incoming amount is positive
  if (amountReceivedKobo <= 0) {
    console.warn(
      `[transaction-engine] Ignoring non-positive transactionAmount: ${txn.transactionAmount} Naira`
    );
    return;
  }

  // Deterministic paymentId matching transactionId for concurrency/idempotency protection
  const paymentId = `txn_${transactionId}`;


  // Step 1 — idempotency check (webhook-processor.ts already does a pre-check,
  // but re-check here too since this function could theoretically be called
  // directly in future — defense in depth costs nothing)
  const existingPayment = await adminDb
    .collection('payments')
    .doc(paymentId)
    .get();

  if (existingPayment.exists) {
    const payData = existingPayment.data();
    if (payData && payData.paymentStatus === 'processed') {
      console.log(
        `[transaction-engine] Duplicate transactionId ${transactionId} (processed), skipping`
      );
      return;
    }
  }

  // Step 2 — find the student's active invoices (oldest-first, up to 10)
  const invoicesSnap = await adminDb
    .collection('invoices')
    .where('studentId', '==', student.id)
    .where('status', 'in', ['unpaid', 'partial'])
    .orderBy('createdAt', 'asc')
    .limit(10)
    .get();

  const activeInvoices = invoicesSnap.docs.map(d => d.data() as Invoice);

  if (activeInvoices.length === 0) {
    // No active invoice — record as pending, then process as credit-only underpayment/overpayment
    const pendingPayment: Payment = {
      id: paymentId,
      studentId: student.id,
      schoolId: student.schoolId,
      invoiceId: '',
      invoiceIds: [],
      transactionId,
      transactionReference: txn.sessionId ?? '',
      amount: amountReceivedKobo,
      paymentStatus: 'pending',
      allocations: [],
      webhookPayload: payload,
      createdAt: new Date().toISOString(),
    };
    await adminDb.collection('payments').doc(paymentId).set(pendingPayment);

    const outstandingBefore = student.outstandingBalance;
    let isTransactionAborted = false;

    await adminDb.runTransaction(async (tx) => {
      const studentRef = adminDb.collection('students').doc(student.id);
      const paymentRef = adminDb.collection('payments').doc(paymentId);

      const txPaymentDoc = await tx.get(paymentRef);
      if (txPaymentDoc.exists) {
        const payData = txPaymentDoc.data();
        if (payData && payData.paymentStatus === 'processed') {
          isTransactionAborted = true;
          return;
        }
      }

      const now = new Date().toISOString();

      tx.update(paymentRef, {
        paymentStatus: 'processed',
        allocations: [],
        processedAt: now,
      });

      // Increment student's creditBalance with the raw amount received
      tx.update(studentRef, {
        creditBalance: student.creditBalance + amountReceivedKobo,
      });
    });

    if (isTransactionAborted) return;

    // Write audit event
    const eventId = adminDb.collection('reconciliation_events').doc().id;
    const event: ReconciliationEvent = {
      id: eventId,
      studentId: student.id,
      schoolId: student.schoolId,
      paymentId,
      eventType: 'overpayment',
      amountReceived: amountReceivedKobo,
      amountAllocated: 0,
      creditGenerated: amountReceivedKobo,
      outstandingBefore,
      outstandingAfter: outstandingBefore,
      notes: `Processed transaction ${transactionId} with no active invoice. Added full amount to student credit balance.`,
      createdAt: new Date().toISOString(),
    };
    await adminDb.collection('reconciliation_events').doc(eventId).set(event);

    console.log(
      `[transaction-engine] Payment ${paymentId} processed as credit-only: overpayment, ` +
        `allocated 0 kobo, credit ${amountReceivedKobo} kobo`
    );
    return;
  }


  // Step 3 — run PURE multi-invoice reconciliation (no Firestore calls inside)
  const result = reconcileMultiple(student, amountReceivedKobo, activeInvoices);

  // Flatten allocations across all touched invoices for the payment record
  const allAllocations = result.perInvoice.flatMap(pi => pi.allocations);
  const touchedInvoiceIds = result.perInvoice.map(pi => pi.invoiceId);

  // Step 4 — create pending payment record
  const pendingPayment: Payment = {
    id: paymentId,
    studentId: student.id,
    schoolId: student.schoolId,
    invoiceId: touchedInvoiceIds[0] ?? '',   // primary/oldest, backward compat
    invoiceIds: touchedInvoiceIds,
    transactionId,
    transactionReference: txn.sessionId ?? '',
    amount: amountReceivedKobo,
    paymentStatus: 'pending',
    allocations: [],
    webhookPayload: payload,
    createdAt: new Date().toISOString(),
  };
  await adminDb.collection('payments').doc(paymentId).set(pendingPayment);

  // Step 5 — atomic write of all balance changes
  const outstandingBefore = student.outstandingBalance;

  let isTransactionAborted = false;

  await adminDb.runTransaction(async (tx) => {
    const studentRef = adminDb.collection('students').doc(student.id);
    const paymentRef = adminDb.collection('payments').doc(paymentId);

    // Fetch the payment record inside the transaction to prevent concurrent race conditions
    const txPaymentDoc = await tx.get(paymentRef);
    if (txPaymentDoc.exists) {
      const payData = txPaymentDoc.data();
      if (payData && payData.paymentStatus === 'processed') {
        console.log(
          `[transaction-engine] Concurrency block: transactionId ${transactionId} already processed by another thread.`
        );
        isTransactionAborted = true;
        return;
      }
    }

    const now = new Date().toISOString();

    tx.update(paymentRef, {
      paymentStatus: 'processed',
      allocations: allAllocations,
      invoiceId: touchedInvoiceIds[0] ?? '',
      invoiceIds: touchedInvoiceIds,
      processedAt: now,
    });

    // Update EACH touched invoice
    let totalOutstandingDelta = 0;
    for (const pi of result.perInvoice) {
      const invoiceRef = adminDb.collection('invoices').doc(pi.invoiceId);
      tx.update(invoiceRef, {
        lineItems: pi.updatedLineItems,
        totalAmountPaid: pi.newTotalAmountPaid,
        outstandingBalance: pi.newOutstandingBalance,
        status: pi.newInvoiceStatus,
        updatedAt: now,
      });
      totalOutstandingDelta += pi.outstandingBefore - pi.newOutstandingBalance;
    }

    tx.update(studentRef, {
      outstandingBalance: Math.max(
        student.outstandingBalance - totalOutstandingDelta,
        0
      ),
      creditBalance: result.newStudentCreditBalance,
    });
  });

  if (isTransactionAborted) {
    return;
  }

  // Step 6 — write reconciliation event (audit trail, outside the transaction
  // is fine since it's append-only and not balance-critical)
  const totalOutstandingDelta = result.perInvoice.reduce(
    (sum, pi) => sum + (pi.outstandingBefore - pi.newOutstandingBalance),
    0
  );
  const eventId = adminDb.collection('reconciliation_events').doc().id;
  const event: ReconciliationEvent = {
    id: eventId,
    studentId: student.id,
    schoolId: student.schoolId,
    paymentId,
    eventType: result.eventType,
    amountReceived: amountReceivedKobo,
    amountAllocated: result.totalAllocated,
    creditGenerated: result.creditGenerated,
    outstandingBefore,
    outstandingAfter: Math.max(
      outstandingBefore - totalOutstandingDelta,
      0
    ),
    notes: `Processed transaction ${transactionId} against invoice(s) ${touchedInvoiceIds.join(', ')}`,
    createdAt: new Date().toISOString(),
  };
  await adminDb
    .collection('reconciliation_events')
    .doc(eventId)
    .set(event);

  // Step 7 — receipt generation (fire-and-forget — never blocks payment processing)
  console.log(
    `[transaction-engine] Payment ${paymentId} processed: ${result.eventType}, ` +
      `allocated ${result.totalAllocated} kobo across ${touchedInvoiceIds.length} invoice(s), ` +
      `credit ${result.creditGenerated} kobo`
  );

  // Fetch the updated invoices for receipt generation (they have been updated in the transaction)
  const touchedInvoiceDocs = await Promise.all(
    touchedInvoiceIds.map(id => adminDb.collection('invoices').doc(id).get())
  );
  const touchedInvoices = touchedInvoiceDocs.map(d => d.data() as Invoice);

  generateReceipt(
    {
      ...pendingPayment,
      allocations: allAllocations,
      invoiceId: touchedInvoiceIds[0] ?? '',
      invoiceIds: touchedInvoiceIds,
      processedAt: new Date().toISOString(),
    },
    student,
    touchedInvoices,
    await adminDb
      .collection('schools')
      .doc(student.schoolId)
      .get()
      .then((doc) => (doc.data() as School) ?? { id: student.schoolId, name: 'School', email: '', createdAt: '' })
  )
    .then(async (url) => {
      await adminDb.collection('payments').doc(paymentId).update({ receiptUrl: url });
      console.log(`[transaction-engine] Receipt generated for ${paymentId}: ${url}`);
    })
    .catch((err) =>
      console.error('[transaction-engine] Receipt generation failed:', err)
    );
}
