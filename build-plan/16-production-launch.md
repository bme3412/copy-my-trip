# Production launch

12 September 2026. Continues the verified email setup in [plan 15](15-domain-and-email-activation.md).

## Prepared release

- Deployment: `dpl_3iStpzt2cvDbMUdR8NaQV7a4ZXaN` — [verified preview](https://copy-my-trip-rj3dyja4t-bme3412.vercel.app/paris/saved).
- Intended production address: `https://copy-my-trip.com`, with `www.copy-my-trip.com` redirecting to the apex.
- Vercel project: `copy-my-trip`, `prj_RtJg4LkI9SEam8rChiQA9D7LedSX`, team `team_ckxRgooICMgMhlTJJXQPp5Ka`.
- The deployment includes verified account email, private cloud saving, immutable accepted itineraries, local briefings and the recovery-code re-entry improvement.
- It uses the already provisioned Supabase project `wxpsiguklujutvttrqrn` (still named `copy-my-trip-preview`). No additional database, paid plan or AI key was provisioned for launch.

## Preparation completed

Saved five non-secret, production-scoped Vercel variables from the verified local configuration: `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, and `VITE_ACCOUNT_EMAIL_READY`. These preserve account configuration in future production builds. No model-provider or SMTP credentials were copied into Vercel; SMTP stays in Supabase.

The candidate's trip API returns HTTP 401 with a sign-in requirement for an unauthenticated request. Previous build, browser, live owner-isolation, save/replay and real signup/recovery evidence remains documented in plans 13–15. All 10 cloud regression checks passed. The initial sandbox run blocked its loopback HTTP server; rerunning with loopback access completed successfully.

## Production switch completed after explicit approval

The initial approval review required explicit confirmation of the exact release/domain. The user then approved publication, the `www` redirect and account confirmation URL. The CLI reported a team-scope mismatch; the signed-in Vercel dashboard completed promotion of the approved source by rebuilding it with production settings.

- **Live:** https://copy-my-trip.com
- **Production deployment:** `dpl_66eK75g1Qw4pB6GqaB2Lyt2mPSDL`, https://copy-my-trip-e7w3jdw6y-bme3412.vercel.app, **READY**. Metadata identifies the approved preview as its original deployment.
- **Framework/build:** Vite, Node 24; production build completed in approximately 41 seconds. This release includes uncommitted workspace changes; a Git commit SHA alone does not identify its content.
- **Domains:** apex connected to this project; `www.copy-my-trip.com` verified and configured with a permanent HTTP 308 redirect. Public verification confirmed path and query-string preservation.
- **Supabase Site URL:** `https://copy-my-trip.com/paris/saved`, saved and read back. No wildcard redirect was added. Sender DNS records and SMTP configuration were preserved.

### Production verification

Unauthenticated public HTTPS requests returned 200 for the root, Paris saved/itinerary routes and Rome compose. `/api/trips` returned 401 and `Cache-Control: private, no-store` without a bearer token.

A tagged synthetic `@example.invalid` account signed in through the production browser, accepted a labeled four-day demonstration, saved it remotely and read it back. An independent authenticated HTTP check confirmed snapshot `plan-mtyqlhrc-e1c06a76030fa388`, revision 1, dates 13–16 September, and stop counts 7/6/7/6, with private no-store responses. Self-service deletion through the live app succeeded; subsequent administrative read-only checks confirmed the Auth user and all three owner-scoped cloud table families were empty for this fixture. Temporary fixture metadata was removed. No additional email was sent during launch checks.

The local demonstration remains available for inspection on this browser's production origin. Previously saved localhost/preview versions were not changed.

### Observability and remaining limitations

The production runtime scan found three HTTP 502 requests to `/api/narrate-day` while its optional feature was tried without a configured model-provider key. These are an existing limitation of the launch release, not successful AI generation. No model key was added and no paid model feature is activated. Account/trip flows passed. A Node `url.parse()` deprecation warning was also reported; its origin was not established by this check. Do not describe the complete runtime scan as error-free.

Vercel runtime logs are available, but no new log drain, alert monitor, analytics or performance integration was installed. Physical mobile-device and backup-restore testing remain separate work.

Local-only trips on localhost or older preview origins do not automatically appear on the new domain. Preserve them and use explicit export/import or account save/download for transfer.

## Rollback

Previous production: `dpl_4Sptc266G1TvN15WpFmqRMy6XwNT`, `https://copy-my-trip-4zriexbwt-bme3412.vercel.app`, created 24 July 2026. It predates cloud-account support. Keep this as the deployment rollback target, but do not roll back the Supabase schema or delete account data. Record domain assignments and Auth Site URL at the time of cutover so these can be restored consistently if needed.

Scheduled itinerary emails, weather, and operational alerts remain separate milestones. This preparation does not establish physical mobile-device testing, production monitoring, or a tested backup restore.
