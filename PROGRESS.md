# Progress

## Now
Pilot website (free tier) complete on branch `ccr-8f80979e-5gwduk`. Status: **verified candidate, ready for product-owner
approval**. Not merged, not deployed.

## Next
Product owner decides on merge/deploy and the parked items below.

## Verified
Gate PASS 7/7 (tests, secrets, lint, sast, dependencies, diff_coverage, knowledge) on `a1ef8e0` against `origin/main`.
Independent branch review + delta review (same model family) and a Fable design/copy review: all BLOCKER/MAJOR findings
fixed; dispositions in `docs/reviews-pilot-website.md`. Unexecuted: `npm --prefix site run check:sources` (egress to official
domains blocked here), print stylesheet visual check, Safari/Firefox.

## Blocked / parked
- UCAS (UK central admissions) and other national application portals are not on the §7.2 allowlist; adding them is a
  product-owner decision.
- Print stylesheet and non-Chromium browsers not yet verified.
- Legal operator name, contact/grievance channel, production domain, pricing, analytics: reserved to product owner.
- Source URLs not live-checked from sandbox; run `npm --prefix site run check:sources` with network access.
- Seed facts will show "re-check due" from 22 Nov (volatile) / 28 Nov 2026 (most rules) until Phase 0 agents or a
  manual re-verification refresh `verifiedAt` (req.md §15 Q3 decides the long-term stale policy).

## Preserved work
None outside the branch.

## Next session starts with
Read this file and `knowledge/index.md`; reconcile with `git log` and the branch on origin.
