import { describe, it, expect } from 'vitest';
import { calculatePoints } from '../scoring';
import { BasePoints } from '@batalha/protocol';

describe('scoring', () => {
  it('awards base points if correct but after speed bonus window', () => {
    expect(calculatePoints(100, true, 10001)).toBe(100);
    expect(calculatePoints(200, true, 12000)).toBe(200);
    expect(calculatePoints(300, true, 15000)).toBe(300);
  });

  it('awards speed bonus if correct and within 10s', () => {
    expect(calculatePoints(100, true, 5000)).toBe(125);
    expect(calculatePoints(200, true, 2000)).toBe(250);
    expect(calculatePoints(300, true, 9999)).toBe(375);
  });

  it('awards speed bonus exactly at 10_000ms', () => {
    expect(calculatePoints(100, true, 10000)).toBe(125);
    expect(calculatePoints(200, true, 10000)).toBe(250);
    expect(calculatePoints(300, true, 10000)).toBe(375);
  });

  it('returns 0 for incorrect answers regardless of speed', () => {
    expect(calculatePoints(100, false, 0)).toBe(0);
    expect(calculatePoints(100, false, 5000)).toBe(0);
    expect(calculatePoints(200, false, 9999)).toBe(0);
    expect(calculatePoints(200, false, 10000)).toBe(0);
    expect(calculatePoints(300, false, 10001)).toBe(0);
    expect(calculatePoints(300, false, 15000)).toBe(0);
  });

  it('returns 0 for negative response time (edge case)', () => {
    expect(calculatePoints(100, true, -1)).toBe(0);
    expect(calculatePoints(100, true, -100)).toBe(0);
  });

  describe('P3.1 exhaustive speed bonus boundary tests (9999ms, 10000ms, 10001ms)', () => {
    const testCases: Array<{
      base: BasePoints;
      expectedBonus: number;
      expectedRegular: number;
    }> = [
      { base: 100, expectedBonus: 125, expectedRegular: 100 },
      { base: 200, expectedBonus: 250, expectedRegular: 200 },
      { base: 300, expectedBonus: 375, expectedRegular: 300 },
    ];

    testCases.forEach(({ base, expectedBonus, expectedRegular }) => {
      it(`evaluates boundary conditions for base points ${base}`, () => {
        // At 0ms (fastest possible answer) -> bonus
        expect(calculatePoints(base, true, 0)).toBe(expectedBonus);

        // At 9999ms (1ms before cutoff) -> speed bonus awarded
        expect(calculatePoints(base, true, 9999)).toBe(expectedBonus);

        // At 10000ms (exact boundary) -> speed bonus awarded
        expect(calculatePoints(base, true, 10000)).toBe(expectedBonus);

        // At 10001ms (1ms after cutoff) -> standard base points awarded without bonus
        expect(calculatePoints(base, true, 10001)).toBe(expectedRegular);

        // At 10002ms -> standard base points
        expect(calculatePoints(base, true, 10002)).toBe(expectedRegular);
      });
    });
  });
});
