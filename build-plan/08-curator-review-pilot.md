# Internal Paris review pilot

The pilot researches 20 frozen Paris records and produces cited proposals, then checks them in fresh source-verification sessions. The automatic pass accepts useful supported drafts, rejects errors and unhelpful rewrites, and withholds uncertainty. Acceptance records a decision; there is no publication or catalog mutation path. Trip persistence, replay fidelity, and the traveler-facing editor remain a subsequent scope decision.

## Current status

Implemented and tested locally on September 12, 2026. The live batch is:

`live-2026-09-12T12-36-14-922Z-fce820b3`

Authenticated research is complete for all 20 records: nineteen produced 39 reviewable changes (133 atomic claims), and Notre-Dame returned `needs_research` because official pages blocked retrieval. An initial credit-exhaustion failure at Grand Palais was recovered with one explicit retry after credits were restored; its original proposal/session/usage remain in attempt history. No current record is failed or unstarted. The user requested hands-off evaluation, so a second automated verification pass now records decisions and evidence without requiring manual claim checking. The completed automatic pass accepted 23 drafts, rejected 14, and withheld 2; all 133 claims received a verdict (130 supported and 3 unclear). Notre-Dame remains unresolved with no proposed changes. Its results appear in the private run report and results UI. Human factual accuracy, matched manual timing, and reconciled billing remain unmeasured. The first sandbox-blocked request created no remote session, confirmed by listing the project sessions before starting this batch. The separate `fixture-2026-09-12T12-28-10-114Z-a70fe644` batch contains synthetic proposals and browser-test decisions only. Its reference homepages were not fetched, and its metrics are not pilot evidence.

## Run it

Use Node 22 and run these commands from `app/`. Add `OPENAI_API_KEY` to `app/.env.local` or your shell environment; never prefix it with `VITE_`. The key needs Agents read/write and Responses write permissions (`api.agents.read`, `api.agents.write`, `api.responses.write`) and access to the configured model. The CLI reads only that variable from the local file; it does not send other environment variables to the agent.

```bash
npm run review -- verify live-2026-09-12T12-36-14-922Z-fce820b3
npm run review -- serve live-2026-09-12T12-36-14-922Z-fce820b3
```

Open `http://127.0.0.1:4317`. The research command runs sequentially and stops on the first failure. This batch has completed research. The `verify` command checks only records without saved decisions; rerunning it after completion skips them. Both research and verification are paid API work. The results page shows automatic verdicts and citations; it does not require you to fill in review forms. Stop the review server before running another command against the same batch; an exclusive writer lock prevents concurrent edits. After review, stop the server and generate the report:

```bash
npm run review -- usage live-2026-09-12T12-36-14-922Z-fce820b3
npm run review -- report live-2026-09-12T12-36-14-922Z-fce820b3
```

`report` writes `report.md`, a readable `proposals.md` with cited drafts and automatic decisions, `verification-report.json` with every verdict/reason, and `accepted-proposals.json` under the private run directory. `usage` refreshes best-effort API token counters; it does not calculate a bill. Dollar cost remains unmeasured unless the full-run model and web-search bill is reconciled. Report generation does not require entering an estimate. Each record displays its session ID for attribution in Platform logs.

For a new batch, `npm run review -- prepare` freezes the current catalog and prints its run ID. `REVIEW_MODEL` is read at preparation time (default `gpt-6-astra`, low reasoning effort). `REVIEW_PLACE_TIMEOUT_SECONDS` is read at research time (default 240, range 30–900). Elapsed-time limits and sequential execution reduce exposure but are **not a hard dollar cap**. Project billing controls should reflect the budget you intend to spend.

An offline interface demo is available with `npm run review -- fixture`, followed by `npm run review -- serve RUN_ID`. Fixture runs cannot call the live API.

## Automatic decisions and results

Run `verify RUN_ID` after research. Each proposed record gets a fresh session that opens official sources, checks every claim and the full proposed text, and assesses scope and editorial value. It does not receive the original rationale or alleged evidence as proof. The same model is used in a fresh context, so correlated errors remain possible.

Acceptance requires complete claim coverage, current supporting evidence, correct experience scope, and a useful change. Unsupported or unnecessary rewrites are rejected; uncertain proposals are deferred and withheld. A blocked `needs_research` record with no changes stays unresolved without another paid call. The results view displays decisions and citations, with no routine manual adjudication step. Original proposals remain preserved.

The export is JSON with `published: false`, run identity, fixture/live kind, catalog hash, before/after values, claims, citations, decisions, verification provenance, and metrics. Each accepted automatic draft carries the verifier session, version, proposal hash, reasons, and evidence. It remains a draft for later integration. A changed catalog blocks acceptance and export until a fresh snapshot is reviewed. Existing human decisions are never overwritten by `verify`.

The optional manual controls remain available for new unassessed runs and offline fixtures. They are not a requirement for this automated workflow.

## Measurement protocol and editor decision

The curator confirmed that no measured manual baseline is available yet; time saved must remain unmeasured. Use an independent reviewer for the manual comparison when possible. Have that reviewer check the frozen records without seeing the agent output. Time the same tasks and source-checking scope. If one person does both, counterbalance order across records and record the likely learning effect. Track source-reading time consistently in both conditions; pause for unrelated work. The UI timer includes time in source tabs until explicitly paused or saved; record the method and any interruptions.

The report computes:

| Measure | Definition | Interpretation |
|---|---|---|
| Factual accuracy | Human-supported / (human-supported + human-unsupported) claims | Excludes automated and mixed reviews; remains unmeasured for this automatic run |
| Automated evidence support | Model-supported / (model-supported + model-unsupported) claims | A verifier judgment, not independently established accuracy; report unclear counts and coverage |
| Review time saved | Sum of manual baseline minus assisted review time for completed records with both measured durations | May be negative; excludes unpaired records and agent waiting time |
| Cost per accepted change | Reconciled cost of the entire run / accepted changes | Includes research, verification, model/search charges and failed attempts; undefined until cost is entered and at least one change is accepted |
| Coverage | Completed research and human reviews out of 20 | A `needs_research` result can complete a research attempt without yielding a useful change |

Do not use the agent's own confidence as ground truth. A correct-looking citation can still support the wrong experience or date. Also inspect unchanged fields and `no_change` conclusions for missed errors: precision on proposed claims does not measure recall. Record omissions separately in the evaluation notes. Summaries of `no_change` and `needs_research` are not included in the claim-accuracy denominator.

Use the automatic decisions, withheld cases, and recurrent errors to scope the next engineering work. Independent accuracy and time-savings measurements would require a separate evaluation; their absence must not be disguised by model agreement or model runtime. With only 20 records, treat results as directional. Recommended decision criteria: no accepted unsupported claims or provenance promotions; substantial adjudication coverage; useful accepted changes; and positive observed time savings at an acceptable recorded cost. Do not invent a cost threshold or claim statistical confidence from this sample.

Use the failure distribution to choose the next work. Experience mismatches point to richer experience IDs and scope validation. Seasonal/temporary rules point to schema changes. Missing evidence points to retrieval work. Successful review with slow human checking points to better citation presentation. Only after the pilot results support a useful editor should its implementation begin, with persistence and replay fidelity fixed first.

## Integration design

`scripts/review/paris-pilot.json` pins 10 archive-backed and 10 researched places, with official source-domain allowlists. This is a deliberately varied convenience sample, not a random estimate of the full catalog.

`store.ts` freezes catalog context and archive metadata; `agent.ts` starts one Agents API session per record with live web search and one custom function, `submit_place_review`. The session has `environment: { type: "none" }`: no writable sandbox, credentials, application backend, or publication tool. The external function handler validates proposals before acknowledging the tool result. It stores the result first so repeated delivery does not replace it. A completed root turn is required before a record becomes available for review.

`core.ts` enforces field allowlists, types, actual before values, experience IDs, source domains/dates, declared citations, and cross-field constraints. It also flags proposals that require creation of a complete entry/media record or reconciliation with an existing structured rate card. A passed field check is not a full catalog-migration validation. It does not establish that the linked page was fetched or that a claim is true. The separate verifier supplies an explicitly automated judgment; optional human evaluation is tracked separately. The only editable proposal fields are opening information (`place.open`, `place.hours`, `place.closedOn`), entry notes/cost/booking need, and `media.desc`. No changes to coordinates, durations, visits, archive provenance, or planner output are permitted.

`verify.ts` validates exact proposal hashes, ordered claim coverage, source allowlists, and acceptance gates before applying automatic decisions. It reuses the persisted function-result/completion protocol and does not overwrite saved reviews.

`server.ts` serves the results UI on loopback only, with an ephemeral request token, same-origin mutation checks, a restrictive content security policy, revision checks, and selected JPEG access. Run data is private local storage under `app/.review-pilot/RUN_ID/`, excluded from Git and Vercel deployment. This is a single-curator local tool; do not expose it publicly as a multiuser service.

This adds no traveler-facing API route and no runtime model dependency to the deterministic planner. The REST adapter is narrow and isolated so beta API changes can be accommodated without changing the review protocol.

### Where AWS or MCP becomes useful

Neither is necessary for this local experiment. Their value emerges if the pilot proves useful and needs shared or unattended operation:

| Need demonstrated by the pilot | Potential integration | Why it helps |
|---|---|---|
| Shared durable proposal history | Private S3 objects for immutable run artifacts; DynamoDB or Postgres for decisions, revisions, and indexes | Review history survives laptop/process loss and supports multiple curators |
| Scheduled refreshes across cities | EventBridge and an SQS-backed worker; webhook receiver for Agents session events | Moves long-running research off an interactive process and provides retry/dead-letter visibility |
| Operating and cost attribution | CloudWatch for worker events; session/run/place IDs in logs; reconciled provider usage | Connects failed or expensive research to a specific batch and record |
| Multiple assistants need the same catalog tools | Narrow read-only MCP tools such as `get_place_snapshot` and `get_archive_metadata` | Reuses a stable data boundary across agents instead of giving them broad cloud/database access |

Keep proposal submission validated at the application boundary even if exposed through MCP. An AWS infrastructure MCP is useful for development/operations exploration, but broad cloud control is unrelated to a place-research agent's job. Publication should remain a separate authorized operation with its own validation and audit trail. Provision none of this until the pilot gives a reason to absorb its operational overhead.

## Recovery and validation

`run RUN_ID` resumes known sessions and skips completed records. It never automatically retries an uncertain session creation. If creation times out after the provider may have accepted it, inspect Platform logs using run/place metadata, then attach the actual session:

```bash
npm run review -- attach RUN_ID PLACE_ID sess_ACTUAL_ID
npm run review -- run RUN_ID
```

The attach command verifies the returned session metadata before accepting it. If no session was created, prepare a fresh batch; do not edit saved IDs to bypass the guard. A known failed/cancelled session can be retried once with `retry RUN_ID PLACE_ID`. That command first verifies the remote terminal state, preserves the old proposal/session/usage, and clears the cost reconciliation. It refuses a second retry or a retry with recorded reviews. The subsequent `run` uses a distinct creation key and skips completed places. Include every attempt when evaluating cost; `usage` refreshes the archived attempts too. Use the billing evidence note to describe attribution across runs if applicable.

The Grand Palais retry below was already used successfully for this batch. These commands document the recovery; do not rerun the retry against the completed record:

```bash
npm run review -- retry live-2026-09-12T12-36-14-922Z-fce820b3 grandpalais
npm run review -- run live-2026-09-12T12-36-14-922Z-fce820b3
```

Ctrl-C requests cancellation after the active HTTP request returns (requests have a 30-second timeout). A forced process termination cannot guarantee remote cancellation. Use `npm run review -- cancel RUN_ID` for unfinished sessions and confirm final state in Platform logs. If a hard crash leaves `writer.lock`, inspect its PID and remove that one lock only after confirming no writer is running. Known completed sessions can still be collected after the local research deadline; active sessions beyond the deadline are cancelled.

```bash
npm run test:review
npm run build
npm run validate:cities
npm run smoke:plans
npm run smoke
npm run smoke:media-url
```

Pilot tests cover strict validation, unsafe citations, stale snapshots, experience scope, acceptance rules, missing measurements, API request shape, repeated tool delivery, uncertain creation, timeout/interruption cancellation, local HTTP protection, and draft-only export. The automated tests mock provider behavior. The separate authenticated pilot exercises beta API compatibility; source quality remains a model assessment until independently evaluated. The verifier tests additionally cover claim coverage, scope/usefulness gates, missing evidence, unchanged proposal hashes, deferral, and separation from human accuracy/timing. The browser demo verifies review persistence and export separately from those mocked transport tests.

Official API references consulted for the adapter: [Agents API introduction](https://openai.com/index/introducing-the-agents-api/), [overview](https://developers.openai.com/api/docs/guides/agents-api/overview), [function tools](https://developers.openai.com/api/docs/guides/agents-api/tools/functions), [web search](https://developers.openai.com/api/docs/guides/agents-api/tools/web-search), [session management](https://developers.openai.com/api/docs/guides/agents-api/sessions/manage), and [observability](https://developers.openai.com/api/docs/guides/agents-api/observability).
