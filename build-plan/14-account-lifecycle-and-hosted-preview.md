# Account lifecycle and hosted preview

> Follow-up: signup/recovery email delivery is now verified and enabled in the new preview. See [plan 15](15-domain-and-email-activation.md) for the current sender, deployment and acceptance evidence. The observations below retain their original test scope.

12 September 2026. Continues the approved Supabase setup. Password recovery and self-service account deletion are implemented. Signup/recovery email delivery remains pending a sender domain and provider; the user confirmed neither is set up yet.

## Changes

- `AccountRecovery.tsx`: email → recovery code → new password with repeat confirmation. A separate in-memory Supabase client prevents a recovery session from becoming the planner's signed-in account. No URL-token detection, persistent token storage or automatic itinerary upload.
- `AccountDeletion.tsx` and `/api/account`: explicit irreversible-deletion explanation, `DELETE` confirmation, current-password reauthentication, bounded requests, safe failures and session cleanup. Device copies remain; the form explains that provider backups expire separately.
- Migration `202609120002_account_deletion.sql`: an owner-only function with no owner argument, verified account lookup, a password-authentication claim no older than five minutes, fixed empty search path, and a lock shared with trip writes. Deletes the Auth user and cascades cloud trips/segments/versions. It does not require an administrative key in the app. Direct execution with a recovery-only session is denied.
- `supabase/templates/recovery.html`: branded recovery-code template, installed in the preview's hosted Auth settings and visually checked after saving. This is a template configuration test, not an email delivery test.
- `VITE_ACCOUNT_EMAIL_READY`: defaults false. Signup and recovery sending clearly explain their unavailable state and stay disabled until real delivery has been configured/tested. Existing users can sign in; anonymous local planning remains available. This UI switch is not a server-side signup authorization policy.
- `app/vercel.json`: deep links for Paris/Rome, API no-store headers, referrer policy and content-type protection.
- Server-side runtime imports explicitly resolve `.js` files. `test:api-runtime` now runs inside the build and loads transpiled, unbundled Node ESM handlers. This catches a deployment failure that a Vite/esbuild bundle alone hid.
- Same-origin API requests include same-origin cookies for Vercel deployment protection. Application account authorization still exclusively validates the Supabase bearer token; cookies do not establish trip ownership.

## Verification

- 10 cloud application checks pass, including wrong password, owner injection, confirmation, authentication identity mismatch, no-store and bounded fixed/chunked requests.
- Production build and the new Node ESM runtime check pass. Existing large main/map bundle warnings remain.
- Live disposable accounts: generated a recovery OTP without email, rejected an invalid code, verified the correct recovery code, changed the password, rejected the old password and accepted the new one.
- Live deletion: rejected wrong password and caller-provided owner; successful deletion removed the Auth user and all three cloud table families, prevented sign-in, and preserved the other account. A recovery session alone could not invoke the deletion function.
- Browser: recovery form and deletion confirmation/password controls inspected; cancel/sign-out kept the original local itinerary intact. Hosted browser acceptance also passed: real sign-in, cloud list, accepted-version save/readback, and self-account deletion with a visible success message. The local demo remained intact and the browser console had no warnings/errors.

No real signup, recovery, notification or itinerary email was sent. Tests use labeled, disposable `@example.invalid` identities. Administrative test credentials are separate from app environments and removed after cleanup.

## Verified hosted preview

[Open Copy My Trip preview](https://copy-my-trip-f019a32k1-bme3412.vercel.app/paris/saved) · deployment `dpl_ENuCwvia2GTECLoREuGzwjpsH3CY`, Ready.

The hosted demo accepted version `plan-mtyods0g-e1c06a76030fa388` retained four days (7/6/7/6 stops) through cloud save/readback. The disposable account was then deleted through the deployed UI. The original local `127.0.0.1` workspace was not modified. The final preview keeps a labeled local demo for inspection.

Supabase Auth Site URL is the final preview's `/paris/saved` page. Recovery uses codes rather than a callback URL. No additional wildcard redirects were enabled.

## Hosting and limits

The existing Vercel project `copy-my-trip` uses root directory `app`, Node 24 and the Pro plan. Preview deploys include the full public archive, app source and public Supabase settings. Private pilot artifacts, local environment files, CLI credentials and model-provider secrets are excluded. Preview functions run in `iad1`, alongside the Supabase `us-east-1` region. Production was not promoted and deployment protection was not disabled.

Deployments use a scoped staging directory with the linked project metadata and deployment-specific public environment settings. Future previews must supply the public Supabase variables again; no production or project-wide secret was added. The first two previews were superseded while fixing Node imports and protected-browser requests.

The app bounds trip payloads at 1.5 MB and account requests at 4 KB. Local chunked-body checks passed; a dedicated deployed upper-bound load test remains separate from basic end-to-end acceptance.

## Sender setup and rollout

The existing AWS credentials cannot list SES identities or inspect SES account status. No IAM permissions were expanded. The user has no sender domain/provider ready. A simple next choice is a dedicated sending subdomain with Resend SMTP; provider signup, domain ownership/DNS and any charges need their concrete setup details before activation.

1. Choose an owned domain/sending subdomain and create the email-provider account.
2. Verify its DNS records and sender. Configure SMTP in the dedicated Supabase preview, keeping credentials out of chat and `VITE_` settings.
3. Test signup confirmation and recovery delivery to an explicitly authorized real recipient, including invalid/expired codes and mobile email clients. Supabase's built-in sender is limited to project-team addresses ([official SMTP guidance](https://supabase.com/docs/guides/auth/auth-smtp)).
4. Set `VITE_ACCOUNT_EMAIL_READY=true` only after that acceptance, and rebuild the preview.
5. Broaden real-device testing before production rollout. Scheduled itinerary emails remain a separate opt-in milestone.

For the current Pro project, Supabase documents seven days of daily backups ([backup documentation](https://supabase.com/docs/guides/platform/backups)). This is a provider retention window, not a tested guarantee of immediate physical erasure. No backup export, restore or paid point-in-time-recovery add-on was created. Before production, document the chosen policy and test any restore procedure so deleted accounts are not inadvertently restored into service.
