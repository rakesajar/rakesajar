---
type: Convention
title: Figures only from the fact store
description: Any rule, fee, duration or requirement shown on the site must be a fact record or a marked policy/signal.
status: stable
tags: [content, verification]
generated: {by: "agent/claude-code", at: "2026-11-21T14:30:00Z"}
---

# Rule
- Figures (currency amounts, durations, percentages) in page text must be inside an element with `data-fact="<fact ids>"`.
- Our own published policy numbers (freshness table, release gates) use `data-figure-ok="policy"`.
- Unconfirmed reports use `data-figure-ok="signal"` and must be labelled "reported".
- Taglines, steps and prose use no figures and no requirements beyond the seed baseline's terminology.

Enforced by `site/scripts/check-figures.mjs` on every build. Known gap: client-rendered text (Ask, planner) is checked by
construction (it renders fact values with `data-fact`) and by e2e, not by the HTML checker.
