'use client';

// ──────────────────────────────────────────────
// EduPay — Invoice Edit Actions
// ──────────────────────────────────────────────
// Action bar for paymentStatus mode in StudentInvoiceTable.
// Lets admin edit existing invoice line item amounts and priorities.
// Calls PATCH /api/invoices/[id]/merge with updateLineItems only.

import { useState } from 'react';
import { getFirebaseAuth } from '@/lib/firebase';
import { kobotoNaira, nairaToKobo } from '@/lib/constants';
import type { StudentWithInvoice } from '@/components/invoices/StudentInvoiceTable';
import type { Invoice } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, CheckCircle2, AlertTriangle } from 'lucide-react';

type ApplyStatus = 'idle' | 'loading' | 'success' | 'error';

interface InvoiceEditActionsProps {
  student: StudentWithInvoice;
  onSuccess?: () => void;
}

export function InvoiceEditActions({ student, onSuccess }: InvoiceEditActionsProps) {
  const inv = student.existingInvoice as Invoice;

  // Editable state per line item: keyed by lineItemId
  const [amounts, setAmounts] = useState<Record<string, string>>(() =>
    Object.fromEntries(inv.lineItems.map((li) => [li.id, (li.amountDue / 100).toFixed(2)]))
  );
  const [priorities, setPriorities] = useState<Record<string, string>>(() =>
    Object.fromEntries(inv.lineItems.map((li) => [li.id, String(li.priority)]))
  );

  const [status, setStatus] = useState<ApplyStatus>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  async function handleApply() {
    // Build updateLineItems — only include actually-changed fields
    const updateLineItems: { lineItemId: string; newAmountDue?: number; newPriority?: number }[] = [];

    for (const li of inv.lineItems) {
      const rawAmt = amounts[li.id];
      const rawPri = priorities[li.id];
      const naira = parseFloat(rawAmt);
      const priority = parseInt(rawPri, 10);

      const amtChanged = !isNaN(naira) && naira > 0 && nairaToKobo(naira) !== li.amountDue;
      const priChanged = !isNaN(priority) && priority >= 1 && priority !== li.priority;

      if (amtChanged || priChanged) {
        updateLineItems.push({
          lineItemId: li.id,
          ...(amtChanged ? { newAmountDue: naira } : {}),
          ...(priChanged ? { newPriority: priority } : {}),
        });
      }
    }

    if (updateLineItems.length === 0) {
      setStatus('error');
      setErrorMsg('No changes detected — edit at least one amount or priority');
      return;
    }

    setStatus('loading');
    setErrorMsg('');

    try {
      const auth = getFirebaseAuth();
      const token = await auth.currentUser?.getIdToken();
      if (!token) throw new Error('Not authenticated');

      const res = await fetch(`/api/invoices/${inv.id}/merge`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ addLineItems: [], updateLineItems }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? `HTTP ${res.status}`);
      }

      setStatus('success');
      onSuccess?.();
    } catch (err: unknown) {
      setStatus('error');
      setErrorMsg(err instanceof Error ? err.message : 'Failed to update invoice');
    }
  }

  if (status === 'success') {
    return (
      <div className="flex items-center gap-2 text-sm text-green-700">
        <CheckCircle2 className="h-4 w-4" />
        Invoice updated
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Current invoice summary */}
      <div className="overflow-hidden rounded-md border border-gray-200 bg-white text-sm">
        <table className="w-full">
          <thead className="bg-gray-50 text-xs text-gray-500">
            <tr>
              <th className="px-3 py-2 text-left font-medium">Item</th>
              <th className="px-3 py-2 text-center font-medium">Priority</th>
              <th className="px-3 py-2 text-right font-medium">Amount</th>
              <th className="px-3 py-2 text-right font-medium">Paid</th>
            </tr>
          </thead>
          <tbody>
            {inv.lineItems.map((li) => (
              <tr key={li.id} className="border-t border-gray-100">
                <td className="px-3 py-2 text-gray-800">{li.description}</td>
                <td className="px-3 py-2 text-center">
                  <Input
                    className="h-7 w-14 bg-white text-center text-xs mx-auto"
                    type="number"
                    min="1"
                    value={priorities[li.id] ?? ''}
                    onChange={(e) =>
                      setPriorities((prev) => ({ ...prev, [li.id]: e.target.value }))
                    }
                  />
                </td>
                <td className="px-3 py-2 text-right">
                  <div className="relative w-28 ml-auto">
                    <span className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                      ₦
                    </span>
                    <Input
                      className="h-7 bg-white pl-5 text-xs text-right"
                      type="number"
                      min="0.01"
                      step="0.01"
                      value={amounts[li.id] ?? ''}
                      onChange={(e) =>
                        setAmounts((prev) => ({ ...prev, [li.id]: e.target.value }))
                      }
                    />
                  </div>
                </td>
                <td className={`px-3 py-2 text-right tabular-nums text-xs ${li.amountPaid > 0 ? 'text-green-600' : 'text-gray-300'}`}>
                  {kobotoNaira(li.amountPaid)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {status === 'error' && (
        <div className="flex items-center gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          {errorMsg}
        </div>
      )}

      <div className="flex justify-end">
        <Button size="sm" onClick={handleApply} disabled={status === 'loading'}>
          {status === 'loading' ? (
            <>
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              Saving…
            </>
          ) : (
            'Save Changes'
          )}
        </Button>
      </div>
    </div>
  );
}
