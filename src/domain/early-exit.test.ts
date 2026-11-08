import { describe, expect, it } from 'vitest';
import { calculateEarlyExit } from './early-exit';

describe('fair early exit settlement', () => {
  const base = {
    signedDate: '2026-11-05',
    endDate: '2029-11-05',
    returnDate: '2027-06-05',
    invoices: [
      { issueDate: '2027-06-01', netCents: 10000 },
      { issueDate: '2027-07-01', netCents: 10000 },
      { issueDate: '2027-08-01', netCents: 10000 },
    ],
    annualInterestPercent: 7.9,
    marketValueCents: 20000,
  };

  it('discounts future unissued net invoices and subtracts returned market value', () => {
    expect(calculateEarlyExit(base)).toMatchObject({
      ok: true,
      settlement: {
        monthsElapsed: 7,
        remainingContractValueCents: 19870,
        marketValueCents: 20000,
        settlementCents: 0,
        discountedInvoices: [
          { issueDate: '2027-07-01', monthsUntilIssue: 1, valueCents: 9935 },
          { issueDate: '2027-08-01', monthsUntilIssue: 1, valueCents: 9935 },
        ],
      },
    });
  });

  it('cannot exceed remaining scheduled net rent and floors at zero', () => {
    const result = calculateEarlyExit({
      ...base,
      invoices: [{ issueDate: '2027-07-01', netCents: 10000 }],
      marketValueCents: 0,
    });
    expect(result).toMatchObject({ ok: true, settlement: { settlementCents: 9935 } });
  });

  it('rejects a date on or outside the lease period', () => {
    expect(calculateEarlyExit({ ...base, returnDate: '2026-11-05' })).toEqual({
      ok: false,
      reason: 'not_early',
    });
    expect(calculateEarlyExit({ ...base, returnDate: '2029-11-05' })).toEqual({
      ok: false,
      reason: 'not_early',
    });
  });
});
