/**
 * Senior-lender referral.
 *
 * When overage or exposure exceeds the authority ceiling for the exposure type,
 * flag the case for senior-level referral. Informational only — it never
 * changes the recommendation itself.
 */

import type { ExceptionType, Limits } from '../types.js';
import { isNumeric } from './money.js';

export interface CeilingConfig {
  creditCeiling: number;
  debitCeiling: number;
}

export const DEFAULT_CEILING_CONFIG: CeilingConfig = {
  creditCeiling: 300000,
  debitCeiling: 200000,
};

/**
 * Resolve the effective ceiling: a per-request override on `limits` wins over
 * the service default.
 */
export function effectiveCeiling(
  exceptionType: ExceptionType,
  limits: Limits | undefined,
  config: CeilingConfig,
): number {
  if (exceptionType === 'Credit Exposure') {
    return isNumeric(limits?.creditCeiling) ? (limits!.creditCeiling as number) : config.creditCeiling;
  }
  return isNumeric(limits?.debitCeiling) ? (limits!.debitCeiling as number) : config.debitCeiling;
}

/** True when overage or exposure exceeds the applicable authority ceiling. */
export function isSeniorReferral(
  exceptionType: ExceptionType,
  overage: number,
  exposure: number,
  limits: Limits | undefined,
  config: CeilingConfig,
): boolean {
  const ceiling = effectiveCeiling(exceptionType, limits, config);
  return overage > ceiling || exposure > ceiling;
}
