'use client';

// ──────────────────────────────────────────────
// EduPay — Login Page
// ──────────────────────────────────────────────

import { useState, type FormEvent } from 'react';
import { signInWithEmailAndPassword } from 'firebase/auth';
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
  'auth/user-not-found': 'No account found with this email',
  'auth/wrong-password': 'Incorrect password',
  'auth/too-many-requests': 'Too many attempts. Please try again later',
  'auth/invalid-email': 'Please enter a valid email address',
  'auth/invalid-credential': 'Incorrect email or password',
};

function friendlyError(code: string): string {
  return ERROR_MAP[code] ?? 'Sign in failed. Please try again';
}

// ── Component ────────────────────────────────

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const auth = getFirebaseAuth();
      await signInWithEmailAndPassword(auth, email, password);
      router.push('/dashboard');
    } catch (err: unknown) {
      const code =
        err instanceof Error && 'code' in err
          ? (err as { code: string }).code
          : '';
      setError(friendlyError(code));
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
          <CardTitle className="text-xl font-bold text-slate-950">Welcome back</CardTitle>
          <CardDescription className="text-sm font-medium text-slate-500 mt-1">
            Sign in to your school&apos;s financial dashboard
          </CardDescription>
        </CardHeader>

        <CardContent className="px-8 pb-6">
          <form id="login-form" onSubmit={handleSubmit} className="grid gap-5">
            <div className="grid gap-2">
              <Label htmlFor="email" className="text-xs font-bold uppercase tracking-wider text-slate-400">Email</Label>
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

            <div className="grid gap-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password" className="text-xs font-bold uppercase tracking-wider text-slate-400">Password</Label>
              </div>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
                className="h-11 rounded-xl border-slate-200 focus-visible:ring-slate-950 focus-visible:border-slate-950 font-medium text-sm px-4"
              />
            </div>

            {error && (
              <p className="text-sm font-semibold text-red-650" role="alert">
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
              Sign In
            </Button>
          </form>
        </CardContent>

        <CardFooter className="justify-center border-t border-slate-100 bg-slate-50/50 py-5 px-8">
          <p className="text-xs font-medium text-slate-500">
            Don&apos;t have an account?{' '}
            <Link
              href="/register"
              className="font-bold text-slate-950 hover:underline underline-offset-4"
            >
              Register your school
            </Link>
          </p>
        </CardFooter>
      </Card>
    </div>
  );
}
