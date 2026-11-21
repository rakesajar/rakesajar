---
type: Decision
title: Seed facts are labelled and age out visibly
description: Seed facts carry passage null and verification "seed"; freshness is re-evaluated in the reader's browser.
status: stable
confidence: high
tags: [verification, freshness, trust]
generated: {by: "agent/claude-code", at: "2026-11-21T14:30:00Z"}
---

# Context
The §5 baseline is human-supplied and verified 21 Nov 2026, but no exact source passages were captured. The sandbox
that built the pilot could not reach official domains (egress blocked), so source URLs are unverified links to the
official pages most likely to hold each fact.

# Options and rationale
Chosen: `passage: null`, `verification: 'seed'`, shown as "seed baseline". Validator forbids `machine` without a passage.
`site.ts` recomputes "re-check due" with the viewer's clock (§9 max ages), so a stale build cannot look fresh.
Rejected: inventing passages, or hiding all facts until passage extraction exists (empty product).

# Authority and consequences
Within delegated implementation scope. Consequence: from 22 Nov 2026 volatile facts show "re-check due" and the concierge
withholds them; from 28 Nov 2026 most rule facts do, until the Monitor/Verifier agents (Phase 0) run or a human refreshes
`verifiedAt` after checking. Revisit trigger: Phase 0 agents live, or product owner chooses a different stale policy
(req.md §15 Q3).
