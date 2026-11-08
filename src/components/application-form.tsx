'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import type { ApplicationAnswers, ApplicationContext } from '@/domain/application';
import { applicableQuestions, evaluateApplication } from '@/domain/application';
import type { Question } from '@/data/schemas';
import type { Locale } from '@/i18n/locales';
import type { Messages } from '@/i18n/get-t';

type Props = {
  quoteId: string;
  customerId: string;
  date: string;
  locale: Locale;
  priceCents: number;
  context: ApplicationContext;
  questions: Question[];
  messages: Messages;
};

type SecurityStep = 'identity' | 'identity-success' | 'identity-failure' | 'signing';

function initialAnswers(context: ApplicationContext): ApplicationAnswers {
  const c = context.customer;
  return {
    q_customer_type: c.type,
    q_full_name: c.name,
    q_birth_date: c.type === 'company' ? '' : c.birth_date,
    q_email: c.email,
    q_country: c.country,
    q_employment: c.type === 'consumer' ? c.employment : '',
    q_monthly_income: c.type === 'consumer' ? String(c.monthly_net_income_cents) : '',
    q_business_id: c.type === 'consumer' ? '' : c.business_id,
    q_company_name: c.name,
    q_can_sign: c.type === 'company' ? (c.applicant_can_sign ? 'yes' : 'no') : '',
    q_vat_registered: c.type === 'consumer' ? '' : c.vat_registered ? 'yes' : 'no',
    q_annual_revenue: c.type === 'company' ? String(c.annual_revenue_cents) : '',
    q_beneficial_owners: c.type === 'company' ? (c.beneficial_owners ?? []).join(', ') : '',
    q_pep: c.is_pep ? 'yes' : 'no',
  };
}

export function ApplicationForm({
  quoteId,
  customerId,
  date,
  locale,
  priceCents,
  context,
  questions,
  messages: t,
}: Props) {
  const router = useRouter();
  const [answers, setAnswers] = useState<ApplicationAnswers>(() => initialAnswers(context));
  const [decision, setDecision] = useState<ReturnType<typeof evaluateApplication> | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [securityStep, setSecurityStep] = useState<SecurityStep>('identity');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const applicable = applicableQuestions(questions, context, answers);
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (confirming && !dialog.open) dialog.showModal();
    if (!confirming && dialog.open) dialog.close();
  }, [confirming]);
  function evaluate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const result = evaluateApplication(questions, context, applicable.answers);
    setDecision(result);
    if (result.status === 'approved') {
      setSecurityStep('identity');
      setConfirming(true);
    }
  }

  async function recordSecurityAction(stage: 'identity' | 'signing', outcome: string) {
    const response = await fetch(`/api/demo/quotes/${encodeURIComponent(quoteId)}/security`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ customerId, stage, outcome }),
    });
    const body = await response.json();
    return response.ok && body.success;
  }

  async function chooseIdentityOutcome(outcome: 'success' | 'failure') {
    setBusy(true);
    setError('');
    try {
      if (!(await recordSecurityAction('identity', outcome))) {
        setError(t['security.error']);
        return;
      }
      setSecurityStep(outcome === 'success' ? 'identity-success' : 'identity-failure');
    } catch {
      setError(t['security.error']);
    } finally {
      setBusy(false);
    }
  }

  async function cancelSecurityStep() {
    setBusy(true);
    setError('');
    try {
      const stage = securityStep === 'signing' ? 'signing' : 'identity';
      if (!(await recordSecurityAction(stage, 'cancelled'))) {
        setError(t['security.error']);
        return;
      }
      setConfirming(false);
    } catch {
      setError(t['security.error']);
    } finally {
      setBusy(false);
    }
  }

  async function sign() {
    setBusy(true);
    setError('');
    try {
      const response = await fetch(`/api/demo/quotes/${encodeURIComponent(quoteId)}/sign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId,
          signingDate: date,
          confirmedPriceCents: priceCents,
          answers: applicable.answers,
        }),
      });
      const body = await response.json();
      if (!response.ok || !body.success) {
        setError(t['journey.error']);
        return;
      }
      router.push(`/${locale}/account?${new URLSearchParams({ profile: customerId, date })}`);
      router.refresh();
    } catch {
      setError(t['journey.error']);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <form
        onSubmit={evaluate}
        className="mt-8 grid max-w-3xl gap-5 rounded-2xl border border-[#dce4dc] bg-white p-6"
      >
        <p className="text-sm text-[#526c61]">{t['journey.syntheticOnly']}</p>
        {applicable.questions.map((question) => (
          <label key={question.id} className="grid gap-2 text-sm font-semibold">
            {question.text[locale]}
            <span className="font-normal text-[#526c61]">
              {question.why_we_ask[locale] ?? question.why_we_ask.en}
            </span>
            {question.type === 'money' ? (
              <span className="font-normal">{t['journey.cents']}</span>
            ) : null}
            {question.type === 'choice' ? (
              <select
                value={answers[question.id] ?? ''}
                required
                onChange={(event) => {
                  const updated = { ...answers, [question.id]: event.target.value };
                  setAnswers(applicableQuestions(questions, context, updated).answers);
                  setDecision(null);
                }}
                className="rounded-lg border border-[#cbd8cc] p-3"
              >
                <option value="">{t['journey.select']}</option>
                {question.options?.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            ) : (
              <input
                value={answers[question.id] ?? ''}
                required
                type={
                  question.type === 'date' ? 'date' : question.type === 'email' ? 'email' : 'text'
                }
                onChange={(event) => {
                  const updated = { ...answers, [question.id]: event.target.value };
                  setAnswers(applicableQuestions(questions, context, updated).answers);
                  setDecision(null);
                }}
                className="rounded-lg border border-[#cbd8cc] p-3"
              />
            )}
          </label>
        ))}
        {decision && decision.status !== 'approved' ? (
          <p role="alert" className="rounded-lg bg-amber-50 p-4 text-amber-950">
            {decision.status === 'incomplete'
              ? t['journey.incomplete']
              : decision.status === 'review'
                ? t['journey.review']
                : t['journey.declined']}{' '}
            {decision.status !== 'incomplete' ? ` ${t[`journey.reason.${decision.reason}`]}` : ''}
          </p>
        ) : null}
        {error ? (
          <p role="alert" className="text-red-800">
            {error}
          </p>
        ) : null}
        <button className="rounded-lg bg-[#1f5948] p-3 font-semibold text-white">
          {t['journey.evaluate']}
        </button>
      </form>
      <dialog
        ref={dialogRef}
        onClose={() => setConfirming(false)}
        onCancel={(event) => {
          event.preventDefault();
          void cancelSecurityStep();
        }}
        aria-labelledby="sign-title"
        className="m-auto w-[calc(100%-2rem)] max-w-md rounded-2xl bg-white p-6 text-[#183b32] shadow-xl backdrop:bg-black/50"
      >
        {securityStep === 'identity' ? (
          <>
            <h2 id="sign-title" className="text-2xl font-semibold">
              {t['security.identityTitle']}
            </h2>
            <p role="status" className="mt-3 rounded-lg bg-[#e6f0e2] p-4 font-semibold">
              {t['journey.approved']}
            </p>
            <p className="mt-3 text-[#526c61]">{t['security.identityDescription']}</p>
            <p className="mt-2 text-sm text-[#526c61]">{t['security.identityCaveat']}</p>
            <div className="mt-6 grid gap-3">
              <button
                type="button"
                onClick={() => chooseIdentityOutcome('success')}
                disabled={busy}
                className="rounded-lg bg-[#1f5948] px-4 py-3 text-left font-semibold text-white disabled:opacity-50"
              >
                {t['security.simulateSuccess']}
              </button>
              <button
                type="button"
                onClick={() => chooseIdentityOutcome('failure')}
                disabled={busy}
                className="rounded-lg border border-[#cbd8cc] px-4 py-3 text-left disabled:opacity-50"
              >
                {t['security.simulateFailure']}
              </button>
              <button
                type="button"
                onClick={cancelSecurityStep}
                disabled={busy}
                className="rounded-lg px-4 py-3 text-left text-[#526c61] disabled:opacity-50"
              >
                {t['journey.cancel']}
              </button>
            </div>
          </>
        ) : securityStep === 'identity-success' ? (
          <>
            <h2 id="sign-title" className="text-2xl font-semibold">
              {t['security.identityTitle']}
            </h2>
            <p role="status" className="mt-4 rounded-lg bg-[#e6f0e2] p-4">
              {t['security.identitySuccess']}
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => setSecurityStep('signing')}
                className="rounded-lg bg-[#1f5948] px-4 py-3 font-semibold text-white"
              >
                {t['security.continueToSigning']}
              </button>
              <button
                type="button"
                onClick={cancelSecurityStep}
                disabled={busy}
                className="rounded-lg border border-[#cbd8cc] px-4 py-3 disabled:opacity-50"
              >
                {t['journey.cancel']}
              </button>
            </div>
          </>
        ) : securityStep === 'identity-failure' ? (
          <>
            <h2 id="sign-title" className="text-2xl font-semibold">
              {t['security.identityTitle']}
            </h2>
            <p role="status" className="mt-4 rounded-lg bg-amber-50 p-4 text-amber-950">
              {t['security.identityFailure']}
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => setSecurityStep('identity')}
                className="rounded-lg bg-[#1f5948] px-4 py-3 font-semibold text-white"
              >
                {t['security.tryAnotherOutcome']}
              </button>
              <button
                type="button"
                onClick={cancelSecurityStep}
                disabled={busy}
                className="rounded-lg border border-[#cbd8cc] px-4 py-3 disabled:opacity-50"
              >
                {t['journey.cancel']}
              </button>
            </div>
          </>
        ) : (
          <>
            <h2 id="sign-title" className="text-2xl font-semibold">
              {t['journey.confirmTitle']}
            </h2>
            <p role="status" className="mt-3 rounded-lg bg-[#e6f0e2] p-4 font-semibold">
              {t['journey.approved']}
            </p>
            <p className="mt-3 text-[#526c61]">{t['journey.confirmDescription']}</p>
            <div className="mt-6 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={cancelSecurityStep}
                disabled={busy}
                className="rounded-lg border border-[#cbd8cc] px-4 py-3 disabled:opacity-50"
              >
                {t['journey.cancel']}
              </button>
              <button
                type="button"
                onClick={sign}
                disabled={busy}
                className="rounded-lg bg-[#1f5948] px-4 py-3 font-semibold text-white disabled:opacity-50"
              >
                {t['journey.sign']}
              </button>
            </div>
          </>
        )}
        {error ? (
          <p role="alert" className="mt-4 text-sm text-red-800">
            {error}
          </p>
        ) : null}
      </dialog>
    </>
  );
}
