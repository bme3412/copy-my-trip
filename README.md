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
provenance markers, measured versus estimated travel legs, "N of M stops
personally verified" on every day. No language model schedules anything, and
none of them may write city data.

## What ships today

A fully client-side React 19 + Vite + TypeScript app. Trip state lives in
localStorage; there is no backend beyond two narrow serverless functions.

| | Paris | Rome |
|---|---|---|
| Places | 127 | 42 |
| Verified (curator has been) | 33 | 0 |
| Photo/video plates | 33 places | — |
| Curated days | 4 | 0 |

Rome is honest about being researched and not yet walked — it claims no visits
and shows no archive plates. Paris carries 114 media files, every one of them
dated, 86 with GPS.

Language models appear in exactly two places, both narrow, both non-scheduling:
`api/extract-preferences.ts` turns a traveler's free-text brief into validated
engine inputs, and `api/narrate-day.ts` restyles already-computed facts as prose.
The engine's output is deterministic — the same inputs always produce the same
plan — and regeneration never re-calls either API.

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
