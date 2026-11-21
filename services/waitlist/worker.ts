/**
 * Reference handler for Pathfinder waitlist and change-alert sign-ups (Cloudflare Worker + KV).
 *
 * Deploy only after the product owner has chosen the operator, a privacy contact and data retention (see README).
 * The handler re-validates every request with the same rules as the site, never trusts the browser, accepts only
 * the site's origin, and stores the minimum record needed to contact someone about what they asked for.
 */
import { validateSignup } from '../../site/src/lib/waitlist';

interface Env {
  /** KV namespace holding sign-ups. */
  WAITLIST: { put(key: string, value: string, opts?: { expirationTtl?: number }): Promise<void> };
  /** Exact origin of the site, e.g. https://pathfinder.example */
  ALLOWED_ORIGIN: string;
  /** Comma-separated destination slugs the site offers. */
  DESTINATIONS: string;
  /** Days to keep a sign-up before it is deleted automatically. */
  RETENTION_DAYS?: string;
}

const MAX_BODY = 4_000;

function cors(env: Env): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': env.ALLOWED_ORIGIN,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    Vary: 'Origin',
  };
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const headers = cors(env);
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers });
    if (request.method !== 'POST') return new Response('Method not allowed', { status: 405, headers });
    if (request.headers.get('Origin') !== env.ALLOWED_ORIGIN) return new Response('Forbidden', { status: 403, headers });

    const raw = await request.text();
    if (raw.length > MAX_BODY) return new Response('Too large', { status: 413, headers });
    let body: Record<string, unknown>;
    try {
      body = JSON.parse(raw);
    } catch {
      return new Response('Bad JSON', { status: 400, headers });
    }

    const result = validateSignup(
      {
        who: body.who as 'student' | 'parent',
        email: typeof body.email === 'string' ? body.email : undefined,
        whatsapp: typeof body.whatsapp === 'string' ? body.whatsapp : undefined,
        destinations: Array.isArray(body.destinations) ? body.destinations.map(String) : [],
        level: typeof body.level === 'string' ? (body.level as 'ug' | 'pg' | 'phd') : '',
        intake: typeof body.intake === 'string' ? body.intake : '',
        purpose: body.purpose === 'alerts' ? 'alerts' : 'waitlist',
        consent: (body.consent as { given?: boolean } | undefined)?.given === true,
        source: typeof body.source === 'string' ? body.source : '',
      },
      env.DESTINATIONS.split(','),
    );
    if (!result.ok) return Response.json({ errors: result.errors }, { status: 422, headers });

    const ttlDays = Number(env.RETENTION_DAYS ?? '365');
    await env.WAITLIST.put(`signup:${crypto.randomUUID()}`, JSON.stringify(result.record), {
      expirationTtl: Math.max(1, ttlDays) * 86_400,
    });
    return Response.json({ ok: true }, { status: 201, headers });
  },
};
