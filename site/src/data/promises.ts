/**
 * Our promises: the things Pathfinder will not do. Each one says why it matters to a family choosing where to
 * study, what keeps us to it, and how a visitor can check it themselves. Every "how to check" must point at
 * something that exists on the site today; never add a promise we can't show.
 */
export interface Pledge {
  id: string;
  /** Arrival-card question, answered "No". */
  question: string;
  /** Short title used in the full section. */
  title: string;
  why: string;
  howWeKeepIt: string;
  check: { label: string; href: string };
}

export const PROMISES: Pledge[] = [
  {
    id: 'no-commission',
    question: 'Does any university, agent or lender pay us?',
    title: 'We don’t take commissions',
    why: 'When someone is paid for each student they place, their advice leans towards whoever pays. You deserve information that has no reason to lean.',
    howWeKeepIt:
      'No university, agent or lender pays us anything. The plan is for families who choose Premium to be the only ones who pay us.',
    check: { label: 'Read the no-commission policy', href: '/about#no-commission' },
  },
  {
    id: 'no-rankings',
    question: 'Do we rank universities or rate your chances?',
    title: 'We don’t rank universities or predict admissions',
    why: 'Nobody outside an admissions office can honestly tell you your chances, and rankings measure what the ranker chooses, not what matters to you.',
    howWeKeepIt:
      'There are no rankings, scores or “featured” universities anywhere on Pathfinder. Countries are listed in the same order for everyone.',
    check: { label: 'See all destinations', href: '/destinations' },
  },
  {
    id: 'no-ghostwriting',
    question: 'Will we write your statement of purpose for you?',
    title: 'We won’t write your essays',
    why: 'Admissions teams want to hear you. An essay someone else wrote can cost you the offer, and the habit of it can cost you more.',
    howWeKeepIt:
      'Ask Pathfinder refuses requests to write an SOP or essay for you. Premium will give feedback on what you write.',
    check: { label: 'Try asking it', href: '/ask' },
  },
  {
    id: 'no-passwords',
    question: 'Will we ask for your portal passwords or fill in forms?',
    title: 'We never ask for your passwords',
    why: 'Your university and visa portals hold your passport, money and future. Only you should be able to sign in to them.',
    howWeKeepIt:
      'Pathfinder has no feature that submits forms, pays fees or stores logins. If anyone claiming to be us asks for a password, it isn’t us.',
    check: { label: 'Read our privacy page', href: '/privacy' },
  },
  {
    id: 'no-memory',
    question: 'Do we state a rule or fee without its official source?',
    title: 'We don’t quote anything we can’t source',
    why: 'Visa rules and fees change. A confident answer from memory is the most expensive kind of wrong.',
    howWeKeepIt:
      'Every figure on the site is tied to a record with an official link and a date. The site won’t publish if a figure on any page is missing its source.',
    check: { label: 'Download every fact we publish', href: '/facts.json' },
  },
  {
    id: 'no-quiet-edits',
    question: 'Do we change a fact without telling you?',
    title: 'We don’t change things quietly',
    why: 'If a rule moved after you read it, you need to know what changed and when, not discover it at the visa counter.',
    howWeKeepIt:
      'Announced, proposed, disputed and court-blocked rules carry a stamp, and every change goes in a public log with its date.',
    check: { label: 'Read the change log', href: '/changes' },
  },
];

/** Promises about honesty that don't fit a yes/no card but belong in the full list. */
export const CANDOUR = [
  {
    title: 'We won’t pretend to be a person',
    body: 'Pathfinder is run by software. No editor reviews a page before you see it, which is exactly why every figure shows its source and date, so you can check us.',
  },
  {
    title: 'We won’t pretend old information is fresh',
    body: 'When a fact passes its re-check date, the page says “re-check due” and Ask Pathfinder stops quoting it, even if that makes us look less complete.',
  },
];
