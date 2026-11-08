import { describe, expect, it } from 'vitest';
import { validateReceipt } from './receipt';

describe('asset receipt validation', () => {
  it('accepts the signing date and a usage value at or above the known counter', () => {
    expect(validateReceipt('2026-11-06', '2026-11-06', 18400, 18400)).toEqual({ ok: true });
    expect(validateReceipt('2026-11-06', '2026-11-08', 18400, 18425)).toEqual({ ok: true });
  });

  it('rejects a receipt dated before the lease starts', () => {
    expect(validateReceipt('2026-11-06', '2026-11-05', 0, 0)).toEqual({
      ok: false,
      reason: 'before_lease',
    });
  });

  it('rejects an invalid or decreasing usage counter', () => {
    expect(validateReceipt('2026-11-06', '2026-11-06', 10, 9)).toEqual({
      ok: false,
      reason: 'usage_below_record',
    });
    expect(validateReceipt('2026-11-06', '2026-11-06', 0, 1.5)).toEqual({
      ok: false,
      reason: 'invalid_usage',
    });
  });
});
