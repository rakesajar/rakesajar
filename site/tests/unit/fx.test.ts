import { describe, expect, it } from 'vitest';
import { fetchFx, parseFx } from '../../src/lib/fx';

describe('FX payload validation', () => {
  it('accepts a well-formed ECB payload and drops bad rates', () => {
    expect(parseFx({ base: 'EUR', date: '2026-11-20', rates: { INR: 92.1, USD: 1.08, bad: 3, GBP: -1, JPY: 'x' } })).toEqual({
      date: '2026-11-20',
      rates: { INR: 92.1, USD: 1.08 },
    });
  });
  it('rejects anything else', () => {
    for (const p of [
      null,
      'x',
      { base: 'USD', date: '2026-11-20', rates: { INR: 1 } },
      { base: 'EUR', date: 'today', rates: {} },
      { base: 'EUR', date: '2026-11-20' },
      { base: 'EUR', date: '2026-11-20', rates: { GBP: 0 } },
    ])
      expect(parseFx(p)).toBeNull();
  });
  it('fetches and falls back to null on errors', async () => {
    const ok = (async () =>
      new Response(JSON.stringify({ base: 'EUR', date: '2026-11-20', rates: { INR: 92 } }))) as typeof fetch;
    expect(await fetchFx(ok)).toEqual({ date: '2026-11-20', rates: { INR: 92 } });
    const notOk = (async () => new Response('nope', { status: 500 })) as typeof fetch;
    expect(await fetchFx(notOk)).toBeNull();
    const boom = (async () => {
      throw new Error('offline');
    }) as typeof fetch;
    expect(await fetchFx(boom)).toBeNull();
  });
});
