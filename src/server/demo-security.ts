import { z } from 'zod';
import { ApiError } from './api-response';
import { withAudit } from './audit';
import type { PrismaClient } from './prisma-client';

const demoSecurityActionSchema = z.discriminatedUnion('stage', [
  z.strictObject({
    customerId: z.string().min(1).max(100),
    stage: z.literal('identity'),
    outcome: z.enum(['success', 'failure', 'cancelled']),
  }),
  z.strictObject({
    customerId: z.string().min(1).max(100),
    stage: z.literal('signing'),
    outcome: z.literal('cancelled'),
  }),
]);
export type DemoSecurityAction = z.infer<typeof demoSecurityActionSchema>;

/** Records a simulated identity/signing outcome without changing a quote or lease. */
export function recordDemoSecurityAction(
  db: PrismaClient,
  quoteId: string,
  input: DemoSecurityAction
) {
  const action =
    input.stage === 'identity' ? `demo_identity_check.${input.outcome}` : 'demo_signing.cancelled';

  return withAudit(
    db,
    {
      actor: `demo:${input.customerId}`,
      action,
      entityType: 'demo_quote',
      entityId: quoteId,
      details: { stage: input.stage, outcome: input.outcome, simulated: true },
    },
    async (tx) => {
      const quote = await tx.demoQuote.findUnique({
        where: { id: quoteId },
        include: { lease: true, asset: true },
      });
      if (!quote || quote.customer_id !== input.customerId) {
        throw new ApiError(404, 'QUOTE_NOT_FOUND', 'Demo quote not found.');
      }
      if (quote.lease || quote.asset.status !== 'available') {
        throw new ApiError(409, 'QUOTE_UNAVAILABLE', 'This demo quote can no longer continue.');
      }
      return { recorded: true as const };
    }
  );
}

export { demoSecurityActionSchema };
