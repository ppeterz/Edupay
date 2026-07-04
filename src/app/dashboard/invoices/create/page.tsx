'use client';

// ──────────────────────────────────────────────
// EduPay — Bulk Invoice Creation Wizard
// ──────────────────────────────────────────────
// 4-step wizard: Target → Term/Session → Line Items → Review
// All state is held in React state — going Back never loses data.
// Submits to existing POST /api/invoices/bulk-create unchanged.

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { getFirebaseDb, getFirebaseAuth } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';
import {
  ALL_CLASSES,
  CLASS_CATEGORIES,
  nairaToKobo,
  kobotoNaira,
} from '@/lib/constants';
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
import { Card, CardContent } from '@/components/ui/card';
import {
  ArrowLeft,
  ArrowRight,
  ChevronUp,
  ChevronDown,
  Plus,
  Trash2,
  Loader2,
  AlertTriangle,
  CheckCircle2,
  Users,
} from 'lucide-react';
import type { Student } from '@/types';

// ── Types ─────────────────────────────────────

type TargetType = 'class' | 'category';

const CATEGORY_KEYS = Object.keys(CLASS_CATEGORIES) as ClassCategory[];
const TERM_OPTIONS = ['First Term', 'Second Term', 'Third Term'];
const STEPS = ['Target', 'Term & Session', 'Line Items', 'Review'] as const;

interface LineItemRow {
  key: number;
  description: string;
  amountDue: string; // Naira string for controlled input
}

let nextKey = 1000;
function getNextKey() { return nextKey++; }

function getDefaultLineItems(): LineItemRow[] {
  return [
    { key: getNextKey(), description: 'Tuition', amountDue: '' },
    { key: getNextKey(), description: 'Examination Fees', amountDue: '' },
    { key: getNextKey(), description: 'Transport Fees', amountDue: '' },
  ];
}

// ── Step Indicator ────────────────────────────

function StepIndicator({ current }: { current: number }) {
  return (
    <div className="flex items-center gap-2">
      {STEPS.map((label, idx) => {
        const stepNum = idx + 1;
        const done = stepNum < current;
        const active = stepNum === current;
        return (
          <div key={label} className="flex items-center gap-2">
            <div
              className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold shrink-0 ${
                done
                  ? 'bg-primary text-primary-foreground'
                  : active
                  ? 'ring-2 ring-primary bg-primary text-primary-foreground'
                  : 'bg-gray-100 text-gray-400'
              }`}
            >
              {done ? <CheckCircle2 className="h-3.5 w-3.5" /> : stepNum}
            </div>
            <span
              className={`hidden sm:inline text-xs font-medium ${
                active ? 'text-gray-900' : done ? 'text-gray-500' : 'text-gray-400'
              }`}
            >
              {label}
            </span>
            {idx < STEPS.length - 1 && (
              <div
                className={`hidden sm:block h-px w-6 ${
                  done ? 'bg-primary' : 'bg-gray-200'
                }`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Main Component ────────────────────────────

export default function CreateBulkInvoicePage() {
  const router = useRouter();
  const { user, school } = useAuth();
  const lastUsed = school?.lastUsedTermSession;

  // Wizard step (1-4)
  const [step, setStep] = useState(1);

  // Step 1 state
  const [targetType, setTargetType] = useState<TargetType>('class');
  const [targetValue, setTargetValue] = useState('');
  const [studentCount, setStudentCount] = useState<number | null>(null);
  const [classCount, setClassCount] = useState<number | null>(null);
  const [countLoading, setCountLoading] = useState(false);

  // Step 2 state
  const [term, setTerm] = useState(lastUsed?.term ?? '');
  const [session, setSession] = useState(lastUsed?.session ?? '');

  // Step 3 state
  const [lineItems, setLineItems] = useState<LineItemRow[]>(getDefaultLineItems);

  // Submit state
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  // ── Student count lookup ───────────────────

  const fetchCount = useCallback(async (type: TargetType, value: string) => {
    if (!user || !value) { setStudentCount(null); setClassCount(null); return; }
    setCountLoading(true);
    try {
      const db = getFirebaseDb();
      const targetClasses =
        type === 'class'
          ? [value]
          : [...CLASS_CATEGORIES[value as ClassCategory]];

      const snap = await getDocs(
        query(
          collection(db, 'students'),
          where('schoolId', '==', user.uid),
          where('class', 'in', targetClasses)
        )
      );
      const active = snap.docs.filter((d) => !d.data().deletedAt);
      setStudentCount(active.length);
      setClassCount(targetClasses.length);
    } finally {
      setCountLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (targetValue) fetchCount(targetType, targetValue);
    else { setStudentCount(null); setClassCount(null); }
  }, [targetType, targetValue, fetchCount]);

  // ── Line item operations ───────────────────

  function updateItem(key: number, field: keyof Omit<LineItemRow, 'key'>, value: string) {
    setLineItems((prev) => prev.map((li) => li.key === key ? { ...li, [field]: value } : li));
  }

  function addItem() {
    setLineItems((prev) => [...prev, { key: getNextKey(), description: '', amountDue: '' }]);
  }

  function removeItem(key: number) {
    if (lineItems.length <= 1) return;
    setLineItems((prev) => prev.filter((li) => li.key !== key));
  }

  function moveItem(key: number, direction: 'up' | 'down') {
    setLineItems((prev) => {
      const idx = prev.findIndex((li) => li.key === key);
      if (idx === -1) return prev;
      const next = [...prev];
      const target = direction === 'up' ? idx - 1 : idx + 1;
      if (target < 0 || target >= next.length) return prev;
      [next[idx], next[target]] = [next[target], next[idx]];
      return next;
    });
  }

  // ── Validation per step ────────────────────

  function validateStep1(): string | null {
    if (!targetValue) return 'Please select a target class or category';
    return null;
  }

  function validateStep2(): string | null {
    if (!term) return 'Please select a term';
    if (!session || !session.includes('/'))
      return 'Session must contain "/" (e.g. 2025/2026)';
    return null;
  }

  function validateStep3(): string | null {
    if (lineItems.length === 0) return 'At least one line item is required';
    for (const li of lineItems) {
      if (!li.description.trim()) return 'Every line item needs a description';
      const amt = parseFloat(li.amountDue);
      if (isNaN(amt) || amt <= 0)
        return `Amount for "${li.description}" must be a positive number`;
    }
    return null;
  }

  const validators = [validateStep1, validateStep2, validateStep3];
  const [stepErrors, setStepErrors] = useState<string[]>(['', '', '', '']);

  function tryNext() {
    if (step <= 3) {
      const err = validators[step - 1]();
      if (err) {
        setStepErrors((prev) => {
          const next = [...prev];
          next[step - 1] = err;
          return next;
        });
        return;
      }
      setStepErrors((prev) => { const next = [...prev]; next[step - 1] = ''; return next; });
    }
    setStep((s) => Math.min(s + 1, 4));
  }

  function goBack() {
    setStep((s) => Math.max(s - 1, 1));
  }

  // ── Derived totals for review ──────────────

  const totalPerStudent = lineItems.reduce((sum, li) => {
    const amt = parseFloat(li.amountDue);
    return sum + (isNaN(amt) ? 0 : nairaToKobo(amt));
  }, 0);
  const grandTotal = totalPerStudent * (studentCount ?? 0);

  const targetLabel =
    targetType === 'class'
      ? targetValue
      : `${targetValue} (${classCount ?? '?'} classes)`;

  // ── Submit ─────────────────────────────────

  async function handleSubmit() {
    setSubmitting(true);
    setSubmitError('');

    try {
      const auth = getFirebaseAuth();
      const token = await auth.currentUser?.getIdToken();
      if (!token) {
        setSubmitError('Not authenticated. Please sign in again.');
        setSubmitting(false);
        return;
      }

      // Priority is derived from list position (top = 1)
      const lineItemsPayload = lineItems.map((li, idx) => ({
        description: li.description.trim(),
        amountDue: parseFloat(li.amountDue),
        priority: idx + 1,
      }));

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
          lineItems: lineItemsPayload,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setSubmitError(data.error ?? 'Failed to create invoices');
        setSubmitting(false);
        return;
      }

      // If runId is null (run-doc persistence failed), store payload in sessionStorage
      if (!data.runId) {
        try {
          sessionStorage.setItem('bulk_run_fallback', JSON.stringify(data));
        } catch {
          // sessionStorage unavailable — ignore, we'll show the graceful message
        }
        router.push('/dashboard/invoices/results/fallback');
      } else {
        router.push(`/dashboard/invoices/results/${data.runId}`);
      }
    } catch {
      setSubmitError('Connection failed. Check your internet and try again.');
      setSubmitting(false);
    }
  }

  // ── Render ────────────────────────────────

  return (
    <div className="flex flex-col min-h-screen bg-gray-50">
      {/* Sticky header with step indicator */}
      <div className="sticky top-0 z-10 border-b border-gray-200 bg-white px-6 py-4 shadow-sm">
        <div className="flex items-center justify-between max-w-3xl mx-auto">
          <div>
            <h1 className="text-lg font-bold text-gray-900">Create Bulk Invoice</h1>
            <p className="text-xs text-gray-500">Step {step} of {STEPS.length}: {STEPS[step - 1]}</p>
          </div>
          <StepIndicator current={step} />
        </div>
      </div>

      {/* Step content */}
      <div className="flex-1 overflow-y-auto px-6 py-8">
        <div className="max-w-3xl mx-auto space-y-6">

          {/* ── Step 1: Target Selection ─────── */}
          {step === 1 && (
            <Card>
              <CardContent className="pt-6 space-y-5">
                <div>
                  <h2 className="text-base font-semibold text-gray-900 mb-1">Who are you invoicing?</h2>
                  <p className="text-sm text-gray-500">Choose a specific class or an entire category</p>
                </div>

                {/* Target type toggle */}
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant={targetType === 'class' ? 'default' : 'outline'}
                    className="flex-1"
                    onClick={() => { setTargetType('class'); setTargetValue(''); }}
                  >
                    Specific Class
                  </Button>
                  <Button
                    type="button"
                    variant={targetType === 'category' ? 'default' : 'outline'}
                    className="flex-1"
                    onClick={() => { setTargetType('category'); setTargetValue(''); }}
                  >
                    Entire Category
                  </Button>
                </div>

                {/* Target value dropdown */}
                <div className="space-y-1.5">
                  <Label>{targetType === 'class' ? 'Select Class' : 'Select Category'}</Label>
                  <Select value={targetValue} onValueChange={setTargetValue}>
                    <SelectTrigger>
                      <SelectValue placeholder={targetType === 'class' ? 'Choose a class…' : 'Choose a category…'} />
                    </SelectTrigger>
                    <SelectContent>
                      {targetType === 'class'
                        ? ALL_CLASSES.map((cls) => (
                            <SelectItem key={cls} value={cls}>{cls}</SelectItem>
                          ))
                        : CATEGORY_KEYS.map((cat) => (
                            <SelectItem key={cat} value={cat}>
                              {cat} ({CLASS_CATEGORIES[cat].length} classes)
                            </SelectItem>
                          ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Live student count */}
                {targetValue && (
                  <div className="flex items-center gap-2 rounded-md border border-gray-100 bg-gray-50 px-4 py-3">
                    {countLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
                    ) : (
                      <Users className="h-4 w-4 text-primary" />
                    )}
                    <span className="text-sm text-gray-700">
                      {countLoading
                        ? 'Counting students…'
                        : studentCount !== null
                        ? `This will target ${studentCount} student${studentCount !== 1 ? 's' : ''}${classCount && classCount > 1 ? ` across ${classCount} classes` : ''}`
                        : 'No students found'}
                    </span>
                  </div>
                )}

                {stepErrors[0] && (
                  <p className="text-sm text-destructive">{stepErrors[0]}</p>
                )}
              </CardContent>
            </Card>
          )}

          {/* ── Step 2: Term & Session ───────── */}
          {step === 2 && (
            <Card>
              <CardContent className="pt-6 space-y-5">
                <div>
                  <h2 className="text-base font-semibold text-gray-900 mb-1">Term & Session</h2>
                  <p className="text-sm text-gray-500">Which academic period does this invoice cover?</p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="wizard-term">Term</Label>
                    <Select value={term} onValueChange={setTerm}>
                      <SelectTrigger id="wizard-term">
                        <SelectValue placeholder="Select term" />
                      </SelectTrigger>
                      <SelectContent>
                        {TERM_OPTIONS.map((t) => (
                          <SelectItem key={t} value={t}>{t}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="wizard-session">Session</Label>
                    <Input
                      id="wizard-session"
                      placeholder="2025/2026"
                      value={session}
                      onChange={(e) => setSession(e.target.value)}
                    />
                    <p className="text-xs text-muted-foreground">Format: YYYY/YYYY</p>
                  </div>
                </div>

                {lastUsed && (
                  <p className="text-xs text-gray-500">
                    Pre-filled from your last invoice ({lastUsed.term}, {lastUsed.session}). You can change these.
                  </p>
                )}

                {stepErrors[1] && (
                  <p className="text-sm text-destructive">{stepErrors[1]}</p>
                )}
              </CardContent>
            </Card>
          )}

          {/* ── Step 3: Line Items ───────────── */}
          {step === 3 && (
            <Card>
              <CardContent className="pt-6 space-y-4">
                <div>
                  <h2 className="text-base font-semibold text-gray-900 mb-1">Line Items</h2>
                  <p className="text-sm text-gray-500">
                    These fees apply to each student. Use the arrows to set priority order — top = highest priority.
                  </p>
                </div>

                <div className="space-y-2">
                  {lineItems.map((li, idx) => (
                    <div
                      key={li.key}
                      className="flex items-center gap-2 rounded-md border border-gray-200 bg-gray-50 p-2"
                    >
                      {/* Reorder arrows */}
                      <div className="flex flex-col">
                        <button
                          type="button"
                          onClick={() => moveItem(li.key, 'up')}
                          disabled={idx === 0}
                          className="p-0.5 text-gray-400 hover:text-gray-700 disabled:opacity-30"
                          title="Move up"
                        >
                          <ChevronUp className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => moveItem(li.key, 'down')}
                          disabled={idx === lineItems.length - 1}
                          className="p-0.5 text-gray-400 hover:text-gray-700 disabled:opacity-30"
                          title="Move down"
                        >
                          <ChevronDown className="h-3.5 w-3.5" />
                        </button>
                      </div>

                      {/* Priority badge */}
                      <span className="w-5 text-center text-xs font-medium text-gray-400">
                        {idx + 1}
                      </span>

                      {/* Description */}
                      <Input
                        className="flex-1 bg-white"
                        placeholder="Description"
                        value={li.description}
                        onChange={(e) => updateItem(li.key, 'description', e.target.value)}
                      />

                      {/* Amount */}
                      <div className="relative w-36">
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
                          onChange={(e) => updateItem(li.key, 'amountDue', e.target.value)}
                        />
                      </div>

                      {/* Remove */}
                      {lineItems.length > 1 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-red-500 hover:text-red-700"
                          onClick={() => removeItem(li.key)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  ))}
                </div>

                <Button type="button" variant="outline" size="sm" onClick={addItem}>
                  <Plus className="mr-1 h-3 w-3" />
                  Add Line Item
                </Button>

                {/* Running total */}
                <div className="rounded-md border border-gray-200 bg-white px-4 py-3 text-right">
                  <span className="text-sm text-muted-foreground">Total per student: </span>
                  <span className="text-lg font-bold text-gray-900">
                    {kobotoNaira(totalPerStudent)}
                  </span>
                </div>

                {stepErrors[2] && (
                  <p className="text-sm text-destructive">{stepErrors[2]}</p>
                )}
              </CardContent>
            </Card>
          )}

          {/* ── Step 4: Review ───────────────── */}
          {step === 4 && (
            <div className="space-y-4">
              <Card>
                <CardContent className="pt-6 space-y-4">
                  <div>
                    <h2 className="text-base font-semibold text-gray-900 mb-1">Review before creating</h2>
                    <p className="text-sm text-gray-500">
                      Please confirm the details below before submitting.
                    </p>
                  </div>

                  {/* Plain English summary */}
                  <div className="rounded-md border border-blue-100 bg-blue-50 px-4 py-3">
                    <p className="text-sm text-blue-900 leading-relaxed">
                      You are about to invoice{' '}
                      {classCount && classCount > 1
                        ? `${classCount} classes (${targetLabel})`
                        : <strong>{targetLabel}</strong>}
                      ,{' '}
                      <strong>{studentCount ?? '?'} student{(studentCount ?? 0) !== 1 ? 's' : ''}</strong>
                      ,{' '}
                      <strong>{kobotoNaira(totalPerStudent)}</strong> each.
                      {studentCount ? (
                        <>
                          {' '}Total: <strong>{kobotoNaira(grandTotal)}</strong>.
                        </>
                      ) : null}
                    </p>
                  </div>

                  {/* Details table */}
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between border-b pb-1">
                      <span className="text-gray-500">Target</span>
                      <span className="font-medium text-gray-900">{targetLabel}</span>
                    </div>
                    <div className="flex justify-between border-b pb-1">
                      <span className="text-gray-500">Term</span>
                      <span className="font-medium text-gray-900">{term}</span>
                    </div>
                    <div className="flex justify-between border-b pb-1">
                      <span className="text-gray-500">Session</span>
                      <span className="font-medium text-gray-900">{session}</span>
                    </div>
                  </div>

                  {/* Line items summary */}
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-1.5">
                      Line Items (priority order)
                    </p>
                    <div className="overflow-hidden rounded-md border border-gray-200 bg-white text-sm">
                      {lineItems.map((li, idx) => (
                        <div
                          key={li.key}
                          className="flex items-center justify-between px-3 py-2 border-b border-gray-100 last:border-b-0"
                        >
                          <span className="flex items-center gap-2 text-gray-700">
                            <span className="text-xs text-gray-400 w-4">{idx + 1}.</span>
                            {li.description}
                          </span>
                          <span className="font-medium tabular-nums text-gray-900">
                            {kobotoNaira(nairaToKobo(parseFloat(li.amountDue) || 0))}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 p-3">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                    <p className="text-xs text-amber-700">
                      Students who already have an invoice for <strong>{term} — {session}</strong> will
                      be automatically skipped and shown in the results.
                    </p>
                  </div>

                  {submitError && (
                    <p className="text-sm text-destructive">{submitError}</p>
                  )}
                </CardContent>
              </Card>
            </div>
          )}

        </div>
      </div>

      {/* Sticky footer with navigation */}
      <div className="sticky bottom-0 z-10 border-t border-gray-200 bg-white px-6 py-4 shadow-sm">
        <div className="flex items-center justify-between max-w-3xl mx-auto">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.push('/dashboard/invoices')}
          >
            Cancel
          </Button>

          <div className="flex gap-3">
            {step > 1 && (
              <Button
                type="button"
                variant="outline"
                onClick={goBack}
                disabled={submitting}
              >
                <ArrowLeft className="mr-1.5 h-4 w-4" />
                Back
              </Button>
            )}

            {step < 4 ? (
              <Button type="button" onClick={tryNext}>
                Next
                <ArrowRight className="ml-1.5 h-4 w-4" />
              </Button>
            ) : (
              <Button
                type="button"
                onClick={handleSubmit}
                disabled={submitting}
                className="min-w-[160px]"
              >
                {submitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creating invoices…
                  </>
                ) : (
                  'Create Invoices'
                )}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
