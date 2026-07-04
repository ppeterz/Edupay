'use client';

// ──────────────────────────────────────────────
// EduPay — Skip Merge Actions
// ──────────────────────────────────────────────
// Action bar for skipReason mode in StudentInvoiceTable.
// Rendered for each individual student and (via wrapper) for group-level bulk apply.
//
// Two distinct sections:
//   1. "Add missing items" — checkboxes for template items not on the invoice
//   2. "Update amounts"   — editable Naira fields for template items whose
//                           amountDue differs from the template
//
// Group-level "Apply to all N" uses Promise.allSettled — partial failures
// are surfaced per-student without undoing successful merges.

import { useState, useCallback } from 'react';
import { toast } from 'sonner';
import { getFirebaseAuth } from '@/lib/firebase';
import { kobotoNaira, nairaToKobo } from '@/lib/constants';
import { computeDiffSignature } from '@/components/invoices/StudentInvoiceTable';
import type { StudentWithInvoice, BulkTemplate } from '@/components/invoices/StudentInvoiceTable';
import type { TemplateLineItem } from '@/lib/invoice-helpers';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, CheckCircle2, AlertTriangle, RotateCcw } from 'lucide-react';

// ── Types ────────────────────────────────────

interface MergePayload {
  addLineItems: { description: string; amountDue: number; priority: number }[];
  updateLineItems: { lineItemId: string; newAmountDue?: number; newPriority?: number }[];
}

type ApplyStatus = 'idle' | 'loading' | 'success' | 'error';

// ── API helper ───────────────────────────────

async function mergeInvoice(invoiceId: string, payload: MergePayload): Promise<void> {
  const auth = getFirebaseAuth();
  const token = await auth.currentUser?.getIdToken();
  if (!token) throw new Error('Not authenticated');

  const res = await fetch(`/api/invoices/${invoiceId}/merge`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error ?? `HTTP ${res.status}`);
  }
}

// ── Per-student action bar ────────────────────

interface SkipMergeActionsProps {
  student: StudentWithInvoice;
  template: BulkTemplate;
  onSuccess?: () => void;
}

export function SkipMergeActions({ student, template, onSuccess }: SkipMergeActionsProps) {
  const inv = student.existingInvoice;
  const sig = computeDiffSignature(inv.lineItems, template.lineItems);

  // Build lookup maps
  const templateByDesc = new Map<string, TemplateLineItem>(
    template.lineItems.map((t) => [t.description.toLowerCase().trim(), t])
  );
  const existingByDesc = new Map(
    inv.lineItems.map((li) => [li.description.toLowerCase().trim(), li])
  );

  const missingItems = sig.missing.map((desc) => templateByDesc.get(desc.toLowerCase().trim())!).filter(Boolean);
  const mismatchedItems = sig.mismatched.map((desc) => {
    const tmpl = templateByDesc.get(desc.toLowerCase().trim())!;
    const existing = existingByDesc.get(desc.toLowerCase().trim())!;
    return { tmpl, existing };
  }).filter((x) => x.tmpl && x.existing);

  // Checkbox state for missing items
  const [checkedMissing, setCheckedMissing] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(missingItems.map((li) => [li.description, false]))
  );

  // Amount override state for mismatched items (keyed by lineItemId)
  const [overrideAmounts, setOverrideAmounts] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      mismatchedItems.map(({ tmpl, existing }) => [
        existing.id,
        (tmpl.amountDue / 100).toFixed(2), // pre-fill with template amount
      ])
    )
  );

  const [status, setStatus] = useState<ApplyStatus>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  function buildPayload(): MergePayload {
    const addLineItems = missingItems
      .filter((li) => checkedMissing[li.description])
      .map((li, idx) => ({
        description: li.description,
        amountDue: li.amountDue / 100, // kobo → Naira for API
        priority: li.priority + idx,
      }));

    const updateLineItems = mismatchedItems
      .map(({ existing }) => {
        const raw = overrideAmounts[existing.id];
        const naira = parseFloat(raw);
        if (isNaN(naira) || naira <= 0) return null;
        const newAmountDue = nairaToKobo(naira);
        if (newAmountDue === existing.amountDue) return null;
        return { lineItemId: existing.id, newAmountDue: naira };
      })
      .filter((x): x is { lineItemId: string; newAmountDue: number } => x !== null);

    return { addLineItems, updateLineItems };
  }

  async function handleApply() {
    const payload = buildPayload();
    if (payload.addLineItems.length === 0 && payload.updateLineItems.length === 0) {
      setStatus('error');
      setErrorMsg('Select at least one change to apply');
      return;
    }

    setStatus('loading');
    setErrorMsg('');
    try {
      await mergeInvoice(inv.id, payload);
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
        Changes applied
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Section 1: Missing items (add with checkboxes) */}
      {missingItems.length > 0 && (
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-1.5">
            Add missing items
          </p>
          <div className="space-y-1.5">
            {missingItems.map((li) => (
              <label
                key={li.description}
                className="flex items-center gap-3 rounded-md border border-gray-200 bg-white px-3 py-2 hover:bg-gray-50 cursor-pointer"
              >
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-gray-300 text-primary accent-primary shrink-0"
                  checked={checkedMissing[li.description] ?? false}
                  onChange={() =>
                    setCheckedMissing((prev) => ({
                      ...prev,
                      [li.description]: !prev[li.description],
                    }))
                  }
                />
                <span className="flex-1 text-sm text-gray-800">{li.description}</span>
                <span className="text-sm tabular-nums text-gray-600 shrink-0">
                  {kobotoNaira(li.amountDue)}
                </span>
              </label>
            ))}
          </div>
        </div>
      )}

      {/* Section 2: Mismatched amounts (update with Naira inputs) */}
      {mismatchedItems.length > 0 && (
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-1.5">
            Update amounts (template vs current)
          </p>
          <div className="space-y-1.5">
            {mismatchedItems.map(({ tmpl, existing }) => (
              <div
                key={existing.id}
                className="flex flex-wrap items-center gap-3 rounded-md border border-gray-200 bg-white px-3 py-2"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-gray-800">{existing.description}</p>
                  <p className="text-xs text-amber-600">
                    Current: {kobotoNaira(existing.amountDue)} · Template: {kobotoNaira(tmpl.amountDue)}
                  </p>
                </div>
                <div className="relative w-32 shrink-0">
                  <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                    ₦
                  </span>
                  <Input
                    className="h-8 bg-white pl-6 text-sm"
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={overrideAmounts[existing.id] ?? ''}
                    onChange={(e) =>
                      setOverrideAmounts((prev) => ({
                        ...prev,
                        [existing.id]: e.target.value,
                      }))
                    }
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Error */}
      {status === 'error' && (
        <div className="flex items-center gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          {errorMsg}
        </div>
      )}

      <div className="flex justify-end">
        <Button
          size="sm"
          onClick={handleApply}
          disabled={status === 'loading'}
        >
          {status === 'loading' ? (
            <>
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              Applying…
            </>
          ) : (
            'Apply Changes'
          )}
        </Button>
      </div>
    </div>
  );
}

// ── Group-level bulk action wrapper ──────────

interface GroupSkipMergeActionsProps {
  students: StudentWithInvoice[];
  template: BulkTemplate;
  groupId: string;
}

export function GroupSkipMergeActions({ students, template, groupId: _groupId }: GroupSkipMergeActionsProps) {
  // For the group, we apply the template additions/updates to ALL non-excluded students.
  // Uses Promise.allSettled — partial failures don't roll back successes.

  const [excluded, setExcluded] = useState<Set<string>>(new Set());
  const [applying, setApplying] = useState(false);
  const [results, setResults] = useState<{
    succeeded: string[];
    failed: { studentId: string; studentName: string; error: string }[];
  } | null>(null);

  const eligible = students.filter((s) => !excluded.has(s.studentId));

  function buildPayloadForStudent(student: StudentWithInvoice): MergePayload {
    const inv = student.existingInvoice;
    const sig = computeDiffSignature(inv.lineItems, template.lineItems);
    const templateByDesc = new Map(template.lineItems.map((t) => [t.description.toLowerCase().trim(), t]));
    const existingByDesc = new Map(inv.lineItems.map((li) => [li.description.toLowerCase().trim(), li]));

    const addLineItems = sig.missing
      .map((desc) => templateByDesc.get(desc.toLowerCase().trim())!)
      .filter(Boolean)
      .map((li, idx) => ({
        description: li.description,
        amountDue: li.amountDue / 100,
        priority: li.priority + idx,
      }));

    const updateLineItems = sig.mismatched
      .map((desc) => {
        const tmpl = templateByDesc.get(desc.toLowerCase().trim())!;
        const existing = existingByDesc.get(desc.toLowerCase().trim())!;
        if (!tmpl || !existing) return null;
        return { lineItemId: existing.id, newAmountDue: tmpl.amountDue / 100 };
      })
      .filter((x): x is { lineItemId: string; newAmountDue: number } => x !== null);

    return { addLineItems, updateLineItems };
  }

  async function applyToGroup() {
    if (eligible.length === 0) return;
    setApplying(true);
    setResults(null);

    const settled = await Promise.allSettled(
      eligible.map((s) => mergeInvoice(s.existingInvoice.id, buildPayloadForStudent(s)))
    );

    const succeeded: string[] = [];
    const failed: { studentId: string; studentName: string; error: string }[] = [];

    settled.forEach((result, idx) => {
      const student = eligible[idx];
      if (result.status === 'fulfilled') {
        succeeded.push(student.studentId);
      } else {
        failed.push({
          studentId: student.studentId,
          studentName: student.studentName,
          error: result.reason instanceof Error ? result.reason.message : 'Failed',
        });
      }
    });

    setApplying(false);
    setResults({ succeeded, failed });

    if (failed.length === 0) {
      toast.success(`Applied to all ${succeeded.length} students.`);
    } else {
      toast.error(`${succeeded.length} applied, ${failed.length} failed.`);
      // Auto-exclude succeeded — retry button only operates on failed
      setExcluded((prev) => {
        const next = new Set(prev);
        for (const id of succeeded) next.add(id);
        return next;
      });
    }
  }

  const failedStudents = results?.failed.map((f) => f.studentId) ?? [];

  return (
    <div className="space-y-3">
      {/* Exclude checkboxes */}
      <div>
        <p className="text-xs text-gray-500 mb-1.5">
          Uncheck students to exclude them from the group action:
        </p>
        <div className="flex flex-wrap gap-2">
          {students.map((s) => {
            const failed = failedStudents.includes(s.studentId);
            return (
              <label
                key={s.studentId}
                className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs cursor-pointer transition-colors ${
                  excluded.has(s.studentId)
                    ? 'border-gray-200 bg-gray-100 text-gray-400 line-through'
                    : failed
                    ? 'border-red-200 bg-red-50 text-red-700'
                    : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
                }`}
              >
                <input
                  type="checkbox"
                  className="h-3 w-3 accent-primary"
                  checked={!excluded.has(s.studentId)}
                  onChange={() =>
                    setExcluded((prev) => {
                      const next = new Set(prev);
                      if (next.has(s.studentId)) next.delete(s.studentId);
                      else next.add(s.studentId);
                      return next;
                    })
                  }
                />
                {s.studentName}
                {failed && ' ⚠'}
              </label>
            );
          })}
        </div>
      </div>

      {/* Failed details */}
      {results && results.failed.length > 0 && (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2">
          <p className="text-xs font-medium text-red-700 mb-1">
            {results.failed.length} student{results.failed.length !== 1 ? 's' : ''} failed — check and retry:
          </p>
          {results.failed.map((f) => (
            <p key={f.studentId} className="text-xs text-red-600">
              {f.studentName}: {f.error}
            </p>
          ))}
        </div>
      )}

      <div className="flex items-center gap-2">
        <Button
          size="sm"
          onClick={applyToGroup}
          disabled={applying || eligible.length === 0}
        >
          {applying ? (
            <>
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              Applying…
            </>
          ) : results?.failed.length ? (
            <>
              <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
              Retry {failedStudents.filter((id) => !excluded.has(id)).length} failed
            </>
          ) : (
            `Apply to all ${eligible.length} student${eligible.length !== 1 ? 's' : ''}`
          )}
        </Button>
        {results && results.succeeded.length > 0 && results.failed.length > 0 && (
          <span className="text-xs text-gray-500">
            {results.succeeded.length} succeeded
          </span>
        )}
      </div>
    </div>
  );
}
