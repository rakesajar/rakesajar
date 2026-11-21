# Waitlist and change-alert sign-ups

The site's `WaitlistForm` posts a validated JSON record to `PUBLIC_WAITLIST_ENDPOINT`. Until that variable is set at build
time, the form validates input but sends nothing and tells the visitor so.

`worker.ts` is a reference handler (Cloudflare Worker + KV). It re-validates with `site/src/lib/waitlist.ts`, accepts only
the site's origin, caps body size, and stores records with an automatic expiry.

## Before switching it on (product-owner decisions)
- Name the legal operator and a privacy/grievance contact (India DPDP Act), and add them to the privacy page.
- Confirm retention (default 365 days) and how people ask for deletion or a copy of their data.
- Choose where alerts are sent from (email and/or WhatsApp Business) and the opt-out wording.
- Minors: the form never collects a minor's details; a parent or guardian signs up instead.

## Switch on
1. `cp wrangler.toml.example wrangler.toml`, create a KV namespace and paste its id.
2. `npx wrangler deploy`.
3. Build the site with `PUBLIC_WAITLIST_ENDPOINT=https://<worker-url>` set.
