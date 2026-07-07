// ──────────────────────────────────────────────
// EduPay — RecentWebhookLog Component (Stage 7)
// ──────────────────────────────────────────────
// Renders a compact live panel showing incoming raw Nomba webhook transactions
// from Firestore. Displays a pulsing indicator dot signifying active streaming.
// Used primarily for live hackathon developer/judge demos.

'use client';

import { useEffect, useState } from 'react';
import { collection, query, where, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { getFirebaseDb } from '@/lib/firebase';
import { kobotoNaira } from '@/lib/constants';
import type { WebhookLog } from '@/types';
import { useAuth } from '@/contexts/AuthContext';

function formatRelativeTime(dateStr: string): string {
  try {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    
    // Fallback if local machine time is skewed
    if (diffMs < 0) return 'Just now';

    const diffSecs = Math.floor(diffMs / 1000);
    const diffMins = Math.floor(diffSecs / 60);
    const diffHours = Math.floor(diffMins / 60);

    if (diffSecs < 10) return 'Just now';
    if (diffSecs < 60) return `${diffSecs}s ago`;
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    
    return date.toLocaleDateString('en-NG', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return 'Pending';
  }
}

export function RecentWebhookLog() {
  const { user } = useAuth();
  const [logs, setLogs] = useState<WebhookLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const db = getFirebaseDb();
    
    const q = query(
      collection(db, 'webhook_log'),
      where('schoolId', '==', user.uid),
      limit(20)
    );

    const unsub = onSnapshot(
      q,
      (snap) => {
        const list = snap.docs.map((d) => d.data() as WebhookLog);
        list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        setLogs(list);
        setLoading(false);
      },
      (err) => {
        console.error('[RecentWebhookLog] Listener error:', err);
        setLoading(false);
      }
    );

    return () => unsub();
  }, [user]);

  return (
    <div className="flex flex-col rounded-[28px] border border-slate-900 bg-slate-950 text-slate-400 shadow-xl overflow-hidden h-full">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-850 px-5 py-4 bg-slate-950 select-none">
        <div>
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">Payment Processing</h3>
          <p className="text-[10px] text-slate-450 mt-0.5">Live payment feed</p>
        </div>
        <div className="flex items-center gap-1.5 rounded-full bg-emerald-950/50 border border-emerald-900 px-2 py-0.5 text-[9px] font-bold text-emerald-400">
          <span className="relative flex h-1.5 w-1.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500"></span>
          </span>
          <span>Live</span>
        </div>
      </div>

      {/* List Feed */}
      <div className="flex-1 overflow-y-auto max-h-[350px] p-5 font-mono text-[11px] leading-relaxed">
        {loading ? (
          <div className="space-y-4">
            {Array.from({ length: 4 }).map((_, idx) => (
              <div key={idx} className="flex flex-col gap-1.5 border-b border-slate-900 pb-3 last:border-0 last:pb-0">
                <div className="h-3 w-1/2 rounded bg-slate-900 animate-pulse" />
                <div className="h-2 w-1/3 rounded bg-slate-900 animate-pulse" />
              </div>
            ))}
          </div>
        ) : logs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-14 text-center">
            <p className="text-[10px] text-slate-500 font-semibold">No payments received yet</p>
          </div>
        ) : (
          <div className="space-y-4.5" aria-live="polite">
            {logs.map((log) => {
              // Status color mapping
              let statusStyle = 'bg-slate-900 text-slate-400 border-slate-800';
              if (log.status === 'processed') statusStyle = 'bg-emerald-950/40 text-emerald-400 border-emerald-900/60 border';
              if (log.status === 'received') statusStyle = 'bg-blue-950/40 text-blue-400 border-blue-900/60 border';
              if (log.status === 'duplicate') statusStyle = 'bg-slate-900/80 text-slate-500 border-slate-850';
              if (log.status === 'error') statusStyle = 'bg-red-950/40 text-red-400 border-red-900/60 border';

              return (
                <div
                  key={log.id}
                  className="flex items-start justify-between border-b border-slate-900 pb-3 last:border-0 last:pb-0"
                >
                  <div className="space-y-1">
                    <p className="font-mono text-xs font-bold text-slate-200">
                      {log.transactionId ? log.transactionId.slice(0, 12) : 'Unknown ID'}...
                    </p>
                    <div className="flex items-center gap-1.5 text-[10px] text-slate-500">
                      <span>Acct:</span>
                      <span className="font-mono text-slate-350">
                        {log.aliasAccountReference ? log.aliasAccountReference.slice(0, 10) : 'N/A'}...
                      </span>
                    </div>
                  </div>

                  <div className="text-right space-y-1">
                    <p className="font-mono text-xs font-bold tabular-nums text-white">
                      {kobotoNaira(log.amount)}
                    </p>
                    <div className="flex items-center justify-end gap-1.5">
                      <span className="text-[9px] text-slate-500">
                        {formatRelativeTime(log.createdAt)}
                      </span>
                      <span className={`inline-flex items-center rounded px-1.5 py-0.2 text-[9px] font-bold capitalize ${statusStyle}`}>
                        {log.status}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
