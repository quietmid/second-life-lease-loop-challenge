'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export function ReturnButton({
  leaseId,
  customerId,
  date,
  label,
  errorMessage,
}: {
  leaseId: string;
  customerId: string;
  date: string;
  label: string;
  errorMessage: string;
}) {
  const router = useRouter();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  async function submit() {
    setBusy(true);
    setError('');
    try {
      const response = await fetch(`/api/demo/leases/${encodeURIComponent(leaseId)}/return`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customerId, date }),
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
    <div>
      <button
        onClick={submit}
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
    </div>
  );
}
