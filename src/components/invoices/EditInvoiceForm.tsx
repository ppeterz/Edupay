'use client';

// ──────────────────────────────────────────────
// EduPay — Edit Invoice Form
// ──────────────────────────────────────────────
// Rendered inside a Dialog. Edits an existing unpaid invoice.
// Converts kobo back to Naira for display/input fields,
// and sends raw Naira back to the PATCH API endpoint.

import { useState, type FormEvent } from 'react';
import { getFirebaseAuth } from '@/lib/firebase';
import { kobotoNaira, nairaToKobo } from '@/lib/constants';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2, Plus, Trash2 } from 'lucide-react';
import type { Invoice } from '@/types';

// ── Props ────────────────────────────────────

interface EditInvoiceFormProps {
  invoice: Invoice;
  studentName: string;
  onSuccess: (invoice: Invoice) => void;
  onCancel: () => void;
}

// ── Line item form state ─────────────────────

interface LineItemRow {
  key: number; // stable React key
  id?: string; // preserve original line item ID if possible
  description: string;
  amountDue: string; // string for controlled input
  priority: number;
}

let nextKey = 200;
function getNextKey() {
  return nextKey++;
}

const TERM_OPTIONS = ['First Term', 'Second Term', 'Third Term'];

export function EditInvoiceForm({
  invoice,
  studentName,
  onSuccess,
  onCancel,
}: EditInvoiceFormProps) {
  const [term, setTerm] = useState(invoice.term);
  const [session, setSession] = useState(invoice.session);
  const [lineItems, setLineItems] = useState<LineItemRow[]>(() =>
    invoice.lineItems.map((li) => ({
      key: getNextKey(),
      id: li.id,
      description: li.description,
      amountDue: (li.amountDue / 100).toString(), // convert kobo back to Naira string
      priority: li.priority,
    }))
  );
  const [formState, setFormState] = useState<'idle' | 'loading' | 'error'>('idle');
  const [error, setError] = useState('');

  // ── Running total (live) ───────────────────

  const runningTotalKobo = lineItems.reduce((sum, li) => {
    const amount = parseFloat(li.amountDue);
    if (isNaN(amount) || amount <= 0) return sum;
    return sum + nairaToKobo(amount);
  }, 0);

  // ── Line item CRUD ─────────────────────────

  function updateLineItem(
    key: number,
    field: keyof Omit<LineItemRow, 'key'>,
    value: string | number
  ) {
    setLineItems((prev) =>
      prev.map((li) => (li.key === key ? { ...li, [field]: value } : li))
    );
  }

  function addLineItem() {
    const maxPriority = Math.max(0, ...lineItems.map((li) => li.priority));
    setLineItems((prev) => [
      ...prev,
      {
        key: getNextKey(),
        description: '',
        amountDue: '',
        priority: maxPriority + 1,
      },
    ]);
  }

  function removeLineItem(key: number) {
    if (lineItems.length <= 1) return;
    setLineItems((prev) => prev.filter((li) => li.key !== key));
  }

  // ── Client-side validation ─────────────────

  function validate(): string | null {
    if (!term) return 'Please select a term';
    if (!session || !session.includes('/'))
      return 'Session must contain "/" (e.g. 2025/2026)';

    if (lineItems.length === 0) return 'At least one line item is required';

    for (const li of lineItems) {
      if (!li.description.trim()) {
        return 'Every line item needs a description';
      }
      const amount = parseFloat(li.amountDue);
      if (isNaN(amount) || amount <= 0) {
        return `Amount for "${li.description}" must be a positive number`;
      }
    }

    // Check unique priorities
    const priorities = lineItems.map((li) => li.priority);
    if (new Set(priorities).size !== priorities.length) {
      return 'Line item priorities must be unique';
    }

    return null;
  }

  // ── Submit ─────────────────────────────────

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');

    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    setFormState('loading');

    try {
      const auth = getFirebaseAuth();
      const token = await auth.currentUser?.getIdToken();
      if (!token) {
        setError('Not authenticated. Please sign in again.');
        setFormState('error');
        return;
      }

      const res = await fetch(`/api/invoices/${invoice.id}`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          term,
          session: session.trim(),
          lineItems: lineItems.map((li) => ({
            description: li.description.trim(),
            amountDue: parseFloat(li.amountDue), // raw Naira
            priority: li.priority,
          })),
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? 'Failed to update invoice');
        setFormState('error');
        return;
      }

      const { invoice: updatedInvoice } = await res.json();
      onSuccess(updatedInvoice);
    } catch {
      setError('Connection failed. Check your internet and try again.');
      setFormState('error');
    }
  }

  // ── Render ─────────────────────────────────

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Header */}
      <p className="text-sm text-muted-foreground">
        Editing invoice for{' '}
        <span className="font-medium text-foreground">{studentName}</span>
      </p>

      {/* Term + Session row */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="edit-inv-term">Term</Label>
          <Select
            value={term}
            onValueChange={setTerm}
            disabled={formState === 'loading'}
          >
            <SelectTrigger id="edit-inv-term">
              <SelectValue placeholder="Select term" />
            </SelectTrigger>
            <SelectContent>
              {TERM_OPTIONS.map((t) => (
                <SelectItem key={t} value={t}>
                  {t}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="edit-inv-session">Session</Label>
          <Input
            id="edit-inv-session"
            placeholder="2025/2026"
            value={session}
            onChange={(e) => setSession(e.target.value)}
            disabled={formState === 'loading'}
          />
          <p className="text-xs text-muted-foreground">Format: YYYY/YYYY</p>
        </div>
      </div>

      {/* Line items */}
      <div className="space-y-3">
        <Label>Line Items</Label>

        <div className="space-y-2">
          {lineItems.map((li) => (
            <div
              key={li.key}
              className="flex items-center gap-2 rounded-md border border-gray-200 bg-gray-50 p-2"
            >
              {/* Description */}
              <Input
                className="flex-1 bg-white"
                placeholder="Description"
                value={li.description}
                onChange={(e) =>
                  updateLineItem(li.key, 'description', e.target.value)
                }
                disabled={formState === 'loading'}
              />

              {/* Amount (Naira) */}
              <div className="relative w-32">
                <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                  ₦
                </span>
                <Input
                  className="bg-white pl-7"
                  type="number"
                  min="0"
                  step="any"
                  placeholder="0"
                  value={li.amountDue}
                  onChange={(e) =>
                    updateLineItem(li.key, 'amountDue', e.target.value)
                  }
                  disabled={formState === 'loading'}
                />
              </div>

              {/* Priority */}
              <Input
                className="w-16 bg-white text-center"
                type="number"
                min="1"
                value={li.priority}
                onChange={(e) =>
                  updateLineItem(
                    li.key,
                    'priority',
                    parseInt(e.target.value) || 1
                  )
                }
                disabled={formState === 'loading'}
                title="Priority (1 = highest)"
              />

              {/* Remove button */}
              {lineItems.length > 1 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-red-500 hover:text-red-700"
                  onClick={() => removeLineItem(li.key)}
                  disabled={formState === 'loading'}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
          ))}
        </div>

        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={addLineItem}
          disabled={formState === 'loading'}
        >
          <Plus className="mr-1 h-3 w-3" />
          Add Line Item
        </Button>
      </div>

      {/* Running total */}
      <div className="rounded-md border border-gray-200 bg-white px-4 py-3 text-right">
        <span className="text-sm text-muted-foreground">Total: </span>
        <span className="text-lg font-bold text-gray-900">
          {kobotoNaira(runningTotalKobo)}
        </span>
      </div>

      {/* Error */}
      {error && (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      )}

      {/* Actions */}
      <div className="flex gap-3">
        <Button
          type="button"
          variant="outline"
          className="flex-1"
          onClick={onCancel}
          disabled={formState === 'loading'}
        >
          Cancel
        </Button>
        <Button
          type="submit"
          className="flex-1"
          disabled={formState === 'loading'}
        >
          {formState === 'loading' ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Saving changes...
            </>
          ) : (
            'Save Changes'
          )}
        </Button>
      </div>
    </form>
  );
}
