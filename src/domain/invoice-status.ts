export type StoredPaymentStatus = 'unpaid' | 'paid';
export type InvoiceDisplayStatus = 'upcoming' | 'paid' | 'overdue' | 'due';
export type PaymentMethod = 'bank_transfer' | 'mobilepay' | 'card';

export function invoiceDisplayStatus(input: {
  issueDate: string;
  dueDate: string;
  asOfDate: string;
  paymentStatus: StoredPaymentStatus;
  paidOn?: string | null;
}): InvoiceDisplayStatus {
  if (input.issueDate > input.asOfDate) return 'upcoming';
  if (input.paymentStatus === 'paid' && (!input.paidOn || input.paidOn <= input.asOfDate))
    return 'paid';
  return input.dueDate < input.asOfDate ? 'overdue' : 'due';
}
