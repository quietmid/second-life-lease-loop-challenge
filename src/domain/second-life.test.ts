import { describe, expect, it } from 'vitest';
import {
  assetAgeInMonths,
  avoidedCo2Kg,
  estimateMarketValueCents,
  matchSecondLifeDemand,
  planRefurbishment,
} from './second-life';
import {
  loadCoefficientTable,
  loadCo2Factors,
  loadRefurbishmentCosts,
  loadResidualCurves,
  loadSecondLifeDemand,
} from '@/data/load';

describe('second-life valuation and planning', () => {
  it('ages an item by whole calendar months and never gives negative age', () => {
    expect(assetAgeInMonths(2023, '2026-11-08')).toBe(46);
    expect(assetAgeInMonths(2026, '2026-11-08')).toBe(10);
    expect(assetAgeInMonths(2027, '2026-11-08')).toBe(0);
  });

  it('interpolates residual curves, caps wear adjustments and rounds cents once', async () => {
    const curves = await loadResidualCurves();
    expect(
      estimateMarketValueCents({
        originalNetPriceCents: 100000,
        category: 'e_bike',
        ageMonths: 3,
        condition: 'new',
        usageUnit: 'km',
        usageValue: 0,
        curves,
      })
    ).toBe(91000);
    expect(
      estimateMarketValueCents({
        originalNetPriceCents: 100000,
        category: 'e_bike',
        ageMonths: 120,
        condition: 'fair',
        usageUnit: 'km',
        usageValue: 100000,
        curves,
      })
    ).toBe(13000);
  });

  it('includes mandatory service, wear-based replacement, condition upgrades and resets', async () => {
    const costs = await loadRefurbishmentCosts();
    expect(
      planRefurbishment({
        category: 'e_bike',
        condition: 'fair',
        usageValue: 18400,
        targetCondition: 'good',
        costs,
      })
    ).toEqual({
      targetCondition: 'good',
      usageAfter: 0,
      steps: [
        { id: 'battery_replacement', costCents: 35000 },
        { id: 'safety_inspection', costCents: 4500 },
        { id: 'condition:fair->good', costCents: 12000 },
      ],
      costCents: 51500,
    });
    expect(
      planRefurbishment({
        category: 'e_bike',
        condition: 'fair',
        usageValue: 18400,
        targetCondition: 'poor',
        costs,
      })
    ).toBeNull();
  });

  it('selects wait-02 for ebike-007 and explains its deterministic tie break', async () => {
    const [costs, curves, coefficients, requests] = await Promise.all([
      loadRefurbishmentCosts(),
      loadResidualCurves(),
      loadCoefficientTable(),
      loadSecondLifeDemand(),
    ]);
    const match = matchSecondLifeDemand({
      category: 'e_bike',
      condition: 'fair',
      usageUnit: 'km',
      usageValue: 18400,
      originalNetPriceCents: 549000,
      modelYear: 2023,
      asOfDate: '2026-11-08',
      requests,
      costs,
      curves,
      coefficients,
    });
    expect(match).toMatchObject({
      request: { id: 'wait-02' },
      plan: { targetCondition: 'fair', usageAfter: 0, costCents: 39500 },
      rankReason: 'deadline_then_data_pack_order',
    });
    expect(match?.monthlyNetCents).toBeLessThanOrEqual(9000);
    expect(match?.request.id).not.toBe('wait-13');
  });

  it('discounts circular impact for condition and wear, then sums reuse lives', async () => {
    const [curves, factors] = await Promise.all([loadResidualCurves(), loadCo2Factors()]);
    const input = {
      category: 'e_bike' as const,
      condition: 'good' as const,
      usageUnit: 'km' as const,
      usageValue: 9800,
      curves,
      factors,
    };
    expect(avoidedCo2Kg({ ...input, reuseLives: 2 })).toBe(190.41);
    expect(avoidedCo2Kg({ ...input, condition: 'poor', reuseLives: 2 })).toBeLessThan(
      avoidedCo2Kg({ ...input, reuseLives: 2 })
    );
  });
});
