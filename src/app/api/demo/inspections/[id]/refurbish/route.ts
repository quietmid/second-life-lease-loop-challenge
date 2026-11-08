import { handleRoute, ok, readJsonBody } from '@/server/api-response';
import { refurbishInputSchema, completeDemoRefurbishment } from '@/server/demo-lifecycle';
import { db } from '@/server/db';

export const POST = handleRoute(
  async (request, { params }: RouteContext<'/api/demo/inspections/[id]/refurbish'>) => {
    const { id } = await params;
    const input = await readJsonBody(request, refurbishInputSchema);
    return ok(await completeDemoRefurbishment(db, id, input), { status: 201 });
  }
);
