import { describe, expect, it } from 'vitest';
import { FACTS } from '../../src/data/facts';
import { annualise, convert, formatMoney, upfrontEstimate } from '../../src/lib/money';

const rates = { USD: 1.1, INR: 92, GBP: 0.85, CAD: 1.5 };

describe('currency conversion', () => {
  it('converts via EUR', () => {
    expect(convert(100, 'EUR', 'INR', rates)).toBeCloseTo(9200);
    expect(convert(110, 'USD', 'EUR', rates)).toBeCloseTo(100);
    expect(convert(85, 'GBP', 'USD', rates)).toBeCloseTo(110);
    expect(convert(5, 'JPY', 'JPY', {})).toBe(5);
  });
  it('returns null when a rate is unknown so the UI can ask for one', () => {
    expect(convert(1, 'AED', 'INR', rates)).toBeNull();
    expect(convert(1, 'USD', 'INR', { USD: 0, INR: 92 })).toBeNull();
  });
  it('formats money', () => {
    expect(formatMoney(1529, 'GBP')).toBe('£1,529');
    expect(formatMoney(45.5, 'SGD')).toContain('45.50');
    expect(formatMoney(535800, 'JPY')).toContain('535,800');
  });
  it('annualises periods', () => {
    expect(annualise({ amount: 10, per: 'month' })).toBe(120);
    expect(annualise({ amount: 10, per: 'fortnight' })).toBe(260);
    expect(annualise({ amount: 10, per: 'once' })).toBe(10);
  });
});

describe('upfront official costs (FR-3 totals)', () => {
  it('UK: monthly maintenance is shown per month, never multiplied by a guessed period', () => {
    const uk = upfrontEstimate(
      FACTS.filter((f) => f.destination === 'uk'),
      'GBP',
      '2026-11-21',
    );
    expect(uk.total).toBe(558);
    expect(uk.monthly).toMatchObject([{ factId: 'uk-maintenance-london', amount: 1529 }]);
  });
  it('labels multi-part fees distinctly', () => {
    const sg = upfrontEstimate(
      FACTS.filter((f) => f.destination === 'singapore'),
      'SGD',
      '2026-11-21',
    );
    expect(new Set(sg.lines.map((l) => l.label)).size).toBe(2);
  });
  it('formats rupees the Indian way, with lakh and crore', async () => {
    const { inrInWords } = await import('../../src/lib/money');
    expect(formatMoney(2022502, 'INR')).toBe('₹20,22,502');
    expect(inrInWords(2022502, 'INR')).toBe('about ₹20.2 lakh');
    expect(inrInWords(350000, 'INR')).toBe('about ₹3.5 lakh');
    expect(inrInWords(23400000, 'INR')).toBe('about ₹2.3 crore');
    expect(inrInWords(50000, 'INR')).toBe('');
    expect(inrInWords(2022502, 'USD')).toBe('');
  });
  it('Singapore: sums multi-part fees', () => {
    expect(
      upfrontEstimate(
        FACTS.filter((f) => f.destination === 'singapore'),
        'SGD',
        '2026-11-21',
      ).total,
    ).toBe(105);
  });
  it('Germany: quarantined blocked-account figure is excluded and reported', () => {
    const de = upfrontEstimate(
      FACTS.filter((f) => f.destination === 'germany'),
      'EUR',
      '2026-11-21',
    );
    expect(de.lines.some((l) => l.factId === 'de-blocked-account')).toBe(false);
    expect(de.excluded.map((x) => x.factId)).toContain('de-blocked-account');
  });
  it('USA: proposed OPT fee never enters totals', () => {
    const us = upfrontEstimate(
      FACTS.filter((f) => f.destination === 'usa'),
      'USD',
      '2026-11-21',
    );
    expect(us.total).toBe(185 + 350);
    expect(us.excluded.map((x) => x.factId)).toContain('us-opt-fee');
  });
  it('UAE: indicative tuition ranges are never totalled', () => {
    expect(
      upfrontEstimate(
        FACTS.filter((f) => f.destination === 'uae'),
        'AED',
        '2026-11-21',
      ).total,
    ).toBe(0);
  });
});

describe('first-year totals: timing and freshness', () => {
  it('Australia: the post-study 485 fee is not a first-year cost', () => {
    const au = upfrontEstimate(
      FACTS.filter((f) => f.destination === 'australia'),
      'AUD',
      '2026-11-21',
    );
    expect(au.lines.map((l) => l.factId)).not.toContain('au-485-fee');
    expect(au.total).toBe(2500 + 29710);
  });
  it('flags lines past their freshness limit at the viewer’s time', () => {
    const fresh = upfrontEstimate(
      FACTS.filter((f) => f.destination === 'uk'),
      'GBP',
      '2026-11-21',
      new Date('2026-11-22T00:00:00Z'),
    );
    expect(fresh.anyStale).toBe(false);
    const later = upfrontEstimate(
      FACTS.filter((f) => f.destination === 'uk'),
      'GBP',
      '2026-11-21',
      new Date('2026-12-05T00:00:00Z'),
    );
    expect(later.anyStale).toBe(true);
    expect([...later.lines, ...later.monthly].every((l) => l.stale)).toBe(true);
  });
});
