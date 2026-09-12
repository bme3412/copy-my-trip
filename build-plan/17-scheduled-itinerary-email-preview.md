# 17 — Scheduled itinerary email implementation

12 September 2026. **The approved production release is live. The first authorized itinerary test is delivered and its signed events are verified. One scheduled message is due at 20:00 America/New_York on 12 September; scheduled delivery and the final pause/cleanup remain outstanding.** Delivery is restricted to the explicitly approved temporary pilot account, with one demo service date and a two-submission daily cap. No general email rollout is enabled.

## Approved live pilot

The user approved production publication, a temporary demo account, one immediate itinerary test and one scheduled itinerary message to `erhardbr@gmail.com`, followed by pausing. This is separate from the two earlier account lifecycle emails.

- Production deployment: `dpl_89RPFFNBN8sTGb6LGQqUtTyRT2cW`, https://copy-my-trip-3wnijoawj-bme3412.vercel.app, READY and aliased to https://copy-my-trip.com. Runtime source matches the previously verified preview. The build uses the production sender configuration; AI stays disabled. Plan 16 is the prior rollback release.
- Verified production worker operations (authenticated HTTP 200), unsigned webhook rejection (400), unauthenticated notifications rejection (401), and browser page loading with no recorded browser errors.
- Resend webhook `b214f643-e41c-4e4e-8e9f-94848cfc7cc9` is now enabled. Signed `email.sent` and `email.delivered` events returned HTTP 200. Replaying the delivered event left the job delivered, with no new submission.
- Temporary pilot owner: `eeb24358-a64e-469a-94bf-e2b050019ad3`, metadata purpose `cmt-two-email-pilot-20260912`. Trip: `itinerary-delivery-pilot-20260912`. It contains only the September 13 service date; all seven stops/times were compared to the approved sample. The draft retains its required seven internal day slots while its accepted snapshot contains one scheduled day. No additional signup email was sent.
- Pilot preferences: America/New_York, 20:00, enabled; next due `2026-09-13T00:00:00.000Z`. The global database switch is enabled, `require_pilot=true`, this owner alone is assigned, daily limit 2. The current production environment switch is true. The one-day fixture prevents any continuing series after this date.
- Vercel's project API confirms cron is enabled for this production deployment, `/api/companion-tick`, every five minutes. Two authenticated early ticks each inspected the single candidate and returned no results, correctly avoiding an early send.
- Immediate test job: `d4f0a0ed-836c-43da-ade4-75db8b61c87a`; provider ID `1281869f-d6c8-47db-b283-00af73263483`; submitted `2026-09-12T20:38:42.955439Z`, provider delivered at `20:38:44.083Z`. The duplicate test request returned `skipped`. Database state is `delivered` with no error. The real private briefing API exactly matches the accepted facts; anonymous access is denied, and opening the link in a fresh browser document shows the sign-in gate.
- `app/scripts/mail-live-pilot.ts` performs gated setup, `send-test`, `status`, `pause`, and `cleanup`. It verifies exact address/metadata before operating, never replaces an existing account, captures private credentials only in ignored `supabase/.temp/mail-live-pilot.json` (0600), and refuses cleanup until both jobs are delivered. Setup is complete; **do not rerun setup or authorize additional sends**. The pause operation disables the database globally before relying on the owner session/API.
- Automatic follow-up `verify-itinerary-email-pilot` is active in this task. It stays quiet before the scheduled window, checks at the hourly :10 run after 00:05 UTC (20:10 Eastern), then pauses the pilot even if delivery is missing/uncertain. It must not send replacements. It verifies results, removes only the tagged fixture when complete, records the outcome, and pauses itself. Vercel runs the actual five-minute sending cron independently of this desktop follow-up.

For the follow-up, from `app`, bundle `scripts/mail-live-pilot.ts` with esbuild into `node_modules/.tmp/mail-live-pilot.cjs` (Node CJS, `import.meta.env={}`). Run with `CMT_APPROVED_MAIL_PILOT=two-emails-erhardbr-20260912` and `status`, then `pause`, then `cleanup` only after both delivered outcomes and private-link checks pass. Capture provider IDs/outcomes before cleanup; credentials must never be printed. Keep the local `mail-capabilities.json` only until authenticated operations checks finish, then remove it. Set the saved production environment switch false for future deployments; the database pause immediately stops the running release.

The sections below record implementation and the earlier staged verification history. Approval and sender preparation described there are now complete.

## What is implemented

- Optional AI introductions and preference interpretation default off in the browser and fail closed on the server. Unconfigured services no longer trigger repeated paid-provider calls. Notes remain local trip notes; interests and pace remain deterministic controls. Both `VITE_AI_ENABLED` and server `AI_ENABLED` default false. Do not enable paid public AI until authentication, abuse limits and budget controls are implemented.
- Account-scoped evening preferences: explicit opt-in, fixed IANA notification timezone, 18:00–23:59 wall-clock time, separate test-send action, pause, contents preview and delivery history. Creating an account never subscribes it.
- A five-minute Vercel cron route, protected by a separate `CRON_SECRET`, with a second global server environment switch and database pause. Preview deployments do not run Vercel cron automatically.
- Calendar scheduling uses the next local calendar date, 60-minute catch-up only before that date starts, and no backfill after late activation. Earlier occurrence is chosen in a DST fold; a gap shifts forward by the gap. A trip naturally stops producing jobs after its last eligible activity window.
- Destination dates and zones stay visible. Activities overlapping the notification-day UTC window retain their full accepted times, including overnight carry-over. Repeated Paris → Rome → Paris segments are supported. No nightly model calls or weather/operational claims.
- Durable, unique jobs per owner/trip/service-date/kind. Atomic leases serialize with trip changes on the Auth owner row. Changed accepted plans before submission rebuild from current snapshots. A submission reservation freezes the briefing and derives its sole recipient from the verified Auth account.
- Resend HTTP delivery with a stable job idempotency key. No automatic resubmission after a network timeout or uncertain provider response. Reservation interruption becomes `unknown` when worker reconciliation runs. Confirmed provider rejection is shown as failure, without a retry storm.
- Raw-body Svix signature checks, timestamp tolerance, persisted event IDs and severity-monotonic reconciliation. Early delivery events reconcile after the HTTP response. Bounces/complaints/provider suppression stop all itinerary email for that owner. Events from other sender addresses are ignored.
- `/:city/mail/:id` reads the frozen briefing from the authenticated owner’s account on another device, without copying it to device storage or regenerating a plan. A newer cloud revision is labeled. The pause link opens this page; only an explicit authenticated button press changes preferences. GET does not unsubscribe or mutate a trip.
- Trip deletion removes preferences and mail contents in the existing deletion transaction. Account deletion cascades these records. A message already reserved/submitted cannot reliably be recalled.

## Files

| Area | Files |
|---|---|
| Database | `supabase/migrations/202609120003_itinerary_emails.sql` |
| Calendar/model/rendering | `app/src/lib/briefings/notifications.ts`, `assemble.ts` |
| Worker/provider | `app/server/companion/jobs.ts` |
| APIs | `app/api/notifications.ts`, `companion-tick.ts`, `companion-events.ts` |
| Traveler UI | `app/src/components/NotificationPanel.tsx`, `CloudSavePanel.tsx`, `app/src/pages/MailBriefingPage.tsx` |
| Client/routing/development | `app/src/lib/cloud/notifications.ts`, `app/src/App.tsx`, `app/server/dev-trips.ts` |
| AI availability | `app/src/lib/ai-availability.ts`, Compose/Itinerary pages, narration client and both AI APIs |
| Verification | `app/scripts/mail-smoke.ts`, `mail-db-smoke.ts`, expanded `api-runtime-smoke.mjs` |

Server imports preserve `.js` extensions for unbundled Node ESM. Briefing rendering no longer imports the entire planner at runtime. The new Svix dependency is server-only; its installed version verifies signatures without returning parsed JSON, so parsing deliberately occurs afterward.

## Security and bounded pilot

New tables enable RLS and revoke direct access from anonymous and authenticated clients. Browser requests use the existing publishable key and owner bearer token. Owner functions derive identity from Auth; no arbitrary recipient or owner parameter reaches them.

The worker uses a separate random capability checked against a SHA-256 hash in `cmt_mail_control`. It does not require a Supabase service-role key at runtime. The worker capability can operate the pilot’s mail records; treat it as a privileged server secret. Never place it in a `VITE_` variable, browser storage, URLs or logs.

The database starts globally disabled, requires an explicit pilot owner and caps submissions at five per UTC day. Tick reads at most 20 trip candidates and submits at most two messages. This is intentionally a **single-owner pilot**, not a general queue service: expanding beyond it requires fair pagination, load/latency checks and revised quotas. Keep `require_pilot=true` until that work is done.

Briefing/job contents expire after 90 days when the worker runs; accepted trip versions follow existing trip/account deletion. Minimal webhook events retain provider IDs and outcomes, without addresses or itinerary bodies, for 90 days. Resend and database-backup retention are separate provider policies and have not been independently verified. No tracking pixels or click tracking were added.

A protected `GET /api/companion-tick?ops=1` returns global mode, budget and job-state counts. Unknown/failed submissions need operator investigation; the app does not claim exactly-once external delivery. A confirmed provider rejection is not automatically retried. Preparation leases can be reclaimed up to three times. Serverless invocations may be late or interrupted; stale reservation handling is tested locally.

## Checks completed

- `npm run test:mail`: 10 checks, including DST gaps/folds/half-hour transition, 23/25-hour dates, late activation/completion, accepted facts/escaping, overnight carry-over, durable reservation ordering, uncertain outcomes, cron authentication/pause, bounded tick, real cryptographic signatures, tampering/stale events, and AI fail-closed behavior. Provider calls are test doubles; no real email.
- `npm run test:mail:db`: 13 checks on a disposable PostgreSQL database. Real row locking/concurrent connections, owner isolation, exact snapshot capture, stale revisions/leases, pause, recipient derivation, unknown interruption, event ordering/deduplication, daily cap/global pause, late ticks, suppression and deletion.
- `npm run test:companion`: existing 16 persistence/replay/briefing checks pass.
- `npm run test:cloud`: existing 10 cloud/account/API adapter checks pass.
- `npm run build`: frontend/API TypeScript, all seven API modules load under unbundled Node ESM, and Vite production bundle pass. Existing large-bundle warnings remain.
- Hosted preview loads in the browser; a labeled demo can be accepted and opened as a version-addressed local briefing; unavailable AI is visibly disabled. Hosted notification preferences and exact-version links are now verified as detailed below. Actual mail delivery is **not yet verified**.

The final preview source is deployed at `https://copy-my-trip-84cmhj6kg-bme3412.vercel.app`, deployment `dpl_EVdve1namNN64mcw7KSm897xyQ8y`. It has `COMPANION_EMAIL_ENABLED=false`, `AI_ENABLED=false`, `VITE_AI_ENABLED=false`; sender/worker/cron credentials are absent. This supersedes the initial preview and includes the visual menu correction.

## Approval and next verification

The user explicitly approved the production migration, resolving the earlier automatic approval-review block. `supabase db push --linked --yes` applied only `202609120003_itinerary_emails.sql`. No new application release was promoted and no mail switches were enabled.

Completed hosted verification (12 September 2026):

- Five new tables have RLS enabled; tested direct anonymous/authenticated access is denied. The global switch is false, the worker hash is unset, and pilot restriction remains true.
- Two tagged synthetic `.invalid` accounts exercised real Supabase Auth and RPCs without signup emails. Tests confirmed private owner access, stale preference conflicts, blocked activation, an invalid worker capability rejection, and cross-owner denial for both trip preferences and saved briefings.
- Browser verification used the existing protected Vercel preview: load Paris → Rome → Paris, save a fixed America/New_York notification zone and 21:00 time, and preview the frozen accepted activities while subscription/test-send controls stay disabled. Independent database readback confirmed the browser values.
- A cancelled synthetic briefing (never reserved or submitted to a provider) tested the exact-version route. A fresh document required sign-in; the signed-in owner could read it. GET left preferences unchanged; the explicit pause button made the single expected revision increment.
- A subsequent test cloud revision retained the previous briefing facts and displayed the newer-version notice in the browser.
- Deleting the test trip through the hosted UI removed its notification preferences, briefing and cloud versions. The two tagged test accounts were then removed, and their remaining private rows were confirmed absent. No fixture credentials remain on disk. Browser error log was empty at the end.
- The repeatable, explicitly gated test helper is `app/scripts/mail-hosted-smoke.ts` (setup, `--advance`, `--cleanup --expect-trip-deleted`). It passed TypeScript checking. Its synthetic records are deliberately cancelled; these checks do not establish real provider delivery.

Sender preparation completed (12 September 2026, delivery still disabled):

- Created `copy-my-trip-itinerary`, a separate sending-only Resend key restricted to `mail.copy-my-trip.com`, and saved it as a sensitive, production-only `RESEND_API_KEY` in Vercel. The first unused key was revoked after a failed one-time value transfer; its replacement was saved successfully. Supabase SMTP and unrelated keys were untouched.
- Created webhook `b214f643-e41c-4e4e-8e9f-94848cfc7cc9`, targeting `https://copy-my-trip.com/api/companion-events`, for `email.sent`, `email.delivered`, `email.delivery_delayed`, `email.failed`, `email.bounced`, `email.complained`, and `email.suppressed`. It is **disabled** until the endpoint is deployed. Its signing secret is stored as sensitive production-only `RESEND_WEBHOOK_SECRET`. No events have been received.
- Stored separate random `CRON_SECRET` and `CMT_MAIL_WORKER_SECRET` as sensitive production secrets. Only the SHA-256 worker hash is stored in Supabase. A real publishable-key worker RPC authenticated successfully and returned `enabled=false`, `pilotOnly=true`, `dailyLimit=5`, and no jobs. No service-role credential was added to Vercel.
- Added production configuration `COMPANION_APP_ORIGIN=https://copy-my-trip.com`, `COMPANION_EMAIL_ENABLED=false`, `AI_ENABLED=false`, and `VITE_AI_ENABLED=false`. These apply to the next deployment; the current live deployment is unchanged. Pilot owner remains unset. Private local cron/worker copies are temporarily retained in ignored `supabase/.temp/mail-capabilities.json` (0600) for activation checks; remove after verification.
- Generated reviewable HTML/text using the actual mail renderer: [test email](artifacts/itinerary-email-pilot/test.html), [scheduled email](artifacts/itinerary-email-pilot/nightly.html), and frozen [briefing data](artifacts/itinerary-email-pilot/briefing.json). These are a labeled demonstration Paris trip for 13 September, notification zone America/New_York, seven stops. The all-zero UUID is a preview placeholder; actual jobs receive private links. Browser visual check passed, all four archive images loaded, and no horizontal overflow was observed. Inbox-client rendering remains unverified.
- `scripts/mail-pilot-preview.ts` regenerates those artifacts without cloud writes or email. TypeScript checking passed. The disabled hosted test now permits a configured worker while still requiring delivery off, no pilot owner, and pilot-only mode. Runtime source and deployment configuration still match the verified preview byte-for-byte; only test helpers and documentation changed.
- An exact-address read-only check found no existing Auth account for `erhardbr@gmail.com`. The delivery pilot therefore needs a temporary test account and demo cloud trip; do not reset or replace any account that appears before activation.

Remaining activation sequence:

1. Hosted schema and account-flow verification is complete. Keep both global sending switches disabled until the approved self-recipient pilot.
2. Sender key, signing secret, and disabled webhook are prepared. Enable the webhook only once the approved production release exposes its signed endpoint. SMTP account mail remains separate.
3. Cron/worker credentials and explicit app origin are prepared. Keep global switches off until a real recipient and pilot have been approved.
4. Obtain approval for the concrete production release and the **new** self-recipient itinerary test/nightly messages. Previous authorization covered two account lifecycle emails, which were already sent. It does not authorize additional itinerary sends.
5. Verify one real test, one real scheduled night, delivered events, exact version on a fresh device/session, pause/unsubscribe, duplicate ticks and a deliberate provider-failure simulation. Only then enable a wider companion release or add weather.

Vercel Pro supports per-minute cron schedules; this app uses every five minutes. See [Vercel cron limits](https://vercel.com/docs/cron-jobs/usage-and-pricing). Resend idempotency keys last 24 hours; the durable unknown state deliberately avoids relying on that window for indefinite retries: [Resend idempotency](https://resend.com/docs/dashboard/emails/idempotency-keys). Signature verification requires the original raw bytes: [Resend webhook verification](https://resend.com/docs/webhooks/verify-webhooks-requests).
