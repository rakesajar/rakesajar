/**
 * Verifier rules applied to the fact store at build time (VR-1, VR-2, VR-4, VR-5, VR-6 units, DS-2).
 * The build fails if any error is returned, so a bad fact can never be published.
 */
import type { ChangeEntry, Fact, Signal } from '../data/types';
import { classifyUrl } from './domains';
import { parseDate } from './facts';

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const CURRENCIES = new Set(['SGD', 'USD', 'GBP', 'CAD', 'AUD', 'EUR', 'NZD', 'AED', 'JPY', 'INR']);

/** Currency symbols/codes as they appear in display values, used to cross-check `value` and `money`. */
const DISPLAY_PREFIX: Record<string, string[]> = {
  SGD: ['S$'],
  USD: ['US$'],
  GBP: ['£'],
  CAD: ['CA$'],
  AUD: ['AUD '],
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

function displayAmount(n: number): string {
  return n.toLocaleString('en-US');
}

export function validateFact(f: Fact, today: string): string[] {
  const e: string[] = [];
  const at = (msg: string) => e.push(`${f.id}: ${msg}`);

  if (!/^[a-z0-9-]+$/.test(f.id)) at('id must be kebab-case');
  if (!f.label.trim() || !f.value.trim()) at('label and value are required');
  if (f.sources.length === 0) at('at least one source is required');

  // DS-2 + tier rules.
  for (const s of f.sources) {
    const scope = f.origin ? [f.destination, f.origin] : [f.destination];
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

  // Units (VR-6).
  for (const m of [...(f.money ? [f.money] : []), ...(f.moneyParts ?? [])]) {
    if (!CURRENCIES.has(m.currency)) at(`unknown currency ${m.currency}`);
    if (!(m.amount > 0) || !Number.isFinite(m.amount)) at('amounts must be positive numbers');
    if (m.amountMax !== undefined && m.amountMax < m.amount) at('amountMax must be ≥ amount');
    if (m.amountMax !== undefined && !f.estimate) at('ranges must be flagged as estimates');
    // The displayed value must contain the structured amount, so figures can't drift apart.
    const shown = displayAmount(m.amount);
    if (!f.value.includes(shown)) at(`value "${f.value}" does not show amount ${shown}`);
    const prefixes = DISPLAY_PREFIX[m.currency] ?? [];
    if (prefixes.length && !prefixes.some((p) => f.value.includes(p)))
      at(`value "${f.value}" does not show currency ${m.currency}`);
  }
  return e;
}

export interface StoreInput {
  facts: readonly Fact[];
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
