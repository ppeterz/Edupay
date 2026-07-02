'use client';

// ──────────────────────────────────────────────
// EduPay — Dashboard Layout (Sidebar + Main)
// ──────────────────────────────────────────────

import { type ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import {
  LayoutDashboard,
  Users,
  CreditCard,
  BarChart2,
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

  function isActive(href: string): boolean {
    if (href === '/dashboard') {
      return pathname === '/dashboard';
    }
    return pathname.startsWith(href);
  }

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}
      <aside className="flex w-64 flex-col border-r border-gray-200 bg-white">
        {/* Logo */}
        <div className="border-b border-gray-200 p-6">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-sm font-bold text-primary-foreground">
              ₦
            </span>
            <span className="text-xl font-bold tracking-tight text-gray-900">
              SchoolLedger
            </span>
          </div>
          {school?.name && (
            <p className="mt-2 truncate text-xs text-gray-500">
              {school.name}
            </p>
          )}
        </div>

        {/* Nav links */}
        <nav className="flex-1 space-y-1 p-4">
          {NAV_LINKS.map((link) => {
            const active = isActive(link.href);
            const Icon = link.icon;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`flex items-center gap-3 rounded-md px-3 py-2.5 text-sm transition-colors ${
                  active
                    ? 'bg-gray-100 font-medium text-gray-900'
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
        <div className="border-t border-gray-200 p-4">
          <p className="truncate text-xs text-gray-500">
            {user?.email}
          </p>
          <button
            onClick={signOut}
            className="mt-2 text-xs text-red-500 hover:text-red-700"
          >
            Sign out
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  );
}
