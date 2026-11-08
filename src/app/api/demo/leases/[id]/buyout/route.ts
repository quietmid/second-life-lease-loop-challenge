import { handleRoute, ok, readJsonBody } from '@/server/api-response';
import { buyoutInputSchema, buyoutDemoLease } from '@/server/demo-lease-outcomes';
import { db } from '@/server/db';

export const POST = handleRoute(
  async (request, { params }: RouteContext<'/api/demo/leases/[id]/buyout'>) => {
    const { id } = await params;
    const input = await readJsonBody(request, buyoutInputSchema);
    return ok(await buyoutDemoLease(db, id, input), { status: 201 });
  }
);
