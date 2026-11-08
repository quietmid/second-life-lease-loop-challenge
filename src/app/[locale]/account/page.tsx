import Link from 'next/link';
import { notFound } from 'next/navigation';
import { AssetReceiptForm } from '@/components/asset-receipt-form';
import { LeaseEndActions } from '@/components/lease-end-actions';
import { SimulateLeaseEndButton } from '@/components/simulate-lease-end-button';
import { ReturnButton } from '@/components/return-button';
import { loadCustomers } from '@/data/load';
import { assetConditionSchema, isoDateSchema, usageUnitSchema } from '@/data/schemas';
import { formatNumber } from '@/i18n/format';
import { getT, messages } from '@/i18n/get-t';
import { isLocale } from '@/i18n/locales';
import { db } from '@/server/db';
import { todayIso } from '@/server/today';

export default async function AccountPage({
  params,
  searchParams,
}: PageProps<'/[locale]/account'>) {
  const [{ locale }, query] = await Promise.all([params, searchParams]);
  if (!isLocale(locale)) notFound();
  const t = getT(locale);
  const customerId = typeof query.profile === 'string' ? query.profile : 'cust-aino';
  const date = typeof query.date === 'string' ? query.date : todayIso();
  const [customers] = await Promise.all([loadCustomers()]);
  const validDate = isoDateSchema.safeParse(date);
  const customer = customers.find((entry) => entry.id === customerId);
  if (!customer || !validDate.success) {
    return (
      <p role="alert" className="p-8">
        {t('journey.unavailable')}
      </p>
    );
  }

  const leases = await db.demoLease.findMany({
    where: { customer_id: customerId },
    include: { asset: true, receipt: true, early_exit: true },
    orderBy: { created_at: 'desc' },
  });
  const customerType =
    customer.type === 'consumer'
      ? 'consumer'
      : customer.type === 'sole_trader'
        ? 'soleTrader'
        : 'company';

  return (
    <div className="px-4 py-10 sm:px-8">
      <p className="text-sm font-bold uppercase tracking-[0.16em] text-[#527563]">
        {t('demo.customerProfile')}
      </p>
      <h1 className="mt-2 text-4xl font-semibold">{t('account.title')}</h1>
      <p className="mt-2 max-w-2xl text-sm text-[#526c61]">{t('account.demoNotice')}</p>

      <section className="mt-8 max-w-3xl rounded-2xl border border-[#dce4dc] bg-white p-6">
        <h2 className="text-xl font-semibold">{t('account.profile')}</h2>
        <dl className="mt-4 grid gap-4 sm:grid-cols-2">
          <ProfileField label={t('account.name')} value={customer.name} />
          <ProfileField
            label={t('account.customerType')}
            value={t(`account.type.${customerType}`)}
          />
          <ProfileField label={t('account.email')} value={customer.email} />
          <ProfileField
            label={t('account.location')}
            value={`${customer.city}, ${customer.country}`}
          />
          {customer.type === 'consumer' ? (
            <ProfileField
              label={t('account.employment')}
              value={t(`account.employment.${customer.employment}`)}
            />
          ) : (
            <>
              <ProfileField label={t('account.businessId')} value={customer.business_id} />
              <ProfileField
                label={t('account.vatRegistered')}
                value={customer.vat_registered ? t('account.yes') : t('account.no')}
              />
            </>
          )}
        </dl>
      </section>

      <section className="mt-10" aria-labelledby="items-title">
        <h2 id="items-title" className="text-2xl font-semibold">
          {t('account.items')}
        </h2>
        {leases.length === 0 ? (
          <p className="mt-4 rounded-xl border border-dashed border-[#cbd8cc] p-6 text-[#526c61]">
            {t('account.emptyItems')}{' '}
            <Link
              className="font-semibold text-[#1f5948] underline underline-offset-4"
              href={`/${locale}/catalogue?${new URLSearchParams({ profile: customerId, date })}`}
            >
              {t('nav.catalogue')}
            </Link>
          </p>
        ) : (
          <ul className="mt-5 grid gap-5">
            {leases.map((lease) => {
              const condition = assetConditionSchema.parse(
                lease.return_condition ?? lease.receipt?.condition ?? lease.asset.condition
              );
              const usageValue =
                lease.return_usage_value ?? lease.receipt?.usage_value ?? lease.asset.usage_value;
              const usageUnit = usageUnitSchema.parse(
                lease.receipt?.usage_unit ?? lease.asset.usage_unit
              );
              return (
                <li
                  key={lease.id}
                  className="rounded-2xl border border-[#dce4dc] bg-white p-6 shadow-sm"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-sm text-[#526c61]">{lease.asset.make}</p>
                      <h3 className="text-xl font-semibold">{lease.asset.model}</h3>
                    </div>
                    <span className="rounded-full bg-[#e6f0e2] px-3 py-1 text-xs font-semibold text-[#245743]">
                      {lease.receipt ? t('account.received') : t('account.awaitingReceipt')}
                    </span>
                  </div>
                  <p className="mt-3 text-sm text-[#526c61]">
                    {t('account.leasePeriod', { start: lease.signed_date, end: lease.end_date })}
                  </p>
                  <p className="mt-1 text-sm text-[#526c61]">{t('account.leaseSimulated')}</p>
                  <dl className="mt-4 grid gap-3 sm:grid-cols-3">
                    <ProfileField
                      label={t('condition.label')}
                      value={t(`condition.${condition}`)}
                    />
                    <ProfileField
                      label={t('asset.usage')}
                      value={t(`usage.${usageUnit}`, { value: formatNumber(usageValue, locale) })}
                    />
                    {lease.receipt ? (
                      <ProfileField
                        label={t('account.receivedDate')}
                        value={lease.receipt.received_on}
                      />
                    ) : null}
                  </dl>
                  {lease.receipt ? (
                    <p className="mt-4 text-sm text-[#526c61]">{t('account.receiptSaved')}</p>
                  ) : (
                    <AssetReceiptForm
                      leaseId={lease.id}
                      customerId={customerId}
                      date={date}
                      signedDate={lease.signed_date}
                      condition={condition}
                      usageValue={usageValue}
                      usageUnit={usageUnit}
                      locale={locale}
                      messages={messages[locale]}
                    />
                  )}
                  {lease.bought_out_on || lease.return_requested_on ? (
                    <p role="status" className="mt-4 rounded-lg bg-[#e6f0e2] p-3 text-sm">
                      {lease.early_exit
                        ? `${t('leaseEnd.earlyExitComplete')} · ${lease.return_requested_on}`
                        : lease.bought_out_on
                          ? t('leaseEnd.boughtOutOn', { date: lease.bought_out_on })
                          : t('leaseEnd.completedLeasePending', {
                              date: lease.return_requested_on ?? lease.end_date,
                            })}
                    </p>
                  ) : date >= lease.signed_date && date < lease.end_date ? (
                    <>
                      <SimulateLeaseEndButton
                        leaseId={lease.id}
                        customerId={customerId}
                        endDate={lease.end_date}
                        condition={condition}
                        usageValue={usageValue}
                        returnPath={`/${locale}/account`}
                        label={t('leaseEnd.simulateEnd')}
                        hint={t('leaseEnd.simulateEndHint', { date: lease.end_date })}
                        errorMessage={t('journey.error')}
                      />
                      {date > lease.signed_date ? (
                        <LeaseEndActions
                          leaseId={lease.id}
                          customerId={customerId}
                          date={date}
                          signedDate={lease.signed_date}
                          endDate={lease.end_date}
                          condition={condition}
                          usageValue={usageValue}
                          usageUnit={usageUnit}
                          buyoutCents={lease.buyout_cents}
                          locale={locale}
                          messages={messages[locale]}
                        />
                      ) : null}
                    </>
                  ) : date >= lease.end_date ? (
                    <div className="mt-4">
                      <ReturnButton
                        leaseId={lease.id}
                        customerId={customerId}
                        date={date}
                        condition={condition}
                        usageValue={usageValue}
                        usageUnit={usageUnit}
                        locale={locale}
                        messages={messages[locale]}
                        label={t('leaseEnd.completeLease')}
                        errorMessage={t('journey.error')}
                      />
                      <LeaseEndActions
                        leaseId={lease.id}
                        customerId={customerId}
                        date={date}
                        signedDate={lease.signed_date}
                        endDate={lease.end_date}
                        condition={condition}
                        usageValue={usageValue}
                        usageUnit={usageUnit}
                        buyoutCents={lease.buyout_cents}
                        locale={locale}
                        messages={messages[locale]}
                      />
                    </div>
                  ) : null}
                  <Link
                    className="mt-5 inline-flex text-sm font-semibold text-[#1f5948] underline underline-offset-4"
                    href={`/${locale}/leases?${new URLSearchParams({ profile: customerId, date })}`}
                  >
                    {t('account.leaseDetails')}
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}

function ProfileField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-sm text-[#6b7f74]">{label}</dt>
      <dd className="font-medium">{value}</dd>
    </div>
  );
}
