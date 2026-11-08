import { handleRoute, ok, readJsonBody } from '@/server/api-response';
import { signDemoLease, signInputSchema } from '@/server/demo-leases';
import { db } from '@/server/db';

export const POST = handleRoute(
  async (request, { params }: RouteContext<'/api/demo/quotes/[id]/sign'>) => {
    const { id } = await params;
    const input = await readJsonBody(request, signInputSchema);
    return ok(await signDemoLease(db, id, input), { status: 201 });
  }
);
