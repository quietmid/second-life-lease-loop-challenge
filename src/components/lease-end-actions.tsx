'use client';

import { useState, type FormEvent } from 'react';
import type { Messages } from '@/i18n/get-t';
import type { Locale } from '@/i18n/locales';
import { formatEuro } from '@/domain/money';
import { intlLocale } from '@/i18n/locales';

type EarlyExitPreview = {
  settlementCents: number;
  remainingContractValueCents: number;
  marketValueCents: number;
  monthsElapsed: number;
  annualInterestPercent: number;
  buyoutCents: number;
};

type Props = {
  leaseId: string;
  customerId: string;
  date: string;
  signedDate: string;
  endDate: string;
  buyoutCents: number;
  locale: Locale;
  messages: Messages;
};

export function LeaseEndActions({
  leaseId,
  customerId,
  date,
  signedDate,
  endDate,
  buyoutCents,
  locale,
  messages: t,
}: Props) {
  const [exitDate, setExitDate] = useState(date);
  const [preview, setPreview] = useState<EarlyExitPreview | null>(null);
  const [completed, setCompleted] = useState('');
  const [showBuyoutConfirm, setShowBuyoutConfirm] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const format = (cents: number) => formatEuro(cents, intlLocale[locale]);
  const earlyExitDate = date > signedDate && date < endDate;

  async function requestPreview(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const response = await fetch(
        `/api/demo/leases/${encodeURIComponent(leaseId)}/early-exit/preview`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ customerId, date: exitDate }),
        }
      );
      const body = await response.json();
      if (!response.ok || !body.success) {
        setError(t['leaseEnd.previewError']);
        return;
      }
      setPreview(body.data);
    } catch {
      setError(t['leaseEnd.previewError']);
    } finally {
      setBusy(false);
    }
  }

  async function confirmEarlyExit() {
    setBusy(true);
    setError('');
    try {
      const response = await fetch(`/api/demo/leases/${encodeURIComponent(leaseId)}/early-exit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customerId, date: exitDate }),
      });
      const body = await response.json();
      if (!response.ok || !body.success) {
        setError(t['leaseEnd.actionError']);
        return;
      }
      setCompleted(t['leaseEnd.earlyExitComplete']);
      setPreview(null);
    } catch {
      setError(t['leaseEnd.actionError']);
    } finally {
      setBusy(false);
    }
  }

  async function confirmBuyout() {
    setBusy(true);
    setError('');
    try {
      const response = await fetch(`/api/demo/leases/${encodeURIComponent(leaseId)}/buyout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customerId, date }),
      });
      const body = await response.json();
      if (!response.ok || !body.success) {
        setError(t['leaseEnd.actionError']);
        return;
      }
      setCompleted(t['leaseEnd.buyoutComplete']);
      setShowBuyoutConfirm(false);
    } catch {
      setError(t['leaseEnd.actionError']);
    } finally {
      setBusy(false);
    }
  }

  if (completed)
    return (
      <p role="status" className="mt-4 rounded-lg bg-[#e6f0e2] p-3">
        {completed}
      </p>
    );

  if (earlyExitDate) {
    return (
      <div className="mt-6 rounded-xl border border-[#dce4dc] p-4">
        <h3 className="font-semibold">{t['leaseEnd.earlyExitTitle']}</h3>
        <p className="mt-1 text-sm text-[#526c61]">{t['leaseEnd.earlyExitMethod']}</p>
        <form onSubmit={requestPreview} className="mt-3 flex flex-wrap items-end gap-3">
          <label className="grid gap-1 text-sm font-medium">
            {t['leaseEnd.returnDate']}
            <input
              type="date"
              min={signedDate}
              max={endDate}
              value={exitDate}
              onChange={(event) => setExitDate(event.target.value)}
              className="min-h-10 rounded-lg border border-[#cbd8cc] px-3"
            />
          </label>
          <button
            type="submit"
            disabled={busy}
            className="min-h-10 rounded-lg border border-[#cbd8cc] px-4 font-semibold disabled:opacity-50"
          >
            {busy ? t['leaseEnd.calculating'] : t['leaseEnd.preview']}
          </button>
        </form>
        {preview ? (
          <div className="mt-4 rounded-lg bg-[#f5f7f0] p-4 text-sm">
            <p className="font-semibold">
              {t['leaseEnd.settlement']}: {format(preview.settlementCents)}
            </p>
            <dl className="mt-2 grid gap-1 sm:grid-cols-2">
              <dt>{t['leaseEnd.remainingValue']}</dt>
              <dd>{format(preview.remainingContractValueCents)}</dd>
              <dt>{t['leaseEnd.marketValue']}</dt>
              <dd>− {format(preview.marketValueCents)}</dd>
              <dt>{t['leaseEnd.monthsUsed']}</dt>
              <dd>{preview.monthsElapsed}</dd>
              <dt>{t['leaseEnd.interest']}</dt>
              <dd>{preview.annualInterestPercent}%</dd>
              <dt>{t['journey.buyout']}</dt>
              <dd>{format(preview.buyoutCents)}</dd>
            </dl>
            <p className="mt-3 text-[#526c61]">{t['leaseEnd.earlyExitExplanation']}</p>
            <button
              type="button"
              onClick={confirmEarlyExit}
              disabled={busy}
              className="mt-4 min-h-10 rounded-lg bg-[#1f5948] px-4 font-semibold text-white disabled:opacity-50"
            >
              {t['leaseEnd.confirmEarlyExit']}
            </button>
          </div>
        ) : null}
        {error ? (
          <p role="alert" className="mt-3 text-sm text-red-800">
            {error}
          </p>
        ) : null}
      </div>
    );
  }

  if (date >= endDate) {
    return (
      <div className="mt-4 flex flex-wrap items-center gap-3">
        {!showBuyoutConfirm ? (
          <button
            type="button"
            onClick={() => setShowBuyoutConfirm(true)}
            className="min-h-10 rounded-lg border border-[#cbd8cc] px-4 font-semibold"
          >
            {t['leaseEnd.buyoutFor']} {format(buyoutCents)}
          </button>
        ) : (
          <div
            role="group"
            aria-label={t['leaseEnd.confirmBuyout']}
            className="flex flex-wrap gap-2"
          >
            <button
              type="button"
              onClick={confirmBuyout}
              disabled={busy}
              className="min-h-10 rounded-lg bg-[#1f5948] px-4 font-semibold text-white disabled:opacity-50"
            >
              {t['leaseEnd.confirmBuyout']}
            </button>
            <button
              type="button"
              onClick={() => setShowBuyoutConfirm(false)}
              className="min-h-10 rounded-lg border border-[#cbd8cc] px-4"
            >
              {t['journey.cancel']}
            </button>
          </div>
        )}
        {error ? (
          <p role="alert" className="basis-full text-sm text-red-800">
            {error}
          </p>
        ) : null}
      </div>
    );
  }
  return null;
}
