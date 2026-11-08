import { handleRoute, ok, readJsonBody } from '@/server/api-response';
import { db } from '@/server/db';
import { confirmDemoAssetReceipt, receiveDemoAssetInputSchema } from '@/server/demo-receipts';

export const POST = handleRoute(
  async (request, { params }: RouteContext<'/api/demo/leases/[id]/receive'>) => {
    const { id } = await params;
    const input = await readJsonBody(request, receiveDemoAssetInputSchema);
    return ok(await confirmDemoAssetReceipt(db, id, input), { status: 201 });
  }
);
