// ──────────────────────────────────────────────
// EduPay — Invoice Detail API Route (GET)
// ──────────────────────────────────────────────
// Fetch a single invoice by ID.

import { NextRequest } from 'next/server';
import { verifyAuthToken, unauthorized, badRequest } from '@/lib/auth-helpers';
import { getAdminDb } from '@/lib/firebase-admin';
import { validateLineItems, calculateInvoiceTotals } from '@/lib/invoice-helpers';
import { nairaToKobo } from '@/lib/constants';
import type { Student, Invoice, InvoiceLineItem } from '@/types';

export const runtime = 'nodejs';

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, context: RouteContext) {
  // 1. Verify auth token
  const decoded = await verifyAuthToken(request);
  if (!decoded) return unauthorized();

  const { id } = await context.params;
  const adminDb = getAdminDb();

  // 2. Fetch invoice doc
  const doc = await adminDb.collection('invoices').doc(id).get();
  if (!doc.exists) {
    return Response.json({ error: 'Invoice not found' }, { status: 404 });
  }

  const invoice = doc.data() as Invoice;

  // 3. Ownership check
  if (invoice.schoolId !== decoded.uid) {
    return Response.json({ error: 'Forbidden' }, { status: 403 });
  }

  // 4. Return
  return Response.json({ invoice }, { status: 200 });
}

const VALID_TERMS = ['First Term', 'Second Term', 'Third Term'];

export async function PATCH(request: NextRequest, context: RouteContext) {
  // 1. Verify auth token
  const decoded = await verifyAuthToken(request);
  if (!decoded) return unauthorized();

  const { id: invoiceId } = await context.params;
  const adminDb = getAdminDb();

  // 2. Parse body
  let body: {
    term?: string;
    session?: string;
    lineItems?: { description: string; amountDue: number; priority: number }[];
  };
  try {
    body = await request.json();
  } catch {
    return badRequest('Invalid request body');
  }

  const { term, session, lineItems } = body;

  // 3. Validate inputs
  if (!term || !VALID_TERMS.includes(term)) {
    return badRequest('term must be one of: First Term, Second Term, Third Term');
  }
  if (!session || typeof session !== 'string' || !session.includes('/')) {
    return badRequest('session is required and must contain "/" (e.g. 2025/2026)');
  }
  if (!lineItems) {
    return badRequest('lineItems is required');
  }
  const lineItemError = validateLineItems(lineItems);
  if (lineItemError) {
    return badRequest(lineItemError);
  }

  // 4. Atomic transaction to read, verify status, and write update
  try {
    const result = await adminDb.runTransaction(async (tx) => {
      const invoiceRef = adminDb.collection('invoices').doc(invoiceId);
      const invoiceDoc = await tx.get(invoiceRef);

      if (!invoiceDoc.exists) {
        throw new Error('404:Invoice not found');
      }

      const invoice = invoiceDoc.data() as Invoice;
      if (invoice.schoolId !== decoded.uid) {
        throw new Error('403:Forbidden');
      }

      // Safeguard: only allow editing unpaid invoices
      if (invoice.status !== 'unpaid' || invoice.totalAmountPaid > 0) {
        throw new Error('400:Only unpaid invoices can be edited');
      }

      const studentRef = adminDb.collection('students').doc(invoice.studentId);
      const studentDoc = await tx.get(studentRef);
      if (!studentDoc.exists) {
        throw new Error('404:Student not found');
      }
      const student = studentDoc.data() as Student;

      // 5. Convert new line items to kobo and assign IDs
      const processedLineItems: InvoiceLineItem[] = lineItems.map((li) => ({
        id: adminDb.collection('_').doc().id,
        description: li.description.trim(),
        amountDue: nairaToKobo(li.amountDue),
        amountPaid: 0,
        priority: li.priority,
        status: 'unpaid' as const,
      }));

      // 6. Calculate new totals
      const { totalAmountDue: newTotalAmountDue } = calculateInvoiceTotals(processedLineItems);
      const oldTotalAmountDue = invoice.totalAmountDue;

      // 7. Update invoice document
      const updatedInvoice: Invoice = {
        ...invoice,
        term,
        session: session.trim(),
        lineItems: processedLineItems,
        totalAmountDue: newTotalAmountDue,
        outstandingBalance: newTotalAmountDue,
        updatedAt: new Date().toISOString(),
      };

      // 8. Update database docs
      tx.set(invoiceRef, updatedInvoice);
      tx.update(studentRef, {
        outstandingBalance: student.outstandingBalance - oldTotalAmountDue + newTotalAmountDue,
      });

      return updatedInvoice;
    });

    return Response.json({ invoice: result }, { status: 200 });
  } catch (err) {
    const error = err as Error;
    const msg = error.message || '';
    if (msg.startsWith('404:')) {
      return Response.json({ error: msg.substring(4) }, { status: 404 });
    }
    if (msg.startsWith('403:')) {
      return Response.json({ error: msg.substring(4) }, { status: 403 });
    }
    if (msg.startsWith('400:')) {
      return Response.json({ error: msg.substring(4) }, { status: 400 });
    }
    console.error('Invoice update transaction failed:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
