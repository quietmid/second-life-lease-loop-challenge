'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import type { AssetCondition, UsageUnit } from '@/data/schemas';
import { formatNumber } from '@/i18n/format';
import type { Locale } from '@/i18n/locales';
import type { Messages } from '@/i18n/get-t';

type Props = {
  leaseId: string;
  customerId: string;
  date: string;
  signedDate: string;
  condition: AssetCondition;
  usageValue: number;
  usageUnit: UsageUnit;
  locale: Locale;
  messages: Messages;
};

export function AssetReceiptForm({
  leaseId,
  customerId,
  date,
  signedDate,
  condition: initialCondition,
  usageValue,
  usageUnit,
  locale,
  messages: t,
}: Props) {
  const router = useRouter();
  const [condition, setCondition] = useState(initialCondition);
  const [usage, setUsage] = useState(String(usageValue));
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState(false);
  const dateIsBeforeLease = date < signedDate;
  const usageMessage = t[`usage.${usageUnit}`];
  const usageUnitLabel = usageMessage.replace('{value}', '').trim();
  const knownUsage = usageMessage.replace('{value}', formatNumber(usageValue, locale));

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(false);
    try {
      const response = await fetch(`/api/demo/leases/${encodeURIComponent(leaseId)}/receive`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId,
          receivedDate: date,
          condition,
          usageValue: Number(usage),
        }),
      });
      const body = await response.json();
      if (!response.ok || !body.success) {
        setError(true);
        return;
      }
      router.refresh();
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="mt-6 grid gap-4 rounded-xl bg-[#f5f7f0] p-4">
      <div>
        <h3 className="font-semibold">{t['account.receiveTitle']}</h3>
        <p className="mt-1 text-sm text-[#526c61]">{t['account.receiveDescription']}</p>
      </div>
      <label className="grid gap-2 text-sm font-semibold">
        {t['condition.label']}
        <select
          value={condition}
          onChange={(event) => setCondition(event.target.value as AssetCondition)}
          className="rounded-lg border border-[#cbd8cc] bg-white p-3"
        >
          {(['new', 'like_new', 'good', 'fair', 'poor'] as const).map((value) => (
            <option value={value} key={value}>
              {t[`condition.${value}`]}
            </option>
          ))}
        </select>
      </label>
      <label className="grid gap-2 text-sm font-semibold">
        {t['asset.usage']} · {usageUnitLabel}
        <input
          type="number"
          min={usageValue}
          max={Number.MAX_SAFE_INTEGER}
          step="1"
          required
          value={usage}
          onChange={(event) => setUsage(event.target.value)}
          className="rounded-lg border border-[#cbd8cc] bg-white p-3"
        />
        <span className="font-normal text-[#526c61]">
          {t['account.usageMinimum'].replace('{usage}', knownUsage)}
        </span>
      </label>
      {dateIsBeforeLease ? (
        <p role="alert" className="text-sm text-amber-900">
          {t['account.dateBeforeLease']}
        </p>
      ) : null}
      {error ? (
        <p role="alert" className="text-sm text-red-800">
          {t['account.receiveError']}
        </p>
      ) : null}
      <button
        disabled={busy || dateIsBeforeLease}
        className="rounded-lg bg-[#1f5948] px-4 py-3 text-sm font-semibold text-white disabled:opacity-50"
      >
        {t['account.receiveConfirm']}
      </button>
    </form>
  );
}
