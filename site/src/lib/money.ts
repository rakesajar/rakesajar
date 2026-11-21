/**
 * Money formatting, FX conversion and cost totals (FR-3 comparison totals, cost planner).
 * Totals only ever use facts that are current on the chosen date; quarantined or non-current
 * facts are excluded and reported so the UI can say why.
 */
import type { Fact, Money, Period } from '../data/types';
import { appliesOn, isStale, NOT_CURRENT } from './facts';

export const HOME_CURRENCIES = ['INR', 'USD', 'EUR', 'GBP', 'SGD', 'AUD', 'CAD', 'NZD', 'JPY', 'AED'] as const;
export type HomeCurrency = (typeof HOME_CURRENCIES)[number];

const ZERO_DECIMAL = new Set(['JPY', 'INR']);

export function formatMoney(amount: number, currency: string, locale?: string): string {
  // Rupees read the Indian way: ₹20,22,502, not ₹2,022,502.
  return new Intl.NumberFormat(locale ?? (currency === 'INR' ? 'en-IN' : 'en-GB'), {
    style: 'currency',
    currency,
    maximumFractionDigits: ZERO_DECIMAL.has(currency) || amount >= 1000 || Number.isInteger(amount) ? 0 : 2,
  }).format(amount);
}

/** "about ₹20.2 lakh" / "about ₹1.3 crore" for large rupee amounts; empty for anything else. */
export function inrInWords(amount: number, currency: string): string {
  if (currency !== 'INR' || amount < 100_000) return '';
  const crore = amount / 10_000_000;
  if (crore >= 1) return `about ₹${crore.toFixed(crore >= 10 ? 0 : 1)} crore`;
  const lakh = amount / 100_000;
  return `about ₹${lakh.toFixed(lakh >= 10 ? 1 : 2).replace(/\.?0+$/, '')} lakh`;
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
  /** Past its freshness limit at `now`: still shown, but flagged "re-check due". */
  stale: boolean;
  verifiedAt: string;
}

export interface Exclusion {
  factId: string;
  label: string;
  reason: string;
}

/** A figure set per month (e.g. maintenance funds). Shown beside the total, never multiplied by a guessed period. */
export interface MonthlyLine {
  factId: string;
  label: string;
  amount: number;
  currency: string;
  stale: boolean;
  verifiedAt: string;
}

export interface UpfrontEstimate {
  currency: string;
  lines: CostLine[];
  /** Monthly requirements, kept out of `total` because the official number of months is not in our facts. */
  monthly: MonthlyLine[];
  excluded: Exclusion[];
  total: number;
  /** True when any line in the total is due for re-checking. */
  anyStale: boolean;
}

function moneyOf(f: Fact): Money[] {
  return f.money ? [f.money] : (f.moneyParts ?? []);
}

/**
 * The official amounts we have verified: one-off visa/application fees and yearly funds figures. Monthly figures
 * are returned separately in `monthly` and never multiplied, because how many months count is not a fact we hold.
 * Tuition is user-entered (from the offer letter) because it varies by institution.
 * Fees paid after graduation (`costStage: 'post_study'`) are not first-year costs and are left out.
 * `now` (the viewer's clock) marks lines past their freshness limit so the UI can flag them.
 */
export function upfrontEstimate(
  facts: readonly Fact[],
  currency: string,
  asOf: string,
  now: Date = new Date(asOf + 'T00:00:00Z'),
): UpfrontEstimate {
  const lines: CostLine[] = [];
  const monthly: MonthlyLine[] = [];
  const excluded: Exclusion[] = [];
  for (const f of facts) {
    if (f.topic !== 'fees' && f.topic !== 'funds') continue;
    if (f.estimate || f.costStage === 'post_study') continue;
    if (NOT_CURRENT.has(f.status)) {
      excluded.push({ factId: f.id, label: f.label, reason: f.statusNote ?? 'Not in force' });
      continue;
    }
    if (!appliesOn(f, asOf)) continue;
    const stale = isStale(f, now);
    const meta = { stale, verifiedAt: f.verifiedAt };
    const parts = moneyOf(f);
    parts.forEach((m, i) => {
      if (m.currency !== currency) return;
      // Two charges under one fact get distinct labels so a breakdown never shows the same line twice.
      const label = parts.length > 1 ? `${f.label} (${i + 1} of ${parts.length})` : f.label;
      if (m.per === 'once') lines.push({ factId: f.id, label, amount: m.amount, currency, basis: 'One-off', ...meta });
      else if (m.per === 'year') lines.push({ factId: f.id, label, amount: m.amount, currency, basis: 'Per year', ...meta });
      else if (m.per === 'month') monthly.push({ factId: f.id, label, amount: m.amount, currency, ...meta });
      else
        lines.push({ factId: f.id, label, amount: annualise(m), currency, basis: `Per ${m.per} × periods in a year`, ...meta });
    });
  }
  return {
    currency,
    lines,
    monthly,
    excluded,
    total: lines.reduce((s, l) => s + l.amount, 0),
    anyStale: lines.some((l) => l.stale) || monthly.some((l) => l.stale),
  };
}
