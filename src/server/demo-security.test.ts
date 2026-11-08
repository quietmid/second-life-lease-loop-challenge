import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { loadAssets } from '@/data/load';
import { createTestDb } from '../../tests/helpers/test-db';
import { seedAssets } from './assets';
import { createDemoQuote } from './demo-leases';
import { recordDemoSecurityAction } from './demo-security';
import type { PrismaClient } from './prisma-client';

let db: PrismaClient;
let cleanup: () => Promise<void>;
beforeAll(async () => {
  ({ db, cleanup } = await createTestDb());
});
afterAll(async () => cleanup());
beforeEach(async () => {
  await db.demoRefurbishment.deleteMany();
  await db.demoReturnInspection.deleteMany();
  await db.demoEarlyExit.deleteMany();
  await db.demoAssetReceipt.deleteMany();
  await db.demoInvoice.deleteMany();
  await db.demoLease.deleteMany();
  await db.demoQuote.deleteMany();
  await db.auditLog.deleteMany();
  await db.asset.deleteMany();
  await seedAssets(db, await loadAssets());
});

describe('simulated identity and signing events', () => {
  async function makeQuote() {
    return createDemoQuote(db, {
      assetId: 'ebike-003',
      customerId: 'cust-aino',
      quoteDate: '2026-11-05',
      termMonths: 36,
      downCents: 0,
      locked: true,
    });
  }

  it('audits success, failure and cancellation without signing or reserving the asset', async () => {
    const quote = await makeQuote();
    await recordDemoSecurityAction(db, quote.id, {
      customerId: 'cust-aino',
      stage: 'identity',
      outcome: 'success',
    });
    await recordDemoSecurityAction(db, quote.id, {
      customerId: 'cust-aino',
      stage: 'identity',
      outcome: 'failure',
    });
    await recordDemoSecurityAction(db, quote.id, {
      customerId: 'cust-aino',
      stage: 'identity',
      outcome: 'cancelled',
    });
    await recordDemoSecurityAction(db, quote.id, {
      customerId: 'cust-aino',
      stage: 'signing',
      outcome: 'cancelled',
    });

    expect(await db.demoLease.count()).toBe(0);
    expect((await db.asset.findUniqueOrThrow({ where: { id: 'ebike-003' } })).status).toBe(
      'available'
    );
    expect(
      (await db.auditLog.findMany({ orderBy: { id: 'asc' } })).map((entry) => entry.action)
    ).toEqual([
      'demo_quote.created',
      'demo_identity_check.success',
      'demo_identity_check.failure',
      'demo_identity_check.cancelled',
      'demo_signing.cancelled',
    ]);
  });

  it('does not record an event for a quote owned by another demo customer', async () => {
    const quote = await makeQuote();
    await expect(
      recordDemoSecurityAction(db, quote.id, {
        customerId: 'cust-mikko',
        stage: 'identity',
        outcome: 'success',
      })
    ).rejects.toMatchObject({ status: 404, code: 'QUOTE_NOT_FOUND' });
    expect(await db.auditLog.count({ where: { entity_id: quote.id } })).toBe(1);
  });
});
