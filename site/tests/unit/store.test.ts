import { describe, expect, it } from 'vitest';
import { CHANGES } from '../../src/data/changes';
import { DESTINATIONS } from '../../src/data/destinations';
import { FACTS, SIGNALS } from '../../src/data/facts';
import type { Fact } from '../../src/data/types';
import { classifyUrl } from '../../src/lib/domains';
import { assertValidStore, validateFact, validateStore } from '../../src/lib/validate';

const TODAY = '2026-11-21';
const base = FACTS.find((f) => f.id === 'uk-visa-fee')!;
const variant = (patch: Partial<Fact>): Fact => ({ ...base, ...patch });

describe('seed fact store', () => {
  it('passes every verification rule', () => {
    expect(validateStore({ facts: FACTS, signals: SIGNALS, changes: CHANGES }, TODAY)).toEqual([]);
    expect(() => assertValidStore({ facts: FACTS, signals: SIGNALS, changes: CHANGES }, TODAY)).not.toThrow();
  });

  it('covers all 11 destinations with permission, work and post-study facts', () => {
    expect(DESTINATIONS).toHaveLength(11);
    for (const d of DESTINATIONS) {
      for (const topic of ['permission', 'work', 'post_study'] as const)
        expect(
          FACTS.some((f) => f.destination === d.slug && f.topic === topic),
          `${d.slug} ${topic}`,
        ).toBe(true);
    }
  });

  it('never invents passages for seed facts', () => {
    for (const f of FACTS) if (f.verification === 'seed') expect(f.passage).toBeNull();
  });

  it('uses only allowlisted official pages for portals and funding links', () => {
    for (const d of DESTINATIONS)
      for (const s of [...d.portals, ...d.funding, ...d.admissions]) {
        const v = classifyUrl(s.url, [d.slug]);
        expect(v.allowed, s.url).toBe(true);
        expect(v.tier, s.url).toBe(s.tier);
      }
  });
});

describe('verifier rules reject bad facts', () => {
  it('VR-1: rule facts need a T1 source', () => {
    const f = variant({ sources: [{ url: 'https://www.ukcisa.org.uk', tier: 'T2', title: 'UKCISA' }] });
    expect(validateFact(f, TODAY).join()).toMatch(/T1 source/);
  });

  it('VR-2: institution facts need T2 or official register', () => {
    const f = variant({ kind: 'institution', sources: [] });
    expect(validateFact(f, TODAY).join()).toMatch(/institution|at least one source/);
  });

  it('DS-2: non-allowlisted source domains fail', () => {
    const f = variant({ sources: [{ url: 'https://studyabroad-blog.com/uk', tier: 'T1', title: 'Blog' }] });
    expect(validateFact(f, TODAY).join()).toMatch(/not on the allowlist/);
  });

  it('declared tier must match the allowlist', () => {
    const f = variant({ sources: [{ url: 'https://www.gov.uk/x', tier: 'T2', title: 'x' }] });
    expect(validateFact(f, TODAY).join()).toMatch(/declared T2/);
  });

  it('T3 can never establish a fact (VR-7)', () => {
    const f = variant({ sources: [{ url: 'https://www.gov.uk/x', tier: 'T3', title: 'x' }] });
    expect(validateFact(f, TODAY).join()).toMatch(/T3/);
  });

  it('VR-4: future-dated values cannot be in_force', () => {
    const f = variant({ effectiveFrom: '2027-01-01', status: 'in_force' });
    expect(validateFact(f, TODAY).join()).toMatch(/announced/);
  });

  it('announced facts need an effective date', () => {
    expect(validateFact(variant({ status: 'announced' }), TODAY).join()).toMatch(/effectiveFrom/);
  });

  it('VR-3/VR-5: non-current statuses must explain themselves', () => {
    for (const status of ['conflict', 'litigated', 'proposed', 'superseded'] as const)
      expect(validateFact(variant({ status, statusNote: undefined }), TODAY).join()).toMatch(/statusNote/);
  });

  it('VR-6: displayed value and structured amount must agree', () => {
    const f = variant({ value: '£585', money: { amount: 558, currency: 'GBP', per: 'once' } });
    expect(validateFact(f, TODAY).join()).toMatch(/does not show amount/);
    const g = variant({ value: '558', money: { amount: 558, currency: 'GBP', per: 'once' } });
    expect(validateFact(g, TODAY).join()).toMatch(/currency/);
  });

  it('rejects bad units, ranges and dates', () => {
    const errs = validateFact(
      variant({
        id: 'Bad Id',
        money: { amount: -1, amountMax: -5, currency: 'XYZ', per: 'once' },
        verifiedAt: '2099-01-01',
        effectiveFrom: '2027-02-01',
        effectiveTo: '2027-01-01',
        status: 'announced',
      }),
      TODAY,
    ).join('\n');
    expect(errs).toMatch(/kebab-case/);
    expect(errs).toMatch(/unknown currency/);
    expect(errs).toMatch(/positive/);
    expect(errs).toMatch(/amountMax/);
    expect(errs).toMatch(/ranges must be flagged/);
    expect(errs).toMatch(/future/);
    expect(errs).toMatch(/after effectiveTo/);
  });

  it('rejects malformed dates', () => {
    const errs = validateFact(
      variant({ verifiedAt: '21/11/2026', effectiveFrom: 'soon', effectiveTo: '2026-13-45' }),
      TODAY,
    ).join();
    expect(errs).toMatch(/verifiedAt must be/);
    expect(errs).toMatch(/effectiveFrom must be/);
    expect(errs).toMatch(/effectiveTo must be/);
  });

  it('machine-verified facts must carry a passage', () => {
    expect(validateFact(variant({ verification: 'machine', passage: null }), TODAY).join()).toMatch(/passage/);
  });

  it('store-level checks catch duplicates, unknown change refs and bad signal pages', () => {
    const errs = validateStore(
      {
        facts: [base, base],
        signals: [{ ...SIGNALS[0], watch: { url: 'https://news.example.com', tier: 'T1', title: 'x' } }],
        changes: [{ ...CHANGES[0], facts: ['nope'], date: 'x' }],
      },
      TODAY,
    ).join('\n');
    expect(errs).toMatch(/duplicate/);
    expect(errs).toMatch(/unknown fact nope/);
    expect(errs).toMatch(/watch page/);
    expect(errs).toMatch(/invalid date/);
    expect(() => assertValidStore({ facts: [base, base], signals: [], changes: [] }, TODAY)).toThrow(/failed verification/);
  });
});
