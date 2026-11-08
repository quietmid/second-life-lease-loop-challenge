import { z } from 'zod';
import { assetConditionSchema, isoDateSchema } from '@/data/schemas';
import { validateReceipt } from '@/domain/receipt';
import { ApiError } from './api-response';
import { withAudit } from './audit';
import type { PrismaClient } from './prisma-client';

export const receiveDemoAssetInputSchema = z.strictObject({
  customerId: z.string().min(1).max(100),
  receivedDate: isoDateSchema,
  condition: assetConditionSchema,
  usageValue: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
});
export type ReceiveDemoAssetInput = z.infer<typeof receiveDemoAssetInputSchema>;

/** Saves a customer's one-time delivery confirmation and audit event atomically. */
export function confirmDemoAssetReceipt(
  db: PrismaClient,
  leaseId: string,
  input: ReceiveDemoAssetInput
) {
  return withAudit(
    db,
    {
      actor: `demo:${input.customerId}`,
      action: 'demo_asset.received',
      entityType: 'demo_lease',
      entityId: leaseId,
      details: {
        receivedDate: input.receivedDate,
        condition: input.condition,
        usageValue: input.usageValue,
        simulated: true,
      },
    },
    async (tx) => {
      const lease = await tx.demoLease.findUnique({
        where: { id: leaseId },
        include: { asset: true, receipt: true },
      });
      if (!lease || lease.customer_id !== input.customerId) {
        throw new ApiError(404, 'LEASE_NOT_FOUND', 'Demo lease not found.');
      }
      if (lease.receipt) {
        throw new ApiError(409, 'ASSET_ALREADY_RECEIVED', 'This item was already received.');
      }
      if (lease.asset.status !== 'reserved') {
        throw new ApiError(409, 'ASSET_NOT_WITH_CUSTOMER', 'This item is not on an active lease.');
      }
      if (lease.return_requested_on) {
        throw new ApiError(
          409,
          'RETURN_ALREADY_REQUESTED',
          'This lease is already being returned.'
        );
      }

      const validation = validateReceipt(
        lease.signed_date,
        input.receivedDate,
        lease.asset.usage_value,
        input.usageValue
      );
      if (!validation.ok) {
        const message =
          validation.reason === 'before_lease'
            ? 'Receipt date cannot be before the lease starts.'
            : validation.reason === 'usage_below_record'
              ? "Usage cannot be below the item's recorded counter."
              : 'Usage must be a non-negative whole number.';
        throw new ApiError(400, 'INVALID_RECEIPT', message, { reason: validation.reason });
      }

      await tx.asset.update({
        where: { id: lease.asset_id },
        data: { condition: input.condition, usage_value: input.usageValue },
      });
      return tx.demoAssetReceipt.create({
        data: {
          lease_id: leaseId,
          received_on: input.receivedDate,
          condition: input.condition,
          usage_unit: lease.asset.usage_unit,
          usage_value: input.usageValue,
        },
      });
    }
  );
}
