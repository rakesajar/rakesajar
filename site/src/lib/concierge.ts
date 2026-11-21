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
      safePhrase: string;
    }
  | { kind: 'refuse'; reason: 'no_destination' | 'no_facts' | 'fraud' | 'empty'; message: string; links: SourceRef[] }
  | { kind: 'care'; message: string; links: SourceRef[] };

// --------------------------------------------------------------------------------- intent detection

const DESTINATION_ALIASES: Record<DestinationSlug, string[]> = {
  singapore: ['singapore', 'sg', 'nus', 'ntu'],
  usa: ['usa', 'u.s.', 'u.s.a.', 'america', 'united states', 'american', 'f-1', 'f1', 'opt'],
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
    'aps',
  ],
  fees: ['fee', 'fees', 'cost of visa', 'visa cost', 'sevis', 'charge', 'pay'],
  funds: ['funds', 'fund', 'bank', 'balance', 'maintenance', 'blocked account', 'living', 'proof of', 'money'],
  tuition: ['tuition', 'university fee', 'university fees', 'course fee', 'fees for university', 'college fee'],
  employment: ['salary', 'employment pass', 'ep ', 'work visa', 'qualifying'],
  policy: ['cap', 'change', 'changes', 'changing', 'court', 'duration of status', 'd/s', 'proposed'],
};

const FRAUD_PATTERNS = [
  /fake (bank|document|degree|certificate|transcript|statement|letter|offer)/,
  /forge|forged|forging/,
  /(edit|alter|photoshop|tamper).{0,20}(statement|transcript|certificate|document|passport)/,
  /borrow.{0,25}(money|funds).{0,40}(show|visa).{0,40}(return|(give|pay|send) (it |them )?back)/,
  /(show|park).{0,15}(money|funds).{0,30}(temporar|just for (the )?visa)/,
  /(hide|lie about|lie on|misrepresent|conceal).{0,30}(refusal|rejection|visa|funds|income|history)/,
  /(overstay|work more than|work illegally|cash in hand|without (a )?permit)/,
  /(write|draft) (my|the|an?) (entire |whole |full )?(essay|sop|statement of purpose|personal statement) for me/,
  /write (my|the) (entire |whole )?(essay|sop|statement of purpose|personal statement)/,
  /buy (a )?(degree|admission|visa)/,
];

const DISTRESS_PATTERNS = [
  /kill myself|end my life|suicid|want to die|self[- ]harm|hurt myself|no reason to live/,
  /(can'?t|cannot) (cope|go on|take it)|hopeless|worthless|panic attack|breaking down/,
  /(parents|family).{0,30}(will|would) (kill|disown|never forgive)/,
];

const WELLBEING_LINKS: SourceRef[] = [
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
  return (Object.keys(DESTINATION_ALIASES) as DestinationSlug[]).filter((slug) =>
    DESTINATION_ALIASES[slug].some((alias) => containsTerm(text, alias)),
  );
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
  return FRAUD_PATTERNS.some((p) => p.test(text));
}

export function isDistress(q: string): boolean {
  const text = normalise(q);
  return DISTRESS_PATTERNS.some((p) => p.test(text));
}

// --------------------------------------------------------------------------------- answering

const OVERVIEW = /\b(tell me about|overview|summary|summarise|summarize|basics|what about|how about|studying in|study in)\b/;
/** Subjects with no verified facts in the pilot store: never answered with an adjacent snapshot. */
const UNSUPPORTED =
  /\b(scholarships?|deadlines?|rankings?|ranked|ielts|toefl|pte|gre|gmat|intakes?|loans?|accommodation|insurance|acceptance rate)\b/;
const FILLER = new Set(['and', 'the', 'for', 'vs', 'versus', 'compare', 'what', 'about']);

/** True for broad questions where a snapshot (permission, work, after graduation) is the right answer. */
export function isGenericOverview(q: string): boolean {
  const text = normalise(q);
  if (UNSUPPORTED.test(text)) return false;
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
        'I can’t help with that. Misrepresenting documents, funds or history can lead to visa refusal and long-term bans. I can explain the official requirements so you can plan legitimately — for example, how much proof of funds a destination asks for, or what an essay should cover so you can write it yourself.',
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
    const candidates = store.facts.filter((f) => f.destination === slug && topics.includes(f.topic));
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

  const reported = store.signals.filter((s) => dests.includes(s.destination));
  return {
    kind: 'answer',
    destinations: dests,
    topics,
    asOf: input.asOf,
    items,
    withheld,
    reported,
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
