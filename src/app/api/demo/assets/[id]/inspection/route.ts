import { handleRoute, ok, readJsonBody } from '@/server/api-response';
import { inspectionInputSchema, inspectDemoReturn } from '@/server/demo-lifecycle';
import { db } from '@/server/db';

export const POST = handleRoute(
  async (request, { params }: RouteContext<'/api/demo/assets/[id]/inspection'>) => {
    const { id } = await params;
    const input = await readJsonBody(request, inspectionInputSchema);
    return ok(await inspectDemoReturn(db, id, input), { status: 201 });
  }
);
