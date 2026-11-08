import { handleRoute, ok, readJsonBody } from '@/server/api-response';
import { createDemoQuote, quoteInputSchema } from '@/server/demo-leases';
import { db } from '@/server/db';

export const POST = handleRoute(async (request) => {
  const input = await readJsonBody(request, quoteInputSchema);
  return ok(await createDemoQuote(db, input), { status: 201 });
});
