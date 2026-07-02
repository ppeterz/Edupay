'use client';

// ──────────────────────────────────────────────
// EduPay — Skipped Student Review
// ──────────────────────────────────────────────
// Shown after bulk invoicing when some students already had an invoice.
// Lets admin selectively add missing line items or update existing amounts.
// Uses only available shadcn components (button, badge, input, card).

import { useState } from 'react';
import { getFirebaseAuth } from '@/lib/firebase';
import { kobotoNaira, nairaToKobo } from '@/lib/constants';
import { diffLineItems } from '@/lib/invoice-helpers';
import type { SkippedClassGroup, TemplateLineItem } from '@/lib/invoice-helpers';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  ChevronDown,
  ChevronRight,
  CheckCircle2,
  AlertTriangle,
  Loader2,
} from 'lucide-react';
import type { Invoice, InvoiceLineItem } from '@/types';

// ── Types ────────────────────────────────────

interface BulkTemplate {
  term: string;
  session: string;
  lineItems: TemplateLineItem[];
}

interface SkippedStudentReviewProps {
  skippedByClass: SkippedClassGroup[];
  bulkTemplate?: BulkTemplate; // Optional now
  onDone: () => void;
}

// ── Per-student merge state ───────────────────

interface StudentMergeState {
  missingChecked: Record<string, boolean>; // description → checked
  missingPriorities: Record<string, string>; // description → priority string
  updatedAmounts: Record<string, string>;  // lineItemId → Naira string
  updatedPriorities: Record<string, string>; // lineItemId → priority string
  status: 'idle' | 'loading' | 'success' | 'error';
  errorMsg: string;
}

function initMergeState(
  missing: TemplateLineItem[],
  matchingExisting: InvoiceLineItem[]
): StudentMergeState {
  const missingChecked: Record<string, boolean> = {};
  const missingPriorities: Record<string, string> = {};
  for (const li of missing) {
    missingChecked[li.description] = false;
    missingPriorities[li.description] = li.priority.toString();
  }
  const updatedAmounts: Record<string, string> = {};
  const updatedPriorities: Record<string, string> = {};
  for (const li of matchingExisting) {
    updatedAmounts[li.id] = (li.amountDue / 100).toFixed(2);
    updatedPriorities[li.id] = li.priority.toString();
  }
  return {
    missingChecked,
    missingPriorities,
    updatedAmounts,
    updatedPriorities,
    status: 'idle',
    errorMsg: '',
  };
}

// ── Single student row ────────────────────────

function StudentMergeRow({
  entry,
  template,
}: {
  entry: SkippedClassGroup['students'][number];
  template?: BulkTemplate; // Optional now
}) {
  const [expanded, setExpanded] = useState(false);
  const [liveInvoice, setLiveInvoice] = useState<Invoice>(entry.existingInvoice);

  const templateLineItems = template?.lineItems || [];
  const { missing: liveMissing, matching: diffMatching } = diffLineItems(
    templateLineItems,
    liveInvoice.lineItems
  );

  const liveMatching = templateLineItems.length > 0
    ? diffMatching
    : liveInvoice.lineItems.map((li) => ({
        template: { description: li.description, amountDue: li.amountDue, priority: li.priority },
        existing: li,
      }));

  const [state, setState] = useState<StudentMergeState>(() =>
    initMergeState(
      liveMissing,
      liveMatching.map((m) => m.existing)
    )
  );

  function toggleMissing(description: string) {
    setState((prev) => ({
      ...prev,
      missingChecked: {
        ...prev.missingChecked,
        [description]: !prev.missingChecked[description],
      },
    }));
  }

  function setMissingPriority(description: string, value: string) {
    setState((prev) => ({
      ...prev,
      missingPriorities: {
        ...prev.missingPriorities,
        [description]: value,
      },
    }));
  }

  function setAmount(lineItemId: string, value: string) {
    setState((prev) => ({
      ...prev,
      updatedAmounts: { ...prev.updatedAmounts, [lineItemId]: value },
    }));
  }

  function setPriority(lineItemId: string, value: string) {
    setState((prev) => ({
      ...prev,
      updatedPriorities: { ...prev.updatedPriorities, [lineItemId]: value },
    }));
  }

  async function handleMerge() {
    setState((prev) => ({ ...prev, status: 'loading', errorMsg: '' }));

    const addLineItems = liveMissing
      .filter((li) => state.missingChecked[li.description])
      .map((li) => {
        const customPriority = parseInt(state.missingPriorities[li.description]);
        return {
          description: li.description,
          amountDue: li.amountDue / 100, // kobo → Naira for API
          priority: isNaN(customPriority) ? li.priority : customPriority,
        };
      });

    const updateLineItems: { lineItemId: string; newAmountDue?: number; newPriority?: number }[] = [];
    for (const { existing } of liveMatching) {
      const rawAmt = state.updatedAmounts[existing.id];
      const naira = parseFloat(rawAmt);
      const rawPri = state.updatedPriorities[existing.id];
      const priority = parseInt(rawPri);

      const amtChanged = !isNaN(naira) && naira > 0 && nairaToKobo(naira) !== existing.amountDue;
      const priChanged = !isNaN(priority) && priority > 0 && priority !== existing.priority;

      if (amtChanged || priChanged) {
        updateLineItems.push({
          lineItemId: existing.id,
          ...(amtChanged ? { newAmountDue: naira } : {}),
          ...(priChanged ? { newPriority: priority } : {}),
        });
      }
    }

    if (addLineItems.length === 0 && updateLineItems.length === 0) {
      setState((prev) => ({
        ...prev,
        status: 'error',
        errorMsg: 'Select at least one change to apply',
      }));
      return;
    }

    try {
      const auth = getFirebaseAuth();
      const token = await auth.currentUser?.getIdToken();
      if (!token) {
        setState((prev) => ({
          ...prev,
          status: 'error',
          errorMsg: 'Not authenticated',
        }));
        return;
      }

      const res = await fetch(`/api/invoices/${liveInvoice.id}/merge`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ addLineItems, updateLineItems }),
      });

      if (!res.ok) {
        const data = await res.json();
        setState((prev) => ({
          ...prev,
          status: 'error',
          errorMsg: data.error ?? 'Failed to update invoice',
        }));
        return;
      }

      const { invoice: updated } = (await res.json()) as { invoice: Invoice };
      setLiveInvoice(updated);
      // Reset merge state for the new invoice state
      const nextTemplateLineItems = template?.lineItems || [];
      const newDiff = diffLineItems(nextTemplateLineItems, updated.lineItems);
      const nextMatching = nextTemplateLineItems.length > 0
        ? newDiff.matching
        : updated.lineItems.map((li) => ({
            template: { description: li.description, amountDue: li.amountDue, priority: li.priority },
            existing: li,
          }));

      setState(
        initMergeState(
          newDiff.missing,
          nextMatching.map((m) => m.existing)
        )
      );
      setState((prev) => ({ ...prev, status: 'success' }));
    } catch {
      setState((prev) => ({
        ...prev,
        status: 'error',
        errorMsg: 'Connection failed. Try again.',
      }));
    }
  }

  const hasCheckedMissing = Object.values(state.missingChecked).some(Boolean);
  const hasAmountChange = liveMatching.some(({ existing }) => {
    const rawAmt = state.updatedAmounts[existing.id];
    const naira = parseFloat(rawAmt);
    return !isNaN(naira) && naira > 0 && nairaToKobo(naira) !== existing.amountDue;
  });
  const hasPriorityChange = liveMatching.some(({ existing }) => {
    const rawPri = state.updatedPriorities[existing.id];
    const priority = parseInt(rawPri);
    return !isNaN(priority) && priority > 0 && priority !== existing.priority;
  });
  const hasMissingPriorityChange = liveMissing.some((li) => {
    const rawPri = state.missingPriorities[li.description];
    const priority = parseInt(rawPri);
    return !isNaN(priority) && priority > 0 && priority !== li.priority;
  });
  const hasChanges = hasCheckedMissing || hasAmountChange || hasPriorityChange || hasMissingPriorityChange;

  const statusColors: Record<string, string> = {
    unpaid: 'bg-red-50 text-red-700 border-red-200',
    partial: 'bg-amber-50 text-amber-700 border-amber-200',
    paid: 'bg-green-50 text-green-700 border-green-200',
    overpaid: 'bg-blue-50 text-blue-700 border-blue-200',
  };

  return (
    <div className="border-b border-gray-100 last:border-b-0">
      {/* Row header */}
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-gray-50"
      >
        <div className="flex items-center gap-2">
          {expanded ? (
            <ChevronDown className="h-4 w-4 shrink-0 text-gray-400" />
          ) : (
            <ChevronRight className="h-4 w-4 shrink-0 text-gray-400" />
          )}
          <span className="text-sm font-medium text-gray-900">
            {entry.studentName}
          </span>
          {liveMissing.length > 0 && (
            <Badge className="border border-amber-200 bg-amber-50 text-amber-700 text-xs font-normal">
              {liveMissing.length} missing
            </Badge>
          )}
          {state.status === 'success' && (
            <span className="flex items-center gap-1 text-xs text-green-600">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Updated
            </span>
          )}
        </div>
        <Badge
          className={`text-xs border ${statusColors[liveInvoice.status] ?? ''}`}
          variant="outline"
        >
          {liveInvoice.status.charAt(0).toUpperCase() + liveInvoice.status.slice(1)}
        </Badge>
      </button>

      {/* Expanded detail */}
      {expanded && (
        <div className="border-t border-gray-100 bg-gray-50/50 px-4 pb-4 pt-3">
          <div className="space-y-4">
            {/* Current invoice line items */}
            <div>
              <p className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-gray-400">
                Current invoice
              </p>
              <div className="overflow-hidden rounded-md border border-gray-200 bg-white text-sm">
                <table className="w-full">
                  <thead className="bg-gray-50 text-xs text-gray-500">
                    <tr>
                      <th className="px-3 py-2 text-left font-medium">Item</th>
                      <th className="px-3 py-2 text-center font-medium">Priority</th>
                      <th className="px-3 py-2 text-right font-medium">Due</th>
                      <th className="px-3 py-2 text-right font-medium">Paid</th>
                    </tr>
                  </thead>
                  <tbody>
                    {liveInvoice.lineItems.map((li) => (
                      <tr key={li.id} className="border-t border-gray-100">
                        <td className="px-3 py-2 text-gray-800">{li.description}</td>
                        <td className="px-3 py-2 text-center tabular-nums text-gray-600">{li.priority}</td>
                        <td className="px-3 py-2 text-right tabular-nums text-gray-700">
                          {kobotoNaira(li.amountDue)}
                        </td>
                        <td
                          className={`px-3 py-2 text-right tabular-nums ${
                            li.amountPaid > 0 ? 'text-green-600' : 'text-gray-300'
                          }`}
                        >
                          {kobotoNaira(li.amountPaid)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Missing line items — add with checkboxes */}
            {liveMissing.length > 0 && (
              <div>
                <p className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-gray-400">
                  Not on this invoice (from general invoice)
                </p>
                <div className="space-y-1.5">
                  {liveMissing.map((li) => (
                    <div
                      key={li.description}
                      className="flex items-center gap-3 rounded-md border border-gray-200 bg-white px-3 py-2 hover:bg-gray-50"
                    >
                      <input
                        type="checkbox"
                        className="h-4 w-4 rounded border-gray-300 text-primary accent-primary shrink-0"
                        checked={state.missingChecked[li.description] ?? false}
                        onChange={() => toggleMissing(li.description)}
                      />
                      <span className="flex-1 text-sm text-gray-800 min-w-0 truncate">
                        {li.description}
                      </span>
                      <span className="text-sm font-medium tabular-nums text-gray-600 shrink-0">
                        {kobotoNaira(li.amountDue)}
                      </span>
                      <div className="flex items-center gap-1.5 shrink-0 ml-2 border-l border-gray-100 pl-3">
                        <span className="text-xs text-gray-400">Priority:</span>
                        <Input
                          className="h-8 w-14 bg-white text-center text-sm"
                          type="number"
                          min="1"
                          value={state.missingPriorities[li.description] ?? ''}
                          onChange={(e) => setMissingPriority(li.description, e.target.value)}
                          disabled={!state.missingChecked[li.description]}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Matching items — edit amounts */}
            {liveMatching.length > 0 && (
              <div>
                <p className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-gray-400">
                  Update existing amounts / priorities
                </p>
                <div className="space-y-1.5">
                  {liveMatching.map(({ existing, template: tmpl }) => {
                    const differs = tmpl.amountDue !== existing.amountDue;
                    return (
                      <div
                        key={existing.id}
                        className="flex flex-wrap items-center gap-3 rounded-md border border-gray-200 bg-white px-3 py-2"
                      >
                        <span className="min-w-0 flex-1 text-sm text-gray-800">
                          {existing.description}
                          {differs && (
                            <span className="ml-2 text-xs text-amber-600 block sm:inline">
                              ≠ general invoice ({kobotoNaira(tmpl.amountDue)})
                            </span>
                          )}
                        </span>
                        <div className="flex items-center gap-3 shrink-0">
                          <div className="relative w-28">
                            <span className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                              ₦
                            </span>
                            <Input
                              className="h-8 bg-white pl-5 text-sm"
                              type="number"
                              min="0.01"
                              step="0.01"
                              value={state.updatedAmounts[existing.id] ?? ''}
                              onChange={(e) => setAmount(existing.id, e.target.value)}
                            />
                          </div>
                          <div className="flex items-center gap-1.5 border-l border-gray-100 pl-3">
                            <span className="text-xs text-gray-400">Priority:</span>
                            <Input
                              className="h-8 w-14 bg-white text-center text-sm"
                              type="number"
                              min="1"
                              value={state.updatedPriorities[existing.id] ?? ''}
                              onChange={(e) => setPriority(existing.id, e.target.value)}
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Error message */}
            {state.status === 'error' && (
              <div className="flex items-center gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                {state.errorMsg}
              </div>
            )}

            {/* Apply button */}
            <div className="flex justify-end">
              <Button
                size="sm"
                onClick={handleMerge}
                disabled={
                  state.status === 'loading' ||
                  (!hasChanges && state.status !== 'error')
                }
              >
                {state.status === 'loading' ? (
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
        </div>
      )}
    </div>
  );
}


// ── Main component ────────────────────────────

export function SkippedStudentReview({
  skippedByClass,
  bulkTemplate,
  onDone,
}: SkippedStudentReviewProps) {
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});

  const totalSkipped = skippedByClass.reduce(
    (n, g) => n + g.students.length,
    0
  );

  function toggleGroup(className: string) {
    setOpenGroups((prev) => ({ ...prev, [className]: !prev[className] }));
  }

  return (
    <div className="space-y-4">
      {/* Section banner */}
      <div className="rounded-md border border-amber-200 bg-amber-50 p-3">
        <div className="flex items-start gap-2">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
          <div>
            <p className="text-sm font-medium text-amber-800">
              {totalSkipped} student{totalSkipped !== 1 ? 's' : ''} already had
              an invoice for this term
            </p>
            <p className="mt-0.5 text-xs text-amber-700">
              Expand each class to selectively add missing items or update
              amounts. You are not required to act on every student.
            </p>
          </div>
        </div>
      </div>

      {/* Class groups */}
      <div className="space-y-2">
        {skippedByClass.map((group) => (
          <div
            key={group.className}
            className="overflow-hidden rounded-md border border-gray-200 bg-white"
          >
            {/* Group header */}
            <button
              type="button"
              onClick={() => toggleGroup(group.className)}
              className="flex w-full items-center justify-between bg-gray-50 px-4 py-3 text-left hover:bg-gray-100"
            >
              <span className="text-sm font-semibold text-gray-900">
                {group.className}
              </span>
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500">
                  {group.students.length} student
                  {group.students.length !== 1 ? 's' : ''}
                </span>
                {openGroups[group.className] ? (
                  <ChevronDown className="h-4 w-4 text-gray-400" />
                ) : (
                  <ChevronRight className="h-4 w-4 text-gray-400" />
                )}
              </div>
            </button>

            {/* Student rows */}
            {openGroups[group.className] && (
              <div>
                {group.students.map((entry) => (
                  <StudentMergeRow
                    key={entry.studentId}
                    entry={entry}
                    template={bulkTemplate}
                  />
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Done button */}
      <Button variant="outline" className="w-full" onClick={onDone}>
        Done Reviewing
      </Button>
    </div>
  );
}
