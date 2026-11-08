'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import type { CoefficientTable } from '@/data/schemas';
import { monthlyFactorFor } from '@/domain/coefficient';
import { monthlyNetRentCents } from '@/domain/pricing';
import { formatEuro } from '@/domain/money';
import { intlLocale, type Locale } from '@/i18n/locales';
import type { Messages } from '@/i18n/get-t';

type Props = {
  assetId: string;
  customerId: string;
  date: string;
  locale: Locale;
  priceCents: number;
  table: CoefficientTable;
  messages: Messages;
  initialTermMonths?: 12 | 24 | 36 | 48;
  initialDownCents?: number;
  initialLocked?: boolean;
};

export function QuoteForm({
  assetId,
  customerId,
  date,
  locale,
  priceCents,
  table,
  initialTermMonths = 12,
  initialDownCents = 0,
  initialLocked = false,
  messages: t,
}: Props) {
  const router = useRouter();
  const [term, setTerm] = useState<number>(initialTermMonths);
  const [down, setDown] = useState(initialDownCents);
  const [locked, setLocked] = useState(initialLocked);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const financed = priceCents - down;
  const factor = monthlyFactorFor(table, financed, term);
  const format = (cents: number) => formatEuro(cents, intlLocale[locale]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setBusy(true);
    try {
      const response = await fetch('/api/demo/quotes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          assetId,
          customerId,
          quoteDate: date,
          termMonths: term,
          downCents: down,
          locked,
        }),
      });
      const body = await response.json();
      if (!response.ok || !body.success) {
        setError(t['journey.error']);
        return;
      }
      router.push(
        `/${locale}/application/${encodeURIComponent(body.data.id)}?${new URLSearchParams({ profile: customerId, date })}`
      );
    } catch {
      setError(t['journey.error']);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      onSubmit={submit}
      className="mt-8 grid max-w-2xl gap-6 rounded-2xl border border-[#dce4dc] bg-white p-6"
    >
      <label className="grid gap-2 font-semibold">
        {t['journey.term']}
        <select
          value={term}
          onChange={(event) => setTerm(Number(event.target.value))}
          className="rounded-lg border border-[#cbd8cc] p-3"
        >
          {[12, 24, 36, 48].map((value) => (
            <option value={value} key={value}>
              {value} {t['journey.months']}
            </option>
          ))}
        </select>
      </label>
      <label className="grid gap-2 font-semibold">
        {t['journey.down']} ({format(down)})
        <input
          type="range"
          min="0"
          max={priceCents}
          step="1"
          value={down}
          onChange={(event) => setDown(Number(event.target.value))}
        />
      </label>
      <dl className="grid grid-cols-2 gap-3 text-sm">
        <dt>{t['journey.listPrice']}</dt>
        <dd className="text-right font-semibold">{format(priceCents)}</dd>
        <dt>{t['journey.financed']}</dt>
        <dd className="text-right font-semibold">{format(financed)}</dd>
        <dt>{t['journey.monthly']}</dt>
        <dd className="text-right font-semibold">
          {factor.ok
            ? format(monthlyNetRentCents(financed, factor.factor))
            : t['journey.unavailable']}
        </dd>
      </dl>
      {!factor.ok ? (
        <p role="alert" className="text-sm text-red-800">
          {t['journey.financingError']}
        </p>
      ) : null}
      <label className="flex items-start gap-3 text-sm">
        <input
          type="checkbox"
          checked={locked}
          onChange={(event) => setLocked(event.target.checked)}
          className="mt-1"
        />
        {t['journey.lock']}
      </label>
      {error ? (
        <p role="alert" className="text-red-800">
          {error}
        </p>
      ) : null}
      <button
        disabled={!factor.ok || busy}
        className="rounded-lg bg-[#1f5948] p-3 font-semibold text-white disabled:opacity-50"
      >
        {t['journey.continue']}
      </button>
    </form>
  );
}
