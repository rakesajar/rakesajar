import { describe, expect, it } from 'vitest';
import { DESTINATIONS } from '../../src/data/destinations';
import { FACTS, SIGNALS } from '../../src/data/facts';
import { CHANGES } from '../../src/data/changes';
import { ADMISSIONS_FACTS, INDIA_FACTS, institutionsFor } from '../../src/data/sourced';
import { ask } from '../../src/lib/concierge';
import { parseDate } from '../../src/lib/facts';
import { passageBacksValue, validateStore } from '../../src/lib/validate';

const store = { facts: FACTS, signals: SIGNALS, destinations: DESTINATIONS, originFacts: INDIA_FACTS };
const q = (question: string) => ask({ question, asOf: '2026-11-21', now: parseDate('2026-11-21') }, store);

describe('machine-sourced facts', () => {
  it('pass every verification rule, India facts included', () => {
    expect(validateStore({ facts: [...FACTS, ...INDIA_FACTS], signals: SIGNALS, changes: CHANGES }, '2026-11-21')).toEqual([]);
  });
  it('every one carries a verbatim passage that contains its figures', () => {
    for (const f of [...ADMISSIONS_FACTS, ...INDIA_FACTS]) {
      expect(f.verification, f.id).toBe('machine');
      expect(f.passage, f.id).toBeTruthy();
      expect(passageBacksValue(f), f.id).toEqual([]);
    }
  });
  it('covers three universities each in the UK, Canada and Australia’s two reachable ones', () => {
    expect(institutionsFor('uk').length).toBe(3);
    expect(institutionsFor('canada').length).toBe(3);
    expect(institutionsFor('australia').length).toBeGreaterThanOrEqual(2);
  });
  it('the figure check rejects a passage that lacks a number', () => {
    expect(
      passageBacksValue({ value: '80% overall', passage: 'a minimum of 70% overall', minimum: undefined, money: undefined }),
    ).toEqual(['80']);
  });
});

describe('Ask with admissions and India facts', () => {
  it('answers a named university’s Class XII minimum from its own page', () => {
    const a = q('What Class 12 percentage does McGill ask for?');
    expect(a.kind).toBe('answer');
    if (a.kind !== 'answer') return;
    expect(a.destinations).toEqual(['canada']);
    expect(a.items.map((i) => i.factId)).toContain('canada-mcgill-entry-ug');
    expect(a.items.every((i) => !i.institution || i.institution === 'McGill University')).toBe(true);
  });
  it('answers sending money from India without needing a destination', () => {
    const a = q('How much money can we send abroad for studies from India?');
    expect(a.kind === 'answer' && a.items.map((i) => i.factId)).toContain('in-lrs-limit');
  });
  it('answers apostille questions from MEA', () => {
    const a = q('How do I get my degree apostilled?');
    expect(a.kind === 'answer' && a.items.some((i) => i.factId.startsWith('in-apostille'))).toBe(true);
  });
  it('still refuses English-test questions about visas', () => {
    expect(q('Does PGWP need IELTS?')).toMatchObject({ kind: 'refuse', reason: 'no_facts' });
  });
});
