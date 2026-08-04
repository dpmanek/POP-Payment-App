/**
 * Exposure math — overage + grand total.
 *
 * Pure functions. No knowledge of HTTP contracts or routing vocabulary.
 */

import type { ExceptionType, Limits, Transaction, TransactionType } from '../types.js';
import { isNumeric } from './money.js';

/** Map an exception type to the transaction direction it decisions against. */
export function directionFor(exceptionType: ExceptionType): TransactionType {
  return exceptionType === 'Credit Exposure' ? 'Credit' : 'Debit';
}

/**
 * Resolve the highest-value transaction matching the exposure direction.
 * Tie-break: first occurrence in array order (documented default).
 * Returns null when none resolve (missing type or non-numeric amount).
 */
export function highestTransaction(
  transactions: Transaction[] | undefined,
  direction: TransactionType,
): Transaction | null {
  if (!transactions || transactions.length === 0) return null;

  let best: Transaction | null = null;
  for (const txn of transactions) {
    if (txn.type !== direction) continue;
    if (!isNumeric(txn.amount)) continue;
    if (best === null || (txn.amount as number) > (best.amount as number)) {
      best = txn;
    }
  }
  return best;
}

/**
 * Overage = Exposure − Debit Limit − Credit Limit.
 * Caller guarantees all three inputs are numeric.
 */
export function computeOverage(exposure: number, dLimit: number, cLimit: number): number {
  return exposure - dLimit - cLimit;
}

/**
 * Grand total (PCG hold) = sum of per-transaction overage across CREDIT
 * transactions only. Null for debit exposure.
 *
 * Per-transaction overage is the amount by which each credit transaction sits
 * above the combined limit headroom. Headroom = dLimit + cLimit; anything a
 * transaction contributes beyond remaining headroom is its overage. We compute
 * it as: max(0, exposureContribution − headroom) is not derivable per-txn from
 * aggregate exposure, so we use the transaction amount against headroom, which
 * is the credits-only interpretation the spec describes. Negative contributions
 * are floored at 0 (a transaction cannot reduce the grand total).
 */
export function computeGrandTotal(
  exceptionType: ExceptionType,
  transactions: Transaction[] | undefined,
  dLimit: number,
  cLimit: number,
): number | null {
  if (exceptionType !== 'Credit Exposure') return null;
  if (!transactions || transactions.length === 0) return 0;

  const headroom = dLimit + cLimit;
  let total = 0;
  for (const txn of transactions) {
    if (txn.type !== 'Credit') continue;
    if (!isNumeric(txn.amount)) continue;
    const overage = (txn.amount as number) - headroom;
    if (overage > 0) total += overage;
  }
  return total;
}

/** Convenience: pull a limit as a usable number, or null. */
export function num(v: number | null | undefined): number | null {
  return isNumeric(v) ? v : null;
}

export type { Limits };
