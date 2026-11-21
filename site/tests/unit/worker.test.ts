import { afterEach, describe, expect, it, vi } from 'vitest';
import worker, { retentionSeconds, type Env } from '../../../services/waitlist/worker';
import { CONSENT_VERSION } from '../../src/lib/waitlist';

const ORIGIN = 'https://pathfinder.example';
function kv() {
  const m = new Map<string, string>();
  return {
    m,
    get: async (k: string) => m.get(k) ?? null,
    put: async (k: string, v: string) => void m.set(k, v),
    delete: async (k: string) => void m.delete(k),
  };
}
function env(over: Partial<Env> = {}) {
  const store = kv();
  const e: Env = {
    WAITLIST: store,
    ALLOWED_ORIGIN: ORIGIN,
    PUBLIC_BASE: 'https://waitlist.example',
    DESTINATIONS: 'uk, canada',
    HMAC_KEY: 'test-key',
    CONFIRM_WEBHOOK: 'https://sender.example/send',
    CONFIRM_WEBHOOK_TOKEN: 't',
    ALLOW_NO_RATE_LIMIT: 'true',
    ...over,
  };
  return { e, store };
}
const body = {
  who: 'parent',
  email: 'parent@example.com',
  destinations: ['canada'],
  purpose: 'waitlist',
  consent: { given: true, version: CONSENT_VERSION, at: '1999-01-01T00:00:00Z' },
  source: '/plans',
};
const post = (b: unknown, headers: Record<string, string> = {}) =>
  new Request('https://waitlist.example/signup', {
    method: 'POST',
    headers: { Origin: ORIGIN, 'Content-Type': 'application/json', ...headers },
    body: typeof b === 'string' ? b : JSON.stringify(b),
  });

let sent: { to: string; confirmUrl: string }[] = [];
function mockSender(ok = true) {
  sent = [];
  vi.stubGlobal('fetch', async (_url: string, init: RequestInit) => {
    sent.push(JSON.parse(String(init.body)));
    return new Response(null, { status: ok ? 200 : 500 });
  });
}
afterEach(() => vi.unstubAllGlobals());

describe('waitlist worker', () => {
  it('double opt-in: stores only a pending record until the contact confirms', async () => {
    mockSender();
    const { e, store } = env();
    const res = await worker.fetch(post(body), e);
    expect(res.status).toBe(202);
    expect([...store.m.keys()].every((k) => k.startsWith('pending:'))).toBe(true);
    expect(sent[0].to).toBe('parent@example.com');

    const confirmed = await worker.fetch(new Request(sent[0].confirmUrl), e);
    expect(confirmed.status).toBe(200);
    const keys = [...store.m.keys()];
    expect(keys.length).toBe(1);
    expect(keys[0]).toMatch(/^signup:[0-9a-f]{64}$/);
    const rec = JSON.parse(store.m.get(keys[0])!);
    expect(rec.consent.at).not.toBe('1999-01-01T00:00:00Z'); // server sets consent time at confirmation
    expect(rec.consent.version).toBe(CONSENT_VERSION);
    expect(rec.confirmedAt).toBeTruthy();
  });

  it('a repeat sign-up for the same contact replaces, never duplicates', async () => {
    mockSender();
    const { e, store } = env();
    await worker.fetch(post(body), e);
    await worker.fetch(post({ ...body, destinations: ['uk'] }), e);
    expect(store.m.size).toBe(1);
  });

  it('unsubscribe link deletes the record; forged links do nothing', async () => {
    mockSender();
    const { e, store } = env();
    await worker.fetch(post(body), e);
    const page = await (await worker.fetch(new Request(sent[0].confirmUrl), e)).text();
    const link = page.match(/href="([^"]+)"/)![1];
    const forged = link.replace(/t=[0-9a-f]+/, 't=' + '0'.repeat(64));
    expect((await worker.fetch(new Request(forged), e)).status).toBe(400);
    expect(store.m.size).toBe(1);
    expect((await worker.fetch(new Request(link), e)).status).toBe(200);
    expect(store.m.size).toBe(0);
  });

  it('rejects wrong origin, oversized, non-object, invalid and stale-consent bodies', async () => {
    mockSender();
    const { e, store } = env();
    expect((await worker.fetch(post(body, { Origin: 'https://evil.example' }), e)).status).toBe(403);
    expect((await worker.fetch(post('x'.repeat(5000)), e)).status).toBe(413);
    expect((await worker.fetch(post('null'), e)).status).toBe(400);
    expect((await worker.fetch(post('[1]'), e)).status).toBe(400);
    expect((await worker.fetch(post({ ...body, level: '<img src=x onerror=alert(1)>' }), e)).status).toBe(422);
    expect((await worker.fetch(post({ ...body, who: 'student_under_18' }), e)).status).toBe(422);
    expect((await worker.fetch(post({ ...body, consent: { given: true, version: 'old' } }), e)).status).toBe(422);
    expect(store.m.size).toBe(0);
  });

  it('fails closed without a confirmation sender or rate limiter, and when sending fails', async () => {
    mockSender(false);
    expect((await worker.fetch(post(body), env({ CONFIRM_WEBHOOK: undefined }).e)).status).toBe(503);
    expect((await worker.fetch(post(body), env({ ALLOW_NO_RATE_LIMIT: undefined }).e)).status).toBe(503);
    const { e, store } = env();
    expect((await worker.fetch(post(body), e)).status).toBe(502);
    expect(store.m.size).toBe(0);
  });

  it('enforces the rate limit', async () => {
    mockSender();
    const { e } = env({ RATE_LIMITER: { limit: async () => ({ success: false }) }, ALLOW_NO_RATE_LIMIT: undefined });
    expect((await worker.fetch(post(body), e)).status).toBe(429);
  });

  it('parses retention safely', () => {
    expect(retentionSeconds('abc')).toBe(365 * 86400);
    expect(retentionSeconds('30')).toBe(30 * 86400);
    expect(retentionSeconds('99999')).toBe(365 * 86400);
  });
});
