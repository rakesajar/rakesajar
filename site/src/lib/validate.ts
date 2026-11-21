/**
 * Verifier rules applied to the fact store at build time (VR-1, VR-2, VR-4, VR-5, VR-6 units, DS-2).
 * The build fails if any error is returned, so a bad fact can never be published.
 */
import type { ChangeEntry, Fact, OriginFact, Signal } from '../data/types';
import { classifyUrl } from './domains';
import { parseDate } from './facts';

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const CURRENCIES = new Set(['SGD', 'USD', 'GBP', 'CAD', 'AUD', 'EUR', 'NZD', 'AED', 'JPY', 'INR']);

/** Currency symbols/codes as they appear in display values, used to cross-check `value` and `money`. */
const DISPLAY_PREFIX: Record<string, string[]> = {
  SGD: ['S$'],
  USD: ['US$', 'USD '],
  GBP: ['£'],
  CAD: ['CA$', '$'],
  AUD: ['AUD ', 'A$', '$'],
  EUR: ['€'],
  NZD: ['NZD '],
  AED: ['AED '],
  JPY: ['¥'],
};

function isIsoDate(s: string): boolean {
  if (!ISO_DATE.test(s)) return false;
  try {
    parseDate(s);
    return true;
  } catch {
    return false;
  }
}

function displayAmounts(n: number): string[] {
  // Either grouping is fine: 250,000 or the Indian 2,50,000.
  return [n.toLocaleString('en-US'), n.toLocaleString('en-IN')];
}

/** Digits of every number in a string, with grouping separators removed ("2,50,000" → "250000"). */
function numbersIn(s: string): string[] {
  return (s.match(/\d[\d,.]*/g) ?? []).map((n) =>
    n
      .replace(/[.,]+$/, '')
      .replace(/,/g, '')
      .replace(/\.0+$/, ''),
  );
}

/**
 * A passage must actually contain the figures it backs: every number in the displayed value and in the
 * structured minimum/money must also appear in the quoted passage.
 */
export function passageBacksValue(f: Pick<Fact, 'value' | 'passage' | 'minimum' | 'money'>): string[] {
  if (!f.passage) return [];
  const inPassage = new Set(numbersIn(f.passage));
  const needed = [...numbersIn(f.value)];
  if (f.minimum) needed.push(String(f.minimum.min), ...('max' in f.minimum && f.minimum.max ? [String(f.minimum.max)] : []));
  if (f.money) needed.push(String(f.money.amount));
  return [...new Set(needed)].filter((n) => !inPassage.has(n));
}

export function validateFact(f: Fact | OriginFact, today: string): string[] {
  const e: string[] = [];
  const at = (msg: string) => e.push(`${f.id}: ${msg}`);

  if (!/^[a-z0-9-]+$/.test(f.id)) at('id must be kebab-case');
  if (!f.label.trim() || !f.value.trim()) at('label and value are required');
  if (f.sources.length === 0) at('at least one source is required');

  // DS-2 + tier rules.
  for (const s of f.sources) {
    const scope = 'destination' in f ? (f.origin ? [f.destination, f.origin] : [f.destination]) : [f.origin];
    const verdict = classifyUrl(s.url, scope);
    if (!verdict.allowed) at(`source ${s.url} rejected: ${verdict.reason}`);
    else if (verdict.tier !== s.tier) at(`source ${s.url} declared ${s.tier} but allowlist says ${verdict.tier}`);
    if (s.tier === 'T3') at('T3 sources can never establish a fact (VR-7)');
  }
  const tiers = new Set(f.sources.map((s) => s.tier));
  if (f.kind === 'rule' && !tiers.has('T1')) at('rule facts need at least one T1 source (VR-1)');
  if (f.kind === 'institution' && !tiers.has('T2') && !tiers.has('T1'))
    at('institution facts need the institution’s own T2 page or an official register (VR-2)');

  // Dates (VR-4).
  if (!isIsoDate(f.verifiedAt)) at('verifiedAt must be an ISO date');
  else if (f.verifiedAt > today) at('verifiedAt cannot be in the future');
  if (f.effectiveFrom && !isIsoDate(f.effectiveFrom)) at('effectiveFrom must be an ISO date');
  if (f.effectiveTo && !isIsoDate(f.effectiveTo)) at('effectiveTo must be an ISO date');
  if (f.effectiveFrom && f.effectiveTo && f.effectiveFrom > f.effectiveTo) at('effectiveFrom is after effectiveTo');
  if (f.status === 'in_force' && f.effectiveFrom && f.effectiveFrom > f.verifiedAt)
    at('future-dated values must be stored as announced, not in_force (VR-4)');
  if (f.status === 'announced' && !f.effectiveFrom) at('announced facts need an effectiveFrom date');

  // Non-current statuses must explain themselves to users (VR-3, VR-5).
  if (['proposed', 'litigated', 'conflict', 'superseded'].includes(f.status) && !f.statusNote)
    at(`status ${f.status} requires a statusNote`);

  // Provenance: passages are never invented; machine-verified facts must carry one.
  if (f.verification === 'machine' && !f.passage) at('machine-verified facts must include the source passage');
  for (const n of passageBacksValue(f)) at(`figure ${n} is not in the quoted passage`);
  if (f.topic === 'admissions' && (!f.institution || !f.aspect)) at('admissions facts need an institution and an aspect');
  if (f.minimum?.type === 'percent' && !(f.minimum.min > 0 && f.minimum.min <= 100)) at('percent minimum out of range');
  if (f.minimum?.type === 'ielts' && !(f.minimum.min > 0 && f.minimum.min <= 9)) at('IELTS minimum out of range');

  // Units (VR-6).
  for (const m of [...(f.money ? [f.money] : []), ...(f.moneyParts ?? [])]) {
    if (!CURRENCIES.has(m.currency)) at(`unknown currency ${m.currency}`);
    if (!(m.amount > 0) || !Number.isFinite(m.amount)) at('amounts must be positive numbers');
    if (m.amountMax !== undefined && m.amountMax < m.amount) at('amountMax must be ≥ amount');
    if (m.amountMax !== undefined && !f.estimate) at('ranges must be flagged as estimates');
    // The displayed value must contain the structured amount, so figures can't drift apart.
    const shown = displayAmounts(m.amount);
    if (!shown.some((x) => f.value.includes(x))) at(`value "${f.value}" does not show amount ${shown[0]}`);
    const prefixes = DISPLAY_PREFIX[m.currency] ?? [];
    if (prefixes.length && !prefixes.some((p) => f.value.includes(p)))
      at(`value "${f.value}" does not show currency ${m.currency}`);
  }
  return e;
}

export interface StoreInput {
  facts: readonly (Fact | OriginFact)[];
  signals: readonly Signal[];
  changes: readonly ChangeEntry[];
}

export function validateStore({ facts, signals, changes }: StoreInput, today: string): string[] {
  const errors: string[] = [];
  const ids = new Set<string>();
  for (const f of facts) {
    if (ids.has(f.id)) errors.push(`${f.id}: duplicate id`);
    ids.add(f.id);
    errors.push(...validateFact(f, today));
  }
  for (const s of signals) {
    const v = classifyUrl(s.watch.url, [s.destination]);
    if (!v.allowed) errors.push(`signal ${s.id}: watch page ${s.watch.url} rejected: ${v.reason}`);
  }
  for (const c of changes) {
    for (const id of c.facts) if (!ids.has(id)) errors.push(`change ${c.id}: unknown fact ${id}`);
    if (!isIsoDate(c.date)) errors.push(`change ${c.id}: invalid date`);
  }
  return errors;
}

/** Throws with every problem listed. Called from pages at build time. */
export function assertValidStore(input: StoreInput, today: string): void {
  const errors = validateStore(input, today);
  if (errors.length) throw new Error('Fact store failed verification:\n  ' + errors.join('\n  '));
}
