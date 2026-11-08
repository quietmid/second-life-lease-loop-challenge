'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import type { AssetCondition } from '@/data/schemas';
import { assetConditionSchema } from '@/data/schemas';
import { getT, type Messages } from '@/i18n/get-t';
import type { Locale } from '@/i18n/locales';
import { formatEuro } from '@/domain/money';
import { intlLocale } from '@/i18n/locales';

type CompletedRefurbishment = {
  target_condition: string;
  usage_after: number;
  cost_cents: number;
  market_price_cents: number;
  monthly_net_cents: number;
  term_months: number;
  waitlist_id: string | null;
  match_status: string;
  steps_json: string;
};

type Props = {
  assetId: string;
  leaseId?: string;
  date: string;
  condition: AssetCondition;
  usageValue: number;
  locale: Locale;
  messages: Messages;
};

export function ReturnWorkflow({
  assetId,
  leaseId,
  date,
  condition,
  usageValue,
  locale,
  messages: t,
}: Props) {
  const router = useRouter();
  const translate = getT(locale);
  const [inspectionId, setInspectionId] = useState('');
  const [conditionValue, setConditionValue] = useState(condition);
  const [usage, setUsage] = useState(String(usageValue));
  const [result, setResult] = useState<{
    refurbishment: CompletedRefurbishment;
    waitlistCustomer: string | null;
    matchReason: string | null;
    co2SavedKg: number;
    alternatives: { id: string; reason: string }[];
  } | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [acceptedLease, setAcceptedLease] = useState<{
    customerId: string;
    monthlyNetCents: number;
    invoiceCount: number;
  } | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const response = await fetch(`/api/demo/assets/${encodeURIComponent(assetId)}/inspection`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...(leaseId ? { leaseId } : {}),
          date,
          condition: conditionValue,
          usageValue: Number(usage),
        }),
      });
      const body = await response.json();
      if (!response.ok || !body.success) {
        setError(t['admin.lifecycleError']);
        return;
      }
      setInspectionId(body.data.id as string);
      router.refresh();
    } catch {
      setError(t['admin.lifecycleError']);
    } finally {
      setBusy(false);
    }
  }

  async function completeRefurbishment() {
    if (!inspectionId) return;
    setBusy(true);
    setError('');
    try {
      const response = await fetch(
        `/api/demo/inspections/${encodeURIComponent(inspectionId)}/refurbish`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ date }),
        }
      );
      const body = await response.json();
      if (!response.ok || !body.success) {
        setError(
          body.error?.code === 'NO_MATCHING_DEMAND'
            ? t['admin.noMatchingDemand']
            : t['admin.lifecycleError']
        );
        return;
      }
      setResult(body.data);
    } catch {
      setError(t['admin.lifecycleError']);
    } finally {
      setBusy(false);
    }
  }

  async function acceptOffer() {
    setBusy(true);
    setError('');
    try {
      const response = await fetch(`/api/demo/assets/${encodeURIComponent(assetId)}/accept-offer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date }),
      });
      const body = await response.json();
      if (!response.ok || !body.success) {
        setError(t['admin.lifecycleError']);
        return;
      }
      setAcceptedLease({
        customerId: body.data.lease.customer_id as string,
        monthlyNetCents: body.data.lease.monthly_net_cents as number,
        invoiceCount: (body.data.lease.invoices as unknown[]).length,
      });
    } catch {
      setError(t['admin.lifecycleError']);
    } finally {
      setBusy(false);
    }
  }

  if (result) {
    const refurbishment = result.refurbishment;
    const steps = JSON.parse(refurbishment.steps_json) as { id: string; costCents: number }[];
    return (
      <div role="status" className="mt-4 rounded-xl bg-[#e6f0e2] p-4 text-sm">
        <p className="font-semibold">
          {acceptedLease ? t['admin.offerAccepted'] : t['admin.refurbishmentComplete']}
        </p>
        <p className="mt-2">
          {refurbishment.waitlist_id ? (
            <>
              {t['admin.matchWinner']}: <strong>{refurbishment.waitlist_id}</strong> ·{' '}
              {result.waitlistCustomer}
            </>
          ) : (
            t['admin.unassigned']
          )}
        </p>
        {refurbishment.match_status === 'matched' && !acceptedLease ? (
          <button
            type="button"
            onClick={acceptOffer}
            disabled={busy}
            className="mt-3 inline-flex min-h-10 items-center rounded-lg bg-[#1f5948] px-4 font-semibold text-white disabled:opacity-50"
          >
            {busy ? t['admin.working'] : t['admin.acceptWaitlistOffer']}
          </button>
        ) : null}
        {acceptedLease ? (
          <p role="status" className="mt-3 rounded-lg bg-white p-3">
            {t['admin.secondLifeSigned']}: {acceptedLease.customerId} ·{' '}
            {formatEuro(acceptedLease.monthlyNetCents, intlLocale[locale])} / {t['admin.perMonth']}{' '}
            · {acceptedLease.invoiceCount} {t['admin.invoicesCreated']}
          </p>
        ) : null}
        <p>
          {t['admin.secondLifeRent']}:{' '}
          {formatEuro(refurbishment.monthly_net_cents, intlLocale[locale])} ·{' '}
          {refurbishment.term_months} {t['journey.months']}
        </p>
        <p>
          {t['admin.marketPrice']}:{' '}
          {formatEuro(refurbishment.market_price_cents, intlLocale[locale])}
        </p>
        <p>
          {t['admin.refurbishmentCost']}: {formatEuro(refurbishment.cost_cents, intlLocale[locale])}
        </p>
        <ul className="mt-2 list-disc pl-5">
          {steps.map((step) => (
            <li key={step.id}>
              {translate(`admin.refurbishmentStep.${step.id}` as keyof Messages) || step.id}:{' '}
              {formatEuro(step.costCents, intlLocale[locale])}
            </li>
          ))}
        </ul>
        <p className="mt-2">{t['admin.matchPolicy']}</p>
        {result.alternatives.map((alternative) => (
          <p key={alternative.id} className="mt-1 text-[#526c61]">
            {alternative.id}:{' '}
            {alternative.reason === 'condition_not_met'
              ? t['admin.matchConditionNotMet']
              : alternative.reason === 'deadline_passed'
                ? t['admin.matchDeadlinePassed']
                : t['admin.matchLowerPriority']}
          </p>
        ))}
        <p className="mt-2">
          {t['admin.co2Saved']}: {result.co2SavedKg.toLocaleString(intlLocale[locale])} kg CO₂e
        </p>
        {!acceptedLease ? (
          <a
            className="mt-3 inline-flex min-h-10 items-center rounded-lg bg-[#1f5948] px-4 font-semibold text-white"
            href={`/${locale}/catalogue?${new URLSearchParams({ profile: 'cust-aino', date })}`}
          >
            {t['admin.startNextLease']}
          </a>
        ) : null}
        {error ? (
          <p role="alert" className="mt-2 text-sm text-red-800">
            {error}
          </p>
        ) : null}
      </div>
    );
  }

  if (inspectionId) {
    return (
      <div className="mt-4">
        <button
          type="button"
          onClick={completeRefurbishment}
          disabled={busy}
          className="min-h-10 rounded-lg bg-[#1f5948] px-4 font-semibold text-white disabled:opacity-50"
        >
          {busy ? t['admin.working'] : t['admin.planRefurbishment']}
        </button>
        {error ? (
          <p role="alert" className="mt-2 text-sm text-red-800">
            {error}
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="mt-4 grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
      <label className="grid gap-1 text-sm font-semibold">
        {t['admin.inspectionCondition']}
        <select
          value={conditionValue}
          onChange={(event) => setConditionValue(assetConditionSchema.parse(event.target.value))}
          className="min-h-10 rounded-lg border border-[#cbd8cc] bg-white px-3"
        >
          {assetConditionSchema.options.map((option) => (
            <option key={option} value={option}>
              {translate(`condition.${option}` as keyof Messages)}
            </option>
          ))}
        </select>
      </label>
      <label className="grid gap-1 text-sm font-semibold">
        {t['admin.inspectionUsage']}
        <input
          type="number"
          min={usageValue}
          step="1"
          value={usage}
          onChange={(event) => setUsage(event.target.value)}
          className="min-h-10 rounded-lg border border-[#cbd8cc] bg-white px-3"
        />
      </label>
      <button
        type="submit"
        disabled={busy || Number(usage) < usageValue}
        className="min-h-10 rounded-lg bg-[#1f5948] px-4 font-semibold text-white disabled:opacity-50"
      >
        {busy ? t['admin.working'] : t['admin.saveInspection']}
      </button>
      {error ? (
        <p role="alert" className="text-sm text-red-800 sm:col-span-3">
          {error}
        </p>
      ) : null}
    </form>
  );
}
