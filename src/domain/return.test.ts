import { describe, expect, it } from 'vitest';
import { canRequestReturn } from './return';

describe('customer return request', () => {
  it('allows a request on or after the end date', () => {
    expect(canRequestReturn('2027-11-20', '2027-11-20', false)).toEqual({ ok: true });
    expect(canRequestReturn('2027-11-20', '2027-11-21', false)).toEqual({ ok: true });
  });

  it('does not allow early or duplicate requests', () => {
    expect(canRequestReturn('2027-11-20', '2027-11-19', false)).toEqual({
      ok: false,
      reason: 'before_lease_end',
    });
    expect(canRequestReturn('2027-11-20', '2027-11-20', true)).toEqual({
      ok: false,
      reason: 'already_requested',
    });
  });

  it('rejects invalid dates', () => {
    expect(() => canRequestReturn('2027-11-20', '2027-02-30', false)).toThrow(RangeError);
  });
});
