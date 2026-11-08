import { z } from 'zod';
import {
  loadCoefficientTable,
  loadCo2Factors,
  loadPriceLists,
  loadRefurbishmentCosts,
  loadResidualCurves,
  loadSecondLifeDemand,
  loadVatRates,
} from '@/data/load';
import { planInvoices } from '@/domain/invoices';
import {
  assetCategorySchema,
  assetConditionSchema,
  isoDateSchema,
  usageUnitSchema,
} from '@/data/schemas';
import { listPriceOn } from '@/domain/price-list';
import { monthlyFactorFor } from '@/domain/coefficient';
import { monthlyNetRentCents } from '@/domain/pricing';
import {
  assetAgeInMonths,
  avoidedCo2Kg,
  estimateMarketValueCents,
  matchSecondLifeDemand,
  planRefurbishment,
} from '@/domain/second-life';
import { ApiError } from './api-response';
import { withAudit } from './audit';
import type { PrismaClient } from './prisma-client';

export const inspectionInputSchema = z.strictObject({
  leaseId: z.string().min(1).max(100).optional(),
  date: isoDateSchema,
  condition: assetConditionSchema,
  usageValue: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
});
export type InspectionInput = z.infer<typeof inspectionInputSchema>;

export const refurbishInputSchema = z.strictObject({ date: isoDateSchema });
export type RefurbishInput = z.infer<typeof refurbishInputSchema>;

export const acceptSecondLifeOfferInputSchema = z.strictObject({ date: isoDateSchema });
export type AcceptSecondLifeOfferInput = z.infer<typeof acceptSecondLifeOfferInputSchema>;

/** Records the admin's returned-item inspection, including the synthetic history-only items. */
export function inspectDemoReturn(db: PrismaClient, assetId: string, input: InspectionInput) {
  return withAudit(
    db,
    {
      actor: 'demo:admin',
      action: 'demo_return.inspected',
      entityType: 'asset',
      entityId: assetId,
      details: { ...input, simulated: true },
    },
    async (tx) => {
      const asset = await tx.asset.findUnique({ where: { id: assetId } });
      if (!asset) throw new ApiError(404, 'ASSET_NOT_FOUND', 'Demo item not found.');
      if (asset.status !== 'returned')
        throw new ApiError(409, 'ITEM_NOT_RETURNED', 'This item is not waiting for inspection.');
      if (input.usageValue < asset.usage_value)
        throw new ApiError(
          400,
          'USAGE_REGRESSION',
          'Usage cannot be lower than its current record.'
        );

      let leaseId: string | null = null;
      if (input.leaseId) {
        const lease = await tx.demoLease.findUnique({ where: { id: input.leaseId } });
        if (
          !lease ||
          lease.asset_id !== assetId ||
          !lease.return_requested_on ||
          lease.bought_out_on ||
          input.date < lease.return_requested_on
        ) {
          throw new ApiError(409, 'RETURN_NOT_READY', 'This lease is not ready for inspection.');
        }
        leaseId = lease.id;
        if (await tx.demoReturnInspection.findUnique({ where: { lease_id: lease.id } })) {
          throw new ApiError(409, 'RETURN_ALREADY_INSPECTED', 'This return was already inspected.');
        }
      } else if (await tx.demoReturnInspection.findFirst({ where: { asset_id: assetId } })) {
        throw new ApiError(409, 'RETURN_ALREADY_INSPECTED', 'This item was already inspected.');
      }

      await tx.asset.update({
        where: { id: assetId },
        data: { condition: input.condition, usage_value: input.usageValue },
      });
      return tx.demoReturnInspection.create({
        data: {
          asset_id: assetId,
          lease_id: leaseId,
          inspected_on: input.date,
          condition: input.condition,
          usage_unit: asset.usage_unit,
          usage_value: input.usageValue,
        },
      });
    }
  );
}

/** Records a synthetic waiting-list customer's explicit demo acceptance and lease. */
export async function acceptDemoSecondLifeOffer(
  db: PrismaClient,
  assetId: string,
  input: AcceptSecondLifeOfferInput
) {
  const [asset, requests, vat] = await Promise.all([
    db.asset.findUnique({ where: { id: assetId } }),
    loadSecondLifeDemand(),
    loadVatRates(),
  ]);
  if (!asset) throw new ApiError(404, 'ASSET_NOT_FOUND', 'Demo item not found.');
  if (asset.status !== 'available' || asset.current_net_price_cents === null)
    throw new ApiError(409, 'OFFER_UNAVAILABLE', 'This second-life offer is no longer available.');
  const inspection = await db.demoReturnInspection.findFirst({
    where: { asset_id: assetId },
    include: { refurbishment: true },
    orderBy: [{ inspected_on: 'desc' }, { created_at: 'desc' }],
  });
  const refurbishment = inspection?.refurbishment;
  if (!refurbishment || !refurbishment.waitlist_id || refurbishment.match_status !== 'matched')
    throw new ApiError(409, 'NO_MATCHED_OFFER', 'This item has no matched waiting-list offer.');
  const request = requests.find((entry) => entry.id === refurbishment.waitlist_id);
  if (!request || input.date > request.needed_by || input.date < refurbishment.completed_on)
    throw new ApiError(409, 'OFFER_EXPIRED', 'This waiting-list offer is outside its valid dates.');
  const schedule = planInvoices(
    input.date,
    refurbishment.term_months,
    refurbishment.monthly_net_cents,
    vat.rates
  );
  if (!schedule.ok)
    throw new ApiError(400, 'VAT_UNAVAILABLE', 'A VAT rate is unavailable for this lease.');
  const coefficients = await loadCoefficientTable();
  const buyout =
    coefficients.end_of_term_buyout_percent_of_financed[String(refurbishment.term_months)];
  if (buyout === undefined)
    throw new ApiError(400, 'INVALID_FINANCING', 'No buyout price is available for this term.');

  return withAudit(
    db,
    {
      actor: `demo:${request.id}`,
      action: 'demo_second_life.accepted',
      entityType: 'asset',
      entityId: assetId,
      details: {
        waitlistId: request.id,
        priceCents: asset.current_net_price_cents,
        monthlyNetCents: refurbishment.monthly_net_cents,
        simulated: true,
      },
    },
    async (tx) => {
      const currentAsset = await tx.asset.findUnique({ where: { id: assetId } });
      if (
        !currentAsset ||
        currentAsset.status !== 'available' ||
        currentAsset.current_net_price_cents === null
      ) {
        throw new ApiError(
          409,
          'OFFER_UNAVAILABLE',
          'This second-life offer is no longer available.'
        );
      }
      const quote = await tx.demoQuote.create({
        data: {
          asset_id: assetId,
          customer_id: request.id,
          quote_date: input.date,
          locked: true,
          term_months: refurbishment.term_months,
          down_cents: 0,
          price_cents: currentAsset.current_net_price_cents,
          price_version: 0,
        },
      });
      const lease = await tx.demoLease.create({
        data: {
          quote_id: quote.id,
          asset_id: assetId,
          customer_id: request.id,
          signed_date: input.date,
          end_date: schedule.endDate,
          term_months: refurbishment.term_months,
          list_price_cents: currentAsset.current_net_price_cents,
          down_cents: 0,
          monthly_net_cents: refurbishment.monthly_net_cents,
          buyout_cents: Math.round((currentAsset.current_net_price_cents * buyout) / 100),
          price_version: 0,
          invoices: {
            create: schedule.invoices.map((invoice) => ({
              issue_date: invoice.issueDate,
              due_date: invoice.dueDate,
              period_start: invoice.periodStart,
              period_end_exclusive: invoice.periodEndExclusive,
              net_cents: invoice.netCents,
              vat_rate_percent: invoice.vatRatePercent,
              vat_cents: invoice.vatCents,
              total_cents: invoice.totalCents,
            })),
          },
        },
        include: { invoices: { orderBy: { issue_date: 'asc' } } },
      });
      await tx.asset.update({ where: { id: assetId }, data: { status: 'reserved' } });
      return { lease, quote, waitlistCustomer: request.who };
    }
  );
}

/** Applies the computed refurbishment and waiting-list allocation atomically. */
export async function completeDemoRefurbishment(
  db: PrismaClient,
  inspectionId: string,
  input: RefurbishInput
) {
  const [inspection, costs, curves, coefficients, requests, priceLists, co2Factors] =
    await Promise.all([
      db.demoReturnInspection.findUnique({
        where: { id: inspectionId },
        include: { asset: true, refurbishment: true },
      }),
      loadRefurbishmentCosts(),
      loadResidualCurves(),
      loadCoefficientTable(),
      loadSecondLifeDemand(),
      loadPriceLists(),
      loadCo2Factors(),
    ]);
  if (!inspection) throw new ApiError(404, 'INSPECTION_NOT_FOUND', 'Inspection not found.');
  if (inspection.refurbishment)
    throw new ApiError(409, 'ALREADY_REFURBISHED', 'This item was already reconditioned.');
  if (inspection.inspected_on > input.date)
    throw new ApiError(400, 'DATE_BEFORE_INSPECTION', 'Reconditioning cannot predate inspection.');

  const firstLease = await db.demoLease.findFirst({
    where: { asset_id: inspection.asset_id },
    orderBy: [{ signed_date: 'asc' }, { created_at: 'asc' }],
    select: { list_price_cents: true },
  });
  const basePrice = firstLease
    ? { ok: true as const, priceCents: firstLease.list_price_cents }
    : listPriceOn(priceLists, inspection.asset_id, '2026-01-01');
  if (!basePrice.ok)
    throw new ApiError(400, 'PRICE_UNAVAILABLE', 'No original net price is available.');

  const category = assetCategorySchema.parse(inspection.asset.category);
  const condition = assetConditionSchema.parse(inspection.condition);
  const usageUnit = usageUnitSchema.parse(inspection.usage_unit);
  const matchingDemand = matchSecondLifeDemand({
    category,
    condition,
    usageUnit,
    usageValue: inspection.usage_value,
    originalNetPriceCents: basePrice.priceCents,
    modelYear: inspection.asset.model_year,
    asOfDate: input.date,
    requests,
    costs,
    curves,
    coefficients,
  });
  const plan =
    matchingDemand?.plan ??
    planRefurbishment({
      category,
      condition,
      usageValue: inspection.usage_value,
      targetCondition: condition,
      costs,
    });
  if (!plan) throw new ApiError(409, 'REFURBISHMENT_UNAVAILABLE', 'The item cannot be restored.');
  const marketPriceCents =
    matchingDemand?.marketPriceCents ??
    estimateMarketValueCents({
      originalNetPriceCents: basePrice.priceCents,
      category,
      ageMonths: assetAgeInMonths(inspection.asset.model_year, input.date),
      condition: plan.targetCondition,
      usageUnit,
      usageValue: plan.usageAfter,
      curves,
    });
  const termMonths = matchingDemand?.request.preferred_term_months ?? 12;
  const factor = monthlyFactorFor(coefficients, marketPriceCents, termMonths);
  if (!factor.ok)
    throw new ApiError(409, 'PRICE_UNAVAILABLE', 'The reconditioned item has no supported rent.');
  const monthlyNetCents =
    matchingDemand?.monthlyNetCents ?? monthlyNetRentCents(marketPriceCents, factor.factor);
  const selectedRequest = matchingDemand?.request ?? null;

  return withAudit(
    db,
    {
      actor: 'demo:admin',
      action: 'demo_return.refurbished_and_matched',
      entityType: 'asset',
      entityId: inspection.asset_id,
      details: {
        inspectionId,
        waitlistId: selectedRequest?.id ?? null,
        matchStatus: selectedRequest ? 'matched' : 'unassigned',
        marketPriceCents,
        monthlyNetCents,
        refurbishmentCostCents: plan.costCents,
        simulated: true,
      },
    },
    async (tx) => {
      const currentInspection = await tx.demoReturnInspection.findUnique({
        where: { id: inspectionId },
        include: { asset: true, refurbishment: true },
      });
      if (!currentInspection || currentInspection.refurbishment)
        throw new ApiError(409, 'ALREADY_REFURBISHED', 'This item was already reconditioned.');
      if (currentInspection.asset.status !== 'returned')
        throw new ApiError(409, 'ITEM_NOT_RETURNED', 'This item is not waiting for inspection.');

      const refurbishment = await tx.demoRefurbishment.create({
        data: {
          inspection_id: inspectionId,
          completed_on: input.date,
          target_condition: plan.targetCondition,
          usage_after: plan.usageAfter,
          cost_cents: plan.costCents,
          market_price_cents: marketPriceCents,
          monthly_net_cents: monthlyNetCents,
          term_months: termMonths,
          waitlist_id: selectedRequest?.id ?? null,
          match_status: selectedRequest ? 'matched' : 'unassigned',
          steps_json: JSON.stringify(plan.steps),
        },
      });
      const asset = await tx.asset.update({
        where: { id: currentInspection.asset_id },
        data: {
          status: 'available',
          condition: plan.targetCondition,
          usage_value: plan.usageAfter,
          current_net_price_cents: marketPriceCents,
          ...(currentInspection.lease_id ? { previous_lives: { increment: 1 } } : {}),
        },
      });
      const co2SavedKg = avoidedCo2Kg({
        category: assetCategorySchema.parse(asset.category),
        condition: assetConditionSchema.parse(asset.condition),
        usageUnit: usageUnitSchema.parse(asset.usage_unit),
        usageValue: asset.usage_value,
        reuseLives: asset.previous_lives,
        curves,
        factors: co2Factors,
      });
      return {
        refurbishment,
        waitlistCustomer: selectedRequest?.who ?? null,
        matchReason: matchingDemand?.rankReason ?? null,
        co2SavedKg,
        alternatives: requests
          .filter(
            (request) => request.category === asset.category && request.id !== selectedRequest?.id
          )
          .map((request) => ({
            id: request.id,
            reason:
              request.needed_by < input.date
                ? 'deadline_passed'
                : ['poor', 'fair', 'good', 'like_new', 'new'].indexOf(plan.targetCondition) <
                    ['poor', 'fair', 'good', 'like_new', 'new'].indexOf(request.min_condition)
                  ? 'condition_not_met'
                  : 'lower_priority',
          })),
      };
    }
  );
}
