import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { loadAssets } from '@/data/load';
import { createTestDb } from '../../tests/helpers/test-db';
import { seedAssets } from './assets';
import { confirmDemoAssetReceipt } from './demo-receipts';
import { recordDemoSecurityAction } from './demo-security';
import { createDemoQuote, signDemoLease } from './demo-leases';
import type { PrismaClient } from './prisma-client';

let db: PrismaClient;
let cleanup: () => Promise<void>;
beforeAll(async () => {
  ({ db, cleanup } = await createTestDb());
});
afterAll(async () => cleanup());
beforeEach(async () => {
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

describe('customer asset receipt', () => {
  async function signedLease() {
    await db.asset.update({ where: { id: 'ebike-003' }, data: { usage_value: 50 } });
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
    return signDemoLease(db, quote.id, {
      customerId: 'cust-aino',
      signingDate: '2026-11-06',
      confirmedPriceCents: 389000,
      answers,
    });
  }

  it('records receipt details and an audit event in the same change', async () => {
    const lease = await signedLease();
    const receipt = await confirmDemoAssetReceipt(db, lease.id, {
      customerId: 'cust-aino',
      receivedDate: '2026-11-06',
      condition: 'good',
      usageValue: 250,
    });
    expect(receipt).toMatchObject({
      lease_id: lease.id,
      received_on: '2026-11-06',
      condition: 'good',
      usage_unit: 'km',
      usage_value: 250,
    });
    expect(await db.asset.findUniqueOrThrow({ where: { id: lease.asset_id } })).toMatchObject({
      condition: 'good',
      usage_value: 250,
    });
    expect(
      (await db.auditLog.findFirstOrThrow({ where: { action: 'demo_asset.received' } })).actor
    ).toBe('demo:cust-aino');
  });

  it('rejects another customer, an earlier date, lower usage, and duplicate receipt', async () => {
    const lease = await signedLease();
    const base = { receivedDate: '2026-11-06', condition: 'good' as const, usageValue: 250 };
    await expect(
      confirmDemoAssetReceipt(db, lease.id, { customerId: 'cust-mikko', ...base })
    ).rejects.toMatchObject({ status: 404 });
    await expect(
      confirmDemoAssetReceipt(db, lease.id, {
        customerId: 'cust-aino',
        ...base,
        receivedDate: '2026-11-05',
      })
    ).rejects.toMatchObject({ status: 400, code: 'INVALID_RECEIPT' });
    await expect(
      confirmDemoAssetReceipt(db, lease.id, {
        customerId: 'cust-aino',
        ...base,
        usageValue: 10,
      })
    ).rejects.toMatchObject({ status: 400, code: 'INVALID_RECEIPT' });
    await confirmDemoAssetReceipt(db, lease.id, { customerId: 'cust-aino', ...base });
    await expect(
      confirmDemoAssetReceipt(db, lease.id, { customerId: 'cust-aino', ...base })
    ).rejects.toMatchObject({ status: 409, code: 'ASSET_ALREADY_RECEIVED' });
    expect(await db.auditLog.count({ where: { action: 'demo_asset.received' } })).toBe(1);
  });
});
