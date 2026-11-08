import { handleRoute, ok, readJsonBody } from '@/server/api-response';
import { recordDemoPayment, recordDemoPaymentSchema } from '@/server/demo-invoices';
import { db } from '@/server/db';

export const POST = handleRoute(
  async (request, { params }: RouteContext<'/api/demo/invoices/[id]/pay'>) => {
    const { id } = await params;
    const input = await readJsonBody(request, recordDemoPaymentSchema);
    return ok(await recordDemoPayment(db, id, input));
  }
);
