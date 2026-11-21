/**
 * Machine-sourced facts. Each record in ./sourced/*.json was taken from an official page fetched on the date in
 * `verifiedAt` (or the import date), with the exact passage that contains the value. `scripts/verify-passages.mjs`
 * re-fetches every page and confirms the passage is still there; the build validator checks that every figure in a
 * value also appears in its passage. Nothing here is written from memory.
 */
import type {
  AdmissionsAspect,
  DestinationSlug,
  Fact,
  Institution,
  Minimum,
  Money,
  OriginFact,
  Stage,
  Tier,
  Topic,
} from './types';
import uk from './sourced/uk.json';
import canada from './sourced/canada.json';
import australia from './sourced/australia.json';
import india from './sourced/india.json';
import { classifyUrl } from '../lib/domains';

interface SourcedItem {
  id: string;
  country: string;
  institution: Institution | null;
  aspect: string;
  label: string;
  value: string;
  url: string;
  passage: string;
  minimum?: Minimum | null;
  money?: Money | null;
  notes?: string;
  verifiedAt?: string;
}

/** Date the first batch of pages was fetched and quoted. */
export const SOURCED_DATE = '2026-11-21';

const STAGE_OF: Partial<Record<AdmissionsAspect, Stage[]>> = { entry_ug: ['ug'], entry_pg: ['pg'], entry_phd: ['phd'] };

function tierFor(url: string, scope: (DestinationSlug | 'india')[]): Tier {
  return classifyUrl(url, scope).tier ?? 'T2';
}

function base(i: SourcedItem, scope: (DestinationSlug | 'india')[], topic: Topic, kind: Fact['kind']) {
  return {
    id: i.id,
    topic,
    kind,
    label: i.label,
    value: i.value,
    ...(i.money ? { money: i.money } : {}),
    status: 'in_force' as const,
    sources: [{ url: i.url, tier: tierFor(i.url, scope), title: i.institution?.name ?? new URL(i.url).hostname }],
    passage: i.passage,
    verifiedAt: i.verifiedAt ?? SOURCED_DATE,
    verification: 'machine' as const,
    volatility: 'standard' as const,
  };
}

function toAdmissions(items: SourcedItem[], destination: DestinationSlug): Fact[] {
  return items.map((i) => {
    const aspect = i.aspect as AdmissionsAspect;
    return {
      ...base(i, [destination], 'admissions', 'institution'),
      destination,
      institution: i.institution ?? undefined,
      aspect,
      ...(STAGE_OF[aspect] ? { stages: STAGE_OF[aspect] } : {}),
      ...(i.minimum ? { minimum: i.minimum } : {}),
    };
  });
}

export const ADMISSIONS_FACTS: Fact[] = [
  ...toAdmissions(uk as SourcedItem[], 'uk'),
  ...toAdmissions(canada as SourcedItem[], 'canada'),
  ...toAdmissions(australia as SourcedItem[], 'australia'),
];

export const INDIA_FACTS: OriginFact[] = (india as SourcedItem[]).map((i) => ({
  ...base(i, ['india'], i.aspect === 'remittance' || i.aspect === 'tax' ? 'remittance' : 'documents', 'rule'),
  origin: 'india' as const,
}));

/** Universities we hold admissions facts for, by destination, in alphabetical order. */
export function institutionsFor(destination: DestinationSlug): Institution[] {
  const seen = new Map<string, Institution>();
  for (const f of ADMISSIONS_FACTS)
    if (f.destination === destination && f.institution) seen.set(f.institution.slug, f.institution);
  return [...seen.values()].sort((a, b) => a.name.localeCompare(b.name, 'en'));
}
