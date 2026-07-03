'use client';

// ──────────────────────────────────────────────
// EduPay — Dashboard Layout (Sidebar + Main)
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
} from 'lucide-react';

// ── Nav link config ──────────────────────────

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
];

// ── Component ────────────────────────────────

export default function DashboardLayout({
  children,
}: {
  children: ReactNode;
}) {
  const pathname = usePathname();
  const { user, school, signOut } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);

  function isActive(href: string): boolean {
    if (href === '/dashboard') {
      return pathname === '/dashboard';
    }
    return pathname.startsWith(href);
  }

  const navContent = (
    <div className="flex h-full flex-col bg-white">
      {/* Logo Section */}
      <div className="border-b border-gray-200 p-6 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-900 text-sm font-bold text-white">
            ₦
          </span>
          <span className="text-xl font-bold tracking-tight text-gray-900">
            Edupay
          </span>
        </div>
        {/* Mobile close button */}
        <button
          className="md:hidden p-1 rounded-md text-gray-400 hover:text-gray-900 hover:bg-gray-100"
          onClick={() => setMobileOpen(false)}
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {school?.name && (
        <div className="px-6 py-2 border-b border-gray-100 bg-gray-50/50">
          <p className="truncate text-xs font-semibold text-gray-600">
            {school.name}
          </p>
        </div>
      )}

      {/* Nav links */}
      <nav className="flex-1 space-y-1 p-4">
        {NAV_LINKS.map((link) => {
          const active = isActive(link.href);
          const Icon = link.icon;
          return (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setMobileOpen(false)}
              className={`flex items-center gap-3 rounded-md px-3 py-2.5 text-sm transition-colors ${
                active
                  ? 'bg-slate-900 font-semibold text-white'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
              }`}
            >
              <Icon className="h-4 w-4" />
              {link.label}
            </Link>
          );
        })}
      </nav>

      {/* Bottom: user info + sign out */}
      <div className="border-t border-gray-200 p-4 bg-gray-50/20">
        <p className="truncate text-xs font-semibold text-gray-700">
          {user?.email}
        </p>
        <button
          onClick={() => {
            setMobileOpen(false);
            signOut();
          }}
          className="mt-2 text-xs font-medium text-red-600 hover:text-red-800 transition-colors"
        >
          Sign out
        </button>
      </div>
    </div>
  );

  return (
    <div className="flex h-screen flex-col md:flex-row bg-gray-50 overflow-hidden">
      {/* ── 1. Mobile Header (Visible under 768px) ── */}
      <header className="flex h-16 items-center justify-between border-b border-gray-200 bg-white px-4 md:hidden z-30 w-full shrink-0">
        <button
          className="p-1.5 rounded-md text-gray-600 hover:text-gray-900 hover:bg-gray-100 focus:outline-none"
          onClick={() => setMobileOpen(true)}
          aria-label="Open menu"
        >
          <Menu className="h-6 w-6" />
        </button>
        
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-900 text-xs font-bold text-white">
            ₦
          </span>
          <span className="text-lg font-bold tracking-tight text-gray-900">
            Edupay
          </span>
        </div>
        <div className="w-9" /> {/* Visual spacing balancer */}
      </header>

      {/* ── 2. Mobile Drawer Overlay Panel ── */}
      {mobileOpen && (
        <div className="fixed inset-0 z-45 md:hidden">
          {/* Dark Backdrop */}
          <div
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity duration-300"
            onClick={() => setMobileOpen(false)}
          />
          {/* Sliding Navigation Panel */}
          <aside className="fixed bottom-0 left-0 top-0 w-72 max-w-[80vw] z-50 shadow-2xl transition-transform duration-300 ease-in-out">
            {navContent}
          </aside>
        </div>
      )}

      {/* ── 3. Desktop Sidebar ── */}
      <aside className="hidden md:flex w-64 flex-col border-r border-gray-200 bg-white shrink-0 h-full">
        {navContent}
      </aside>

      {/* ── 4. Main content viewport area ── */}
      <main className="flex-1 overflow-y-auto focus:outline-none h-full min-w-0">
        {children}
      </main>
    </div>
  );
}

