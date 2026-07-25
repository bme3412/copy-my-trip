# 06 — The archive as evidence ✅ (shipped 2026-07-24)

Deltas against `00-current-state.md`, in the manner of `02-roadmap.md`. Written
after the tooling landed and its first findings were applied to city data.

## Why this exists

Three gates now guard the data, and until this one there was a hole in the
middle of them:

| Gate | Proves |
|---|---|
| `validate:cities` | the data agrees with **itself** |
| `media:audit` | the files on disk agree with the data about **where** |
| `archive:evidence` | the data agrees with the archive about **when** |

The prompt was a live bug, not a theory. Pont des Arts was scheduled at 10:23
under a description reading *"come at dusk"*. The archive already knew better —
its December frames are stamped 16:34 and 16:39, twenty-odd minutes before
sunset — and nothing read them. `extract-dates.sh` had been harvesting capture
metadata since Phase 1 and truncating it to `YYYY-MM`, throwing away both the
hour and the coordinates.

This is the curator-provenance principle (`01-principles.md` §1) turned on its
own data. A witnessed fact is not whatever the JSON says; it is what the
photographs support.

## What shipped

- **`app/scripts/archive-files.ts`** — the metadata reader. Capture moment and
  coordinates per file, with `_gen-*` derivatives resolved to their master:
  QuickTime tags via `ffprobe` for video, and a small EXIF/TIFF reader for
  photographs. The reader is hand-rolled because `sips` reports a date but will
  not surrender GPS, and no dependency is worth two IFD lookups — the same
  no-new-dependencies rule the validator and smoke suite already follow. Only a
  256 KB prefix is read, since APP1 sits just past the SOI marker.

  Time is kept **local**, deliberately. A photograph's evidence is "quarter past
  five in the afternoon, there"; converting to UTC destroys the fact being
  measured.

- **`app/scripts/archive-evidence.ts`** (`npm run archive:evidence`) — six
  sections: `best` windows contradicted by the shots; places whose light is
  sun-relative rather than clock-fixed; `visits`/`last` counted against distinct
  capture days; month-by-month season coverage; same-day transitions between
  places; and coordinates against each place's declared `lat`/`lon`.

- **`media-audit.ts` upgraded** — its GPS section was video-only. It now reads
  photographs too, which is most of the archive. The duplicated `GEN_SOURCE`
  table collapsed into `archive-files.ts` (the copy in `extract-dates.sh` must
  stay, being shell). Both audits also stopped counting `.DS_Store` as media.

Both audits are **report-only by design**. Capture metadata is evidence, not
proof — a phone clock can be wrong, and one shot in the rain is not a preferred
window. Promoting evidence into a claim made in the curator's voice is the
curator's decision, never a script's.

## What the archive said

Paris coverage: **114 of 114 files dated, 86 carrying coordinates.**

Location services split cleanly by era — every file from 2024 on has GPS,
nothing from 2022 or earlier does. That is a scheduling fact, not a defect:
pre-2024 places can only ever be placed by hand, and the boundary is knowable
before any work starts.

| Year | 2016 | 2019 | 2022 | 2024 | 2025 | 2026 |
|---|---|---|---|---|---|---|
| Files with GPS | 0/8 | 0/11 | 0/9 | 37/37 | 15/15 | 34/34 |

Findings that changed data are listed below. Findings that changed *thinking*:

- **`best` is clock-fixed and cannot be.** Paris sunset moves from 17:00 in late
  December to 21:58 in June — five hours. Pont des Arts's December frames sit 26
  and 21 minutes before sunset, at 16:34 and 16:39 on the clock; the same "just
  before the light goes" moment is nearly 22:00 in June. No single tuple can
  mean both. This is Phase 8.
- **A place with one `best` window can be two experiences.** The Eiffel's nine
  plates split cleanly with nothing in between: four at dusk (sunset −6 to +78
  min) and five in broad daylight (six and a half to eight hours before sunset,
  the earliest at 11:13). Its `[16, 24]` window was hard-filtering the tower out
  of every daytime slot the archive proves the curator used it for.
- **Timing evidence contradicts a declared window well, and invents one badly.**
  The tool proposed windows for seven places with none; six were declined.
  `best` is a hard filter, so inferring `arc: [10, 12]` from five frames one
  morning would make the Arc de Triomphe unschedulable after noon. The seventh
  (`buci`) was declined too, on a second look: its own description says "market
  stalls in the morning, waiters threading the terraces by seven", so an
  evening-only window would contradict the copy.
- **A gap too short to cross is not speed — it is a telephoto.** Five same-day
  transitions cannot be travelled at all: a frame filed at the Eiffel and one at
  Pont Alexandre III, 1.8 km apart and 3 minutes apart, is one vantage point and
  two subjects. The first pass called these "engine too slow" until a plausible
  speed floor was added; below it, the finding is provenance, not travel time.
  This matters because `measured` legs assert the curator *walked* between two
  points.
- **Observed transitions cannot yet confirm the travel model.** Every gap
  includes lingering, so it bounds a journey from above without measuring it.
  After the telephoto cases were separated out, nothing in the archive
  contradicts the engine's estimates — and nothing confirms them either. Real
  leg times need consecutive GPS, not photo pairs. `04-engine-audit.md`
  improvement 6 stands unresolved.

## Data corrections applied

Counted facts, applied directly:

| Place | Field | Was | Now |
|---|---|---|---|
| `sacre` | `lat`, `visits` | 48.8867, 6 | 48.8859, 7 |
| `vertgalant` | `lat`/`lon`, `last` | 48.8573/2.3410, Dec '24 | 48.8574/2.3398, Jun '26 |
| `pompidou` | `lon`, `last` | 2.3522, Jun '24 | 2.3514, Jun '26 |
| `berthillon`, `chezjanou`, `stgermain` | `last` | May/May/Jul '24 | Jun '26 |
| `pontdesarts` | `last` | Dec '24 | Jun '25 |

Coordinates moved to the centroid of the shots that cluster at the place;
`last` moved wherever a dated photograph proves a more recent visit than the
data claimed. A visit count can only ever be a floor — the curator visited
places they did not photograph — so declared-above-evidence was left alone and
only `sacre` was raised.

Judgment calls, decided by the curator:

- **`eiffel`** — `best` widened `[16, 24]` → `[11, 24]`, the span the archive
  actually covers.
- **`tournelle`** — the description claimed *"I have this shot from five
  different years"*; the archive holds one frame, at 12:46 on 2019-06-18, nine
  hours before sunset. Copy and caption rewritten to match, and the unsupported
  `[17, 22]` window removed with them. Restore it if the spot is known from
  experience rather than from film.
- **`maisonrose`** — promoted web → verified (1 visit, Jun '26) on a video shot
  62 m from its pin.
- **`pontdesarts`** — gained `best: [17, 22]` when the original bug was fixed.
  Phase 8 should replace it with a sun-relative window.

## Open, deliberately

**Three plates are filed under places their coordinates disprove.** GPS refutes
the current assignment in each case without proving a new one, and the
photographs show food that matches none of the nearby catalog places:

| File | Filed as | Shot at | Distance |
|---|---|---|---|
| `paris-pastries.jpeg` | Marché des Enfants Rouges, "Market stalls" | foot of Montmartre, 508 m below Sacré-Cœur | 2412 m |
| `paris-tarte-framboise.jpeg` | same market, "The plate" | the Marais, 83 m from Miznon | 902 m |
| `paris-desserts.jpeg` | Place des Vosges, "the tea-room counter" | the 6e, 103 m from Le Pré aux Clercs | 2453 m |

Unassigning all three would leave Marché des Enfants Rouges with zero plates
while marked verified with 4 visits — which `media:audit` would then correctly
flag as a bare claim, since the archive holds no photograph of that market.
Awaiting the curator's identification; this is exactly the case the report-only
rule exists for.

Section 6 flags two further distant plates that are **not** errors, and should
stay: the Eiffel shot from 2.4 km away (the tower is best photographed from
anywhere but the tower) and the Bateaux-Mouches frame 1.7 km from its pin (a
cruise boat has no fixed position). The section header says as much — distance
is not wrongness, it is only the absence of evidence that the curator stood
where the pin is.

Sacré-Cœur still sits 72 m from the centre of its own six shots after its
correction. Left alone: the basilica's footprint is larger than the error, and
the pin marks the steps people are actually sent to.

## What it revealed about the product

Two numbers worth carrying into planning.

**The archive covers a quarter of the catalog.** 25 of 127 Paris places have any
temporal evidence at all; 33 have plates; 37 have a description, so 90 render as
bare names. Paris was once 37 places at 62% verified and is now 127 at 26%. The
catalog has grown almost entirely in the web tier — the tier that makes this
product resemble the generic planners its premise argues against. Pruning or
structurally subordinating that tier is the open strategic question.

**Depth is the constraint, not breadth.** Paris alone spends 114 files and 535 MB
filling 84 of its 122 designed slots, and it is the only city with any. An archive
spread thin across many cities would dissolve the one claim that distinguishes the
product; Rome already shows what the thin end looks like.

## Done when

Shipped: `npm run archive:evidence` runs on both cities, section 3
(visits/last) reports **none** for Paris — every declared `visits` and `last` now
agrees with the film — and the gates stay green: `tsc`, `validate:cities`, 3504
smoke assertions, `npm run build`.

Still open, and expected to stay open until the work behind them lands:

| Section | State |
|---|---|
| 1 · best windows | 7 proposals, all declined — inference is too blunt for a hard filter |
| 2 · light not clock | 1 place, the Phase 8 case |
| 5 · transitions | 5 telephoto pairs; no engine estimate contradicted |
| 6 · where the camera stood | 3 plates awaiting re-filing, 2 correctly distant, 1 tolerated 72 m offset |
