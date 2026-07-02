// ──────────────────────────────────────────────
// EduPay — Invoice Helpers (Pure Functions)
// ──────────────────────────────────────────────
// Shared by API routes and the future reconciliation engine.
// No Firestore calls — keep this file pure and testable.

import type { InvoiceLineItem, Invoice } from '@/types';

/**
 * Calculate totals from an array of line items.
 * All values are in kobo.
 */
export function calculateInvoiceTotals(lineItems: InvoiceLineItem[]): {
  totalAmountDue: number;
  totalAmountPaid: number;
  outstandingBalance: number;
} {
  const totalAmountDue = lineItems.reduce((sum, li) => sum + li.amountDue, 0);
  const totalAmountPaid = lineItems.reduce(
    (sum, li) => sum + li.amountPaid,
    0
  );
  const outstandingBalance = totalAmountDue - totalAmountPaid;
  return { totalAmountDue, totalAmountPaid, outstandingBalance };
}

/**
 * Derive invoice status from total amounts.
 */
export function deriveInvoiceStatus(
  totalAmountDue: number,
  totalAmountPaid: number
): Invoice['status'] {
  if (totalAmountPaid === 0) return 'unpaid';
  if (totalAmountPaid < totalAmountDue) return 'partial';
  if (totalAmountPaid === totalAmountDue) return 'paid';
  return 'overpaid'; // totalAmountPaid > totalAmountDue
}

/**
 * Sort line items by priority ascending (1 = highest).
 * Returns a new array — does not mutate.
 */
export function sortLineItemsByPriority(
  lineItems: InvoiceLineItem[]
): InvoiceLineItem[] {
  return [...lineItems].sort((a, b) => a.priority - b.priority);
}

/**
 * Validate line items before invoice creation.
 * Returns null if valid, or an error message string if invalid.
 */
export function validateLineItems(
  lineItems: {
    description: string;
    amountDue: number;
    priority: number;
  }[]
): string | null {
  if (!Array.isArray(lineItems) || lineItems.length === 0) {
    return 'At least one line item is required';
  }

  for (const li of lineItems) {
    if (
      !li.description ||
      typeof li.description !== 'string' ||
      li.description.trim() === ''
    ) {
      return 'Every line item needs a description';
    }
    if (typeof li.amountDue !== 'number' || li.amountDue <= 0) {
      return 'Every line item amount must be a positive number';
    }
    if (typeof li.priority !== 'number' || li.priority < 1) {
      return 'Every line item needs a valid priority (1 or higher)';
    }
  }

  const priorities = lineItems.map((li) => li.priority);
  if (new Set(priorities).size !== priorities.length) {
    return 'Line item priorities must be unique';
  }

  return null; // valid
}

// ── Skipped student grouping helpers ─────────

export interface SkippedStudentEntry {
  studentId: string;
  studentName: string;
  class: string;
  existingInvoice: Invoice;
}

export interface SkippedClassGroup {
  className: string;
  students: SkippedStudentEntry[];
}

/**
 * Group skipped student entries by class name, sorted alphabetically.
 */
export function groupSkippedByClass(
  entries: SkippedStudentEntry[]
): SkippedClassGroup[] {
  const groups = new Map<string, SkippedStudentEntry[]>();
  for (const entry of entries) {
    const existing = groups.get(entry.class) ?? [];
    existing.push(entry);
    groups.set(entry.class, existing);
  }
  return Array.from(groups.entries())
    .map(([className, students]) => ({ className, students }))
    .sort((a, b) => a.className.localeCompare(b.className));
}

export interface TemplateLineItem {
  description: string;
  amountDue: number; // kobo
  priority: number;
}

/**
 * Diff a template's line items against an existing invoice's line items.
 * Matching is done by description (case-insensitive, trimmed).
 * Returns:
 *   missing  — template items not found in the existing invoice
 *   matching — items present in both (possibly with different amounts)
 */
export function diffLineItems(
  templateLineItems: TemplateLineItem[],
  existingLineItems: InvoiceLineItem[]
): {
  missing: TemplateLineItem[];
  matching: { template: TemplateLineItem; existing: InvoiceLineItem }[];
} {
  const existingByDesc = new Map(
    existingLineItems.map((li) => [li.description.toLowerCase().trim(), li])
  );

  const missing: TemplateLineItem[] = [];
  const matching: { template: TemplateLineItem; existing: InvoiceLineItem }[] = [];

  for (const item of templateLineItems) {
    const match = existingByDesc.get(item.description.toLowerCase().trim());
    if (match) {
      matching.push({ template: item, existing: match });
    } else {
      missing.push(item);
    }
  }

  return { missing, matching };
}

