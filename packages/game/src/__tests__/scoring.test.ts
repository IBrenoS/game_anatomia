import { describe, it, expect } from 'vitest';
import { calculatePoints } from '../scoring';

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
  });

  it('returns 0 for incorrect answers', () => {
    expect(calculatePoints(100, false, 5000)).toBe(0);
    expect(calculatePoints(100, false, 15000)).toBe(0);
  });

  it('returns 0 for negative response time (edge case)', () => {
    expect(calculatePoints(100, true, -100)).toBe(0);
  });
});
