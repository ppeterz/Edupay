'use client';

// ──────────────────────────────────────────────
// EduPay — Bulk Invoice Form
// ──────────────────────────────────────────────
// Creates invoices for an entire class or class category.
// Amounts entered in Naira — server converts to kobo.

import { useState, type FormEvent } from 'react';
import { getFirebaseAuth } from '@/lib/firebase';
import { ALL_CLASSES, CLASS_CATEGORIES, nairaToKobo, kobotoNaira } from '@/lib/constants';
import type { ClassCategory } from '@/lib/constants';
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
import { Loader2, Plus, Trash2, AlertTriangle } from 'lucide-react';

// ── Types ────────────────────────────────────

export interface BulkInvoiceResult {
  created: number;
  skipped: number;
  skippedByClass: import('@/lib/invoice-helpers').SkippedClassGroup[];
  bulkTemplate: {
    term: string;
    session: string;
    lineItems: import('@/lib/invoice-helpers').TemplateLineItem[];
  };
  details: { studentId: string; studentName: string; invoiceId: string }[];
}

interface BulkInvoiceFormProps {
  onSuccess: (result: BulkInvoiceResult) => void;
  onCancel: () => void;
}

// ── Line item form state ─────────────────────

interface LineItemRow {
  key: number;
  description: string;
  amountDue: string;
  priority: number;
}

let nextKey = 300;
function getNextKey() {
  return nextKey++;
}

const TERM_OPTIONS = ['First Term', 'Second Term', 'Third Term'];
const CATEGORY_KEYS = Object.keys(CLASS_CATEGORIES) as ClassCategory[];

function getDefaultLineItems(): LineItemRow[] {
  return [
    { key: getNextKey(), description: 'Tuition', amountDue: '', priority: 1 },
    { key: getNextKey(), description: 'Examination Fees', amountDue: '', priority: 2 },
    { key: getNextKey(), description: 'Transport Fees', amountDue: '', priority: 3 },
  ];
}

// ── Component ────────────────────────────────

export function BulkInvoiceForm({ onSuccess, onCancel }: BulkInvoiceFormProps) {
  // Target selection
  const [targetType, setTargetType] = useState<'class' | 'category'>('class');
  const [targetValue, setTargetValue] = useState('');

  // Invoice details
  const [term, setTerm] = useState('');
  const [session, setSession] = useState('');
  const [lineItems, setLineItems] = useState<LineItemRow[]>(getDefaultLineItems);

  // Form state
  const [formState, setFormState] = useState<'idle' | 'loading' | 'error'>('idle');
  const [error, setError] = useState('');

  // ── Running total (live) ───────────────────

  const runningTotalKobo = lineItems.reduce((sum, li) => {
    const amount = parseFloat(li.amountDue);
    if (isNaN(amount) || amount <= 0) return sum;
    return sum + nairaToKobo(amount);
  }, 0);

  // ── Target label for dynamic button text ───

  const targetLabel =
    targetType === 'class'
      ? targetValue || 'Selected Class'
      : targetValue || 'Selected Category';

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
      { key: getNextKey(), description: '', amountDue: '', priority: maxPriority + 1 },
    ]);
  }

  function removeLineItem(key: number) {
    if (lineItems.length <= 1) return;
    setLineItems((prev) => prev.filter((li) => li.key !== key));
  }

  // ── Client-side validation ─────────────────

  function validate(): string | null {
    if (!targetValue) return 'Please select a target class or category';
    if (!term) return 'Please select a term';
    if (!session || !session.includes('/'))
      return 'Session must contain "/" (e.g. 2025/2026)';

    if (lineItems.length === 0) return 'At least one line item is required';

    for (const li of lineItems) {
      if (!li.description.trim()) return 'Every line item needs a description';
      const amount = parseFloat(li.amountDue);
      if (isNaN(amount) || amount <= 0)
        return `Amount for "${li.description}" must be a positive number`;
    }

    const priorities = lineItems.map((li) => li.priority);
    if (new Set(priorities).size !== priorities.length)
      return 'Line item priorities must be unique';

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

      const res = await fetch('/api/invoices/bulk-create', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          target: { type: targetType, value: targetValue },
          term,
          session: session.trim(),
          lineItems: lineItems.map((li) => ({
            description: li.description.trim(),
            amountDue: parseFloat(li.amountDue),
            priority: li.priority,
          })),
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? 'Failed to create invoices');
        setFormState('error');
        return;
      }

      const result: BulkInvoiceResult = await res.json();
      onSuccess(result);
    } catch {
      setError('Connection failed. Check your internet and try again.');
      setFormState('error');
    }
  }

  // ── Render ─────────────────────────────────

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Target type toggle */}
      <div className="space-y-2">
        <Label>Target</Label>
        <div className="flex gap-2">
          <Button
            type="button"
            variant={targetType === 'class' ? 'default' : 'outline'}
            size="sm"
            className="flex-1"
            onClick={() => {
              setTargetType('class');
              setTargetValue('');
            }}
            disabled={formState === 'loading'}
          >
            By Class
          </Button>
          <Button
            type="button"
            variant={targetType === 'category' ? 'default' : 'outline'}
            size="sm"
            className="flex-1"
            onClick={() => {
              setTargetType('category');
              setTargetValue('');
            }}
            disabled={formState === 'loading'}
          >
            By Category
          </Button>
        </div>
      </div>

      {/* Target value select */}
      <div className="space-y-2">
        <Label htmlFor="bulk-target">
          {targetType === 'class' ? 'Select Class' : 'Select Category'}
        </Label>
        <Select
          value={targetValue}
          onValueChange={setTargetValue}
          disabled={formState === 'loading'}
        >
          <SelectTrigger id="bulk-target">
            <SelectValue
              placeholder={
                targetType === 'class' ? 'Choose a class...' : 'Choose a category...'
              }
            />
          </SelectTrigger>
          <SelectContent>
            {targetType === 'class'
              ? ALL_CLASSES.map((cls) => (
                  <SelectItem key={cls} value={cls}>
                    {cls}
                  </SelectItem>
                ))
              : CATEGORY_KEYS.map((cat) => (
                  <SelectItem key={cat} value={cat}>
                    {cat} ({CLASS_CATEGORIES[cat].length} classes)
                  </SelectItem>
                ))}
          </SelectContent>
        </Select>
      </div>

      {/* Term + Session */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="bulk-term">Term</Label>
          <Select
            value={term}
            onValueChange={setTerm}
            disabled={formState === 'loading'}
          >
            <SelectTrigger id="bulk-term">
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
          <Label htmlFor="bulk-session">Session</Label>
          <Input
            id="bulk-session"
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
        <Label>Line Items (per student)</Label>
        <div className="space-y-2">
          {lineItems.map((li) => (
            <div
              key={li.key}
              className="flex items-center gap-2 rounded-md border border-gray-200 bg-gray-50 p-2"
            >
              <Input
                className="flex-1 bg-white"
                placeholder="Description"
                value={li.description}
                onChange={(e) => updateLineItem(li.key, 'description', e.target.value)}
                disabled={formState === 'loading'}
              />
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
                  onChange={(e) => updateLineItem(li.key, 'amountDue', e.target.value)}
                  disabled={formState === 'loading'}
                />
              </div>
              <Input
                className="w-16 bg-white text-center"
                type="number"
                min="1"
                value={li.priority}
                onChange={(e) =>
                  updateLineItem(li.key, 'priority', parseInt(e.target.value) || 1)
                }
                disabled={formState === 'loading'}
                title="Priority (1 = highest)"
              />
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
        <span className="text-sm text-muted-foreground">Total per student: </span>
        <span className="text-lg font-bold text-gray-900">
          {kobotoNaira(runningTotalKobo)}
        </span>
      </div>

      {/* Warning */}
      <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 p-3">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
        <p className="text-xs text-amber-700">
          This will create invoices for all students in{' '}
          <span className="font-medium">{targetLabel}</span>. Students who already
          have an invoice for this term/session will be automatically skipped.
        </p>
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
              Creating invoices…
            </>
          ) : (
            `Create Invoices for ${targetLabel}`
          )}
        </Button>
      </div>
    </form>
  );
}
