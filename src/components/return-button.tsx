'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { AssetCondition, UsageUnit } from '@/data/schemas';
import type { Messages } from '@/i18n/get-t';
import type { Locale } from '@/i18n/locales';
import { formatNumber } from '@/i18n/format';

export function ReturnButton({
  leaseId,
  customerId,
  date,
  condition: initialCondition,
  usageValue,
  usageUnit,
  locale,
  messages: t,
  label,
  errorMessage,
}: {
  leaseId: string;
  customerId: string;
  date: string;
  condition: AssetCondition;
  usageValue: number;
  usageUnit: UsageUnit;
  locale: Locale;
  messages: Messages;
  label: string;
  errorMessage: string;
}) {
  const router = useRouter();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [condition, setCondition] = useState(initialCondition);
  const [usage, setUsage] = useState(String(usageValue));
  const usageMessage = t[`usage.${usageUnit}`];
  const usageUnitLabel = usageMessage.replace('{value}', '').trim();
  async function submit() {
    setBusy(true);
    setError('');
    try {
      const response = await fetch(`/api/demo/leases/${encodeURIComponent(leaseId)}/return`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customerId, date, condition, usageValue: Number(usage) }),
      });
      if (!response.ok) {
        setError(errorMessage);
        return;
      }
      router.refresh();
    } catch {
      setError(errorMessage);
    } finally {
      setBusy(false);
    }
  }
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        void submit();
      }}
      className="mt-4 grid max-w-xl gap-3 rounded-xl bg-[#f5f7f0] p-4"
    >
      <p className="font-semibold">{t['leaseEnd.returnDeclaration']}</p>
      <label className="grid gap-1 text-sm font-semibold">
        {t['leaseEnd.returnCondition']}
        <select
          value={condition}
          onChange={(event) => setCondition(event.target.value as AssetCondition)}
          className="min-h-10 rounded-lg border border-[#cbd8cc] bg-white px-3"
        >
          {(['new', 'like_new', 'good', 'fair', 'poor'] as const).map((value) => (
            <option value={value} key={value}>
              {t[`condition.${value}`]}
            </option>
          ))}
        </select>
      </label>
      <label className="grid gap-1 text-sm font-semibold">
        {t['leaseEnd.returnUsage']} · {usageUnitLabel}
        <input
          type="number"
          min={usageValue}
          max={Number.MAX_SAFE_INTEGER}
          step="1"
          required
          value={usage}
          onChange={(event) => setUsage(event.target.value)}
          className="min-h-10 rounded-lg border border-[#cbd8cc] bg-white px-3"
        />
        <span className="font-normal text-[#526c61]">
          {t['account.usageMinimum'].replace('{usage}', formatNumber(usageValue, locale))}
        </span>
      </label>
      <button
        type="submit"
        disabled={busy}
        className="rounded-lg bg-[#1f5948] px-4 py-3 font-semibold text-white disabled:opacity-50"
      >
        {label}
      </button>
      {error ? (
        <p role="alert" className="mt-2 text-red-800">
          {error}
        </p>
      ) : null}
    </form>
  );
}
