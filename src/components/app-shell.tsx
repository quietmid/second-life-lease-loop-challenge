'use client';

import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import type { FormEvent, ReactNode } from 'react';
import { LanguageSwitcher } from '@/components/language-switcher';
import { SecondLifeMark } from '@/components/second-life-mark';
import type { Locale } from '@/i18n/locales';

export type DemoCustomer = { id: string; name: string };

export type AppShellMessages = {
  brandTagline: string;
  home: string;
  catalogue: string;
  account: string;
  lease: string;
  transactions: string;
  currentLeases: string;
  returnedItems: string;
  invoiceHistory: string;
  endDemo: string;
  profileLabel: string;
  customerProfile: string;
  adminProfile: string;
  dateLabel: string;
  apply: string;
  demoNotice: string;
  comingSoon: string;
  adminNotice: string;
  language: string;
  skipToContent: string;
  footer: string;
};

type AppShellProps = {
  children: ReactNode;
  locale: Locale;
  customers: DemoCustomer[];
  defaultDate: string;
  messages: AppShellMessages;
};

export function AppShell({ children, locale, customers, defaultDate, messages }: AppShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const profile = searchParams.get('profile') ?? customers[0]?.id ?? '';
  const isAdmin = profile === 'admin';
  const selectedDate = searchParams.get('date') ?? defaultDate;

  function applyDemoContext(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const nextParams = new URLSearchParams(searchParams.toString());
    const nextProfile = String(formData.get('profile') ?? '');
    const nextDate = String(formData.get('date') ?? '');

    if (nextProfile) nextParams.set('profile', nextProfile);
    if (nextDate) nextParams.set('date', nextDate);
    router.push(`${pathname}?${nextParams.toString()}`);
  }

  function endDemoSession() {
    const nextParams = new URLSearchParams(searchParams.toString());
    nextParams.set('profile', customers[0]?.id ?? '');
    router.push(`${pathname}?${nextParams.toString()}`);
  }

  function contextualHref(path: string) {
    const query = searchParams.toString();
    return query ? `${path}?${query}` : path;
  }

  const navItems = isAdmin
    ? [
        {
          label: messages.catalogue,
          href: `/${locale}/catalogue`,
          active: pathname.endsWith('/catalogue'),
        },
        { label: messages.currentLeases, disabled: true },
        { label: messages.returnedItems, disabled: true },
        { label: messages.invoiceHistory, disabled: true },
      ]
    : [
        { label: messages.home, href: `/${locale}`, active: pathname === `/${locale}` },
        {
          label: messages.catalogue,
          href: `/${locale}/catalogue`,
          active: pathname.endsWith('/catalogue'),
        },
        {
          label: messages.account,
          href: `/${locale}/account`,
          active: pathname === `/${locale}/account`,
        },
        {
          label: messages.lease,
          href: `/${locale}/leases`,
          active: pathname === `/${locale}/leases`,
        },
        { label: messages.transactions, disabled: true },
      ];

  return (
    <div className="min-h-dvh bg-[#f7f7f2] text-[#183b32]">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:rounded-md focus:bg-white focus:px-4 focus:py-2 focus:shadow"
      >
        {messages.skipToContent}
      </a>

      <header className="sticky top-0 z-30 border-b border-[#dce4dc] bg-[#f7f7f2]/95 backdrop-blur">
        <div className="mx-auto flex max-w-[1440px] flex-wrap items-center justify-between gap-4 px-4 py-3 sm:px-7">
          <Link href={contextualHref(`/${locale}`)} className="flex items-center gap-3 rounded-lg">
            <SecondLifeMark className="size-10 rounded-xl bg-[#1f5948] p-1.5 text-[#e8f1dc]" />
            <span>
              <span className="block text-lg font-bold tracking-tight">Second Life</span>
              <span className="hidden text-xs text-[#587167] sm:block">
                {messages.brandTagline}
              </span>
            </span>
          </Link>

          <div className="flex flex-wrap items-center justify-end gap-3">
            <span className="rounded-full border border-[#d6e0d5] bg-white px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-[#446457]">
              {messages.demoNotice}
            </span>
            <LanguageSwitcher
              current={locale}
              label={messages.language}
              query={searchParams.toString()}
            />
          </div>
        </div>
        <form
          key={`${selectedDate}:${profile}`}
          onSubmit={applyDemoContext}
          className="border-t border-[#e4e9e1] bg-white/80"
        >
          <div className="mx-auto flex max-w-[1440px] flex-wrap items-end gap-3 px-4 py-3 sm:px-7">
            <label className="grid gap-1 text-xs font-semibold text-[#526c61]">
              {messages.dateLabel}
              <input
                type="date"
                name="date"
                defaultValue={selectedDate}
                className="h-10 rounded-lg border border-[#d5dfd6] bg-white px-3 text-sm text-[#183b32]"
              />
            </label>
            <label className="grid min-w-56 gap-1 text-xs font-semibold text-[#526c61]">
              {messages.profileLabel}
              <select
                name="profile"
                defaultValue={profile}
                className="h-10 rounded-lg border border-[#d5dfd6] bg-white px-3 text-sm text-[#183b32]"
              >
                <option value="admin">{messages.adminProfile}</option>
                {customers.map((customer) => (
                  <option value={customer.id} key={customer.id}>
                    {customer.name}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="submit"
              className="h-10 rounded-lg bg-[#1f5948] px-4 text-sm font-semibold text-white transition-colors hover:bg-[#164334]"
            >
              {messages.apply}
            </button>
            <p className="basis-full text-xs text-[#6b7f74]">{messages.adminNotice}</p>
          </div>
        </form>
      </header>

      <div className="mx-auto grid min-h-[calc(100dvh-174px)] max-w-[1440px] lg:grid-cols-[232px_minmax(0,1fr)]">
        <aside className="border-b border-[#dce4dc] px-4 py-5 sm:px-7 lg:border-r lg:border-b-0 lg:px-5">
          <nav aria-label={isAdmin ? messages.adminProfile : messages.customerProfile}>
            <p className="mb-3 px-3 text-xs font-bold uppercase tracking-[0.16em] text-[#83948a]">
              {isAdmin ? messages.adminProfile : messages.customerProfile}
            </p>
            <ul className="flex gap-2 overflow-x-auto lg:flex-col">
              {navItems.map((item) => (
                <li key={item.label}>
                  {item.disabled ? (
                    <span
                      aria-disabled="true"
                      title={messages.comingSoon}
                      className="flex min-h-10 items-center whitespace-nowrap rounded-lg px-3 text-sm text-[#8b9b91]"
                    >
                      {item.label}
                      <span className="sr-only"> — {messages.comingSoon}</span>
                    </span>
                  ) : (
                    <Link
                      href={contextualHref(item.href ?? `/${locale}`)}
                      aria-current={item.active ? 'page' : undefined}
                      className={`flex min-h-10 items-center whitespace-nowrap rounded-lg px-3 text-sm font-semibold transition-colors ${
                        item.active
                          ? 'bg-[#e4eee2] text-[#174c3b]'
                          : 'text-[#526c61] hover:bg-white hover:text-[#183b32]'
                      }`}
                    >
                      {item.label}
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          </nav>
          <button
            type="button"
            onClick={endDemoSession}
            className="mt-5 min-h-10 rounded-lg px-3 text-sm font-medium text-[#526c61] hover:bg-white"
          >
            {messages.endDemo}
          </button>
          {isAdmin ? (
            <p className="mt-4 rounded-lg bg-[#f0f3e8] p-3 text-xs leading-relaxed text-[#5f7164]">
              {messages.adminNotice}
            </p>
          ) : null}
        </aside>

        <main id="main" className="min-w-0">
          {children}
        </main>
      </div>

      <footer className="border-t border-[#dce4dc] px-4 py-5 text-center text-xs text-[#718278] sm:px-7">
        {messages.footer}
      </footer>
    </div>
  );
}
