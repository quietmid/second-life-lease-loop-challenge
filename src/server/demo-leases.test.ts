import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { loadAssets } from '@/data/load';
import { createTestDb } from '../../tests/helpers/test-db';
import { seedAssets } from './assets';
import { recordDemoSecurityAction } from './demo-security';
import { createDemoQuote, previewDemoQuote, requestDemoReturn, signDemoLease } from './demo-leases';
import type { PrismaClient } from './prisma-client';

let db: PrismaClient;
let cleanup: () => Promise<void>;
beforeAll(async () => {
  ({ db, cleanup } = await createTestDb());
});
afterAll(async () => cleanup());
beforeEach(async () => {
  await db.demoInvoice.deleteMany();
  await db.demoLease.deleteMany();
  await db.demoQuote.deleteMany();
  await db.auditLog.deleteMany();
  await db.asset.deleteMany();
  await seedAssets(db, await loadAssets());
});

const answers = {
  q_customer_type: 'consumer',
  q_full_name: 'Aino Virtanen',
  q_birth_date: '1997-04-12',
  q_email: 'aino.virtanen@example.com',
  q_country: 'FI',
  q_employment: 'employed',
  q_monthly_income: '320000',
  q_usage_purpose: 'commuting',
};

describe('persisted demo lease', () => {
  it('locks a quote, signs once, saves invoices and requests a return atomically', async () => {
    const quote = await createDemoQuote(db, {
      assetId: 'ebike-003',
      customerId: 'cust-aino',
      quoteDate: '2026-11-05',
      termMonths: 36,
      downCents: 0,
      locked: true,
    });
    const preview = await previewDemoQuote(db, quote.id, 'cust-aino', '2026-11-06');
    expect(preview.priceCents).toBe(389000);
    expect(preview.locked).toBe(true);
    await recordDemoSecurityAction(db, quote.id, {
      customerId: 'cust-aino',
      stage: 'identity',
      outcome: 'success',
    });
    const lease = await signDemoLease(db, quote.id, {
      customerId: 'cust-aino',
      signingDate: '2026-11-06',
      confirmedPriceCents: 389000,
      answers,
    });
    expect(lease.monthly_net_cents).toBe(10730);
    expect(lease.end_date).toBe('2029-11-06');
    expect(await db.demoInvoice.count({ where: { lease_id: lease.id } })).toBe(37);
    expect((await db.asset.findUniqueOrThrow({ where: { id: 'ebike-003' } })).status).toBe(
      'reserved'
    );
    await expect(
      signDemoLease(db, quote.id, {
        customerId: 'cust-aino',
        signingDate: '2026-11-06',
        confirmedPriceCents: 389000,
        answers,
      })
    ).rejects.toMatchObject({ status: 409 });
    await expect(requestDemoReturn(db, lease.id, 'cust-aino', '2029-11-05')).rejects.toMatchObject({
      status: 409,
    });
    await expect(requestDemoReturn(db, lease.id, 'cust-mikko', '2029-11-06')).rejects.toMatchObject(
      { status: 404 }
    );
    await requestDemoReturn(db, lease.id, 'cust-aino', '2029-11-06');
    await expect(requestDemoReturn(db, lease.id, 'cust-aino', '2029-11-06')).rejects.toMatchObject({
      status: 409,
    });
    expect((await db.asset.findUniqueOrThrow({ where: { id: 'ebike-003' } })).status).toBe(
      'reserved'
    );
    expect(
      (await db.auditLog.findMany({ orderBy: { id: 'asc' } })).map((entry) => entry.action)
    ).toEqual([
      'demo_quote.created',
      'demo_identity_check.success',
      'demo_lease.signed',
      'demo_return.requested',
    ]);
  });

  it('requires the latest identity check to succeed before signing', async () => {
    const quote = await createDemoQuote(db, {
      assetId: 'ebike-003',
      customerId: 'cust-aino',
      quoteDate: '2026-11-05',
      termMonths: 36,
      downCents: 0,
      locked: true,
    });
    const sign = () =>
      signDemoLease(db, quote.id, {
        customerId: 'cust-aino',
        signingDate: '2026-11-06',
        confirmedPriceCents: 389000,
        answers,
      });

    await expect(sign()).rejects.toMatchObject({ status: 409, code: 'IDENTITY_CHECK_REQUIRED' });
    await recordDemoSecurityAction(db, quote.id, {
      customerId: 'cust-aino',
      stage: 'identity',
      outcome: 'success',
    });
    const lease = await sign();
    expect(lease.customer_id).toBe('cust-aino');
  });

  it('rejects a stale confirmed price and requires a fresh confirmation', async () => {
    const quote = await createDemoQuote(db, {
      assetId: 'ebike-003',
      customerId: 'cust-aino',
      quoteDate: '2026-11-05',
      termMonths: 36,
      downCents: 0,
      locked: false,
    });
    const preview = await previewDemoQuote(db, quote.id, 'cust-aino', '2026-11-06');
    expect(preview.priceChanged).toBe(true);
    await expect(
      signDemoLease(db, quote.id, {
        customerId: 'cust-aino',
        signingDate: '2026-11-06',
        confirmedPriceCents: 389000,
        answers,
      })
    ).rejects.toMatchObject({ status: 409, code: 'PRICE_CHANGED' });
    expect(await db.demoLease.count()).toBe(0);
    expect((await db.asset.findUniqueOrThrow({ where: { id: 'ebike-003' } })).status).toBe(
      'available'
    );
  });

  it('does not reserve assets for an ineligible or incomplete application', async () => {
    const quote = await createDemoQuote(db, {
      assetId: 'ebike-003',
      customerId: 'cust-aino',
      quoteDate: '2026-11-05',
      termMonths: 36,
      downCents: 0,
      locked: true,
    });
    await expect(
      signDemoLease(db, quote.id, {
        customerId: 'cust-aino',
        signingDate: '2026-11-05',
        confirmedPriceCents: 389000,
        answers: { ...answers, q_birth_date: '2010-01-01' },
      })
    ).rejects.toMatchObject({ status: 422 });
    expect(await db.demoLease.count()).toBe(0);
    expect((await db.asset.findUniqueOrThrow({ where: { id: 'ebike-003' } })).status).toBe(
      'available'
    );
  });
});
