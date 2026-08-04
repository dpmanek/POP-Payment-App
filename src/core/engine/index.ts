/**
 * Decision engine — orchestrator.
 *
 * Produces ONE neutral `DecisionResult` from a neutral `DecisionInput`.
 * Knows nothing about HTTP contracts, routing vocabulary, Express, or AWS.
 * This is the reusable "skill": call it from a controller, a Lambda handler,
 * a Step Function task, or a test — the behavior is identical.
 */

import type { DecisionInput, DecisionResult, Recommendation } from '../types.js';
import { type CeilingConfig, DEFAULT_CEILING_CONFIG, isSeniorReferral } from './ceilings.js';
import {
  type ConfidenceConfig,
  DEFAULT_CONFIDENCE_CONFIG,
  belowThreshold,
  computeConfidence,
} from './confidence.js';
import { computeGrandTotal, computeOverage, directionFor } from './exposure.js';
import { isNumeric } from './money.js';
import { breachedRationale, lowConfidenceNote, notBreachedRationale } from './rationale.js';
import { checkSufficiency, missingNote } from './sufficiency.js';

export interface EngineConfig {
  ceilings: CeilingConfig;
  confidence: ConfidenceConfig;
}

export const DEFAULT_ENGINE_CONFIG: EngineConfig = {
  ceilings: DEFAULT_CEILING_CONFIG,
  confidence: DEFAULT_CONFIDENCE_CONFIG,
};

export function decide(
  input: DecisionInput,
  config: EngineConfig = DEFAULT_ENGINE_CONFIG,
): DecisionResult {
  const sufficiency = checkSufficiency(input);

  // ---- Insufficient data: no math, no recommendation. -------------------
  if (!sufficiency.sufficient) {
    return {
      caseId: input.caseId,
      exceptionType: input.exceptionType,
      overageValue: null,
      grandTotalValue: null,
      limitBreached: 'INSUFFICIENT_DATA',
      recommendation: null,
      confidence: null,
      rationale: null,
      seniorLenderReferral: false,
      missingDataFields: sufficiency.missingDataFields,
      additionalNotes: missingNote(sufficiency.missingDataFields),
      requiresHumanDecision: false,
      basisTransaction: null,
    };
  }

  // Sufficiency guarantees these are numeric and exceptionType is present.
  const exceptionType = input.exceptionType!;
  const limits = input.limits!;
  const exposure = limits.exposureValue as number;
  const dLimit = limits.dLimitValue as number;
  const cLimit = limits.cLimitValue as number;
  const tempValue = isNumeric(limits.tempValue) ? (limits.tempValue as number) : 0;

  const overage = computeOverage(exposure, dLimit, cLimit);
  const grandTotal = computeGrandTotal(exceptionType, input.transactions, dLimit, cLimit);
  const seniorLenderReferral = isSeniorReferral(
    exceptionType,
    overage,
    exposure,
    limits,
    config.ceilings,
  );

  const figures = { exposure, dLimit, cLimit, tempValue, overage };

  // ---- Not breached: overage ≤ 0. No recommendation. --------------------
  if (overage <= 0) {
    return {
      caseId: input.caseId,
      exceptionType,
      overageValue: overage,
      grandTotalValue: grandTotal,
      limitBreached: 'NO',
      recommendation: null,
      confidence: null,
      rationale: notBreachedRationale(figures),
      seniorLenderReferral,
      missingDataFields: [],
      additionalNotes: null,
      requiresHumanDecision: false,
      basisTransaction: sufficiency.basisTransaction,
    };
  }

  // ---- Breached: overage > 0. Produce a recommendation. -----------------
  const confidence = computeConfidence(input, config.confidence);
  const forcedConservative = belowThreshold(confidence, config.confidence);

  // Within the temp increase -> approve; otherwise route to underwriter.
  const naturalRecommendation: Recommendation = overage <= tempValue ? 'APPROVE' : 'ROUTE-UW';
  const recommendation: Recommendation = forcedConservative ? 'ROUTE-UW' : naturalRecommendation;

  let rationale = breachedRationale(figures, recommendation);
  let additionalNotes: string | null = null;
  if (forcedConservative && naturalRecommendation === 'APPROVE') {
    const note = lowConfidenceNote(confidence, config.confidence.minConfidence);
    rationale = `${rationale} ${note}`;
    additionalNotes = note;
  }

  return {
    caseId: input.caseId,
    exceptionType,
    overageValue: overage,
    grandTotalValue: grandTotal,
    limitBreached: 'YES',
    recommendation,
    confidence,
    rationale,
    seniorLenderReferral,
    missingDataFields: [],
    additionalNotes,
    requiresHumanDecision: true,
    basisTransaction: sufficiency.basisTransaction,
  };
}

export * from './exposure.js';
export * from './ceilings.js';
export * from './confidence.js';
