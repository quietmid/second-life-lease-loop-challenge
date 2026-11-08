// The root layout. Every page lives under /[locale] (/en, /fi, /sv, /et), so the
// <html lang> attribute is always right for the page.
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { AppShell } from '@/components/app-shell';
import { loadCustomers } from '@/data/load';
import { getT } from '@/i18n/get-t';
import { isLocale } from '@/i18n/locales';
import { todayIso } from '@/server/today';
import '../globals.css';

export async function generateMetadata({ params }: LayoutProps<'/[locale]'>): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const t = getT(locale);
  return {
    title: { default: t('meta.title'), template: `%s | ${t('brand.name')}` },
    description: t('meta.description'),
  };
}

export default async function LocaleLayout({ children, params }: LayoutProps<'/[locale]'>) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const t = getT(locale);
  const [customers] = await Promise.all([loadCustomers()]);

  return (
    <html lang={locale}>
      <body className="antialiased">
        <Suspense fallback={<div className="min-h-dvh bg-[#f7f7f2]" />}>
          <AppShell
            locale={locale}
            defaultDate={todayIso()}
            customers={customers.map(({ id, name }) => ({ id, name }))}
            messages={{
              brandTagline: t('brand.tagline'),
              home: t('nav.home'),
              catalogue: t('nav.catalogue'),
              account: t('nav.account'),
              lease: t('nav.lease'),
              transactions: t('nav.transactions'),
              currentLeases: t('nav.currentLeases'),
              returnedItems: t('nav.returnedItems'),
              invoiceHistory: t('nav.invoiceHistory'),
              assetHistory: t('nav.assetHistory'),
              scenarios: t('nav.scenarios'),
              endDemo: t('nav.endDemo'),
              profileLabel: t('demo.profileLabel'),
              customerProfile: t('demo.customerProfile'),
              adminProfile: t('demo.adminProfile'),
              dateLabel: t('demo.dateLabel'),
              apply: t('demo.apply'),
              demoNotice: t('demo.notice'),
              comingSoon: t('demo.comingSoon'),
              adminNotice: t('demo.adminNotice'),
              language: t('nav.language'),
              skipToContent: t('nav.skipToContent'),
              footer: t('footer.note'),
            }}
          >
            {children}
          </AppShell>
        </Suspense>
      </body>
    </html>
  );
}
