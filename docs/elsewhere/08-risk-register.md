# 08 — Risk register

Severity: critical = private data exposure or irreversible accepted-data loss; high = broken core behavior, rights breach or consequential false claim; medium = degraded usability, cost or discoverability. Likelihood is an engineering estimate under the proposed expansion, not a measured incident rate. Status distinguishes current evidence from prospective risk. Owners are roles to assign, not people presumed available.

| ID / priority | Risk and evidence | Severity / likelihood | Mitigation and release gate | Owner / phase |
|---|---|---|---|---|
| R01 / P0 | New editorial fields change whole-City hash (`trips/snapshot.ts:catalogVersion`), making saved versions uneditable | High / high | Keep culture outside City; preservation hashes and exact snapshot fixtures; separately version any future planner change | Planner lead / P0–P2 |
| R02 / P0 | Domain switch strands local-only plans (`cmt-local-companion-v1` is origin-scoped) | Critical / high if switched | Rebrand in place; old-domain recovery, export/import and explicit cloud copy before redirects; no forced key rename | Product + frontend / before domain change |
| R03 / P0 | Source files under `public/media`, fallback URLs or video retain sensitive metadata; `.vercelignore` exclusion commented | Critical / medium | Audit actual output and metadata; approved redacted public manifest, private originals outside public paths; test fallback too | Media/security / P0,P4 |
| R04 / P0 | New collections/evidence leak via permissive RLS, public caching or client projection | Critical / medium | Deny by default; owner composite constraints/WITH CHECK; A/B direct-RPC tests; no raw source payloads in public DTOs | Backend / P1,P3 |
| R05 / P0 | Copied/embedded metadata violates source-specific commercial/cache terms | High / high without policy | Per-field rights manifest and deletion pipeline; no Listen Notes standard-plan stored corpus or Spotify ML ingestion; contract/quote gates | Product/data / P1,P6 |
| R06 / P0 | GPS/photo/model output misrepresented as participation, filming evidence or recommendation | High / high | Separate claim types, experience scope and explicit human review; inspect 18 archive proposals; zero unsupported golden claims | Curator/data / all phases |
| R07 / P1 | New discovery city assumed planner-ready, rejected by SQL or lacking hours/templates | High / high | Separate Destination from City; reviewed capability mapping; preserve Paris/Rome SQL boundary until explicit migration | Planner/backend / P1,P5 |
| R08 / P1 | New routes work in SPA navigation but fail direct loads; rewrites only cover Paris/Rome | High / high | Add explicit hosting routes, raw HTTP and refresh tests, preserve API/generated HTML priority | Frontend/release / P2 |
| R09 / P1 | Discovery handoff overwrites draft or mutates accepted itinerary | Critical / medium | Review adapter outputs; explicit draft replacement or edit-copy; unchanged accepted bytes; no times in handoff contract | Planner / P5 |
| R10 / P1 | Brand changes rename CDK stack/bucket or remove legacy media paths | Critical / low with controls | Keep infrastructure identities; no delete/sync-delete; URL aliases, restore drill and withdrawal semantics | Infrastructure / P0,P4 |
| R11 / P1 | Existing AI routes lack shared usage controls; scaling discovery creates runaway spend | High / medium | Keep flags off until server quota, daily budget reservation, timeouts and rate limits; template/manual fallback | Backend/operations / P3 |
| R12 / P1 | Narrator adopts firsthand voice for researched places; prompts alone cannot ensure factuality | High / medium | Source-scoped templates, approved facts and abstention; evaluate Rome and exterior/interior cases | AI/product / P0,P3 |
| R13 / P1 | Licensed content expires but remains in embeddings, caches or generated pages | High / medium | Rights lineage and revision-triggered invalidation/rebuild; retention tests and kill switch | Data/operations / P1 onward |
| R14 / P1 | Implementation docs misstate live status; email/cron enabled unintentionally | High / medium | Read-only environment matrix; separate flags/workers; keep pilot controls and weather disabled status explicit | Release / P0 |
| R15 / P1 | Account deletion misses new cultural tables/jobs/private cached data | High / medium | Cascading FKs, owner job cancellation and deletion tests; document backup expiry | Backend / P3 |
| R16 / P1 | Identical title merges editions/remakes or a show with an episode | High / medium | Provider namespaces, type/language/year/creator discriminators; ambiguous resolution review; merge aliases and unmerge audit | Data / P1,P6 |
| R17 / P2 | Eager city/variant imports and Mapbox grow bundles; current build warns above 500kB | Medium / high at worldwide scope | Paginated culture APIs, lazy planner catalogs after baseline, on-demand maps, image budgets; measure route transfer | Frontend / P2,P4 |
| R18 / P2 | Vercel optimized paths and CDN originals diverge; moving all media breaks responsive display | High / medium | Preserve current split or add explicit unified manifest; verify 74 image sets, range video and old snapshots | Media / P4 |
| R19 / P2 | Public SPA pages lack indexable content or duplicate canonicals | Medium / high without work | Static approved public pages, HTTP metadata/status checks; measured SSR trigger | Frontend/content / P2 |
| R20 / P2 | Review backlog undermines depth or encourages auto-approval | High / medium | Small seed, daily budget/backlog cap, batch UX and independent accuracy sample | Curator/product / P1,P4 |
| R21 / P2 | Local-only/auth-session behavior feels like lost saves | Medium / medium | Explicit save confirmation, sign-in explanations, failed-save recovery and no silent import; separate journey cache | Product/frontend / P3 |
| R22 / P2 | Queue redelivery/stale review overwrites newer approved content | High / medium | Lease tokens, unique jobs, expected revision, idempotent publication, dead-letter handling | Backend / P4 |
| R23 / P2 | S3 versioning mistaken for independent archive backup; older versions expire at 90 days | Critical / low–medium | Independent original backup, manifests/checksums, restore drill and documented retention | Archive owner / P0,P4 |
| R24 / P2 | New analytics sends raw interests, private IDs or recovery tokens | High / medium | Extend existing path allowlist/redaction; no query text/custom private properties | Frontend/privacy / P2,P3 |
| R25 / P2 | Old catalog operating data is stale despite schema validity | High / medium | As-of/expiry and official-source review; do not equate archive capture with current hours | Curator / P0,P5 |
| R26 / P2 | Golden scores overfit small synthetic cases or use model agreement as truth | Medium / high | Human evidence, held-out entities, uncertainty labels, raw counts and regression cases | Quality/product / P1 onward |
| R27 / P2 | CSS/render checks miss keyboard/mobile/map accessibility regressions | Medium / medium | Interactive keyboard, screen-reader, zoom and mobile verification; text alternative to map | Frontend/QA / P2–P5 |

## Release stop conditions

Stop publication on private-source exposure, ownership failure, unsupported firsthand/filming claims, unlicensed stored fields, changed accepted schedules, or loss of recovery/export. Disable only the affected new surface; retain existing planner and recoverable user data. A rollback must not drop newly saved journeys or revert a migration destructively.

No risk here authorizes production changes in this audit. Existing content requiring factual review is a queue of questions, not an instruction to delete originals or automatically downgrade curator records.
