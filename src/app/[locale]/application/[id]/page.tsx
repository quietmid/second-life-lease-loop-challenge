import { notFound } from 'next/navigation';
import { ApplicationForm } from '@/components/application-form';
import { loadCustomers, loadQuestions } from '@/data/load';
import { assetCategorySchema, isoDateSchema } from '@/data/schemas';
import { formatEuro } from '@/domain/money';
import { quoteLockExpiry } from '@/domain/quote';
import { getT, messages } from '@/i18n/get-t';
import { intlLocale, isLocale } from '@/i18n/locales';
import { ApiError } from '@/server/api-response';
import { previewDemoQuote } from '@/server/demo-leases';
import { db } from '@/server/db';
import { todayIso } from '@/server/today';

export default async function ApplicationPage({
  params,
  searchParams,
}: PageProps<'/[locale]/application/[id]'>) {
  const [{ locale, id }, query] = await Promise.all([params, searchParams]);
  if (!isLocale(locale)) notFound();
  const t = getT(locale);
  const customerId = typeof query.profile === 'string' ? query.profile : 'cust-aino';
  const date = typeof query.date === 'string' ? query.date : todayIso();
  const validDate = isoDateSchema.safeParse(date);
  const [customers, questionFile] = await Promise.all([loadCustomers(), loadQuestions()]);
  const customer = customers.find((entry) => entry.id === customerId);
  if (!customer || !validDate.success)
    return (
      <p role="alert" className="p-8">
        {t('journey.unavailable')}
      </p>
    );
  let preview;
  try {
    preview = await previewDemoQuote(db, id, customerId, date);
  } catch (error) {
    if (!(error instanceof ApiError)) throw error;
    return (
      <p role="alert" className="p-8">
        {t('journey.unavailable')}
      </p>
    );
  }
  const category = assetCategorySchema.parse(preview.quote.asset.category);
  const first = preview.schedule.invoices[0];
  if (!first) throw new Error('Empty invoice schedule');
  const format = (cents: number) => formatEuro(cents, intlLocale[locale]);
  return (
    <div className="px-4 py-10 sm:px-8">
      <h1 className="text-4xl font-semibold">{t('journey.applicationTitle')}</h1>
      <p className="mt-3 text-[#526c61]">
        {preview.quote.asset.make} {preview.quote.asset.model} · {customer.name}
      </p>
      <div className="mt-6 max-w-3xl rounded-xl bg-[#e6f0e2] p-5">
        <p>
          {t('journey.term')}:{' '}
          <strong>
            {preview.quote.term_months} {t('journey.months')}
          </strong>
        </p>
        <p>
          {t('journey.listPrice')}: <strong>{format(preview.priceCents)}</strong>
        </p>
        <p>
          {t('journey.down')}: <strong>{format(preview.quote.down_cents)}</strong>
        </p>
        <p>
          {t('journey.financed')}:{' '}
          <strong>{format(preview.priceCents - preview.quote.down_cents)}</strong>
        </p>
        <p>
          {t('journey.monthly')}: <strong>{format(preview.monthlyCents)}</strong>
        </p>
        <p>
          {t('journey.buyout')}: <strong>{format(preview.buyoutCents)}</strong>
        </p>
        <p>
          {t('journey.totalRent')}:{' '}
          <strong>
            {format(
              preview.quote.down_cents +
                preview.schedule.invoices.reduce((sum, invoice) => sum + invoice.totalCents, 0)
            )}
          </strong>
        </p>
        <p className="mt-2 text-sm">{t('journey.invoiceNote')}</p>
        <p className="mt-2 text-sm">
          {preview.locked ? t('journey.locked') : t('journey.repriced')}
        </p>
        {preview.quote.locked ? (
          <p className="text-sm">
            {t('journey.lockExpiry').replace('{date}', quoteLockExpiry(preview.quote.quote_date))}
          </p>
        ) : null}
        {preview.priceChanged ? (
          <p className="mt-2 font-semibold">{t('journey.priceChanged')}</p>
        ) : null}
      </div>
      <ApplicationForm
        quoteId={id}
        customerId={customerId}
        date={date}
        locale={locale}
        priceCents={preview.priceCents}
        questions={questionFile.questions}
        messages={messages[locale]}
        context={{
          customer,
          category,
          financedCents: preview.priceCents - preview.quote.down_cents,
          termMonths: preview.quote.term_months,
          signingDate: date,
          monthlyGrossCents:
            preview.monthlyCents + Math.round((preview.monthlyCents * first.vatRatePercent) / 100),
        }}
      />
    </div>
  );
}
