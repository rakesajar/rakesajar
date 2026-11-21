---
type: Decision
title: Admissions and India facts are fetched, quoted and re-verified by script
description: Sourced facts live in site/src/data/sourced/*.json with verbatim passages; verify-passages.mjs re-checks them.
status: stable
confidence: high
tags: [verification, admissions, india, freshness]
generated: {by: "agent/claude-code", at: "2026-11-21T17:30:00Z"}
---

# Context
The Fable critique found the store held no admissions facts and would go stale within days. Facts may not come from memory.

# Options and rationale
Chosen: research agents fetched official pages through the session proxy and recorded a verbatim passage per fact;
`site/scripts/verify-passages.mjs` independently re-fetches every page and fails if any passage is missing (74/74 found on
import). The build validator rejects a fact if any number in its value, minimum or money is absent from its passage, and
rejects sources outside the allowlist. `--stamp` refreshes `verifiedAt` for facts whose passage is still present, which is the
re-verification loop: run it daily where egress allows, then rebuild. Items whose dates had passed (2026-entry deadlines,
closed scholarship rounds) were dropped or reworded at import.

# Authority and consequences
Product owner instruction "Fix 1,4,7,8". Network access via a personal environment the owner approved. Pages that block
automated reading (UCL, Melbourne, Monash, ANU admissions) are not used. Revisit when tuition per course is wanted at scale.
