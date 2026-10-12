# Elsewhere — Executive summary

October 11, 2026. Planning-only audit: no new product features, production database changes, infrastructure changes, deployments, email sends or paid enrichment calls were performed.

**The Elsewhere pivot is technically sensible as an additive expansion of Copy My Trip.** Keep the current application, deterministic itinerary engine, frozen accepted-trip contracts, accounts and archive investment. Build cultural discovery and private collections beside them, with an explicit handoff into planning.

## What the repository actually contains

The current React/Vite/TypeScript application is more mature than its older introductory documentation suggests: validated local drafts and accepted snapshots, replay fidelity, private Supabase cloud copies, account recovery/deletion, maps, media derivatives, gated email infrastructure, development-only weather/closure alternatives and a private curator research/review tool. Paris has 127 catalog places (33 marked verified), four curated days and an original media archive. Rome has 42 researched places and no firsthand archive. Three Paris curated stops still lack place IDs.

There is no implemented cultural-work catalog, cross-media discovery, personal cultural library or taste profile. The worldwide archive described in the brief is not yet a verified indexed dataset in this repository. Historical hosted test records exist, but this audit does not certify current deployed configuration.

## Retain, change and build

| Retain | Change incrementally | Build new |
|---|---|---|
| React/Vite/Router and current editorial CSS/fonts | Add global navigation outside city-scoped Layout | Normalized works, editions, creators, themes and qualified geographic relationships |
| `planner.ts` and `plan-presets.ts` deterministic feasibility | Add Discover/Places/My Elsewhere/My Trips routes while preserving old paths | Claim/evidence/rights/review/publication model |
| Snapshot schema v1, replay intent, local keys and existing cloud contracts | Make discovery the landing page only after useful content and saving exist | Owner-scoped cultural journeys, consumed states and explicit interests |
| Existing Supabase accounts and private cloud-save behavior | Extend RLS/deletion to new tables | Structured search, later bounded natural-language interpretation |
| Original media, slot aliases, display variants, S3/CloudFront | Audit public metadata and clarify optimized/CDN delivery | Batch archive review and an explicit culture-to-planner adapter |
| Curator review's frozen proposals/atomic claim checks | Add a distinct publication boundary | Static public destination/work pages for metadata/indexing |

The principal source anchors are `app/src/lib/trips/snapshot.ts` (`catalogVersion`, `canEdit`, `acceptSnapshot`), `app/src/lib/trips/schema.ts` (`PlanSnapshot`, version/date validation), `app/src/lib/planner.ts` (`buildCandidates`, `replayDay`), `app/src/state/TripContext.tsx`, `app/src/lib/cloud/schema.ts`, migration `202609120001_companion_cloud.sql`, `app/src/App.tsx`, `app/scripts/review/core.ts` and `infra/lib/media-stack.ts`. Detailed findings and contracts are in [01](01-existing-system-audit.md).

## Recommended architecture and MVP

Use the existing Supabase Postgres for additive `ew_` cultural and collection tables. Keep editorial culture outside City: the existing snapshot editability check hashes the whole city object, so even harmless editorial additions could make accepted plans read-only. Geography available for discovery is distinct from geography supported by the planner; the cloud SQL currently explicitly permits only Paris/Rome.

Start with a curated Paris/Rome book-and-film experience, 20–30 selected approved Paris photographs, a researched-only Rome presentation, and one place-independent theme collection. Target 30–40 genuinely useful reviewed works rather than a large shallow catalog. Users can understand why a work relates, refine structured dimensions, save a flexible journey, reopen it and exclude consumed works. Existing trip planning remains accessible. Natural-language interpretation is optional and gated by evidence, latency and budget tests; it never schedules.

Use Postgres full-text search first. Add pgvector only if held-out relevance improves over the curated/lexical baseline using permitted text. Generate a small set of public HTML pages without migrating the planner to Next.js. Provider rights are a first-class data constraint: API metadata, cover art, excerpts and embeddings do not share blanket permissions. The provider assessment and official-source links are in [03](03-cultural-data-architecture.md).

## Migration sequence

Preservation fixtures and live-state reconciliation → cultural contracts/rights/golden set → editorial public surfaces → private journeys and structured discovery → default landing-page switch → archive workbench/atlas → reviewed planner handoff → additional media and monetization. Keep the current origin for MVP. A new domain requires a separate local-data recovery/export/cloud-copy plan because browser storage cannot follow a redirect.

The first concrete implementation phase is **Phase 0**: record accepted snapshot and catalog baselines, add regression/CI coverage, reconcile hosted configuration read-only, and audit public media/backup boundaries. It changes no planner algorithms or user data. [07](07-implementation-plan.md) defines workstreams, migrations, API contracts, tests, risks, acceptance gates and deferrals for every phase.

## Verification and limits

City validation, deterministic planner invariants, 19 route checks, 16 companion checks, 10 cloud application checks, 21 curator tests, 11 mail checks, 8 weather checks, 7 weather/mail checks, 14 proposal checks, 11 analytics checks, map/media and URL checks, and the production build passed. The cloud suite initially hit a sandbox localhost restriction and passed on a permitted offline rerun. The build reports large chunks; that is a scaling concern, not a failing build.

The report-only archive audit found 114/114 readable capture times, 86/114 GPS records, temporal evidence associated with 25 places and 18 proposals requiring review. The separate media-location audit reported eight findings. These findings are not automatic factual corrections. No current hosted DB/RLS/browser/email delivery checks were rerun; local fixtures cannot establish those services' live state. See the audit's verification ledger for further details and filesystem limitations.

## Highest risks and deliberate exclusions

Protect frozen snapshots and origin-local plans; prevent private metadata leakage and unsupported firsthand claims; enforce new ownership policies; clear commercial/storage/embedding rights; avoid broken deep links; bound AI/provider costs. Existing binary verified/web labels need richer evidence beside them, not automatic reinterpretation.

Do not build a replacement planner, a new framework/backend, a full graph database, a separate vector service, autonomous bulk publication, all-media ingestion, a booking marketplace, a complete 50-country catalog or payments yet. Do not rename old storage/table/CDK identities for branding. Product audience, name/domain, provider terms, curation capacity and budgets remain explicit decisions in [09](09-open-decisions.md); prioritized risks are in [08](08-risk-register.md).

## Document guide

1. [Existing-system audit](01-existing-system-audit.md)
2. [Product consolidation](02-product-consolidation.md)
3. [Cultural data architecture and providers](03-cultural-data-architecture.md)
4. [Archive integration](04-archive-integration.md)
5. [UX and information architecture](05-ux-and-information-architecture.md)
6. [Target architecture](06-target-architecture.md)
7. [Implementation phases and evaluation framework](07-implementation-plan.md)
8. [Risk register](08-risk-register.md)
9. [Open decisions](09-open-decisions.md)
