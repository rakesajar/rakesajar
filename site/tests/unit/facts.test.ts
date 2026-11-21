import { describe, expect, it } from 'vitest';
import { FACTS } from '../../src/data/facts';
import {
  appliesOn,
  factById,
  factsFor,
  formatDate,
  isStale,
  maxAgeDays,
  parseDate,
  presentation,
  recheckDueDate,
} from '../../src/lib/facts';

const f = (id: string) => factById(FACTS, id);

describe('effective dates (CA-3, EV-2 regression across 1 Jan 2027)', () => {
  it('UK Graduate Route: 2 years for applications by 31 Dec 2026, 18 months from 1 Jan 2027', () => {
    expect(appliesOn(f('uk-graduate-2y'), '2026-12-31')).toBe(true);
    expect(appliesOn(f('uk-graduate-18m'), '2026-12-31')).toBe(false);
    expect(appliesOn(f('uk-graduate-2y'), '2027-01-01')).toBe(false);
    expect(appliesOn(f('uk-graduate-18m'), '2027-01-01')).toBe(true);
  });

  it('Singapore EP salary: S$5,600 until 31 Dec 2026, S$6,000 from 1 Jan 2027', () => {
    expect(appliesOn(f('sg-ep-min-2026'), '2026-11-21')).toBe(true);
    expect(appliesOn(f('sg-ep-min-2027'), '2026-11-21')).toBe(false);
    expect(appliesOn(f('sg-ep-min-2027'), '2027-03-01')).toBe(true);
  });

  it('litigated, proposed and conflict facts never apply', () => {
    for (const id of ['us-ds-rule', 'us-opt-fee', 'de-blocked-account']) expect(appliesOn(f(id), '2026-11-21')).toBe(false);
  });

  it('presentation never shows non-current statuses as current (VR-3, VR-5)', () => {
    expect(presentation(f('us-ds-rule'), '2026-11-21')).toBe('not_current');
    expect(presentation(f('de-blocked-account'), '2026-11-21')).toBe('not_current');
    expect(presentation(f('uk-graduate-18m'), '2026-11-21')).toBe('upcoming');
    expect(presentation(f('uk-graduate-2y'), '2027-02-01')).toBe('expired');
    expect(presentation(f('uk-visa-fee'), '2026-11-21')).toBe('current');
  });
});

describe('freshness (§9)', () => {
  it('max ages follow the freshness table', () => {
    expect(maxAgeDays(f('uk-visa-fee'))).toBe(7);
    expect(maxAgeDays(f('au-visa-fee'))).toBe(1);
    expect(maxAgeDays(f('jp-tuition-national'))).toBe(30);
  });

  it('flags stale facts once past max age', () => {
    expect(isStale(f('uk-visa-fee'), parseDate('2026-11-28'))).toBe(false);
    expect(isStale(f('uk-visa-fee'), parseDate('2026-11-29'))).toBe(true);
    expect(isStale(f('au-visa-fee'), parseDate('2026-11-23'))).toBe(true);
    expect(recheckDueDate(f('uk-visa-fee'))).toBe('2026-11-28');
  });
});

describe('helpers', () => {
  it('filters by destination and topic', () => {
    expect(factsFor(FACTS, 'uk', 'fees').map((x) => x.id)).toEqual(['uk-visa-fee']);
    expect(factsFor(FACTS, 'japan').length).toBeGreaterThan(2);
  });
  it('formats and parses dates in UTC', () => {
    expect(formatDate('2027-01-01')).toBe('1 Jan 2027');
    expect(() => parseDate('nope')).toThrow();
    expect(() => factById(FACTS, 'missing')).toThrow();
  });
});
