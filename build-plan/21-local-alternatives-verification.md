# 21 — Local itinerary alternatives: implementation and verification

12 September 2026. Package 1 of [plan 20](20-alternatives-ai-mcp-and-rollout-plan.md) is implemented locally and browser verified. **No deployment, database migration, model call, live operational-source request, subscription or email was performed. Commercial weather remains deferred.**

## Using the local preview

In the development app, open a saved Paris trip and choose **Preview closure alternatives · local simulation**. The route is `/paris/saved/:snapshotId/alternatives`. It is lazy-loaded only in development; simulation fixtures and the preview UI are absent from the inspected production bundle.

Choose the saved day, affected stop and scenario: all-day venue closure, the selected experience closed during its visit, expired evidence, or no feasible replacement. The engine offers at most three choices. Select one to inspect the saved/proposed visits, arrival/departure times, duration, travel, free time and returns. Keep the original or explicitly accept a demonstration on this device.

Acceptance appends a new immutable version linked to its original. Simulated results retain the demonstration flag in saved views, briefings and exports. A matching working draft follows the accepted alternative; separate unaccepted working edits are preserved. Cloud copies remain separately managed.

## Implementation

- `app/src/lib/conditions/operations.ts`: bounded runtime parsing and destination-local, date/experience-scoped closure intervals. Expired, future-retrieved, unverified and retracted evidence cannot drive a proposal.
- `app/src/lib/planner.ts`: shared closure checks in candidate filtering and replay, plus opt-in same-venue experience alternatives. Ordinary planning behavior remains the default.
- `app/src/lib/proposals/`: proposal contracts, bounded deterministic construction, schedule differences, development fixtures, validation and durable acceptance. Complete candidate content is revalidated against the frozen preview; acceptance does not substitute a new schedule.
- `TripContext.tsx`: shared Web Locks for local persistence, stale-tab detection, durable proposal acceptance, and protection against a pending older autosave overwriting an explicit acceptance. Cloud-copy import shares the lock. Proposal acceptance requires Web Locks support.
- `AlternativesPreviewPage.tsx`, `ProposalDiff.tsx`, saved-page link and responsive styles: source/simulation labeling, explicit selection and decision, comparison and expiry/error states.
- `trips/schema.ts` and `plan-presets.ts`: temporary proposal constraints cannot become permanent saved day context.

## Evidence

**14 proposal checks** pass: deterministic bounded choices; exact scope/time boundaries; candidate/replay closure parity; another open experience at the same venue; evidence freshness/status; conflicting/no-feasible cases; incompatible/invalid data; timed-entry protection; exact accepted schedule and unchanged days; waits/returns; tamper/expiry rejection; durable reload/stale/deleted/duplicate acceptance; preservation of separate working edits; quota/version limits.

Existing **16 companion, 10 cloud and 10 mail checks** pass. Frontend/API TypeScript checks, all seven unbundled API runtime checks and production build pass. Existing bundle-size warnings remain. Tests use local/fake dependencies and send no real messages.

Browser verification used an isolated `agent-browser` session against the existing local server at port 4318:

1. Created and accepted a labeled four-day Paris demonstration through the UI.
2. Simulated Place des Vosges closing; inspected three alternatives. One substituted Hôtel de Ville, increasing estimated travel from 56 to 67 minutes while retaining the other stops.
3. Chose **Keep original itinerary**; compared serialized accepted snapshots before/after: unchanged, one version.
4. Exercised expired evidence and no-feasible replacements: no acceptance action and no new version. Partial-day simulation produced three alternatives.
5. Accepted a partial-closure alternative replacing Café Hugo with Ten Belles. Exactly two versions were stored. The original and all other days were unchanged. After full reload, saved names, times, visit durations and travel values matched the visible reviewed candidate.
6. A second tab detected the external save, displayed the stale-data notice and disabled its preview action.
7. Inspected the selected comparison at 390 px width: single-column saved/proposed facts, no horizontal overflow. No browser errors were reported during verification.
8. After aligning the working draft with the accepted base through the UI, accepted another alternative. The third version was saved, the working draft exactly matched it, and the original remained unchanged. Closed the isolated verification browser.

Screenshots: [desktop review](artifacts/alternatives/desktop-review.png), [mobile review](artifacts/alternatives/mobile-review.png). The full-page desktop capture includes the existing sticky navigation at its scroll position.

## Deliberate limits and next package

This is a single-stop replacement flow. Multiple affected stops return an explicit unsupported/infeasible result. It does not replace a timed incumbent or a stop with an attached return; later timed entries must retain their exact scheduled slot. It cannot confirm bookings, guarantee transport connections or claim live closure coverage. It preserves every unaffected stop and meal role; no automatic removal is offered to hide infeasibility.

Pending previews live in memory; refresh discards the preview, not accepted history. Local acceptance rejects a repeated stale request rather than creating a duplicate version. Source-change generations and cross-device atomic acceptance belong to package 2.

Next: implement owner-scoped cloud proposals and atomic acceptance against trip and condition revisions, then connect a bounded set of verified operational sources. Rollout controls precede enabling paid AI or remote MCP. Weather is not a prerequisite.
