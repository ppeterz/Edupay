'use client';

// ──────────────────────────────────────────────
// EduPay — Student Invoice Table
// ──────────────────────────────────────────────
// Shared table shell used by:
//   - /dashboard/invoices/review-skipped/[runId]  (groupingKey="skipReason")
//   - /dashboard/invoices/review                  (groupingKey="paymentStatus")
//
// This component owns: grouping, search/filter, expand/collapse.
// Action rendering is fully injected via actionsComponent / groupActionsComponent props.
// No internal branching on groupingKey for rendering.

import { useState, useMemo } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ChevronDown, ChevronRight, Search } from 'lucide-react';
import { diffLineItems } from '@/lib/invoice-helpers';
import type { TemplateLineItem } from '@/lib/invoice-helpers';
import type { Invoice } from '@/types';

// ── Exported types ───────────────────────────

export interface TrimmedInvoice {
  id: string;
  lineItems: {
    id: string;
    description: string;
    amountDue: number;
    amountPaid: number;
    priority: number;
    status: 'unpaid' | 'partial' | 'paid';
  }[];
}

export interface StudentWithInvoice {
  studentId: string;
  studentName: string;
  class: string;
  existingInvoice: TrimmedInvoice | Invoice; // accepts both trimmed and full shapes
}

export interface BulkTemplate {
  term: string;
  session: string;
  lineItems: TemplateLineItem[];
}

// Signature used for grouping in skipReason mode
export interface DiffSignature {
  missing: string[];     // template descriptions absent from existing invoice
  mismatched: string[];  // descriptions present but with different amountDue
}

export function computeDiffSignature(
  existingLineItems: TrimmedInvoice['lineItems'],
  templateLineItems: TemplateLineItem[]
): DiffSignature {
  const existingByDesc = new Map(
    existingLineItems.map((li) => [li.description.toLowerCase().trim(), li])
  );

  const missing = templateLineItems
    .filter((t) => !existingByDesc.has(t.description.toLowerCase().trim()))
    .map((t) => t.description);

  const mismatched = templateLineItems
    .filter((t) => {
      const ex = existingByDesc.get(t.description.toLowerCase().trim());
      return ex !== undefined && ex.amountDue !== t.amountDue;
    })
    .map((t) => t.description);

  return {
    missing: [...missing].sort(),
    mismatched: [...mismatched].sort(),
  };
}

function signatureKey(sig: DiffSignature): string {
  return JSON.stringify({ missing: sig.missing, mismatched: sig.mismatched });
}

function signatureLabel(sig: DiffSignature): string {
  const parts: string[] = [];
  if (sig.missing.length > 0) parts.push(`missing: ${sig.missing.join(', ')}`);
  if (sig.mismatched.length > 0) parts.push(`amount differs: ${sig.mismatched.join(', ')}`);
  return parts.length > 0 ? parts.join(' · ') : 'No differences';
}

// ── Props ────────────────────────────────────

interface StudentInvoiceTableProps {
  students: StudentWithInvoice[];
  groupingKey: 'skipReason' | 'paymentStatus';
  bulkTemplate?: BulkTemplate;
  /** Per-student action bar — rendered below each expanded student row */
  actionsComponent: (student: StudentWithInvoice) => React.ReactNode;
  /** Optional group-level action bar (used in skipReason mode for bulk apply) */
  groupActionsComponent?: (students: StudentWithInvoice[], groupId: string) => React.ReactNode;
}

// ── Internal group structure ──────────────────

interface StudentGroup {
  id: string;       // unique key for this group
  label: string;    // human-readable group header
  students: StudentWithInvoice[];
  isSingleton: boolean;
}

function buildGroups(
  students: StudentWithInvoice[],
  groupingKey: 'skipReason' | 'paymentStatus',
  bulkTemplate?: BulkTemplate
): StudentGroup[] {
  if (groupingKey === 'paymentStatus') {
    const order = ['unpaid', 'partial', 'paid', 'overpaid'];
    const labels: Record<string, string> = {
      unpaid: 'Unpaid',
      partial: 'Partially Paid',
      paid: 'Fully Paid',
      overpaid: 'Overpaid',
    };
    const buckets = new Map<string, StudentWithInvoice[]>();
    for (const s of students) {
      const inv = s.existingInvoice as Invoice;
      const status = inv?.status ?? 'unpaid';
      if (!buckets.has(status)) buckets.set(status, []);
      buckets.get(status)!.push(s);
    }
    return order
      .filter((st) => buckets.has(st))
      .map((st) => ({
        id: st,
        label: labels[st] ?? st,
        students: buckets.get(st)!,
        isSingleton: false,
      }));
  }

  // skipReason mode — group by diff signature
  if (!bulkTemplate) return [];
  const buckets = new Map<string, { sig: DiffSignature; students: StudentWithInvoice[] }>();

  for (const s of students) {
    const inv = s.existingInvoice;
    const sig = computeDiffSignature(inv.lineItems, bulkTemplate.lineItems);

    // Students with no diffs (sig === {missing:[], mismatched:[]}) are filtered out
    // — they have nothing to reconcile
    if (sig.missing.length === 0 && sig.mismatched.length === 0) continue;

    const key = signatureKey(sig);
    if (!buckets.has(key)) buckets.set(key, { sig, students: [] });
    buckets.get(key)!.students.push(s);
  }

  return Array.from(buckets.entries()).map(([key, { sig, students: grpStudents }]) => ({
    id: key,
    label: signatureLabel(sig),
    students: grpStudents,
    isSingleton: grpStudents.length === 1,
  }));
}

// ── Group row ────────────────────────────────

function GroupRow({
  group,
  actionsComponent,
  groupActionsComponent,
}: {
  group: StudentGroup;
  actionsComponent: (s: StudentWithInvoice) => React.ReactNode;
  groupActionsComponent?: (students: StudentWithInvoice[], groupId: string) => React.ReactNode;
}) {
  const [open, setOpen] = useState(group.isSingleton); // singletons start open

  return (
    <div className="overflow-hidden rounded-md border border-gray-200 bg-white">
      {/* Group header */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between bg-gray-50 px-4 py-3 text-left hover:bg-gray-100 transition-colors"
      >
        <div className="flex items-center gap-2 min-w-0">
          {open ? (
            <ChevronDown className="h-4 w-4 shrink-0 text-gray-400" />
          ) : (
            <ChevronRight className="h-4 w-4 shrink-0 text-gray-400" />
          )}
          <span className="text-sm font-semibold text-gray-900 truncate">
            {group.label}
          </span>
        </div>
        <Badge variant="outline" className="shrink-0 ml-2 text-xs text-gray-600">
          {group.students.length} student{group.students.length !== 1 ? 's' : ''}
        </Badge>
      </button>

      {/* Expanded content */}
      {open && (
        <div>
          {/* Group-level bulk action (e.g. "Apply to all N") */}
          {groupActionsComponent && !group.isSingleton && (
            <div className="border-b border-gray-100 bg-blue-50/50 px-4 py-3">
              {groupActionsComponent(group.students, group.id)}
            </div>
          )}

          {/* Individual student rows */}
          {group.students.map((student) => (
            <div key={student.studentId} className="border-t border-gray-100">
              <div className="px-4 py-3">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <p className="text-sm font-medium text-gray-900">{student.studentName}</p>
                    <p className="text-xs text-gray-500">{student.class}</p>
                  </div>
                </div>
                {/* Injected action bar — no internal branching */}
                {actionsComponent(student)}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main component ────────────────────────────

export function StudentInvoiceTable({
  students,
  groupingKey,
  bulkTemplate,
  actionsComponent,
  groupActionsComponent,
}: StudentInvoiceTableProps) {
  const [search, setSearch] = useState('');

  // Filter students by search term (name, class, or group label)
  const filteredStudents = useMemo(() => {
    if (!search.trim()) return students;
    const q = search.toLowerCase();
    return students.filter(
      (s) =>
        s.studentName.toLowerCase().includes(q) ||
        s.class.toLowerCase().includes(q)
    );
  }, [students, search]);

  const groups = useMemo(
    () => buildGroups(filteredStudents, groupingKey, bulkTemplate),
    [filteredStudents, groupingKey, bulkTemplate]
  );

  return (
    <div className="space-y-4">
      {/* Search / filter bar */}
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
        <Input
          placeholder="Search by student name or class…"
          className="pl-9"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* Group count */}
      {groups.length > 0 && (
        <p className="text-sm text-gray-500">
          {groups.length} group{groups.length !== 1 ? 's' : ''} · {filteredStudents.length} student{filteredStudents.length !== 1 ? 's' : ''}
        </p>
      )}

      {/* Groups */}
      {groups.length === 0 ? (
        <p className="py-8 text-center text-sm text-gray-400">
          {search ? 'No students match your search.' : 'Nothing to show here.'}
        </p>
      ) : (
        <div className="space-y-3">
          {groups.map((group) => (
            <GroupRow
              key={group.id}
              group={group}
              actionsComponent={actionsComponent}
              groupActionsComponent={groupActionsComponent}
            />
          ))}
        </div>
      )}
    </div>
  );
}
