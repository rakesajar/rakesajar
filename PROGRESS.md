# Progress

## Now
Pilot website (free tier) in `site/` on branch `ccr-8f80979e-5gwduk`: travel-documents redesign done; all independent-review
BLOCKER/MAJOR findings fixed (see `docs/reviews-pilot-website.md`). Status: candidate, awaiting delta review + final gate.

## Next
Delta review of the fix commit → final gate run on the committed candidate → push. Merge/deploy need product-owner approval.

## Verified
See latest gate receipt reported in the session. Unexecuted: `npm run check:sources` (egress to official domains blocked).

## Blocked / parked
- Legal operator name, contact/grievance channel, production domain, pricing, analytics: reserved to product owner.
- Source URLs not live-checked from sandbox; run `npm --prefix site run check:sources` with network access.
- Seed facts will show "re-check due" from 22 Nov (volatile) / 28 Nov 2026 (most rules) until Phase 0 agents or a
  manual re-verification refresh `verifiedAt` (req.md §15 Q3 decides the long-term stale policy).

## Preserved work
None outside the branch.

## Next session starts with
Read this file and `knowledge/index.md`; reconcile with `git log` and the branch on origin.
