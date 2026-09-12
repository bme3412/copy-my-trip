# 18 — Weather integration preview

12 September 2026. **Local prototype implemented and browser verified. No weather production deployment, subscription, database migration, or weather email was made.** The approved two-email pilot continues on its existing production deployment, with the scheduled check due tonight as recorded in [plan 17](17-scheduled-itinerary-email-preview.md).

## Implemented

**Current decision:** commercial weather is deferred. Preserve this disabled prototype for later; continue other work through [plan 20](20-alternatives-ai-mcp-and-rollout-plan.md). No production use of the evaluation endpoint is planned.

- `app/server/conditions/weather.ts`: Open-Meteo adapter, explicit disabled/evaluation/commercial modes, fixed allowlisted coarse Paris/Rome coordinates, destination timezone, seven-day horizon, Celsius/mm/km/h, four-second timeout, 64 KB streaming response bound, redirect rejection, strict unit/date/scope/value validation, and generic failure outcomes. No retry loop. Only city coordinates, daily fields, units and timezone reach the provider; no itinerary, identity, hotel, stop list, or precise traveler location.
- Nonpersonal process cache: one hour, at most 32 records, same-request coalescing, independent copies for callers. A failed request does not expose old data as current. This is deliberately not a durable shared production cache or global provider-rate limit.
- `app/src/lib/conditions/weather.ts`: versioned normalized record with content identity, provider/adapter, city/date/timezone/scope, retrieval and expiry times, source attribution, explicit unknown issue time, state, and daily values. Expiry is two hours. Missing, expired, disabled and out-of-horizon forecasts are explicit. Expired values are not presented as a current forecast.
- `briefing-weather.ts`: creates an unsent derivative with a different briefing ID and a deep-copied weather record. Checks city/date/timezone without changing any accepted itinerary facts. It never writes a saved plan or sent briefing.
- `WeatherPanel.tsx`, `BriefingBody.tsx`, and shared text/HTML renderers show the same weather facts, scope, timestamps and attribution. Old briefings without weather retain their existing output. Simulated conditions remain prominently labeled in all three formats and never enter the provider cache.
- `WeatherPreviewPage.tsx`: development-only route `/:city/weather-preview`, based on the latest locally accepted city plan, with scenario buttons and explicit real evaluation fetch. Controls never save, subscribe or send. It is lazy loaded only in development; the provider route exists only in Vite middleware, not a deployed API file.
- `scripts/weather-smoke.ts`, `tsconfig.weather.json`, `npm run test:weather`: eight grouped verification checks.

The summary is **city-centre weather**, including when a trip has out-of-city excursions. It is explicitly not a stop-level/day-trip forecast. No indoor/outdoor exposure is inferred, no venue closure or cancellation is asserted, and no schedule is changed. “Maximum hourly precipitation chance” is not represented as the probability of rain at every stop or throughout the whole day.

## Provider decision

Open-Meteo documents free evaluation/prototyping and separate commercial subscriptions/customer endpoints. Commercial configuration requires a server-only `OPEN_METEO_API_KEY`; evaluation mode fails closed in production/Vercel. No commercial subscription has been purchased and no production provider key has been configured.

- [Pricing and evaluation/commercial terms](https://open-meteo.com/en/pricing)
- [Forecast API, daily variables, units and timezone](https://open-meteo.com/en/docs)
- [Terms](https://open-meteo.com/en/terms)

The data requires attribution under CC BY 4.0. App, HTML and plain text include Open-Meteo attribution and identify that fields were selected/reformatted. The adapter requests seven forecast dates even though the provider supports longer horizons; it makes no precision claim for the longer range. No issuance timestamp is invented from `generationtime_ms`.

## Verification completed

- Eight weather checks cover request minimization, caching/coalescing/copy isolation; wrong location/date/timezone/units; null and invalid numeric fields; disabled/out-of-horizon no-fetch; provider error and oversized body; expiry labeling and wrong-day associations; exact accepted-fact preservation and output attribution; simulated data labeling; and production evaluation-mode rejection.
- Existing 16 companion/persistence tests and 10 mail tests pass. No test suite sent an email.
- Production build, frontend/API typechecks, and all seven unbundled API runtime checks pass. Existing large-bundle warnings remain.
- Browser at `http://127.0.0.1:4319/paris/weather-preview`: accepted an isolated local Paris demo, simulated rain, fetched a real evaluation forecast, simulated outage and expiry, and inspected app/email HTML/plain text. DOM comparison confirmed the seven accepted stops and their text stayed unchanged during failure. No horizontal overflow in the inspected viewport. A lazy-route hydration warning was fixed with a loading fallback.
- Real evaluation fetches succeeded for Paris and Rome in their destination zones. A future out-of-horizon date returned that explicit state. The original local server at port 4318 returned disabled with default configuration. These are provider/format checks, not independent validation of forecast accuracy.

Start the isolated preview from `app` with `WEATHER_PROVIDER_MODE=evaluation npm run dev -- --host 127.0.0.1 --port 4319 --strictPort`, accept a demo at `/paris/saved`, then visit `/paris/weather-preview`. Production does not expose this route. The existing server at 4318 and production sender credentials are not altered.

## Before production weather

**Follow-up:** [plan 19](19-weather-cache-and-mail-integration.md) now implements the shared-cache migration and disabled mail-job integration locally, with integration/database checks. The list below records the rollout contract; those code steps are ready but their migration and hosted activation are not complete.

1. Complete tonight's real scheduled email and pause checks. Do not replace that release while its acceptance pilot runs.
2. Select/approve commercial provider access and a budget; do not put the free evaluation endpoint into the public product.
3. Add a shared nonpersonal forecast cache/persistence with narrow worker-only writes, TTL and request quotas. The cache key must include provider/adapter, coordinates, timezone, units and requested date window. Restrict any traveler-facing endpoint to authenticated use with abuse limits.
4. Fetch/validate weather before the existing mail submission reservation, attach a normalized record to the frozen briefing JSON, and let the existing owner/revision fence decide whether submission can proceed. Retrieval failure must still permit the itinerary-only email with an honest unavailable notice. Saved sent records must never refresh on read; a later unsent version gets a new weather reference.
5. Add integration checks for repeated-city trips, stale accepted revisions during retrieval, source failure, immutable sent references, deletion/retention, source costs, and signed delivery. Then publish a disabled preview for review before enabling weather mail.

No AWS service or MCP server is needed for this small read-only provider adapter. Reconsider a separate worker/queue when measured volume or runtime warrants it. Operational alerts and traveler-approved deterministic alternatives remain the subsequent milestone.
