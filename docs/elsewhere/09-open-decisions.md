# 09 — Open decisions

Separate what the repository can settle from choices requiring product judgment or external verification. Recommendations below are defaults for the next implementation task, not purchases, migrations or launches performed now.

## Resolved from repository evidence

| Decision | Evidence and recommended resolution |
|---|---|
| Rewrite/framework migration? | No. `main.tsx`, `App.tsx`, existing CSS/components and passing offline tests support incremental React/Vite work |
| Replace deterministic scheduling? | No. `planner.ts`, `plan-presets.ts`, `trips/schema.ts` and replay tests provide hard constraints and frozen acceptance |
| Reuse accounts? | Yes. Supabase verified auth identities and owner-scoped cloud RPC already exist; add separate cultural tables |
| Put cultural metadata inside City? | No. `catalogVersion` hashes entire City; separate culture domain avoids editorial invalidation |
| Can any discovery city immediately plan trips? | No. City contract, static registry and migration 001's Paris/Rome allowlist require explicit planner onboarding |
| Is curator review a publisher? | No. `scripts/review/core.ts`/store/server implement review artifacts, not canonical publication |
| Are weather and alternatives public production capabilities? | Not established. Alternatives/weather routes are DEV-only; hosted flag/migration state must be checked separately |
| Is the original design document current? | No. Active CSS has newer typography/palette; planner marks heuristic travel estimated |
| Can branding rename persistence/infrastructure identities safely? | Not as a cosmetic task. Keep cmt keys/tables and CDK identity |
| Can the archive prove recommendations automatically? | No. Metadata/report semantics and experience-scoped source fields require curator judgment |

## Product decisions

| Question | Default recommendation | Owner / evidence needed / deadline |
|---|---|---|
| Who is the first audience: cultural traveler or broad thematic reader? | Lead with cultural travel plus one place-free theme to test broader value | Product; short usability interviews and save/revisit behavior; before P2 copy |
| Which destinations launch? | Paris + Rome; Lisbon later if real evidence/content is available | Curator/product; approved catalog and rights; P1 |
| What is the minimum catalog size? | Aim 30–40 useful books/films, but evidence quality wins over count | Curator; coverage of distinct user queries; P1 |
| When does Discover replace `/`? | After public discovery and save/reopen work; preserve old city routes | Product/release; P3 acceptance |
| How visible is Copy My Trip? | Transitional trip-planning descriptor; Elsewhere main identity | Product; brand recognition/usability; P2 |
| Anonymous library persistence? | Anonymous browsing and in-memory pending Save; signed-in durable journeys | Product; account friction vs scope; P3 |
| What does contemporary mean? | Editable setting-year range, separate from publication date | Editorial; user language tests; P1/P3 |
| Is immersion one label or a continuum? | Four explicit states with rationale: inhabit, plot, ambiguous, unknown | Editorial; agreement on sample works; P1 |
| Personalization consent/depth? | Explicit interests and consumed state; no hidden trip-brief inference | Product/privacy; control comprehension; P3 |
| Private collection sharing? | Defer; public editorial collections are distinct | Product/security; sharing demand; after MVP |
| Monetization? | Defer payments; later disclosed outbound affiliate links if useful | Product; agreements, bias evaluation, unit economics; P6 |
| Model/provider selection and budget? | Use existing server integration patterns; benchmark candidates on golden data, no forced agent framework | Engineering/product; latency/quality/rights and approved spend ceiling; before NL enablement |

## External/operational validation required

| Unknown | Why code cannot resolve it | Next concrete action and fallback |
|---|---|---|
| Current Vercel commit/root/flags, actual Supabase migrations and mail pilot closure | Source/history do not expose live state | Read-only environment inventory; keep new deployment gated and existing mail controls unchanged |
| Elsewhere domain availability/name rights and launch timing | Not a repository property | Product brand review and domain decision; continue existing origin meanwhile |
| Provider commercial rights, persistent fields, images and embedding permission | Public API access does not grant all rights | Obtain source-specific terms/quotes and record policy; own annotations and cleared identifiers are fallback |
| Full archive location, masters, consent and backup coverage | Repo represents Paris runtime subset, not verified 50-country inventory | Read-only owner-guided inventory, checksums and restore sample; no bulk movement |
| Public original-media metadata exposure | Source/config indicate possible paths but deployment not inspected | Enumerate build/deployed files and inspect output metadata; block new publication if unclear |
| Human accuracy and review throughput | Automated pilot records are not independent human evaluation | Adjudicate golden set; measure manual and batch review time on same task |
| Budget/account plan capacity | Local config files do not establish invoices, quotas or commercial eligibility | Review billing/quotas before activating provider/cron; cap local pilot and use FTS/manual curation |
| SEO acquisition value and static-build scale | Needs real pages/indexing/traffic | Ship small static public slice and monitor coverage/rebuild latency; SSR only if measured need |
| Accessibility/mobile completion | Source and server render tests are insufficient | Keyboard/screen-reader/390px flow tests on preview before P2/P3 release |
| Existing deployment backup/deletion retention | SQL cascade is not the hosted backup policy | Document DB/media backup retention and erasure expectations; avoid unsupported deletion guarantees |

## Architecture decision records to create during implementation

Write short ADRs for cultural identity/edition handling, rights-aware source storage, publication authority, public rendering, collection ownership and domain migration. Each should name evidence, alternatives, selected boundary, failure mode and reversal procedure. No ADR is needed to justify an unsolicited stack replacement: the default is to keep the proven stack.

Next concrete assignment: implement Phase 0 preservation fixtures/CI and deployment reconciliation, then review the first seed catalog and rights-policy entries. Do not combine brand launch, domain transfer, provider ingestion and planner schema changes into one release.
