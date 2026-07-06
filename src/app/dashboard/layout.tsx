'use client';

// ──────────────────────────────────────────────
// EduPay — Redesigned Premium Dashboard Layout
// ──────────────────────────────────────────────

import { type ReactNode, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import {
  LayoutDashboard,
  Users,
  FileText,
  CreditCard,
  BarChart2,
  Menu,
  X,
  Bell,
  Calendar,
  LogOut,
  ChevronDown,
  ArrowRightLeft,
} from 'lucide-react';

const NAV_LINKS = [
  {
    href: '/dashboard',
    label: 'Dashboard',
    icon: LayoutDashboard,
  },
  {
    href: '/dashboard/students',
    label: 'Students',
    icon: Users,
  },
  {
    href: '/dashboard/invoices',
    label: 'Invoicing',
    icon: FileText,
  },
  {
    href: '/dashboard/payments',
    label: 'Payments',
    icon: CreditCard,
  },
  {
    href: '/dashboard/reports',
    label: 'Reports',
    icon: BarChart2,
  },
  {
    href: '/dashboard/withdrawals',
    label: 'Withdrawals',
    icon: ArrowRightLeft,
  },
];

export default function DashboardLayout({
  children,
}: {
  children: ReactNode;
}) {
  const pathname = usePathname();
  const { user, school, signOut } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);

  function isActive(href: string): boolean {
    if (href === '/dashboard') {
      return pathname === '/dashboard';
    }
    return pathname.startsWith(href);
  }

  // Get human greeting based on time
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  };

  const navContent = (
    <div className="flex h-full flex-col bg-slate-950 text-slate-400 select-none">
      {/* Brand logo section */}
      <div className="p-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white text-slate-950 font-bold text-lg shadow-sm">
            ₦
          </span>
          <span className="text-xl font-bold tracking-tight text-white">
            Edupay
          </span>
        </div>
        {/* Mobile menu close */}
        <button
          className="md:hidden p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-900 focus:outline-none"
          onClick={() => setMobileOpen(false)}
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* School identifier capsule */}
      {school?.name && (
        <div className="px-6 pb-2">
          <div className="px-4 py-2.5 rounded-2xl bg-slate-900 border border-slate-850 flex items-center justify-between">
            <div className="min-w-0 flex-1">
              <p className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Active School</p>
              <p className="truncate text-xs font-semibold text-slate-200 mt-0.5">
                {school.name}
              </p>
            </div>
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
          </div>
        </div>
      )}

      {/* Navigation items */}
      <nav className="flex-1 space-y-1.5 p-4 mt-4">
        {NAV_LINKS.map((link) => {
          const active = isActive(link.href);
          const Icon = link.icon;
          return (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setMobileOpen(false)}
              className={`group flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-semibold transition-all relative ${
                active
                  ? 'bg-white/10 text-white shadow-sm shadow-black/10'
                  : 'text-slate-450 hover:bg-white/5 hover:text-white'
              }`}
            >
              {/* Left active line indicator */}
              {active && (
                <span className="absolute left-0 top-3 bottom-3 w-1.5 rounded-r bg-white" />
              )}
              <Icon className={`h-4.5 w-4.5 transition-transform group-hover:scale-105 ${active ? 'text-white' : 'text-slate-450'}`} />
              {link.label}
            </Link>
          );
        })}
      </nav>

      {/* Bottom user logout */}
      <div className="border-t border-slate-900 p-4 bg-slate-950">
        <div className="flex items-center gap-3 px-2 py-1">
          <div className="h-8 w-8 rounded-full bg-slate-900 flex items-center justify-center text-xs font-bold text-white uppercase border border-slate-850">
            {user?.email?.slice(0, 2) ?? 'AD'}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-semibold text-slate-200">
              {user?.email}
            </p>
            <p className="text-[10px] text-slate-500 font-medium">Administrator</p>
          </div>
        </div>
        <button
          onClick={() => {
            setMobileOpen(false);
            signOut();
          }}
          className="mt-3 flex w-full items-center gap-2 rounded-xl border border-slate-900 px-3 py-2 text-xs font-semibold text-red-400 hover:bg-red-500/10 hover:text-red-300 hover:border-red-500/20 transition-all justify-center"
        >
          <LogOut className="h-3.5 w-3.5" />
          Sign out
        </button>
      </div>
    </div>
  );

  return (
    <div className="flex h-screen w-screen bg-[#f0f4f8] overflow-hidden p-0 md:p-4">
      {/* ── 1. Mobile Drawer Navigation ── */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          {/* Backdrop blur */}
          <div
            className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm transition-opacity duration-300"
            onClick={() => setMobileOpen(false)}
          />
          {/* Menu Drawer */}
          <aside className="fixed bottom-0 left-0 top-0 w-72 max-w-[80vw] z-50 shadow-2xl transition-transform duration-350 ease-out">
            {navContent}
          </aside>
        </div>
      )}

      {/* ── 2. Desktop floating dark sidebar ── */}
      <aside className="hidden md:flex w-64 flex-col rounded-3xl bg-slate-950 text-white overflow-hidden shadow-2xl mr-4 border border-slate-900">
        {navContent}
      </aside>

      {/* ── 3. Main content viewport wrapper ── */}
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
        {/* Top Header Row */}
        <header className="flex h-16 items-center justify-between bg-transparent px-4 md:px-6 z-30 shrink-0 select-none">
          <div className="flex items-center gap-3">
            {/* Mobile Sidebar Trigger */}
            <button
              className="md:hidden p-2 rounded-xl text-slate-700 bg-white border border-slate-200/50 hover:bg-slate-50 focus:outline-none"
              onClick={() => setMobileOpen(true)}
              aria-label="Open menu"
            >
              <Menu className="h-5 w-5" />
            </button>
            <div>
              <h2 className="text-xl font-extrabold text-slate-950 tracking-tight">
                {getGreeting()}, {school?.name ? school.name.split(' ')[0] : 'Admin'}!
              </h2>
            </div>
          </div>

          {/* Right Header items */}
          <div className="flex items-center gap-3">
            {/* Calendar Widget */}
            <div className="hidden sm:flex items-center gap-2 rounded-xl border border-slate-200/50 bg-white px-3 py-1.5 text-xs font-semibold text-slate-650 shadow-sm">
              <Calendar className="h-4 w-4 text-slate-450" />
              <span>
                {new Date().toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                })}
              </span>
            </div>

            {/* Notification Bell */}
            <button className="p-2 rounded-xl border border-slate-200/50 bg-white text-slate-600 hover:text-slate-900 shadow-sm hover:scale-[1.02] active:scale-[0.98] transition-all relative">
              <Bell className="h-4.5 w-4.5" />
              <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-blue-600 ring-2 ring-white" />
            </button>

            {/* User Profile Avatar with drop action */}
            <div className="relative">
              <button
                onClick={() => setProfileDropdownOpen(!profileDropdownOpen)}
                className="flex items-center gap-2 rounded-xl border border-slate-200/50 bg-white p-1.5 pr-2.5 shadow-sm hover:scale-[1.01] transition-all"
              >
                <div className="h-7 w-7 rounded-lg bg-slate-950 text-xs font-bold text-white flex items-center justify-center uppercase">
                  {user?.email?.slice(0, 2) ?? 'AD'}
                </div>
                <ChevronDown className="h-3.5 w-3.5 text-slate-455" />
              </button>

              {profileDropdownOpen && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setProfileDropdownOpen(false)}
                  />
                  <div className="absolute right-0 mt-2 w-52 rounded-2xl border border-slate-200/80 bg-white p-2.5 shadow-xl z-50 animate-in fade-in slide-in-from-top-2 duration-150">
                    <div className="px-2 py-1.5 border-b border-slate-100 mb-1">
                      <p className="text-[10px] uppercase font-bold text-slate-400">Signed In As</p>
                      <p className="truncate text-xs font-bold text-slate-800 mt-0.5">{user?.email}</p>
                    </div>
                    <button
                      onClick={() => {
                        setProfileDropdownOpen(false);
                        signOut();
                      }}
                      className="flex w-full items-center gap-2 rounded-xl px-2.5 py-2 text-xs font-semibold text-red-650 hover:bg-red-50 transition-colors"
                    >
                      <LogOut className="h-3.5 w-3.5" />
                      Sign out session
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </header>

        {/* ── 4. Main children container ── */}
        <main className="flex-1 overflow-y-auto px-4 md:px-6 pb-6 focus:outline-none min-w-0">
          <div className="rounded-3xl border border-slate-200/50 bg-white shadow-xl shadow-slate-900/5 p-6 lg:p-8 min-h-full">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
