# Review dispositions — pilot website

Independent branch review of `ec70e33` by a separate agent (same model family; did not author the change).
Fixes are in the commit after `879fa8b`. Delta review requested on the fix commit.

| Sev | Finding | Disposition |
|---|---|---|
| BLOCKER | Fraud detection missed ordinary wording | Fixed: word-proximity rules (no nested quantifiers) + return-intent borrowing rule; 5 new refusal tests. (The legitimate-question tests claimed here were missing at d15dba3; added in the delta-fix commit, 13 cases.) |
| MAJOR | Distress patterns too narrow | Fixed: failure/ashamed/burden/"can't do this"/"ruined"; 3 new tests |
| MAJOR | Keyword topics let specific out-of-scope questions get adjacent facts | Fixed: unsupported-subject check runs before topics (spouse, refunds, IHS, PR, IELTS, APS…); qualifier rule for holidays/on/off-campus work; 9 new tests |
| MAJOR | `opt` aliased to USA; `aps` mapped to post-study | Fixed: removed; upper-case "US" and "the us" recognised |
| MAJOR | Totals included post-study 485 fee and ignored staleness | Fixed: `costStage: 'post_study'` excluded; lines carry `stale`, planner flags them; tests |
| MAJOR | Compare cells, totals, home cards had no view-time freshness | Fixed: `freshAttrs` + `ViewFlags` on every fact-bearing element; client also flags rules whose effective date has passed; e2e at future dates |
| MAJOR | Method copy claimed monitoring/rollback the pilot lacks | Fixed: copy states plainly that automatic re-checking is not running yet |
| MAJOR | Application date ambiguity for post-study visas | Fixed: field and hint clarified; date-sensitive answers carry an explicit note |
| MAJOR | E2E depended on the real clock | Fixed: clock pinned for every context; date-specific checks pass `now` |
| MAJOR | SAST did not scan `.astro` scripts | Fixed: eslint-plugin-astro in SAST config; verified with a planted `innerHTML` sink |
| MINOR | `diff_coverage` measures total `src/lib` coverage | Accepted for pilot: all of `src/lib` is new relative to base, so it bounds diff coverage for that scope; `.astro` logic is covered by e2e. Revisit with a diff-scoped tool when the base has prior code. |
| MINOR | Vacuous fresh AC-8 assertion | Fixed: asserts no visible flag within max age |
| MINOR | Weak AC-11 assertion | Fixed: full phrases |
| MINOR | Checker missed bare numbers / number words | Fixed: patterns added. Value-equality check not added (data-fact on change-log prose is legitimately not the value). |
| MINOR | Tele-MANAS domain not allowlisted | Fixed: `mohfw.gov.in` added; unit test |
| MINOR | UK total uses London maintenance | Accepted: the line is labelled "Maintenance funds (London)" in every breakdown |
| MINOR | Steps not bound to fact ids | Accepted for pilot: steps use only seed-baseline terminology, carry no figures, and the section says to confirm on the linked official pages. Revisit when Form-guide agent exists. |
| NIT | "N changing" counted volatile in-force facts | Fixed in redesign |
| NIT | Signals attached regardless of topic | Fixed: signals carry topics |
| NIT | Theme toggle state | Fixed: `aria-pressed` and state label |

## Delta review of d15dba3

| Sev | Finding | Disposition |
|---|---|---|
| MAJOR | Wider fraud matching refused legitimate questions (write my SOP, doctor certificate, spot a fake offer, change documents after submitting, accidental overstay) | Fixed: "for me"/"can you write" required; doctor/change/modify no longer bare triggers; anti-fraud intent (spot, check, avoid, scam…) exempt; overstay/volunteer/permit questions now `no_facts` with official link; 13 legitimate-question tests |
| MINOR | `aps` over-blocked France | Fixed: APS refused only when France is not a destination; France answers `fr-aps` |
| MINOR | Parent's disappointment about a fee triggered care response | Fixed: requires a first-person object ("in me", "ashamed of me") |
| MINOR | Specific permission questions fell through to snapshot | Fixed: disclose/declare/change course/switch/extend/renew added to unsupported subjects; tests |
| MINOR | Disposition record claimed missing tests | Corrected above |
| MINOR | Home copy: Graduate Route date confusion, notice-period claim, "every line links" vs cards | Fixed in admissions-first home rewrite; cards now show source host and date |
| MINOR | Plans "will stay free" pricing promise | Fixed: "free during the pilot" |
| NIT | "Replaced by a newer rule" wording | Fixed: "This rule’s end date has passed" |
| NIT | Stale count included totals | Fixed: `data-group` excluded from count |
| NIT | Converted total had no freshness flag | Fixed |
| NIT | BUILD_DATE uses real clock at build | Accepted: view-time flags cover date transitions; rebuild daily recommended in PROGRESS |
