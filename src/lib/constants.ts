// ──────────────────────────────────────────────
// EduPay — Application Constants
// ──────────────────────────────────────────────

export const KOBO_TO_NAIRA = 100;
export const NOMBA_TOKEN_EXPIRY_MS = 25 * 60 * 1000;
export const NOMBA_AUTH_URL = 'https://api.nomba.com/v1';
export const NOMBA_API_URL = 'https://api.nomba.com/v1';

export const FEE_ALLOCATION_PRIORITY: Record<string, number> = {
  'Tuition': 1,
  'Examination Fees': 2,
  'Transport Fees': 3,
  'Other Charges': 4,
};

/**
 * Convert an amount in kobo to a formatted Naira string.
 * @example kobotoNaira(5000000) → '₦50,000.00'
 */
export function kobotoNaira(kobo: number): string {
  return (
    '₦' +
    (kobo / 100).toLocaleString('en-NG', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
  );
}

/**
 * Convert an amount in Naira to kobo (integer).
 * @example nairaToKobo(50000) → 5000000
 */
export function nairaToKobo(naira: number): number {
  return Math.round(naira * 100);
}

// ── Class groupings (single source of truth) ─

export const CLASS_CATEGORIES = {
  'Pre-School': ['Nursery 1', 'Nursery 2'],
  'Primary': ['Primary 1', 'Primary 2', 'Primary 3', 'Primary 4', 'Primary 5', 'Primary 6'],
  'Junior Secondary': ['JSS 1', 'JSS 2', 'JSS 3'],
  'Senior Secondary': ['SS 1', 'SS 2', 'SS 3'],
} as const;

export type ClassCategory = keyof typeof CLASS_CATEGORIES;

export const ALL_CLASSES = Object.values(CLASS_CATEGORIES).flat();

export function getClassCategory(className: string): ClassCategory | null {
  for (const [category, classes] of Object.entries(CLASS_CATEGORIES)) {
    if ((classes as readonly string[]).includes(className)) {
      return category as ClassCategory;
    }
  }
  return null;
}
