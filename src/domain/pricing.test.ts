import { describe, expect, it } from 'vitest';
import { monthlyNetRentCents } from './pricing';

describe('monthlyNetRentCents', () => {
  it('rounds a fractional cent to the nearest whole cent', () => {
    expect(monthlyNetRentCents(389000, 0.027584)).toBe(10730);
  });

  it('rounds a half cent up', () => {
    expect(monthlyNetRentCents(1, 0.5)).toBe(1);
  });

  it('rejects invalid financed amounts', () => {
    expect(() => monthlyNetRentCents(-1, 0.05)).toThrow(RangeError);
    expect(() => monthlyNetRentCents(1.5, 0.05)).toThrow(RangeError);
  });

  it('rejects invalid monthly factors', () => {
    expect(() => monthlyNetRentCents(100, 0)).toThrow(RangeError);
    expect(() => monthlyNetRentCents(100, Number.POSITIVE_INFINITY)).toThrow(RangeError);
  });
});
