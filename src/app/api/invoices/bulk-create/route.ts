// ──────────────────────────────────────────────
// EduPay — Bulk Invoice Create API Route (POST)
// ──────────────────────────────────────────────
// Creates invoices for an entire class or class category.
// Skips students who already have an invoice for the target term/session.
// Uses batched writes chunked at 200 students (400 ops) per batch.
//
// After the batch commits:
//   1. Persists a trimmed run summary to bulk_invoice_runs (Admin SDK).
//      If that write fails it is logged but does NOT fail the request.
//   2. Updates lastUsedTermSession on the school document (non-critical).
// Returns runId (null on persistence failure) alongside the full inline payload.

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

  // Enrich skipped students — trim existingInvoice to { id, lineItems } only
  // (diff logic needs lineItems; other fields would bloat the run doc)
  const skippedWithInvoices: SkippedStudentEntry[] = skippedStudents.map((student) => {
    const idx = students.findIndex((s) => s.id === student.id);
    const existingInvoice = existingChecks[idx].docs[0].data() as Invoice;
    return {
      studentId: student.id,
      studentName: student.fullName,
      class: student.class,
      // Trimmed: only id + lineItems (drop timestamps, totals, schoolId duplication)
      existingInvoice: {
        id: existingInvoice.id,
        lineItems: existingInvoice.lineItems.map((li) => ({
          id: li.id,
          description: li.description,
          amountDue: li.amountDue,
          amountPaid: li.amountPaid,
          priority: li.priority,
          status: li.status,
        })),
      } as unknown as Invoice,
    };
  });
  const skippedByClass = groupSkippedByClass(skippedWithInvoices);

  if (studentsToInvoice.length === 0) {
    // Nothing to create — persist the run and return
    const totalSkipped = skippedByClass.reduce((n, g) => n + g.students.length, 0);
    const details: { studentId: string; invoiceId: string }[] = [];
    const runId = await persistRun(adminDb, schoolId, target, bulkTemplate, 0, totalSkipped, skippedByClass, details);
    await updateLastUsedTermSession(adminDb, schoolId, term, session);

    return Response.json(
      {
        runId,
        created: 0,
        skipped: totalSkipped,
        skippedByClass,
        bulkTemplate,
        skippedReason: 'All selected students already have an invoice for this term/session',
        details,
      },
      { status: 200 }
    );
  }

  // 8. Write invoices using batched writes, chunked at CHUNK_SIZE
  const results: { studentId: string; invoiceId: string }[] = [];

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

      // Trimmed: only studentId + invoiceId (results page needs counts/links, not full bodies)
      results.push({ studentId: student.id, invoiceId });
    }

    await batch.commit();
  }

  // 9. Persist run doc immediately after all batches commit (no intermediary awaits).
  //    If persistence fails, we catch and continue — the full payload is in the response.
  const totalSkipped = skippedByClass.reduce((n, g) => n + g.students.length, 0);
  const runId = await persistRun(adminDb, schoolId, target, bulkTemplate, results.length, totalSkipped, skippedByClass, results);

  // 10. Update lastUsedTermSession on school doc (non-critical)
  await updateLastUsedTermSession(adminDb, schoolId, term, session);

  // 11. Return summary
  return Response.json(
    {
      runId,           // null if persistence failed — client handles gracefully
      created: results.length,
      skipped: totalSkipped,
      skippedByClass,
      bulkTemplate,
      details: results,
    },
    { status: 201 }
  );
}

// ── Helpers ──────────────────────────────────

async function persistRun(
  adminDb: ReturnType<typeof getAdminDb>,
  schoolId: string,
  target: { type: string; value: string },
  bulkTemplate: { term: string; session: string; lineItems: { description: string; amountDue: number; priority: number }[] },
  created: number,
  skipped: number,
  skippedByClass: ReturnType<typeof groupSkippedByClass>,
  details: { studentId: string; invoiceId: string }[]
): Promise<string | null> {
  try {
    const runRef = adminDb.collection('bulk_invoice_runs').doc();
    await runRef.set({
      id: runRef.id,
      schoolId,
      target,
      bulkTemplate,
      created,
      skipped,
      skippedByClass,
      details,
      createdAt: new Date().toISOString(),
    });
    return runRef.id;
  } catch (err) {
    console.error('[bulk-create] bulk_invoice_runs persistence failed — returning inline only:', err);
    return null;
  }
}

async function updateLastUsedTermSession(
  adminDb: ReturnType<typeof getAdminDb>,
  schoolId: string,
  term: string,
  session: string
): Promise<void> {
  try {
    await adminDb.collection('schools').doc(schoolId).update({
      lastUsedTermSession: { term, session },
    });
  } catch (err) {
    // Non-critical — log and continue
    console.error('[bulk-create] Failed to update lastUsedTermSession:', err);
  }
}
