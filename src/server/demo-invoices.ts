import { z } from 'zod';
import { isoDateSchema } from '@/data/schemas';
import { ApiError } from './api-response';
import { withAudit } from './audit';
import type { PrismaClient } from './prisma-client';

export const recordDemoPaymentSchema = z.strictObject({
  customerId: z.string().min(1).max(100),
  date: isoDateSchema,
  method: z.enum(['bank_transfer', 'mobilepay', 'card']),
});
export type RecordDemoPaymentInput = z.infer<typeof recordDemoPaymentSchema>;

/** Records a mock payment; no payment provider or external funds are involved. */
export function recordDemoPayment(
  db: PrismaClient,
  invoiceId: string,
  input: RecordDemoPaymentInput
) {
  return withAudit(
    db,
    {
      actor: `demo:${input.customerId}`,
      action: 'demo_invoice.payment_recorded',
      entityType: 'demo_invoice',
      entityId: invoiceId,
      details: { method: input.method, date: input.date, simulated: true },
    },
    async (tx) => {
      const invoice = await tx.demoInvoice.findUnique({
        where: { id: invoiceId },
        include: { lease: true },
      });
      if (!invoice || invoice.lease.customer_id !== input.customerId)
        throw new ApiError(404, 'INVOICE_NOT_FOUND', 'Demo invoice not found.');
      if (invoice.issue_date > input.date)
        throw new ApiError(409, 'INVOICE_NOT_ISSUED', 'This invoice has not been issued yet.');
      if (invoice.payment_status === 'paid')
        throw new ApiError(409, 'INVOICE_ALREADY_PAID', 'This invoice is already marked paid.');
      return tx.demoInvoice.update({
        where: { id: invoiceId },
        data: { payment_status: 'paid', payment_method: input.method, paid_on: input.date },
      });
    }
  );
}
