import type { PriceList } from '@/data/schemas';
import { addWeekdays } from './calendar';
import { listPriceOn, type ListPriceResult } from './price-list';

/** A lock is valid through the fifth weekday after the quote date, inclusive. */
export function quoteLockExpiry(quoteDate: string): string {
  return addWeekdays(quoteDate, 5);
}

/** A quote cannot be used before it was created; unlocked or expired quotes must be repriced. */
export function isQuoteLocked(quoteDate: string, signingDate: string, locked: boolean): boolean {
  const expiry = quoteLockExpiry(quoteDate);
  // Validate both dates even when the quote is not locked.
  addWeekdays(signingDate, 0);
  return locked && signingDate >= quoteDate && signingDate <= expiry;
}

export type SigningPriceResult =
  | {
      ok: true;
      priceCents: number;
      priceListVersion: number;
      source: 'locked_quote' | 'signing_date';
      priceChanged: boolean;
    }
  | {
      ok: false;
      reason: 'signing_before_quote' | Extract<ListPriceResult, { ok: false }>['reason'];
    };

/** Resolves the net list price to confirm at signing without trusting a client-supplied amount. */
export function signingPrice(
  priceLists: readonly PriceList[],
  assetId: string,
  quoteDate: string,
  signingDate: string,
  locked: boolean
): SigningPriceResult {
  const validLock = isQuoteLocked(quoteDate, signingDate, locked);
  if (signingDate < quoteDate) return { ok: false, reason: 'signing_before_quote' };
  const original = listPriceOn(priceLists, assetId, quoteDate);
  if (!original.ok) return original;
  const selected = validLock ? original : listPriceOn(priceLists, assetId, signingDate);
  if (!selected.ok) return selected;
  return {
    ...selected,
    source: validLock ? 'locked_quote' : 'signing_date',
    priceChanged: selected.priceCents !== original.priceCents,
  };
}
