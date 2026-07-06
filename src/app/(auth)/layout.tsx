// ──────────────────────────────────────────────
// EduPay — Auth Layout (centered, minimal)
// ──────────────────────────────────────────────

import type { ReactNode } from 'react';

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#f0f4f8] px-4 py-12 relative overflow-hidden">
      {/* Subtle glowing elements */}
      <div className="absolute -top-40 -left-40 w-96 h-96 rounded-full bg-blue-450/10 blur-[100px] pointer-events-none" />
      <div className="absolute -bottom-40 -right-40 w-96 h-96 rounded-full bg-indigo-400/10 blur-[100px] pointer-events-none" />
      
      <div className="w-full max-w-md relative z-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
        {children}
      </div>
    </div>
  );
}
