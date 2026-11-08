import { z } from 'zod';
import { assetConditionSchema, isoDateSchema } from '@/data/schemas';
import { handleRoute, ok, readJsonBody } from '@/server/api-response';
import { requestDemoReturn } from '@/server/demo-leases';
import { db } from '@/server/db';

const schema = z.strictObject({
  customerId: z.string().min(1).max(100),
  date: isoDateSchema,
  condition: assetConditionSchema,
  usageValue: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
});

export const POST = handleRoute(
  async (request, { params }: RouteContext<'/api/demo/leases/[id]/return'>) => {
    const { id } = await params;
    const input = await readJsonBody(request, schema);
    return ok(
      await requestDemoReturn(
        db,
        id,
        input.customerId,
        input.date,
        input.condition,
        input.usageValue
      )
    );
  }
);
