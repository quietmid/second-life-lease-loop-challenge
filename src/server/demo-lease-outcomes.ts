import { z } from 'zod';
import { isoDateSchema } from '@/data/schemas';
import { ApiError } from './api-response';
import { withAudit } from './audit';
import type { PrismaClient } from './prisma-client';

const buyoutInputSchema = z.strictObject({
  customerId: z.string().min(1).max(100),
  date: isoDateSchema,
});
export type BuyoutInput = z.infer<typeof buyoutInputSchema>;

/** Transfers the item to its customer at the signed, end-of-term buyout snapshot. */
export function buyoutDemoLease(db: PrismaClient, leaseId: string, input: BuyoutInput) {
  return withAudit(
    db,
    {
      actor: `demo:${input.customerId}`,
      action: 'demo_lease.bought_out',
      entityType: 'demo_lease',
      entityId: leaseId,
      details: { date: input.date, simulated: true },
    },
    async (tx) => {
      const lease = await tx.demoLease.findUnique({ where: { id: leaseId } });
      if (!lease || lease.customer_id !== input.customerId)
        throw new ApiError(404, 'LEASE_NOT_FOUND', 'Demo lease not found.');
      if (lease.return_requested_on || lease.bought_out_on)
        throw new ApiError(
          409,
          'LEASE_CLOSED',
          'This demo lease already has an end-of-term action.'
        );
      if (input.date < lease.end_date)
        throw new ApiError(409, 'BUYOUT_UNAVAILABLE', 'Buyout is available on or after lease end.');
      await tx.demoLease.update({ where: { id: leaseId }, data: { bought_out_on: input.date } });
      await tx.asset.update({ where: { id: lease.asset_id }, data: { status: 'sold' } });
      return { leaseId, date: input.date, buyoutCents: lease.buyout_cents };
    }
  );
}

export { buyoutInputSchema };
