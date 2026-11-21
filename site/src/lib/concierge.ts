/**
 * Concierge preview — fact-store-only answering (CA-1 … CA-8).
 *
 * The pilot has no language model and no live search. It answers only from verified facts,
 * cites every figure with its verified date, refuses when a fact is not current, conflicting,
 * stale or missing, and never answers from memory. The production concierge keeps these rules
 * and adds live domain-filtered search between "fact store" and "refuse" (CA-1).
 */
import type { DestinationSlug, Fact, Signal, SourceRef, Topic } from '../data/types';
import type { Destination } from '../data/destinations';
import { appliesOn, isStale, NOT_CURRENT, STATUS_LABEL } from './facts';

export const SAFE_PHRASE = 'Confirm on the official page before paying or applying.';

export interface Citation {
  factId: string;
  source: SourceRef;
  verifiedAt: string;
}

export interface AnswerItem {
  factId: string;
  destination: DestinationSlug;
  label: string;
  value: string;
  conditions?: string;
  citation: Citation;
}

export interface Withheld {
  factId: string;
  destination: DestinationSlug;
  label: string;
  reason: string;
  officialPage: SourceRef;
}

export type Answer =
  | {
      kind: 'answer';
      destinations: DestinationSlug[];
      topics: Topic[];
      asOf: string;
      items: AnswerItem[];
      withheld: Withheld[];
      reported: Signal[];
      /** True when an item has a start or end date, so the answer depends on which application the date means. */
      dateSensitive: boolean;
      safePhrase: string;
    }
  | { kind: 'refuse'; reason: 'no_destination' | 'no_facts' | 'fraud' | 'empty'; message: string; links: SourceRef[] }
  | { kind: 'care'; message: string; links: SourceRef[] };

// --------------------------------------------------------------------------------- intent detection

const DESTINATION_ALIASES: Record<DestinationSlug, string[]> = {
  singapore: ['singapore', 'sg', 'nus', 'ntu'],
  usa: ['usa', 'u.s.', 'u.s.a.', 'america', 'united states', 'american', 'f-1', 'f1', 'in the us', 'the us', 'stem opt'],
  uk: ['uk', 'u.k.', 'united kingdom', 'britain', 'england', 'scotland', 'wales', 'london', 'graduate route'],
  canada: ['canada', 'canadian', 'pgwp', 'toronto', 'vancouver'],
  australia: ['australia', 'australian', 'aus', 'sydney', 'melbourne', 'subclass 500', '485'],
  germany: ['germany', 'german', 'deutschland', 'berlin', 'munich', 'blocked account'],
  france: ['france', 'french', 'paris', 'vls-ts', 'campus france'],
  ireland: ['ireland', 'irish', 'dublin', 'stamp 2', 'stamp 1g'],
  'new-zealand': ['new zealand', 'nz', 'auckland', 'wellington'],
  uae: ['uae', 'u.a.e.', 'emirates', 'dubai', 'abu dhabi', 'golden visa'],
  japan: ['japan', 'japanese', 'tokyo', 'osaka'],
};

const TOPIC_KEYWORDS: Record<Topic, string[]> = {
  permission: ['visa', 'permit', 'pass', 'permission', 'apply', 'application', 'coe', 'pal', 'tal', 'stamp 2'],
  work: ['work', 'job', 'part-time', 'part time', 'hours', 'earn', 'working'],
  post_study: [
    'after graduation',
    'after study',
    'after studies',
    'post-study',
    'post study',
    'graduate route',
    'graduate visa',
    'opt',
    'pgwp',
    '485',
    'stay back',
    'stay after',
    'job search',
    'job-search',
    'stamp 1g',
    'golden visa',
  ],
  fees: ['fee', 'fees', 'cost of visa', 'visa cost', 'sevis', 'charge', 'pay'],
  funds: ['funds', 'fund', 'bank', 'balance', 'maintenance', 'blocked account', 'living', 'proof of', 'money'],
  tuition: ['tuition', 'university fee', 'university fees', 'course fee', 'fees for university', 'college fee'],
  employment: ['salary', 'employment pass', 'ep ', 'work visa', 'qualifying'],
  policy: ['cap', 'change', 'changes', 'changing', 'court', 'duration of status', 'd/s', 'proposed'],
};

const FRAUD_PATTERNS = [
  // Borrowing only counts when the money is to be shown and then handed back; a real loan or sponsor is legitimate.
  /\b(borrow|lend|lent)\b.{0,80}\b(show|visa|bank|statement)\b.{0,60}\b(return|then (give|send|pay|transfer)|(give|pay|send) (it |them )?back)/,
  /\bborrowed (bank )?(balance|funds|money)\b/,
  /\b(show|park|deposit|put)\b.{0,30}\b(money|funds|balance)\b.{0,60}\b(temporar|just for (the )?visa|then (return|give|send|pay|transfer)|give (it |them )?back|return (it|them))/,
  /\b(hide|lie about|lie on|lie to|misrepresent|conceal|not mention|not disclose|don'?t (mention|disclose))\b.{0,40}\b(refusal|refused|rejection|rejected|visa|funds|income|history|gap|criminal|record|embassy|officer)/,
  /\b(overstay|work more than (allowed|permitted|the limit)|work illegally|cash in hand|without (a )?(work )?permit|work off the books)/,
  /\b(write|draft|do)\b (my|the|an?) (entire |whole |full |complete )?(essay|sop|statement of purpose|personal statement|lor|recommendation letter)\b.{0,20}(for me)?/,
  /\b(buy|purchase)\b (a |an )?(degree|admission|visa|seat|certificate)/,
];

/** Word-proximity rules: a misrepresentation verb within a few words of a document or money noun. */
const FRAUD_NEAR: { verbs: RegExp; nouns: RegExp; gap: number }[] = [
  {
    verbs: /^(fake|faking|faked|forge|forged|forging|fabricate|fabricated|counterfeit|doctor|doctored)$/,
    nouns:
      /^(bank|documents?|degrees?|certificates?|transcripts?|statements?|letters?|offers?|marksheets?|payslips?|sponsors?|itr|passports?|visas?)$/,
    gap: 5,
  },
  {
    verbs: /^(edit|edited|alter|altered|photoshop|photoshopped|tamper|tampered|change|modify|modified|inflate|inflated)$/,
    nouns: /^(statements?|transcripts?|certificates?|documents?|passports?|marksheets?|grades|marks|balance|payslips?)$/,
    gap: 5,
  },
];

function nearMatch(text: string): boolean {
  const words = text.split(/[^a-z0-9']+/).filter(Boolean);
  return FRAUD_NEAR.some(({ verbs, nouns, gap }) =>
    words.some((w, i) => verbs.test(w) && words.slice(i + 1, i + 1 + gap).some((n) => nouns.test(n))),
  );
}

const DISTRESS_PATTERNS = [
  /kill myself|end my life|end it all|suicid|want to die|wanna die|self[- ]harm|hurt myself|no reason to live|better off dead/,
  /(can'?t|cannot) (cope|go on|take it|do this|handle (this|it))|hopeless|worthless|panic attacks?|breaking down|falling apart/,
  /\b(i'?m|i am|i feel( like)?) (a )?(failure|useless|a burden|so ashamed|ashamed|disappointment)/,
  /(parents|family|dad|mum|mom|father|mother).{0,40}(disappointed|kill|disown|never forgive|ashamed of me|hate me)/,
  /everything is (ruined|over)|my life is (ruined|over)|ruined my life/,
];

export const WELLBEING_LINKS: SourceRef[] = [
  { url: 'https://telemanas.mohfw.gov.in', tier: 'T1', title: 'Tele-MANAS (Government of India mental health helpline)' },
];

export function normalise(q: string): string {
  return ' ' + q.toLowerCase().replace(/[’']/g, "'").replace(/\s+/g, ' ').trim() + ' ';
}

function termPattern(term: string, flags = ''): RegExp {
  // Word-boundary match that tolerates punctuation inside terms such as "u.s." or "f-1".
  const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  // eslint-disable-next-line security/detect-non-literal-regexp -- terms are static aliases, fully escaped above
  return new RegExp(`(^|[^a-z0-9])${escaped}(?=[^a-z0-9]|$)`, flags);
}

function containsTerm(text: string, term: string): boolean {
  return termPattern(term).test(text);
}

export function detectDestinations(q: string): DestinationSlug[] {
  const text = normalise(q);
  const found = (Object.keys(DESTINATION_ALIASES) as DestinationSlug[]).filter((slug) =>
    DESTINATION_ALIASES[slug].some((alias) => containsTerm(text, alias)),
  );
  // Upper-case "US" is the country; lower-case "us" is the pronoun.
  if (!found.includes('usa') && /(^|[^A-Za-z])US([^A-Za-z]|$)/.test(q)) found.push('usa');
  return found;
}

export function detectTopics(q: string): Topic[] {
  const text = normalise(q);
  const found = (Object.keys(TOPIC_KEYWORDS) as Topic[]).filter((t) =>
    TOPIC_KEYWORDS[t].some((k) => containsTerm(text, k.trim())),
  );
  // "Fees" for tuition questions should not also pull in visa fees unless the visa is mentioned.
  if (found.includes('tuition') && found.includes('fees') && !/visa|sevis|permit|application/.test(text))
    return found.filter((t) => t !== 'fees');
  return found;
}

export function isFraudAdjacent(q: string): boolean {
  const text = normalise(q);
  return nearMatch(text) || FRAUD_PATTERNS.some((p) => p.test(text));
}

export function isDistress(q: string): boolean {
  const text = normalise(q);
  return DISTRESS_PATTERNS.some((p) => p.test(text));
}

// --------------------------------------------------------------------------------- answering

const OVERVIEW = /\b(tell me about|overview|summary|summarise|summarize|basics|what about|how about|studying in|study in)\b/;
/** Subjects with no verified facts in the pilot store: never answered with an adjacent snapshot. */
const UNSUPPORTED =
  /\b(scholarships?|deadlines?|rankings?|ranked|ielts|toefl|pte|duolingo|gre|gmat|intakes?|loans?|accommodation|housing|insurance|acceptance rate|wife|husband|spouse|partner|dependants?|dependents?|children|kids|family visa|refund|refundable|ihs|health surcharge|nhs|permanent residen\w*|pr|citizenship|interview|refusal rate|success rate|chances?|wait(ing)? time|processing time|how long does it take|biometrics?|medical|police|aps|apostille)\b/;

/**
 * Qualifiers that narrow a question to a case our facts may not cover. Items in the topic are kept only if
 * the fact text mentions the qualifier; otherwise we refuse rather than answer the general rule.
 */
const QUALIFIERS: { ask: RegExp; fact: RegExp }[] = [
  { ask: /\b(breaks?|holidays?|vacations?|summer|winter break)\b/, fact: /holiday|vacation|break/ },
  { ask: /\b(off[- ]campus)\b/, fact: /off campus|off-campus/ },
  { ask: /\b(on[- ]campus)\b/, fact: /on campus|on-campus/ },
];

/** True when the question is about a subject the pilot fact store does not cover. */
export function isUnsupportedSubject(q: string): boolean {
  return UNSUPPORTED.test(normalise(q));
}
const FILLER = new Set(['and', 'the', 'for', 'vs', 'versus', 'compare', 'what', 'about']);

/** True for broad questions where a snapshot (permission, work, after graduation) is the right answer. */
export function isGenericOverview(q: string): boolean {
  const text = normalise(q);
  if (OVERVIEW.test(text)) return true;
  let rest = text;
  for (const aliases of Object.values(DESTINATION_ALIASES))
    for (const a of aliases) rest = rest.replace(termPattern(a, 'g'), ' ');
  return rest.split(/[^a-z]+/).every((w) => w.length <= 2 || FILLER.has(w));
}

function noFacts(dests: DestinationSlug[], store: Store): Answer {
  const links = dests.flatMap((s) => store.destinations.find((d) => d.slug === s)?.portals.slice(0, 1) ?? []);
  return {
    kind: 'refuse',
    reason: 'no_facts',
    message:
      'We don’t have a verified fact that answers this yet, and we never answer rules, fees or deadlines from memory. The official page below is the right place to check.',
    links,
  };
}

export interface AskInput {
  question: string;
  /** Explicit destination(s) chosen in the UI; merged with any detected in the question. */
  destinations?: DestinationSlug[];
  /** The user's application date (CA-3). ISO date. */
  asOf: string;
  now: Date;
}

export interface Store {
  facts: readonly Fact[];
  signals: readonly Signal[];
  destinations: readonly Destination[];
}

export function ask(input: AskInput, store: Store): Answer {
  const q = input.question.trim();
  if (!q) return { kind: 'refuse', reason: 'empty', message: 'Type a question to get started.', links: [] };

  // CA-7 wellbeing comes first: respond with care, never shame.
  if (isDistress(q)) {
    return {
      kind: 'care',
      message:
        'It sounds like things feel really heavy right now, and that matters more than any application. You don’t have to handle this alone. If you are in immediate danger, please contact local emergency services now. In India you can call Tele-MANAS, the free government mental-health helpline, at 14416, any time. Talking to someone you trust can also help. When you’re ready, your study plans will still be here, and we can take them one step at a time.',
      links: WELLBEING_LINKS,
    };
  }

  // CA-6 fraud-adjacent requests.
  if (isFraudAdjacent(q)) {
    return {
      kind: 'refuse',
      reason: 'fraud',
      message:
        'I can’t help with that. Misrepresenting documents, funds or history can lead to visa refusal and long-term bans. I can explain the official requirements so you can plan legitimately: for example, how much proof of funds a destination asks for, or what an essay should cover so you can write it yourself.',
      links: [],
    };
  }

  const dests = [...new Set([...(input.destinations ?? []), ...detectDestinations(q)])];
  if (dests.length === 0) {
    return {
      kind: 'refuse',
      reason: 'no_destination',
      message: 'Which country do you mean? Pick a destination, or name it in your question.',
      links: [],
    };
  }

  // A specific subject we hold no facts on (spouse visas, refunds, IELTS…) is refused before topic matching,
  // so a keyword like "visa" or "work" can't pull in a neighbouring fact as if it answered the question.
  if (isUnsupportedSubject(q)) return noFacts(dests, store);

  let topics = detectTopics(q);
  if (topics.length === 0) {
    // Only a generic question ("Tell me about Canada") gets the snapshot. A specific question we
    // have no verified facts for is refused rather than answered with something adjacent.
    if (!isGenericOverview(q)) return noFacts(dests, store);
    topics = ['permission', 'work', 'post_study'];
  }

  const items: AnswerItem[] = [];
  const withheld: Withheld[] = [];

  for (const slug of dests) {
    const dest = store.destinations.find((d) => d.slug === slug);
    const official = dest?.portals[0];
    const text = normalise(q);
    const active = QUALIFIERS.filter((qq) => qq.ask.test(text));
    const candidates = store.facts.filter(
      (f) =>
        f.destination === slug &&
        topics.includes(f.topic) &&
        // A qualified work question ("during holidays") only matches facts that mention that case.
        (f.topic !== 'work' || active.every((qq) => qq.fact.test(f.value.toLowerCase()))),
    );
    for (const f of candidates) {
      // Outside the user's application date window — not the applicable rule (CA-3).
      if ((f.status === 'in_force' || f.status === 'announced') && !appliesOn(f, input.asOf)) continue;
      const page = f.sources[0] ?? official;
      if (!page) continue;
      if (NOT_CURRENT.has(f.status)) {
        withheld.push({
          factId: f.id,
          destination: slug,
          label: f.label,
          reason: `${STATUS_LABEL[f.status]}. ${f.statusNote ?? ''}`.trim(),
          officialPage: page,
        });
        continue;
      }
      if (isStale(f, input.now)) {
        withheld.push({
          factId: f.id,
          destination: slug,
          label: f.label,
          reason: 'Our last verification is older than our freshness limit, so we won’t state it until it is re-checked.',
          officialPage: page,
        });
        continue;
      }
      items.push({
        factId: f.id,
        destination: slug,
        label: f.label,
        value: f.value,
        conditions: f.conditions,
        citation: { factId: f.id, source: page, verifiedAt: f.verifiedAt },
      });
    }
  }

  if (items.length === 0 && withheld.length === 0) return noFacts(dests, store);

  const reported = store.signals.filter((s) => dests.includes(s.destination) && s.topics.some((t) => topics.includes(t)));
  return {
    kind: 'answer',
    destinations: dests,
    topics,
    asOf: input.asOf,
    items,
    withheld,
    reported,
    dateSensitive: items.some((i) => {
      const f = store.facts.find((x) => x.id === i.factId);
      return !!(f?.effectiveFrom || f?.effectiveTo);
    }),
    safePhrase: SAFE_PHRASE,
  };
}

// --------------------------------------------------------------------------------- free-tier quota

export const FREE_DAILY_QUESTIONS = 3;

export interface QuotaState {
  day: string;
  used: number;
}

/** Returns the new state and whether the question is allowed. Pure, so it is unit-testable. */
export function consumeQuota(
  state: QuotaState | null,
  today: string,
  limit = FREE_DAILY_QUESTIONS,
): { allowed: boolean; state: QuotaState; remaining: number } {
  const current = state && state.day === today ? state : { day: today, used: 0 };
  if (current.used >= limit) return { allowed: false, state: current, remaining: 0 };
  const next = { day: today, used: current.used + 1 };
  return { allowed: true, state: next, remaining: limit - next.used };
}
