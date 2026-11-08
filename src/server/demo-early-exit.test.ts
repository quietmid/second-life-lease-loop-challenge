import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { loadAssets } from '@/data/load';
import { createTestDb } from '../../tests/helpers/test-db';
import { seedAssets } from './assets';
import { recordDemoSecurityAction } from './demo-security';
import { createDemoQuote, signDemoLease } from './demo-leases';
import { confirmDemoAssetReceipt } from './demo-receipts';
import { previewDemoEarlyExit, requestDemoEarlyExit } from './demo-early-exit';
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

describe('early exit settlement', () => {
  async function activeLease() {
    const quote = await createDemoQuote(db, {
      assetId: 'ebike-003',
      customerId: 'cust-aino',
      quoteDate: '2026-11-05',
      termMonths: 36,
      downCents: 0,
      locked: true,
    });
    await recordDemoSecurityAction(db, quote.id, {
      customerId: 'cust-aino',
      stage: 'identity',
      outcome: 'success',
    });
    const lease = await signDemoLease(db, quote.id, {
      customerId: 'cust-aino',
      signingDate: '2026-11-05',
      confirmedPriceCents: 389000,
      answers,
    });
    await confirmDemoAssetReceipt(db, lease.id, {
      customerId: 'cust-aino',
      receivedDate: '2026-11-05',
      condition: 'good',
      usageValue: 5000,
    });
    return lease;
  }

  it('shows and records the month-seven settlement while returning the asset', async () => {
    const lease = await activeLease();
    const preview = await previewDemoEarlyExit(db, lease.id, {
      customerId: 'cust-aino',
      date: '2027-06-05',
    });
    expect(preview.monthsElapsed).toBe(7);
    expect(preview.settlementCents).toBeGreaterThan(0);
    expect(preview.remainingContractValueCents).toBeGreaterThan(preview.marketValueCents);
    expect(preview.buyoutCents).toBe(58350);

    const exit = await requestDemoEarlyExit(db, lease.id, {
      customerId: 'cust-aino',
      date: '2027-06-05',
      condition: 'fair',
      usageValue: 7200,
    });
    expect(exit).toMatchObject({
      requested_on: '2027-06-05',
      months_elapsed: 7,
      settlement_cents: preview.settlementCents,
    });
    expect(await db.demoLease.findUniqueOrThrow({ where: { id: lease.id } })).toMatchObject({
      return_condition: 'fair',
      return_usage_value: 7200,
    });
    expect(await db.asset.findUniqueOrThrow({ where: { id: lease.asset_id } })).toMatchObject({
      status: 'returned',
      condition: 'good',
      usage_value: 5000,
    });
    expect(
      await db.auditLog.count({
        where: { action: 'demo_early_exit.requested', entity_id: lease.id },
      })
    ).toBe(1);
  });

  it('rejects an early exit date outside the active lease and another customer', async () => {
    const lease = await activeLease();
    await expect(
      previewDemoEarlyExit(db, lease.id, { customerId: 'cust-aino', date: lease.end_date })
    ).rejects.toMatchObject({ status: 409, code: 'NOT_EARLY_EXIT' });
    await expect(
      previewDemoEarlyExit(db, lease.id, { customerId: 'cust-mikko', date: '2027-06-05' })
    ).rejects.toMatchObject({ status: 404, code: 'LEASE_NOT_FOUND' });
    expect(await db.demoEarlyExit.count()).toBe(0);
  });
});
