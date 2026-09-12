# 19 — Shared weather cache and email preparation

12 September 2026. **Implemented and tested locally, disabled by default. Migration 004 is prepared but has not been applied to Supabase. No production environment changes, deployment, provider subscription, or additional email occurred in this step.** Tonight's approved pilot still runs the release recorded in [plan 17](17-scheduled-itinerary-email-preview.md).

## Behavior

When enabled, email preparation follows the existing sequence: claim the accepted trip → retrieve city/date forecasts → construct the briefing → recheck current owner/trip/preference state in the submission transaction → freeze the full briefing → contact Resend. Weather never edits the accepted snapshot or creates a new schedule. If source/cache/budget/lease checks prevent a usable forecast, the email includes an explicit unavailable notice and still delivers the accepted itinerary.

The complete normalized forecast is copied into each briefing item inside the existing `cmt_mail_jobs.briefing` JSON at submission. No new private association table is necessary. The email link reads that saved JSON and performs no provider/cache fetch. A later cache refresh cannot alter the saved forecast. Normal expiry labeling still indicates when a displayed saved forecast should no longer be treated as current. Existing trip/account deletion removes the private briefing; the shared cache contains no personal fields and expires independently.

## Files

- `supabase/migrations/202609120004_weather_cache.sql`: two RLS-protected tables and a capability-protected worker RPC; no direct anonymous/authenticated table access.
- `app/server/conditions/shared-weather.ts`: authenticated cache RPC, commercial-only source guard, lease/freshness validation, and safe fallback.
- `app/server/conditions/enrich.ts`: optional unsent briefing enrichment, repeated-city/date coalescing, a maximum of four distinct lookups per briefing, and preservation of original schedule facts.
- `app/server/companion/jobs.ts`: enrichment between claim and final submission reservation.
- `app/src/lib/conditions/briefing-weather.ts`: derivative identity includes the original briefing ID, so different notification windows cannot collide just because their destination date and forecast match.
- `app/scripts/weather-db-smoke.ts`, `weather-mail-smoke.ts`: local database and application integration verification.
- `app/.env.example`: explicit disabled defaults and server-only credential names.

## Shared-cache contract

`cmt_weather_control` starts with `enabled=false` and a cap of **48 reserved requests per UTC day**. Reservations count conservatively even if a worker crashes or the provider fails; this is an application upper bound, not a claim about the provider's billable-call measurement. No hardcoded dollar price or automatic subscription is assumed.

`cmt_weather_cache` keys include adapter/provider mode, coarse coordinates, timezone, units, seven-day request window, and selected destination date. Each row holds only normalized weather, its cache deadline, lease/cooldown and update metadata. Paris/Rome, the current destination date through six days ahead, known record fields and numeric ranges are enforced. Simulation/private extra fields are rejected. Entries older than 48 hours are removed when the cache worker claims work; cleanup is lazy while idle.

A single locked control row serializes budget reservation and same-key claims at this bounded scale. Fresh hits consume no reservation. New fetches receive a 30-second lease; expired/foreign leases cannot publish. A failed fetch imposes a five-minute cooldown. Shared hits are reused for up to one hour, always within the forecast's two-hour expiry. A busy or capped cache produces an unavailable advisory instead of bypassing the budget or starting duplicate requests.

The RPC uses the existing server worker capability hash in `cmt_mail_control`; it does not require a Supabase service-role key. Only the worker capability can read/write through the RPC. The separate weather control switch applies even if itinerary email is enabled. The anonymous project key alone cannot use this function; authenticated browser roles have no execution grant. The new migration does not replace existing trip/mail functions.

Each lookup has bounded cache RPC/provider/cache-write timeouts of four seconds. Up to four unique lookups run concurrently; additional city/date combinations receive an unavailable notice. No unbounded retry or new scheduler is introduced. The request cap and global row lock are appropriate for the pilot, not evidence of large-scale throughput.

## Checks passed

- **8 provider/model checks:** existing weather adapter, validation, failure, expiry, attribution, immutable derivative and disabled/commercial-mode cases.
- **7 weather/mail checks:** flag-off no work; repeated destinations; budget/busy/cache failure without provider bypass; successful durable write under a current lease; wrong cached scope/source failure fallback; weather-before-reservation ordering and itinerary delivery during outage; stale-trip/pause reservation rejection without an email.
- **10 PostgreSQL checks:** actual cloud + mail + cache migrations together in a disposable local database; RLS/privilege/capability denial; concurrent single-fetch reservation; stale leases; invalid/private/simulated records; cache reuse; failure cooldown; crash recovery and global cap; UTC rollover; horizon/expiry; retention; frozen weather surviving a cache update and removal with trip deletion.
- Existing **10 mail unit**, **13 mail database**, and **16 companion** checks pass. Production TypeScript/build and all seven unbundled Node API checks pass. Existing bundle-size warnings remain.

Tests use fake provider responses and `.invalid` recipients; no extra real email was sent. Database tests are restricted to a local PostgreSQL host and remove their disposable databases. Cloud migration application, real commercial access, deployed cache behavior, and weather-bearing real email have not been verified.

## Deferred rollout — resume only when weather is requested

Commercial weather is deferred at the user's request. The sequence below is retained for a future weather release, not the next assignment. Alternatives, AI, scoped MCP and rollout hardening proceed independently under [plan 20](20-alternatives-ai-mcp-and-rollout-plan.md), which also covers separating the unapplied weather migration from subsequent database releases.

1. Complete tonight's scheduled mail and pause/cleanup. Keep the live deployment unchanged until this acceptance check completes.
2. Approve commercial weather access/budget. Store its key only on the server. No new AWS service or MCP server is needed.
3. Review and apply migration 004 with its control switch still disabled. Verify hosted capability/RLS denial, same-key lease behavior, daily quota and a no-email source/cache readback.
4. Build a new preview with `WEATHER_EMAIL_ENABLED=false`. Inspect frozen-record rendering and failure behavior against the hosted schema. Preserve rollback access to the current production release.
5. For an explicitly approved single-recipient weather pilot, configure `WEATHER_PROVIDER_MODE=commercial`, `OPEN_METEO_API_KEY`, `WEATHER_EMAIL_ENABLED=true`, and enable `cmt_weather_control` with a small cap. Obtain authorization for any additional real messages beyond tonight's two-email allowance.
6. Verify successful and unavailable-source messages, exact saved forecast/source, stale revision during retrieval, signed delivery, pause, deletion and actual request usage. Then consider a broader rollout.

Rollback: turn off weather control or the weather email flag for future deployments. The database control immediately prevents new cache/provider reservations; in-flight weather work may finish or fall back, while existing email submission authorization still applies. Disable mail globally if all sending must stop. Preserve accepted trips and already-sent briefing records.
