import { describe, expect, it } from 'vitest';
import { loadPriceLists } from '@/data/load';
import { isQuoteLocked, quoteLockExpiry, signingPrice } from './quote';

describe('optional quote locks', () => {
  it('includes the fifth weekday, but not the following day', () => {
    expect(quoteLockExpiry('2026-11-05')).toBe('2026-11-12');
    expect(isQuoteLocked('2026-11-05', '2026-11-12', true)).toBe(true);
    expect(isQuoteLocked('2026-11-05', '2026-11-13', true)).toBe(false);
  });

  it('does not lock an unselected quote or dates before the quote', () => {
    expect(isQuoteLocked('2026-11-05', '2026-11-06', false)).toBe(false);
    expect(isQuoteLocked('2026-11-05', '2026-11-04', true)).toBe(false);
  });

  it('rejects an invalid signing date', () => {
    expect(() => isQuoteLocked('2026-11-05', '2026-02-30', false)).toThrow(RangeError);
  });

  it('keeps an optional lock across a price-list change, and otherwise reprices', async () => {
    const lists = await loadPriceLists();
    expect(signingPrice(lists, 'laptop-001', '2026-11-05', '2026-11-06', true)).toEqual({
      ok: true,
      priceCents: 119900,
      priceListVersion: 1,
      source: 'locked_quote',
      priceChanged: false,
    });
    expect(signingPrice(lists, 'laptop-001', '2026-11-05', '2026-11-06', false)).toEqual({
      ok: true,
      priceCents: 110300,
      priceListVersion: 2,
      source: 'signing_date',
      priceChanged: true,
    });
    expect(signingPrice(lists, 'laptop-001', '2026-11-05', '2026-11-13', true)).toMatchObject({
      ok: true,
      priceCents: 110300,
      source: 'signing_date',
      priceChanged: true,
    });
  });

  it('rejects signing before quoting and missing prices', async () => {
    const lists = await loadPriceLists();
    expect(signingPrice(lists, 'laptop-001', '2026-11-05', '2026-11-04', true)).toEqual({
      ok: false,
      reason: 'signing_before_quote',
    });
    expect(signingPrice(lists, 'missing', '2026-11-05', '2026-11-06', true)).toEqual({
      ok: false,
      reason: 'unknown_asset',
    });
  });
});
