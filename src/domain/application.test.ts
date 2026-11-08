import { describe, expect, it } from 'vitest';
import { loadCustomers, loadQuestions } from '@/data/load';
import { applicableQuestions, evaluateApplication, validBusinessId } from './application';

describe('demo application', () => {
  it('only keeps answers for questions that still apply', async () => {
    const [customers, { questions }] = await Promise.all([loadCustomers(), loadQuestions()]);
    const customer = customers.find((entry) => entry.id === 'cust-aino');
    if (!customer || customer.type !== 'consumer') throw new Error('Missing consumer');
    const result = applicableQuestions(
      questions,
      {
        customer,
        category: 'laptop',
        financedCents: 100000,
        termMonths: 12,
        signingDate: '2026-11-05',
        monthlyGrossCents: 10000,
      },
      { q_customer_type: 'consumer', q_usage_purpose: 'delivery', q_pep: 'yes' }
    );
    expect(result.answers).toEqual({ q_customer_type: 'consumer' });
    expect(result.questions.some((question) => question.id === 'q_usage_purpose')).toBe(false);
  });

  it('checks business ID format and checksum', () => {
    expect(validBusinessId('0112038-9')).toBe(true);
    expect(validBusinessId('0112038-8')).toBe(false);
    expect(validBusinessId('invalid')).toBe(false);
  });

  it('does not approve unanswered, underage, or unaffordable applications', async () => {
    const [customers, { questions }] = await Promise.all([loadCustomers(), loadQuestions()]);
    const customer = customers.find((entry) => entry.id === 'cust-aino');
    if (!customer || customer.type !== 'consumer') throw new Error('Missing consumer');
    const context = {
      customer,
      category: 'laptop' as const,
      financedCents: 100000,
      termMonths: 12,
      signingDate: '2026-11-05',
      monthlyGrossCents: 10000,
    };
    const answers = {
      q_customer_type: 'consumer',
      q_full_name: customer.name,
      q_birth_date: customer.birth_date,
      q_email: customer.email,
      q_country: 'FI',
      q_employment: 'employed',
    };
    expect(evaluateApplication(questions, context, {})).toMatchObject({ status: 'incomplete' });
    expect(evaluateApplication(questions, context, answers)).toEqual({ status: 'approved' });
    expect(
      evaluateApplication(questions, context, { ...answers, q_birth_date: '2010-01-01' })
    ).toEqual({ status: 'declined', reason: 'age' });
    expect(
      evaluateApplication(questions, { ...context, monthlyGrossCents: 100000 }, answers)
    ).toEqual({ status: 'declined', reason: 'affordability' });
  });

  it('requires review for a politically exposed applicant', async () => {
    const [customers, { questions }] = await Promise.all([loadCustomers(), loadQuestions()]);
    const customer = customers.find((entry) => entry.id === 'cust-aino');
    if (!customer || customer.type !== 'consumer') throw new Error('Missing consumer');
    const answers = {
      q_customer_type: 'consumer',
      q_full_name: customer.name,
      q_birth_date: customer.birth_date,
      q_email: customer.email,
      q_country: 'FI',
      q_employment: 'employed',
      q_monthly_income: '320000',
      q_pep: 'yes',
      q_pep_details: 'Fictional example',
    };
    const context = {
      customer,
      category: 'laptop' as const,
      financedCents: 1000000,
      termMonths: 12,
      signingDate: '2026-11-05',
      monthlyGrossCents: 10000,
    };
    expect(evaluateApplication(questions, context, answers)).toEqual({
      status: 'review',
      reason: 'pep',
    });
  });
});
