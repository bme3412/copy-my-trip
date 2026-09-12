# 10 — Companion audit coverage and verification ledger

Companion to [the reconciliation plan](10-travel-companion-reconciliation.md). Audit date: 12 September 2026; base commit `5d6c04b`, plus existing uncommitted work. This is an inspection ledger, not a claim that every file is correct or every product claim is current.

## Method and scope

Repository/ancestor instructions and git status were checked first; no applicable `AGENTS.md` was found. The inventory followed runtime imports and included ignored first-party infrastructure and pilot files. Text was read in bounded chunks where necessary; structured city data were parsed and inspected by record rather than dumped as one oversized output. The historical reference documents were read but explicitly classified as superseded proposals.

Statuses in the file ledger:

- **Full:** complete relevant first-party text inspected during this audit, including chunked reads.
- **Structured:** all records of a JSON data file inspected in parsed/normalized views; does not mean every raw formatting byte was read.
- **Sampled:** only stated sections or metadata inspected; no exhaustive claim.
- **Excluded:** intentionally not full-text inspected, with reason.

Source read coverage is distinct from execution. A read script was not necessarily executed. Successful schema checks do not prove real-world operating facts. Current browser behavior, mobile interaction, deployed infrastructure, external account settings, source freshness, and production secrets were not verified.

## Directory inventory

```text
copy-my-trip/
  README.md, Design.MD, .gitignore
  app/
    api/                         two Anthropic serverless handlers
    src/
      cities/                    shared types/registry
        paris/data/              ten JSON datasets + city adapter
        rome/data/               ten JSON datasets + city adapter
      components/                fourteen components
      lib/                       eleven planner/presentation/AI helpers
      pages/                     five route pages
      state/                     city and trip contexts
      styles/                    app and classical styles
    scripts/                     twelve top-level audit/build/media scripts
      review/                    nine curator-pilot files
    public/media/paris/          114 binary assets + SLOTS.md
    package/config/example files
  infra/                         package/CDK/TypeScript config
    bin/                         CDK entry point
    lib/                         S3/CloudFront stack
  build-plan/                    existing numbered documents 00–09
    reference/                   two superseded designs + seed leads
  project/                       historical design prototype/support code
    screenshots/                 five historical screenshots
    _ds/classical-…/             five design-system files
```

Dependency directories, `.git` internals, build output (`app/dist`, `infra/cdk.out` if present), `.vercel`, temporary bundles, compiler caches, `.DS_Store`, and Python caches were excluded from full reading. Lockfiles were inspected for root dependencies/metadata only, not audited as complete dependency graphs. No dependency installation or vulnerability scan was performed.

Real `.env` files and credentials were excluded; `app/.env.example` and code references were read. Generated private `.review-pilot` run artifacts were not fully reread in this audit; prior results are attributed to `09-pilot-observations.md`, while the pilot implementation and offline tests were inspected. No fresh Agents API run occurred. Binary media content was sampled as listed below. New documentation created by this audit is outside the pre-audit source ledger.

## Per-file text coverage

Paths below are repository-relative. Each row identifies the specific inspected file; proposed implementation paths are deliberately absent.

| File | Coverage | Notes |
|---|---|---|
| `.gitignore` | Full | First-party source, configuration, or documentation. |
| `Design.MD` | Full | First-party source, configuration, or documentation. |
| `README.md` | Full | First-party source, configuration, or documentation. |
| `app/.env.example` | Full | Example only; real credential values not read. |
| `app/.gitignore` | Full | First-party source, configuration, or documentation. |
| `app/.vercelignore` | Full | First-party source, configuration, or documentation. |
| `app/api/extract-preferences.ts` | Full | First-party source, configuration, or documentation. |
| `app/api/narrate-day.ts` | Full | First-party source, configuration, or documentation. |
| `app/index.html` | Full | First-party source, configuration, or documentation. |
| `app/media-extras.json` | Full | First-party source, configuration, or documentation. |
| `app/package-lock.json` | Sampled | Lockfile version and root package/dependency metadata; not full transitive audit. |
| `app/package.json` | Full | First-party source, configuration, or documentation. |
| `app/public/media/paris/SLOTS.md` | Full | First-party source, configuration, or documentation. |
| `app/scripts/archive-evidence.ts` | Full | First-party source, configuration, or documentation. |
| `app/scripts/archive-files.ts` | Full | First-party source, configuration, or documentation. |
| `app/scripts/diag.ts` | Full | First-party source, configuration, or documentation. |
| `app/scripts/extract-dates.sh` | Full | First-party source, configuration, or documentation. |
| `app/scripts/list-slots.ts` | Full | First-party source, configuration, or documentation. |
| `app/scripts/media-audit.ts` | Full | First-party source, configuration, or documentation. |
| `app/scripts/media-url-smoke.ts` | Full | First-party source, configuration, or documentation. |
| `app/scripts/prep-media.sh` | Full | First-party source, configuration, or documentation. |
| `app/scripts/preset-smoke.ts` | Full | First-party source, configuration, or documentation. |
| `app/scripts/publish-media.ts` | Full | First-party source, configuration, or documentation. |
| `app/scripts/review/agent.ts` | Full | Pilot implementation, schema, local UI/security, fixtures or tests; no paid execution. |
| `app/scripts/review/cli.ts` | Full | Pilot implementation, schema, local UI/security, fixtures or tests; no paid execution. |
| `app/scripts/review/core.ts` | Full | Pilot implementation, schema, local UI/security, fixtures or tests; no paid execution. |
| `app/scripts/review/paris-pilot.json` | Full | Pilot implementation, schema, local UI/security, fixtures or tests; no paid execution. |
| `app/scripts/review/review.html` | Full | Pilot implementation, schema, local UI/security, fixtures or tests; no paid execution. |
| `app/scripts/review/server.ts` | Full | Pilot implementation, schema, local UI/security, fixtures or tests; no paid execution. |
| `app/scripts/review/store.ts` | Full | Pilot implementation, schema, local UI/security, fixtures or tests; no paid execution. |
| `app/scripts/review/tests.ts` | Full | Pilot implementation, schema, local UI/security, fixtures or tests; no paid execution. |
| `app/scripts/review/verify.ts` | Full | Pilot implementation, schema, local UI/security, fixtures or tests; no paid execution. |
| `app/scripts/route-smoke.tsx` | Full | First-party source, configuration, or documentation. |
| `app/scripts/validate-city.ts` | Full | First-party source, configuration, or documentation. |
| `app/src/App.tsx` | Full | First-party source, configuration, or documentation. |
| `app/src/cities/index.ts` | Full | First-party source, configuration, or documentation. |
| `app/src/cities/paris/data/city.json` | Structured | All city-data records inspected; manifest/provenance/hour/experience relationships followed. |
| `app/src/cities/paris/data/curated-days.json` | Structured | All city-data records inspected; manifest/provenance/hour/experience relationships followed. |
| `app/src/cities/paris/data/entry.json` | Structured | All city-data records inspected; manifest/provenance/hour/experience relationships followed. |
| `app/src/cities/paris/data/hoods.json` | Structured | All city-data records inspected; manifest/provenance/hour/experience relationships followed. |
| `app/src/cities/paris/data/info.json` | Structured | All city-data records inspected; manifest/provenance/hour/experience relationships followed. |
| `app/src/cities/paris/data/media-dates.json` | Structured | All city-data records inspected; manifest/provenance/hour/experience relationships followed. |
| `app/src/cities/paris/data/media.json` | Structured | All city-data records inspected; manifest/provenance/hour/experience relationships followed. |
| `app/src/cities/paris/data/nodes.json` | Structured | All city-data records inspected; manifest/provenance/hour/experience relationships followed. |
| `app/src/cities/paris/data/places.json` | Structured | All city-data records inspected; manifest/provenance/hour/experience relationships followed. |
| `app/src/cities/paris/data/slot-files.json` | Structured | All city-data records inspected; manifest/provenance/hour/experience relationships followed. |
| `app/src/cities/paris/index.ts` | Full | First-party source, configuration, or documentation. |
| `app/src/cities/rome/data/city.json` | Structured | All city-data records inspected; manifest/provenance/hour/experience relationships followed. |
| `app/src/cities/rome/data/curated-days.json` | Structured | All city-data records inspected; manifest/provenance/hour/experience relationships followed. |
| `app/src/cities/rome/data/entry.json` | Structured | All city-data records inspected; manifest/provenance/hour/experience relationships followed. |
| `app/src/cities/rome/data/hoods.json` | Structured | All city-data records inspected; manifest/provenance/hour/experience relationships followed. |
| `app/src/cities/rome/data/info.json` | Structured | All city-data records inspected; manifest/provenance/hour/experience relationships followed. |
| `app/src/cities/rome/data/media-dates.json` | Structured | All city-data records inspected; manifest/provenance/hour/experience relationships followed. |
| `app/src/cities/rome/data/media.json` | Structured | All city-data records inspected; manifest/provenance/hour/experience relationships followed. |
| `app/src/cities/rome/data/nodes.json` | Structured | All city-data records inspected; manifest/provenance/hour/experience relationships followed. |
| `app/src/cities/rome/data/places.json` | Structured | All city-data records inspected; manifest/provenance/hour/experience relationships followed. |
| `app/src/cities/rome/data/slot-files.json` | Structured | All city-data records inspected; manifest/provenance/hour/experience relationships followed. |
| `app/src/cities/rome/index.ts` | Full | First-party source, configuration, or documentation. |
| `app/src/cities/types.ts` | Full | First-party source, configuration, or documentation. |
| `app/src/components/ArchiveMap.tsx` | Full | First-party source, configuration, or documentation. |
| `app/src/components/CandidateCard.tsx` | Full | First-party source, configuration, or documentation. |
| `app/src/components/CoverageStrip.tsx` | Full | First-party source, configuration, or documentation. |
| `app/src/components/DateRangePicker.tsx` | Full | First-party source, configuration, or documentation. |
| `app/src/components/DayTimeline.tsx` | Full | First-party source, configuration, or documentation. |
| `app/src/components/FlowStepper.tsx` | Full | First-party source, configuration, or documentation. |
| `app/src/components/HeroPhoto.tsx` | Full | First-party source, configuration, or documentation. |
| `app/src/components/ImageSlot.tsx` | Full | First-party source, configuration, or documentation. |
| `app/src/components/Layout.tsx` | Full | First-party source, configuration, or documentation. |
| `app/src/components/ReconsiderDeck.tsx` | Full | First-party source, configuration, or documentation. |
| `app/src/components/RouteMap.tsx` | Full | First-party source, configuration, or documentation. |
| `app/src/components/TripMap.tsx` | Full | First-party source, configuration, or documentation. |
| `app/src/components/VideoBadge.tsx` | Full | First-party source, configuration, or documentation. |
| `app/src/components/icons.tsx` | Full | First-party source, configuration, or documentation. |
| `app/src/lib/built-day.ts` | Full | First-party source, configuration, or documentation. |
| `app/src/lib/extract.ts` | Full | First-party source, configuration, or documentation. |
| `app/src/lib/media.ts` | Full | First-party source, configuration, or documentation. |
| `app/src/lib/narrate.ts` | Full | First-party source, configuration, or documentation. |
| `app/src/lib/plan-presets.ts` | Full | First-party source, configuration, or documentation. |
| `app/src/lib/planner.ts` | Full | First-party source, configuration, or documentation. |
| `app/src/lib/slug.ts` | Full | First-party source, configuration, or documentation. |
| `app/src/lib/sun.ts` | Full | First-party source, configuration, or documentation. |
| `app/src/lib/text.tsx` | Full | First-party source, configuration, or documentation. |
| `app/src/lib/useReveal.ts` | Full | First-party source, configuration, or documentation. |
| `app/src/lib/video-director.ts` | Full | First-party source, configuration, or documentation. |
| `app/src/main.tsx` | Full | First-party source, configuration, or documentation. |
| `app/src/pages/ArchivePage.tsx` | Full | First-party source, configuration, or documentation. |
| `app/src/pages/ComposePage.tsx` | Full | First-party source, configuration, or documentation. |
| `app/src/pages/Home.tsx` | Full | First-party source, configuration, or documentation. |
| `app/src/pages/ItineraryPage.tsx` | Full | First-party source, configuration, or documentation. |
| `app/src/pages/NeighbourhoodsPage.tsx` | Full | First-party source, configuration, or documentation. |
| `app/src/state/CityContext.tsx` | Full | First-party source, configuration, or documentation. |
| `app/src/state/TripContext.tsx` | Full | First-party source, configuration, or documentation. |
| `app/src/styles/app.css` | Full | First-party source, configuration, or documentation. |
| `app/src/styles/classical.css` | Full | First-party source, configuration, or documentation. |
| `app/tsconfig.json` | Full | First-party source, configuration, or documentation. |
| `app/tsconfig.review.json` | Full | First-party source, configuration, or documentation. |
| `app/tsconfig.tsbuildinfo` | Excluded | Generated compiler cache. |
| `app/vite.config.ts` | Full | First-party source, configuration, or documentation. |
| `build-plan/00-current-state.md` | Full | First-party source, configuration, or documentation. |
| `build-plan/01-principles.md` | Full | First-party source, configuration, or documentation. |
| `build-plan/02-roadmap.md` | Full | First-party source, configuration, or documentation. |
| `build-plan/03-itinerary.md` | Full | First-party source, configuration, or documentation. |
| `build-plan/04-engine-audit.md` | Full | First-party source, configuration, or documentation. |
| `build-plan/05-audit-remediation.md` | Full | First-party source, configuration, or documentation. |
| `build-plan/06-archive-evidence.md` | Full | First-party source, configuration, or documentation. |
| `build-plan/07-engineering-and-integrations-audit.md` | Full | First-party source, configuration, or documentation. |
| `build-plan/08-curator-review-pilot.md` | Full | First-party source, configuration, or documentation. |
| `build-plan/09-pilot-observations.md` | Full | First-party source, configuration, or documentation. |
| `build-plan/reference/2026-seed-leads.md` | Full | First-party source, configuration, or documentation. |
| `build-plan/reference/architecture.md` | Full | Read fully; explicitly superseded design, not implemented behavior. |
| `build-plan/reference/logic.md` | Full | Read fully; explicitly superseded design, not implemented behavior. |
| `infra/.gitignore` | Full | First-party source, configuration, or documentation. |
| `infra/bin/copy-my-trip-media.ts` | Full | First-party source, configuration, or documentation. |
| `infra/cdk.json` | Full | First-party source, configuration, or documentation. |
| `infra/lib/media-stack.ts` | Full | First-party source, configuration, or documentation. |
| `infra/package-lock.json` | Sampled | Lockfile version and root package/dependency metadata; not full transitive audit. |
| `infra/package.json` | Full | First-party source, configuration, or documentation. |
| `infra/tsconfig.json` | Full | First-party source, configuration, or documentation. |
| `project/.thumbnail` | Excluded | Binary prototype thumbnail. |
| `project/Copy My Trip.dc.html` | Sampled | Opening structure, imports, and design patterns; historical prototype, not runtime. |
| `project/_ds/classical-ffed69ed-0a5d-494e-ad20-db55ed454d95/_adherence.oxlintrc.json` | Full | First-party source, configuration, or documentation. |
| `project/_ds/classical-ffed69ed-0a5d-494e-ad20-db55ed454d95/_ds_bundle.js` | Full | First-party source, configuration, or documentation. |
| `project/_ds/classical-ffed69ed-0a5d-494e-ad20-db55ed454d95/_ds_manifest.json` | Sampled | Design metadata/schema and token inventory. |
| `project/_ds/classical-ffed69ed-0a5d-494e-ad20-db55ed454d95/readme.md` | Full | First-party source, configuration, or documentation. |
| `project/_ds/classical-ffed69ed-0a5d-494e-ad20-db55ed454d95/styles.css` | Sampled | Opening design styles; runtime styles separately read in full. |
| `project/image-slot.js` | Sampled | Header/opening code and role; large generated/copied support bundle. |
| `project/support.js` | Sampled | Header/opening code and role; large generated/copied support bundle. |

## Media and prototype sampling

- Read `app/public/media/paris/SLOTS.md`, both cities' media/slot/date manifests, `app/media-extras.json`, and the metadata/publication/audit scripts.
- Inspected metadata and slot relationships across the enumerated 114 Paris binary files. Metadata reporting found capture-time fields on 114 and GPS on 86; 25 places had mapped temporal evidence. Metadata accuracy and location/visit scope are not established merely by these counts.
- Visually viewed `app/public/media/paris/paris-louvre-pyramid-courtyard.jpeg` (courtyard exterior), `app/public/media/paris/_gen-maison-rose.jpg` (street/building image), and `project/screenshots/builder3.png` (historical builder screenshot).
- Other photos/videos and four remaining historical screenshots were inventoried, not fully visually reviewed. No video-by-video editorial verification occurred. No fresh current-app browser or mobile screenshot was taken.
- Media audit found eight verified places without files in declared slots. Archive-evidence analysis produced 18 report-only proposals. Neither script was run with an apply flag, and metadata proposals were not promoted into canonical facts.

## Verification commands and outcomes

Working directory is `app/` unless noted. Commands used already-installed tools. The standard scripts create disposable bundles under `node_modules/.tmp`; the production build creates generated output. No dependency/lockfile edits were needed.

| Command/check | Result | What it establishes / limitation |
|---|---|---|
| `npm run build` | PASS | Frontend TypeScript project check and Vite production build. Vite reported large chunks: main approximately 517.78 kB, Mapbox approximately 1,859.16 kB before gzip. Does not check API routes, deployment, or browser runtime. |
| `npm run validate:cities` | PASS, 2 cities | Structural/cross-reference city checks implemented by the existing script. Not current-fact verification. |
| `npm run smoke:plans` | PASS | Existing deterministic planner/preset checks, including city/pace/variant/date/timezone cases. Does not establish lossless complete snapshot replay; targeted fixture below exposed gaps. |
| `npm run smoke` | PASS, 19 checks | 12 SSR renders and 7 redirects. Does not execute browser interactions, maps, auth, or mobile layout. |
| `npm run smoke:media-url` | PASS, 3 checks | Local/CDN media URL resolver behavior. No publication or live CDN verification. |
| `npm run media:manifest` | PASS, 94 assets / about 299.6 MiB | `--check` manifest validation only. No S3 writes or CloudFront invalidation. |
| `npm run test:review` | PASS, 21 tests on completed rerun | Offline/mocked pilot validation, decisions, store, verifier, local review server. Initial sandbox run passed 20 and hit a loopback `EPERM` on the server test; an approved rerun completed all 21. No paid provider calls. |
| Explicit strict API TypeScript command below | PASS | Both existing API routes typecheck. They are not included by ordinary app build. An initial command used incorrect filenames and was corrected; that probe was not an application failure. |
| `npm run build` in `infra/` | PASS | Infrastructure TypeScript `--noEmit`. No synth, account lookup, deploy, or resource validation. |
| `npm run media:audit` | Completed, 8 findings | Read-only evidence/slot report; findings remain open. Exit success is not a clean evidence audit. |
| `npm run archive:evidence` | Completed, 18 proposals | Read-only temporal evidence proposals; no applied changes. |
| Targeted no-op replay probe | Drift reproduced | Same selected references do not always preserve the original accepted schedule/travel intent. See fixture specification below. |

Explicit API check:

```sh
./node_modules/.bin/tsc --noEmit --strict --target ES2022   --module ESNext --moduleResolution Bundler --skipLibCheck   --esModuleInterop --types node   api/extract-preferences.ts api/narrate-day.ts
```

The no-op replay probe used a temporary script outside app source (`/tmp/cmt-audit-replay.ts`, bundled for local execution). Inputs: each city's first-listed stay neighborhood (`city.hoodOrder[0]`), first plan preset, seven days, balanced pace, arrival `2026-09-12`, no interests, seed `0`. It replayed each generated sequence of place/experience references with the generated day pace and date/weekday. Rome day four's lunch changed from `12:03` to `09:18`, with new meal/best-time warnings. Paris day six's dinner changed from `19:40` to `19:37`; a five-minute walk became an 87-minute metro leg and the replay emitted no flags. Temporary probe output is diagnostic evidence; permanent behavioral regression tests are proposed in P0.2 of the main plan.

## Evidence limits and preservation

No live factual verification of Paris/Rome venues, no mail delivery, no auth/database integration, no weather fetch integration, no cloud-account inspection, and no paid model call formed part of verification. Official documentation was consulted for proposed platform constraints; links and dates appear in the main plan. Existing pilot measurements were read from the recorded observations, not independently rerun or certified.

The pre-audit worktree already contained modified root/app documentation/configuration/media files and untracked media publication, curator-pilot, infrastructure, and plans 07–09. Those files belong to the existing work. This audit adds only the two plan-10 documents. A SHA-256 comparison against the captured first-party-file baseline verifies that the pre-existing source/configuration/documentation files remain unchanged; generated compiler output is excluded from that preservation assertion.
