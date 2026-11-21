# Change specification: Pathfinder pilot website (free tier)

Source requirements: `req.md` v0.3 (21 Nov 2026), supplied by the product owner in session.
Authorization: product owner instruction in session, 21 Nov 2026: "Use agentic delivery and start building Pilot website … premium grade B2C ready". Push to branch `ccr-8f80979e-5gwduk` only. No merge, no deploy, no PR.

## Outcome and non-goals

A public, static, fast pilot of the **free tier** of Study Abroad Pathfinder covering all 11 destinations, built on a
typed fact store that enforces the trusted-source policy (§7) and the verification rules (§8.2) at build time.

In scope: home, 11 destination guides on the 8-section schema (FR-1), country comparison with home-currency totals
(FR-3, free = 2 countries), cost planner, public change feed (FR-4), concierge preview answering only from the fact store
(CA-1…CA-8 subset), methodology/trusted-source page, plans page with release-gate status, legal pages (LC-2, LC-4, LC-6).

Non-goals for the pilot (later phases): accounts, payments, vault, form assistant, essay feedback, LLM answering,
live domain-filtered search, monitor/extractor/verifier agents, email alerts, multi-language, origin overlays beyond
India official-link panels. No facts from model memory: every figure comes from the §5 seed baseline.

## Acceptance

| ID | Observable behavior / failure case | Verification evidence required |
|---|---|---|
| AC-1 | All 11 destination guides render the 8 sections (snapshot, routes, steps, costs, funding, work & after, checks, sources) | e2e: each guide has 8 section landmarks |
| AC-2 | Every displayed figure is bound to a fact record with source URL, tier and verified date; no uncited figures in generated pages (PB-2) | post-build uncited-figure checker = 0 findings |
| AC-3 | Fact store build fails if a source domain is not allowlisted, a rule fact lacks a T1 source, an institution fact lacks T2, a future-dated fact is `in_force`, or URLs are not HTTPS (VR-1, VR-2, VR-4, DS-2) | unit tests incl. negative cases |
| AC-4 | `announced`, `proposed`, `litigated`, `conflict` facts are never presented as current; conflict facts carry "being re-checked" (VR-3, VR-5) | unit + e2e |
| AC-5 | Rule applied depends on the user's application date (CA-3), e.g. UK Graduate Route before/after 1 Jan 2027 | unit (EV-2 regression) + e2e |
| AC-6 | Compare: 2 countries free, rows for permission/work/post-study/fees/funds, home-currency totals that exclude quarantined facts and say so | unit + e2e |
| AC-7 | Concierge preview answers with inline citations + verified date, refuses on conflict/litigated/proposed/stale/no-fact, refuses fraud-adjacent requests, responds with care to distress; limited to 3/day free | unit + e2e |
| AC-8 | Facts past max age (§9) show a re-check-due label at view time, and the concierge will not state them | unit + client check |
| AC-9 | Look-alike domains (e.g. `gov.uk.example.com`, `uscis.gov-verify.com`) are rejected by the allowlist matcher (EV-6) | unit |
| AC-10 | Accessibility: no serious/critical axe violations on key pages; keyboard operable; light/dark; no horizontal scroll at 360 px | e2e axe + viewport check |
| AC-11 | Legal statements present: AI-generated, no human review, not legal/immigration advice, no commissions, no guarantees | e2e text assertions |

## Risk and boundaries

Tier **T1**: public informational site, no accounts, no personal data stored server-side, no payments. Wrong facts are the
main risk; mitigated by seed-only data, visible "seed baseline" provenance, conservative phrasing (CA-5) and status rules.
Rollback: static site, revert commit.

## Autonomy contract

Allowed: create files in this repository; add pinned npm dev/runtime dependencies for the site; run local builds/tests.
Not allowed: deploy, merge, open PR, add external runtime providers except the FX rate API (ECB reference rates via
Frankfurter, client-side, optional with manual fallback). Reserved to product owner: legal operator name, pricing,
analytics, domain name, contact/grievance channel.

## Decisions and assumptions

See `knowledge/decisions/`. Seed facts are displayed as "seed baseline, 21 Nov 2026" because passages have not been
machine-extracted yet (Phase 0). Source URLs could not be fetched from the build sandbox (egress blocked); `npm run check:sources`
must be run where network access exists.

## Verification and delivery

Gate policy `.agents/gate-policy.json`: tests, secrets, lint, sast, dependencies, diff_coverage (≥ 80% lines on `src/lib`),
knowledge. Independent branch review by a separate agent that did not author the change.

## Scope amendment 1 (product owner, 21 Nov 2026: "Fix 1,4,7,8" from the Fable critique)

| ID | Observable behavior / failure case | Verification evidence required |
|---|---|---|
| AC-12 | UK, Canada and Australia guides list universities with admissions facts (how to apply, entry minimums for Indian applicants, English tests, deadlines, tuition, scholarships), each machine-sourced with a verbatim passage | unit (validator + passage-number check), e2e, `npm run verify:passages` |
| AC-13 | Eligibility check compares Class XII / bachelor's % and IELTS with published minimums: meets, below, within range, or not published. Never a score, chance, rank, reach/match/safe | unit + e2e |
| AC-14 | India page with RBI (LRS) and MEA (apostille/attestation) facts, quoted; states plainly what is not verified (TCS, loans) | e2e |
| AC-15 | Waitlist and per-country change-alert sign-up: under-18 students cannot submit, explicit consent recorded, nothing sent unless an endpoint is configured; server re-validates | unit + e2e; reference handler in `services/waitlist` |

Network: a personal environment `rakesajar-pathfinder` allows the listed official hosts so pages can be fetched and quoted.
Allowlist extended under DS-3: utoronto.ca, ubc.ca, mcgill.ca (designated learning institutions) and mohfw.gov.in.
Reserved to the product owner: switching sign-ups on (operator, privacy contact, retention), and amending req.md FR-7/FR-12.
