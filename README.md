# Copy My Trip

**A verified archive, not a diary.**

One curator's photo and video archive — 50+ countries, clustered by *place*
rather than by trip — turned into day-by-day itineraries you can actually
follow. A traveler enters dates, pace, the neighbourhood they're staying in and
what they care about; a deterministic engine composes their days out of places
the curator has personally been to, filling the gaps from research and saying
plainly which is which.

The distinction from a generic AI trip planner is the whole point, and it is
structural rather than cosmetic. Every fact is either **witnessed** — a
photograph, a capture date, a route actually walked, a count of return visits —
or **web-sourced**, and the interface never blurs the two: filled versus hollow
provenance markers and experience-scoped firsthand counts. Generated travel
legs are labeled estimated; historical archive evidence is distinct from current conditions. No language model schedules anything, and
none of them may write city data.

## What ships today

A React 19 + Vite + TypeScript app with local planning. Trip state lives in
validated, versioned localStorage. Working drafts and accepted snapshots are
separate; saved views never regenerate the schedule. Optional Supabase account
and private cloud-save code is implemented behind configuration, with a trip API
alongside the two narrow AI functions. It has not been connected to a live project.

| | Paris | Rome |
|---|---|---|
| Places | 127 | 42 |
| Verified (curator has been) | 33 | 0 |
| Photo/video plates | 33 places | — |
| Curated days | 4 | 0 |

Rome is honest about being researched and not yet walked — it claims no visits
and shows no archive plates. Paris carries 114 media files, every one of them
dated, 86 with GPS.

In the traveler application, language models appear in two places, both narrow, both non-scheduling:
`api/extract-preferences.ts` turns a traveler's free-text brief into validated
engine inputs, and `api/narrate-day.ts` restyles already-computed facts as prose.
The engine's output is deterministic — the same inputs always produce the same
plan when inputs and engine/catalog versions are held fixed. Restoration and
briefing previews call neither API. Day narration is an explicit optional action.

## Quick start

Requires Node 20 or newer (developed on 22). Everything runs from `app/`.

```bash
cd app
npm install
cp .env.example .env.local   # add a Mapbox token, or the map falls back to a schematic
npm run dev                  # http://localhost:5173
```

`npm run dev` serves the client only, which is everything except the two API
routes. For those you need the Vercel CLI and an `ANTHROPIC_API_KEY`:

```bash
npm run dev:full             # vercel dev on :3333
```

Note that a full clone is large — the Paris archive alone is ~535 MB of
original media, tracked in the repo.

## Local companion (milestones 1–2)

Open `/:city/saved` (Paris or Rome), create a labeled demonstration draft or
compose your own dates, edit it, and choose **Accept & save itinerary**. Refresh
keeps the exact schedule. **Preview tomorrow** shows an explicit date in the
city's IANA time zone; the date picker does not change the trip. **Today** handles
before-trip, active, open-day, day-trip travel, and completed states.

The itinerary uses a numbered timeline beside a sticky route map on wide screens.
On phones it stacks, with links to jump between the itinerary and map. The map
summary shows planned stops, estimated walking/métro travel and the planned
finish; it does not track traveler completion. Without Mapbox configuration,
the map is explicitly schematic. The header includes a print action.

The preview has shared in-app, escaped email HTML, and plain-text output. HTML
and offline text can be downloaded. No itinerary email is sent; scheduling and
weather are later milestones. Rome has no firsthand imagery.
Known static catalog/evidence gaps still need curator review.

Local storage keeps at most 20 accepted versions and a bounded workspace.
Unreadable data is preserved, with explicit original-data export, legacy draft
import, reset, and retry controls. Storage denial/quota failure leaves the plan
usable in memory with a visible unsaved notice. Export a backup before clearing
browser data. This is device-local storage, not a synced account.

Engine changes must bump `PLANNER_VERSION` in `src/lib/trips/schema.ts`. Catalog
references hash the loaded city data; checksums identify content, not authenticity.
Unsupported engine/catalog versions remain readable through frozen snapshot
facts; editing requires a supported release. No promise is made to execute old
engines indefinitely. A list of place IDs alone cannot replay accepted waiting,
duration, and return-travel intent: use the recorded `replayDay` contract.

```bash
npm run test:companion   # strict checking + snapshot/replay/calendar/render tests
npm run build            # frontend + API TypeScript checks, then Vite
```

See [implementation plan and verification](build-plan/11-copy-my-trip-companion-implementation-plan.md).

## Optional accounts and cloud save (milestone 3)

The Saved trip page contains optional account controls when Supabase public
configuration is present. Saving is explicit. It uploads an accepted snapshot,
keeps the local copy, and checks the cloud revision before changing anything.
Cloud trips support ordered segments, including repeated cities. A downloaded
trip only becomes a persistent local copy when **Keep a copy on this device**
succeeds. Those deliberate local copies survive sign-out; account lists and
in-memory remote data are cleared. Sign-in lasts for this page session only.

The migration, API, setup and remaining live checks are described in
[cloud-save setup and verification](build-plan/12-cloud-save-implementation.md).
The approved `copy-my-trip-preview` Supabase project is connected locally and
migrated. `npm run dev` now serves `/api/trips` through the same handler used in
production, so cloud saving works on port 4318 without a separate API process.
Without configuration the app remains local-only. Hosted Auth, exact snapshot
round trips, ownership isolation, conflicts and browser save/download/reload
have passed with disposable accounts. Password recovery and self-service account deletion are implemented and tested.
The [live site](https://copy-my-trip.com) is deployed, with `www` redirecting to it.
Signup and recovery email are enabled after real delivery, confirmation, recovery
and sign-in checks. Production sign-in, cloud save/readback and account deletion
also passed; see [launch verification](build-plan/16-production-launch.md).
The sender is `accounts@mail.copy-my-trip.com`, through Resend SMTP configured
in Supabase. See [domain and email activation](build-plan/15-domain-and-email-activation.md).

```bash
cd app
npm run test:cloud       # runtime validation, Auth/API boundaries, import/session safety
npm run test:cloud:db    # disposable database on a LOCAL PostgreSQL server; honors PGHOST/PGPORT
```

## Internal curator pilot

A separate local tool reviews 20 Paris records with the OpenAI Agents API,
validates cited proposals, and records curator decisions and evaluation metrics.
It never publishes changes or modifies city data. It requires an `OPENAI_API_KEY`
in `app/.env.local` for live research; synthetic interface testing needs no key.

```bash
npm run review -- prepare       # freeze a batch; prints RUN_ID
npm run review -- run RUN_ID    # live research, model/search charges apply
npm run review -- serve RUN_ID  # local curator UI on 127.0.0.1:4317
npm run test:review             # offline protocol and review tests
```

See [the pilot guide](build-plan/08-curator-review-pilot.md) for the prepared
batch, review protocol, cost attribution, recovery, and how results should
inform the later editor. Live measurements remain pending until research and
human review are completed.

## Deployment

Vercel, and the one setting that matters is **Root Directory = `app`**. The
repository root holds no `package.json`, so a build pointed at it installs
nothing and fails with `vite: command not found`; and Vercel only treats `api/`
as serverless functions when it sits directly under the root directory, so
pointing elsewhere would deploy a site whose two API routes quietly 404. With
the root set to `app`, `npm run build` runs and output lands in `dist`.

Three environment variables, and none announces itself when missing:

| | |
|---|---|
| `VITE_MAPBOX_TOKEN` | read at build time and baked into the client; without it the archive map renders its schematic fallback |
| `VITE_MEDIA_BASE_URL` | CloudFront origin read at build time; leave blank locally to serve `app/public/media`, set it in Vercel before excluding media from the deploy |
| `ANTHROPIC_API_KEY` | server-side only, used by both functions; without it brief extraction and day narration stop working while the deploy still looks green |

### Hybrid media delivery

Production media can live in a private S3 bucket behind CloudFront while the
application and its two API routes remain on Vercel. The TypeScript CDK stack is
in `infra/`; it retains the bucket if the stack is removed and prints the bucket,
distribution and media base URL as outputs.

```bash
cd infra
npm install
npx cdk bootstrap aws://ACCOUNT/REGION  # once per AWS account and region
npm run synth
npm run diff
npm run deploy                          # writes ignored infra/outputs.json

cd ../app
npm run media:manifest                  # local allowlist, no AWS writes
npm run media:publish                   # upload + CloudFront invalidation
```

The publisher uploads only filenames referenced by city `slot-files.json` plus
the explicit hero allowlist in `app/media-extras.json`. Browser-ready JPEG and
MP4 derivatives are published; `.mov` masters and archive evidence remain local.
Set Vercel's `VITE_MEDIA_BASE_URL` to the emitted `MediaBaseUrl`, verify images
and range-based video playback, then add `public/media/**` to `.vercelignore`.
Pass `-- --delete` to `npm run media:publish` only when stale CDN objects should
be removed deliberately.

Publishing requires AWS credentials permitted to write the media prefix and
create CloudFront invalidations. CI should use short-lived OIDC credentials,
never static access keys. The distribution uses the lower-cost North America
and Europe edge class; change `priceClass` in `infra/lib/media-stack.ts` if the
audience requires global edge coverage.

## Commands

```bash
npm run build            # tsc -b && vite build
npm run validate:cities  # schema + cross-reference gate over every city
npm run smoke:plans      # 3500+ invariants over generated plans
npm run smoke            # route-level render smoke
npm run diag             # replay generation for eyeballing
```

Four gates decide whether a change is safe: `tsc`, `validate:cities`,
`smoke:plans`, and `npm run build`. Run all four before committing.

### The archive tools

Three audits, each proving a different kind of agreement. They are
**report-only by design** — capture metadata is evidence, not proof, and
promoting it into a claim spoken in the curator's voice is the curator's
decision, never a script's.

```bash
npm run validate:cities   # the data agrees with itself
npm run media:audit       # the files on disk agree with the data about WHERE
npm run archive:evidence  # the data agrees with the archive about WHEN
npm run media:slots       # refresh the per-city media slot checklist
```

`archive:evidence` reads capture times and GPS straight off the files and
checks them against what the city data claims: `best` windows contradicted by
the shots, `visits` and `last` counted against distinct capture days, season
coverage, same-day transitions, and each place's pin against where the camera
actually stood.

Reading video metadata needs `ffprobe` on PATH (`archive:evidence` and
`media:audit` both use it); photographs are handled by a small built-in
EXIF reader with no dependency. The two shell scripts that prepare media —
`scripts/prep-media.sh` for web derivatives and `scripts/extract-dates.sh`
for capture dates — additionally want `ffmpeg` and macOS `sips`.

## Layout

```
app/                  the application
  src/cities/         city data as static JSON, one folder per city
  src/lib/planner.ts  the deterministic greedy day builder
  scripts/            the quality harness and archive tooling
  api/                two serverless functions, both narrow
build-plan/           how this was built and where it goes next
project/              the original design handoff (HTML prototypes)
Design.MD             design ground truth, derived from the codebase
```

Adding or changing a city means editing JSON under `app/src/cities/<id>/data/`
and running `validate:cities`; no hand-written TypeScript is involved. A city
ships when its archive is deep enough to anchor real plans, not when a scraper
has filled a table.

## The documents

Read them in order; each is written as deltas against the one before.

| | |
|---|---|
| `build-plan/00-current-state.md` | what exists today, with an honest gap list |
| `build-plan/01-principles.md` | the rules that don't bend, and why |
| `build-plan/02-roadmap.md` | phases, with triggers rather than dates |
| `build-plan/03-itinerary.md` | the itinerary and builder, as shipped |
| `build-plan/04-engine-audit.md` | an eight-lens audit of the engine |
| `build-plan/05-audit-remediation.md` | what that audit changed |
| `build-plan/06-archive-evidence.md` | reading the archive as evidence |

`build-plan/reference/` holds superseded planning documents, kept for
vocabulary; `00-current-state.md` maps their terms onto what actually exists.

### Itinerary email work in progress

The optional evening briefing workflow is live in a single-owner pilot. The approved immediate test was delivered and signed delivery events verified; one scheduled message is due at 20:00 Eastern on 12 September, followed by automatic verification and pausing. General email delivery remains restricted. See [plan 17](build-plan/17-scheduled-itinerary-email-preview.md).

### Weather integration preview

An isolated development preview now adds sourced city-level weather alongside accepted itineraries, with simulated outage/expiry scenarios and shared app/HTML/text output. Eight weather checks and real Paris/Rome evaluation fetches pass. Production weather remains disabled pending scheduled-mail acceptance, commercial access and shared caching/job integration. See [plan 18](build-plan/18-weather-preview.md).

The shared weather cache and email-preparation integration are now implemented behind disabled controls, with 25 weather/provider/database checks. The new migration has not been applied to Supabase and no weather email has been sent. See [plan 19](build-plan/19-weather-cache-and-mail-integration.md).
