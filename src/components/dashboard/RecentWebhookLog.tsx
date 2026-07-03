// ──────────────────────────────────────────────
// EduPay — RecentWebhookLog Component (Stage 7)
// ──────────────────────────────────────────────
// Renders a compact live panel showing incoming raw Nomba webhook transactions
// from Firestore. Displays a pulsing indicator dot signifying active streaming.
// Used primarily for live hackathon developer/judge demos.

'use client';

import { useEffect, useState } from 'react';
import { collection, query, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { getFirebaseDb } from '@/lib/firebase';
import { kobotoNaira } from '@/lib/constants';
import type { WebhookLog } from '@/types';

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
  const [logs, setLogs] = useState<WebhookLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const db = getFirebaseDb();
    
    // NOTE ON SCOPE LIMITATION:
    // Webhook logs are tracked globally at the edge collection before school ID 
    // mapping occurs. This allows live feed aggregation of incoming Nomba triggers 
    // for hackathon demonstration.
    const q = query(
      collection(db, 'webhook_log'),
      orderBy('createdAt', 'desc'),
      limit(20)
    );

    const unsub = onSnapshot(
      q,
      (snap) => {
        setLogs(snap.docs.map((d) => d.data() as WebhookLog));
        setLoading(false);
      },
      (err) => {
        console.error('[RecentWebhookLog] Listener error:', err);
        setLoading(false);
      }
    );

    return () => unsub();
  }, []);

  return (
    <div className="flex flex-col rounded-lg border border-slate-200 bg-white shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
        <h3 className="text-sm font-semibold text-slate-900">Payment Processing Activity</h3>
        <div className="flex items-center gap-2">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500"></span>
          </span>
          <span className="text-xs font-medium text-slate-500">Streaming live</span>
        </div>
      </div>

      {/* List Feed */}
      <div className="flex-1 overflow-y-auto max-h-[460px] p-5">
        {loading ? (
          <div className="space-y-4">
            {Array.from({ length: 4 }).map((_, idx) => (
              <div key={idx} className="flex flex-col gap-1 border-b border-slate-100 pb-3 last:border-0 last:pb-0">
                <div className="h-4 w-1/2 rounded bg-slate-100 animate-pulse" />
                <div className="h-3 w-1/3 rounded bg-slate-50 animate-pulse" />
              </div>
            ))}
          </div>
        ) : logs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <p className="text-sm text-slate-400">Waiting for webhook activity...</p>
          </div>
        ) : (
          <div className="space-y-4" aria-live="polite">
            {logs.map((log) => {
              // Status color mapping
              let statusStyle = 'bg-slate-50 text-slate-600 border-slate-200';
              if (log.status === 'processed') statusStyle = 'bg-green-50 text-green-700 border-green-200';
              if (log.status === 'received') statusStyle = 'bg-blue-50 text-blue-700 border-blue-200 border';
              if (log.status === 'duplicate') statusStyle = 'bg-slate-100 text-slate-500 border-slate-200';
              if (log.status === 'error') statusStyle = 'bg-red-50 text-red-700 border-red-200';

              return (
                <div
                  key={log.id}
                  className="flex items-start justify-between border-b border-slate-50 pb-3 last:border-0 last:pb-0"
                >
                  <div className="space-y-1">
                    <p className="font-mono text-xs font-medium text-slate-800">
                      {log.transactionId ? log.transactionId.slice(0, 14) : 'Unknown ID'}...
                    </p>
                    <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
                      <span>Ref:</span>
                      <span className="font-mono text-slate-700">
                        {log.aliasAccountReference ? log.aliasAccountReference.slice(0, 12) : 'N/A'}...
                      </span>
                    </div>
                  </div>

                  <div className="text-right space-y-1">
                    <p className="font-mono text-xs font-semibold tabular-nums text-slate-900">
                      {kobotoNaira(log.amount)}
                    </p>
                    <div className="flex items-center justify-end gap-2">
                      <span className="text-[10px] text-slate-400">
                        {formatRelativeTime(log.createdAt)}
                      </span>
                      <span className={`inline-flex items-center rounded border px-1.5 py-0.5 text-[10px] font-medium capitalize ${statusStyle}`}>
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
