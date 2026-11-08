import type { PlannedInvoice } from './invoices';
import { addMonths } from './calendar';

export type EarlyExitSettlement = {
  settlementCents: number;
  remainingContractValueCents: number;
  marketValueCents: number;
  monthsElapsed: number;
  discountedInvoices: { issueDate: string; monthsUntilIssue: number; valueCents: number }[];
};

function monthsBetween(start: string, end: string): number {
  const monthDifference =
    (Number(end.slice(0, 4)) - Number(start.slice(0, 4))) * 12 +
    Number(end.slice(5, 7)) -
    Number(start.slice(5, 7));
  return monthDifference - (end.slice(8) < start.slice(8) ? 1 : 0);
}

/**
 * A returning customer settles the present value of unissued net rent minus the
 * resale value of the returned item. The end-of-term buyout stays a separate
 * option for customers who keep the item. VAT is excluded from an unissued exit.
 */
export function calculateEarlyExit(input: {
  signedDate: string;
  endDate: string;
  returnDate: string;
  invoices: readonly Pick<PlannedInvoice, 'issueDate' | 'netCents'>[];
  annualInterestPercent: number;
  marketValueCents: number;
}): { ok: true; settlement: EarlyExitSettlement } | { ok: false; reason: 'not_early' } {
  const { signedDate, endDate, returnDate, invoices, annualInterestPercent, marketValueCents } =
    input;
  addMonths(signedDate, 0);
  addMonths(endDate, 0);
  addMonths(returnDate, 0);
  if (returnDate <= signedDate || returnDate >= endDate) return { ok: false, reason: 'not_early' };
  if (!Number.isFinite(annualInterestPercent) || annualInterestPercent < 0)
    throw new RangeError('annualInterestPercent must be non-negative');
  if (!Number.isSafeInteger(marketValueCents) || marketValueCents < 0)
    throw new RangeError('marketValueCents must be non-negative whole cents');

  const monthlyRate = annualInterestPercent / 1200;
  const discountedInvoices = invoices
    .filter((invoice) => invoice.issueDate > returnDate)
    .map((invoice) => {
      if (!Number.isSafeInteger(invoice.netCents) || invoice.netCents < 0)
        throw new RangeError('invoice net must be non-negative whole cents');
      const monthsUntilIssue = Math.max(1, monthsBetween(returnDate, invoice.issueDate));
      const valueCents = Math.round(invoice.netCents / (1 + monthlyRate) ** monthsUntilIssue);
      return { issueDate: invoice.issueDate, monthsUntilIssue, valueCents };
    });
  const remainingContractValueCents = discountedInvoices.reduce(
    (sum, invoice) => sum + invoice.valueCents,
    0
  );
  return {
    ok: true,
    settlement: {
      settlementCents: Math.max(0, remainingContractValueCents - marketValueCents),
      remainingContractValueCents,
      marketValueCents,
      monthsElapsed: Math.max(0, monthsBetween(signedDate, returnDate)),
      discountedInvoices,
    },
  };
}
