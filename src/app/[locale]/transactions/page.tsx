import Link from 'next/link';
import { notFound } from 'next/navigation';
import { InvoicePayment } from '@/components/invoice-payment';
import { loadCustomers } from '@/data/load';
import { isoDateSchema } from '@/data/schemas';
import { formatEuro } from '@/domain/money';
import type { PaymentMethod } from '@/domain/invoice-status';
import { getT, messages } from '@/i18n/get-t';
import { intlLocale, isLocale } from '@/i18n/locales';
import { db } from '@/server/db';
import { todayIso } from '@/server/today';

export default async function TransactionsPage({
  params,
  searchParams,
}: PageProps<'/[locale]/transactions'>) {
  const [{ locale }, query] = await Promise.all([params, searchParams]);
  if (!isLocale(locale)) notFound();
  const t = getT(locale);
  const customerId = typeof query.profile === 'string' ? query.profile : 'cust-aino';
  const date = typeof query.date === 'string' ? query.date : todayIso();
  const customer = (await loadCustomers()).find((entry) => entry.id === customerId);
  if (!customer || !isoDateSchema.safeParse(date).success) {
    return (
      <p role="alert" className="p-8">
        {t('journey.unavailable')}
      </p>
    );
  }

  const leases = await db.demoLease.findMany({
    where: { customer_id: customerId },
    include: { asset: true, invoices: { orderBy: { issue_date: 'asc' } } },
    orderBy: { created_at: 'desc' },
  });
  const invoiceRows = leases.flatMap((lease) =>
    lease.invoices.map((invoice) => ({ lease, invoice }))
  );
  const issuedRows = invoiceRows.filter(({ invoice }) => invoice.issue_date <= date);
  const upcomingRows = invoiceRows.filter(({ invoice }) => invoice.issue_date > date);
  const format = (cents: number) => formatEuro(cents, intlLocale[locale]);
  const localeMessages = messages[locale];

  function renderRows(rows: typeof invoiceRows) {
    return (
      <div className="mt-4 overflow-x-auto rounded-2xl border border-[#dce4dc] bg-white p-4">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead>
            <tr>
              <th className="p-2">{t('admin.item')}</th>
              <th className="p-2">{t('journey.issue')}</th>
              <th className="p-2">{t('journey.due')}</th>
              <th className="p-2">{t('journey.net')}</th>
              <th className="p-2">{t('journey.vat')}</th>
              <th className="p-2">{t('journey.total')}</th>
              <th className="p-2">{t('payment.status')}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ lease, invoice }) => (
              <tr key={invoice.id} className="border-t border-[#e1e9e1] align-top">
                <td className="p-2 font-medium">
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
                  <InvoicePayment
                    invoiceId={invoice.id}
                    customerId={customerId}
                    issueDate={invoice.issue_date}
                    dueDate={invoice.due_date}
                    paymentStatus={invoice.payment_status as 'unpaid' | 'paid'}
                    paymentMethod={invoice.payment_method as PaymentMethod | null}
                    paidOn={invoice.paid_on}
                    date={date}
                    messages={localeMessages}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  return (
    <div className="px-4 py-10 sm:px-8">
      <h1 className="text-4xl font-semibold">{t('nav.transactions')}</h1>
      <p className="mt-2 max-w-3xl text-[#526c61]">
        {customer.name} · {t('transactions.intro')}
      </p>
      <p className="mt-3 rounded-lg bg-[#f0f3e8] p-3 text-sm text-[#526c61]">
        {t('payment.mockNotice')}
      </p>
      {invoiceRows.length === 0 ? (
        <p className="mt-6 rounded-xl border border-dashed border-[#cbd8cc] p-6 text-[#526c61]">
          {t('transactions.empty')}{' '}
          <Link
            className="font-semibold underline"
            href={`/${locale}/catalogue?${new URLSearchParams({ profile: customerId, date })}`}
          >
            {t('nav.catalogue')}
          </Link>
        </p>
      ) : (
        <>
          <section className="mt-8" aria-labelledby="issued-invoices-title">
            <h2 id="issued-invoices-title" className="text-2xl font-semibold">
              {t('transactions.issued')}
            </h2>
            {issuedRows.length ? (
              renderRows(issuedRows)
            ) : (
              <p className="mt-3 text-sm text-[#526c61]">{t('transactions.noIssued')}</p>
            )}
          </section>
          <section className="mt-10" aria-labelledby="upcoming-invoices-title">
            <h2 id="upcoming-invoices-title" className="text-2xl font-semibold">
              {t('transactions.upcoming')}
            </h2>
            {upcomingRows.length ? (
              renderRows(upcomingRows)
            ) : (
              <p className="mt-3 text-sm text-[#526c61]">{t('transactions.noUpcoming')}</p>
            )}
          </section>
        </>
      )}
    </div>
  );
}
