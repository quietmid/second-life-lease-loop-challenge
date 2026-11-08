import { z } from 'zod';
import type { AssetCategory, Customer, Question } from '@/data/schemas';
import { isoDateSchema } from '@/data/schemas';

export type ApplicationAnswers = Record<string, string>;
export type ApplicationContext = {
  customer: Customer;
  category: AssetCategory;
  financedCents: number;
  termMonths: number;
  signingDate: string;
  monthlyGrossCents: number;
};

/** Returns the applicable questions in order, discarding hidden earlier answers. */
export function applicableQuestions(
  questions: readonly Question[],
  context: ApplicationContext,
  answers: ApplicationAnswers
): { questions: Question[]; answers: ApplicationAnswers } {
  const activeAnswers: ApplicationAnswers = {};
  const activeQuestions: Question[] = [];
  for (const question of questions) {
    const values: Record<string, string | number> = {
      customer_type: context.customer.type,
      category: context.category,
      financed_amount_cents: context.financedCents,
      term_months: context.termMonths,
    };
    const applies = question.ask_when.every((condition) => {
      const value = condition.field.startsWith('answers.')
        ? activeAnswers[condition.field.slice('answers.'.length)]
        : values[condition.field];
      if (condition.op === 'in')
        return typeof value === 'string' && condition.value.includes(value);
      if (typeof value !== 'number') return false;
      return condition.op === 'gte' ? value >= condition.value : value <= condition.value;
    });
    if (applies) {
      activeQuestions.push(question);
      const answer = answers[question.id];
      if (answer !== undefined) activeAnswers[question.id] = answer;
    }
  }
  return { questions: activeQuestions, answers: activeAnswers };
}

/** Validates the Finnish Y-tunnus checksum, including the forbidden remainder of one. */
export function validBusinessId(value: string): boolean {
  if (!/^\d{7}-\d$/.test(value)) return false;
  const weights = [7, 9, 10, 5, 8, 4, 2];
  const remainder = weights.reduce((sum, weight, i) => sum + Number(value[i]) * weight, 0) % 11;
  const check = remainder === 0 ? 0 : 11 - remainder;
  return check < 10 && check === Number(value[8]);
}

export type ApplicationDecision =
  | { status: 'incomplete'; reason: 'invalid_answer'; questionId: string }
  | { status: 'declined'; reason: 'age' | 'residency' | 'affordability' | 'business_id' }
  | { status: 'review'; reason: 'pep' | 'signatory' }
  | { status: 'approved' };

/** Evaluates synthetic answers and never approves an incomplete or ineligible application. */
export function evaluateApplication(
  questions: readonly Question[],
  context: ApplicationContext,
  suppliedAnswers: ApplicationAnswers
): ApplicationDecision {
  const { questions: active, answers } = applicableQuestions(questions, context, suppliedAnswers);
  for (const question of active) {
    const answer = answers[question.id]?.trim() ?? '';
    const valid =
      answer.length > 0 &&
      answer.length <= 500 &&
      (question.type !== 'choice' || question.options?.includes(answer)) &&
      (question.type !== 'date' || isoDateSchema.safeParse(answer).success) &&
      (question.type !== 'email' || z.email().safeParse(answer).success) &&
      (question.type !== 'money' || /^(0|[1-9]\d{0,10})$/.test(answer));
    if (!valid || (question.id === 'q_customer_type' && answer !== context.customer.type)) {
      return { status: 'incomplete', reason: 'invalid_answer', questionId: question.id };
    }
  }
  const customer = context.customer;
  const birthDate =
    answers.q_birth_date ?? (customer.type !== 'company' ? customer.birth_date : '');
  if (customer.type !== 'company') {
    const cutoff = `${Number(context.signingDate.slice(0, 4)) - 18}${context.signingDate.slice(4)}`;
    if (birthDate > cutoff) return { status: 'declined', reason: 'age' };
  }
  const country = answers.q_country ?? customer.country;
  if (!['FI', 'SE', 'EE'].includes(country)) return { status: 'declined', reason: 'residency' };
  if (customer.type !== 'consumer' && !validBusinessId(answers.q_business_id ?? '')) {
    return { status: 'declined', reason: 'business_id' };
  }
  if (customer.type === 'consumer') {
    const income =
      answers.q_monthly_income === undefined
        ? customer.monthly_net_income_cents
        : Number(answers.q_monthly_income);
    if (context.monthlyGrossCents * 10 > income * 3) {
      return { status: 'declined', reason: 'affordability' };
    }
  }
  if (customer.is_pep || answers.q_pep === 'yes') return { status: 'review', reason: 'pep' };
  if (customer.type === 'company' && answers.q_can_sign === 'no') {
    return { status: 'review', reason: 'signatory' };
  }
  return { status: 'approved' };
}
