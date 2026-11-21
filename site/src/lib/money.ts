/**
 * Money formatting, FX conversion and cost totals (FR-3 comparison totals, cost planner).
 * Totals only ever use facts that are current on the chosen date; quarantined or non-current
 * facts are excluded and reported so the UI can say why.
 */
import type { Fact, Money, Period } from '../data/types';
import { appliesOn, NOT_CURRENT } from './facts';

export const HOME_CURRENCIES = ['INR', 'USD', 'EUR', 'GBP', 'SGD', 'AUD', 'CAD', 'NZD', 'JPY', 'AED'] as const;
export type HomeCurrency = (typeof HOME_CURRENCIES)[number];

const ZERO_DECIMAL = new Set(['JPY', 'INR']);

export function formatMoney(amount: number, currency: string, locale = 'en-GB'): string {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    maximumFractionDigits: ZERO_DECIMAL.has(currency) || amount >= 1000 || Number.isInteger(amount) ? 0 : 2,
  }).format(amount);
}

/** Rates expressed as "units of currency per 1 EUR" (ECB reference-rate convention). */
export type EurRates = Record<string, number>;

/** Converts via EUR. Returns null when either rate is unknown — the UI then asks for a manual rate. */
export function convert(amount: number, from: string, to: string, rates: EurRates): number | null {
  if (from === to) return amount;
  const rFrom = from === 'EUR' ? 1 : rates[from];
  const rTo = to === 'EUR' ? 1 : rates[to];
  if (!rFrom || !rTo || !(rFrom > 0) || !(rTo > 0)) return null;
  return (amount / rFrom) * rTo;
}

const PERIODS_PER_YEAR: Record<Period, number> = { once: 1, year: 1, month: 12, week: 52, fortnight: 26 };

export function annualise(m: Pick<Money, 'amount' | 'per'>): number {
  return m.amount * PERIODS_PER_YEAR[m.per];
}

export interface CostLine {
  factId: string;
  label: string;
  amount: number;
  currency: string;
  basis: string;
}

export interface Exclusion {
  factId: string;
  label: string;
  reason: string;
}

export interface UpfrontEstimate {
  currency: string;
  lines: CostLine[];
  excluded: Exclusion[];
  total: number;
}

function moneyOf(f: Fact): Money[] {
  return f.money ? [f.money] : (f.moneyParts ?? []);
}

/**
 * First-year official costs: one-off visa/application fees + one year of required funds.
 * Tuition is user-entered (from the offer letter) because it varies by institution.
 */
export function upfrontEstimate(facts: readonly Fact[], currency: string, asOf: string): UpfrontEstimate {
  const lines: CostLine[] = [];
  const excluded: Exclusion[] = [];
  for (const f of facts) {
    if (f.topic !== 'fees' && f.topic !== 'funds') continue;
    if (f.estimate) continue;
    if (NOT_CURRENT.has(f.status)) {
      excluded.push({ factId: f.id, label: f.label, reason: f.statusNote ?? 'Not in force' });
      continue;
    }
    if (!appliesOn(f, asOf)) continue;
    for (const m of moneyOf(f)) {
      if (m.currency !== currency) continue;
      if (m.per === 'once') lines.push({ factId: f.id, label: f.label, amount: m.amount, currency, basis: 'One-off' });
      else
        lines.push({
          factId: f.id,
          label: f.label,
          amount: annualise(m),
          currency,
          basis: m.per === 'year' ? 'Per year' : `Monthly figure × 12 (planning assumption)`,
        });
    }
  }
  return { currency, lines, excluded, total: lines.reduce((s, l) => s + l.amount, 0) };
}
