# Project instructions

This repository is the owner's GitHub profile (`README.md` at root — do not change it) and hosts the
**Pathfinder pilot website** in `site/`.

## Stack and commands
- Astro 7 static site, TypeScript strict, Node ≥ 22.23.4. Install with `npm ci --prefix site`.
- `npm --prefix site test` · `run build` · `run test:e2e` · `run lint` (see `site/README.md`).
- Delivery gate: `python3 tools/agentic/gate.py --repo . --policy .agents/gate-policy.json --spec docs/specs/pilot-website.delivery.json --base origin/main --min-tier T1 --out <new dir outside repo>`.

## Constraints
- Never add a rule/fee/deadline figure from memory. Figures come only from `site/src/data/facts.ts` with an allowlisted
  official source (see `knowledge/conventions/no-figures-from-memory.md`). The build fails otherwise.
- Never present `announced`/`proposed`/`litigated`/`conflict` facts as current.
- No commissions, no outcome predictions, no essay writing, no credential storage (req.md §2.3).
- Work on the assigned branch; no merge or deploy without explicit authorization.

## Navigation
- Spec: `docs/specs/pilot-website.md` · Plan: `docs/plans/pilot-website.md` · Progress: `PROGRESS.md`
- Knowledge: `knowledge/index.md`
