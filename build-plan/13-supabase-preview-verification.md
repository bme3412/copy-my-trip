# Supabase preview — activation and acceptance record

Follow-up: [account lifecycle and hosted preview](14-account-lifecycle-and-hosted-preview.md) supersedes the pending recovery/deletion and preview-deployment items below.

12 September 2026. The user approved CLI access, then creation of a dedicated preview project at the displayed additional $10/month compute charge.

## Connected environment

- Project: [copy-my-trip-preview](https://supabase.com/dashboard/project/wxpsiguklujutvttrqrn), ref `wxpsiguklujutvttrqrn`.
- Existing Pro organization: `rczwuxjkwdbrhkglcods`. Region: `us-east-1`; micro compute. Other projects were not modified.
- Status: healthy. Migration `202609120001_companion_cloud.sql` dry-run checked and applied through the authenticated CLI.
- Local app: `http://127.0.0.1:4318`. Public Supabase URL/key configured in ignored `app/.env.local`; unrelated values preserved.
- Auth: email/password enabled, email confirmation required, anonymous sign-in disabled. Site URL saved and read back as `http://127.0.0.1:4318/paris/saved`; no wildcard redirects.
- Browser/runtime uses the publishable key plus each user's bearer token. Administrative credentials were used only by the disposable test harness, outside the app environment. Actual private key/password values were checked absent from production JS bundles.
- Database password remains in a mode-0600 ignored local CLI support file. Do not publish `.temp` or `.env.local`. No production application deployment occurred.

## Full-flow evidence

| Boundary | Result | Evidence |
|---|---|---|
| Browser → Auth | PASS | Two disposable verified accounts signed in with the real Supabase Auth service. Reload cleared the in-memory session as designed. |
| Browser → local API | PASS | UI cloud list, accepted-version save and explicit download succeeded through Vite's `/api/trips` adapter. |
| API → Auth → PostgREST | PASS | Real user tokens validated; anonymous request returned 401; private responses carried `private, no-store`. |
| PostgreSQL → accepted snapshot | PASS | Deep equality of complete Paris → Rome → Paris fixtures after storage/read. No planner regeneration. |
| Ownership | PASS | Account B saw no A trips and could not read A's parent, segment or version rows through direct PostgREST SELECTs. Direct table writes returned 403. Browser account switch also showed an empty B cloud list. |
| Concurrent writes/retries | PASS | Identical lost-response retry kept revision 1. Two competing updates produced one success and one 409; stale deletion was rejected. |
| Deletion | PASS | Deleted trip returned 404; delayed save was rejected by its tombstone. Synthetic account deletion cascaded its trip data. |
| Cloud → new local workspace | PASS | `localhost:4318` initially had no accepted versions. Explicit download created the three fixture versions; the latest Paris version retained its ID, two-day schedule and 7/5 stop counts through reload. |
| Local copy → briefing | PASS | Downloaded day opened after sign-out with the same accepted version, date, schedule and provenance. Browser console showed no warnings/errors. |
| Regression checks | PASS | Production frontend/API build; 9 cloud application/HTTP checks, including malformed JSON and oversized fixed/chunked bodies. Existing main/map bundle warnings remain. |

The isolated localhost origin simulates a fresh device's local storage; this does not prove a physical second device or deployed-host behavior. The browser tested storage/rendering, not factual correctness of catalog entries. Existing catalog review remains separate.

`app/scripts/cloud-hosted-smoke.ts` is an explicit opt-in preview test, not part of ordinary CI. It requires a private CLI API-key file under `supabase/.temp`, creates only labeled `@example.invalid` fixture identities without sending email, records their IDs privately, and offers `--cleanup`. The hosted Auth service rejected the initially returned secret-key value; the test harness used the project's valid legacy administrative key. Application code continued to use only the verified publishable key and real user tokens. The fixture accounts and temporary API-key export were deleted after browser verification. Automatic approval review rejected a broad localhost workspace reset because it could include user drafts. That action was cancelled; only the three known synthetic accepted-version IDs were removed individually through the UI. The original 127.0.0.1 workspace remained intact.

## Next steps

1. Configure a verified Auth email sender and test confirmation delivery with a consenting recipient. Supabase's default sender only permits project-team addresses ([official SMTP documentation](https://supabase.com/docs/guides/auth/auth-smtp)). No real authentication or itinerary email was sent in these tests.
2. Add password recovery and account-deletion UI, with documented backup/retention behavior.
3. Deploy an application preview, set its exact Auth return URL, and test real-device save/download plus production request limits.
4. Add scheduled itinerary mail only with explicit subscription, verified recipient, deterministic accepted-version selection, retry/idempotency and cancellation on deletion. Weather and operational alerts remain later milestones.

Project creation and local connection are complete. Broader signup and full milestone-3 launch acceptance remain gated on the steps above.
