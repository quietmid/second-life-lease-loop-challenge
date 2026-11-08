import { handleRoute, ok, readJsonBody } from '@/server/api-response';
import { earlyExitInputSchema, requestDemoEarlyExit } from '@/server/demo-early-exit';
import { db } from '@/server/db';

export const POST = handleRoute(
  async (request, { params }: RouteContext<'/api/demo/leases/[id]/early-exit'>) => {
    const { id } = await params;
    const input = await readJsonBody(request, earlyExitInputSchema);
    return ok(await requestDemoEarlyExit(db, id, input), { status: 201 });
  }
);
