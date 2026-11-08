import { notFound } from 'next/navigation';
import { QuoteForm } from '@/components/quote-form';
import { loadCoefficientTable, loadCustomers, loadPriceLists } from '@/data/load';
import { isoDateSchema } from '@/data/schemas';
import { listPriceOn } from '@/domain/price-list';
import { getT, messages } from '@/i18n/get-t';
import { isLocale } from '@/i18n/locales';
import { db } from '@/server/db';
import { todayIso } from '@/server/today';

export default async function QuotePage({
  params,
  searchParams,
}: PageProps<'/[locale]/quote/[id]'>) {
  const [{ locale, id }, query] = await Promise.all([params, searchParams]);
  if (!isLocale(locale)) notFound();
  const t = getT(locale);
  const profile = typeof query.profile === 'string' ? query.profile : 'cust-aino';
  const date = typeof query.date === 'string' ? query.date : todayIso();
  const [asset, customers, priceLists, table] = await Promise.all([
    db.asset.findUnique({ where: { id } }),
    loadCustomers(),
    loadPriceLists(),
    loadCoefficientTable(),
  ]);
  if (!asset) notFound();
  const customer = customers.find((entry) => entry.id === profile);
  const validDate = isoDateSchema.safeParse(date);
  const price = validDate.success ? listPriceOn(priceLists, id, date) : null;
  return (
    <div className="px-4 py-10 sm:px-8">
      <h1 className="text-4xl font-semibold">{t('journey.quoteTitle')}</h1>
      <p className="mt-3 text-[#526c61]">
        {asset.make} {asset.model}
      </p>
      <p className="mt-2 text-sm text-[#526c61]">{t('journey.demoOnly')}</p>
      {!customer || !price?.ok || asset.status !== 'available' ? (
        <p role="alert" className="mt-6 text-red-800">
          {t('journey.unavailable')}
        </p>
      ) : (
        <QuoteForm
          assetId={id}
          customerId={customer.id}
          date={date}
          locale={locale}
          priceCents={price.priceCents}
          table={table}
          messages={messages[locale]}
        />
      )}
    </div>
  );
}
