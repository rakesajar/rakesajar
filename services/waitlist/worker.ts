/**
 * Reference handler for Pathfinder waitlist and change-alert sign-ups (Cloudflare Worker + KV).
 *
 * Deploy only after the product owner has chosen the operator, a privacy contact and data retention (see README).
 *
 * Design (security review, 21 Nov 2026):
 * - Re-validates every request with the site's own rules; never trusts the browser.
 * - Double opt-in: a sign-up is stored as *pending* and only becomes a consented record when the person clicks the
 *   confirmation link sent to the contact they gave. Nobody can sign someone else up.
 * - Records are keyed by HMAC(normalised contact), so a repeat sign-up replaces the old one and a deletion request can be
 *   honoured without scanning. Every message carries an unsubscribe link that deletes the record.
 * - Rate limited per IP; optional Cloudflare Turnstile bot check; byte-accurate size limits checked before parsing.
 * - Fails closed: if confirmations can't be sent, nothing is stored.
 */
import { validateSignup, type SignupRecord } from "../../site/src/lib/waitlist";

interface KV {
  get(key: string): Promise<string | null>;
  put(
    key: string,
    value: string,
    opts?: { expirationTtl?: number },
  ): Promise<void>;
  delete(key: string): Promise<void>;
}

export interface Env {
  WAITLIST: KV;
  /** Exact origin of the site, e.g. https://pathfinder.example */
  ALLOWED_ORIGIN: string;
  /** Public base URL of this worker, used in confirmation and unsubscribe links. */
  PUBLIC_BASE: string;
  /** Comma-separated destination slugs the site offers. */
  DESTINATIONS: string;
  /** Secret used to key records and sign links. */
  HMAC_KEY: string;
  /** Service that sends the confirmation email/WhatsApp (operator-provided). */
  CONFIRM_WEBHOOK?: string;
  CONFIRM_WEBHOOK_TOKEN?: string;
  /** Cloudflare rate-limiting binding. Required unless ALLOW_NO_RATE_LIMIT is "true" (local testing only). */
  RATE_LIMITER?: {
    limit(opts: { key: string }): Promise<{ success: boolean }>;
  };
  ALLOW_NO_RATE_LIMIT?: string;
  /** If set, a valid Turnstile token is required. */
  TURNSTILE_SECRET?: string;
  /** Days to keep a confirmed sign-up. */
  RETENTION_DAYS?: string;
}

const MAX_BODY_BYTES = 4_000;
const PENDING_TTL = 48 * 3600;

function cors(env: Env): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": env.ALLOWED_ORIGIN,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    Vary: "Origin",
  };
}

async function hmac(key: string, data: string): Promise<string> {
  const k = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(key),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign(
    "HMAC",
    k,
    new TextEncoder().encode(data),
  );
  return [...new Uint8Array(sig)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export function retentionSeconds(raw: string | undefined): number {
  const days = Number.parseInt(raw ?? "", 10);
  return (
    (Number.isFinite(days) && days >= 1 && days <= 730 ? days : 365) * 86_400
  );
}

const page = (title: string, body: string, status = 200) =>
  new Response(
    `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${title}</title><p style="font:16px system-ui;max-width:40ch;margin:3rem auto">${body}</p>`,
    {
      status,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store",
      },
    },
  );

async function verifyTurnstile(
  env: Env,
  token: unknown,
  ip: string,
): Promise<boolean> {
  if (!env.TURNSTILE_SECRET) return true;
  if (typeof token !== "string" || !token || token.length > 2048) return false;
  const form = new FormData();
  form.append("secret", env.TURNSTILE_SECRET);
  form.append("response", token);
  form.append("remoteip", ip);
  const res = await fetch(
    "https://challenges.cloudflare.com/turnstile/v0/siteverify",
    { method: "POST", body: form },
  );
  return (
    res.ok && ((await res.json()) as { success?: boolean }).success === true
  );
}

async function signup(request: Request, env: Env): Promise<Response> {
  const headers = cors(env);
  if (request.headers.get("Origin") !== env.ALLOWED_ORIGIN)
    return new Response("Forbidden", { status: 403, headers });
  if (!env.CONFIRM_WEBHOOK)
    return new Response("Confirmations are not configured", {
      status: 503,
      headers,
    });

  const ip = request.headers.get("CF-Connecting-IP") ?? "unknown";
  if (env.RATE_LIMITER) {
    if (!(await env.RATE_LIMITER.limit({ key: ip })).success)
      return new Response("Too many requests", { status: 429, headers });
  } else if (env.ALLOW_NO_RATE_LIMIT !== "true")
    return new Response("Rate limiting is not configured", {
      status: 503,
      headers,
    });

  const declared = Number(request.headers.get("Content-Length") ?? "0");
  if (declared > MAX_BODY_BYTES)
    return new Response("Too large", { status: 413, headers });
  const raw = await request.text();
  if (new TextEncoder().encode(raw).length > MAX_BODY_BYTES)
    return new Response("Too large", { status: 413, headers });

  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return new Response("Bad JSON", { status: 400, headers });
  }
  if (!body || typeof body !== "object" || Array.isArray(body))
    return new Response("Bad request", { status: 400, headers });
  const b = body as Record<string, unknown>;
  if (!(await verifyTurnstile(env, b.turnstileToken, ip)))
    return new Response("Bot check failed", { status: 403, headers });

  const consent = b.consent as
    { given?: unknown; version?: unknown } | undefined;
  const result = validateSignup(
    {
      who:
        typeof b.who === "string"
          ? (b.who as "student" | "parent")
          : ("" as "student"),
      email: typeof b.email === "string" ? b.email : undefined,
      whatsapp: typeof b.whatsapp === "string" ? b.whatsapp : undefined,
      destinations: Array.isArray(b.destinations)
        ? b.destinations.map(String)
        : [],
      level: typeof b.level === "string" ? (b.level as "ug") : "",
      intake: typeof b.intake === "string" ? b.intake : "",
      purpose: b.purpose as "waitlist",
      consent: consent?.given === true,
      // The version must match what this deployment expects; a stale site page is rejected.
      consentVersion:
        typeof consent?.version === "string" ? consent.version : "missing",
      source: typeof b.source === "string" ? b.source : "",
    },
    env.DESTINATIONS.split(",").map((s) => s.trim()),
  );
  if (!result.ok)
    return Response.json({ errors: result.errors }, { status: 422, headers });

  const record = result.record;
  const contact = (record.email ?? record.whatsapp)!;
  const key = await hmac(env.HMAC_KEY, `contact:${contact}`);
  const token = await hmac(
    env.HMAC_KEY,
    `confirm:${key}:${crypto.randomUUID()}`,
  );
  // Pending until the owner of the contact confirms; consent time is set at confirmation, not here.
  await env.WAITLIST.put(`pending:${key}`, JSON.stringify({ record, token }), {
    expirationTtl: PENDING_TTL,
  });

  const confirmUrl = `${env.PUBLIC_BASE}/confirm?k=${key}&t=${token}`;
  const sent = await fetch(env.CONFIRM_WEBHOOK, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${env.CONFIRM_WEBHOOK_TOKEN ?? ""}`,
    },
    body: JSON.stringify({
      channel: record.email ? "email" : "whatsapp",
      to: contact,
      confirmUrl,
    }),
  }).catch(() => null);
  if (!sent?.ok) {
    await env.WAITLIST.delete(`pending:${key}`);
    return new Response("Could not send confirmation", {
      status: 502,
      headers,
    });
  }
  return Response.json(
    { ok: true, status: "confirmation_sent" },
    { status: 202, headers },
  );
}

async function confirm(url: URL, env: Env): Promise<Response> {
  const key = url.searchParams.get("k") ?? "";
  const token = url.searchParams.get("t") ?? "";
  if (!/^[0-9a-f]{64}$/.test(key))
    return page("Link not valid", "This confirmation link isn’t valid.", 400);
  const pending = await env.WAITLIST.get(`pending:${key}`);
  if (!pending)
    return page(
      "Link expired",
      "This link has expired or was already used. Please sign up again.",
      410,
    );
  const { record, token: expected } = JSON.parse(pending) as {
    record: SignupRecord;
    token: string;
  };
  if (!safeEqual(token, expected))
    return page("Link not valid", "This confirmation link isn’t valid.", 400);
  const confirmed = {
    ...record,
    consent: { ...record.consent, at: new Date().toISOString() },
    confirmedAt: new Date().toISOString(),
  };
  await env.WAITLIST.put(`signup:${key}`, JSON.stringify(confirmed), {
    expirationTtl: retentionSeconds(env.RETENTION_DAYS),
  });
  await env.WAITLIST.delete(`pending:${key}`);
  const unsubscribe = `${env.PUBLIC_BASE}/unsubscribe?k=${key}&t=${await hmac(env.HMAC_KEY, `unsubscribe:${key}`)}`;
  return page(
    "Confirmed",
    `Thank you, you’re signed up. To delete your details at any time, use this link: <a href="${unsubscribe}">delete my sign-up</a>.`,
  );
}

async function unsubscribe(url: URL, env: Env): Promise<Response> {
  const key = url.searchParams.get("k") ?? "";
  const token = url.searchParams.get("t") ?? "";
  if (
    !/^[0-9a-f]{64}$/.test(key) ||
    !safeEqual(token, await hmac(env.HMAC_KEY, `unsubscribe:${key}`))
  )
    return page("Link not valid", "This link isn’t valid.", 400);
  await env.WAITLIST.delete(`signup:${key}`);
  await env.WAITLIST.delete(`pending:${key}`);
  return page(
    "Deleted",
    "Your details have been deleted. We won’t contact you again.",
  );
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (request.method === "OPTIONS")
      return new Response(null, { status: 204, headers: cors(env) });
    if (request.method === "POST" && url.pathname === "/signup")
      return signup(request, env);
    if (request.method === "GET" && url.pathname === "/confirm")
      return confirm(url, env);
    if (request.method === "GET" && url.pathname === "/unsubscribe")
      return unsubscribe(url, env);
    return new Response("Not found", { status: 404 });
  },
};
