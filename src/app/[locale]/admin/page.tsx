import { notFound } from 'next/navigation';
import { loadCo2Factors, loadCustomers, loadResidualCurves } from '@/data/load';
import {
  assetCategorySchema,
  assetConditionSchema,
  isoDateSchema,
  usageUnitSchema,
} from '@/data/schemas';
import { formatNumber } from '@/i18n/format';
import { getT, messages } from '@/i18n/get-t';
import { intlLocale, isLocale } from '@/i18n/locales';
import { formatEuro } from '@/domain/money';
import { avoidedCo2Kg } from '@/domain/second-life';
import { invoiceDisplayStatus } from '@/domain/invoice-status';
import { ReturnWorkflow } from '@/components/return-workflow';
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

  const [customers, leases, assets, returningItems, audit, co2Factors, residualCurves] =
    await Promise.all([
      loadCustomers(),
      db.demoLease.findMany({
        include: { asset: true, receipt: true, invoices: { orderBy: { issue_date: 'asc' } } },
        orderBy: [{ asset_id: 'asc' }, { signed_date: 'asc' }],
      }),
      db.asset.findMany({
        where: { OR: [{ previous_lives: { gt: 0 } }, { leases: { some: {} } }] },
        include: {
          leases: { include: { receipt: true, early_exit: true }, orderBy: { signed_date: 'asc' } },
          inspections: {
            include: { refurbishment: true },
            orderBy: [{ inspected_on: 'desc' }, { created_at: 'desc' }],
          },
        },
        orderBy: { id: 'asc' },
      }),
      db.asset.findMany({
        where: {
          OR: [
            { status: 'returned' },
            { leases: { some: { return_requested_on: { not: null }, bought_out_on: null } } },
          ],
        },
        include: {
          leases: {
            where: { return_requested_on: { not: null }, bought_out_on: null },
            include: { early_exit: true },
            orderBy: [{ return_requested_on: 'desc' }, { signed_date: 'desc' }],
          },
          inspections: {
            include: { refurbishment: true },
            orderBy: [{ inspected_on: 'desc' }, { created_at: 'desc' }],
          },
        },
        orderBy: { id: 'asc' },
      }),
      listAuditLog(db, 30),
      loadCo2Factors(),
      loadResidualCurves(),
    ]);
  const customerNames = new Map(customers.map((customer) => [customer.id, customer.name]));
  const activeLeases = leases.filter(
    (lease) =>
      lease.signed_date <= date &&
      lease.end_date > date &&
      (!lease.return_requested_on || lease.return_requested_on > date)
  );
  const returnRequests = returningItems.filter((asset) =>
    asset.leases.some((lease) => lease.return_requested_on && lease.return_requested_on <= date)
  );
  const invoiceRows = leases.flatMap((lease) =>
    lease.invoices.map((invoice) => ({ lease, invoice }))
  );
  const format = (cents: number) => formatEuro(cents, intlLocale[locale]);
  const fleetCo2SavedKg = assets.reduce(
    (sum, asset) =>
      sum +
      avoidedCo2Kg({
        category: assetCategorySchema.parse(asset.category),
        condition: assetConditionSchema.parse(asset.condition),
        usageUnit: usageUnitSchema.parse(asset.usage_unit),
        usageValue: asset.usage_value,
        reuseLives: asset.previous_lives,
        curves: residualCurves,
        factors: co2Factors,
      }),
    0
  );

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
          {returnRequests.length +
            returningItems.filter((asset) => asset.leases.length === 0).length ===
          0 ? (
            <p className="mt-4 rounded-xl border border-dashed border-[#cbd8cc] p-6 text-[#526c61]">
              {t('admin.noReturns')}
            </p>
          ) : (
            <ul className="mt-5 grid gap-4">
              {returningItems.map((asset) => {
                const returnLease = asset.leases[0];
                const inspection = asset.inspections[0];
                const shouldShow =
                  !returnLease ||
                  (returnLease.return_requested_on !== null &&
                    returnLease.return_requested_on <= date);
                if (!shouldShow) return null;
                return (
                  <li
                    id={`return-${asset.id}`}
                    key={asset.id}
                    className="rounded-2xl border border-[#dce4dc] bg-white p-6"
                  >
                    <h3 className="text-xl font-semibold">
                      {asset.make} {asset.model} · {asset.id}
                    </h3>
                    {returnLease ? (
                      <>
                        <p className="mt-2 inline-flex rounded-full bg-[#e6f0e2] px-3 py-1 text-xs font-semibold text-[#245743]">
                          {returnLease.early_exit
                            ? t('admin.returnType.early')
                            : t('admin.returnType.completed')}
                        </p>
                        <p className="mt-1 text-sm text-[#526c61]">
                          {t('admin.customer')}:{' '}
                          {customerNames.get(returnLease.customer_id) ?? returnLease.customer_id}
                          {' · '}
                          {t('admin.requestedOn')}: {returnLease.return_requested_on}
                        </p>
                      </>
                    ) : (
                      <p className="mt-1 text-sm text-[#526c61]">{t('admin.legacyReturn')}</p>
                    )}
                    {returnLease?.return_condition ? (
                      <p className="mt-2 text-sm text-[#526c61]">
                        {t('leaseEnd.customerReportedReturn')}:{' '}
                        {t(`condition.${assetConditionSchema.parse(returnLease.return_condition)}`)}
                        {returnLease.return_usage_value !== null
                          ? ` · ${t(`usage.${usageUnitSchema.parse(asset.usage_unit)}`, { value: formatNumber(returnLease.return_usage_value, locale) })}`
                          : ''}
                      </p>
                    ) : null}
                    {inspection ? (
                      <p className="mt-2 text-sm text-[#526c61]">
                        {t('admin.inspectedOn')}: {inspection.inspected_on} · {t('condition.label')}
                        : {t(`condition.${assetConditionSchema.parse(inspection.condition)}`)}
                      </p>
                    ) : null}
                    <dl className="mt-4 grid gap-3 sm:grid-cols-3">
                      <DataField
                        label={t('admin.returnState')}
                        value={inspection ? t('admin.inspected') : t('admin.awaitingInspection')}
                      />
                      <DataField
                        label={t('admin.refurbishmentStatus')}
                        value={
                          inspection?.refurbishment
                            ? t('admin.refurbishmentComplete')
                            : t('admin.notAssessed')
                        }
                      />
                      <DataField
                        label={t('admin.nextLifeStatus')}
                        value={t('admin.pendingAvailability')}
                      />
                    </dl>
                    <ReturnWorkflow
                      assetId={asset.id}
                      leaseId={returnLease?.id}
                      date={date}
                      condition={
                        inspection?.condition
                          ? assetConditionSchema.parse(inspection.condition)
                          : assetConditionSchema.parse(
                              returnLease?.return_condition ?? asset.condition
                            )
                      }
                      usageValue={
                        inspection?.usage_value ??
                        returnLease?.return_usage_value ??
                        asset.usage_value
                      }
                      locale={locale}
                      messages={messages[locale]}
                    />
                  </li>
                );
              })}
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
                    <th className="p-2">{t('payment.methodLabel')}</th>
                    <th className="p-2">{t('payment.paidOn')}</th>
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
                      <td className="p-2">
                        {t(
                          `payment.status.${invoiceDisplayStatus({
                            issueDate: invoice.issue_date,
                            dueDate: invoice.due_date,
                            asOfDate: date,
                            paymentStatus: invoice.payment_status as 'unpaid' | 'paid',
                            paidOn: invoice.paid_on,
                          })}`
                        )}
                      </td>
                      <td className="p-2">
                        {invoice.paid_on && invoice.paid_on > date
                          ? '—'
                          : invoice.payment_method === 'bank_transfer'
                            ? t('payment.method.bank_transfer')
                            : invoice.payment_method === 'mobilepay'
                              ? t('payment.method.mobilepay')
                              : invoice.payment_method === 'card'
                                ? t('payment.method.card')
                                : '—'}
                      </td>
                      <td className="p-2">
                        {invoice.paid_on && invoice.paid_on <= date ? invoice.paid_on : '—'}
                      </td>
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
          <p className="mt-2 max-w-3xl text-sm text-[#526c61]">{t('admin.co2Method')}</p>
          <p className="mt-4 rounded-xl bg-[#e6f0e2] p-4 font-semibold">
            {t('admin.fleetCo2Saved')}: {fleetCo2SavedKg.toLocaleString(intlLocale[locale])} kg CO₂e
          </p>
          {assets.length === 0 ? (
            <p className="mt-4 rounded-xl border border-dashed border-[#cbd8cc] p-6 text-[#526c61]">
              {t('admin.noPassports')}
            </p>
          ) : (
            <ul className="mt-5 grid gap-4">
              {assets.map((asset) => (
                <li
                  id={`passport-${asset.id}`}
                  key={asset.id}
                  className="rounded-2xl border border-[#dce4dc] bg-white p-6"
                >
                  <h3 className="text-xl font-semibold">
                    {asset.make} {asset.model}
                  </h3>
                  <p className="mt-1 text-sm text-[#526c61]">
                    {asset.serial_number} · {t('admin.recordedLeases')}: {asset.leases.length}
                  </p>
                  <p className="mt-1 text-sm text-[#526c61]">
                    {t('admin.currentLife')}: {asset.previous_lives + 1}
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
                    <DataField
                      label={t('admin.itemCo2Saved')}
                      value={`${avoidedCo2Kg({
                        category: assetCategorySchema.parse(asset.category),
                        condition: assetConditionSchema.parse(asset.condition),
                        usageUnit: usageUnitSchema.parse(asset.usage_unit),
                        usageValue: asset.usage_value,
                        reuseLives: asset.previous_lives,
                        curves: residualCurves,
                        factors: co2Factors,
                      }).toLocaleString(intlLocale[locale])} kg CO₂e`}
                    />
                    {asset.current_net_price_cents !== null ? (
                      <DataField
                        label={t('admin.secondLifePrice')}
                        value={format(asset.current_net_price_cents)}
                      />
                    ) : null}
                  </dl>
                  {asset.previous_lives > 0 ? (
                    <p className="mt-3 text-xs text-[#718278]">{t('admin.legacyHistoryNote')}</p>
                  ) : null}
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
                            {lease.return_requested_on && lease.return_condition ? (
                              <p className="mt-1 text-[#526c61]">
                                {t('leaseEnd.customerReportedReturn')}:{' '}
                                {t(
                                  `condition.${assetConditionSchema.parse(lease.return_condition)}`
                                )}
                                {lease.return_usage_value !== null
                                  ? ` · ${t(`usage.${usageUnitSchema.parse(asset.usage_unit)}`, { value: formatNumber(lease.return_usage_value, locale) })}`
                                  : ''}
                              </p>
                            ) : null}
                            {asset.inspections
                              .filter((inspection) => inspection.lease_id === lease.id)
                              .map((inspection) => (
                                <div key={inspection.id} className="mt-2 text-[#526c61]">
                                  <p>
                                    {t('admin.inspectedOn')}: {inspection.inspected_on} ·{' '}
                                    {t('condition.label')}:{' '}
                                    {t(
                                      `condition.${assetConditionSchema.parse(inspection.condition)}`
                                    )}
                                  </p>
                                  {inspection.refurbishment ? (
                                    <p>
                                      {t('admin.refurbishmentCost')}:{' '}
                                      {format(inspection.refurbishment.cost_cents)} ·{' '}
                                      {t('admin.matchWinner')}:{' '}
                                      {inspection.refurbishment.waitlist_id}
                                    </p>
                                  ) : null}
                                </div>
                              ))}
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
