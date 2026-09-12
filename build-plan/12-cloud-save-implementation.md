# 12 — Optional accounts and cloud save

> Follow-up: signup/recovery email delivery is now verified and enabled in the new preview. See [plan 15](15-domain-and-email-activation.md) for the current sender, deployment and acceptance evidence. The observations below retain their original test scope.

12 September 2026. Follow-up to milestones 1–2 in [plan 11](11-copy-my-trip-companion-implementation-plan.md).

**Status: connected to the approved hosted preview and verified with real Auth/PostgREST plus browser save/download/reload.** Project `copy-my-trip-preview` (`wxpsiguklujutvttrqrn`, us-east-1, micro) was created at the approved additional $10/month compute level. Migration `202609120001` is applied. Password recovery and self-service deletion are implemented, and an application preview is deployed (plan 14). Public signup delivery and production rollout remain pending; this is not full public-launch acceptance. See [the live acceptance record](13-supabase-preview-verification.md).

## Implemented behavior

Anonymous planning, accepted local versions and deterministic briefings remain available. The Saved trip page explains when cloud accounts are disconnected. When configured, it offers email/password sign-in and optional account creation. Confirmation must be enabled in Supabase. Neither action subscribes the traveler to itinerary mail.

Sign-in tokens are held in memory, with SDK refresh while the page is open. Reloading requires sign-in again. Account lists and loaded remote snapshots are session-only and disappear on sign-out or an account switch. An epoch fence rejects late responses from a previous session. Deliberately downloaded local copies remain after sign-out; the button and surrounding text explicitly explain this.

Saving uploads an accepted snapshot exactly as stored; neither API nor SQL calls the planner or a model. Save is explicit, not an effect triggered by acceptance, sign-in, refresh or navigation. A cloud trip can contain one to eight ordered segments. Segment IDs come from the source local trip ID and are independent of city. Paris → Rome → Paris is covered by fixtures; repeated-city stays use separate accepted trip identities. Existing local planning remains per-city with up to seven days per segment. Combining segments does not create intercity transport or permit overlapping overnight windows.

A save uses the revision the traveler last loaded. The server locks the trip/account and checks it inside the same transaction. A competing write yields a conflict; refresh/open the remote copy before deciding which accepted local version to save. A lost-response retry of the identical payload returns the existing revision without adding versions. A reused version ID with different content is rejected. Older cloud version rows remain immutable, although this first UI retrieves only each segment's current accepted version; local version history is unchanged.

Downloading requires **Keep a copy on this device**. The complete download is validated; same-ID/different-content collisions fail rather than overwrite. Local storage must confirm the write before the app promises an offline copy. Quota/corrupt-storage failures preserve original data. Saving to the account never deletes local data.

Cloud deletion is an explicit two-step action with an expected revision. It removes segment and version content and retains an owner-scoped ID/revision tombstone to reject delayed resurrection. Other owners and local copies are unaffected. Account deletion performed through Supabase cascades these tables. Password recovery and confirmed self-account deletion were subsequently implemented in plan 14. Signup/recovery email entry remains disabled until delivery is configured and verified. Hosted backup expiry/retention must be chosen and documented before making erasure guarantees.

## Files and trust boundaries

| Path | Responsibility |
|---|---|
| `app/src/lib/cloud/schema.ts` | Runtime request/response validation, ordered segments, safe local merge, session fence |
| `app/src/lib/cloud/client.ts` | Public configuration gate, lazy official SDK, in-memory auth, bounded same-origin trip requests |
| `app/src/state/CloudContext.tsx` | Session-only remote state, explicit load/save/delete, conflicts and sign-out cleanup |
| `app/src/components/CloudSavePanel.tsx` | Account form, selected accepted-version save, cloud list/import/delete controls |
| `app/src/state/TripContext.tsx` | Confirmed local import without changing working drafts or existing accepted versions |
| `app/api/trips.ts` | GET list/detail and POST save/delete, request bounds, no-store headers, safe error responses |
| `app/server/auth.ts` | Supabase Auth user lookup for every request; verified, nonanonymous account required |
| `app/server/trips.ts` | Forward the user's bearer token and public key to allowlisted RPCs; no service credential |
| `supabase/migrations/202609120001_companion_cloud.sql` | Owner-scoped trips/segments/immutable versions, RLS, transactional revision checks, idempotency and deletion |
| `app/scripts/cloud-{fixtures,smoke,db-smoke}.ts` | Application checks and real PostgreSQL tests with disposable identities/databases |

Every private table has RLS. Authenticated clients have SELECT only, restricted to their owner ID. Writes occur through narrowly scoped functions with a fixed empty search path and explicit `auth.uid()` predicates on parent and child rows. Each function independently checks the verified account in `auth.users`; it never accepts an owner ID. Function execution is revoked from PUBLIC/anon. The server also authenticates with `/auth/v1/user`; a client-decoded session is not authorization. This follows Supabase's [RLS guidance](https://supabase.com/docs/guides/database/postgres/row-level-security), [verified user lookup](https://supabase.com/docs/reference/javascript/auth-getuser) and [function-security guidance](https://supabase.com/docs/guides/database/functions).

SQL checks identities, dates, segment uniqueness/order, version immutability, quotas and ownership. Full nested schedule/display validation runs at the API boundary and again before client rendering/import. A caller invoking RPC directly can store malformed non-indexed content in their own snapshot; the app refuses to render/import it. SQL is not claimed to duplicate the entire TypeScript schema. No schema checksum is treated as a signature.

Bounds: 1.5 MB save request, eight segments, twenty active cloud trips/account and 128 retained versions/trip. List responses contain metadata; detail responses fetch one trip. Local storage remains twenty accepted versions. No private response is publicly cached and errors do not log/expose raw trip payloads or provider details. Service-role credentials, uploaded private media and privileged workers are absent.

## Verification performed

- `npm run test:cloud`: **9 passing application checks**, including complete repeated-city snapshot round trip, malformed/oversized data, safe segment merge, import collisions, session fencing, verified authentication, user-token forwarding, API allowlisting/no-store behavior, and bounded local HTTP handling including chunked oversize requests.
- `PGHOST=/tmp PGPORT=54329 npm run test:cloud:db`: **10 passing actual PostgreSQL checks**. Migration execution/RLS; exact snapshot round trip; idempotent retries; two-owner parent/child/version isolation; anonymous/unverified/direct-write rejection; nested owner injection; immutable/stale-write rollback; bad windows/duplicates; two concurrent writers; deletion/tombstone behavior. Tests create and drop a uniquely named disposable database. The local Auth schema is a test fixture, not the hosted Supabase Auth service.
- `npm run test:companion`: **16 existing checks pass**, preserving local storage, replay, calendar and briefing behavior.
- `npm run build`: frontend/API TypeScript and production Vite build. The SDK is split into a separate lazy chunk. Existing main/map bundle size warnings remain.
- `npm run smoke`: existing 19 server-rendering/redirect checks.
- Actual browser on port 4318: pre-existing accepted Paris trip still present, exact version/day counts retained, disconnected cloud explanation, no console warnings/errors.
- Separate temporary browser preview with inert `.invalid` public settings: sign-in/create-account mode switching, labeled password/email inputs, native required-field blocking before submission, and visual form inspection. No successful login, remote save or real email is implied by this form test.

The browser tool was used because the `agent-browser` CLI is unavailable. Hosted RLS/PostgREST sessions and a browser flow across distinct local-storage origins were subsequently verified (plan 13). No physical second device, production deployment or real auth email delivery is claimed.

## Activation and remaining work

Completed: CLI login, approved dedicated preview creation in us-east-1, migration dry-run/apply, public connection settings in ignored `app/.env.local`, confirmed-email policy enabled, and Site URL `http://127.0.0.1:4318/paris/saved`. No additional wildcard redirects are configured. `supabase/config.toml` captures local defaults; it is not a declaration that every default was pushed to hosted Auth. Do not bulk-push it to an unrelated project.

`app/server/dev-trips.ts` adapts Vite HTTP requests to the production handler, bounds bodies before JSON parsing (including chunked requests), preserves duplicate query parameters for rejection, and leaves other routes alone. `app/vite.config.ts` loads only the four public Supabase connection settings into this adapter. Production still runs `app/api/trips.ts`. No administrative credential is used by either runtime.

Remaining before public rollout:

1. Configure a custom Auth SMTP sender, verify its domain, and test confirmation and recovery delivery with a real consenting recipient. The default Supabase sender only serves project-team addresses ([official limits](https://supabase.com/docs/guides/auth/auth-smtp)). No confirmation email was sent in the automated tests.
2. Recovery/deletion UX is implemented (plan 14). Keep the documented provider-backup caveat; no promise of immediate backup erasure.
3. An application preview is deployed with working serverless account/trip APIs (plan 14). Broader real-device testing remains part of public-launch acceptance.
4. Only then open accounts to broader testers. Scheduled itinerary mail is a separate milestone with explicit recipient verification, opt-in, retries and cancellation.

Notification preferences, verified self-recipient activation, jobs, deliveries, worker authorization and cancellation are deliberately deferred until the email milestone. That milestone must extend the delete transaction to cancel queued work before enabling jobs. There are no jobs to cancel today. Weather and operational-alert integrations remain later work.
