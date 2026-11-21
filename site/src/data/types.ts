/**
 * Fact store types. Mirrors req.md v0.3 §8.1 (fact record) and §7.1 (source tiers).
 */

export type DestinationSlug =
  'singapore' | 'usa' | 'uk' | 'canada' | 'australia' | 'germany' | 'france' | 'ireland' | 'new-zealand' | 'uae' | 'japan';

export type OriginSlug = 'india';

/** T1 government/regulator, T2 official institution/statutory body, T3 early-warning only. */
export type Tier = 'T1' | 'T2' | 'T3';

/** §8.1 status plus `conflict` from VR-3. */
export type FactStatus = 'in_force' | 'announced' | 'proposed' | 'litigated' | 'superseded' | 'conflict';

/** §9 freshness classes. `volatile` = items flagged ⚠️ in the seed baseline. */
export type Volatility = 'volatile' | 'standard' | 'slow';

export type Topic = 'permission' | 'work' | 'post_study' | 'fees' | 'funds' | 'tuition' | 'employment' | 'policy';

/** Rule facts (visas, fees, work rights…) need T1 (VR-1); institution facts need T2 (VR-2). */
export type FactKind = 'rule' | 'institution';

export type Stage = 'ug' | 'pg' | 'phd';

export type Period = 'once' | 'year' | 'month' | 'week' | 'fortnight';

export interface Money {
  amount: number;
  /** Upper bound for ranges, e.g. tuition estimates. */
  amountMax?: number;
  currency: string;
  per: Period;
}

export interface SourceRef {
  url: string;
  tier: Tier;
  /** Human label for the page, e.g. "GOV.UK — Student visa". */
  title: string;
}

export interface Fact {
  id: string;
  destination: DestinationSlug;
  origin?: OriginSlug;
  topic: Topic;
  kind: FactKind;
  /** Short label shown next to the value. */
  label: string;
  /** Display value, exactly as it should appear. Figures here must match `money` when present. */
  value: string;
  money?: Money;
  /** Additional money components (e.g. two separate fees). */
  moneyParts?: Money[];
  conditions?: string;
  stages?: Stage[];
  /** ISO date (YYYY-MM-DD). */
  effectiveFrom?: string;
  effectiveTo?: string;
  status: FactStatus;
  sources: SourceRef[];
  /**
   * Exact passage from the source containing the value (VR-1). `null` for seed facts whose
   * passage has not yet been machine-extracted (Phase 0). Never invented.
   */
  passage: string | null;
  /** ISO date of last verification. */
  verifiedAt: string;
  /** `seed` = req.md §5 baseline; `machine` = verified by the Verifier agent. */
  verification: 'seed' | 'machine';
  volatility: Volatility;
  /** True for indicative ranges that are not an official fee. */
  estimate?: boolean;
  /** Free-text explanation shown with non-current statuses. */
  statusNote?: string;
}

/** A T3 or unconfirmed report (VR-7): shown as "reported", never as fact. */
export interface Signal {
  id: string;
  destination: DestinationSlug;
  summary: string;
  loggedAt: string;
  /** Official page the Monitor agent re-checks for confirmation. */
  watch: SourceRef;
  volatility: Volatility;
}

export interface ChangeEntry {
  id: string;
  destination: DestinationSlug | 'all';
  date: string;
  title: string;
  detail: string;
  /** Fact ids this change concerns. */
  facts: string[];
  kind: 'published' | 'announced' | 'litigated' | 'proposed' | 'quarantined' | 'reported';
}
