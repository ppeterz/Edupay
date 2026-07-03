// ──────────────────────────────────────────────
// EduPay — Transaction Engine (Stage 6)
// ──────────────────────────────────────────────
// Orchestrates the full payment processing pipeline:
//   1. Idempotency check (defense in depth — webhook-processor also checks)
//   2. Find active invoice for student
//   3. Record pending payment
//   4. Run pure reconciliation
//   5. Atomic Firestore transaction for all balance updates
//   6. Write reconciliation event (audit trail)

import { getAdminDb } from './firebase-admin';
import { reconcile } from './reconciliation-engine';
import { nairaToKobo } from './constants';
import type {
  Student,
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

  // Step 2 — find the student's active invoice (not fully paid, oldest first —
  // spillover to a second invoice happens in Stage 9 edge-case handling,
  // for now single active invoice is the common path)
  const invoicesSnap = await adminDb
    .collection('invoices')
    .where('studentId', '==', student.id)
    .where('status', 'in', ['unpaid', 'partial'])
    .orderBy('createdAt', 'asc')
    .limit(1)
    .get();

  if (invoicesSnap.empty) {
    // No active invoice — record as pending, then process as credit-only underpayment/overpayment
    const pendingPayment: Payment = {
      id: paymentId,
      studentId: student.id,
      schoolId: student.schoolId,
      invoiceId: '',
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


  const invoice = invoicesSnap.docs[0].data() as Invoice;

  // Step 3 — create pending payment record
  const pendingPayment: Payment = {
    id: paymentId,
    studentId: student.id,
    schoolId: student.schoolId,
    invoiceId: invoice.id,
    transactionId,
    transactionReference: txn.sessionId ?? '',
    amount: amountReceivedKobo,
    paymentStatus: 'pending',
    allocations: [],
    webhookPayload: payload,
    createdAt: new Date().toISOString(),
  };
  await adminDb.collection('payments').doc(paymentId).set(pendingPayment);

  // Step 4 — run PURE reconciliation (no Firestore calls inside)
  const result = reconcile(student, amountReceivedKobo, invoice);

  // Step 5 — atomic write of all balance changes
  const outstandingBefore = student.outstandingBalance;

  let isTransactionAborted = false;

  await adminDb.runTransaction(async (tx) => {
    const studentRef = adminDb.collection('students').doc(student.id);
    const invoiceRef = adminDb.collection('invoices').doc(invoice.id);
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
      allocations: result.allocations,
      processedAt: now,
    });

    tx.update(invoiceRef, {
      lineItems: result.updatedLineItems,
      totalAmountPaid: result.newTotalAmountPaid,
      outstandingBalance: result.newOutstandingBalance,
      status: result.newInvoiceStatus,
      updatedAt: now,
    });

    // Student outstandingBalance: reduce by what was actually allocated toward
    // this invoice's line items (not the raw amount received, since some of the
    // received amount might become credit instead of reducing outstanding debt)
    const outstandingDelta =
      invoice.outstandingBalance - result.newOutstandingBalance;
    tx.update(studentRef, {
      outstandingBalance: Math.max(
        student.outstandingBalance - outstandingDelta,
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
  const outstandingDelta =
    invoice.outstandingBalance - result.newOutstandingBalance;
  const eventId = adminDb.collection('reconciliation_events').doc().id;
  const event: ReconciliationEvent = {
    id: eventId,
    studentId: student.id,
    schoolId: student.schoolId,
    paymentId,
    eventType: result.eventType,
    amountReceived: amountReceivedKobo,
    amountAllocated: result.allocations.reduce(
      (sum, a) => sum + a.amountAllocated,
      0
    ),
    creditGenerated: result.creditGenerated,
    outstandingBefore,
    outstandingAfter: Math.max(
      outstandingBefore - outstandingDelta,
      0
    ),
    notes: `Processed transaction ${transactionId} against invoice ${invoice.id}`,
    createdAt: new Date().toISOString(),
  };
  await adminDb
    .collection('reconciliation_events')
    .doc(eventId)
    .set(event);

  // Step 7 — receipt generation (stub, real implementation in Stage 8)
  console.log(
    `[transaction-engine] Payment ${paymentId} processed: ${result.eventType}, ` +
      `allocated ${result.allocations.reduce((s, a) => s + a.amountAllocated, 0)} kobo, ` +
      `credit ${result.creditGenerated} kobo`
  );
}
