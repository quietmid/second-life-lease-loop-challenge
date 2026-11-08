import { z } from 'zod';
import { loadCoefficientTable, loadPriceLists, loadResidualCurves } from '@/data/load';
import { calculateEarlyExit } from '@/domain/early-exit';
import { monthlyFactorFor } from '@/domain/coefficient';
import { assetAgeInMonths, estimateMarketValueCents } from '@/domain/second-life';
import { listPriceOn } from '@/domain/price-list';
import { assetConditionSchema, isoDateSchema } from '@/data/schemas';
import { ApiError } from './api-response';
import { withAudit } from './audit';
import type { PrismaClient } from './prisma-client';

export const earlyExitInputSchema = z.strictObject({
  customerId: z.string().min(1).max(100),
  date: isoDateSchema,
});
export type EarlyExitInput = z.infer<typeof earlyExitInputSchema>;

export const confirmEarlyExitInputSchema = earlyExitInputSchema.extend({
  condition: assetConditionSchema,
  usageValue: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
});
export type ConfirmEarlyExitInput = z.infer<typeof confirmEarlyExitInputSchema>;

/** Returns the preview calculation without changing the lease or item. */
export async function previewDemoEarlyExit(
  db: PrismaClient,
  leaseId: string,
  input: EarlyExitInput
) {
  const lease = await db.demoLease.findUnique({
    where: { id: leaseId },
    include: { asset: true, early_exit: true, invoices: true },
  });
  if (!lease || lease.customer_id !== input.customerId)
    throw new ApiError(404, 'LEASE_NOT_FOUND', 'Demo lease not found.');
  if (lease.return_requested_on || lease.bought_out_on || lease.early_exit)
    throw new ApiError(409, 'LEASE_CLOSED', 'This demo lease already has an end-of-term action.');

  const [firstLease, curves, coefficients, priceLists] = await Promise.all([
    db.demoLease.findFirst({
      where: { asset_id: lease.asset_id },
      orderBy: [{ signed_date: 'asc' }, { created_at: 'asc' }],
      select: { list_price_cents: true, down_cents: true },
    }),
    loadResidualCurves(),
    loadCoefficientTable(),
    loadPriceLists(),
  ]);
  const initialPrice = firstLease
    ? { ok: true as const, priceCents: firstLease.list_price_cents }
    : listPriceOn(priceLists, lease.asset_id, '2026-01-01');
  if (!initialPrice.ok)
    throw new ApiError(400, 'PRICE_UNAVAILABLE', 'No original net price is available.');
  const originalFinancedCents = firstLease
    ? firstLease.list_price_cents - firstLease.down_cents
    : initialPrice.priceCents;
  const factor = monthlyFactorFor(coefficients, originalFinancedCents, lease.term_months);
  if (!factor.ok)
    throw new ApiError(400, 'INVALID_FINANCING', 'The original financing band is unavailable.');
  const marketValueCents = estimateMarketValueCents({
    originalNetPriceCents: initialPrice.priceCents,
    category: lease.asset.category as 'e_bike' | 'laptop' | 'farm_machine',
    ageMonths: assetAgeInMonths(lease.asset.model_year, input.date),
    condition: lease.asset.condition as 'new' | 'like_new' | 'good' | 'fair' | 'poor',
    usageUnit: lease.asset.usage_unit as 'km' | 'battery_cycles' | 'engine_hours',
    usageValue: lease.asset.usage_value,
    curves,
  });
  const calculation = calculateEarlyExit({
    signedDate: lease.signed_date,
    endDate: lease.end_date,
    returnDate: input.date,
    invoices: lease.invoices.map((invoice) => ({
      issueDate: invoice.issue_date,
      netCents: invoice.net_cents,
    })),
    annualInterestPercent: factor.band.annual_interest_percent,
    marketValueCents,
  });
  if (!calculation.ok)
    throw new ApiError(409, 'NOT_EARLY_EXIT', 'Choose a date after signing and before lease end.');
  return {
    ...calculation.settlement,
    annualInterestPercent: factor.band.annual_interest_percent,
    buyoutCents: lease.buyout_cents,
  };
}

/** Saves a confirmed early-exit settlement, return request and audit event atomically. */
export async function requestDemoEarlyExit(
  db: PrismaClient,
  leaseId: string,
  input: ConfirmEarlyExitInput
) {
  const preview = await previewDemoEarlyExit(db, leaseId, input);
  return withAudit(
    db,
    {
      actor: `demo:${input.customerId}`,
      action: 'demo_early_exit.requested',
      entityType: 'demo_lease',
      entityId: leaseId,
      details: {
        date: input.date,
        condition: input.condition,
        usageValue: input.usageValue,
        settlementCents: preview.settlementCents,
        marketValueCents: preview.marketValueCents,
        simulated: true,
      },
    },
    async (tx) => {
      const lease = await tx.demoLease.findUnique({
        where: { id: leaseId },
        include: { asset: true },
      });
      if (
        !lease ||
        lease.customer_id !== input.customerId ||
        lease.return_requested_on ||
        lease.bought_out_on
      ) {
        throw new ApiError(409, 'LEASE_CLOSED', 'This demo lease can no longer be ended early.');
      }
      if (!Number.isSafeInteger(input.usageValue) || input.usageValue < lease.asset.usage_value)
        throw new ApiError(
          400,
          'INVALID_RETURN_USAGE',
          'Return usage cannot be below the recorded counter.'
        );
      const result = await tx.demoEarlyExit.create({
        data: {
          lease_id: leaseId,
          requested_on: input.date,
          months_elapsed: preview.monthsElapsed,
          remaining_contract_cents: preview.remainingContractValueCents,
          market_value_cents: preview.marketValueCents,
          settlement_cents: preview.settlementCents,
        },
      });
      await tx.demoLease.update({
        where: { id: leaseId },
        data: {
          return_requested_on: input.date,
          return_condition: input.condition,
          return_usage_value: input.usageValue,
        },
      });
      await tx.asset.update({ where: { id: lease.asset_id }, data: { status: 'returned' } });
      return result;
    }
  );
}
