/**
 * Live FX for home-currency totals. Source: European Central Bank reference rates, served by the
 * Frankfurter API. Optional: if it fails, the UI asks the user for a rate instead of guessing.
 */
import type { EurRates } from './money';

export const FX_ENDPOINT = 'https://api.frankfurter.app/latest?from=EUR';
export const FX_SOURCE_LABEL = 'European Central Bank reference rates (via Frankfurter)';

export interface FxSnapshot {
  date: string;
  rates: EurRates;
}

/** Validates an untrusted API payload. Returns null if anything looks wrong. */
export function parseFx(payload: unknown): FxSnapshot | null {
  if (!payload || typeof payload !== 'object') return null;
  const p = payload as { base?: unknown; date?: unknown; rates?: unknown };
  if (p.base !== 'EUR' || typeof p.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(p.date)) return null;
  if (!p.rates || typeof p.rates !== 'object') return null;
  const rates: EurRates = {};
  for (const [k, v] of Object.entries(p.rates as Record<string, unknown>)) {
    if (/^[A-Z]{3}$/.test(k) && typeof v === 'number' && Number.isFinite(v) && v > 0) rates[k] = v;
  }
  return Object.keys(rates).length ? { date: p.date, rates } : null;
}

export async function fetchFx(fetcher: typeof fetch = fetch, timeoutMs = 6000): Promise<FxSnapshot | null> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetcher(FX_ENDPOINT, { signal: ctrl.signal, credentials: 'omit', referrerPolicy: 'no-referrer' });
    if (!res.ok) return null;
    return parseFx(await res.json());
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
