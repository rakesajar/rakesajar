---
type: Decision
title: Static Astro site over a typed, build-verified fact store
description: The pilot is a static site whose every figure comes from src/data/facts.ts and is verified at build time.
status: stable
confidence: high
tags: [architecture, pilot, verification]
generated: {by: "agent/claude-code", at: "2026-11-21T14:30:00Z"}
---

# Context
Spec: `docs/specs/pilot-website.md`. The pilot must show trust (§8) without backend agents yet. Facts must never come from model memory (§2.3).

# Options and rationale
Chosen: Astro 7 static build; facts as typed TS; `validate.ts` enforces VR-1/2/4/5/6 and DS-2 at build; a post-build
checker enforces PB-2 (no uncited figures) over the HTML. Client islands only for compare/planner/ask.
Alternatives: Next.js SSR (needs hosting/runtime, slower LCP), CMS (adds human-editor workflow the spec removes).

# Authority and consequences
Product owner instruction to build the pilot (session 2026-11-21). Reversible: the fact store is plain data and is
exported as `/facts.json`; a future backend can replace the import. Revisit when the Publisher agent goes live.
