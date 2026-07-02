// ──────────────────────────────────────────────
// EduPay — Invoice Merge API Route (PATCH)
// ──────────────────────────────────────────────
// Applies selective changes to ONE existing invoice:
//   - addLineItems: new line items appended to the invoice
//   - updateLineItems: update amountDue and/or priority on specific existing line items
//
// Adjusts student.outstandingBalance by delta (never overwrites).
// Recalculates invoice status from actual paid amounts.

import { NextRequest } from 'next/server';
import { verifyAuthToken, unauthorized, badRequest } from '@/lib/auth-helpers';
import { getAdminDb } from '@/lib/firebase-admin';
import { calculateInvoiceTotals, deriveInvoiceStatus } from '@/lib/invoice-helpers';
import { nairaToKobo } from '@/lib/constants';
import type { Student, Invoice, InvoiceLineItem } from '@/types';

interface RouteContext {
  params: Promise<{ id: string }>;
}

interface MergeBody {
  addLineItems?: { description: string; amountDue: number; priority: number }[];
  updateLineItems?: { lineItemId: string; newAmountDue?: number; newPriority?: number }[];
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  // 1. Verify auth token
  const decoded = await verifyAuthToken(request);
  if (!decoded) return unauthorized();

  const { id: invoiceId } = await context.params;
  const adminDb = getAdminDb();

  // 2. Parse body
  let body: MergeBody;
  try {
    body = await request.json();
  } catch {
    return badRequest('Invalid request body');
  }

  const addLineItems = body.addLineItems ?? [];
  const updateLineItems = body.updateLineItems ?? [];

  if (addLineItems.length === 0 && updateLineItems.length === 0) {
    return badRequest('No changes provided');
  }

  // 3. Validate addLineItems
  for (const li of addLineItems) {
    if (!li.description || li.description.trim() === '') {
      return badRequest('Every added line item needs a description');
    }
    if (typeof li.amountDue !== 'number' || li.amountDue <= 0) {
      return badRequest('Every added line item amount must be a positive number');
    }
    if (typeof li.priority !== 'number' || li.priority < 1) {
      return badRequest('Every added line item needs a valid priority (1 or higher)');
    }
  }

  // 4. Validate updateLineItems
  for (const u of updateLineItems) {
    if (!u.lineItemId || typeof u.lineItemId !== 'string') {
      return badRequest('updateLineItems: lineItemId is required');
    }
    if (u.newAmountDue !== undefined && (typeof u.newAmountDue !== 'number' || u.newAmountDue <= 0)) {
      return badRequest('updateLineItems: newAmountDue must be a positive number');
    }
    if (u.newPriority !== undefined && (typeof u.newPriority !== 'number' || u.newPriority < 1)) {
      return badRequest('updateLineItems: newPriority must be a valid number (1 or higher)');
    }
    if (u.newAmountDue === undefined && u.newPriority === undefined) {
      return badRequest('updateLineItems: either newAmountDue or newPriority must be provided');
    }
  }

  // 5. Fetch invoice to validate and check priorities BEFORE the transaction
  const invoiceDoc = await adminDb.collection('invoices').doc(invoiceId).get();
  if (!invoiceDoc.exists) {
    return Response.json({ error: 'Invoice not found' }, { status: 404 });
  }

  const invoice = invoiceDoc.data() as Invoice;
  if (invoice.schoolId !== decoded.uid) {
    return Response.json({ error: 'Forbidden' }, { status: 403 });
  }

  // Validate all updateLineItems reference existing line items
  const lineItemIds = new Set(invoice.lineItems.map((li) => li.id));
  for (const u of updateLineItems) {
    if (!lineItemIds.has(u.lineItemId)) {
      return badRequest(`Line item ${u.lineItemId} not found in this invoice`);
    }
  }

  // 6. Priority collision check (pre-transaction, fails fast)
  const updateMap = new Map(updateLineItems.map((u) => [u.lineItemId, u]));
  const finalPriorities: number[] = [];

  for (const li of invoice.lineItems) {
    const update = updateMap.get(li.id);
    if (update && update.newPriority !== undefined) {
      finalPriorities.push(update.newPriority);
    } else {
      finalPriorities.push(li.priority);
    }
  }

  for (const li of addLineItems) {
    finalPriorities.push(li.priority);
  }

  if (new Set(finalPriorities).size !== finalPriorities.length) {
    return badRequest('Priority conflict — choose a different priority for line items');
  }

  // 7. Run transaction
  try {
    const result = await adminDb.runTransaction(async (tx) => {
      // Fresh reads inside the transaction
      const invoiceRef = adminDb.collection('invoices').doc(invoiceId);
      const freshInvoiceDoc = await tx.get(invoiceRef);
      if (!freshInvoiceDoc.exists) throw new Error('404:Invoice not found');

      const freshInvoice = freshInvoiceDoc.data() as Invoice;
      if (freshInvoice.schoolId !== decoded.uid) throw new Error('403:Forbidden');

      const studentRef = adminDb.collection('students').doc(freshInvoice.studentId);
      const studentDoc = await tx.get(studentRef);
      if (!studentDoc.exists) throw new Error('404:Student not found');
      const student = studentDoc.data() as Student;

      // Build updated line items array
      let newLineItems: InvoiceLineItem[] = freshInvoice.lineItems.map((li) => {
        const update = updateLineItems.find((u) => u.lineItemId === li.id);
        if (update) {
          const item = { ...li };
          if (update.newAmountDue !== undefined) {
            const newAmountDue = nairaToKobo(update.newAmountDue);
            // Recalculate per-item status based on new amountDue vs existing amountPaid
            let newStatus: InvoiceLineItem['status'];
            if (li.amountPaid === 0) {
              newStatus = 'unpaid';
            } else if (li.amountPaid < newAmountDue) {
              newStatus = 'partial';
            } else {
              newStatus = 'paid';
            }
            item.amountDue = newAmountDue;
            item.status = newStatus;
          }
          if (update.newPriority !== undefined) {
            item.priority = update.newPriority;
          }
          return item;
        }
        return li;
      });

      // Append new line items
      for (const li of addLineItems) {
        const newItem: InvoiceLineItem = {
          id: adminDb.collection('_').doc().id,
          description: li.description.trim(),
          amountDue: nairaToKobo(li.amountDue),
          amountPaid: 0,
          priority: li.priority,
          status: 'unpaid',
        };
        newLineItems = [...newLineItems, newItem];
      }

      // Recalculate totals and derive status
      const { totalAmountDue, totalAmountPaid, outstandingBalance } =
        calculateInvoiceTotals(newLineItems);
      const newStatus = deriveInvoiceStatus(totalAmountDue, totalAmountPaid);

      // Delta for student outstanding balance — NEVER overwrite
      const oldOutstanding = freshInvoice.outstandingBalance;
      const delta = outstandingBalance - oldOutstanding;

      const updatedInvoice: Invoice = {
        ...freshInvoice,
        lineItems: newLineItems,
        totalAmountDue,
        totalAmountPaid,
        outstandingBalance,
        status: newStatus,
        updatedAt: new Date().toISOString(),
      };

      tx.update(invoiceRef, {
        lineItems: newLineItems,
        totalAmountDue,
        totalAmountPaid,
        outstandingBalance,
        status: newStatus,
        updatedAt: updatedInvoice.updatedAt,
      });

      tx.update(studentRef, {
        outstandingBalance: student.outstandingBalance + delta,
      });

      return updatedInvoice;
    });

    return Response.json({ invoice: result }, { status: 200 });
  } catch (err: any) {
    const msg = err.message || '';
    if (msg.startsWith('404:')) {
      return Response.json({ error: msg.substring(4) }, { status: 404 });
    }
    if (msg.startsWith('403:')) {
      return Response.json({ error: msg.substring(4) }, { status: 403 });
    }
    console.error('Invoice merge transaction failed:', err);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}

