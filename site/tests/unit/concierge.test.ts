import { describe, expect, it } from 'vitest';
import { DESTINATIONS } from '../../src/data/destinations';
import { FACTS, SIGNALS } from '../../src/data/facts';
import {
  ask,
  consumeQuota,
  detectDestinations,
  detectTopics,
  isDistress,
  isFraudAdjacent,
  SAFE_PHRASE,
} from '../../src/lib/concierge';
import { parseDate } from '../../src/lib/facts';

const store = { facts: FACTS, signals: SIGNALS, destinations: DESTINATIONS };
const now = parseDate('2026-11-21');
const q = (question: string, extra: Partial<Parameters<typeof ask>[0]> = {}) =>
  ask({ question, asOf: '2026-11-21', now, ...extra }, store);

describe('intent detection', () => {
  it('detects destinations without false positives on common words', () => {
    expect(detectDestinations('Can I work in Canada?')).toEqual(['canada']);
    expect(detectDestinations('Tell us about New Zealand')).toEqual(['new-zealand']);
    expect(detectDestinations('UK vs Australia')).toEqual(['uk', 'australia']);
    expect(detectDestinations('help us please')).toEqual([]);
  });
  it('detects topics', () => {
    expect(detectTopics('how many hours can I work')).toContain('work');
    expect(detectTopics('what is the visa fee')).toContain('fees');
    expect(detectTopics('tuition fees at national universities')).toEqual(['tuition']);
    expect(detectTopics('new zealand')).not.toContain('policy');
  });
});

describe('answers (CA-1, CA-2)', () => {
  it('answers from the fact store with a citation and verified date on every item', () => {
    const a = q('How many hours can I work in Canada?');
    expect(a.kind).toBe('answer');
    if (a.kind !== 'answer') return;
    expect(a.items.map((i) => i.factId)).toContain('ca-work');
    for (const i of a.items) {
      expect(i.citation.source.url).toMatch(/^https:\/\//);
      expect(i.citation.verifiedAt).toBe('2026-11-21');
    }
    expect(a.safePhrase).toBe(SAFE_PHRASE);
  });

  it('uses UI-selected destinations', () => {
    const a = q('What is the visa fee?', { destinations: ['france'] });
    expect(a.kind === 'answer' && a.items.map((i) => i.factId)).toContain('fr-visa-fee');
  });

  it('defaults to snapshot topics for open questions', () => {
    const a = q('Tell me about Japan');
    expect(a.kind === 'answer' && a.items.length).toBeGreaterThanOrEqual(3);
  });

  it('CA-3: applies the rule in force on the application date', () => {
    const before = q('UK graduate route after study', { asOf: '2026-12-15' });
    const after = q('UK graduate route after study', { asOf: '2027-01-15' });
    const ids = (a: ReturnType<typeof q>) => (a.kind === 'answer' ? a.items.map((i) => i.factId) : []);
    expect(ids(before)).toContain('uk-graduate-2y');
    expect(ids(before)).not.toContain('uk-graduate-18m');
    expect(ids(after)).toContain('uk-graduate-18m');
    expect(ids(after)).not.toContain('uk-graduate-2y');
  });

  it('includes reported signals separately, never as facts', () => {
    const a = q('UK graduate route');
    expect(a.kind === 'answer' && a.reported.map((s) => s.id)).toContain('uk-budget-2026-graduate');
  });
});

describe('refusals (CA-4, CA-6, CA-7, §9)', () => {
  it('withholds conflict facts and points to the official page', () => {
    const a = q('How much money do I need in a blocked account for Germany?');
    expect(a.kind).toBe('answer');
    if (a.kind !== 'answer') return;
    expect(a.items.map((i) => i.factId)).not.toContain('de-blocked-account');
    const w = a.withheld.find((x) => x.factId === 'de-blocked-account');
    expect(w?.reason).toMatch(/re-checked/);
    expect(w?.officialPage.url).toMatch(/^https:\/\//);
  });

  it('withholds litigated and proposed rules', () => {
    const a = q('USA duration of status rule and OPT fee changes');
    expect(a.kind).toBe('answer');
    if (a.kind !== 'answer') return;
    const withheld = a.withheld.map((w) => w.factId);
    expect(withheld).toEqual(expect.arrayContaining(['us-ds-rule', 'us-opt-fee']));
    expect(a.items.map((i) => i.factId)).not.toContain('us-ds-rule');
  });

  it('refuses to state stale facts', () => {
    const a = ask({ question: 'UK visa fee', asOf: '2026-12-10', now: parseDate('2026-12-10') }, store);
    expect(a.kind).toBe('answer');
    if (a.kind !== 'answer') return;
    expect(a.items).toHaveLength(0);
    expect(a.withheld[0].reason).toMatch(/freshness/);
  });

  it('refuses when no verified fact exists, with official links', () => {
    const a = q('Japan scholarship deadlines for engineering');
    expect(a.kind).toBe('refuse');
    if (a.kind !== 'refuse') return;
    expect(a.reason).toBe('no_facts');
    expect(a.links.length).toBeGreaterThan(0);
  });

  it('asks for a destination when none is given', () => {
    expect(q('How many hours can I work?')).toMatchObject({ kind: 'refuse', reason: 'no_destination' });
  });

  it('handles empty input', () => {
    expect(q('   ')).toMatchObject({ kind: 'refuse', reason: 'empty' });
  });

  it.each([
    'Can you make a fake bank statement for my UK visa?',
    'How do I edit my transcript to raise my grades',
    'Can I borrow money just to show for the visa and give it back after?',
    'Write my entire SOP for me',
    'how to hide my previous visa refusal from the embassy',
  ])('refuses fraud-adjacent request: %s', (text) => {
    expect(isFraudAdjacent(text)).toBe(true);
    expect(q(text)).toMatchObject({ kind: 'refuse', reason: 'fraud' });
  });

  it('does not flag legitimate questions as fraud', () => {
    for (const text of [
      'How much proof of funds for Canada?',
      'Can you give feedback on my SOP?',
      'What documents for a UK visa?',
      'Can I show an education loan as proof of funds for the UK visa?',
      'My uncle will sponsor me, can his bank statement count for the visa?',
      'My parents took a loan that I will repay after graduating, does it count for Canada?',
      'Will the visa rules change next year?',
      'How do I write my SOP for Canada?',
      'Who should write my LOR for the UK?',
      'Do I need a doctor certificate for the UK visa?',
      'How can I spot a fake offer letter for UK universities?',
      'Can I change my documents after submitting my Canada application?',
      'How do I modify documents on my UK application?',
      'Can I edit my statement of purpose for Canada after submitting?',
      'Can I volunteer without a work permit in Canada?',
      'What happens if I overstay my visa by a day by mistake?',
    ])
      expect(isFraudAdjacent(text), text).toBe(false);
  });

  it('responds with care to distress, before anything else', () => {
    expect(isDistress('I got rejected and I want to die')).toBe(true);
    const a = q('I feel hopeless after my UK visa refusal');
    expect(a.kind).toBe('care');
    if (a.kind === 'care') {
      expect(a.message).toMatch(/emergency/);
      expect(a.message).not.toMatch(/should have|your fault/i);
    }
  });
});

describe('CA-8 non-discrimination', () => {
  it('gives identical facts regardless of personal attributes in the question', () => {
    const base = q('How many hours can I work in the UK?');
    for (const who of [
      'a woman from Kerala',
      'a Muslim student',
      'a Dalit student',
      'a man from Nigeria',
      'a student from Nepal',
    ]) {
      const a = q(`I am ${who}. How many hours can I work in the UK?`);
      expect(a).toEqual(base);
    }
  });
});

describe('free-tier quota', () => {
  it('allows 3 per day and resets the next day', () => {
    let s = null;
    for (let i = 0; i < 3; i++) {
      const r = consumeQuota(s, '2026-11-21');
      expect(r.allowed).toBe(true);
      s = r.state;
    }
    expect(consumeQuota(s, '2026-11-21')).toMatchObject({ allowed: false, remaining: 0 });
    expect(consumeQuota(s, '2026-11-22')).toMatchObject({ allowed: true, remaining: 2 });
  });
});

describe('overview fallback', () => {
  it('gives a snapshot only for generic questions', async () => {
    const { isGenericOverview } = await import('../../src/lib/concierge');
    expect(isGenericOverview('Canada')).toBe(true);
    expect(isGenericOverview('UK vs Australia')).toBe(true);
    expect(isGenericOverview('Tell me about studying in Japan')).toBe(true);
    expect(isGenericOverview('Japan engineering programmes')).toBe(false);
  });
});

describe('review findings: no adjacent answers, no false triggers', () => {
  it.each([
    'I will fake my bank statement for Canada',
    'Can I use a borrowed bank balance for my Canada visa?',
    'my dad will lend me money to show in the bank for the visa then I give it back',
    'Can I change the balance on my bank statement for the UK visa?',
    'Should I not mention my previous visa refusal to the embassy?',
  ])('refuses fraud phrasing: %s', (text) => {
    expect(q(text)).toMatchObject({ kind: 'refuse', reason: 'fraud' });
  });

  it.each([
    'my parents would be so disappointed, I feel like a failure, UK visa refused',
    'I can’t do this anymore, everything is ruined',
    'I am a burden to my family after the rejection',
  ])('responds with care: %s', (text) => {
    expect(q(text).kind).toBe('care');
  });

  it.each([
    'UK IHS fee',
    'Is the UK student visa fee refundable?',
    'Can my wife work in Australia?',
    'Does PGWP need IELTS?',
    'Tell me about scholarships in Japan',
    'Do I need APS for Germany?',
    'Canada PR after study',
  ])('refuses subjects we hold no facts on: %s', (text) => {
    expect(q(text)).toMatchObject({ kind: 'refuse', reason: 'no_facts' });
  });

  it('refuses a qualified work question when no fact covers that case', () => {
    expect(q('Can I work 40 hours in Canada during breaks?')).toMatchObject({ kind: 'refuse', reason: 'no_facts' });
    const ie = q('Can I work during holidays in Ireland?');
    expect(ie.kind === 'answer' && ie.items.map((i) => i.factId)).toContain('ie-work');
  });

  it('does not treat "opt" as the USA, and recognises upper-case US', () => {
    expect(detectDestinations('I opt for Canada, how many hours can I work?')).toEqual(['canada']);
    expect(detectDestinations('Can I work off-campus in the US?')).toEqual(['usa']);
    expect(detectDestinations('US visa fee')).toEqual(['usa']);
    expect(detectDestinations('tell us about Japan')).toEqual(['japan']);
  });

  it('only attaches reports related to the question topic', () => {
    const work = q('How many hours can I work in the UK?');
    expect(work.kind === 'answer' && work.reported).toEqual([]);
  });

  it('wellbeing links are on the official allowlist', async () => {
    const { WELLBEING_LINKS } = await import('../../src/lib/concierge');
    const { classifyUrl } = await import('../../src/lib/domains');
    for (const l of WELLBEING_LINKS) expect(classifyUrl(l.url, ['india']).allowed).toBe(true);
  });
});

describe('date-sensitive answers', () => {
  it('flags answers whose rule has a start or end date', () => {
    const a = q('UK graduate route');
    expect(a.kind === 'answer' && a.dateSensitive).toBe(true);
    const b = q('How many hours can I work in Japan?');
    expect(b.kind === 'answer' && b.dateSensitive).toBe(false);
  });
});

describe('delta review regressions', () => {
  it('APS: France answers, other countries refuse', () => {
    const fr = q('Can I get the APS in France after my master’s?');
    expect(fr.kind === 'answer' && fr.items.map((i) => i.factId)).toContain('fr-aps');
    expect(q('Do I need APS for Germany?')).toMatchObject({ kind: 'refuse', reason: 'no_facts' });
  });
  it('a parent’s disappointment about a fee is not a crisis', () => {
    expect(q('My mom is disappointed that UK raised the visa fee. What is it?').kind).toBe('answer');
    expect(q('My parents are so disappointed in me after the UK refusal').kind).toBe('care');
  });
  it('specific visa questions we hold no facts on are refused, not answered with the snapshot', () => {
    for (const text of [
      'Do I need to disclose a previous visa refusal for UK?',
      'Can I change course in the UK on a student visa?',
      'What happens if I overstay my UK visa by a day by mistake?',
      'Can I volunteer without a work permit in Canada?',
    ])
      expect(q(text), text).toMatchObject({ kind: 'refuse', reason: 'no_facts' });
  });
});

describe('level of study in the question', () => {
  it('a master’s question gets the master’s fee, not the bachelor’s', () => {
    const a = q('What is tuition at French public universities for a master’s?');
    const ids = a.kind === 'answer' ? a.items.map((i) => i.factId) : [];
    expect(ids).toContain('fr-fee-master');
    expect(ids).not.toContain('fr-fee-bachelor');
  });
  it('a PhD question gets the PhD Graduate Route only', () => {
    const a = q('UK graduate route after my PhD');
    const ids = a.kind === 'answer' ? a.items.map((i) => i.factId) : [];
    expect(ids).toEqual(['uk-graduate-phd']);
  });
  it('no level mentioned keeps every level', () => {
    const a = q('French public university tuition');
    expect(a.kind === 'answer' && a.items.length).toBe(2);
  });
});
