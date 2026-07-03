// ──────────────────────────────────────────────
// EduPay — Bulk Invoice Create API Route (POST)
// ──────────────────────────────────────────────
// Creates invoices for an entire class or class category.
// Skips students who already have an invoice for the target term/session.
// Uses batched writes chunked at 200 students (400 ops) per batch.

import { NextRequest } from 'next/server';
import { verifyAuthToken, unauthorized, badRequest } from '@/lib/auth-helpers';
import { getAdminDb } from '@/lib/firebase-admin';
import {
  validateLineItems,
  calculateInvoiceTotals,
  groupSkippedByClass,
  type SkippedStudentEntry,
} from '@/lib/invoice-helpers';
import { nairaToKobo, CLASS_CATEGORIES } from '@/lib/constants';
import type { Student, Invoice, InvoiceLineItem } from '@/types';

export const runtime = 'nodejs';

const VALID_TERMS = ['First Term', 'Second Term', 'Third Term'];
const CHUNK_SIZE = 200; // 200 students × 2 ops = 400 ops per batch (under 500 limit)

export async function POST(request: NextRequest) {
  // 1. Verify auth token
  const decoded = await verifyAuthToken(request);
  if (!decoded) return unauthorized();

  const schoolId = decoded.uid;
  const adminDb = getAdminDb();

  // 2. Parse body
  let body: {
    target?: { type: string; value: string };
    term?: string;
    session?: string;
    lineItems?: { description: string; amountDue: number; priority: number }[];
  };
  try {
    body = await request.json();
  } catch {
    return badRequest('Invalid request body');
  }

  const { target, term, session, lineItems } = body;

  // 3. Validate inputs
  if (!target || !target.type || !target.value) {
    return badRequest('target is required with type and value');
  }
  if (target.type !== 'class' && target.type !== 'category') {
    return badRequest('target.type must be "class" or "category"');
  }
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

  // 4. Resolve target classes
  let targetClasses: string[];
  if (target.type === 'class') {
    targetClasses = [target.value];
  } else {
    const classes = CLASS_CATEGORIES[target.value as keyof typeof CLASS_CATEGORIES];
    if (!classes) {
      return badRequest('Unknown class category');
    }
    targetClasses = [...classes];
  }

  // 5. Fetch all non-deleted students matching those classes
  const studentsSnapshot = await adminDb
    .collection('students')
    .where('schoolId', '==', schoolId)
    .where('class', 'in', targetClasses)
    .get();

  const students = studentsSnapshot.docs
    .map((doc) => doc.data() as Student)
    .filter((s) => !s.deletedAt);

  if (students.length === 0) {
    return Response.json(
      { error: 'No students found in the selected class(es)' },
      { status: 404 }
    );
  }

  // 6. Check for existing invoices (prevent double-billing)
  const existingChecks = await Promise.all(
    students.map((s) =>
      adminDb
        .collection('invoices')
        .where('studentId', '==', s.id)
        .where('term', '==', term)
        .where('session', '==', session)
        .limit(1)
        .get()
    )
  );

  const studentsToInvoice = students.filter((_, i) => existingChecks[i].empty);
  const skippedStudents = students.filter((_, i) => !existingChecks[i].empty);

  // 7. Convert line items to kobo ONCE (shared template)
  const baseLineItems = lineItems.map((li) => ({
    description: li.description.trim(),
    amountDue: nairaToKobo(li.amountDue),
    priority: li.priority,
  }));

  const bulkTemplate = { term, session, lineItems: baseLineItems };

  // Enrich skipped students with their existing invoice (for review UI)
  const skippedWithInvoices: SkippedStudentEntry[] = skippedStudents.map((student) => {
    const idx = students.findIndex((s) => s.id === student.id);
    const existingInvoice = existingChecks[idx].docs[0].data() as Invoice;
    return {
      studentId: student.id,
      studentName: student.fullName,
      class: student.class,
      existingInvoice,
    };
  });
  const skippedByClass = groupSkippedByClass(skippedWithInvoices);

  if (studentsToInvoice.length === 0) {
    return Response.json(
      {
        created: 0,
        skipped: skippedByClass.reduce((n, g) => n + g.students.length, 0),
        skippedByClass,
        bulkTemplate,
        skippedReason: 'All selected students already have an invoice for this term/session',
        details: [],
      },
      { status: 200 }
    );
  }

  // 8. Write invoices using batched writes, chunked at CHUNK_SIZE
  const results: { studentId: string; studentName: string; invoiceId: string }[] = [];

  for (let i = 0; i < studentsToInvoice.length; i += CHUNK_SIZE) {
    const chunk = studentsToInvoice.slice(i, i + CHUNK_SIZE);
    const batch = adminDb.batch();

    for (const student of chunk) {
      const invoiceId = adminDb.collection('invoices').doc().id;
      const now = new Date().toISOString();

      // Each student gets their own line item instances (unique IDs)
      const processedLineItems: InvoiceLineItem[] = baseLineItems.map((li) => ({
        id: adminDb.collection('_').doc().id,
        description: li.description,
        amountDue: li.amountDue,
        amountPaid: 0,
        priority: li.priority,
        status: 'unpaid' as const,
      }));

      const { totalAmountDue } = calculateInvoiceTotals(processedLineItems);

      const invoice: Invoice = {
        id: invoiceId,
        studentId: student.id,
        schoolId,
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

      const invoiceRef = adminDb.collection('invoices').doc(invoiceId);
      batch.set(invoiceRef, invoice);

      // ADD to existing balance — student may have other invoices
      const studentRef = adminDb.collection('students').doc(student.id);
      batch.update(studentRef, {
        outstandingBalance: student.outstandingBalance + totalAmountDue,
      });

      results.push({
        studentId: student.id,
        studentName: student.fullName,
        invoiceId,
      });
    }

    await batch.commit();
  }

  // 9. Return summary
  return Response.json(
    {
      created: results.length,
      skipped: skippedByClass.reduce((n, g) => n + g.students.length, 0),
      skippedByClass,
      bulkTemplate,
      details: results,
    },
    { status: 201 }
  );
}
