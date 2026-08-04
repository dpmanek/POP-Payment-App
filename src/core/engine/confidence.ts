/**
 * Confidence scoring.
 *
 * The reference business logic requires a 0–1 confidence per recommendation and
 * a minimum threshold below which the recommendation defaults to the more
 * conservative outcome (ROUTE-UW). No formula is defined in the spec, so this
 * is a documented, config-driven default that is easy to replace.
 *
 * Model: start at 1.0 and subtract fixed penalties for signals that reduce
 * trust in the inputs, then clamp to [0, 1].
 */

import type { DecisionInput } from '../types.js';
import { isNumeric } from './money.js';

export interface ConfidenceConfig {
  /** Below this, force the conservative outcome. */
  minConfidence: number;
  /** Penalty when a temporary increase is present but unconfirmed. */
  unconfirmedTempPenalty: number;
  /** Penalty per optional-but-helpful field that is absent. */
  missingOptionalPenalty: number;
}

export const DEFAULT_CONFIDENCE_CONFIG: ConfidenceConfig = {
  minConfidence: 0.5,
  unconfirmedTempPenalty: 0.25,
  missingOptionalPenalty: 0.15,
};

/**
 * Compute confidence for a case that has sufficient data to decide.
 * Insufficient-data cases never reach here (no recommendation is produced).
 */
export function computeConfidence(input: DecisionInput, config: ConfidenceConfig): number {
  let score = 1.0;
  const limits = input.limits ?? {};

  // A supplied temp increase whose reliability cannot be established.
  const tempPresent = isNumeric(limits.tempValue) && (limits.tempValue as number) > 0;
  if (tempPresent && limits.tempConfirmed === false) {
    score -= config.unconfirmedTempPenalty;
  }

  // Helpful-but-optional identifying fields that improve traceability.
  if (!input.exceptionType) score -= config.missingOptionalPenalty; // defensive
  if (!input.company) score -= config.missingOptionalPenalty / 2;
  if (!input.achId) score -= config.missingOptionalPenalty / 2;

  return clamp01(round2(score));
}

/** True when the score sits below the configured minimum. */
export function belowThreshold(score: number, config: ConfidenceConfig): boolean {
  return score < config.minConfidence;
}

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

function round2(v: number): number {
  return Math.round(v * 100) / 100;
}
