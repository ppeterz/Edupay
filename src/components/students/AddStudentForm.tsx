'use client';

// ──────────────────────────────────────────────
// EduPay — Add Student Form
// ──────────────────────────────────────────────
// Rendered inside a Dialog. Creates a student + Nomba virtual account.

import { useState, type FormEvent } from 'react';
import { getFirebaseAuth } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';
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
import { Loader2, CheckCircle2, Copy } from 'lucide-react';
import type { Student } from '@/types';

import { ALL_CLASSES } from '@/lib/constants';

// ── Props ────────────────────────────────────

interface AddStudentFormProps {
  onSuccess: (student: Student) => void;
  onCancel: () => void;
}

// ── Component ────────────────────────────────

type FormState = 'idle' | 'loading' | 'success' | 'error';

export function AddStudentForm({ onSuccess, onCancel }: AddStudentFormProps) {
  const { user } = useAuth();
  const [fullName, setFullName] = useState('');
  const [studentClass, setStudentClass] = useState('');
  const [admissionNumber, setAdmissionNumber] = useState('');
  const [formState, setFormState] = useState<FormState>('idle');
  const [error, setError] = useState('');
  const [createdStudent, setCreatedStudent] = useState<Student | null>(null);
  const [copied, setCopied] = useState(false);

  function resetForm() {
    setFullName('');
    setStudentClass('');
    setAdmissionNumber('');
    setFormState('idle');
    setError('');
    setCreatedStudent(null);
    setCopied(false);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setFormState('loading');

    try {
      const auth = getFirebaseAuth();
      const token = await auth.currentUser?.getIdToken();
      if (!token) {
        setError('Not authenticated. Please sign in again.');
        setFormState('error');
        return;
      }

      const res = await fetch('/api/students/create', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          fullName: fullName.trim(),
          studentClass: studentClass,
          admissionNumber: admissionNumber.trim(),
          schoolId: user?.uid,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        if (res.status === 409) {
          setError(
            'A student with this admission number already exists'
          );
        } else if (res.status === 502) {
          setError(
            'Could not create virtual account. Please try again.'
          );
        } else {
          setError(data.error ?? 'Failed to add student');
        }
        setFormState('error');
        return;
      }

      const { student } = await res.json();
      setCreatedStudent(student);
      setFormState('success');
      onSuccess(student);
    } catch {
      setError('Connection failed. Check your internet and try again.');
      setFormState('error');
    }
  }

  async function copyAccountNumber() {
    if (!createdStudent) return;
    try {
      await navigator.clipboard.writeText(
        createdStudent.virtualAccountNumber
      );
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API may not be available
    }
  }

  // ── Success card ─────────────────────────────

  if (formState === 'success' && createdStudent) {
    return (
      <div className="space-y-4">
        <div className="rounded-lg border-2 border-green-200 bg-green-50 p-5">
          <div className="mb-4 flex items-center gap-2 text-green-700">
            <CheckCircle2 className="h-5 w-5" />
            <span className="font-semibold">
              Student added successfully
            </span>
          </div>

          <div className="space-y-3 text-sm">
            <div>
              <span className="text-gray-500">Name:</span>{' '}
              <span className="font-medium text-gray-900">
                {createdStudent.fullName}
              </span>
            </div>

            <div>
              <span className="text-gray-500">
                Virtual Account Number:
              </span>
              <div className="mt-1 flex items-center gap-2">
                <span className="rounded bg-white px-3 py-1.5 font-mono text-lg font-bold text-gray-900 shadow-sm">
                  {createdStudent.virtualAccountNumber}
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={copyAccountNumber}
                  className="h-8 w-8 p-0"
                >
                  <Copy className="h-4 w-4" />
                </Button>
                {copied && (
                  <span className="text-xs text-green-600">
                    Copied!
                  </span>
                )}
              </div>
            </div>

            <div>
              <span className="text-gray-500">Bank:</span>{' '}
              <span className="font-medium text-gray-900">
                {createdStudent.virtualAccountBankName}
              </span>
            </div>

            <div>
              <span className="text-gray-500">Reference:</span>{' '}
              <span className="font-mono text-xs text-gray-600">
                {createdStudent.virtualAccountReference}
              </span>
            </div>
          </div>

          <p className="mt-4 text-xs text-gray-500">
            Share this account number with the student&apos;s parent
            for fee payments.
          </p>
        </div>

        <div className="flex gap-3">
          <Button
            type="button"
            variant="outline"
            className="flex-1"
            onClick={resetForm}
          >
            Add Another Student
          </Button>
          <Button
            type="button"
            className="flex-1"
            onClick={onCancel}
          >
            Done
          </Button>
        </div>
      </div>
    );
  }

  // ── Form ─────────────────────────────────────

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="add-fullName">Full Name</Label>
        <Input
          id="add-fullName"
          placeholder="e.g. Adewale Johnson"
          required
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          disabled={formState === 'loading'}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="add-class">Class</Label>
        <Select
          value={studentClass}
          onValueChange={setStudentClass}
          disabled={formState === 'loading'}
        >
          <SelectTrigger id="add-class">
            <SelectValue placeholder="Select class" />
          </SelectTrigger>
          <SelectContent>
            {ALL_CLASSES.map((cls) => (
              <SelectItem key={cls} value={cls}>
                {cls}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="add-admissionNumber">Admission Number</Label>
        <Input
          id="add-admissionNumber"
          placeholder="e.g. ADM2024001"
          required
          value={admissionNumber}
          onChange={(e) => setAdmissionNumber(e.target.value)}
          disabled={formState === 'loading'}
        />
        <p className="text-xs text-muted-foreground">
          Letters, numbers, and hyphens only (e.g. ADM-2024-001)
        </p>
      </div>

      {(formState === 'error' || error) && (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      )}

      <Button
        type="submit"
        className="w-full"
        size="lg"
        disabled={
          formState === 'loading' || !fullName || !studentClass || !admissionNumber
        }
      >
        {formState === 'loading' ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Creating virtual account...
          </>
        ) : (
          'Add Student'
        )}
      </Button>
    </form>
  );
}
