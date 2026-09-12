# 11 — Copy My Trip companion implementation plan

Date: 12 September 2026. Based on the supplied specification and [plan 10](10-travel-companion-reconciliation.md). **Milestones 1–3 are implemented and live. Milestone 4 is live in the approved single-owner pilot: its first real itinerary email was delivered; the 20:00 Eastern scheduled message and final pause/cleanup are pending (plan 17). Milestone 5 now has an isolated local weather prototype and verified evaluation forecasts (plan 18), with no production weather activation. Milestone 6 remains unimplemented.** Existing uncommitted work was preserved.

## Outcome and boundaries

**Updated sequencing:** commercial weather is deferred at the user's request. Continue with alternatives, cloud proposal acceptance, rollout hardening, optional traveler AI and scoped MCP according to [plan 20](20-alternatives-ai-mcp-and-rollout-plan.md). Milestone 6 does not depend on purchasing or activating milestone 5. Plans 18–19 record local weather implementation, not production activation.

Keep React/Vite/TypeScript, the deterministic engine, city JSON, archive provenance, maps, existing API routes, S3/CloudFront media, and the separate curator pilot. Build a demonstrable local product before recruitment. A self-test establishes functionality, not product demand.

Three state layers remain independent:

- **Canonical archive:** curator-controlled city data, evidence, media, and editorial judgments. Traveler actions and model outputs cannot publish changes.
- **Accepted itinerary:** normalized inputs, resolved day context, exact schedule, edits, warnings, and release references. Acceptance creates an immutable version. Display never regenerates it.
- **Current conditions:** later, separately sourced records with scope, retrieval/issue times, validity, expiry, and attribution. Weather is advisory. Later alternatives are computed by the deterministic engine and require traveler acceptance.

Historical evidence does not establish current opening hours. An exterior photo does not establish an interior visit. Heuristic journey times are estimates; suggested ticket times are not reservations. The companion needs no nightly model call.

## Sequencing

| Milestone | Exit result | Dependencies / status |
|---|---|---|
| 1. Preserve accepted itineraries and repair replay | Generate/edit/accept/reload the exact same plan | Implemented locally |
| 2. Preview tomorrow locally | Date-specific in-app, HTML, and plain-text briefing from accepted output | Implemented locally; no backend |
| 3. Optional accounts and cloud save | Owner-scoped remote save without disrupting local planning | Hosted preview, lifecycle and real signup/recovery delivery verified |
| 4. Scheduled itinerary emails | Real test and nightly mail, exact matching in-app version, pause | After cloud ownership/save |
| 5. Weather | Sourced advisory forecast with honest failure fallback | After the basic email path works |
| 6. Operational alerts and deterministic alternatives | Validated temporary constraint → engine candidate → traveler decision | After source and engine readiness |

The implementation intentionally does not promise indefinite execution of every old engine. Readable version-1 snapshots preserve their saved display facts; unsupported engine/catalog releases block editing. Unknown storage/schema formats remain preserved for export/recovery rather than being interpreted as accepted plans.

## Milestone 1 — Preserve the accepted itinerary

### Implemented modules

| Files | Responsibility |
|---|---|
| [trips/schema.ts](../app/src/lib/trips/schema.ts) | Runtime validation, bounded JSON, calendar-date helpers, snapshot types, deterministic content checksums, explicit planner release ID. Checksums identify content; they are not signatures or authentication. |
| [trips/snapshot.ts](../app/src/lib/trips/snapshot.ts) | Capture exact accepted schedules plus frozen experience descriptions/provenance/image references; catalog references; compatibility checks. No engine invocation when displaying a snapshot. |
| [trips/local-store.ts](../app/src/lib/trips/local-store.ts) | Versioned local envelope, non-destructive loading, bounds, legacy-as-draft import, storage adapter for denial/quota tests. |
| [TripContext.tsx](../app/src/state/TripContext.tsx) | Separate working drafts and accepted versions; fixed initial seeds; persistence/unsaved state; explicit acceptance, edit-copy, and removal. |
| [planner.ts](../app/src/lib/planner.ts), [plan-presets.ts](../app/src/lib/plan-presets.ts) | Record timing intent, durations/linger, return legs, trailing free time, and serializable resolved day contexts. Replay known experiences without dropping waits or home returns. Unknown experiences block edits. |
| [ComposePage.tsx](../app/src/pages/ComposePage.tsx), [ItineraryPage.tsx](../app/src/pages/ItineraryPage.tsx) | Preserve origin preset separately from edited state; acceptance controls; durable edit warnings; visible 1–7-day limits; date/home-base changes require a fresh generated schedule before acceptance. |
| [SavedTripPage.tsx](../app/src/pages/SavedTripPage.tsx), [LocalSaveStatus.tsx](../app/src/components/LocalSaveStatus.tsx) | Saved overview/history, edit a copy, accepted-version export, explicit original-data export/recovery/reset/retry, and labeled Paris/Rome demonstration drafts. |

### Contract and behavior

The storage key is `cmt-local-companion-v1`; the older `cmt-trips-v3` key is not automatically deleted. Unreadable/unknown data blocks automatic replacement, remains available for original-data export, and allows continued in-memory planning. Supported older records can be imported only as working drafts requiring review. Records without sufficient shape for safe restoration are not fabricated into accepted trips.

The local envelope has a 3,000,000-character serialized limit and at most 20 accepted versions. Exceeding a bound or browser quota yields an explicit unsaved state. Export/removal/reset are deliberate actions; there is no silent eviction of accepted versions. Local JSON export is available; general backup-file upload/merge is not yet a UI feature. The app has no synced account or multi-device conflict resolution.

A snapshot captures:

- Identity, parent version, acceptance time, city/timezone, demonstration flag, normalized draft, seed, origin preset, resolved per-day context, and release references.
- Exact stop/experience order, arrival and departure through arrival+duration, inbound travel duration/mode, timing intent, linger, explicit day-trip return travel, trailing free time, and edit/unplaced-request warnings.
- Frozen titles, selected-experience descriptions and provenance, appropriate media URLs/captions, directions, and unbooked timed-entry status.

Replay preserves the accepted minimum arrival times, durations, and intentional gaps. A removal can leave free time; it does not silently move an accepted meal earlier. Later infeasibility is flagged. Explicit pace changes recalculate durations and surface resulting flags. A list of IDs alone is a lossy curated sequence; use `replayDay` with recorded intent for an accepted day.

The two audit regressions are permanent tests: Rome's day-four lunch remains 12:03; the Paris Versailles day retains its return home and five-minute dinner walk. The tests compare all committed stop facts, clocks, and final location across all seven days in both fixtures.

The optional narration cache now includes full day facts and city/date/catalog/context. Viewing/restoring never requests narration; the traveler must choose **Write optional day introduction**. The narrow extraction API remains optional in Compose. Its general public-abuse hardening remains a prerequisite for broader public exposure.

## Milestone 2 — Preview tomorrow locally

| Files | Responsibility |
|---|---|
| [briefings/schema.ts](../app/src/lib/briefings/schema.ts) | Framework/provider-independent briefing model, URL scheme checks, HTML escaping. |
| [briefings/assemble.ts](../app/src/lib/briefings/assemble.ts) | Deterministic assembly from frozen accepted output; shared schedule text, HTML, and plain-text renderers. No AI, weather, or scheduling calls. |
| [BriefingBody.tsx](../app/src/components/BriefingBody.tsx) | Reuses `ImageSlot`, existing media resolution at capture, and engine time formatting; displays timings, evidence gaps, warnings, return legs, and directions. |
| [BriefingPage.tsx](../app/src/pages/BriefingPage.tsx), [TodayPage.tsx](../app/src/pages/TodayPage.tsx) | Explicit preview date, local timezone, Today states, format switch, downloadable HTML/text, old-version notices. |
| [App.tsx](../app/src/App.tsx), [Layout.tsx](../app/src/components/Layout.tsx) | Saved/Today/briefing routes and navigation; city-appropriate document title. |
| [built-day.ts](../app/src/lib/built-day.ts), [DayTimeline.tsx](../app/src/components/DayTimeline.tsx), Home/Compose | Experience-scoped counts and labels, honest unavailable evidence, estimated travel, researched-only Rome presentation. |

Routes:

- `/:city/saved` — overview and local demonstration entry.
- `/:city/saved/:snapshotId` — immutable accepted version and history.
- `/:city/saved/:snapshotId/briefing?date=YYYY-MM-DD` — deterministic, version-addressed briefing.
- `/:city/today` — latest accepted plan for this city, resolved using its IANA zone.

Tomorrow is the next calendar date in the saved city's zone for this local slice. Preview selection changes the URL, never the trip. Today distinguishes before-trip, active, empty, day-trip travel, and completed states. This is not yet a multi-city connection-monitoring or notification-timezone system.

A briefing ID depends on accepted version, target date, and template version. Old accepted versions retain their original preview facts and a newer-version notice. The HTML preview is sandboxed; its explicit user-activated app link opens the same version/date. GET links never edit the itinerary. HTML/plain-text downloads support inspection and offline essentials; no email is sent. App and email remain understandable without images. Weather and live updates are explicitly labeled unconnected.

## Local demonstration and verification

Start `npm run dev` in `app/`. The verified development session used `http://127.0.0.1:4318` with Mapbox/media-base overrides empty, Vite-only API behavior, and no model button invoked.

1. Open `/paris/saved` and create a labeled demonstration draft, or compose a trip.
2. Edit a stop, accept/save, refresh, and inspect the unchanged saved dates/stops.
3. Open **Preview tomorrow**, change its date through the date picker, and switch to HTML/plain text.
4. Follow **Open this exact briefing** from the email HTML preview.
5. Edit a copy and accept again. The new version differs while the old URL preserves the old schedule.
6. Repeat with `/rome/saved`: zero firsthand stops and no Paris/archive imagery.
7. Use **Today**, inspect the before/after/open-day behavior, and export local essentials.

Completed verification:

| Gate | Result / scope |
|---|---|
| `npm run test:companion` | 16 focused checks, with strict TypeScript checking of source and test. Exact snapshot round trip; both replay regressions; edit immutability/context; unsupported releases; corrupt/oversized/empty envelopes; quota/denial; legacy drafts; safe HTML/URLs; Rome/evidence gaps; calendar states/DST dates; cache context; date/home-base mismatch. |
| `npm run build` | Frontend and API TypeScript checks, then production Vite build. Existing large-bundle warning remains. |
| `npm run validate:cities` | Both cities pass. Canonical JSON was not edited. This is not fresh factual verification. |
| `npm run smoke:plans` | Existing planner/preset/date/timezone suite passes. |
| `npm run smoke` | Existing 19 SSR/redirect checks pass; distinct from browser verification. |
| `npm run smoke:media-url` | Three resolver checks pass. Existing media work was preserved. |
| Actual browser | Paris generate/edit/accept/refresh; identical preview text across back/forward; second accepted version and unchanged prior preview; date picker via keyboard; email HTML link to exact app version; plain-text mode; 390px mobile preview; Rome zero-image/researched-only preview. |

The installed browser-control tool was used because the `agent-browser` CLI was unavailable. A temporary hot-reload context error occurred while editing the provider module during testing; full document navigation restored it. Final verification uses a fresh document after code edits, rather than counting that hot-reload session as error-free.

No real email, external provider integration, full offline map, independently verified venue fact, or cloud deployment is established by these tests. The existing pilot remains separate. Static catalog issues identified in plan 10 (including admission/renovation inconsistencies and eight evidence gaps) still require curator review. Existing map heuristics are not transport routing.

## Milestone 3 — Optional accounts and cloud save (preview connected)

See [plan 12](12-cloud-save-implementation.md) for implemented files, exact checks, limitations and remaining activation work. The account/segment/version subset is present. Notification, briefing, job, delivery, condition and feedback tables below remain assigned to the milestones that use them. There is no worker or itinerary email opt-in yet.

Use Supabase Auth/Postgres as the planned addition. Keep public archive media in existing S3/CloudFront; private upload storage waits for uploads. Keep anonymous planning functional.

Proposed files: `supabase/migrations/`, `app/server/auth.ts`, `app/server/trips.ts`, authenticated handlers beneath `app/api/trips/`, and saved-state integration in TripContext/SavedTripPage. These paths are proposals.

Minimum records: owner-scoped `trips`; ordered stable-ID `trip_segments` with city/IANA zone/usable date windows; immutable `plan_versions`; verified `notification_preferences`; `briefings`; durable `jobs`; `deliveries`; later `condition_records`; minimal private `feedback`. JSON snapshots are the schedule source of truth, with relational ownership/version indexes. Repeated cities are allowed; a three-segment fixture must include a repeated city.

Acceptance: validated user identity and nested-object ownership; RLS plus explicit worker authorization; no browser service credential; idempotent local import; keep local data until remote confirmation; expected-revision conflicts rather than last-write-wins; local-only/saving/synced/conflict/failure states; account creation separate from email opt-in; verified self-recipient only; deletion cancels queued work and logout clears account caches. Server save cannot regenerate a plan.

## Milestone 4 — Scheduled itinerary emails (implementation awaiting hosted acceptance)

The implementation now uses the existing verified Resend sender instead of SES, with Supabase job state and Vercel Cron. See [plan 17](17-scheduled-itinerary-email-preview.md) for actual files, tests, the disabled preview, and completed hosted verification and remaining sender activation. The remaining requirements below are the acceptance contract; the immediate test is delivered, while scheduled delivery and final pause/cleanup remain pending.

Use one protected bounded scheduled worker plus Postgres job/outbox state. Confirm actual Vercel plan frequency/runtime before choosing Vercel Cron. If unsuitable, EventBridge is the heartbeat alternative; do not provision both. Defer SQS/Lambda until backlog, runtime, or operational isolation warrants them. SES is the planned sender, with verified sender/domain, regional access, self-recipient testing, and bounce/complaint reconciliation. Account state remains unknown.

Proposed modules: `app/server/companion/{schedule,jobs,email}.ts`, protected tick API, signed SES event endpoint, and activation/preferences UI. Add a small protected operations view rather than another orchestration layer.

Calendar policy: explicitly chosen fixed notification IANA zone, defaulting to first destination; show “8 p.m. Europe/Paris, wherever you travel.” Tomorrow is the next calendar date in that zone; store its UTC window and display actual activity zones/dates. Include overnight carry-over. Calculate calendar dates, not repeated 24-hour additions. Start the evening before the first eligible day and stop after the last. Late activation offers preview/test send and the next valid night, not backfill. Catch up within 60 minutes only before the target date begins. Evening-only controls still need DST gap/fold tests and one send per service date.

Workflow: unique logical job per trip/service-date/kind → atomic lease/fencing claim → read accepted/prefs revisions → deterministic assembly/validation → persist exact briefing → recheck revision/opt-in/verification/suppression → record submission attempt → SES → signed, deduplicated monotonic events → next due date/completion.

Edits before the submission claim rebuild; after it, preserve the sent version and show a newer-version notice. Retry confirmed pre-submission failures with bounds. Ambiguous timeout becomes `unknown`; do not blindly resend. Database deduplication does not make external email exactly once, and dispatched mail cannot reliably be recalled.

Acceptance requires actual test and scheduled self-recipient mail, exact in-app version, duplicate tick/concurrent-worker tests, pause/completion/suppression, stale revisions, outage recovery, unknown submissions, safe email GET links, and image-free readability.

## Milestone 5 — Weather (local prototype; production pending)

[Plan 18](18-weather-preview.md) records the implemented provider adapter, normalized records, bounded local cache, shared display, tests, and browser verification. Production persistence, mail-job integration, commercial access, and rollout are still pending. The requirements below remain the activation contract.

Select a provider after verifying current product-use rights, attribution, coverage, horizon, and price; do not assume free commercial use. Proposed `app/server/conditions/weather.ts`, condition persistence/cache, and deterministic weather view-model extension.

Query coarse destination coordinates/date window only. Store fetched/issued times, scope, expiry, attribution, adapter version, and normalized payload. Share nonpersonal forecasts but protect trip associations. Freeze condition references in saved briefings; refresh creates a new unsent version.

Match exposure only when explicit indoor/outdoor classification exists; unknown stays unknown. Never infer operator cancellation from rain or severe-weather monitoring from a basic forecast. Use bounded timeout/retry and explicit stale/unavailable/out-of-horizon states.

Acceptance: exact itinerary/provenance unchanged, wrong-day/expired data rejected or labeled, failure still yields accepted-itinerary email, attribution in app/email, and isolated synthetic conditions. Only then call the release weather-aware.

## Milestone 6 — Operational alerts and deterministic alternatives (not implemented)

Start with a labeled simulated closure, then one named source with explicit place/service/date coverage and a coverage register. Planner city support does not imply rail/ferry/flight monitoring.

A bounded agent may investigate and return cited structured findings; server validation resolves identity/source/scope/validity. Persist asynchronous operation IDs and resume by verified webhook or bounded polling; never hold an HTTP request through a long investigation. The engine receives frozen temporary constraints and returns a candidate. The traveler accepts/rejects a version-bound diff; stale proposals are rejected.

Engine prerequisites include blocked experiences, constrained opening windows, hard obligations, arrival/departure availability, explicit waits/returns, service-aware travel, and infeasibility reporting. Existing pins are not reservations. No automatic acceptance, canonical writes, arbitrary email tool, or unrestricted agent database access. MCP is useful only when multiple clients need the same scoped tools; it is not a prerequisite for the local loop.

## Security, operations, costs, and deployment sequencing

Keep credentials server-only. Privileged database workers need explicit owner/job checks. Add strict request limits and runtime schemas to public AI endpoints before broad exposure. Treat retrieved/uploaded instructions as untrusted data. Escape output, restrict links, verify webhook signatures/topic/account/replay IDs, redact logs, and avoid public caching of private responses.

Logs should contain job/version IDs, outcomes, latency and safe error categories, not email addresses, raw prompts, booking text, precise location, or signed links. Define retention, backup expiry, deletion propagation, and account-cache behavior before promising them. Future private documents require private storage and short-lived owner access; never use the public archive bucket/CDN.

Track overdue jobs, stale weather, failures/unknown submissions, suppression, retries, quotas, and a global pause switch. Attribute hosting/database allocation, source fetches, email attempts, and optional model usage separately by job/trip. Measure real costs during self-testing; no margin claims from hypothetical usage.

Deploy in reviewable stages: completed local milestones → preview ownership/save environment with separate credentials/data → explicitly enabled verified-recipient mail and budgets → real scheduled delivery and weather-failure simulation → production companion flag after the complete loop passes. No account creation, provisioning, paid call, deployment, or mail send is implied by this document.

Rollback disables activation/new jobs while preserving local planning and accepted snapshots. Keep old versions readable; do not delete accepted plans to roll back a release.

## Learning and unresolved decisions

Track minimal `plan_accepted`, `save_completed`, `companion_activated`, `briefing_ready`, `delivery_delivered/failed/unknown`, `briefing_open`, and `feedback_submitted` events only when their features exist. Separate self-tests/synthetic events from traveler evidence, use pseudonymous IDs, and omit email tracking pixels. Pricing, recruitment, distribution and product-market-fit claims follow a working demonstration.

Resolve hosting limits, regions, verified sender/access, weather terms, retention, and budgets at their implementation milestones. Sender DNS and real signup/recovery email delivery are verified in plan 15. Next, complete public-launch acceptance and implement opt-in itinerary delivery. Recovery/deletion and the hosted application preview are implemented in plan 14. See plan 13 for live evidence. Scheduled mail and weather follow as distinct milestones.
