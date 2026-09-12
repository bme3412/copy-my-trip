# Paris pilot: first live observations

Run: `live-2026-09-12T12-36-14-922Z-fce820b3`, September 12, 2026. The research phase is **complete for all 20 records**. A second automatic pass now evaluates source support, experience scope, complete claim coverage, and editorial usefulness. The user requested this hands-off workflow. Human factual accuracy, time savings, and final dollar cost remain unmeasured; model agreement is not a substitute for those measurements. No city data was changed or published.

## Saved results

| State | Records / output |
|---|---|
| Completed research with proposals | 19 records, 39 reviewable changes |
| Completed attempt needing more research | Notre-Dame; official pages returned 403 to the research tool |
| Recovered failure | Grand Palais completed on one explicit retry; the original failed attempt is retained |
| Not yet attempted / currently failed | None |
| Automatic assessment | 20 records processed; 19 fresh verifier sessions and one no-change unresolved record |
| Draft decisions | 23 accepted, 14 rejected, 2 deferred and withheld |
| Claim judgments | 130 supported, 0 unsupported, 3 unclear; all 133 have an automatic verdict |
| Independent factual accuracy / time saved / dollar cost | Unmeasured |

The provider returned `credit_balance_exhausted` for Grand Palais. The runner stopped before starting another place, requested cancellation, and retained the draft and session ID. A read-only check confirmed the session was idle and its root turn failed. After the curator restored credits, one explicit retry completed Grand Palais and research finished the remaining five records. The 14 previously completed records were not rerun. The prior failed proposal and usage remain in the attempt history and are excluded from the current proposal count.

Best-effort usage was retrieved for all **40 attempted sessions**: 21 research sessions (including the failed one) and 19 verification sessions. Research used 2,007,792 input tokens (1,466,071 cached) and 20,662 output tokens. Verification added 1,351,956 input tokens (945,256 cached) and 19,421 output tokens. Combined: **3,359,748 input tokens**, including **2,411,327 cached**, and **40,083 output tokens**. These counters are not a bill and do not establish total web-search charges. Full-run dollar cost and cost per accepted change remain unreconciled.

The automatic pass completed in about **13.5 minutes of wall time**. That is not measured human review time or time saved. No manual baseline exists. The model judged 130/130 definitive claims supported, with three unclear (97.7% definitive coverage); this is **not 100% measured factual accuracy**. No human ground-truth labels were collected. Useful accepted yield is 23/39 proposed changes (59.0%).

Twelve of sixteen description replacements were rejected as unnecessary generic rewrites; four accepted descriptions filled missing text. Two entry notes were rejected: one omitted a factual assertion from its claim list, and another removed useful queue advice. The two deferred notes concern current free-access evidence at the Louvre and conflicting official Catacombs booking guidance. Their entire changes are withheld automatically, even where other claims are supported. Notre-Dame retains its original unresolved source-access outcome.

The verifier uses the same model in fresh sessions, which reduces anchoring on the original rationale but does not eliminate correlated errors. It opens its own sources, supplies per-claim reasons and citations, and checks usefulness separately from factual support. All decisions are explicitly marked automated.

The private run directory contains [the metrics report](../app/.review-pilot/live-2026-09-12T12-36-14-922Z-fce820b3/report.md), [all cited proposals](../app/.review-pilot/live-2026-09-12T12-36-14-922Z-fce820b3/proposals.md), [the accepted draft export](../app/.review-pilot/live-2026-09-12T12-36-14-922Z-fce820b3/accepted-proposals.json), `verification-report.json` with every automatic verdict, and `run.json` with snapshots, session IDs, usage, and validation history. Those artifacts are local and intentionally excluded from Git and deployment. Use the [pilot guide](08-curator-review-pilot.md) to open the results UI or run the same automatic workflow on a future batch.

## Engineering findings to evaluate

These are observed workflow limitations and agent-reported research gaps, not independently verified venue facts.

1. **Model the actual experience.** The courtyard, museum interior, viewpoint, dome, public square, and gated garden can have different admission and access rules. Several drafts left fields unresolved because the matching experience ID did not exist. A future editor needs explicit scope and separate access records; a landmark-name match is insufficient.
2. **Represent dated and seasonal rules.** The drafts flagged renovation closures, seasonal hours, holiday closures, last entry, and room-clearing times. Weekly hours cannot represent all of these. Adding prose warnings alone will not stop the planner from scheduling an unavailable venue. Define date-bounded exceptions and planner behavior before automating updates to those fields.
3. **Define booking semantics.** `PlaceEntry.needed` has no semantic comment in the type and drives “Book tickets” versus “Reserve a slot” labels. The research agent explicitly could not tell whether it means paid admission or mandatory advance reservation. Separate or clearly define those concepts before exposing this field to an editor.
4. **Separate factual repair from editorial rewriting.** Sixteen of the 39 proposals replace `media.desc`; fifteen change `entry.note`; eight change `entry.cost`. Some descriptions become generic factual text while dropping useful curator advice. Count accepted useful corrections, not just valid rewrites. A subsequent prompt should preserve editorial voice and propose the smallest supported repair, while distinguishing witnessed statements from current operating information.
5. **Validate the complete integration.** Some proposed fields belong to records that do not yet exist. Orsay also has structured rates alongside its display price. The UI and export now flag complete-record creation and rate-card reconciliation requirements. Before any future publication path, build an isolated candidate catalog and run full schema, cross-reference, scheduling, and replay checks against it.
6. **Treat source access and failure recovery as product features.** Blocked official pages produced an explicit unresolved result. The credit failure preserved a submitted draft. Neither should be silently labeled verified or complete. The UI exposes unresolved work, failed drafts, and prior-attempt usage; successful records are retained across retries.
7. **Measure operating cost before scaling.** The token volume across 21 sessions shows why a larger refresh needs per-run budget attribution and a deliberate model/search policy. Cached tokens still incur cost. Do not infer affordability from the small record count or a high cached fraction.

## Next engineering work

The automated verifier now does the claim checks and usefulness decisions; the user does not need to adjudicate 133 claims manually. Uncertain changes remain withheld. Notre-Dame’s blocked retrieval remains unresolved rather than silently counting as a verified record.

The first improvement should be to make the research proposer preserve existing editorial voice and propose smaller factual repairs. Its broad description rewrites create avoidable verification work and discarded output. Next, build an isolated candidate-catalog step that can create complete entry records and reconcile display prices with structured rates, then run the full schema and planner checks. Current acceptance alone is insufficient for that integration. Use the recorded verification reasons and accepted drafts to specify those changes before any publication path.

Actual dollar-cost attribution and an independent accuracy/time study remain separate evaluation gaps. The pilot can inform engineering now without pretending those measurements exist.

Keep the traveler-facing editor deferred. Trip persistence and replay fidelity remain prerequisites for it, as agreed. AWS storage/queue infrastructure and read-only catalog MCP tools become worthwhile when shared curation or unattended refreshes are justified; this local run does not yet establish a need for that infrastructure.

## Verification

Twenty-one offline pilot tests pass, covering proposal validation, citation restrictions, experience scope, acceptance gates, missing measurements, API request shape, duplicate function delivery, uncertain creation, bounded retry history, cancellation, integration requirements, and draft export. Application build, city validation, planner invariants, route smoke tests, and media URL smoke tests passed. The build retains its existing large-bundle warning.

Browser checks of the automatic workflow confirmed 23 accepted exports with verifier provenance, `published: false`, a current catalog hash, automatic accepted/rejected/withheld rendering, zero manual adjudication controls, and no browser errors. Earlier browser checks exercised rejection of unsupported acceptance, saving and reloading a fixture decision, JSON export, responsive layout, and absence of browser errors. Live API execution verified the actual research/function-result/completion round trip and the bounded retry, with all 20 final sessions completing. The new tests cover automatic decision coverage, acceptance gates, matching proposal hashes, withheld uncertainty, and separation from human accuracy/time measurements. Automated source judgments can still share model errors; the live run tests the complete mechanism without establishing human ground truth.
