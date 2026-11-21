---
type: Decision
title: Eligibility checks against published minimums replace reach/match/safe
description: Shortlist help compares the student's figures with each university's published minimum and never scores or ranks.
status: stable
confidence: high
tags: [product, promises, eligibility]
generated: {by: "agent/claude-code", at: "2026-11-21T17:00:00Z"}
---

# Context
req.md FR-7 (reach/match/safe shortlist) and FR-12 ("which country fits me" ranking) are predictions and rankings under
other names, which contradicts the public promise "We don't rank universities or predict admissions". Raised by the Fable
critique; the product owner asked for it to be fixed (session, 21 Nov 2026).

# Options and rationale
Chosen: `site/src/lib/eligibility.ts`. For each sourced minimum (Class XII %, bachelor's %, IELTS overall) it returns only
`meets`, `below`, `within_range` (for "varies by programme" ranges) or `meets_range_top`. Universities without a published
minimum are listed separately and never guessed. Labels are unit-tested to never mention chance, score, rank, reach, match or
safe. Rejected: probability models (unknowable without admissions data; breaks the promise); weighted country fit scores.

# Authority and consequences
Product owner instruction "Fix 1,4,7,8". Requires a req.md amendment to FR-7 and FR-12 by the owner. Revisit if universities
publish programme-level minimums we can source per course.
