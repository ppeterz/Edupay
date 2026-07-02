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
    <div className="flex flex-col items-center gap-6">
      {/* Logo / wordmark */}
      <div className="flex items-center gap-2">
        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-lg font-bold text-primary-foreground">
          ₦
        </span>
        <span className="text-xl font-bold tracking-tight">SchoolLedger</span>
      </div>

      <Card className="w-full">
        <CardHeader>
          <CardTitle className="text-lg">Register your school</CardTitle>
          <CardDescription>
            Create an account to start managing payments
          </CardDescription>
        </CardHeader>

        <CardContent>
          <form
            id="register-form"
            onSubmit={handleSubmit}
            className="grid gap-4"
          >
            {/* School Name */}
            <div className="grid gap-2">
              <Label htmlFor="schoolName">School Name</Label>
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
              />
              {fieldErrors.schoolName && (
                <p className="text-xs text-destructive">
                  {fieldErrors.schoolName}
                </p>
              )}
            </div>

            {/* Email */}
            <div className="grid gap-2">
              <Label htmlFor="email">Admin Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="admin@school.edu"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={loading}
              />
            </div>

            {/* Password */}
            <div className="grid gap-2">
              <Label htmlFor="password">Password</Label>
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
              />
              {fieldErrors.password && (
                <p className="text-xs text-destructive">
                  {fieldErrors.password}
                </p>
              )}
            </div>

            {/* Confirm Password */}
            <div className="grid gap-2">
              <Label htmlFor="confirmPassword">Confirm Password</Label>
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
              />
              {fieldErrors.confirmPassword && (
                <p className="text-xs text-destructive">
                  {fieldErrors.confirmPassword}
                </p>
              )}
            </div>

            {/* Global error */}
            {error && (
              <p className="text-sm text-destructive" role="alert">
                {error}
              </p>
            )}

            <Button
              type="submit"
              className="w-full"
              size="lg"
              disabled={loading}
            >
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create Account
            </Button>
          </form>
        </CardContent>

        <CardFooter className="justify-center">
          <p className="text-sm text-muted-foreground">
            Already registered?{' '}
            <Link
              href="/login"
              className="font-medium text-primary underline-offset-4 hover:underline"
            >
              Sign in
            </Link>
          </p>
        </CardFooter>
      </Card>
    </div>
  );
}
