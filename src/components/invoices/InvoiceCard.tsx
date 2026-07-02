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
import { Pencil } from 'lucide-react';
import { kobotoNaira } from '@/lib/constants';
import { sortLineItemsByPriority } from '@/lib/invoice-helpers';
import type { Invoice } from '@/types';

// ── Props ────────────────────────────────────

interface InvoiceCardProps {
  invoice: Invoice;
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

export function InvoiceCard({ invoice, onEdit }: InvoiceCardProps) {
  const { label, className } = STATUS_STYLES[invoice.status];
  const sortedItems = sortLineItemsByPriority(invoice.lineItems);
  const isEditable = invoice.status === 'unpaid' && invoice.totalAmountPaid === 0;

  return (
    <Card className="overflow-hidden">
      {/* Header: Term + Status + Optional Edit button */}
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
