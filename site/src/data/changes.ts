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
    title: 'Fixed admission period rule marked as litigated',
    detail:
      'The rule replacing “duration of status” was vacated by a court on 16 Nov 2026. We store it as litigated and do not present it as in force.',
    facts: ['us-ds-rule'],
    kind: 'litigated',
  },
  {
    id: 'c-2026-11-21-us-opt-fee',
    destination: 'usa',
    date: '2026-11-21',
    title: 'New OPT fee recorded as a proposal',
    detail: 'An OPT fee has been proposed but is not final. No fee is shown as payable.',
    facts: ['us-opt-fee'],
    kind: 'proposed',
  },
  {
    id: 'c-2026-11-21-uk-graduate',
    destination: 'uk',
    date: '2026-11-21',
    title: 'Graduate Route length changes for applications from 1 Jan 2027',
    detail:
      'Graduate Route: 2 years if you apply by 31 Dec 2026 → 18 months for applications from 1 Jan 2027. The PhD route (3 years) is unchanged in our records.',
    facts: ['uk-graduate-2y', 'uk-graduate-18m'],
    kind: 'announced',
  },
  {
    id: 'c-2026-11-21-sg-ep',
    destination: 'singapore',
    date: '2026-11-21',
    title: 'Employment Pass minimum salary rises on 1 Jan 2027',
    detail: 'Minimum qualifying salary S$5,600 → S$6,000 from 1 Jan 2027.',
    facts: ['sg-ep-min-2026', 'sg-ep-min-2027'],
    kind: 'announced',
  },
  {
    id: 'c-2026-11-21-de-blocked',
    destination: 'germany',
    date: '2026-11-21',
    title: 'Blocked account figure quarantined',
    detail:
      'Official sources disagree on the blocked-account amount. The last recorded value is shown with a “being re-checked” label and is left out of all totals.',
    facts: ['de-blocked-account'],
    kind: 'quarantined',
  },
  {
    id: 'c-2026-11-21-uk-budget',
    destination: 'uk',
    date: '2026-11-21',
    title: 'Reported: 2-year Graduate Route for “high-compliance” universities',
    detail: 'Announced in Budget 2026. Shown as reported until the official route page confirms details.',
    facts: [],
    kind: 'reported',
  },
  {
    id: 'c-2026-11-21-seed',
    destination: 'all',
    date: '2026-11-21',
    title: 'Fact store created from the verified seed baseline',
    detail:
      'All 11 destinations published from the seed baseline verified on 21 Nov 2026. Automated re-verification takes over from here.',
    facts: [],
    kind: 'published',
  },
];
