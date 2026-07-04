// ──────────────────────────────────────────────
// EduPay — Invoice Create API Route (POST)
// ──────────────────────────────────────────────
// Creates an invoice for a student and atomically updates
// the student's outstandingBalance using runTransaction().

import { NextRequest } from 'next/server';
import { verifyAuthToken, unauthorized, badRequest } from '@/lib/auth-helpers';
import { getAdminDb } from '@/lib/firebase-admin';
import {
  validateLineItems,
  calculateInvoiceTotals,
} from '@/lib/invoice-helpers';
import { nairaToKobo } from '@/lib/constants';
import type { Student, Invoice, InvoiceLineItem } from '@/types';

export const runtime = 'nodejs';

const VALID_TERMS = ['First Term', 'Second Term', 'Third Term'];

export async function POST(request: NextRequest) {
  // 1. Verify auth token
  const decoded = await verifyAuthToken(request);
  if (!decoded) return unauthorized();

  const adminDb = getAdminDb();

  // 2. Parse body
  let body: {
    studentId?: string;
    term?: string;
    session?: string;
    lineItems?: { description: string; amountDue: number; priority: number }[];
  };
  try {
    body = await request.json();
  } catch {
    return badRequest('Invalid request body');
  }

  const { studentId, term, session, lineItems } = body;

  // 3. Validate inputs
  if (!studentId || typeof studentId !== 'string' || !studentId.trim()) {
    return badRequest('studentId is required');
  }
  if (!term || !VALID_TERMS.includes(term)) {
    return badRequest('term must be one of: First Term, Second Term, Third Term');
  }
  if (!session || typeof session !== 'string' || !session.includes('/')) {
    return badRequest('session is required and must contain "/" (e.g. 2025/2026)');
  }

  // Validate line items (amounts are still in Naira at this point — that's fine)
  if (!lineItems) {
    return badRequest('lineItems is required');
  }
  const lineItemError = validateLineItems(lineItems);
  if (lineItemError) {
    return badRequest(lineItemError);
  }

  // 4. Verify student exists and belongs to this school
  const studentDoc = await adminDb.collection('students').doc(studentId).get();
  if (!studentDoc.exists) {
    return Response.json({ error: 'Student not found' }, { status: 404 });
  }
  const student = studentDoc.data() as Student;
  if (student.schoolId !== decoded.uid) {
    return Response.json({ error: 'Forbidden' }, { status: 403 });
  }

  // 4b. Check for duplicate invoice (same student + term + session)
  const existing = await adminDb
    .collection('invoices')
    .where('studentId', '==', studentId)
    .where('term', '==', term)
    .where('session', '==', session)
    .limit(1)
    .get();

  if (!existing.empty) {
    return Response.json(
      {
        error: 'This student already has an invoice for this term and session',
        existingInvoiceId: existing.docs[0].id,
      },
      { status: 409 }
    );
  }

  // 5. Convert line items to kobo and assign IDs
  const processedLineItems: InvoiceLineItem[] = lineItems.map((li) => ({
    id: adminDb.collection('_').doc().id,
    description: li.description.trim(),
    amountDue: nairaToKobo(li.amountDue),
    amountPaid: 0,
    priority: li.priority,
    status: 'unpaid' as const,
  }));

  // 6. Calculate totals
  const { totalAmountDue } = calculateInvoiceTotals(processedLineItems);

  // 7. Build invoice document
  const invoiceId = adminDb.collection('invoices').doc().id;
  const now = new Date().toISOString();
  const invoice: Invoice = {
    id: invoiceId,
    studentId,
    schoolId: decoded.uid,
    term,
    session,
    lineItems: processedLineItems,
    totalAmountDue,
    totalAmountPaid: 0,
    outstandingBalance: totalAmountDue,
    status: 'unpaid',
    createdAt: now,
    updatedAt: now,
  };

  // 8. Write invoice AND update student balance atomically
  await adminDb.runTransaction(async (tx) => {
    const studentRef = adminDb.collection('students').doc(studentId);
    const invoiceRef = adminDb.collection('invoices').doc(invoiceId);

    tx.set(invoiceRef, invoice);
    // ADD to existing balance — student may have multiple invoices
    tx.update(studentRef, {
      outstandingBalance: student.outstandingBalance + totalAmountDue,
    });
  });

  // 9. Return created invoice
  return Response.json({ invoice }, { status: 201 });
}
