import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import {
  loadCoefficientTable,
  loadCustomers,
  loadPriceLists,
  loadQuestions,
  loadVatRates,
} from '@/data/load';
import { assetCategorySchema, isoDateSchema } from '@/data/schemas';
import { evaluateApplication } from '@/domain/application';
import { monthlyFactorFor } from '@/domain/coefficient';
import { planInvoices } from '@/domain/invoices';
import { listPriceOn } from '@/domain/price-list';
import { monthlyNetRentCents } from '@/domain/pricing';
import { isQuoteLocked } from '@/domain/quote';
import { canRequestReturn } from '@/domain/return';
import { ApiError } from './api-response';
import { withAudit } from './audit';
import type { PrismaClient } from './prisma-client';

export const quoteInputSchema = z.strictObject({
  assetId: z.string().min(1).max(100),
  customerId: z.string().min(1).max(100),
  quoteDate: isoDateSchema,
  termMonths: z.union([z.literal(12), z.literal(24), z.literal(36), z.literal(48)]),
  downCents: z.number().int().min(0).max(25000000),
  locked: z.boolean(),
});
export type QuoteInput = z.infer<typeof quoteInputSchema>;

export const signInputSchema = z.strictObject({
  customerId: z.string().min(1).max(100),
  signingDate: isoDateSchema,
  confirmedPriceCents: z.number().int().nonnegative(),
  answers: z.record(z.string().regex(/^q_[a-z0-9_]+$/), z.string().max(500)),
});
export type SignInput = z.infer<typeof signInputSchema>;

export async function createDemoQuote(db: PrismaClient, input: QuoteInput) {
  const [customers, priceLists, table, asset] = await Promise.all([
    loadCustomers(),
    loadPriceLists(),
    loadCoefficientTable(),
    db.asset.findUnique({ where: { id: input.assetId } }),
  ]);
  if (!customers.some((customer) => customer.id === input.customerId)) {
    throw new ApiError(400, 'INVALID_CUSTOMER', 'Select a demo customer.');
  }
  if (!asset || asset.status !== 'available') {
    throw new ApiError(409, 'ASSET_UNAVAILABLE', 'This item is not available.');
  }
  const price = listPriceOn(priceLists, input.assetId, input.quoteDate);
  if (!price.ok)
    throw new ApiError(400, 'PRICE_UNAVAILABLE', 'No price is available on this date.');
  const factor = monthlyFactorFor(table, price.priceCents - input.downCents, input.termMonths);
  if (!factor.ok)
    throw new ApiError(
      400,
      'INVALID_FINANCING',
      'The financed amount is outside the available range.'
    );
  const quoteId = randomUUID();
  return withAudit(
    db,
    {
      actor: `demo:${input.customerId}`,
      action: 'demo_quote.created',
      entityType: 'demo_quote',
      entityId: quoteId,
      details: { assetId: input.assetId, simulated: true },
    },
    (tx) =>
      tx.demoQuote.create({
        data: {
          id: quoteId,
          asset_id: input.assetId,
          customer_id: input.customerId,
          quote_date: input.quoteDate,
          locked: input.locked,
          term_months: input.termMonths,
          down_cents: input.downCents,
          price_cents: price.priceCents,
          price_version: price.priceListVersion,
        },
      })
  );
}

export async function previewDemoQuote(
  db: PrismaClient,
  quoteId: string,
  customerId: string,
  signingDate: string
) {
  const [quote, priceLists, table, vat] = await Promise.all([
    db.demoQuote.findUnique({ where: { id: quoteId }, include: { asset: true, lease: true } }),
    loadPriceLists(),
    loadCoefficientTable(),
    loadVatRates(),
  ]);
  if (!quote || quote.customer_id !== customerId)
    throw new ApiError(404, 'QUOTE_NOT_FOUND', 'Demo quote not found.');
  if (quote.lease) throw new ApiError(409, 'QUOTE_USED', 'This quote has already been signed.');
  if (signingDate < quote.quote_date)
    throw new ApiError(400, 'DATE_BEFORE_QUOTE', 'Signing date must not be before the quote.');
  if (quote.asset.status !== 'available')
    throw new ApiError(409, 'ASSET_UNAVAILABLE', 'This item is not available.');
  const locked = isQuoteLocked(quote.quote_date, signingDate, quote.locked);
  const price = locked
    ? { ok: true as const, priceCents: quote.price_cents, priceListVersion: quote.price_version }
    : listPriceOn(priceLists, quote.asset_id, signingDate);
  if (!price.ok)
    throw new ApiError(400, 'PRICE_UNAVAILABLE', 'No price is available on this date.');
  const factor = monthlyFactorFor(table, price.priceCents - quote.down_cents, quote.term_months);
  if (!factor.ok)
    throw new ApiError(
      400,
      'INVALID_FINANCING',
      'The financed amount is outside the available range.'
    );
  const buyoutPercent = table.end_of_term_buyout_percent_of_financed[String(quote.term_months)];
  if (buyoutPercent === undefined)
    throw new ApiError(400, 'INVALID_FINANCING', 'No buyout price is available for this term.');
  const monthlyCents = monthlyNetRentCents(price.priceCents - quote.down_cents, factor.factor);
  const schedule = planInvoices(signingDate, quote.term_months, monthlyCents, vat.rates);
  if (!schedule.ok)
    throw new ApiError(
      400,
      'VAT_UNAVAILABLE',
      'A VAT rate is unavailable for this invoice schedule.'
    );
  return {
    quote,
    priceCents: price.priceCents,
    priceVersion: price.priceListVersion,
    priceChanged: price.priceCents !== quote.price_cents,
    locked,
    factor: factor.factor,
    monthlyCents,
    buyoutCents: Math.round(((price.priceCents - quote.down_cents) * buyoutPercent) / 100),
    schedule,
  };
}

export async function signDemoLease(db: PrismaClient, quoteId: string, input: SignInput) {
  const [preview, customers, questionFile] = await Promise.all([
    previewDemoQuote(db, quoteId, input.customerId, input.signingDate),
    loadCustomers(),
    loadQuestions(),
  ]);
  if (preview.priceCents !== input.confirmedPriceCents) {
    throw new ApiError(
      409,
      'PRICE_CHANGED',
      'The quote changed. Review and confirm the current price.'
    );
  }
  const customer = customers.find((entry) => entry.id === input.customerId);
  if (!customer) throw new ApiError(400, 'INVALID_CUSTOMER', 'Select a demo customer.');
  const category = assetCategorySchema.parse(preview.quote.asset.category);
  const firstInvoice = preview.schedule.invoices[0];
  if (!firstInvoice) throw new Error('Empty invoice schedule');
  const decision = evaluateApplication(
    questionFile.questions,
    {
      customer,
      category,
      financedCents: preview.priceCents - preview.quote.down_cents,
      termMonths: preview.quote.term_months,
      signingDate: input.signingDate,
      monthlyGrossCents:
        preview.monthlyCents +
        Math.round((preview.monthlyCents * firstInvoice.vatRatePercent) / 100),
    },
    input.answers
  );
  if (decision.status !== 'approved') {
    throw new ApiError(
      422,
      'APPLICATION_NOT_APPROVED',
      'The simulated application cannot be signed.',
      decision
    );
  }
  return withAudit(
    db,
    {
      actor: `demo:${input.customerId}`,
      action: 'demo_lease.signed',
      entityType: 'demo_quote',
      entityId: quoteId,
      details: { simulated: true },
    },
    async (tx) => {
      const latestIdentityAction = await tx.auditLog.findFirst({
        where: {
          actor: `demo:${input.customerId}`,
          entity_type: 'demo_quote',
          entity_id: quoteId,
          action: {
            in: [
              'demo_identity_check.success',
              'demo_identity_check.failure',
              'demo_identity_check.cancelled',
              'demo_signing.cancelled',
            ],
          },
        },
        orderBy: [{ created_at: 'desc' }, { id: 'desc' }],
      });
      if (latestIdentityAction?.action !== 'demo_identity_check.success') {
        throw new ApiError(
          409,
          'IDENTITY_CHECK_REQUIRED',
          'Complete the simulated identity check successfully before signing.'
        );
      }
      const updated = await tx.asset.updateMany({
        where: { id: preview.quote.asset_id, status: 'available' },
        data: { status: 'reserved' },
      });
      if (updated.count !== 1)
        throw new ApiError(409, 'ASSET_UNAVAILABLE', 'This item is not available.');
      const existing = await tx.demoLease.findUnique({ where: { quote_id: quoteId } });
      if (existing) throw new ApiError(409, 'QUOTE_USED', 'This quote has already been signed.');
      return tx.demoLease.create({
        data: {
          quote_id: quoteId,
          asset_id: preview.quote.asset_id,
          customer_id: input.customerId,
          signed_date: input.signingDate,
          end_date: preview.schedule.endDate,
          term_months: preview.quote.term_months,
          list_price_cents: preview.priceCents,
          down_cents: preview.quote.down_cents,
          monthly_net_cents: preview.monthlyCents,
          buyout_cents: preview.buyoutCents,
          price_version: preview.priceVersion,
          invoices: {
            create: preview.schedule.invoices.map((invoice) => ({
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
      });
    }
  );
}

export async function requestDemoReturn(
  db: PrismaClient,
  leaseId: string,
  customerId: string,
  date: string
) {
  return withAudit(
    db,
    {
      actor: `demo:${customerId}`,
      action: 'demo_return.requested',
      entityType: 'demo_lease',
      entityId: leaseId,
      details: { date, simulated: true },
    },
    async (tx) => {
      const lease = await tx.demoLease.findUnique({ where: { id: leaseId } });
      if (!lease || lease.customer_id !== customerId)
        throw new ApiError(404, 'LEASE_NOT_FOUND', 'Demo lease not found.');
      const eligible = canRequestReturn(lease.end_date, date, lease.return_requested_on !== null);
      if (!eligible.ok)
        throw new ApiError(
          409,
          'RETURN_UNAVAILABLE',
          'Return cannot be requested yet or has already been requested.'
        );
      return tx.demoLease.update({ where: { id: leaseId }, data: { return_requested_on: date } });
    }
  );
}
