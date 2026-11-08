'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Messages } from '@/i18n/get-t';
import { invoiceDisplayStatus, type PaymentMethod } from '@/domain/invoice-status';

type Props = {
  invoiceId: string;
  customerId: string;
  issueDate: string;
  dueDate: string;
  paymentStatus: 'unpaid' | 'paid';
  paymentMethod: PaymentMethod | null;
  paidOn: string | null;
  date: string;
  messages: Messages;
};

export function InvoicePayment({
  invoiceId,
  customerId,
  issueDate,
  dueDate,
  paymentStatus,
  paymentMethod,
  paidOn,
  date,
  messages: t,
}: Props) {
  const router = useRouter();
  const [method, setMethod] = useState<'bank_transfer' | 'mobilepay' | 'card'>('bank_transfer');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const status = invoiceDisplayStatus({
    issueDate,
    dueDate,
    asOfDate: date,
    paymentStatus,
    paidOn,
  });

  async function pay() {
    setBusy(true);
    setError('');
    try {
      const response = await fetch(`/api/demo/invoices/${encodeURIComponent(invoiceId)}/pay`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customerId, date, method }),
      });
      const body = await response.json();
      if (!response.ok || !body.success) {
        setError(t['payment.error']);
        return;
      }
      router.refresh();
    } catch {
      setError(t['payment.error']);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-w-48">
      <p className="font-semibold">{t[`payment.status.${status}`]}</p>
      {paymentStatus === 'paid' && paidOn && paidOn > date ? (
        <p className="text-xs text-[#526c61]">
          {t['payment.paidLaterOn'].replace('{date}', paidOn)}
        </p>
      ) : paymentMethod && status === 'paid' ? (
        <p className="text-xs text-[#526c61]">
          {paymentMethod === 'bank_transfer'
            ? t['payment.method.bank_transfer']
            : paymentMethod === 'mobilepay'
              ? t['payment.method.mobilepay']
              : t['payment.method.card']}
        </p>
      ) : null}
      {(status === 'due' || status === 'overdue') && paymentStatus !== 'paid' ? (
        <div className="mt-2 grid gap-2">
          <label className="sr-only" htmlFor={`payment-method-${invoiceId}`}>
            {t['payment.methodLabel']}
          </label>
          <select
            id={`payment-method-${invoiceId}`}
            value={method}
            onChange={(event) => setMethod(event.target.value as typeof method)}
            className="min-h-9 rounded-md border border-[#cbd8cc] bg-white px-2 text-xs"
          >
            <option value="bank_transfer">{t['payment.method.bank_transfer']}</option>
            <option value="mobilepay">{t['payment.method.mobilepay']}</option>
            <option value="card">{t['payment.method.card']}</option>
          </select>
          <button
            type="button"
            onClick={pay}
            disabled={busy}
            className="min-h-9 rounded-md bg-[#1f5948] px-3 text-xs font-semibold text-white disabled:opacity-50"
          >
            {busy ? t['payment.processing'] : t['payment.pay']}
          </button>
        </div>
      ) : null}
      {error ? (
        <p role="alert" className="mt-1 text-xs text-red-800">
          {error}
        </p>
      ) : null}
    </div>
  );
}
