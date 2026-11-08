import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ReturnButton } from '@/components/return-button';
import { LeaseEndActions } from '@/components/lease-end-actions';
import { loadCustomers } from '@/data/load';
import { assetConditionSchema, isoDateSchema, usageUnitSchema } from '@/data/schemas';
import { formatEuro } from '@/domain/money';
import { getT, messages } from '@/i18n/get-t';
import { intlLocale, isLocale } from '@/i18n/locales';
import { db } from '@/server/db';
import { todayIso } from '@/server/today';

export default async function LeasesPage({ params, searchParams }: PageProps<'/[locale]/leases'>) {
  const [{ locale }, query] = await Promise.all([params, searchParams]);
  if (!isLocale(locale)) notFound();
  const t = getT(locale);
  const customerId = typeof query.profile === 'string' ? query.profile : 'cust-aino';
  const date = typeof query.date === 'string' ? query.date : todayIso();
  const customer = (await loadCustomers()).find((entry) => entry.id === customerId);
  if (!customer || !isoDateSchema.safeParse(date).success)
    return (
      <p role="alert" className="p-8">
        {t('journey.unavailable')}
      </p>
    );
  const leases = await db.demoLease.findMany({
    where: { customer_id: customerId },
    include: {
      asset: true,
      receipt: true,
      early_exit: true,
      invoices: { orderBy: { issue_date: 'asc' } },
    },
    orderBy: { created_at: 'desc' },
  });
  const format = (cents: number) => formatEuro(cents, intlLocale[locale]);
  return (
    <div className="px-4 py-10 sm:px-8">
      <h1 className="text-4xl font-semibold">{t('nav.lease')}</h1>
      <p className="mt-2 text-[#526c61]">
        {customer.name} · {t('journey.demoOnly')}
      </p>
      {leases.length === 0 ? (
        <p className="mt-8">
          {t('journey.noLeases')}{' '}
          <Link
            className="underline"
            href={`/${locale}/catalogue?${new URLSearchParams({ profile: customerId, date })}`}
          >
            {t('nav.catalogue')}
          </Link>
        </p>
      ) : null}
      {leases.map((lease) => (
        <section key={lease.id} className="mt-8 rounded-2xl border border-[#dce4dc] bg-white p-6">
          <h2 className="text-2xl font-semibold">
            {lease.asset.make} {lease.asset.model}
          </h2>
          <p className="mt-2">
            {lease.signed_date} → {lease.end_date} · {lease.term_months} {t('journey.months')}
          </p>
          <p>
            {t('journey.monthly')}: {format(lease.monthly_net_cents)} · {t('journey.buyout')}:{' '}
            {format(lease.buyout_cents)}
          </p>
          <p>
            {t('journey.totalRent')}:{' '}
            {format(
              lease.invoices.reduce((sum, invoice) => sum + invoice.total_cents, 0) +
                lease.down_cents
            )}
          </p>
          <p className="mt-4 text-sm text-[#526c61]">{t('journey.invoiceNote')}</p>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr>
                  <th>{t('journey.issue')}</th>
                  <th>{t('journey.due')}</th>
                  <th>{t('journey.net')}</th>
                  <th>{t('journey.vat')}</th>
                  <th>{t('journey.total')}</th>
                </tr>
              </thead>
              <tbody>
                {lease.invoices.map((invoice) => (
                  <tr key={invoice.id} className="border-t border-[#e1e9e1]">
                    <td className="py-2">{invoice.issue_date}</td>
                    <td>{invoice.due_date}</td>
                    <td>{format(invoice.net_cents)}</td>
                    <td>
                      {invoice.vat_rate_percent}% · {format(invoice.vat_cents)}
                    </td>
                    <td>{format(invoice.total_cents)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-6">
            {lease.bought_out_on ? (
              <p role="status">{t('leaseEnd.boughtOutOn', { date: lease.bought_out_on })}</p>
            ) : lease.return_requested_on ? (
              lease.early_exit ? (
                <p role="status">
                  {t('leaseEnd.earlyExitComplete')} · {format(lease.early_exit.settlement_cents)}
                </p>
              ) : (
                <p role="status">
                  {t('leaseEnd.completedLeasePending', {
                    date: lease.return_requested_on ?? lease.end_date,
                  })}
                </p>
              )
            ) : date >= lease.end_date ? (
              <>
                <ReturnButton
                  leaseId={lease.id}
                  customerId={customerId}
                  date={date}
                  condition={assetConditionSchema.parse(
                    lease.receipt?.condition ?? lease.asset.condition
                  )}
                  usageValue={lease.receipt?.usage_value ?? lease.asset.usage_value}
                  usageUnit={usageUnitSchema.parse(lease.asset.usage_unit)}
                  label={t('leaseEnd.completeLease')}
                  errorMessage={t('journey.error')}
                  locale={locale}
                  messages={messages[locale]}
                />
                <LeaseEndActions
                  leaseId={lease.id}
                  customerId={customerId}
                  date={date}
                  signedDate={lease.signed_date}
                  endDate={lease.end_date}
                  condition={assetConditionSchema.parse(
                    lease.receipt?.condition ?? lease.asset.condition
                  )}
                  usageValue={lease.receipt?.usage_value ?? lease.asset.usage_value}
                  usageUnit={usageUnitSchema.parse(lease.asset.usage_unit)}
                  buyoutCents={lease.buyout_cents}
                  locale={locale}
                  messages={messages[locale]}
                />
              </>
            ) : date > lease.signed_date ? (
              <LeaseEndActions
                leaseId={lease.id}
                customerId={customerId}
                date={date}
                signedDate={lease.signed_date}
                endDate={lease.end_date}
                condition={assetConditionSchema.parse(
                  lease.receipt?.condition ?? lease.asset.condition
                )}
                usageValue={lease.receipt?.usage_value ?? lease.asset.usage_value}
                usageUnit={usageUnitSchema.parse(lease.asset.usage_unit)}
                buyoutCents={lease.buyout_cents}
                locale={locale}
                messages={messages[locale]}
              />
            ) : (
              <p>
                {t('journey.returnAfter')} {lease.end_date}
              </p>
            )}
          </div>
          <Link
            className="mt-5 inline-flex text-sm font-semibold text-[#1f5948] underline underline-offset-4"
            href={`/${locale}/transactions?${new URLSearchParams({ profile: customerId, date })}`}
          >
            {t('transactions.open')}
          </Link>
        </section>
      ))}
    </div>
  );
}
