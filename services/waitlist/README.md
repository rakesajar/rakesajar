# Waitlist and change-alert sign-ups

The site's `WaitlistForm` posts a validated JSON record to `PUBLIC_WAITLIST_ENDPOINT` (this worker's `/signup` URL). Until
that variable is set at build time, the form validates input but sends nothing and tells the visitor so.

`worker.ts` is a reference handler (Cloudflare Worker + KV), reviewed for security on 21 Nov 2026:

- **Double opt-in.** `POST /signup` stores a *pending* record (48 h) and asks your sender to deliver a confirmation link.
  Only `GET /confirm` turns it into a consented record, with the consent time set at confirmation.
- **One record per contact.** Records are keyed by `HMAC(HMAC_KEY, contact)`, so repeats replace and deletion is direct.
- **Deletion.** The confirmation page and every message must include the `/unsubscribe` link, which deletes the record.
  For a request by other means, compute the HMAC of the normalised email/number and delete `signup:<hash>`.
- **Abuse.** Per-IP rate limiting (required), optional Turnstile, byte-accurate body limit, strict validation shared with the site,
  consent-wording version check.
- **Fails closed** without a sender or a rate limiter.

## Before switching it on (product-owner decisions)
- Name the legal operator and a privacy/grievance contact (India DPDP Act), and add them to the privacy page.
- Provide a sender for confirmations (email and/or WhatsApp Business with an approved opt-in template) at `CONFIRM_WEBHOOK`.
  It receives `{channel, to, confirmUrl}` and must include the unsubscribe link in every later message.
- Confirm retention (default 365 days, `RETENTION_DAYS`) and disable Worker request logging, or say otherwise on the privacy page.

## Switch on
1. `cp wrangler.toml.example wrangler.toml`; create the KV namespace and a rate-limit binding named `RATE_LIMITER`.
2. `npx wrangler secret put HMAC_KEY` and `CONFIRM_WEBHOOK_TOKEN` (and `TURNSTILE_SECRET` if used).
3. `npx wrangler deploy`.
4. Build the site with `PUBLIC_WAITLIST_ENDPOINT=https://<worker-url>/signup` (and `PUBLIC_TURNSTILE_SITEKEY` if used).
