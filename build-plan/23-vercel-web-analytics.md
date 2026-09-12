# Vercel Web Analytics

12 September 2026.

- Enabled the included Web Analytics plan for the existing `copy-my-trip` Vercel project. Analytics Plus was not selected.
- Installed `@vercel/analytics` 2.0.1 and mounted the React integration once in the shared city layout.
- SPA route changes use explicit pageview paths. Saved-trip, mail and itinerary IDs are grouped into route names. Query strings and fragments (including account recovery codes and preview dates) are removed before reporting; unknown routes are dropped. No custom events or trip-content properties are added.
- Vite development uses Analytics development mode with debug logging off; production builds use the production script. Local inspection confirmed the development script is loaded with no console errors.
- Eleven focused URL-redaction checks, the production build, API runtime checks and 19 route smoke cases passed.
- The Vercel dashboard is enabled and awaiting a deployment containing the SDK. Enabling the dashboard alone does not instrument the existing production release. Production event receipt is not yet verified.

Dashboard: https://vercel.com/bme3412/copy-my-trip/analytics
Official setup: https://vercel.com/docs/analytics/quickstart

This commit also captures the previously uncommitted companion, internal-review, cloud-save, mail/weather preview, alternatives and editorial frontend work documented in plans 07–22. Credential files, local environment files and Supabase pilot state remain excluded from Git. Weather/email feature flags and database migrations are not changed by adding Analytics.
