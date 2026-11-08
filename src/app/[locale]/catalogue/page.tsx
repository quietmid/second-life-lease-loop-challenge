// The catalogue: every asset, grouped by category, with the selected demo date's price.
import { notFound } from 'next/navigation';
import { connection } from 'next/server';
import { AssetCard } from '@/components/asset-card';
import { loadPriceLists } from '@/data/load';
import { assetCategorySchema, isoDateSchema } from '@/data/schemas';
import { listPriceOn } from '@/domain/price-list';
import { formatIsoDate } from '@/i18n/format';
import { getT } from '@/i18n/get-t';
import { isLocale } from '@/i18n/locales';
import { listAssets } from '@/server/assets';
import { db } from '@/server/db';
import { todayIso } from '@/server/today';

export default async function CataloguePage({
  params,
  searchParams,
}: PageProps<'/[locale]/catalogue'>) {
  const [{ locale }, query] = await Promise.all([params, searchParams]);
  if (!isLocale(locale)) notFound();

  // Render on every request: prices depend on today's date and on the database.
  await connection();

  const t = getT(locale);
  const queryDate = Array.isArray(query.date) ? query.date[0] : query.date;
  const profile = Array.isArray(query.profile) ? query.profile[0] : query.profile;
  const demoQuery = new URLSearchParams();
  if (queryDate) demoQuery.set('date', queryDate);
  if (profile) demoQuery.set('profile', profile);
  const parsedDate = isoDateSchema.safeParse(queryDate ?? todayIso());
  const selectedDate = parsedDate.success ? parsedDate.data : todayIso();
  const [assets, priceLists] = await Promise.all([listAssets(db), loadPriceLists()]);
  const groups = assetCategorySchema.options
    .map((category) => ({ category, assets: assets.filter((a) => a.category === category) }))
    .filter((group) => group.assets.length > 0);

  return (
    <div id="categories" className="px-4 py-10 sm:px-8 sm:py-14">
      <div className="max-w-3xl">
        <p className="text-sm font-bold uppercase tracking-[0.16em] text-[#527563]">
          {t('catalogue.eyebrow')}
        </p>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight sm:text-5xl">
          {t('catalogue.title')}
        </h1>
        <p className="mt-3 text-lg text-[#526c61]">{t('catalogue.intro')}</p>
        {parsedDate.success ? (
          <p className="mt-5 inline-flex rounded-full bg-[#e6f0e2] px-3 py-1.5 text-sm font-medium text-[#245743]">
            <time dateTime={selectedDate}>
              {t('catalogue.pricesOn', { date: formatIsoDate(selectedDate, locale) })}
            </time>
          </p>
        ) : (
          <p role="alert" className="mt-5 rounded-lg bg-rose-50 px-4 py-3 text-sm text-rose-900">
            {t('demo.invalidDate')}
          </p>
        )}
      </div>

      {groups.length === 0 ? (
        <p className="mt-10 rounded-xl border border-dashed border-[#cbd8cc] p-6 text-[#526c61]">
          {t('catalogue.empty')}
        </p>
      ) : null}

      {groups.map((group) => (
        <section
          key={group.category}
          aria-labelledby={`heading-${group.category}`}
          id={`category-${group.category}`}
          className="mt-12 scroll-mt-44"
        >
          <div className="flex items-baseline justify-between gap-4 border-b border-[#dce4dc] pb-3">
            <h2 id={`heading-${group.category}`} className="text-xl font-semibold">
              {t(`category.${group.category}`)}
            </h2>
            <p className="text-sm text-[#6c8075]">
              {t('catalogue.itemCount', { count: group.assets.length })}
            </p>
          </div>
          <ul className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {group.assets.map((asset) => (
              <li key={asset.id}>
                <AssetCard
                  asset={asset}
                  price={
                    parsedDate.success
                      ? listPriceOn(priceLists, asset.id, selectedDate)
                      : { ok: false, reason: 'no_price_list_on_date' }
                  }
                  locale={locale}
                  t={t}
                  demoQuery={profile === 'admin' ? undefined : demoQuery.toString()}
                />
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
