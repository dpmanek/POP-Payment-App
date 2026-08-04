/** Money helpers — formatting + numeric guards. Pure, no deps. */

/** True when a value is a usable finite number. */
export function isNumeric(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v);
}

/** Format a number as USD for rationale strings, e.g. 50000 -> "$50,000.00". */
export function usd(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}
