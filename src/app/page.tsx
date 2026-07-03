'use client';

// ──────────────────────────────────────────────
// Edupay — Premium Landing Page
// ──────────────────────────────────────────────

import Link from 'next/link';
import {
  ArrowRight,
  ShieldCheck,
  Zap,
  BarChart3,
  Receipt,
  CheckCircle2,
  Lock,
} from 'lucide-react';

export default function Home() {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 selection:bg-slate-900 selection:text-white">
      {/* ── 1. Navbar ── */}
      <header className="sticky top-0 z-50 border-b border-slate-200/80 bg-slate-50/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl h-16 items-center justify-between px-6 lg:px-8">
          <div className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-900 text-lg font-bold text-white shadow-sm">
              ₦
            </span>
            <span className="text-xl font-bold tracking-tight text-slate-900">
              Edupay
            </span>
          </div>
          <nav className="flex items-center gap-6">
            <Link
              href="/login"
              id="nav-login"
              className="text-sm font-semibold text-slate-600 hover:text-slate-900 transition-colors"
            >
              Sign In
            </Link>
            <Link
              href="/register"
              id="nav-register"
              className="inline-flex h-9 items-center justify-center rounded-md bg-slate-900 px-4 text-sm font-semibold text-white shadow hover:bg-slate-800 transition-all hover:scale-[1.02] active:scale-[0.98]"
            >
              Register School
            </Link>
          </nav>
        </div>
      </header>

      {/* ── 2. Hero Section ── */}
      <section className="relative overflow-hidden pt-20 pb-16 lg:pt-32 lg:pb-24">
        {/* Decorative background grid */}
        <div className="absolute inset-0 -z-10 bg-[linear-gradient(to_right,#e2e8f0_1px,transparent_1px),linear-gradient(to_bottom,#e2e8f0_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] opacity-60" />

        <div className="mx-auto max-w-7xl px-6 lg:px-8 text-center">
          <div className="mx-auto max-w-3xl">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-900/5 px-3 py-1.5 text-xs font-semibold text-slate-950 ring-1 ring-inset ring-slate-900/10 mb-6">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Financial Infrastructure for Modern Schools
            </span>
            <h1 className="text-4xl font-extrabold tracking-tight text-slate-900 sm:text-6xl bg-gradient-to-r from-slate-900 via-slate-800 to-slate-950 bg-clip-text text-transparent leading-none">
              Stop Matching Bank Transfers Manually
            </h1>
            <p className="mt-6 text-lg leading-8 text-slate-600 max-w-2xl mx-auto">
              Every student gets a dedicated virtual account. EduPay automatically reconciles payments, updates balances, generates receipts, and gives schools real-time financial visibility.
            </p>
            <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
              <Link
                href="/dashboard"
                id="hero-dashboard-btn"
                className="group inline-flex h-11 items-center justify-center gap-2 rounded-md bg-slate-900 px-6 font-semibold text-white shadow-md hover:bg-slate-800 transition-all hover:scale-[1.02] active:scale-[0.98]"
              >
                Go to Dashboard
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </Link>
              <Link
                href="/register"
                id="hero-register-btn"
                className="inline-flex h-11 items-center justify-center rounded-md border border-slate-300 bg-white px-6 font-semibold text-slate-700 shadow-sm hover:bg-slate-50 transition-all hover:scale-[1.02] active:scale-[0.98]"
              >
                Create Free Account
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── 3. Features Section ── */}
      <section className="py-20 bg-white border-y border-slate-200">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="mx-auto max-w-2xl lg:text-center">
            <h2 className="text-base font-semibold uppercase tracking-wider text-slate-600">
              Core Capabilities
            </h2>
            <p className="mt-2 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
              Everything schools need for modern payments
            </p>
          </div>

          <div className="mx-auto mt-16 max-w-2xl sm:mt-20 lg:mt-24 lg:max-w-none">
            <dl className="grid max-w-xl grid-cols-1 gap-x-8 gap-y-16 lg:max-w-none lg:grid-cols-4">
              {/* Feature 1: Virtual Accounts */}
              <div className="flex flex-col">
                <dt className="flex items-center gap-x-3 text-base font-semibold leading-7 text-slate-900">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-900 text-white shadow-md">
                    <Zap className="h-5 w-5" />
                  </div>
                  Instant Virtual Accounts
                </dt>
                <dd className="mt-4 flex flex-auto flex-col text-base leading-7 text-slate-600">
                  <p className="flex-auto">
                    Provision dedicated virtual account numbers for every student in real-time,
                    allowing direct bank transfers.
                  </p>
                </dd>
              </div>

              {/* Feature 2: Reconciliation Engine */}
              <div className="flex flex-col">
                <dt className="flex items-center gap-x-3 text-base font-semibold leading-7 text-slate-900">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-900 text-white shadow-md">
                    <ShieldCheck className="h-5 w-5" />
                  </div>
                  Smart Reconciliation
                </dt>
                <dd className="mt-4 flex flex-auto flex-col text-base leading-7 text-slate-600">
                  <p className="flex-auto">
                    Processes bank transfers safely with dynamic reconciliation logic, prioritizing tuition
                    and fees in chronological installment stages.
                  </p>
                </dd>
              </div>

              {/* Feature 3: Real-Time Analytics */}
              <div className="flex flex-col">
                <dt className="flex items-center gap-x-3 text-base font-semibold leading-7 text-slate-900">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-900 text-white shadow-md">
                    <BarChart3 className="h-5 w-5" />
                  </div>
                  Interactive Reporting
                </dt>
                <dd className="mt-4 flex flex-auto flex-col text-base leading-7 text-slate-600">
                  <p className="flex-auto">
                    Check school-level and class-level collection rates, track outstanding
                    deficits, and export formatted CSV ledgers instantly.
                  </p>
                </dd>
              </div>

              {/* Feature 4: PDF Receipts */}
              <div className="flex flex-col">
                <dt className="flex items-center gap-x-3 text-base font-semibold leading-7 text-slate-900">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-900 text-white shadow-md">
                    <Receipt className="h-5 w-5" />
                  </div>
                  Auto-Generated Receipts
                </dt>
                <dd className="mt-4 flex flex-auto flex-col text-base leading-7 text-slate-600">
                  <p className="flex-auto">
                    Generates PDF receipts on payment processing using background workers, saving
                    copy links to secure storage.
                  </p>
                </dd>
              </div>
            </dl>
          </div>
        </div>
      </section>

      {/* ── 4. Dashboard Mockup Preview ── */}
      <section className="py-20 bg-slate-50">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-xl max-w-5xl mx-auto overflow-hidden">
            {/* Window header */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-6">
              <div className="flex items-center gap-2">
                <span className="h-3 w-3 rounded-full bg-red-400" />
                <span className="h-3 w-3 rounded-full bg-amber-400" />
                <span className="h-3 w-3 rounded-full bg-emerald-400" />
                <span className="text-xs font-semibold text-slate-400 ml-2 font-mono">
                  Edupay Dashboard Live Preview
                </span>
              </div>
              <div className="h-2 w-24 rounded-full bg-slate-100" />
            </div>

            {/* Layout simulation */}
            <div className="grid gap-6 md:grid-cols-3">
              {/* Left pane stats */}
              <div className="md:col-span-2 space-y-6">
                <div className="grid gap-4 grid-cols-2">
                  <div className="rounded-xl border border-slate-100 bg-slate-50/50 p-5">
                    <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                      Total Revenue
                    </p>
                    <p className="text-2xl font-bold mt-1 text-slate-900 font-mono">
                      ₦8,450,000.00
                    </p>
                  </div>
                  <div className="rounded-xl border border-slate-100 bg-slate-50/50 p-5">
                    <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                      Collection Rate
                    </p>
                    <p className="text-2xl font-bold mt-1 text-emerald-600 font-mono">
                      94.2%
                    </p>
                  </div>
                </div>

                {/* Simulated Ledger list */}
                <div className="rounded-xl border border-slate-200 p-5 space-y-4">
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Recent Activity Logs
                  </p>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-2.5 text-sm">
                      <div>
                        <p className="font-semibold text-slate-900">Tola Babs</p>
                        <p className="text-xs text-slate-500">JSS 2 • ADM-001</p>
                      </div>
                      <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-700">
                        Paid
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <div>
                        <p className="font-semibold text-slate-900">pelumi peterz</p>
                        <p className="text-xs text-slate-500">Primary 1 • ADM-002</p>
                      </div>
                      <span className="inline-flex items-center rounded-full bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-700">
                        Partial
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Developer Logs Feed */}
              <div className="rounded-xl border border-slate-200 bg-slate-900 p-5 text-white flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
                    <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                      Payment Processing Pipeline
                    </p>
                    <span className="relative flex h-2 w-2">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
                      <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500"></span>
                    </span>
                  </div>
                  <div className="space-y-4 font-mono text-[11px] text-slate-400">
                    <div>
                      <p className="text-emerald-400">[13:42:01] Bank transfer detected</p>
                      <p className="text-slate-300 pl-4">₦30,000 received from Tola Babs</p>
                    </div>
                    <div>
                      <p className="text-emerald-400">[13:42:02] Student matched</p>
                      <p className="text-slate-300 pl-4">Admission No: STD-1023</p>
                    </div>
                    <div>
                      <p className="text-emerald-400">[13:42:03] Reconciliation completed</p>
                      <p className="text-slate-300 pl-4">Applied to Term 2 Tuition</p>
                    </div>
                    <div>
                      <p className="text-emerald-400">[13:42:04] Receipt generated</p>
                      <p className="text-slate-500 pl-4">RCP-8E7B24A9.pdf</p>
                    </div>
                  </div>
                </div>
                <div className="pt-4 border-t border-slate-800 flex items-center justify-between text-xs text-slate-500">
                  <span>SSL SECURE</span>
                  <Lock className="h-3 w-3" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── 5. CTA Section ── */}
      <section className="py-16 bg-slate-900 text-white relative overflow-hidden">
        {/* Decorative backdrop blobs */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] rounded-full bg-blue-500/10 blur-[100px] pointer-events-none" />

        <div className="mx-auto max-w-7xl px-6 lg:px-8 text-center relative z-10">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
            Streamline your school's finances today
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-base text-slate-300">
            Provision virtual accounts, automate tuition reconciliation, and monitor payment status
            in real time.
          </p>
          <div className="mt-8 flex justify-center gap-x-4">
            <Link
              href="/register"
              id="cta-register-bottom"
              className="inline-flex h-11 items-center justify-center rounded-md bg-white px-6 font-semibold text-slate-950 shadow-md hover:bg-slate-100 transition-all hover:scale-[1.02] active:scale-[0.98]"
            >
              Get Started for Free
            </Link>
            <Link
              href="/login"
              id="cta-login-bottom"
              className="inline-flex h-11 items-center justify-center rounded-md border border-slate-700 bg-slate-900 px-6 font-semibold text-white hover:bg-slate-800 transition-all hover:scale-[1.02] active:scale-[0.98]"
            >
              School Sign In
            </Link>
          </div>
        </div>
      </section>

      {/* ── 6. Footer ── */}
      <footer className="border-t border-slate-200 bg-slate-50 py-12">
        <div className="mx-auto max-w-7xl px-6 lg:px-8 text-center text-xs text-slate-500">
          <div className="flex items-center justify-center gap-2 mb-4">
            <span className="flex h-6 w-6 items-center justify-center rounded-md bg-slate-900 text-xs font-bold text-white shadow-sm">
              ₦
            </span>
            <span className="font-semibold text-slate-900">Edupay</span>
          </div>
          <p>© {new Date().getFullYear()} Edupay. All rights reserved.</p>
          <p className="mt-2 text-slate-400">
            Powered by Nomba Virtual Accounts &amp; Financial Reconciliation Infrastructure
          </p>
        </div>
      </footer>
    </div>
  );
}
