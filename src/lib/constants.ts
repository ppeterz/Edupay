// ──────────────────────────────────────────────
// EduPay — Application Constants
// ──────────────────────────────────────────────

export const KOBO_TO_NAIRA = 100;
export const NOMBA_TOKEN_EXPIRY_MS = 25 * 60 * 1000;
export const NOMBA_SANDBOX_URL = 'https://api.nomba.com/v1';
export const NOMBA_PROD_URL = 'https://api.nomba.com/v1';
export const NOMBA_BASE_URL = 'https://api.nomba.com/v1';

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
