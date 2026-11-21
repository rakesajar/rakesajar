/**
 * Trusted-source allowlist. Starting list from req.md v0.3 §7.2.
 * Patterns: exact host (`gov.uk`) matches the host and its subdomains.
 * Suffix patterns (`*.edu`) match any registrable domain under that public suffix.
 * Only the Source Registry agent may extend this list, and only under DS-3.
 */
import type { DestinationSlug, OriginSlug, Tier } from './types';

export interface AllowEntry {
  pattern: string;
  tier: Exclude<Tier, 'T3'>;
  note?: string;
}

export const ALLOWLIST: Record<DestinationSlug | OriginSlug, AllowEntry[]> = {
  singapore: [
    { pattern: 'ica.gov.sg', tier: 'T1' },
    { pattern: 'mom.gov.sg', tier: 'T1' },
    { pattern: 'moe.gov.sg', tier: 'T1' },
    { pattern: 'ssg.gov.sg', tier: 'T1' },
    { pattern: 'nus.edu.sg', tier: 'T2' },
    { pattern: 'ntu.edu.sg', tier: 'T2' },
    { pattern: 'smu.edu.sg', tier: 'T2' },
    { pattern: 'sutd.edu.sg', tier: 'T2' },
    { pattern: 'singaporetech.edu.sg', tier: 'T2' },
    { pattern: 'suss.edu.sg', tier: 'T2' },
    { pattern: 'a-star.edu.sg', tier: 'T2' },
  ],
  usa: [
    { pattern: 'travel.state.gov', tier: 'T1' },
    { pattern: 'uscis.gov', tier: 'T1' },
    { pattern: 'ice.gov', tier: 'T1' },
    { pattern: 'studyinthestates.dhs.gov', tier: 'T1' },
    { pattern: 'federalregister.gov', tier: 'T1' },
    { pattern: 'dhs.gov', tier: 'T1' },
    { pattern: '*.edu', tier: 'T2', note: 'International-office pages only' },
  ],
  uk: [
    { pattern: 'gov.uk', tier: 'T1' },
    { pattern: 'ukcisa.org.uk', tier: 'T2' },
    { pattern: '*.ac.uk', tier: 'T2' },
  ],
  canada: [{ pattern: 'canada.ca', tier: 'T1' }],
  australia: [
    { pattern: 'homeaffairs.gov.au', tier: 'T1' },
    { pattern: 'immi.homeaffairs.gov.au', tier: 'T1' },
    { pattern: 'studyaustralia.gov.au', tier: 'T1' },
    { pattern: 'cricos.education.gov.au', tier: 'T1' },
    { pattern: 'education.gov.au', tier: 'T1' },
    { pattern: '*.edu.au', tier: 'T2' },
  ],
  germany: [
    { pattern: 'auswaertiges-amt.de', tier: 'T1' },
    { pattern: 'diplo.de', tier: 'T1', note: 'German missions abroad' },
    { pattern: 'make-it-in-germany.com', tier: 'T1' },
    { pattern: 'bamf.de', tier: 'T1' },
    { pattern: 'daad.de', tier: 'T2' },
  ],
  france: [
    { pattern: 'france-visas.gouv.fr', tier: 'T1' },
    { pattern: 'service-public.gouv.fr', tier: 'T1' },
    { pattern: 'enseignementsup-recherche.gouv.fr', tier: 'T1' },
    { pattern: 'campusfrance.org', tier: 'T2' },
  ],
  ireland: [
    { pattern: 'irishimmigration.ie', tier: 'T1' },
    { pattern: 'gov.ie', tier: 'T1' },
    { pattern: 'educationinireland.com', tier: 'T2' },
    { pattern: 'qqi.ie', tier: 'T2' },
  ],
  'new-zealand': [
    { pattern: 'immigration.govt.nz', tier: 'T1' },
    { pattern: 'enz.govt.nz', tier: 'T1' },
  ],
  uae: [
    { pattern: 'icp.gov.ae', tier: 'T1' },
    { pattern: 'gdrfad.gov.ae', tier: 'T1' },
    { pattern: 'mohre.gov.ae', tier: 'T1' },
    { pattern: 'u.ae', tier: 'T1' },
    { pattern: 'moe.gov.ae', tier: 'T1' },
    { pattern: 'khda.gov.ae', tier: 'T2' },
    { pattern: 'caa.ae', tier: 'T2' },
  ],
  japan: [
    { pattern: 'isa.go.jp', tier: 'T1' },
    { pattern: 'mofa.go.jp', tier: 'T1' },
    { pattern: 'mext.go.jp', tier: 'T1' },
    { pattern: 'studyinjapan.go.jp', tier: 'T2', note: 'JASSO' },
  ],
  india: [
    { pattern: 'rbi.org.in', tier: 'T1' },
    { pattern: 'incometax.gov.in', tier: 'T1' },
    { pattern: 'mea.gov.in', tier: 'T1' },
    { pattern: 'pib.gov.in', tier: 'T1' },
  ],
};

/** Categories that are never retrieved (§7.1 "Blocked"). Shown on the methodology page. */
export const BLOCKED_CATEGORIES = [
  'Forums and Q&A sites',
  'Agent and consultant blogs',
  'Aggregators and ranking resellers',
  'AI-generated content farms',
  'Social media',
  'Any domain not on this list',
];
