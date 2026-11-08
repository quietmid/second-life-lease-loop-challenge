import { describe, expect, it } from 'vitest';
import { invoiceDisplayStatus } from './invoice-status';

describe('invoiceDisplayStatus', () => {
  const invoice = { issueDate: '2026-11-01', dueDate: '2026-11-15' };

  it('keeps future invoices upcoming until their issue date', () => {
    expect(
      invoiceDisplayStatus({
        ...invoice,
        issueDate: '2026-12-01',
        asOfDate: '2026-11-30',
        paymentStatus: 'unpaid',
      })
    ).toBe('upcoming');
  });

  it('shows unpaid invoices due or overdue based on the selected date', () => {
    expect(
      invoiceDisplayStatus({ ...invoice, asOfDate: '2026-11-15', paymentStatus: 'unpaid' })
    ).toBe('due');
    expect(
      invoiceDisplayStatus({ ...invoice, asOfDate: '2026-11-16', paymentStatus: 'unpaid' })
    ).toBe('overdue');
  });

  it('shows recorded payment as paid even when the due date has passed', () => {
    expect(
      invoiceDisplayStatus({
        ...invoice,
        asOfDate: '2026-11-20',
        paymentStatus: 'paid',
        paidOn: '2026-11-16',
      })
    ).toBe('paid');
  });

  it('replays the unpaid state before the simulated payment date', () => {
    expect(
      invoiceDisplayStatus({
        ...invoice,
        asOfDate: '2026-11-15',
        paymentStatus: 'paid',
        paidOn: '2026-11-16',
      })
    ).toBe('due');
  });
});
