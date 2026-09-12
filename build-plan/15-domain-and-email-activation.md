# Domain and email activation

> Production follow-up: the approved release is now live at `https://copy-my-trip.com`; see [plan 16](16-production-launch.md) for the current account redirect, deployment and live verification. Preview observations below retain their original scope.

12 September 2026. Continues the Supabase preview setup documented in `14-account-lifecycle-and-hosted-preview.md`.

## Domain registered

The user selected and explicitly approved `copy-my-trip.com` for $11.25 initially and $11.25/year automatic renewal, plus applicable taxes/fees. Vercel checkout completed successfully under Brendan's projects (`bme3412`). The confirmation page reported that the domain was ready with nameserver propagation pending. The rejected `copymytrip.app` option was removed from the cart before checkout.

Registration uses the user's supplied phone and the contact email visible in checkout. Personal registration details are not copied into this repository. No production deployment was promoted or domain connected to the older production app.

## Email provisioning result

Proposed sender: `accounts@mail.copy-my-trip.com`, using a dedicated `mail.copy-my-trip.com` sending domain in Resend, region `us-east-1`.

- Interrupted initial provisioning was checked: the project had no integration resources.
- Resend Marketplace terms subsequently appeared as already accepted in the browser.
- Retried provisioning explicitly requested the **Free** plan, preview-only connection and `--no-env-pull` to preserve existing local environment settings.
- Provisioning failed with the provider response: `Billing plan is disabled: free (400)`.
- Opening the installed integration through Vercel SSO redirected to Resend login with `account_not_found`: the integration cannot sign in to a Resend team.
- No paid email plan was selected. No email resource, API key, DNS verification record or Supabase SMTP configuration was successfully created by these attempts.

## Activation completed

The user connected an existing Resend account. The existing sender and keys were preserved; no paid plan or upgrade was selected. The failed Marketplace resource is not the delivery path: Supabase connects directly to Resend SMTP.

- Added and verified `mail.copy-my-trip.com`, domain ID `52a9c254-2b84-44aa-8477-01e7ef5ebc93`, in `us-east-1`.
- Added provider-issued DKIM TXT at `resend._domainkey.mail`, SPF TXT and priority-10 bounce MX at `send.mail`, plus a monitoring-only DMARC policy at `_dmarc.mail`. All four records independently resolved through public DNS; Resend then marked the domain verified. Receiving mail remains disabled; this is not a general-purpose inbox.
- Domain delivery requires TLS. Tracking was not configured, and the delivered confirmation link was a direct Supabase URL.
- Created `copy-my-trip-supabase-preview`, key ID `a06e254a-7226-40f4-821a-6fb6c66af236`, with **Sending access restricted to this domain**. Its value was transferred privately into Supabase SMTP, then discarded from the temporary browser-tool variables. No Resend key was written into the repository or browser environment.
- Saved SMTP host `smtp.resend.com`, port `465`, username `resend`, sender `Copy My Trip <accounts@mail.copy-my-trip.com>`. Supabase minimum interval remains 60 seconds per user; enabling SMTP sets its documented default email rate limit to 30/hour.

## Real delivery acceptance

The user explicitly authorized two emails to their own address. A tagged, temporary Auth account was created only after verifying no existing account used that address.

1. Signup confirmation: Resend email ID `cabfa460-d912-4857-99db-8d9fcc653814`, **delivered**. The actual delivered link confirmed the expected Auth user.
2. Recovery code: Resend email ID `8184c191-4e69-43d1-b556-66bbb06ea337`, **delivered**. In the app, an invalid code failed, the delivered code reached password selection, password update succeeded, the new password signed in, and the original password was rejected.

Added **I already have a code** to `AccountRecovery.tsx`, allowing recovery after reopening the page without requesting another email. Native email validation runs before entering the code stage. The real delivered code exercised this path in the local browser. Local accepted trip versions remained intact and no trip was uploaded during the email test.

The temporary Auth account was signed out, deleted with an exact ID/email/purpose guard, and verified absent. Its temporary credential file was removed. The two emails therefore document completed tests; they are not credentials for a retained traveler account. Delivery status means the recipient server accepted the messages; inbox/spam placement and physical mobile mail clients were not independently inspected.

## Enabled preview

`VITE_ACCOUNT_EMAIL_READY=true` is set locally and in the new preview's build settings after acceptance. The production build and unbundled Node API runtime check pass, with existing large-bundle warnings only.

[Email-enabled preview](https://copy-my-trip-rj3dyja4t-bme3412.vercel.app/paris/saved), deployment `dpl_3iStpzt2cvDbMUdR8NaQV7a4ZXaN`, is **Ready**. Browser inspection confirms enabled signup, recovery sending and existing-code entry, without the setup-pending notice. No browser errors were reported. Supabase Site URL now points to this preview's `/paris/saved`; there are no wildcard redirects.

The preview is a new origin, so older preview/device-local trips remain on their original origins. Export/import or explicit cloud save is needed to move them. `copy-my-trip.com` remains registered but is not connected to the older production deployment. Production has not been promoted.

## Next milestone

Choose the production URL and complete broader real-device acceptance before public rollout. Scheduled itinerary emails remain separate: explicit opt-in, timezone/date preferences, exact accepted-version links, durable jobs, idempotency, delivery events and pause/unsubscribe must be implemented before scheduling messages. Weather and verified operational alerts follow that milestone.
