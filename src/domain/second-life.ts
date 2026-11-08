import type {
  AssetCategory,
  AssetCondition,
  Co2Factors,
  CoefficientTable,
  RefurbishmentCosts,
  ResidualCurves,
  SecondLifeRequest,
  UsageUnit,
} from '@/data/schemas';
import { monthlyFactorFor } from './coefficient';
import { monthlyNetRentCents } from './pricing';

const conditionOrder: readonly AssetCondition[] = ['poor', 'fair', 'good', 'like_new', 'new'];

export type RefurbishmentStep = { id: string; costCents: number };
export type RefurbishmentPlan = {
  targetCondition: AssetCondition;
  usageAfter: number;
  steps: RefurbishmentStep[];
  costCents: number;
};

function conditionRank(condition: AssetCondition): number {
  return conditionOrder.indexOf(condition);
}

/** Calculates age from a model year using January as its synthetic manufacture month. */
export function assetAgeInMonths(modelYear: number, date: string): number {
  const match = /^(\d{4})-(\d{2})-\d{2}$/.exec(date);
  if (!match) throw new RangeError(`Invalid ISO date: ${date}`);
  return Math.max(0, (Number(match[1]) - modelYear) * 12 + Number(match[2]) - 1);
}

/** Interpolates the residual curve and applies condition and usage reductions, rounding once. */
export function estimateMarketValueCents(input: {
  originalNetPriceCents: number;
  category: AssetCategory;
  ageMonths: number;
  condition: AssetCondition;
  usageUnit: UsageUnit;
  usageValue: number;
  curves: ResidualCurves;
}): number {
  const { originalNetPriceCents, category, ageMonths, condition, usageUnit, usageValue, curves } =
    input;
  if (!Number.isSafeInteger(originalNetPriceCents) || originalNetPriceCents < 0)
    throw new RangeError('originalNetPriceCents must be non-negative whole cents');
  if (!Number.isSafeInteger(ageMonths) || ageMonths < 0)
    throw new RangeError('ageMonths must be a non-negative integer');
  if (!Number.isSafeInteger(usageValue) || usageValue < 0)
    throw new RangeError('usageValue must be a non-negative integer');

  const points = [...curves.curves[category]].sort((a, b) => a[0] - b[0]);
  const first = points[0];
  const last = points.at(-1);
  if (!first || !last) throw new RangeError(`No residual curve for ${category}`);
  let agePercent = ageMonths <= first[0] ? first[1] : last[1];
  for (let index = 1; index < points.length; index += 1) {
    const before = points[index - 1];
    const after = points[index];
    if (!before || !after) continue;
    if (ageMonths < after[0]) {
      const ageRange = after[0] - before[0];
      const progress = ageRange === 0 ? 0 : (ageMonths - before[0]) / ageRange;
      agePercent = before[1] + (after[1] - before[1]) * progress;
      break;
    }
  }

  const adjustment = curves.usage_adjustment[category];
  if (adjustment.unit !== usageUnit) throw new RangeError(`Unexpected usage unit for ${category}`);
  const usageSteps = Math.floor(usageValue / adjustment.step);
  const usagePercent = Math.max(
    adjustment.max_total_percent,
    usageSteps * adjustment.percent_per_step
  );
  const usageMultiplier = Math.max(0, 1 + usagePercent / 100);
  const value =
    originalNetPriceCents *
    (agePercent / 100) *
    curves.condition_multiplier[condition] *
    usageMultiplier;
  if (!Number.isFinite(value) || value > Number.MAX_SAFE_INTEGER)
    throw new RangeError('Market value exceeds the safe integer range');
  return Math.max(0, Math.round(value));
}

/** Plans mandatory service and the lowest-cost condition steps to reach a target condition. */
export function planRefurbishment(input: {
  category: AssetCategory;
  condition: AssetCondition;
  usageValue: number;
  targetCondition: AssetCondition;
  costs: RefurbishmentCosts;
}): RefurbishmentPlan | null {
  const { category, condition, usageValue, targetCondition, costs } = input;
  if (!Number.isSafeInteger(usageValue) || usageValue < 0)
    throw new RangeError('usageValue must be a non-negative integer');
  if (conditionRank(targetCondition) < conditionRank(condition)) return null;

  const categoryCosts = costs[category];
  const steps: RefurbishmentStep[] = [];
  let usageAfter = usageValue;
  const addFixed = (id: string) => {
    const item = categoryCosts.fixed.find((entry) => entry.id === id);
    if (!item) return;
    steps.push({ id: item.id, costCents: item.cost_cents });
    if (item.resets_usage) usageAfter = 0;
  };

  if (category === 'e_bike') {
    if (usageValue >= 15000) addFixed('battery_replacement');
    addFixed('safety_inspection');
  } else if (category === 'laptop') {
    addFixed('certified_data_wipe');
    if (usageValue >= 500) addFixed('battery_replacement');
  } else {
    const service = categoryCosts.fixed.find((entry) => entry.id === 'major_service');
    if (service) {
      const serviceCount = Math.ceil(usageValue / 1000);
      if (serviceCount > 0)
        steps.push({ id: service.id, costCents: service.cost_cents * serviceCount });
    }
    addFixed('safety_inspection');
  }

  let currentRank = conditionRank(condition);
  const targetRank = conditionRank(targetCondition);
  while (currentRank < targetRank) {
    const from = conditionOrder[currentRank];
    const to = conditionOrder[currentRank + 1];
    if (!from || !to) return null;
    const id = `${from}->${to}`;
    const costCents = categoryCosts.condition_upgrades[id];
    if (costCents === undefined) return null;
    steps.push({ id: `condition:${id}`, costCents });
    currentRank += 1;
  }

  const costCents = steps.reduce((sum, step) => sum + step.costCents, 0);
  if (!Number.isSafeInteger(costCents)) throw new RangeError('Refurbishment cost overflow');
  return { targetCondition, usageAfter, steps, costCents };
}

export type SecondLifeMatch = {
  request: SecondLifeRequest;
  plan: RefurbishmentPlan;
  marketPriceCents: number;
  monthlyNetCents: number;
  rankReason: 'deadline_then_data_pack_order';
};

/** Matches by earliest needed-by date, then original demand-list order, with least upgrade first. */
export function matchSecondLifeDemand(input: {
  category: AssetCategory;
  condition: AssetCondition;
  usageUnit: UsageUnit;
  usageValue: number;
  originalNetPriceCents: number;
  modelYear: number;
  asOfDate: string;
  requests: readonly SecondLifeRequest[];
  costs: RefurbishmentCosts;
  curves: ResidualCurves;
  coefficients: CoefficientTable;
}): SecondLifeMatch | null {
  const orderedRequests = input.requests
    .map((request, index) => ({ request, index }))
    .filter(
      ({ request }) => request.category === input.category && request.needed_by >= input.asOfDate
    )
    .sort((a, b) => a.request.needed_by.localeCompare(b.request.needed_by) || a.index - b.index);

  const targets = conditionOrder.slice(conditionRank(input.condition));
  for (const targetCondition of targets) {
    const plan = planRefurbishment({
      category: input.category,
      condition: input.condition,
      usageValue: input.usageValue,
      targetCondition,
      costs: input.costs,
    });
    if (!plan) continue;
    const marketPriceCents = estimateMarketValueCents({
      originalNetPriceCents: input.originalNetPriceCents,
      category: input.category,
      ageMonths: assetAgeInMonths(input.modelYear, input.asOfDate),
      condition: targetCondition,
      usageUnit: input.usageUnit,
      usageValue: plan.usageAfter,
      curves: input.curves,
    });

    for (const { request } of orderedRequests) {
      if (conditionRank(targetCondition) < conditionRank(request.min_condition)) continue;
      const factor = monthlyFactorFor(
        input.coefficients,
        marketPriceCents,
        request.preferred_term_months
      );
      if (!factor.ok) continue;
      const monthlyNetCents = monthlyNetRentCents(marketPriceCents, factor.factor);
      if (monthlyNetCents <= request.max_monthly_net_rent_cents) {
        return {
          request,
          plan,
          marketPriceCents,
          monthlyNetCents,
          rankReason: 'deadline_then_data_pack_order',
        };
      }
    }
  }
  return null;
}

/** A worn item's impact is discounted by its condition and remaining usage allowance. */
export function avoidedCo2Kg(input: {
  category: AssetCategory;
  condition: AssetCondition;
  usageUnit: UsageUnit;
  usageValue: number;
  reuseLives: number;
  curves: ResidualCurves;
  factors: Co2Factors;
}): number {
  const { category, condition, usageUnit, usageValue, reuseLives, curves, factors } = input;
  if (!Number.isSafeInteger(reuseLives) || reuseLives < 0)
    throw new RangeError('reuseLives must be a non-negative integer');
  const adjustment = curves.usage_adjustment[category];
  if (adjustment.unit !== usageUnit) throw new RangeError(`Unexpected usage unit for ${category}`);
  const usageSteps = Math.floor(usageValue / adjustment.step);
  const usagePercent = Math.max(
    adjustment.max_total_percent,
    usageSteps * adjustment.percent_per_step
  );
  const remainingUse = Math.max(0, 1 + usagePercent / 100);
  const usableShare = curves.condition_multiplier[condition] * remainingUse;
  const avoidedPerReuse =
    factors.manufacturing_new_kg[category] *
    Math.max(0, usableShare - factors.refurbishment_share_of_new);
  return Math.round(avoidedPerReuse * reuseLives * 100) / 100;
}
