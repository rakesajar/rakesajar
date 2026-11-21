# Delivery plan — pilot website

Spec and authorization: `docs/specs/pilot-website.md`; product owner session instruction 2026-11-21.
Feature branch / target / base: `ccr-8f80979e-5gwduk` / `main` / `d6cbde9`.
Execution: inline by the coordinating agent (single coherent design system; tasks share data contracts). Independent
branch review by a separate agent that did not author the change.
Budget: one working session; no paid external calls.

| Task | Acceptance IDs | Files/contracts | Verification |
|---|---|---|---|
| 1 Fact store, allowlist, verifier rules | AC-3, AC-4, AC-9 | `site/src/data/*`, `site/src/lib/{validate,domains,facts}.ts` | unit tests (negative cases) |
| 2 Money/FX, concierge engine | AC-5, AC-6, AC-7, AC-8 | `site/src/lib/{money,fx,concierge}.ts` | unit tests |
| 3 Design system, layout, guides | AC-1, AC-2, AC-10, AC-11 | `site/src/styles`, `components`, `pages/destinations` | build checker, e2e, axe |
| 4 Compare, planner, ask, changes, trust pages | AC-6, AC-7, AC-11 | `site/src/pages/*` | e2e |
| 5 Delivery setup: gate policy, adapters, knowledge | — | `.agents`, `tools/ci`, `knowledge` | gate run |

## Recovery
Official domains are unreachable from the build sandbox: `npm run check:sources` is a parked check for an environment
with network access. Parked required tasks: none.
