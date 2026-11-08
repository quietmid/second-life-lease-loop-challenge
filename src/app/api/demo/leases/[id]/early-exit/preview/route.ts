import { handleRoute, ok, readJsonBody } from '@/server/api-response';
import { earlyExitInputSchema, previewDemoEarlyExit } from '@/server/demo-early-exit';
import { db } from '@/server/db';

export const POST = handleRoute(
  async (request, { params }: RouteContext<'/api/demo/leases/[id]/early-exit/preview'>) => {
    const { id } = await params;
    const input = await readJsonBody(request, earlyExitInputSchema);
    return ok(await previewDemoEarlyExit(db, id, input));
  }
);
