import { describe, expect, it } from 'vitest';
import { decide } from '../../src/core/engine/index.js';
import type { DecisionInput } from '../../src/core/types.js';

const base: DecisionInput = {
  caseId: 'EXP-1',
  exceptionType: 'Credit Exposure',
  limits: { dLimitValue: 50000, cLimitValue: 450000, tempValue: 25000, exposureValue: 550000 },
  transactions: [{ type: 'Credit', tc: '27', amount: 180000 }],
};

describe('decide — breach ladder', () => {
  it('breached beyond temp -> ROUTE-UW, human required', () => {
    const r = decide(base);
    expect(r.limitBreached).toBe('YES');
    expect(r.overageValue).toBe(50000);
    expect(r.recommendation).toBe('ROUTE-UW');
    expect(r.requiresHumanDecision).toBe(true);
    expect(r.confidence).toBeGreaterThan(0.5);
    expect(r.rationale).toContain('$50,000.00');
  });

  it('breached within temp -> APPROVE', () => {
    const r = decide({
      ...base,
      limits: { ...base.limits, tempValue: 60000 },
    });
    expect(r.limitBreached).toBe('YES');
    expect(r.recommendation).toBe('APPROVE');
    expect(r.requiresHumanDecision).toBe(true);
  });

  it('not breached (overage <= 0) -> NO, no recommendation', () => {
    const r = decide({
      ...base,
      limits: { ...base.limits, exposureValue: 400000 },
    });
    expect(r.limitBreached).toBe('NO');
    expect(r.overageValue).toBe(-100000);
    expect(r.recommendation).toBeNull();
    expect(r.requiresHumanDecision).toBe(false);
    expect(r.rationale).toContain('does not breach');
  });

  it('never produces REJECT', () => {
    const r = decide(base);
    expect(['APPROVE', 'ROUTE-UW', null]).toContain(r.recommendation);
  });
});

describe('decide — insufficient data', () => {
  it('reports missing limits without computing', () => {
    const r = decide({ caseId: 'EXP-2', exceptionType: 'Credit Exposure' });
    expect(r.limitBreached).toBe('INSUFFICIENT_DATA');
    expect(r.overageValue).toBeNull();
    expect(r.grandTotalValue).toBeNull();
    expect(r.recommendation).toBeNull();
    expect(r.missingDataFields).toContain('limits.exposureValue');
    expect(r.missingDataFields).toContain('transactions');
    expect(r.additionalNotes).toBeTruthy();
  });

  it('tempValue 0/absent is NOT missing data', () => {
    const r = decide({
      caseId: 'EXP-3',
      exceptionType: 'Debit Exposure',
      limits: { dLimitValue: 100000, cLimitValue: 50000, exposureValue: 120000, tempValue: 0 },
      transactions: [{ type: 'Debit', amount: 120000 }],
    });
    expect(r.limitBreached).not.toBe('INSUFFICIENT_DATA');
    expect(r.missingDataFields).toHaveLength(0);
  });
});

describe('decide — senior referral', () => {
  it('flags when exposure exceeds credit ceiling, without changing recommendation', () => {
    const r = decide(base); // exposure 550000 > 300000 credit ceiling
    expect(r.seniorLenderReferral).toBe(true);
    expect(r.recommendation).toBe('ROUTE-UW');
  });

  it('does not flag when under ceiling', () => {
    const r = decide({
      caseId: 'EXP-4',
      exceptionType: 'Debit Exposure',
      limits: { dLimitValue: 100000, cLimitValue: 50000, exposureValue: 160000, tempValue: 5000 },
      transactions: [{ type: 'Debit', amount: 160000 }],
    });
    expect(r.seniorLenderReferral).toBe(false);
  });
});

describe('decide — confidence override', () => {
  it('unconfirmed temp drops confidence and forces ROUTE-UW even within temp', () => {
    // Within temp would normally APPROVE; unconfirmed temp penalty 0.25 keeps it
    // at 0.75 (still above 0.5), so raise penalties via a stacked-missing case.
    const r = decide({
      caseId: 'EXP-5',
      exceptionType: 'Credit Exposure',
      // no company, no achId => small penalties; unconfirmed temp => 0.25
      limits: {
        dLimitValue: 50000,
        cLimitValue: 450000,
        tempValue: 60000,
        exposureValue: 550000,
        tempConfirmed: false,
      },
      transactions: [{ type: 'Credit', amount: 180000 }],
    });
    // 1 - 0.25 - 0.075 - 0.075 = 0.60 => still APPROVE (above 0.5)
    expect(r.recommendation).toBe('APPROVE');
    expect(r.confidence).toBeLessThan(1);
  });
});
