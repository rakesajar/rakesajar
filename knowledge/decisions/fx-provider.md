---
type: Decision
title: ECB reference rates via Frankfurter for home-currency totals
description: Client-side, optional FX fetch with validated payload and manual-rate fallback.
status: draft
confidence: medium
tags: [fx, external-provider]
generated: {by: "agent/claude-code", at: "2026-11-21T14:30:00Z"}
---

# Context
FR-3 needs home-currency totals with live FX; no backend exists.

# Options and rationale
Chosen: `https://api.frankfurter.app/latest?from=EUR` (ECB data, CORS, no key), fetched in the browser with no
credentials/referrer; payload validated by `parseFx`; if unavailable, the user enters a rate. AED is not in ECB data, so it
always needs a manual rate. Alternatives: hard-coded rates (stale, from memory — rejected), paid FX API (needs key/backend).

# Authority and consequences
Named in the spec's autonomy contract as the only external runtime provider. Product owner should confirm before public
launch (third-party dependency, privacy page mentions it). Revisit when a backend exists.
