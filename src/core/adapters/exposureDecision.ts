/**
 * Adapter: neutral DecisionResult -> exposure-decision contract response.
 *
 * Contract: pop-exposure-decision-api.json (the richer advisory view).
 */

import type { DecisionResult, ExceptionType, Recommendation } from '../types.js';

export interface ExposureDecisionResponse {
  caseId: string;
  exceptionType?: ExceptionType;
  overageValue: number | null;
  grandTotalValue: number | null;
  limitBreached: 'YES' | 'NO' | 'INSUFFICIENT_DATA';
  recommendation: Recommendation | null;
  confidence: number | null;
  rationale: string | null;
  seniorLenderReferral: boolean;
  missingDataFields: string[];
  additionalNotes: string | null;
  requiresHumanDecision: boolean;
}

export function toExposureDecision(result: DecisionResult): ExposureDecisionResponse {
  return {
    caseId: result.caseId,
    exceptionType: result.exceptionType,
    overageValue: result.overageValue,
    grandTotalValue: result.grandTotalValue,
    limitBreached: result.limitBreached,
    recommendation: result.recommendation,
    confidence: result.confidence,
    rationale: result.rationale,
    seniorLenderReferral: result.seniorLenderReferral,
    missingDataFields: result.missingDataFields,
    additionalNotes: result.additionalNotes,
    requiresHumanDecision: result.requiresHumanDecision,
  };
}
