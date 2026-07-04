import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';
import { generateReceiptPdfBuffer } from '@/lib/receipt-generator';
import type { Payment, Student, Invoice, School } from '@/types';

export const runtime = 'nodejs';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: 'Missing receipt ID' }, { status: 400 });
  }

  try {
    const adminDb = getAdminDb();
    
    // 1. Fetch Payment
    const paymentDoc = await adminDb.collection('payments').doc(id).get();
    if (!paymentDoc.exists) {
      return NextResponse.json({ error: 'Payment not found' }, { status: 404 });
    }
    const payment = paymentDoc.data() as Payment;

    // 2. Fetch Student
    const studentDoc = await adminDb.collection('students').doc(payment.studentId).get();
    if (!studentDoc.exists) {
      return NextResponse.json({ error: 'Student not found' }, { status: 404 });
    }
    const student = studentDoc.data() as Student;

    // 3. Fetch School
    const schoolDoc = await adminDb.collection('schools').doc(student.schoolId).get();
    if (!schoolDoc.exists) {
      return NextResponse.json({ error: 'School not found' }, { status: 404 });
    }
    const school = schoolDoc.data() as School;

    // 4. Fetch Invoice (optional)
    let invoice: Invoice;
    if (payment.invoiceId) {
      const invoiceDoc = await adminDb.collection('invoices').doc(payment.invoiceId).get();
      if (invoiceDoc.exists) {
        invoice = invoiceDoc.data() as Invoice;
      } else {
        // Mock fallback invoice
        invoice = {
          id: payment.invoiceId,
          studentId: student.id,
          schoolId: student.schoolId,
          term: 'First Term',
          session: '2025/2026',
          lineItems: [],
          totalAmountDue: payment.amount,
          totalAmountPaid: payment.amount,
          outstandingBalance: 0,
          status: 'paid',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
      }
    } else {
      // Mock fallback invoice
      invoice = {
        id: 'no-invoice',
        studentId: student.id,
        schoolId: student.schoolId,
        term: 'First Term',
        session: '2025/2026',
        lineItems: [],
        totalAmountDue: payment.amount,
        totalAmountPaid: payment.amount,
        outstandingBalance: 0,
        status: 'paid',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
    }

    // 5. Generate PDF Buffer
    const buffer = await generateReceiptPdfBuffer(payment, student, invoice, school);

    // 6. Return response stream as application/pdf
    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'inline; filename="receipt.pdf"',
        'Cache-Control': 'no-store, max-age=0'
      }
    });

  } catch (err) {
    console.error('[receipts-api] Failed to render PDF receipt:', err);
    return NextResponse.json(
      { error: 'Failed to generate PDF', details: String(err) },
      { status: 500 }
    );
  }
}
