import { handleRoute, ok, readJsonBody } from '@/server/api-response';
import { db } from '@/server/db';
import {
  acceptDemoSecondLifeOffer,
  acceptSecondLifeOfferInputSchema,
} from '@/server/demo-lifecycle';

export const POST = handleRoute(
  async (request, { params }: RouteContext<'/api/demo/assets/[id]/accept-offer'>) => {
    const { id } = await params;
    const input = await readJsonBody(request, acceptSecondLifeOfferInputSchema);
    return ok(await acceptDemoSecondLifeOffer(db, id, input), { status: 201 });
  }
);
