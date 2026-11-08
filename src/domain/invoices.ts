import type { VatRate } from '@/data/schemas';
import { addMonths, monthLength } from './calendar';

export type PlannedInvoice = {
  issueDate: string;
  dueDate: string;
  periodStart: string;
  periodEndExclusive: string;
  netCents: number;
  vatRatePercent: number;
  vatCents: number;
  totalCents: number;
};

export type InvoiceSchedule =
  | { ok: true; endDate: string; invoices: PlannedInvoice[] }
  | { ok: false; reason: 'missing_vat_rate' | 'overlapping_vat_rates'; issueDate: string };

/**
 * Plans monthly invoices for [startDate, endDate). The first invoice is issued
 * on the start date; later invoices are issued on the first of each month.
 * The first and last months are prorated by covered calendar days. Net and VAT
 * are each rounded to the nearest cent, with half cents rounded up.
 */
export function planInvoices(
  startDate: string,
  termMonths: number,
  monthlyNetCents: number,
  vatRates: readonly VatRate[]
): InvoiceSchedule {
  if (!Number.isSafeInteger(termMonths) || termMonths < 1 || termMonths > 48) {
    throw new RangeError('termMonths must be an integer between 1 and 48');
  }
  if (!Number.isSafeInteger(monthlyNetCents) || monthlyNetCents < 0) {
    throw new RangeError('monthlyNetCents must be non-negative whole cents');
  }

  const endDate = addMonths(startDate, termMonths);
  const firstMonth = `${startDate.slice(0, 7)}-01`;
  const invoices: PlannedInvoice[] = [];

  for (let offset = 0; ; offset++) {
    const monthStart = addMonths(firstMonth, offset);
    if (monthStart >= endDate) break;
    const nextMonth = addMonths(firstMonth, offset + 1);
    const periodStart = monthStart < startDate ? startDate : monthStart;
    const periodEndExclusive = nextMonth < endDate ? nextMonth : endDate;
    const startDay = Number(periodStart.slice(8));
    const endDay =
      periodEndExclusive === nextMonth
        ? monthLength(monthStart) + 1
        : Number(periodEndExclusive.slice(8));
    const issueDate = offset === 0 ? startDate : monthStart;
    const dueMonth = Number(issueDate.slice(8)) < 15 ? monthStart : nextMonth;
    const dueDate = `${dueMonth.slice(0, 7)}-15`;
    const matchingRates = vatRates.filter(
      (rate) =>
        rate.valid_from <= issueDate && (rate.valid_to === null || issueDate <= rate.valid_to)
    );
    if (matchingRates.length !== 1) {
      return {
        ok: false,
        reason: matchingRates.length === 0 ? 'missing_vat_rate' : 'overlapping_vat_rates',
        issueDate,
      };
    }

    const rate = matchingRates[0];
    if (!rate) throw new Error('Expected exactly one VAT rate');
    const basisPoints = rate.rate_percent * 100;
    if (!Number.isSafeInteger(basisPoints) || basisPoints < 0) {
      throw new RangeError('VAT rate must be a non-negative whole number of basis points');
    }
    const proratedNumerator = monthlyNetCents * (endDay - startDay);
    if (!Number.isSafeInteger(proratedNumerator)) {
      throw new RangeError('Invoice calculation exceeds safe integer range');
    }
    const netCents = Math.round(proratedNumerator / monthLength(monthStart));
    const vatNumerator = netCents * basisPoints;
    if (!Number.isSafeInteger(vatNumerator)) {
      throw new RangeError('VAT calculation exceeds safe integer range');
    }
    const vatCents = Math.round(vatNumerator / 10000);
    if (!Number.isSafeInteger(netCents) || !Number.isSafeInteger(vatCents + netCents)) {
      throw new RangeError('Invoice amount exceeds safe integer range');
    }
    invoices.push({
      issueDate,
      dueDate,
      periodStart,
      periodEndExclusive,
      netCents,
      vatRatePercent: rate.rate_percent,
      vatCents,
      totalCents: netCents + vatCents,
    });
  }

  return { ok: true, endDate, invoices };
}
