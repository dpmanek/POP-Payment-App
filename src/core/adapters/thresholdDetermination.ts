/**
 * Adapter: neutral DecisionResult -> threshold-determination contract response.
 *
 * Contract: pop-openapi.json (the routing view Pega's workflow consumes).
 *
 * This contract is a pure overage-vs-temporary-threshold comparison and has no
 * concept of confidence. It therefore maps directly from the raw overage and
 * temp value, NOT from the advisory recommendation (which may be nudged by
 * confidence). Insufficient data is not representable in this contract's
 * response, so the caller surfaces it as a 400 instead.
 */

import type { DecisionResult } from '../types.js';
import { usd } from '../engine/money.js';

export type Determination = 'EQUALS_LIMIT' | 'BELOW_THRESHOLD' | 'EXCEEDS_THRESHOLD';
export type Route = 'HUMAN_REVIEW' | 'AUTO_CLOSE_BELOW_THRESHOLD' | 'RBOPCG_ESCALATION';

export interface ThresholdDeterminationResponse {
  caseId: string;
  determination: Determination;
  route: Route;
  overageValue: number;
  grandTotalValue: number | null;
  rationale: string;
}

export type ThresholdAdapterResult =
  | { kind: 'ok'; body: ThresholdDeterminationResponse }
  | { kind: 'insufficient'; missingDataFields: string[] };

export function toThresholdDetermination(
  result: DecisionResult,
  tempValue: number,
): ThresholdAdapterResult {
  if (result.limitBreached === 'INSUFFICIENT_DATA' || result.overageValue === null) {
    return { kind: 'insufficient', missingDataFields: result.missingDataFields };
  }

  const overage = result.overageValue;
  let determination: Determination;
  let route: Route;
  let rationale: string;

  if (overage > tempValue) {
    determination = 'EXCEEDS_THRESHOLD';
    route = 'RBOPCG_ESCALATION';
    rationale = `Overage ${usd(overage)} exceeds temporary threshold ${usd(tempValue)} — RBO/PCG escalation required.`;
  } else if (overage === 0) {
    determination = 'EQUALS_LIMIT';
    route = 'HUMAN_REVIEW';
    rationale = `Overage is ${usd(0)} — exposure equals the limit; human review required.`;
  } else {
    // 0 < overage ≤ temp threshold, and (as a documented extension) overage < 0
    // both auto-close: nothing to escalate.
    determination = 'BELOW_THRESHOLD';
    route = 'AUTO_CLOSE_BELOW_THRESHOLD';
    rationale =
      overage > 0
        ? `Overage ${usd(overage)} is within temporary threshold ${usd(tempValue)} — auto-close.`
        : `Overage ${usd(overage)} is below the exposure limit — auto-close.`;
  }

  return {
    kind: 'ok',
    body: {
      caseId: result.caseId,
      determination,
      route,
      overageValue: overage,
      grandTotalValue: result.grandTotalValue,
      rationale,
    },
  };
}
