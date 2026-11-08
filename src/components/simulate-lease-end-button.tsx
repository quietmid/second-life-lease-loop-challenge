'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { AssetCondition } from '@/data/schemas';

export function SimulateLeaseEndButton({
  leaseId,
  customerId,
  endDate,
  condition,
  usageValue,
  returnPath,
  label,
  hint,
  errorMessage,
}: {
  leaseId: string;
  customerId: string;
  endDate: string;
  condition: AssetCondition;
  usageValue: number;
  returnPath: string;
  label: string;
  hint: string;
  errorMessage: string;
}) {
  const router = useRouter();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function simulate() {
    setBusy(true);
    setError('');
    try {
      const response = await fetch(`/api/demo/leases/${encodeURIComponent(leaseId)}/return`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customerId, date: endDate, condition, usageValue }),
      });
      if (!response.ok) {
        setError(errorMessage);
        return;
      }
      router.push(`${returnPath}?${new URLSearchParams({ profile: customerId, date: endDate })}`);
      router.refresh();
    } catch {
      setError(errorMessage);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-4 grid max-w-xl gap-2 rounded-xl bg-[#f5f7f0] p-4">
      <p className="text-sm text-[#526c61]">{hint}</p>
      <button
        type="button"
        disabled={busy}
        onClick={() => void simulate()}
        className="rounded-lg bg-[#1f5948] px-4 py-3 font-semibold text-white disabled:opacity-50"
      >
        {label}
      </button>
      {error ? (
        <p role="alert" className="text-red-800">
          {error}
        </p>
      ) : null}
    </div>
  );
}
