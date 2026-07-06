'use client';

// ──────────────────────────────────────────────
// EduPay — Register Page
// ──────────────────────────────────────────────

import { useState, type FormEvent } from 'react';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { getFirebaseAuth } from '@/lib/firebase';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2 } from 'lucide-react';

// ── Firebase error → human message ───────────

const ERROR_MAP: Record<string, string> = {
  'auth/email-already-in-use': 'An account already exists with this email',
  'auth/weak-password': 'Password must be at least 8 characters',
  'auth/invalid-email': 'Please enter a valid email address',
};

function friendlyError(code: string): string {
  return ERROR_MAP[code] ?? 'Registration failed. Please try again';
}

// ── Component ────────────────────────────────

export default function RegisterPage() {
  const router = useRouter();
  const [schoolName, setSchoolName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  function validate(): boolean {
    const errors: Record<string, string> = {};

    if (!schoolName.trim() || schoolName.trim().length < 2) {
      errors.schoolName = 'School name must be at least 2 characters';
    }
    if (password.length < 8) {
      errors.password = 'Password must be at least 8 characters';
    }
    if (password !== confirmPassword) {
      errors.confirmPassword = 'Passwords do not match';
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');

    if (!validate()) return;

    setLoading(true);

    try {
      // 1. Create Firebase Auth user
      const auth = getFirebaseAuth();
      const credential = await createUserWithEmailAndPassword(
        auth,
        email,
        password
      );

      // 2. Get ID token
      const token = await credential.user.getIdToken();

      // 3. Create school document via API
      const response = await fetch('/api/schools/create', {
        method: 'POST',
        headers: {
          Authorization: 'Bearer ' + token,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ schoolName: schoolName.trim() }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error ?? 'Failed to create school');
      }

      // 4. Redirect to dashboard
      router.push('/dashboard');
    } catch (err: unknown) {
      const code =
        err instanceof Error && 'code' in err
          ? (err as { code: string }).code
          : '';
      if (code) {
        setError(friendlyError(code));
      } else {
        setError(
          err instanceof Error
            ? err.message
            : 'Registration failed. Please try again'
        );
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col items-center gap-8">
      {/* Logo / wordmark */}
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-950 text-lg font-bold text-white shadow-md shadow-slate-950/15">
          ₦
        </span>
        <span className="text-2xl font-bold tracking-tight text-slate-950">Edupay</span>
      </div>

      <Card className="w-full border-slate-200/60 shadow-lg shadow-slate-950/5 rounded-[28px] overflow-hidden">
        <CardHeader className="pt-8 px-8">
          <CardTitle className="text-xl font-bold text-slate-950">Register your school</CardTitle>
          <CardDescription className="text-sm font-medium text-slate-500 mt-1">
            Create an account to start managing payments
          </CardDescription>
        </CardHeader>

        <CardContent className="px-8 pb-6">
          <form
            id="register-form"
            onSubmit={handleSubmit}
            className="grid gap-5"
          >
            {/* School Name */}
            <div className="grid gap-2">
              <Label htmlFor="schoolName" className="text-xs font-bold uppercase tracking-wider text-slate-400">School Name</Label>
              <Input
                id="schoolName"
                type="text"
                placeholder="Greenfield Academy"
                required
                value={schoolName}
                onChange={(e) => {
                  setSchoolName(e.target.value);
                  setFieldErrors((prev) => ({ ...prev, schoolName: '' }));
                }}
                disabled={loading}
                aria-invalid={!!fieldErrors.schoolName}
                className="h-11 rounded-xl border-slate-200 focus-visible:ring-slate-950 focus-visible:border-slate-950 font-medium text-sm px-4"
              />
              {fieldErrors.schoolName && (
                <p className="text-xs font-semibold text-red-650">
                  {fieldErrors.schoolName}
                </p>
              )}
            </div>

            {/* Email */}
            <div className="grid gap-2">
              <Label htmlFor="email" className="text-xs font-bold uppercase tracking-wider text-slate-400">Admin Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="admin@school.edu"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={loading}
                className="h-11 rounded-xl border-slate-200 focus-visible:ring-slate-950 focus-visible:border-slate-950 font-medium text-sm px-4"
              />
            </div>

            {/* Password */}
            <div className="grid gap-2">
              <Label htmlFor="password" className="text-xs font-bold uppercase tracking-wider text-slate-400">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                required
                autoComplete="new-password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setFieldErrors((prev) => ({ ...prev, password: '' }));
                }}
                disabled={loading}
                aria-invalid={!!fieldErrors.password}
                className="h-11 rounded-xl border-slate-200 focus-visible:ring-slate-950 focus-visible:border-slate-950 font-medium text-sm px-4"
              />
              {fieldErrors.password && (
                <p className="text-xs font-semibold text-red-650">
                  {fieldErrors.password}
                </p>
              )}
            </div>

            {/* Confirm Password */}
            <div className="grid gap-2">
              <Label htmlFor="confirmPassword" className="text-xs font-bold uppercase tracking-wider text-slate-400">Confirm Password</Label>
              <Input
                id="confirmPassword"
                type="password"
                placeholder="••••••••"
                required
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => {
                  setConfirmPassword(e.target.value);
                  setFieldErrors((prev) => ({
                    ...prev,
                    confirmPassword: '',
                  }));
                }}
                disabled={loading}
                aria-invalid={!!fieldErrors.confirmPassword}
                className="h-11 rounded-xl border-slate-200 focus-visible:ring-slate-950 focus-visible:border-slate-950 font-medium text-sm px-4"
              />
              {fieldErrors.confirmPassword && (
                <p className="text-xs font-semibold text-red-650">
                  {fieldErrors.confirmPassword}
                </p>
              )}
            </div>

            {/* Global error */}
            {error && (
              <p className="text-sm font-semibold text-red-655" role="alert">
                {error}
              </p>
            )}

            <Button
              type="submit"
              className="w-full h-11 rounded-xl bg-slate-950 hover:bg-slate-900 text-white font-bold transition-all shadow-md shadow-slate-950/10 mt-2"
              size="lg"
              disabled={loading}
            >
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create Account
            </Button>
          </form>
        </CardContent>

        <CardFooter className="justify-center border-t border-slate-100 bg-slate-50/50 py-5 px-8">
          <p className="text-xs font-medium text-slate-500">
            Already registered?{' '}
            <Link
              href="/login"
              className="font-bold text-slate-950 hover:underline underline-offset-4"
            >
              Sign in
            </Link>
          </p>
        </CardFooter>
      </Card>
    </div>
  );
}
