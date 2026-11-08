import { describe, expect, it } from 'vitest';
import { loadVatRates } from '@/data/load';
import { planInvoices } from './invoices';

describe('monthly invoice schedule', () => {
  it('prorates the first and last months, and changes VAT on the issue date', async () => {
    const { rates } = await loadVatRates();
    const schedule = planInvoices('2026-11-20', 12, 10000, rates);
    expect(schedule.ok).toBe(true);
    if (!schedule.ok) throw new Error('expected schedule');
    expect(schedule.endDate).toBe('2027-11-20');
    expect(schedule.invoices).toHaveLength(13);
    expect(schedule.invoices[0]).toMatchObject({
      issueDate: '2026-11-20',
      dueDate: '2026-12-15',
      netCents: 3667,
      vatRatePercent: 25.5,
      vatCents: 935,
      totalCents: 4602,
    });
    expect(schedule.invoices[2]).toMatchObject({
      issueDate: '2027-01-01',
      dueDate: '2027-01-15',
      netCents: 10000,
      vatRatePercent: 26,
      totalCents: 12600,
    });
    expect(schedule.invoices.at(-1)).toMatchObject({
      issueDate: '2027-11-01',
      netCents: 6333,
      vatCents: 1647,
    });
    expect(schedule.invoices.reduce((sum, invoice) => sum + invoice.netCents, 0)).toBe(120000);
  });

  it('clamps a leap-day lease end and handles a signing on the 15th', async () => {
    const { rates } = await loadVatRates();
    const leap = planInvoices('2028-02-29', 12, 10000, rates);
    expect(leap.ok && leap.endDate).toBe('2029-02-28');
    const fifteenth = planInvoices('2026-11-15', 1, 10000, rates);
    expect(fifteenth.ok && fifteenth.invoices[0]?.dueDate).toBe('2026-12-15');
  });

  it('surfaces missing and overlapping VAT rates instead of making up a rate', async () => {
    const { rates } = await loadVatRates();
    expect(planInvoices('2026-11-01', 1, 10000, [])).toEqual({
      ok: false,
      reason: 'missing_vat_rate',
      issueDate: '2026-11-01',
    });
    const rate = rates.find((entry) => entry.valid_from === '2024-09-01');
    if (!rate) throw new Error('expected 2026 rate');
    expect(planInvoices('2026-11-01', 1, 10000, [rate, rate])).toEqual({
      ok: false,
      reason: 'overlapping_vat_rates',
      issueDate: '2026-11-01',
    });
  });

  it('rejects invalid amounts and terms', () => {
    expect(() => planInvoices('2026-11-01', 0, 10000, [])).toThrow(RangeError);
    expect(() => planInvoices('2026-11-01', 12, 1.5, [])).toThrow(RangeError);
  });

  it('rejects amounts whose intermediate calculation would lose integer precision', async () => {
    const { rates } = await loadVatRates();
    expect(() => planInvoices('2026-11-01', 12, Number.MAX_SAFE_INTEGER, rates)).toThrow(
      RangeError
    );
  });
});
