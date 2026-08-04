import { describe, expect, it } from 'vitest';
import {
  computeGrandTotal,
  computeOverage,
  directionFor,
  highestTransaction,
} from '../../src/core/engine/exposure.js';
import type { Transaction } from '../../src/core/types.js';

describe('directionFor', () => {
  it('maps exposure type to transaction direction', () => {
    expect(directionFor('Credit Exposure')).toBe('Credit');
    expect(directionFor('Debit Exposure')).toBe('Debit');
  });
});

describe('highestTransaction', () => {
  const txns: Transaction[] = [
    { type: 'Credit', amount: 100 },
    { type: 'Credit', amount: 300 },
    { type: 'Debit', amount: 500 },
    { type: 'Credit', amount: 200 },
  ];

  it('returns the highest matching-direction transaction', () => {
    expect(highestTransaction(txns, 'Credit')?.amount).toBe(300);
    expect(highestTransaction(txns, 'Debit')?.amount).toBe(500);
  });

  it('returns null when no direction match', () => {
    expect(highestTransaction([{ type: 'Debit', amount: 1 }], 'Credit')).toBeNull();
  });

  it('returns null on empty / undefined', () => {
    expect(highestTransaction([], 'Credit')).toBeNull();
    expect(highestTransaction(undefined, 'Credit')).toBeNull();
  });

  it('ignores non-numeric amounts', () => {
    const bad: Transaction[] = [{ type: 'Credit', amount: Number.NaN }, { type: 'Credit' }];
    expect(highestTransaction(bad, 'Credit')).toBeNull();
  });

  it('tie-break keeps the first occurrence', () => {
    const tie: Transaction[] = [
      { type: 'Credit', account: 'first', amount: 300 },
      { type: 'Credit', account: 'second', amount: 300 },
    ];
    expect(highestTransaction(tie, 'Credit')?.account).toBe('first');
  });
});

describe('computeOverage', () => {
  it('is exposure minus both limits', () => {
    expect(computeOverage(550000, 50000, 450000)).toBe(50000);
    expect(computeOverage(100000, 50000, 60000)).toBe(-10000);
  });
});

describe('computeGrandTotal', () => {
  it('is null for debit exposure', () => {
    expect(computeGrandTotal('Debit Exposure', [{ type: 'Credit', amount: 10 }], 0, 0)).toBeNull();
  });

  it('sums per-credit-transaction overage above headroom, floored at 0', () => {
    const txns: Transaction[] = [
      { type: 'Credit', amount: 180000 },
      { type: 'Credit', amount: 90000 },
      { type: 'Debit', amount: 999999 },
    ];
    // headroom = 50000 + 450000 = 500000 -> both credits below headroom -> 0
    expect(computeGrandTotal('Credit Exposure', txns, 50000, 450000)).toBe(0);
    // headroom = 100000 -> 180000-100000=80000, 90000 below -> 80000
    expect(computeGrandTotal('Credit Exposure', txns, 50000, 50000)).toBe(80000);
  });

  it('is 0 for credit exposure with no transactions', () => {
    expect(computeGrandTotal('Credit Exposure', [], 0, 0)).toBe(0);
  });
});
