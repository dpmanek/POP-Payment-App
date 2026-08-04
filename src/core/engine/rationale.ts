/**
 * Plain-language rationale builder.
 *
 * Every decision cites the actual figures used (exposure, limits, temp
 * increase, overage) so the basis is traceable.
 */

import type { Recommendation } from '../types.js';
import { usd } from './money.js';

export interface RationaleFigures {
  exposure: number;
  dLimit: number;
  cLimit: number;
  tempValue: number;
  overage: number;
}

/** Rationale for a non-breach case (overage ≤ 0). */
export function notBreachedRationale(f: RationaleFigures): string {
  return (
    `Exposure ${usd(f.exposure)} less D-Limit ${usd(f.dLimit)} and C-Limit ${usd(f.cLimit)} ` +
    `leaves overage ${usd(f.overage)}, which does not breach the exposure limit.`
  );
}

/** Rationale for a breached case, phrased per the resulting recommendation. */
export function breachedRationale(f: RationaleFigures, recommendation: Recommendation): string {
  const base =
    `Exposure ${usd(f.exposure)} less D-Limit ${usd(f.dLimit)} and C-Limit ${usd(f.cLimit)} ` +
    `leaves overage ${usd(f.overage)}`;

  if (recommendation === 'APPROVE') {
    return `${base}, which is within the ${usd(f.tempValue)} temporary limit increase on file — recommend approval.`;
  }
  return `${base}, which exceeds the ${usd(f.tempValue)} temporary limit increase on file — route to an underwriter.`;
}

/** Note appended when confidence forced the conservative outcome. */
export function lowConfidenceNote(score: number, min: number): string {
  return `Confidence ${score.toFixed(2)} is below the ${min.toFixed(2)} minimum; defaulted to underwriter routing.`;
}
