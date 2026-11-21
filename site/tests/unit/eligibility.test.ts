import { describe, expect, it } from 'vitest';
import { FACTS } from '../../src/data/facts';
import { checkEligibility, compare, VERDICT_LABEL } from '../../src/lib/eligibility';

describe('compare against a published minimum (no scores, no chances)', () => {
  it('single minimum', () => {
    expect(compare(80, { type: 'percent', stage: 'ug', min: 80 })).toBe('meets');
    expect(compare(79.9, { type: 'percent', stage: 'ug', min: 80 })).toBe('below');
  });
  it('range that varies by programme', () => {
    const range = { type: 'percent' as const, stage: 'ug' as const, min: 80, max: 95 };
    expect(compare(75, range)).toBe('below');
    expect(compare(85, range)).toBe('within_range');
    expect(compare(95, range)).toBe('meets_range_top');
  });
  it('IELTS', () => {
    expect(compare(6.5, { type: 'ielts', min: 6.5 })).toBe('meets');
    expect(compare(6, { type: 'ielts', min: 6.5 })).toBe('below');
  });
  it('labels never talk about chances, scores or rankings', () => {
    for (const label of Object.values(VERDICT_LABEL)) expect(label).not.toMatch(/chance|likely|score|rank|safe|reach|match/i);
  });
});

describe('checkEligibility over sourced facts', () => {
  it('UG: compares Class XII % with every stated undergraduate minimum', () => {
    const r = checkEligibility(FACTS, { stage: 'ug', percent: 82, ielts: 6.5 });
    const academic = r.rows.filter((x) => x.kind === 'academic');
    expect(academic.length).toBeGreaterThan(0);
    expect(academic.every((x) => x.fact.minimum?.type === 'percent' && x.fact.minimum.stage === 'ug')).toBe(true);
    expect(r.rows.some((x) => x.kind === 'english')).toBe(true);
    // Universities with admissions facts but no stated UG minimum are listed separately, never guessed.
    expect(r.noMinimum.length).toBeGreaterThan(0);
  });
  it('PG uses master’s minimums only', () => {
    const r = checkEligibility(FACTS, { stage: 'pg', percent: 58 });
    for (const row of r.rows.filter((x) => x.kind === 'academic'))
      expect(row.fact.minimum?.type === 'percent' && row.fact.minimum.stage).toBe('pg');
  });
  it('blank or impossible figures give no verdict', () => {
    const r = checkEligibility(FACTS, { stage: 'ug', percent: 140 });
    expect(r.rows.every((x) => x.verdict === null)).toBe(true);
  });
});
