/**
 * Eligibility check against published minimums (replaces "reach / match / safe").
 *
 * It never scores, ranks or predicts. For each published minimum it says only how the student's own figure
 * compares with what the university states: meets it, is below it, or (for a stated range) where it falls.
 * Meeting a minimum is not an offer; universities consider more than marks.
 */
import type { Fact, Minimum } from '../data/types';

export type Verdict =
  | 'meets' // at or above a single stated minimum
  | 'below' // below the stated minimum (or below the lowest point of a range)
  | 'within_range' // inside a "varies by programme" range: depends on the programme's own figure
  | 'meets_range_top'; // at or above the highest point of a stated range

export const VERDICT_LABEL: Record<Verdict, string> = {
  meets: 'Meets the stated minimum',
  below: 'Below the stated minimum',
  within_range: 'Within the stated range: check your programme’s figure',
  meets_range_top: 'At or above the highest stated minimum',
};

export function compare(mine: number, min: Minimum): Verdict {
  const max = min.type === 'percent' ? min.max : undefined;
  if (mine < min.min) return 'below';
  if (max === undefined) return 'meets';
  return mine >= max ? 'meets_range_top' : 'within_range';
}

export interface EligibilityInput {
  stage: 'ug' | 'pg';
  /** Class XII percentage (UG) or bachelor's percentage (PG). */
  percent?: number;
  ielts?: number;
}

export interface Row {
  fact: Fact;
  kind: 'academic' | 'english';
  verdict: Verdict | null; // null when the student left that figure blank
}

export interface EligibilityResult {
  rows: Row[];
  /** Universities for which we hold no stated minimum of the relevant kind. */
  noMinimum: { slug: string; name: string; destination: Fact['destination'] }[];
}

const valid = (n: number | undefined, lo: number, hi: number) =>
  n !== undefined && Number.isFinite(n) && n >= lo && n <= hi ? n : undefined;

export function checkEligibility(facts: readonly Fact[], input: EligibilityInput): EligibilityResult {
  const percent = valid(input.percent, 0, 100);
  const ielts = valid(input.ielts, 0, 9);
  const rows: Row[] = [];
  for (const f of facts) {
    if (f.topic !== 'admissions' || !f.minimum || f.status !== 'in_force') continue;
    if (f.minimum.type === 'percent' && f.minimum.stage === input.stage)
      rows.push({ fact: f, kind: 'academic', verdict: percent === undefined ? null : compare(percent, f.minimum) });
    if (f.minimum.type === 'ielts')
      rows.push({ fact: f, kind: 'english', verdict: ielts === undefined ? null : compare(ielts, f.minimum) });
  }
  const withAcademic = new Set(rows.filter((r) => r.kind === 'academic').map((r) => r.fact.institution!.slug));
  const seen = new Map<string, EligibilityResult['noMinimum'][number]>();
  for (const f of facts)
    if (f.topic === 'admissions' && f.institution && !withAcademic.has(f.institution.slug))
      seen.set(f.institution.slug, { ...f.institution, destination: f.destination });
  const byName = (a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name, 'en');
  rows.sort((a, b) => byName(a.fact.institution!, b.fact.institution!) || a.kind.localeCompare(b.kind));
  return { rows, noMinimum: [...seen.values()].sort(byName) };
}
