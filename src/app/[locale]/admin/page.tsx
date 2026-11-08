import { notFound } from 'next/navigation';
import { loadCustomers } from '@/data/load';
import { assetConditionSchema, isoDateSchema, usageUnitSchema } from '@/data/schemas';
import { formatNumber } from '@/i18n/format';
import { getT } from '@/i18n/get-t';
import { intlLocale, isLocale } from '@/i18n/locales';
import { formatEuro } from '@/domain/money';
import { listAuditLog } from '@/server/audit';
import { db } from '@/server/db';
import { todayIso } from '@/server/today';

type AdminTab = 'leases' | 'returns' | 'invoices' | 'passports';

export default async function AdminPage({ params, searchParams }: PageProps<'/[locale]/admin'>) {
  const [{ locale }, query] = await Promise.all([params, searchParams]);
  if (!isLocale(locale)) notFound();
  const t = getT(locale);
  const profile = typeof query.profile === 'string' ? query.profile : '';
  const date = typeof query.date === 'string' ? query.date : todayIso();
  const tab = parseTab(query.tab);
  const validDate = isoDateSchema.safeParse(date);

  if (profile !== 'admin') {
    return (
      <div className="px-4 py-10 sm:px-8">
        <h1 className="text-4xl font-semibold">{t('admin.title')}</h1>
        <p role="alert" className="mt-4 rounded-xl bg-amber-50 p-5 text-amber-950">
          {t('admin.selectAdmin')}
        </p>
      </div>
    );
  }
  if (!validDate.success) {
    return (
      <p role="alert" className="p-8">
        {t('demo.invalidDate')}
      </p>
    );
  }

  const [customers, leases, assets, audit] = await Promise.all([
    loadCustomers(),
    db.demoLease.findMany({
      include: { asset: true, receipt: true, invoices: { orderBy: { issue_date: 'asc' } } },
      orderBy: [{ asset_id: 'asc' }, { signed_date: 'asc' }],
    }),
    db.asset.findMany({
      where: { OR: [{ previous_lives: { gt: 0 } }, { leases: { some: {} } }] },
      include: { leases: { include: { receipt: true }, orderBy: { signed_date: 'asc' } } },
      orderBy: { id: 'asc' },
    }),
    listAuditLog(db, 30),
  ]);
  const customerNames = new Map(customers.map((customer) => [customer.id, customer.name]));
  const activeLeases = leases.filter(
    (lease) =>
      lease.signed_date <= date &&
      lease.end_date > date &&
      (!lease.return_requested_on || lease.return_requested_on > date)
  );
  const returnRequests = leases.filter(
    (lease) => lease.return_requested_on !== null && lease.return_requested_on <= date
  );
  const invoiceRows = leases.flatMap((lease) =>
    lease.invoices.map((invoice) => ({ lease, invoice }))
  );
  const format = (cents: number) => formatEuro(cents, intlLocale[locale]);

  return (
    <div className="px-4 py-10 sm:px-8">
      <p className="text-sm font-bold uppercase tracking-[0.16em] text-[#527563]">
        {t('demo.adminProfile')}
      </p>
      <h1 className="mt-2 text-4xl font-semibold">{t('admin.title')}</h1>
      <p className="mt-2 max-w-3xl text-sm text-[#526c61]">{t('admin.notice')}</p>

      {tab === 'leases' ? (
        <section className="mt-8" aria-labelledby="admin-leases-title">
          <h2 id="admin-leases-title" className="text-2xl font-semibold">
            {t('admin.currentLeases')}
          </h2>
          {activeLeases.length === 0 ? (
            <p className="mt-4 rounded-xl border border-dashed border-[#cbd8cc] p-6 text-[#526c61]">
              {t('admin.noCurrentLeases')}
            </p>
          ) : (
            <div className="mt-5 grid gap-5">
              {[...new Set(activeLeases.map((lease) => lease.customer_id))].map((customerId) => (
                <section
                  key={customerId}
                  className="rounded-2xl border border-[#dce4dc] bg-white p-6"
                >
                  <h3 className="text-xl font-semibold">
                    {customerNames.get(customerId) ?? customerId}
                  </h3>
                  <ul className="mt-4 grid gap-3">
                    {activeLeases
                      .filter((lease) => lease.customer_id === customerId)
                      .map((lease) => (
                        <li key={lease.id} className="rounded-xl bg-[#f5f7f0] p-4">
                          <p className="font-semibold">
                            {lease.asset.make} {lease.asset.model}
                          </p>
                          <p className="mt-1 text-sm text-[#526c61]">
                            {t('admin.leasePeriod')}: {lease.signed_date} → {lease.end_date} ·{' '}
                            {lease.term_months} {t('journey.months')}
                          </p>
                          <p className="mt-1 text-sm text-[#526c61]">
                            {t('admin.monthlyNet')}: {format(lease.monthly_net_cents)}
                          </p>
                        </li>
                      ))}
                  </ul>
                </section>
              ))}
            </div>
          )}
        </section>
      ) : null}

      {tab === 'returns' ? (
        <section className="mt-8" aria-labelledby="admin-returns-title">
          <h2 id="admin-returns-title" className="text-2xl font-semibold">
            {t('admin.returnedItems')}
          </h2>
          {returnRequests.length === 0 ? (
            <p className="mt-4 rounded-xl border border-dashed border-[#cbd8cc] p-6 text-[#526c61]">
              {t('admin.noReturns')}
            </p>
          ) : (
            <ul className="mt-5 grid gap-4">
              {returnRequests.map((lease) => (
                <li key={lease.id} className="rounded-2xl border border-[#dce4dc] bg-white p-6">
                  <h3 className="text-xl font-semibold">
                    {lease.asset.make} {lease.asset.model}
                  </h3>
                  <p className="mt-1 text-sm text-[#526c61]">
                    {t('admin.customer')}:{' '}
                    {customerNames.get(lease.customer_id) ?? lease.customer_id}
                  </p>
                  <p className="mt-1 text-sm text-[#526c61]">
                    {t('admin.requestedOn')}: {lease.return_requested_on}
                  </p>
                  <dl className="mt-4 grid gap-3 sm:grid-cols-3">
                    <DataField
                      label={t('admin.returnState')}
                      value={t('admin.awaitingInspection')}
                    />
                    <DataField
                      label={t('admin.refurbishmentStatus')}
                      value={t('admin.notAssessed')}
                    />
                    <DataField
                      label={t('admin.nextLifeStatus')}
                      value={t('admin.pendingAvailability')}
                    />
                  </dl>
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}

      {tab === 'invoices' ? (
        <section className="mt-8" aria-labelledby="admin-invoices-title">
          <h2 id="admin-invoices-title" className="text-2xl font-semibold">
            {t('admin.invoiceHistory')}
          </h2>
          {invoiceRows.length === 0 ? (
            <p className="mt-4 rounded-xl border border-dashed border-[#cbd8cc] p-6 text-[#526c61]">
              {t('journey.noLeases')}
            </p>
          ) : (
            <div className="mt-5 overflow-x-auto rounded-2xl border border-[#dce4dc] bg-white p-4">
              <table className="w-full min-w-[760px] text-left text-sm">
                <thead>
                  <tr>
                    <th className="p-2">{t('admin.customer')}</th>
                    <th className="p-2">{t('admin.item')}</th>
                    <th className="p-2">{t('journey.issue')}</th>
                    <th className="p-2">{t('journey.due')}</th>
                    <th className="p-2">{t('journey.net')}</th>
                    <th className="p-2">{t('journey.vat')}</th>
                    <th className="p-2">{t('journey.total')}</th>
                    <th className="p-2">{t('admin.invoiceStatus')}</th>
                  </tr>
                </thead>
                <tbody>
                  {invoiceRows.map(({ lease, invoice }) => (
                    <tr key={invoice.id} className="border-t border-[#e1e9e1]">
                      <td className="p-2">
                        {customerNames.get(lease.customer_id) ?? lease.customer_id}
                      </td>
                      <td className="p-2">
                        {lease.asset.make} {lease.asset.model}
                      </td>
                      <td className="p-2">{invoice.issue_date}</td>
                      <td className="p-2">{invoice.due_date}</td>
                      <td className="p-2">{format(invoice.net_cents)}</td>
                      <td className="p-2">
                        {invoice.vat_rate_percent}% · {format(invoice.vat_cents)}
                      </td>
                      <td className="p-2">{format(invoice.total_cents)}</td>
                      <td className="p-2">{t('admin.paymentNotTracked')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      ) : null}

      {tab === 'passports' ? (
        <section className="mt-8" aria-labelledby="admin-passports-title">
          <h2 id="admin-passports-title" className="text-2xl font-semibold">
            {t('admin.passports')}
          </h2>
          {assets.length === 0 ? (
            <p className="mt-4 rounded-xl border border-dashed border-[#cbd8cc] p-6 text-[#526c61]">
              {t('admin.noPassports')}
            </p>
          ) : (
            <ul className="mt-5 grid gap-4">
              {assets.map((asset) => (
                <li key={asset.id} className="rounded-2xl border border-[#dce4dc] bg-white p-6">
                  <h3 className="text-xl font-semibold">
                    {asset.make} {asset.model}
                  </h3>
                  <p className="mt-1 text-sm text-[#526c61]">
                    {asset.serial_number} · {t('admin.recordedLeases')}: {asset.leases.length}
                  </p>
                  <dl className="mt-4 grid gap-3 sm:grid-cols-2">
                    <DataField
                      label={t('admin.currentCondition')}
                      value={t(`condition.${assetConditionSchema.parse(asset.condition)}`)}
                    />
                    <DataField
                      label={t('admin.currentUsage')}
                      value={t(`usage.${usageUnitSchema.parse(asset.usage_unit)}`, {
                        value: formatNumber(asset.usage_value, locale),
                      })}
                    />
                    <DataField
                      label={t('admin.earlierLives')}
                      value={String(asset.previous_lives)}
                    />
                  </dl>
                  {asset.leases.length > 0 ? (
                    <div className="mt-5">
                      <h4 className="font-semibold">{t('admin.history')}</h4>
                      <ol className="mt-3 grid gap-3">
                        {asset.leases.map((lease) => (
                          <li key={lease.id} className="rounded-lg bg-[#f5f7f0] p-4 text-sm">
                            <p className="font-medium">
                              {customerNames.get(lease.customer_id) ?? lease.customer_id} ·{' '}
                              {lease.signed_date} → {lease.end_date}
                            </p>
                            <p className="mt-1 text-[#526c61]">
                              {lease.receipt
                                ? `${t('admin.receiptCondition')}: ${t(`condition.${assetConditionSchema.parse(lease.receipt.condition)}`)} · ${t('admin.receiptUsage')}: ${t(`usage.${usageUnitSchema.parse(lease.receipt.usage_unit)}`, { value: formatNumber(lease.receipt.usage_value, locale) })}`
                                : t('admin.notReceived')}
                            </p>
                          </li>
                        ))}
                      </ol>
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}

      <section className="mt-10" aria-labelledby="admin-audit-title">
        <h2 id="admin-audit-title" className="text-xl font-semibold">
          {t('admin.auditTitle')}
        </h2>
        {audit.length === 0 ? (
          <p className="mt-3 text-sm text-[#526c61]">{t('admin.auditEmpty')}</p>
        ) : (
          <div className="mt-3 overflow-x-auto rounded-xl border border-[#dce4dc] bg-white p-3">
            <table className="w-full min-w-[560px] text-left text-sm">
              <thead>
                <tr>
                  <th className="p-2">{t('admin.auditWhen')}</th>
                  <th className="p-2">{t('admin.auditActor')}</th>
                  <th className="p-2">{t('admin.auditAction')}</th>
                  <th className="p-2">{t('admin.auditEntity')}</th>
                </tr>
              </thead>
              <tbody>
                {audit.map((event) => (
                  <tr key={event.id} className="border-t border-[#e1e9e1]">
                    <td className="p-2">{event.created_at}</td>
                    <td className="p-2">{event.actor}</td>
                    <td className="p-2 font-mono text-xs">{event.action}</td>
                    <td className="p-2">
                      {event.entity_type} · {event.entity_id}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function parseTab(value: string | string[] | undefined): AdminTab {
  const selected = Array.isArray(value) ? value[0] : value;
  if (selected === 'returns' || selected === 'invoices' || selected === 'passports')
    return selected;
  return 'leases';
}

function DataField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-sm text-[#6b7f74]">{label}</dt>
      <dd className="font-medium">{value}</dd>
    </div>
  );
}
