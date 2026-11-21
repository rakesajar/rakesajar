/**
 * Fact store queries and display rules (VR-3, VR-4, VR-5, CA-3, §9 freshness).
 */
import type { DestinationSlug, Fact, FactStatus, Topic, Volatility } from '../data/types';

/** §9 maximum age in days before a fact must be re-verified. */
export function maxAgeDays(fact: Pick<Fact, 'topic' | 'volatility'>): number {
  if (fact.volatility === 'volatile') return 1;
  switch (fact.topic) {
    case 'tuition':
      return 30;
    case 'permission':
    case 'work':
    case 'post_study':
    case 'fees':
    case 'funds':
    case 'employment':
    case 'policy':
      return 7;
  }
}

const DAY_MS = 86_400_000;

export function parseDate(iso: string): Date {
  const d = new Date(iso + 'T00:00:00Z');
  if (Number.isNaN(d.getTime())) throw new Error(`Invalid date: ${iso}`);
  return d;
}

export function toIsoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** True when the fact is past its §9 max age at `now` and must not be used in answers. */
export function isStale(fact: Pick<Fact, 'topic' | 'volatility' | 'verifiedAt'>, now: Date): boolean {
  const age = (now.getTime() - parseDate(fact.verifiedAt).getTime()) / DAY_MS;
  return age > maxAgeDays(fact);
}

export function recheckDueDate(fact: Pick<Fact, 'topic' | 'volatility' | 'verifiedAt'>): string {
  return toIsoDate(new Date(parseDate(fact.verifiedAt).getTime() + maxAgeDays(fact) * DAY_MS));
}

/**
 * Whether the fact applies on `asOf` (an ISO date — e.g. the user's application date).
 * `announced` facts apply once their effective date arrives; `in_force` facts stop at `effectiveTo`.
 */
export function appliesOn(fact: Fact, asOf: string): boolean {
  if (fact.effectiveFrom && asOf < fact.effectiveFrom) return false;
  if (fact.effectiveTo && asOf > fact.effectiveTo) return false;
  return fact.status === 'in_force' || fact.status === 'announced';
}

/** Statuses that must never be presented as the current rule (VR-3, VR-5). */
export const NOT_CURRENT: ReadonlySet<FactStatus> = new Set(['proposed', 'litigated', 'conflict', 'superseded']);

export type Presentation = 'current' | 'upcoming' | 'expired' | 'not_current';

/** How a guide should present a fact on `today`. */
export function presentation(fact: Fact, today: string): Presentation {
  if (NOT_CURRENT.has(fact.status)) return 'not_current';
  if (fact.effectiveFrom && today < fact.effectiveFrom) return 'upcoming';
  if (fact.effectiveTo && today > fact.effectiveTo) return 'expired';
  return 'current';
}

export function factsFor(facts: readonly Fact[], destination: DestinationSlug, topic?: Topic): Fact[] {
  return facts.filter((f) => f.destination === destination && (!topic || f.topic === topic));
}

export function factById(facts: readonly Fact[], id: string): Fact {
  const f = facts.find((x) => x.id === id);
  if (!f) throw new Error(`Unknown fact ${id}`);
  return f;
}

export const STATUS_LABEL: Record<FactStatus, string> = {
  in_force: 'In force',
  announced: 'Announced',
  proposed: 'Proposed — not final',
  litigated: 'In litigation',
  superseded: 'Superseded',
  conflict: 'Being re-checked',
};

export const PRESENTATION_LABEL: Record<Presentation, string> = {
  current: 'Current',
  upcoming: 'Upcoming',
  expired: 'Expired',
  not_current: 'Not in force',
};

export const VOLATILITY_LABEL: Record<Volatility, string> = {
  volatile: 'Fast-changing',
  standard: 'Standard',
  slow: 'Slow-changing',
};

export const TOPIC_LABEL: Record<Topic, string> = {
  permission: 'Study permission',
  work: 'Work during studies',
  post_study: 'After graduation',
  fees: 'Visa and application fees',
  funds: 'Proof of funds',
  tuition: 'Tuition',
  employment: 'Employment rules',
  policy: 'Policy',
};

/** Formats an ISO date as e.g. "21 Nov 2026" (UTC, locale-independent). */
export function formatDate(iso: string): string {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const d = parseDate(iso);
  return `${d.getUTCDate()} ${months[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}
