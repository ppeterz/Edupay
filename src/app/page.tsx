'use client';

// ────────────────────────────────────────────────────────
// EduPay — Video-First Premium Landing Page
// ────────────────────────────────────────────────────────

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowRight,
  ShieldCheck,
  Zap,
  BarChart3,
  Receipt,
  Lock,
  Play,
  Pause,
  Volume2,
  VolumeX,
  ChevronRight,
  CheckCircle2,
  Users,
  CreditCard,
  FileText,
  TrendingUp,
} from 'lucide-react';

export default function Home() {
  const router = useRouter();
  const [emailInput, setEmailInput] = useState('');
  const [isMuted, setIsMuted] = useState(true);
  const [isPlaying, setIsPlaying] = useState(true);
  const videoRef = useRef<HTMLVideoElement>(null);

  const handleStartSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (emailInput.trim()) {
      router.push(`/register?email=${encodeURIComponent(emailInput.trim())}`);
    } else {
      router.push('/register');
    }
  };

  const toggleMute = () => {
    if (videoRef.current) {
      videoRef.current.muted = !videoRef.current.muted;
      setIsMuted(!isMuted);
    }
  };

  const togglePlay = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground selection:bg-primary selection:text-primary-foreground font-sans overflow-x-hidden">
      {/* ── 1. Transparent Navbar (floats over video) ── */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-gradient-to-b from-black/40 to-transparent">
        <div className="mx-auto flex max-w-7xl h-16 items-center justify-between px-6 lg:px-8">
          {/* Logo */}
          <div className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/15 backdrop-blur-md text-base font-extrabold text-white shadow-lg shadow-black/10 border border-white/20">
              ₦
            </span>
            <span className="text-lg font-bold tracking-tight text-white drop-shadow-md">
              Edupay<span className="text-[10px] align-super opacity-50">®</span>
            </span>
          </div>

          {/* Navigation Links */}
          <nav className="hidden md:flex items-center gap-7 text-[11px] font-bold text-white/70 uppercase tracking-wider">
            <Link href="#features" className="hover:text-white transition-colors">Features</Link>
            <Link href="#how-it-works" className="hover:text-white transition-colors">How it Works</Link>
            <Link href="#preview" className="hover:text-white transition-colors">Preview</Link>
          </nav>

          {/* CTAs */}
          <div className="flex items-center gap-4">
            <Link
              href="/login"
              className="text-[11px] font-bold uppercase tracking-wider text-white/70 hover:text-white transition-colors"
            >
              Sign In
            </Link>
            <Link
              href="/register"
              className="inline-flex h-9 items-center justify-center rounded-full bg-white px-5 text-[11px] font-bold uppercase tracking-wider text-slate-950 shadow-lg hover:bg-slate-100 transition-all hover:scale-[1.02] active:scale-[0.98]"
            >
              Get Started
            </Link>
          </div>
        </div>
      </header>

      {/* ── 2. Full-Bleed Video Hero ── */}
      <section className="relative h-screen min-h-[600px] max-h-[900px] flex items-center justify-center overflow-hidden">
        {/* Background Video */}
        <video
          ref={videoRef}
          autoPlay
          loop
          muted
          playsInline
          className="absolute inset-0 w-full h-full object-cover"
          poster=""
        >
          <source src="/hero_video.mp4" type="video/mp4" />
        </video>

        {/* Dark overlay gradient for text readability */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/10 via-black/5 to-black/20 z-10" />

        {/* Subtle noise texture overlay */}
        <div className="absolute inset-0 z-10 opacity-[0.03] bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIzMDAiIGhlaWdodD0iMzAwIj48ZmlsdGVyIGlkPSJhIiB4PSIwIiB5PSIwIj48ZmVUdXJidWxlbmNlIGJhc2VGcmVxdWVuY3k9Ii43NSIgc3RpdGNoVGlsZXM9InN0aXRjaCIgdHlwZT0iZnJhY3RhbE5vaXNlIi8+PGZlQ29sb3JNYXRyaXggdHlwZT0ic2F0dXJhdGUiIHZhbHVlcz0iMCIvPjwvZmlsdGVyPjxyZWN0IHdpZHRoPSIzMDAiIGhlaWdodD0iMzAwIiBmaWx0ZXI9InVybCgjYSkiIG9wYWNpdHk9IjAuMDUiLz48L3N2Zz4=')] pointer-events-none" />

        {/* Hero Content */}
        <div className="relative z-20 mx-auto max-w-7xl px-6 lg:px-8 text-center">
          <div className="max-w-3xl mx-auto space-y-8">
            {/* Pulsing Tag */}
            <span className="inline-flex items-center gap-2 rounded-full bg-white/10 backdrop-blur-md px-5 py-1.5 text-[10px] font-bold uppercase tracking-wider text-white/90 border border-white/15 shadow-lg">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Financial infrastructure for modern schools
            </span>

            {/* Giant Heading */}
            <h1 className="text-5xl font-black tracking-tight text-white sm:text-7xl lg:text-8xl leading-[0.9] drop-shadow-2xl">
              Stop Chasing<br />
              <span className="bg-gradient-to-r from-white via-white/80 to-white/50 bg-clip-text text-transparent">
                Payments.
              </span>
            </h1>

            <p className="text-sm md:text-base leading-relaxed text-white/60 max-w-lg mx-auto font-medium">
              Every student gets a dedicated virtual account. EduPay auto-reconciles payments, tracks balances, and generates receipts — all in real time.
            </p>

            {/* Start Input Pill */}
            <form
              onSubmit={handleStartSubmit}
              className="max-w-md mx-auto relative rounded-full bg-white/10 backdrop-blur-md border border-white/20 p-1.5 pl-6 flex items-center justify-between shadow-2xl shadow-black/20 hover:bg-white/15 transition-all"
            >
              <input
                type="email"
                placeholder="Enter your school email"
                value={emailInput}
                onChange={(e) => setEmailInput(e.target.value)}
                className="w-full text-xs font-semibold text-white placeholder:text-white/40 focus:outline-none bg-transparent"
              />
              <button
                type="submit"
                className="rounded-full bg-white text-slate-950 p-2.5 flex items-center justify-center hover:bg-slate-100 transition-all shadow-lg shrink-0"
                title="Start with Edupay"
              >
                <ArrowRight className="h-4 w-4" />
              </button>
            </form>

            {/* Trust badges */}
            <div className="flex items-center justify-center gap-6 pt-2">
              <span className="flex items-center gap-1.5 text-[10px] font-bold text-white/40 uppercase tracking-wider">
                <Lock className="h-3 w-3" /> Bank-grade security
              </span>
              <span className="flex items-center gap-1.5 text-[10px] font-bold text-white/40 uppercase tracking-wider">
                <Zap className="h-3 w-3" /> Instant setup
              </span>
              <span className="flex items-center gap-1.5 text-[10px] font-bold text-white/40 uppercase tracking-wider">
                <CheckCircle2 className="h-3 w-3" /> Free to start
              </span>
            </div>
          </div>
        </div>

        {/* Scroll indicator */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-20 flex flex-col items-center gap-2 animate-bounce">
          <span className="text-[9px] font-bold uppercase tracking-wider text-white/30">Scroll</span>
          <div className="w-5 h-8 rounded-full border-2 border-white/20 flex items-start justify-center p-1">
            <div className="w-1 h-2 rounded-full bg-white/40" />
          </div>
        </div>
      </section>

      {/* ── 3. Stats Ribbon ── */}
      <section className="py-8 bg-card border-y border-border relative overflow-hidden">
        <div className="mx-auto max-w-7xl px-6 lg:px-8 relative z-10">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
            {[
              { value: '500+', label: 'Schools Onboarded', icon: Users },
              { value: '₦1.2B+', label: 'Payments Processed', icon: CreditCard },
              { value: '25K+', label: 'Virtual Accounts', icon: FileText },
              { value: '99.9%', label: 'Uptime SLA', icon: TrendingUp },
            ].map((stat) => (
              <div key={stat.label} className="flex flex-col items-center gap-1.5 py-3 group">
                <stat.icon className="h-4.5 w-4.5 text-muted-foreground mb-1 group-hover:text-primary transition-colors duration-300" />
                <span className="text-2xl font-black text-foreground font-mono tracking-tight">{stat.value}</span>
                <span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground group-hover:text-foreground transition-colors duration-300">{stat.label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── 4. Features Grid ── */}
      <section id="features" className="py-28 bg-[url('/wireframe_grid.png')] bg-cover bg-center relative overflow-hidden border-y border-border">
        <div className="mx-auto max-w-7xl px-6 lg:px-8 relative z-10">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              Core Capabilities
            </span>
            <h2 className="text-2xl md:text-3xl font-extrabold text-foreground tracking-tight mt-2">
              Everything schools need for modern payments
            </h2>
            <p className="text-xs text-muted-foreground font-semibold max-w-lg mx-auto leading-relaxed mt-3">
              From provisioning virtual bank accounts to generating PDF receipts, Edupay automates the entire school payment lifecycle.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {[
              {
                icon: Zap,
                iconBg: 'bg-blue-50/80 border-blue-100/60',
                iconColor: 'text-blue-500',
                title: 'Instant Virtual Accounts',
                desc: 'Provision dedicated account numbers dynamically for every student to facilitate direct bank transfers.',
              },
              {
                icon: ShieldCheck,
                iconBg: 'bg-emerald-50/80 border-emerald-100/60',
                iconColor: 'text-emerald-500',
                title: 'Automated Reconciliation',
                desc: 'Process matching payments automatically with chronological fee breakdowns via advanced pipeline logic.',
              },
              {
                icon: BarChart3,
                iconBg: 'bg-indigo-50/80 border-indigo-100/60',
                iconColor: 'text-indigo-500',
                title: 'Interactive Analytics',
                desc: 'Track deficits and school-wide collection rates with granular control and instant report downloads.',
              },
              {
                icon: Receipt,
                iconBg: 'bg-amber-50/80 border-amber-100/60',
                iconColor: 'text-amber-500',
                title: 'Instant PDF Receipts',
                desc: 'Create and store branded payment receipt documents automatically when transfers are processed.',
              },
            ].map((feature) => (
              <div
                key={feature.title}
                className="group relative rounded-[28px] border border-white/80 bg-white/60 p-7 shadow-lg backdrop-blur-md hover:shadow-xl hover:-translate-y-1 transition-all duration-300"
              >
                <div className={`flex h-10 w-10 items-center justify-center rounded-full ${feature.iconBg} border shadow-sm mb-5 group-hover:scale-110 transition-transform duration-300`}>
                  <feature.icon className={`h-4.5 w-4.5 ${feature.iconColor}`} />
                </div>
                <h3 className="text-xs font-bold text-slate-900 mb-2 group-hover:text-slate-850 transition-colors">{feature.title}</h3>
                <p className="text-xs text-slate-500 font-medium leading-relaxed">{feature.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── 5. How It Works ── */}
      <section id="how-it-works" className="py-28 bg-card border-y border-border relative overflow-hidden">
        <div className="mx-auto max-w-7xl px-6 lg:px-8 relative z-10">
          <div className="text-center max-w-2xl mx-auto space-y-3 mb-20">
            <span className="inline-flex items-center gap-2 rounded-full bg-secondary px-4 py-1 text-[10px] font-bold uppercase tracking-wider text-primary shadow-sm border border-border">
              How It Works
            </span>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-foreground tracking-tight">
              Three steps to financial clarity
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-12 max-w-5xl mx-auto">
            {[
              {
                step: '01',
                title: 'Register your school',
                desc: 'Create an account and set up your school profile with class structures and fee categories in minutes.',
                gradient: 'from-blue-50 to-indigo-100/50 border-blue-100 text-blue-600',
              },
              {
                step: '02',
                title: 'Enroll students',
                desc: 'Add students individually or in bulk. Each student automatically receives a unique virtual bank account number.',
                gradient: 'from-emerald-50 to-teal-100/50 border-emerald-100 text-emerald-600',
              },
              {
                step: '03',
                title: 'Collect automatically',
                desc: 'Parents pay into virtual accounts. Edupay reconciles, updates balances, and generates receipts instantly.',
                gradient: 'from-amber-50 to-orange-100/50 border-amber-100 text-amber-600',
              },
            ].map((item) => (
              <div key={item.step} className="text-center space-y-5 group">
                <div className={`inline-flex h-16 w-16 items-center justify-center rounded-3xl bg-card border border-border ${item.gradient} font-black text-lg shadow-sm group-hover:scale-105 transition-transform duration-300`}>
                  {item.step}
                </div>
                <h3 className="text-base font-bold text-foreground">{item.title}</h3>
                <p className="text-xs text-muted-foreground font-medium leading-relaxed max-w-xs mx-auto">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── 6. Dashboard Mockup Preview ── */}
      <section id="preview" className="py-28 bg-background relative overflow-hidden">
        <div className="mx-auto max-w-7xl px-6 lg:px-8 relative z-10">
          <div className="text-center max-w-2xl mx-auto space-y-3 mb-16">
            <span className="inline-flex items-center gap-2 rounded-full bg-secondary px-4 py-1 text-[10px] font-bold uppercase tracking-wider text-primary shadow-sm border border-border">
              Live Preview
            </span>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-foreground tracking-tight">
              See your dashboard in action
            </h2>
          </div>

          <div className="rounded-[32px] border border-border bg-card p-6 md:p-8 shadow-xl max-w-5xl mx-auto overflow-hidden">
            {/* Window header */}
            <div className="flex items-center justify-between border-b border-border pb-5 mb-8">
              <div className="flex items-center gap-2">
                <span className="h-3 w-3 rounded-full bg-red-400" />
                <span className="h-3 w-3 rounded-full bg-amber-400" />
                <span className="h-3 w-3 rounded-full bg-emerald-400" />
                <span className="text-xs font-bold text-muted-foreground ml-3 font-mono">
                  dashboard.edupay.ng
                </span>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-2 w-12 rounded-full bg-secondary" />
                <div className="h-2 w-8 rounded-full bg-secondary" />
              </div>
            </div>

            {/* Layout simulation */}
            <div className="grid gap-6 md:grid-cols-3">
              {/* Left pane stats */}
              <div className="md:col-span-2 space-y-6">
                <div className="grid gap-4 grid-cols-2">
                  <div className="rounded-[20px] border border-border bg-secondary/50 p-5">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Total Revenue</p>
                    <p className="text-2xl md:text-3xl font-extrabold mt-2 text-foreground font-mono tracking-tight">
                      ₦8,450,000
                    </p>
                    <span className="inline-flex items-center gap-1 mt-2 text-[9px] font-bold text-emerald-600">
                      <TrendingUp className="h-3 w-3" /> +12.4% this term
                    </span>
                  </div>
                  <div className="rounded-[20px] border border-border bg-secondary/50 p-5">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Collection Rate</p>
                    <p className="text-2xl md:text-3xl font-extrabold mt-2 text-emerald-600 font-mono tracking-tight font-black">
                      94.2%
                    </p>
                    <span className="inline-flex items-center gap-1 mt-2 text-[9px] font-bold text-muted-foreground">
                      Target: 95%
                    </span>
                  </div>
                </div>

                {/* Simulated Ledger list */}
                <div className="rounded-[20px] border border-border p-5 bg-card space-y-4 shadow-sm">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-foreground font-bold">
                    Recent Activity
                  </p>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between border-b border-border pb-3 text-sm">
                      <div className="flex items-center gap-3">
                        <div className="h-9 w-9 rounded-full bg-blue-50 text-blue-600 font-bold flex items-center justify-center text-xs">
                          TB
                        </div>
                        <div>
                          <p className="font-semibold text-foreground text-xs">Tola Babs</p>
                          <p className="text-[10px] text-muted-foreground font-medium">JSS 2 • ADM-001</p>
                        </div>
                      </div>
                      <span className="inline-flex items-center rounded-full bg-emerald-50 px-2.5 py-0.5 text-[10px] font-bold text-emerald-700">
                        Paid
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-3">
                        <div className="h-9 w-9 rounded-full bg-indigo-50 text-indigo-600 font-bold flex items-center justify-center text-xs">
                          PP
                        </div>
                        <div>
                          <p className="font-semibold text-foreground text-xs">Pelumi Peterz</p>
                          <p className="text-[10px] text-muted-foreground font-medium">Primary 1 • ADM-002</p>
                        </div>
                      </div>
                      <span className="inline-flex items-center rounded-full bg-amber-50 px-2.5 py-0.5 text-[10px] font-bold text-amber-700">
                        Partial
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Developer Logs Feed */}
              <div className="rounded-[20px] border border-slate-950 bg-slate-950 p-5 text-white flex flex-col justify-between shadow-lg">
                <div>
                  <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                      Payment Pipeline
                    </p>
                    <span className="relative flex h-2 w-2">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
                      <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500"></span>
                    </span>
                  </div>
                  <div className="space-y-3 font-mono text-[10px] text-slate-550 leading-relaxed">
                    <div>
                      <p className="text-emerald-400 font-bold">[13:42:01] Transfer detected</p>
                      <p className="text-slate-350 pl-3">₦30,000 from Tola Babs</p>
                    </div>
                    <div>
                      <p className="text-emerald-400 font-bold">[13:42:02] Student matched</p>
                      <p className="text-slate-350 pl-3">STD-1023</p>
                    </div>
                    <div>
                      <p className="text-emerald-400 font-bold">[13:42:03] Reconciled</p>
                      <p className="text-slate-350 pl-3">Term 2 Tuition applied</p>
                    </div>
                    <div>
                      <p className="text-emerald-400 font-bold">[13:42:04] Receipt sent</p>
                      <p className="text-slate-500 pl-3">RCP-8E7B24A9.pdf</p>
                    </div>
                  </div>
                </div>
                <div className="pt-3 border-t border-slate-800 flex items-center justify-between text-[9px] text-slate-600">
                  <span className="font-bold uppercase tracking-wider">SSL Secure</span>
                  <Lock className="h-3 w-3" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── 7. CTA Section ── */}
      <section className="py-28 bg-card text-foreground relative overflow-hidden border-t border-border">
        {/* Glow backdrop blobs that align with the soft warm theme */}
        <div className="absolute top-0 left-1/4 w-[600px] h-[600px] rounded-full bg-pink-100/20 blur-[150px] pointer-events-none" />
        <div className="absolute bottom-0 right-1/4 w-[500px] h-[400px] rounded-full bg-orange-100/20 blur-[130px] pointer-events-none" />

        <div className="mx-auto max-w-7xl px-6 lg:px-8 text-center relative z-10 space-y-8">
          <h2 className="text-3xl sm:text-5xl font-extrabold tracking-tight leading-tight text-foreground">
            Ready to modernize<br />your school&apos;s payments?
          </h2>
          <p className="mx-auto max-w-lg text-sm text-muted-foreground leading-relaxed font-medium">
            Join hundreds of schools already using Edupay to automate tuition collection, track payments, and eliminate manual reconciliation.
          </p>
          <div className="flex flex-wrap justify-center gap-4 pt-2">
            <Link
              href="/register"
              className="group inline-flex h-13 items-center justify-center gap-2 rounded-full bg-primary px-8 font-bold text-sm text-primary-foreground shadow-xl hover:opacity-90 transition-all hover:scale-[1.02] active:scale-[0.98]"
            >
              Get Started for Free
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </Link>
            <Link
              href="/login"
              className="inline-flex h-13 items-center justify-center rounded-full border border-border bg-card px-8 font-bold text-sm text-foreground hover:bg-secondary transition-all hover:scale-[1.02] active:scale-[0.98]"
            >
              School Sign In
            </Link>
          </div>
        </div>
      </section>

      {/* ── 8. Footer ── */}
      <footer className="border-t border-border bg-background py-16 text-muted-foreground">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="flex flex-col md:flex-row items-center md:items-start justify-between gap-8">
            {/* Logo & info */}
            <div className="text-center md:text-left space-y-3">
              <div className="flex items-center gap-2 justify-center md:justify-start">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary text-xs font-bold text-primary-foreground shadow-md">
                  ₦
                </span>
                <span className="font-bold text-foreground text-sm">Edupay</span>
              </div>
              <p className="text-[10px] text-muted-foreground font-medium max-w-xs">
                Financial infrastructure for modern schools. Powered by Nomba Virtual Accounts.
              </p>
            </div>

            {/* Links */}
            <div className="flex gap-12 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              <div className="space-y-3">
                <p className="text-foreground">Product</p>
                <Link href="/dashboard" className="block hover:text-foreground transition-colors">Dashboard</Link>
                <Link href="/dashboard/students" className="block hover:text-foreground transition-colors">Students</Link>
                <Link href="/dashboard/invoices" className="block hover:text-foreground transition-colors">Invoices</Link>
              </div>
              <div className="space-y-3">
                <p className="text-foreground">Resources</p>
                <Link href="/dashboard/reports" className="block hover:text-foreground transition-colors">Reports</Link>
                <Link href="/dashboard/payments" className="block hover:text-foreground transition-colors">Payments</Link>
                <Link href="/login" className="block hover:text-foreground transition-colors">Sign In</Link>
              </div>
            </div>
          </div>

          <div className="mt-12 pt-8 border-t border-border text-center text-[10px] text-muted-foreground font-medium">
            © {new Date().getFullYear()} Edupay. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
}
