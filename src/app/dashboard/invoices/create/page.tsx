'use client';

// ──────────────────────────────────────────────
// EduPay — Premium Redesigned Bulk Invoice Wizard
// ──────────────────────────────────────────────

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
  Calendar,
} from 'lucide-react';

type TargetType = 'class' | 'category';

const CATEGORY_KEYS = Object.keys(CLASS_CATEGORIES) as ClassCategory[];
const TERM_OPTIONS = ['First Term', 'Second Term', 'Third Term'];
const STEPS = ['Target Audience', 'Academic Period', 'Fee Line Items', 'Summary Review'] as const;

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

function StepIndicator({ current }: { current: number }) {
  return (
    <div className="flex flex-wrap items-center gap-3 select-none mb-6">
      {STEPS.map((label, idx) => {
        const stepNum = idx + 1;
        const done = stepNum < current;
        const active = stepNum === current;
        return (
          <div key={label} className="flex items-center gap-2">
            <div
              className={`flex h-8 w-8 items-center justify-center rounded-xl text-xs font-bold transition-all duration-300 ${
                done
                  ? 'bg-slate-950 text-white'
                  : active
                  ? 'bg-blue-600 text-white ring-4 ring-blue-600/15'
                  : 'bg-slate-100 text-slate-400 border border-slate-200/50'
              }`}
            >
              {done ? <CheckCircle2 className="h-4 w-4" /> : stepNum}
            </div>
            <span
              className={`hidden md:inline text-xs font-bold tracking-tight ${
                active ? 'text-slate-950' : done ? 'text-slate-500' : 'text-slate-400'
              }`}
            >
              {label}
            </span>
            {idx < STEPS.length - 1 && (
              <div
                className={`hidden md:block h-0.5 w-6 rounded ${
                  done ? 'bg-slate-950' : 'bg-slate-200'
                }`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

export default function CreateBulkInvoicePage() {
  const router = useRouter();
  const { user, school } = useAuth();
  const lastUsed = school?.lastUsedTermSession;

  const [step, setStep] = useState(1);
  const [targetType, setTargetType] = useState<TargetType>('class');
  const [targetValue, setTargetValue] = useState('');
  const [studentCount, setStudentCount] = useState<number | null>(null);
  const [classCount, setClassCount] = useState<number | null>(null);
  const [countLoading, setCountLoading] = useState(false);

  const [term, setTerm] = useState(lastUsed?.term ?? '');
  const [session, setSession] = useState(lastUsed?.session ?? '');

  const [lineItems, setLineItems] = useState<LineItemRow[]>(getDefaultLineItems);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

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
    else {
      setStudentCount(null);
      setClassCount(null);
    }
  }, [targetType, targetValue, fetchCount]);

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

  const totalPerStudent = lineItems.reduce((sum, li) => {
    const amt = parseFloat(li.amountDue);
    return sum + (isNaN(amt) ? 0 : nairaToKobo(amt));
  }, 0);
  const grandTotal = totalPerStudent * (studentCount ?? 0);

  const targetLabel =
    targetType === 'class'
      ? targetValue
      : `${targetValue} (${classCount ?? '?'} classes)`;

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

      if (!data.runId) {
        try {
          sessionStorage.setItem('bulk_run_fallback', JSON.stringify(data));
        } catch {}
        router.push('/dashboard/invoices/results/fallback');
      } else {
        router.push(`/dashboard/invoices/results/${data.runId}`);
      }
    } catch {
      setSubmitError('Connection failed. Check your internet and try again.');
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between pb-4 border-b border-slate-100">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-955 tracking-tight">Create Bulk Invoice</h1>
          <p className="text-xs text-slate-500 font-medium mt-0.5">Generate fees for multiple students simultaneously</p>
        </div>
        <StepIndicator current={step} />
      </div>

      {/* Step Contents */}
      <div className="space-y-6">
        {/* Step 1: Target Selection */}
        {step === 1 && (
          <Card className="rounded-[28px] border-slate-200/50 shadow-sm bg-white overflow-hidden">
            <CardContent className="p-6 space-y-6">
              <div>
                <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500">Who are you invoicing?</h2>
                <p className="text-xs text-slate-400 font-medium mt-0.5">Choose a specific class category or class grade</p>
              </div>

              {/* Toggle Switch */}
              <div className="flex gap-2 p-1 rounded-2xl bg-slate-100/70 border border-slate-200/30">
                <button
                  type="button"
                  className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-all duration-200 ${
                    targetType === 'class'
                      ? 'bg-white text-slate-950 shadow-sm'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                  onClick={() => { setTargetType('class'); setTargetValue(''); }}
                >
                  Specific Class
                </button>
                <button
                  type="button"
                  className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-all duration-200 ${
                    targetType === 'category'
                      ? 'bg-white text-slate-950 shadow-sm'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                  onClick={() => { setTargetType('category'); setTargetValue(''); }}
                >
                  Entire Category
                </button>
              </div>

              {/* Selection */}
              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase tracking-wider text-slate-400">{targetType === 'class' ? 'Select Class' : 'Select Category'}</Label>
                <Select value={targetValue} onValueChange={setTargetValue}>
                  <SelectTrigger className="w-full h-11 rounded-xl border-slate-200 bg-white font-semibold text-sm">
                    <SelectValue placeholder={targetType === 'class' ? 'Choose class grade…' : 'Choose student category…'} />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    {targetType === 'class'
                      ? ALL_CLASSES.map((cls) => (
                          <SelectItem key={cls} value={cls} className="text-xs font-semibold">{cls}</SelectItem>
                        ))
                      : CATEGORY_KEYS.map((cat) => (
                          <SelectItem key={cat} value={cat} className="text-xs font-semibold">
                            {cat} ({CLASS_CATEGORIES[cat].length} classes)
                          </SelectItem>
                        ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Live Count Badge */}
              {targetValue && (
                <div className="flex items-center gap-3 rounded-2xl border border-slate-200/50 bg-[#e2edf8]/20 px-4 py-3.5">
                  {countLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
                  ) : (
                    <Users className="h-4.5 w-4.5 text-blue-600" />
                  )}
                  <span className="text-xs font-semibold text-slate-700">
                    {countLoading
                      ? 'Reconciling student count…'
                      : studentCount !== null
                      ? `Targets ${studentCount} active student${studentCount !== 1 ? 's' : ''}${classCount && classCount > 1 ? ` across ${classCount} classes` : ''}`
                      : 'No students found'}
                  </span>
                </div>
              )}

              {stepErrors[0] && (
                <p className="text-xs font-bold text-red-650" role="alert">{stepErrors[0]}</p>
              )}
            </CardContent>
          </Card>
        )}

        {/* Step 2: Term & Session */}
        {step === 2 && (
          <Card className="rounded-[28px] border-slate-200/50 shadow-sm bg-white overflow-hidden">
            <CardContent className="p-6 space-y-6">
              <div>
                <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500">Term & Session</h2>
                <p className="text-xs text-slate-400 font-medium mt-0.5">Define academic time blocks for the invoices</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div className="space-y-2">
                  <Label htmlFor="wizard-term" className="text-xs font-bold uppercase tracking-wider text-slate-400">Academic Term</Label>
                  <Select value={term} onValueChange={setTerm}>
                    <SelectTrigger id="wizard-term" className="w-full h-11 rounded-xl border-slate-200 bg-white font-semibold text-sm">
                      <SelectValue placeholder="Select term" />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl">
                      {TERM_OPTIONS.map((t) => (
                        <SelectItem key={t} value={t} className="text-xs font-semibold">{t}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="wizard-session" className="text-xs font-bold uppercase tracking-wider text-slate-400">Academic Session</Label>
                  <Input
                    id="wizard-session"
                    placeholder="2025/2026"
                    value={session}
                    onChange={(e) => setSession(e.target.value)}
                    className="w-full h-11 rounded-xl border-slate-200 bg-white shadow-sm font-semibold text-sm px-4"
                  />
                  <p className="text-[10px] text-slate-450 font-semibold">Format: YYYY/YYYY (e.g., 2026/2027)</p>
                </div>
              </div>

              {lastUsed && (
                <div className="flex items-center gap-2 rounded-2xl bg-slate-50 border border-slate-100 p-3.5 text-xs text-slate-500 font-semibold">
                  <Calendar className="h-4 w-4 text-slate-450" />
                  <span>
                    Pre-filled from last entry: {lastUsed.term} &middot; {lastUsed.session}
                  </span>
                </div>
              )}

              {stepErrors[1] && (
                <p className="text-xs font-bold text-red-650" role="alert">{stepErrors[1]}</p>
              )}
            </CardContent>
          </Card>
        )}

        {/* Step 3: Line Items */}
        {step === 3 && (
          <Card className="rounded-[28px] border-slate-200/50 shadow-sm bg-white overflow-hidden">
            <CardContent className="p-6 space-y-6">
              <div>
                <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500">Fee Items structure</h2>
                <p className="text-xs text-slate-400 font-medium mt-0.5">
                  Set priority order: top positions will be settled first by reconciliation workers
                </p>
              </div>

              <div className="space-y-3.5">
                {lineItems.map((li, idx) => (
                  <div
                    key={li.key}
                    className="flex items-center gap-2.5 rounded-2xl border border-slate-200/40 bg-slate-50/50 p-3"
                  >
                    {/* Move controls */}
                    <div className="flex flex-col">
                      <button
                        type="button"
                        onClick={() => moveItem(li.key, 'up')}
                        disabled={idx === 0}
                        className="p-1 rounded hover:bg-slate-100 text-slate-400 hover:text-slate-700 disabled:opacity-20"
                        title="Move up"
                      >
                        <ChevronUp className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => moveItem(li.key, 'down')}
                        disabled={idx === lineItems.length - 1}
                        className="p-1 rounded hover:bg-slate-100 text-slate-400 hover:text-slate-700 disabled:opacity-20"
                        title="Move down"
                      >
                        <ChevronDown className="h-4 w-4" />
                      </button>
                    </div>

                    {/* Numeric Priority index */}
                    <span className="w-6 text-center text-xs font-bold text-slate-400">
                      {idx + 1}
                    </span>

                    {/* Input */}
                    <Input
                      className="flex-1 bg-white h-10 rounded-xl border-slate-200 text-sm font-semibold px-3"
                      placeholder="e.g. Tuition fee"
                      value={li.description}
                      onChange={(e) => updateItem(li.key, 'description', e.target.value)}
                    />

                    {/* Cost */}
                    <div className="relative w-36">
                      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                        ₦
                      </span>
                      <Input
                        className="bg-white pl-7 h-10 rounded-xl border-slate-200 text-sm font-bold font-mono text-right pr-3"
                        type="number"
                        min="0"
                        step="any"
                        placeholder="0"
                        value={li.amountDue}
                        onChange={(e) => updateItem(li.key, 'amountDue', e.target.value)}
                      />
                    </div>

                    {/* Delete */}
                    {lineItems.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-9 w-9 rounded-xl text-red-500 hover:text-red-700 hover:bg-red-50"
                        onClick={() => removeItem(li.key)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>

              <div className="flex items-center justify-between gap-4">
                <Button 
                  type="button" 
                  variant="outline" 
                  size="sm" 
                  onClick={addItem}
                  className="rounded-xl border-slate-200 bg-white font-bold text-xs h-9 px-4 shadow-sm"
                >
                  <Plus className="mr-1.5 h-3.5 w-3.5" />
                  Add Line Item
                </Button>

                {/* Total */}
                <div className="rounded-xl border border-slate-100 bg-slate-50/50 px-4 py-2 text-right">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Total per student: </span>
                  <span className="text-base font-extrabold font-mono text-slate-950 ml-1">
                    {kobotoNaira(totalPerStudent)}
                  </span>
                </div>
              </div>

              {stepErrors[2] && (
                <p className="text-xs font-bold text-red-650" role="alert">{stepErrors[2]}</p>
              )}
            </CardContent>
          </Card>
        )}

        {/* Step 4: Summary Review */}
        {step === 4 && (
          <div className="space-y-4">
            <Card className="rounded-[28px] border-slate-200/50 shadow-sm bg-white overflow-hidden">
              <CardContent className="p-6 space-y-6">
                <div>
                  <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500">Review Invoices Settings</h2>
                  <p className="text-xs text-slate-400 font-medium mt-0.5">Please confirm parameters before generating bulk ledger rows</p>
                </div>

                {/* Summary Alert banner */}
                <div className="rounded-2xl border border-blue-100 bg-blue-50/50 px-5 py-4">
                  <p className="text-xs text-blue-900 leading-relaxed font-semibold">
                    You are generating invoices for{' '}
                    {classCount && classCount > 1
                      ? `${classCount} classes (${targetLabel})`
                      : <strong>{targetLabel}</strong>}
                    , targeting <strong>{studentCount ?? '?'} student{(studentCount ?? 0) !== 1 ? 's' : ''}</strong> at{' '}
                    <strong>{kobotoNaira(totalPerStudent)}</strong> each.
                    {studentCount ? (
                      <>
                        {' '}Grand sum: <strong className="font-mono text-blue-950">{kobotoNaira(grandTotal)}</strong>.
                      </>
                    ) : null}
                  </p>
                </div>

                {/* Grid details */}
                <div className="space-y-2 text-xs border border-slate-100 rounded-2xl p-4 bg-slate-50/20">
                  <div className="flex justify-between border-b border-slate-100 pb-2.5">
                    <span className="text-slate-450 font-bold uppercase tracking-wider">Audience Target</span>
                    <span className="font-bold text-slate-900">{targetLabel}</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-100 py-2.5">
                    <span className="text-slate-450 font-bold uppercase tracking-wider">Academic Term</span>
                    <span className="font-bold text-slate-900">{term}</span>
                  </div>
                  <div className="flex justify-between pt-2.5">
                    <span className="text-slate-450 font-bold uppercase tracking-wider">Academic Session</span>
                    <span className="font-bold text-slate-900 font-mono">{session}</span>
                  </div>
                </div>

                {/* Line items summary list */}
                <div className="space-y-2">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Line Items Priorities
                  </p>
                  <div className="overflow-hidden rounded-2xl border border-slate-200/50 bg-white text-xs">
                    {lineItems.map((li, idx) => (
                      <div
                        key={li.key}
                        className="flex items-center justify-between px-4 py-3 border-b border-slate-100 last:border-b-0"
                      >
                        <span className="flex items-center gap-2 text-slate-700 font-bold">
                          <span className="text-slate-400 w-4 font-mono">{idx + 1}.</span>
                          {li.description}
                        </span>
                        <span className="font-bold font-mono text-slate-900 tabular-nums">
                          {kobotoNaira(nairaToKobo(parseFloat(li.amountDue) || 0))}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Warning message */}
                <div className="flex items-start gap-3 rounded-2xl border border-amber-200/60 bg-amber-50/40 p-4">
                  <AlertTriangle className="mt-0.5 h-4.5 w-4.5 shrink-0 text-amber-600" />
                  <p className="text-xs text-amber-800 leading-relaxed font-semibold">
                    Invoices are safe: students who already hold a record for <strong>{term} &middot; {session}</strong> will
                    be automatically skipped to prevent double collection.
                  </p>
                </div>

                {submitError && (
                  <p className="text-xs font-bold text-red-650" role="alert">{submitError}</p>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </div>

      {/* Navigation action footer */}
      <div className="flex items-center justify-between pt-6 border-t border-slate-100 mt-6">
        <Button
          type="button"
          variant="outline"
          onClick={() => router.push('/dashboard/invoices')}
          className="rounded-xl border-slate-200 bg-white hover:bg-slate-50 font-bold text-xs h-10 px-4"
        >
          Cancel Wizard
        </Button>

        <div className="flex gap-2.5">
          {step > 1 && (
            <Button
              type="button"
              variant="outline"
              onClick={goBack}
              disabled={submitting}
              className="rounded-xl border-slate-200 bg-white hover:bg-slate-50 font-bold text-xs h-10 px-4"
            >
              <ArrowLeft className="mr-1.5 h-4 w-4" />
              Back
            </Button>
          )}

          {step < 4 ? (
            <Button 
              type="button" 
              onClick={tryNext}
              className="rounded-xl bg-slate-950 text-white font-bold hover:bg-slate-900 shadow-md shadow-slate-950/10 h-10 px-4 text-xs"
            >
              Next Step
              <ArrowRight className="ml-1.5 h-4 w-4" />
            </Button>
          ) : (
            <Button
              type="button"
              onClick={handleSubmit}
              disabled={submitting}
              className="min-w-[160px] rounded-xl bg-slate-950 text-white font-bold hover:bg-slate-900 shadow-md shadow-slate-950/10 h-10 px-4 text-xs"
            >
              {submitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating...
                </>
              ) : (
                'Generate Invoices'
              )}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
