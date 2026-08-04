/**
 * Data sufficiency check.
 *
 * A decision requires: an exposure type, an exposure value, a debit limit, a
 * credit limit, and a resolvable highest-value transaction matching the
 * exposure type. Missing business data is NOT a validation error — it is
 * reported through the result so the caller can supply it and retry.
 *
 * A tempValue of 0 or absent is a valid "no temporary increase on file" state
 * and is never reported as missing.
 */

import type { DecisionInput, Transaction } from '../types.js';
import { directionFor, highestTransaction } from './exposure.js';
import { isNumeric } from './money.js';

export interface SufficiencyResult {
  sufficient: boolean;
  missingDataFields: string[];
  /** Resolved basis transaction when sufficient; null otherwise. */
  basisTransaction: Transaction | null;
}

export function checkSufficiency(input: DecisionInput): SufficiencyResult {
  const missing: string[] = [];

  if (!input.exceptionType) missing.push('exceptionType');

  const limits = input.limits ?? {};
  if (!isNumeric(limits.exposureValue)) missing.push('limits.exposureValue');
  if (!isNumeric(limits.dLimitValue)) missing.push('limits.dLimitValue');
  if (!isNumeric(limits.cLimitValue)) missing.push('limits.cLimitValue');

  // Basis transaction can only be resolved once we know the direction.
  let basis: Transaction | null = null;
  if (input.exceptionType) {
    basis = highestTransaction(input.transactions, directionFor(input.exceptionType));
    if (basis === null) {
      missing.push('transactions');
    }
  }

  return {
    sufficient: missing.length === 0,
    missingDataFields: missing,
    basisTransaction: basis,
  };
}

/** Human-readable note describing what is missing. */
export function missingNote(fields: string[]): string {
  if (fields.length === 0) return '';
  const labels: Record<string, string> = {
    exceptionType: 'an exposure type (Credit or Debit)',
    'limits.exposureValue': 'an exposure value',
    'limits.dLimitValue': 'a debit limit',
    'limits.cLimitValue': 'a credit limit',
    transactions: 'a resolvable highest-value transaction for the exposure type',
  };
  const parts = fields.map((f) => labels[f] ?? f);
  return `Cannot compute a decision without ${joinList(parts)}.`;
}

function joinList(items: string[]): string {
  if (items.length === 1) return items[0] as string;
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(', ')}, and ${items[items.length - 1]}`;
}
