import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { loadAssets } from '@/data/load';
import { createTestDb } from '../../tests/helpers/test-db';
import { seedAssets } from './assets';
import {
  acceptDemoSecondLifeOffer,
  completeDemoRefurbishment,
  inspectDemoReturn,
} from './demo-lifecycle';
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

describe('returned asset lifecycle', () => {
  it('inspects, services, matches wait-02 and makes ebike-007 available at its market price', async () => {
    const inspection = await inspectDemoReturn(db, 'ebike-007', {
      date: '2026-11-08',
      condition: 'fair',
      usageValue: 18400,
    });
    expect(inspection).toMatchObject({ condition: 'fair', usage_value: 18400 });

    const result = await completeDemoRefurbishment(db, inspection.id, { date: '2026-11-08' });
    expect(result.refurbishment).toMatchObject({
      waitlist_id: 'wait-02',
      match_status: 'matched',
      target_condition: 'fair',
      usage_after: 0,
      cost_cents: 39500,
      term_months: 12,
    });
    expect(result.alternatives).toContainEqual({ id: 'wait-13', reason: 'condition_not_met' });
    expect(result.refurbishment.monthly_net_cents).toBeLessThanOrEqual(9000);
    const accepted = await acceptDemoSecondLifeOffer(db, 'ebike-007', { date: '2026-11-08' });
    expect(accepted.waitlistCustomer).toBeTruthy();
    expect(accepted.lease).toMatchObject({
      customer_id: 'wait-02',
      asset_id: 'ebike-007',
      term_months: 12,
    });
    expect(accepted.lease.invoices).toHaveLength(13);
    expect(await db.asset.findUniqueOrThrow({ where: { id: 'ebike-007' } })).toMatchObject({
      status: 'reserved',
      condition: 'fair',
      usage_value: 0,
      current_net_price_cents: result.refurbishment.market_price_cents,
      previous_lives: 1,
    });
    expect(
      await db.auditLog.count({
        where: { action: 'demo_return.refurbished_and_matched', entity_id: 'ebike-007' },
      })
    ).toBe(1);
    await expect(
      completeDemoRefurbishment(db, inspection.id, { date: '2026-11-08' })
    ).rejects.toMatchObject({ status: 409, code: 'ALREADY_REFURBISHED' });
  });

  it('makes a returned item available even when every waiting-list deadline has passed', async () => {
    const inspection = await inspectDemoReturn(db, 'ebike-008', {
      date: '2029-01-01',
      condition: 'good',
      usageValue: 9800,
    });
    const result = await completeDemoRefurbishment(db, inspection.id, { date: '2029-01-01' });
    expect(result.refurbishment).toMatchObject({
      match_status: 'unassigned',
      waitlist_id: null,
      term_months: 12,
    });
    expect(await db.asset.findUniqueOrThrow({ where: { id: 'ebike-008' } })).toMatchObject({
      status: 'available',
      previous_lives: 2,
    });
  });

  it('rejects inspections for items that are not returned and usage regression', async () => {
    await expect(
      inspectDemoReturn(db, 'ebike-001', {
        date: '2026-11-08',
        condition: 'good',
        usageValue: 0,
      })
    ).rejects.toMatchObject({ status: 409, code: 'ITEM_NOT_RETURNED' });
    await expect(
      inspectDemoReturn(db, 'ebike-007', {
        date: '2026-11-08',
        condition: 'fair',
        usageValue: 1,
      })
    ).rejects.toMatchObject({ status: 400, code: 'USAGE_REGRESSION' });
  });
});
