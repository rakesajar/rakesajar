/**
 * Public change log (PB-3, FR-4). In production the Publisher agent writes these entries.
 * Seed entries record what was logged when the fact store was created.
 */
import type { ChangeEntry } from './types';

export const CHANGES: ChangeEntry[] = [
  {
    id: 'c-2026-11-21-us-ds',
    destination: 'usa',
    date: '2026-11-21',
    title: 'US: the fixed admission period rule is being challenged in court',
    detail: 'A court vacated the rule replacing “duration of status” on 16 Nov 2026. We don’t show it as in force.',
    facts: ['us-ds-rule'],
    kind: 'litigated',
  },
  {
    id: 'c-2026-11-21-us-opt-fee',
    destination: 'usa',
    date: '2026-11-21',
    title: 'US: a new OPT fee has been proposed, not decided',
    detail: 'An OPT fee has been proposed but is not final. No fee is shown as payable.',
    facts: ['us-opt-fee'],
    kind: 'proposed',
  },
  {
    id: 'c-2026-11-21-uk-graduate',
    destination: 'uk',
    date: '2026-11-21',
    title: 'UK: the Graduate Route gets shorter for applications from 1 Jan 2027',
    detail:
      'Graduate Route: 2 years if you apply by 31 Dec 2026 → 18 months for applications from 1 Jan 2027. The PhD route (3 years) is unchanged in our records.',
    facts: ['uk-graduate-2y', 'uk-graduate-18m'],
    kind: 'announced',
  },
  {
    id: 'c-2026-11-21-sg-ep',
    destination: 'singapore',
    date: '2026-11-21',
    title: 'Singapore: the Employment Pass minimum salary rises on 1 Jan 2027',
    detail: 'Minimum qualifying salary S$5,600 → S$6,000 from 1 Jan 2027.',
    facts: ['sg-ep-min-2026', 'sg-ep-min-2027'],
    kind: 'announced',
  },
  {
    id: 'c-2026-11-21-de-blocked',
    destination: 'germany',
    date: '2026-11-21',
    title: 'Germany: the blocked account amount is being re-checked',
    detail:
      'Official sources disagree on the blocked-account amount. The last recorded value is shown with a “being re-checked” label and is left out of all totals.',
    facts: ['de-blocked-account'],
    kind: 'quarantined',
  },
  {
    id: 'c-2026-11-21-uk-budget',
    destination: 'uk',
    date: '2026-11-21',
    title: 'UK: reports of a 2-year Graduate Route for some universities',
    detail: 'Announced in Budget 2026. Shown as reported until the official route page confirms details.',
    facts: [],
    kind: 'reported',
  },
  {
    id: 'c-2026-11-21-seed',
    destination: 'all',
    date: '2026-11-21',
    title: 'First figures published for all 11 countries',
    detail:
      'Figures for all 11 countries were taken from official pages on 21 Nov 2026. Automatic re-checking is not running yet.',
    facts: [],
    kind: 'published',
  },
];
