import { handleRoute, ok, readJsonBody } from '@/server/api-response';
import { db } from '@/server/db';
import { demoSecurityActionSchema, recordDemoSecurityAction } from '@/server/demo-security';

export const POST = handleRoute(
  async (request, { params }: RouteContext<'/api/demo/quotes/[id]/security'>) => {
    const { id } = await params;
    const input = await readJsonBody(request, demoSecurityActionSchema);
    return ok(await recordDemoSecurityAction(db, id, input), { status: 201 });
  }
);
