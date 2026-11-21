# Progress

## Now
Fable critique ideas 1, 4, 7, 8 implemented on `ccr-8f80979e-5gwduk`: 74 machine-sourced facts (9 universities in UK/Canada/
Australia + RBI/MEA India facts), eligibility check, India page, waitlist and change alerts. Not merged, not deployed.

## Next
Product owner: switch sign-ups on (operator, privacy contact, retention), amend req.md FR-7/FR-12, decide UCAS/national
portals. Schedule `npm --prefix site run verify:passages:stamp` daily in the `rakesajar-pathfinder` environment + rebuild.

## Verified
See the latest gate receipt in the session. `verify:passages` 74/74 on 21 Nov 2026.

## Blocked / parked
- UCAS (UK central admissions) and other national application portals are not on the §7.2 allowlist; adding them is a
  product-owner decision.
- Print stylesheet and non-Chromium browsers not yet verified.
- TCS (incometax.gov.in loads content via JavaScript) and education loans: not sourced; India page says so.
- ANU, UCL, Melbourne, Monash block automated reading; Edinburgh PG/English pages redirect to blocked hosts.
- Legal operator name, contact/grievance channel, production domain, pricing, analytics: reserved to product owner.
- Source URLs not live-checked from sandbox; run `npm --prefix site run check:sources` with network access.
- Seed facts will show "re-check due" from 22 Nov (volatile) / 28 Nov 2026 (most rules) until Phase 0 agents or a
  manual re-verification refresh `verifiedAt` (req.md §15 Q3 decides the long-term stale policy).

## Preserved work
None outside the branch.

## Next session starts with
Read this file and `knowledge/index.md`; reconcile with `git log` and the branch on origin.
