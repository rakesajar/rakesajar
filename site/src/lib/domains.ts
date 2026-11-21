/**
 * Domain filter (DS-1, DS-2, EV-6). Pure functions, no network.
 */
import { ALLOWLIST, type AllowEntry } from '../data/allowlist';
import type { DestinationSlug, OriginSlug, Tier } from '../data/types';

/** Lower-cases and strips a trailing dot. Returns null for anything that is not a plain DNS host. */
export function normaliseHost(host: string): string | null {
  const h = host.trim().toLowerCase().replace(/\.$/, '');
  if (!h || h.length > 253) return null;
  // Reject IP literals, ports, userinfo, punycode look-alikes and non-DNS characters.
  if (!/^[a-z0-9.-]+$/.test(h)) return null;
  // All-numeric hosts are IP literals (or invalid); a real DNS name always has a letter in its TLD.
  if (/^[\d.]+$/.test(h)) return null;
  if (h.split('.').some((label) => label.startsWith('xn--') || !label || label.length > 63)) return null;
  return h;
}

/** Host matches an allowlist pattern exactly, as a subdomain, or under a `*.suffix`. */
export function hostMatches(host: string, pattern: string): boolean {
  if (pattern.startsWith('*.')) {
    const suffix = pattern.slice(1); // ".edu"
    // Needs at least one label before the suffix: "mit.edu" ok, ".edu" not.
    return host.endsWith(suffix) && host.length > suffix.length;
  }
  return host === pattern || host.endsWith('.' + pattern);
}

export interface DomainVerdict {
  allowed: boolean;
  tier?: Exclude<Tier, 'T3'>;
  entry?: AllowEntry;
  reason?: string;
}

/**
 * Classifies a URL for a given destination/origin scope.
 * Only https URLs with a plain host on the scope's allowlist are allowed.
 */
export function classifyUrl(rawUrl: string, scope: ReadonlyArray<DestinationSlug | OriginSlug>): DomainVerdict {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return { allowed: false, reason: 'Not a valid URL' };
  }
  if (url.protocol !== 'https:') return { allowed: false, reason: 'HTTPS required' };
  if (url.username || url.password) return { allowed: false, reason: 'Credentials in URL' };
  if (url.port) return { allowed: false, reason: 'Non-standard port' };
  const host = normaliseHost(url.hostname);
  if (!host) return { allowed: false, reason: 'Host is not a plain DNS name' };

  let best: AllowEntry | undefined;
  for (const key of scope) {
    for (const entry of ALLOWLIST[key]) {
      if (hostMatches(host, entry.pattern)) {
        // Prefer the strongest tier if several patterns match.
        if (!best || (entry.tier === 'T1' && best.tier !== 'T1')) best = entry;
      }
    }
  }
  if (!best) return { allowed: false, reason: `Domain ${host} is not on the allowlist` };
  return { allowed: true, tier: best.tier, entry: best };
}

/** DS-2: drop results from non-allowlisted domains before anything else sees them. */
export function filterAllowed<T extends { url: string }>(
  results: readonly T[],
  scope: ReadonlyArray<DestinationSlug | OriginSlug>,
): T[] {
  return results.filter((r) => classifyUrl(r.url, scope).allowed);
}

/** DS-1: the domain filter a search call would carry for a scope. */
export function searchDomainFilter(scope: ReadonlyArray<DestinationSlug | OriginSlug>): string[] {
  const out = new Set<string>();
  for (const key of scope) for (const e of ALLOWLIST[key]) out.add(e.pattern);
  return [...out].sort();
}

export function hostOf(rawUrl: string): string {
  try {
    return new URL(rawUrl).hostname.replace(/^www\./, '');
  } catch {
    return rawUrl;
  }
}
