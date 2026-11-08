import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getT, type MessageKey } from '@/i18n/get-t';
import { isLocale } from '@/i18n/locales';

const scenarios = [
  { number: 1, profile: 'cust-aino', date: '2026-11-05', path: '/quote/ebike-003' },
  { number: 2, profile: 'cust-aino', date: '2026-11-05', path: '/quote/laptop-004' },
  { number: 3, profile: 'cust-aino', date: '2026-09-15', path: '/quote/ebike-001' },
  { number: 4, profile: 'cust-aino', date: '2026-01-31', path: '/quote/laptop-001' },
  { number: 5, profile: 'cust-mikko', date: '2026-11-08', path: '/quote/laptop-008' },
  { number: 6, profile: 'cust-norvi', date: '2026-11-08', path: '/quote/ebike-004' },
  {
    number: 7,
    profile: 'cust-haapala',
    date: '2026-11-08',
    path: '/quote/farm-002',
    term: '48',
    down: '2000000',
  },
  { number: 8, profile: 'cust-aino', date: '2027-06-05', path: '/leases' },
  { number: 9, profile: 'admin', date: '2026-11-08', path: '/admin?tab=returns#return-ebike-007' },
  { number: 10, profile: 'admin', date: '2027-04-16', path: '/admin?tab=returns#return-ebike-008' },
];

export default async function ScenariosPage({ params }: PageProps<'/[locale]/scenarios'>) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const t = getT(locale);

  return (
    <div className="px-4 py-10 sm:px-8 sm:py-14">
      <div className="max-w-3xl">
        <p className="text-sm font-bold uppercase tracking-[0.16em] text-[#527563]">
          {t('home.eyebrow')}
        </p>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight sm:text-5xl">
          {t('scenario.title')}
        </h1>
        <p className="mt-3 text-lg text-[#526c61]">{t('scenario.intro')}</p>
      </div>
      <ol className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {scenarios.map((scenario) => {
          const query = new URLSearchParams({
            profile: scenario.profile,
            date: scenario.date,
            ...(scenario.term ? { term: scenario.term } : {}),
            ...(scenario.down ? { down: scenario.down } : {}),
          });
          const [path, hash] = scenario.path.split('#');
          const [pathname, routeQuery] = (path ?? '').split('?');
          const targetQuery = new URLSearchParams(query);
          if (routeQuery)
            new URLSearchParams(routeQuery).forEach((value, key) => targetQuery.set(key, value));
          const href = `/${locale}${pathname ?? ''}?${targetQuery.toString()}${hash ? `#${hash}` : ''}`;
          return (
            <li
              key={scenario.number}
              data-testid={`scenario-card-${scenario.number}`}
              className="flex flex-col rounded-2xl border border-[#dce4dc] bg-white p-6 shadow-sm"
            >
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#718278]">
                {String(scenario.number).padStart(2, '0')}
              </p>
              <h2 className="mt-2 text-xl font-semibold">
                {t(`scenario.card.${scenario.number}.title` as MessageKey)}
              </h2>
              <p className="mt-3 flex-1 text-sm leading-relaxed text-[#526c61]">
                {t(`scenario.card.${scenario.number}.description` as MessageKey)}
              </p>
              <Link
                href={href}
                className="mt-5 inline-flex min-h-11 items-center justify-center rounded-lg bg-[#1f5948] px-4 py-2 text-center text-sm font-semibold text-white hover:bg-[#164334] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1f5948]"
              >
                {t('scenario.open')}
              </Link>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
