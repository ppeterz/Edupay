'use client';

// ──────────────────────────────────────────────
// EduPay — Invoice Card
// ──────────────────────────────────────────────
// Displays a single invoice with line item breakdown,
// status badges, and summary totals.

import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Pencil, Printer } from 'lucide-react';
import { kobotoNaira } from '@/lib/constants';
import { sortLineItemsByPriority } from '@/lib/invoice-helpers';
import type { Invoice, Student, Payment } from '@/types';

// ── Props ────────────────────────────────────

interface InvoiceCardProps {
  invoice: Invoice;
  student?: Student;
  schoolName?: string;
  allInvoices?: Invoice[];
  payments?: Payment[];
  onEdit?: (invoice: Invoice) => void;
}

// ── Status badge ─────────────────────────────

const STATUS_STYLES: Record<
  Invoice['status'],
  { label: string; className: string }
> = {
  unpaid: {
    label: 'Unpaid',
    className: 'border-red-200 bg-red-50 text-red-700',
  },
  partial: {
    label: 'Partial',
    className: 'border-amber-200 bg-amber-50 text-amber-700',
  },
  paid: {
    label: 'Paid',
    className: 'border-green-200 bg-green-50 text-green-700',
  },
  overpaid: {
    label: 'Overpaid',
    className: 'border-blue-200 bg-blue-50 text-blue-700',
  },
};

function LineItemStatusBadge({
  status,
}: {
  status: 'unpaid' | 'partial' | 'paid';
}) {
  const styles: Record<string, string> = {
    unpaid: 'text-gray-500',
    partial: 'text-amber-600',
    paid: 'text-green-600',
  };
  return (
    <span className={`text-xs font-medium ${styles[status]}`}>
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}

// ── Component ────────────────────────────────

export function InvoiceCard({ invoice, student, schoolName, allInvoices, payments, onEdit }: InvoiceCardProps) {
  const { label, className } = STATUS_STYLES[invoice.status];
  const sortedItems = sortLineItemsByPriority(invoice.lineItems);
  const isEditable = invoice.status === 'unpaid' && invoice.totalAmountPaid === 0;

  const handlePrint = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert('Please allow popups to print invoices.');
      return;
    }

    const sName = schoolName || 'EduPay School';

    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <title>Invoice - ${invoice.term} - ${student?.fullName || 'Student'}</title>
  <style>
    body {
      font-family: system-ui, -apple-system, sans-serif;
      color: #1e293b;
      margin: 40px;
      line-height: 1.5;
    }
    .header {
      display: flex;
      justify-content: space-between;
      border-bottom: 2px solid #e2e8f0;
      padding-bottom: 20px;
      margin-bottom: 30px;
    }
    .school-name {
      font-size: 24px;
      font-weight: 800;
      color: #0f172a;
    }
    .invoice-title {
      font-size: 20px;
      font-weight: 700;
      color: #475569;
    }
    .details {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 20px;
      margin-bottom: 40px;
    }
    .details-section h3 {
      font-size: 12px;
      font-weight: 700;
      color: #64748b;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      margin-bottom: 10px;
    }
    .field {
      font-size: 14px;
      margin-bottom: 6px;
    }
    .field-label {
      color: #64748b;
      font-weight: 500;
    }
    .field-value {
      font-weight: 600;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 40px;
    }
    th {
      background-color: #f8fafc;
      font-size: 12px;
      font-weight: 700;
      color: #475569;
      text-transform: uppercase;
      padding: 10px 14px;
      text-align: left;
      border-bottom: 1px solid #cbd5e1;
    }
    td {
      padding: 12px 14px;
      font-size: 14px;
      border-bottom: 1px solid #e2e8f0;
    }
    .text-right {
      text-align: right;
    }
    .summary-container {
      display: flex;
      justify-content: flex-end;
    }
    .summary-box {
      width: 300px;
      border: 1px solid #e2e8f0;
      border-radius: 6px;
      padding: 14px;
      background-color: #f8fafc;
    }
    .summary-row {
      display: flex;
      justify-content: space-between;
      font-size: 14px;
      margin-bottom: 8px;
    }
    .summary-row:last-child {
      margin-bottom: 0;
    }
    .summary-divider {
      border-bottom: 1px solid #e2e8f0;
      margin: 8px 0;
    }
    .total-due {
      font-weight: 700;
      color: #0f172a;
    }
    .total-paid {
      color: #16a34a;
      font-weight: 700;
    }
    .total-outstanding {
      color: #dc2626;
      font-weight: 700;
      font-size: 16px;
    }
    .settled {
      color: #16a34a;
      font-weight: 700;
      font-size: 16px;
    }
    .footer {
      margin-top: 60px;
      font-size: 11px;
      color: #94a3b8;
      text-align: center;
      border-top: 1px solid #e2e8f0;
      padding-top: 15px;
    }
    @media print {
      body {
        margin: 20px;
      }
      .no-print {
        display: none;
      }
    }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <div class="school-name">${sName}</div>
      <div style="font-size: 12px; color: #64748b; margin-top: 4px;">Student Invoice Document</div>
    </div>
    <div style="text-align: right;">
      <div class="invoice-title">INVOICE</div>
      <div style="font-size: 12px; color: #64748b; margin-top: 4px;">ID: ${invoice.id.toUpperCase()}</div>
    </div>
  </div>

  <div class="details">
    <div class="details-section">
      <h3>Student Details</h3>
      <div class="field">
        <span class="field-label">Name:</span>
        <span class="field-value">${student?.fullName || 'N/A'}</span>
      </div>
      <div class="field">
        <span class="field-label">Class:</span>
        <span class="field-value">${student?.class || 'N/A'}</span>
      </div>
      <div class="field">
        <span class="field-label">Admission No:</span>
        <span class="field-value">${student?.admissionNumber || 'N/A'}</span>
      </div>
    </div>
    <div class="details-section" style="text-align: right;">
      <h3>Billing Details</h3>
      <div class="field">
        <span class="field-label">Term:</span>
        <span class="field-value">${invoice.term}</span>
      </div>
      <div class="field">
        <span class="field-label">Session:</span>
        <span class="field-value">${invoice.session}</span>
      </div>
      <div class="field">
        <span class="field-label">Status:</span>
        <span class="field-value" style="text-transform: uppercase;">${invoice.status}</span>
      </div>
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th>Description</th>
        <th class="text-right">Priority</th>
        <th class="text-right">Amount Due</th>
        <th class="text-right">Amount Paid</th>
        <th class="text-right">Outstanding</th>
      </tr>
    </thead>
    <tbody>
      ${sortedItems.map(li => `
        <tr>
          <td>${li.description}</td>
          <td class="text-right">P${li.priority}</td>
          <td class="text-right">${kobotoNaira(li.amountDue)}</td>
          <td class="text-right">${kobotoNaira(li.amountPaid)}</td>
          <td class="text-right" style="font-weight: 500; ${li.amountDue - li.amountPaid > 0 ? 'color: #dc2626;' : 'color: #94a3b8;'}">
            ${li.amountDue - li.amountPaid > 0 ? kobotoNaira(li.amountDue - li.amountPaid) : '—'}
          </td>
        </tr>
      `).join('')}
    </tbody>
  </table>

  <div class="summary-container">
    <div class="summary-box">
      <div class="summary-row">
        <span>Total Due</span>
        <span class="total-due">${kobotoNaira(invoice.totalAmountDue)}</span>
      </div>
      <div class="summary-row">
        <span>Total Paid</span>
        <span class="total-paid">${kobotoNaira(invoice.totalAmountPaid)}</span>
      </div>
      <div class="summary-divider"></div>
      <div class="summary-row">
        <span>Outstanding Balance</span>
        ${invoice.outstandingBalance <= 0 
          ? '<span class="settled">SETTLED</span>'
          : `<span class="total-outstanding">${kobotoNaira(invoice.outstandingBalance)}</span>`
        }
      </div>
    </div>
  </div>

  <div class="footer">
    Generated by ${sName} Financial Reconciliation System &middot; Powered by EduPay
  </div>

  ${(() => {
    // Build balance carry-forward context if allInvoices is available
    if (!allInvoices || allInvoices.length === 0) return '';

    const getSessionYear = (session: string) => {
      const match = session.match(/^(\d{4})/);
      return match ? parseInt(match[1], 10) : 0;
    };

    const getTermWeight = (term: string) => {
      const t = term.toLowerCase().trim();
      if (t.includes('first')) return 1;
      if (t.includes('second')) return 2;
      if (t.includes('third')) return 3;
      return 4;
    };

    const sorted = [...allInvoices].sort((a, b) => {
      const sA = getSessionYear(a.session);
      const sB = getSessionYear(b.session);
      if (sA !== sB) return sA - sB;

      const tA = getTermWeight(a.term);
      const tB = getTermWeight(b.term);
      return tA - tB;
    });

    const currentIdx = sorted.findIndex(inv => inv.id === invoice.id);
    if (currentIdx < 0) return '';

    const termStart = new Date(invoice.createdAt).getTime();
    const termEnd = currentIdx < sorted.length - 1
      ? new Date(sorted[currentIdx + 1].createdAt).getTime()
      : Infinity;

    // Calculate opening outstanding at term start: charges minus payments before termStart
    const previousInvoices = sorted.slice(0, currentIdx);
    
    let openingOutstanding = 0;
    for (const prev of previousInvoices) {
      let allocatedBefore = 0;
      if (payments) {
        for (const payment of payments) {
          const payTime = new Date(payment.processedAt ?? payment.createdAt).getTime();
          if (payTime < termStart) {
            for (const alloc of payment.allocations) {
              if (alloc.invoiceId === prev.id) {
                allocatedBefore += alloc.amountAllocated;
              }
            }
          }
        }
      }
      openingOutstanding += Math.max(0, prev.totalAmountDue - allocatedBefore);
    }

    // Calculate how much past outstanding was cleared during this term
    let pastOutstandingCleared = 0;
    if (payments) {
      for (const payment of payments) {
        const payTime = new Date(payment.processedAt ?? payment.createdAt).getTime();
        if (payTime >= termStart && payTime < termEnd) {
          for (const alloc of payment.allocations) {
            const isPrior = previousInvoices.some((prev) => prev.id === alloc.invoiceId);
            if (isPrior) {
              pastOutstandingCleared += alloc.amountAllocated;
            }
          }
        }
      }
    }

    const termCharges = invoice.totalAmountDue;
    const termPayments = invoice.totalAmountPaid;
    const closingOutstanding = Math.max(0, openingOutstanding - pastOutstandingCleared + termCharges - termPayments);

    const totalOutstandingAll = sorted.reduce((s, inv) => s + inv.outstandingBalance, 0);
    const studentCredit = student?.creditBalance ?? 0;

    return `
      <div style="margin-top: 30px; border: 1px solid #cbd5e1; border-radius: 8px; overflow: hidden; background: #fefce8; break-inside: avoid;">
        <div style="padding: 12px 16px 8px; font-size: 13px; font-weight: 700; color: #0f172a;">Account Balance Carry-Forward Context</div>
        <div style="padding: 0 16px 4px; font-size: 10px; color: #64748b; margin: 0;">Ledger flow during the active period of ${invoice.term}</div>
        <table style="width: 100%; border-collapse: collapse; font-size: 12px;">
          <tbody>
            <tr>
              <td style="padding: 8px 16px; border-bottom: 1px solid #fef3c7; color: #64748b;">Opening Outstanding Balance (Carried Forward)</td>
              <td style="padding: 8px 16px; border-bottom: 1px solid #fef3c7; text-align: right; font-weight: 600; color: ${openingOutstanding > 0 ? '#dc2626' : '#16a34a'};">
                ${openingOutstanding > 0 ? kobotoNaira(openingOutstanding) : 'None'}
              </td>
            </tr>
            ${pastOutstandingCleared > 0 ? `
              <tr>
                <td style="padding: 8px 16px; border-bottom: 1px solid #fef3c7; color: #1d4ed8; font-weight: 500;">Past Outstanding Cleared during this Term</td>
                <td style="padding: 8px 16px; border-bottom: 1px solid #fef3c7; text-align: right; font-weight: 700; color: #1d4ed8;">
                  −${kobotoNaira(pastOutstandingCleared)}
                </td>
              </tr>
            ` : ''}
            <tr>
              <td style="padding: 8px 16px; border-bottom: 1px solid #fef3c7; color: #64748b;">This Term New Charges (${invoice.term})</td>
              <td style="padding: 8px 16px; border-bottom: 1px solid #fef3c7; text-align: right; font-weight: 600;">${kobotoNaira(termCharges)}</td>
            </tr>
            <tr>
              <td style="padding: 8px 16px; border-bottom: 1px solid #fef3c7; color: #64748b;">This Term Payments Received</td>
              <td style="padding: 8px 16px; border-bottom: 1px solid #fef3c7; text-align: right; font-weight: 600; color: #16a34a;">${kobotoNaira(termPayments)}</td>
            </tr>
            <tr>
              <td style="padding: 8px 16px; border-bottom: 1px solid #fef3c7; color: #64748b;">Closing Outstanding Balance (Carried Forward)</td>
              <td style="padding: 8px 16px; border-bottom: 1px solid #fef3c7; text-align: right; font-weight: 700; color: ${closingOutstanding > 0 ? '#dc2626' : '#16a34a'};">
                ${closingOutstanding > 0 ? kobotoNaira(closingOutstanding) : 'SETTLED'}
              </td>
            </tr>
            <tr style="border-top: 2px solid #fde68a; background-color: #fef9c3;">
              <td style="padding: 10px 16px; font-weight: 700; color: #0f172a;">Current Student Outstanding (All Terms Combined)</td>
              <td style="padding: 10px 16px; text-align: right; font-weight: 800; font-size: 14px; color: ${totalOutstandingAll > 0 ? '#dc2626' : '#16a34a'};">
                ${totalOutstandingAll > 0 ? kobotoNaira(totalOutstandingAll) : 'FULLY SETTLED'}
              </td>
            </tr>
            ${studentCredit > 0 ? `
              <tr>
                <td style="padding: 8px 16px; border-top: 1px solid #fde68a; color: #1d4ed8; font-weight: 600;">Available Credit Balance</td>
                <td style="padding: 8px 16px; border-top: 1px solid #fde68a; text-align: right; font-weight: 700; color: #1d4ed8;">${kobotoNaira(studentCredit)}</td>
              </tr>
            ` : ''}
          </tbody>
        </table>
      </div>
    `;
  })()}

  <script>
    window.onload = function() {
      setTimeout(function() {
        window.print();
        window.close();
      }, 500);
    };
  </script>
</body>
</html>
    `;

    printWindow.document.open();
    printWindow.document.write(htmlContent);
    printWindow.document.close();
  };

  return (
    <Card className="overflow-hidden">
      {/* Header: Term + Status + Optional Edit button + Optional Print button */}
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
        <h3 className="text-sm font-semibold text-gray-900">
          {invoice.term} &mdash; {invoice.session}
        </h3>
        <div className="flex items-center gap-2">
          {isEditable && onEdit && (
            <Button
              variant="outline"
              size="sm"
              className="h-8 px-2 text-xs"
              onClick={() => onEdit(invoice)}
            >
              <Pencil className="mr-1.5 h-3.5 w-3.5" />
              Edit
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            className="h-8 px-2 text-xs"
            onClick={handlePrint}
          >
            <Printer className="mr-1.5 h-3.5 w-3.5" />
            Print
          </Button>
          <Badge variant="secondary" className={className}>
            {label}
          </Badge>
        </div>
      </CardHeader>

      {/* Line items table */}
      <CardContent className="pb-3">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-xs">Description</TableHead>
              <TableHead className="text-right text-xs">
                Amount Due
              </TableHead>
              <TableHead className="text-right text-xs">
                Amount Paid
              </TableHead>
              <TableHead className="text-right text-xs">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedItems.map((li) => (
              <TableRow key={li.id}>
                <TableCell className="text-sm">{li.description}</TableCell>
                <TableCell className="text-right text-sm">
                  {kobotoNaira(li.amountDue)}
                </TableCell>
                <TableCell
                  className={`text-right text-sm ${
                    li.amountPaid > 0 ? 'text-green-600' : ''
                  }`}
                >
                  {kobotoNaira(li.amountPaid)}
                </TableCell>
                <TableCell className="text-right">
                  <LineItemStatusBadge status={li.status} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>

      {/* Footer summary */}
      <CardFooter className="flex flex-col items-end gap-1 border-t bg-gray-50 px-6 py-3">
        <div className="text-sm text-gray-600">
          Total Due:{' '}
          <span className="font-medium text-gray-900">
            {kobotoNaira(invoice.totalAmountDue)}
          </span>
        </div>
        {invoice.totalAmountPaid > 0 && (
          <div className="text-sm text-gray-600">
            Total Paid:{' '}
            <span className="font-medium text-green-600">
              {kobotoNaira(invoice.totalAmountPaid)}
            </span>
          </div>
        )}
        <div className="text-sm text-gray-600">
          Outstanding:{' '}
          <span
            className={`font-bold ${
              invoice.outstandingBalance > 0
                ? 'text-red-600'
                : 'text-gray-400'
            }`}
          >
            {invoice.outstandingBalance > 0
              ? kobotoNaira(invoice.outstandingBalance)
              : '—'}
          </span>
        </div>
      </CardFooter>
    </Card>
  );
}
