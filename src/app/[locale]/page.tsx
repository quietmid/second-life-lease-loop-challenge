import Link from 'next/link';
import { notFound } from 'next/navigation';
import { connection } from 'next/server';
import { SecondLifeMark } from '@/components/second-life-mark';
import { loadCoefficientTable, loadPriceLists } from '@/data/load';
import { assetCategorySchema, isoDateSchema } from '@/data/schemas';
import { monthlyFactorFor } from '@/domain/coefficient';
import { formatEuro } from '@/domain/money';
import { listPriceOn } from '@/domain/price-list';
import { monthlyNetRentCents } from '@/domain/pricing';
import { formatIsoDate } from '@/i18n/format';
import { getT } from '@/i18n/get-t';
import { intlLocale, isLocale } from '@/i18n/locales';
import { listAssets } from '@/server/assets';
import { db } from '@/server/db';
import { todayIso } from '@/server/today';

const featuredAssetIds = ['ebike-003', 'laptop-001', 'farm-001'];

export default async function HomePage({ params, searchParams }: PageProps<'/[locale]'>) {
  const [{ locale }, query] = await Promise.all([params, searchParams]);
  if (!isLocale(locale)) notFound();

  await connection();
  const t = getT(locale);
  const queryDate = Array.isArray(query.date) ? query.date[0] : query.date;
  const queryProfile = Array.isArray(query.profile) ? query.profile[0] : query.profile;
  const demoParams = new URLSearchParams();
  if (queryDate) demoParams.set('date', queryDate);
  if (queryProfile) demoParams.set('profile', queryProfile);
  const catalogueUrl = `/${locale}/catalogue${demoParams.size ? `?${demoParams}` : ''}`;
  const parsedDate = isoDateSchema.safeParse(queryDate ?? todayIso());
  const selectedDate = parsedDate.success ? parsedDate.data : todayIso();
  const [assets, priceLists, coefficientTable] = await Promise.all([
    listAssets(db),
    loadPriceLists(),
    loadCoefficientTable(),
  ]);
  const featuredAssets = featuredAssetIds
    .map((id) => assets.find((asset) => asset.id === id && asset.status === 'available'))
    .filter((asset) => asset !== undefined);

  return (
    <div className="px-4 py-8 sm:px-8 sm:py-12">
      <section
        aria-labelledby="home-title"
        className="relative isolate overflow-hidden rounded-[2rem] bg-[#173f34] px-6 py-12 text-[#f5f4e9] sm:px-10 sm:py-16 xl:px-16"
      >
        <SecondLifeMark
          animation="entrance"
          className="pointer-events-none absolute -right-20 -top-20 -z-10 size-[26rem] text-[#c8d9b2]/10 sm:right-0 sm:top-1/2 sm:size-[34rem] sm:-translate-y-1/2"
        />
        <div className="relative max-w-3xl">
          <p className="text-sm font-bold uppercase tracking-[0.2em] text-[#c3d6a7]">
            {t('home.eyebrow')}
          </p>
          <h1
            id="home-title"
            className="mt-5 text-5xl leading-[0.98] font-semibold tracking-[-0.05em] sm:text-7xl"
          >
            {t('home.title')}
            <span className="mt-2 block text-[#c3d6a7]">{t('brand.name')}</span>
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-relaxed text-[#e1e9d8] sm:text-xl">
            {t('home.description')}
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href={`${catalogueUrl}#categories`}
              className="rounded-full bg-[#d7e5bd] px-6 py-3 text-sm font-bold text-[#183f34] transition-colors hover:bg-white"
            >
              {t('home.browse')}
            </Link>
          </div>
          <p className="mt-6 text-sm text-[#cad8c6]">
            {parsedDate.success
              ? t('home.pricesAsOf', { date: formatIsoDate(selectedDate, locale) })
              : t('demo.invalidDate')}
          </p>
        </div>
        <div className="mt-12 grid max-w-3xl grid-cols-3 gap-3 border-t border-white/20 pt-5 text-xs font-medium text-[#d9e3d2] sm:text-sm">
          <p>{t('home.loopStepOne')}</p>
          <p>{t('home.loopStepTwo')}</p>
          <p>{t('home.loopStepThree')}</p>
        </div>
      </section>

      <section
        aria-labelledby="rates-title"
        className="grid gap-8 py-14 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] lg:items-end"
      >
        <div>
          <p className="text-sm font-bold uppercase tracking-[0.16em] text-[#527563]">
            {t('home.ratesEyebrow')}
          </p>
          <h2 id="rates-title" className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
            {t('home.ratesTitle')}
          </h2>
          <p className="mt-4 max-w-xl leading-relaxed text-[#526c61]">{t('home.ratesIntro')}</p>
          <p className="mt-4 text-sm text-[#73867b]">{t('home.ratesDisclaimer')}</p>
        </div>

        <ul className="grid gap-3 sm:grid-cols-3">
          {featuredAssets.map((asset) => {
            const price = parsedDate.success
              ? listPriceOn(priceLists, asset.id, selectedDate)
              : { ok: false as const, reason: 'no_price_list_on_date' as const };
            const factor =
              price.ok && parsedDate.success
                ? monthlyFactorFor(coefficientTable, price.priceCents, 12)
                : { ok: false as const, reason: 'below_minimum' as const };
            const monthlyCents =
              price.ok && factor.ok ? monthlyNetRentCents(price.priceCents, factor.factor) : null;

            return (
              <li
                key={asset.id}
                className="flex min-h-56 flex-col rounded-2xl border border-[#dce4dc] bg-white p-5 shadow-[0_8px_24px_rgba(27,65,52,0.05)]"
              >
                <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#668071]">
                  {t(`category.${asset.category}`)}
                </p>
                <p className="mt-4 text-sm text-[#667d70]">{asset.make}</p>
                <h3 className="text-lg font-semibold leading-snug">{asset.model}</h3>
                <p className="mt-auto pt-6 text-xs text-[#718278]">{t('home.termAndVat')}</p>
                <p className="mt-1 text-2xl font-semibold tabular-nums tracking-tight">
                  {monthlyCents === null
                    ? t('home.rateUnavailable')
                    : formatEuro(monthlyCents, intlLocale[locale])}
                  {monthlyCents !== null ? (
                    <span className="ml-1 text-sm font-medium text-[#718278]">
                      {t('home.perMonth')}
                    </span>
                  ) : null}
                </p>
              </li>
            );
          })}
        </ul>
      </section>

      <section
        id="categories"
        aria-labelledby="categories-title"
        className="scroll-mt-44 border-t border-[#dce4dc] py-12"
      >
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.16em] text-[#527563]">
              {t('home.categoriesEyebrow')}
            </p>
            <h2 id="categories-title" className="mt-3 text-3xl font-semibold tracking-tight">
              {t('home.categoriesTitle')}
            </h2>
          </div>
          <Link
            href={`${catalogueUrl}#categories`}
            className="text-sm font-bold text-[#1f5948] underline decoration-[#9eb89d] underline-offset-4 hover:text-[#123e30]"
          >
            {t('home.allCategories')}
          </Link>
        </div>
        <ul className="mt-6 grid gap-4 md:grid-cols-3">
          {assetCategorySchema.options.map((category, index) => (
            <li key={category}>
              <Link
                href={`${catalogueUrl}#category-${category}`}
                className="group flex min-h-36 items-end justify-between rounded-2xl border border-[#dce4dc] bg-[#edf1e8] p-5 transition-transform hover:-translate-y-1 hover:bg-[#e4ecdd]"
              >
                <span>
                  <span className="block text-xs font-bold uppercase tracking-[0.14em] text-[#74877a]">
                    {t('home.categoryNumber', { number: `0${index + 1}` })}
                  </span>
                  <span className="mt-2 block text-xl font-semibold text-[#214b3b]">
                    {t(`category.${category}`)}
                  </span>
                </span>
                <span
                  aria-hidden="true"
                  className="text-3xl text-[#64836d] transition-transform group-hover:translate-x-1"
                >
                  ↗
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
