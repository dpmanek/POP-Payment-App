import { describe, expect, it } from 'vitest';
import { toThresholdDetermination } from '../../src/core/adapters/thresholdDetermination.js';
import { decide } from '../../src/core/engine/index.js';
import type { DecisionInput } from '../../src/core/types.js';

function run(input: DecisionInput) {
  const result = decide(input);
  return toThresholdDetermination(result, input.limits?.tempValue ?? 0);
}

const limits = (exposure: number, temp: number) => ({
  dLimitValue: 50000,
  cLimitValue: 450000,
  tempValue: temp,
  exposureValue: exposure,
});

describe('threshold adapter routing', () => {
  it('overage > temp -> EXCEEDS_THRESHOLD / RBOPCG_ESCALATION', () => {
    const r = run({
      caseId: 'C1',
      exceptionType: 'Credit Exposure',
      limits: limits(550000, 25000), // overage 50000 > 25000
      transactions: [{ type: 'Credit', amount: 180000 }],
    });
    expect(r.kind).toBe('ok');
    if (r.kind === 'ok') {
      expect(r.body.determination).toBe('EXCEEDS_THRESHOLD');
      expect(r.body.route).toBe('RBOPCG_ESCALATION');
    }
  });

  it('0 < overage <= temp -> BELOW_THRESHOLD / AUTO_CLOSE', () => {
    const r = run({
      caseId: 'C2',
      exceptionType: 'Credit Exposure',
      limits: limits(550000, 60000), // overage 50000 <= 60000
      transactions: [{ type: 'Credit', amount: 180000 }],
    });
    if (r.kind === 'ok') {
      expect(r.body.determination).toBe('BELOW_THRESHOLD');
      expect(r.body.route).toBe('AUTO_CLOSE_BELOW_THRESHOLD');
    }
  });

  it('overage == 0 -> EQUALS_LIMIT / HUMAN_REVIEW', () => {
    const r = run({
      caseId: 'C3',
      exceptionType: 'Credit Exposure',
      limits: limits(500000, 25000), // overage 0
      transactions: [{ type: 'Credit', amount: 180000 }],
    });
    if (r.kind === 'ok') {
      expect(r.body.determination).toBe('EQUALS_LIMIT');
      expect(r.body.route).toBe('HUMAN_REVIEW');
    }
  });

  it('insufficient data -> kind insufficient', () => {
    const r = run({ caseId: 'C4', exceptionType: 'Credit Exposure' });
    expect(r.kind).toBe('insufficient');
  });
});
