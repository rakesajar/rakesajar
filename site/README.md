# Pathfinder — pilot website

Free tier of Study Abroad Pathfinder (`req.md` v0.3): 11 verified destination guides, comparison, cost planner,
change log, method/trust pages and a fact-store-only concierge preview. Static Astro site, no backend.

```bash
npm ci
npm run dev            # local dev server
npm test               # unit tests (verification rules, domain filter, concierge, money)
npm run build          # build + publishing checks (uncited figures, allowlisted links, anchors)
npm run test:e2e       # browser acceptance checks incl. axe accessibility (after build)
npm run lint           # astro check + eslint (incl. security rules) + prettier
npm run check:sources  # HEAD-check all official source URLs (needs network to those domains)
```

## Where things live

| Path | What |
|---|---|
| `src/data/facts.ts` | The fact store (seed baseline, §5). The only place figures may come from. |
| `src/data/allowlist.ts` | Trusted-source allowlist (§7.2). |
| `src/lib/validate.ts` | Verifier rules run at build time; an invalid fact fails the build. |
| `src/lib/concierge.ts` | Fact-store-only answering, refusals, quota. |
| `scripts/check-figures.mjs` | Post-build PB-2 checker. |
| `src/pages/facts.json.ts` | Public open-data export of the fact store. |

## Adding or changing a fact

Edit `src/data/facts.ts`. A figure must come from an official source on the allowlist, never from memory. Rule facts need a
T1 source; set `status` and `effectiveFrom` for announced changes; add a `CHANGES` entry in `src/data/changes.ts`.
`npm test && npm run build` will reject anything that breaks the rules.
