/** Shared vocabulary for city archives. Each city ships its data behind the `City` interface. */

export type Source = 'verified' | 'web'
export type Meal = 'coffee' | 'lunch' | 'dinner' | null
export type PlaceGroup = 'food' | 'sight' | 'indoor' | 'park'
export type Pace = 'gentle' | 'balanced' | 'full'
/** Coverage themes a first trip should contain. */
export type Theme = 'monumental' | 'historic' | 'artistic' | 'neighborhood' | 'everyday' | 'afterdark'

/** A schedulable variant of a place — the Louvre interior vs its courtyard,
 * the Eiffel summit vs the Trocadéro view. Every omitted field inherits the
 * parent place's value; a place with `experiences` is scheduled only through
 * them (the first entry is the default). The place stays the dedup unit:
 * one visit per place per trip, whichever variant is chosen. */
export interface Experience {
  id: string
  name?: string
  label?: string
  dur?: number
  open?: [number, number]
  hours?: ([number, number] | null)[]
  timed?: boolean
  best?: [number, number]
  role?: 'anchor'
  group?: PlaceGroup
  /** Provenance can differ per experience — the curator has shot the
   * courtyard for years without ever going inside. */
  src?: Source
  visits?: number
  last?: string
  note?: string
}

/** A date-specific override of a place's hours. Exactly one of `closed`/`open`. */
export interface PlaceException {
  /** ISO date, e.g. '2026-07-13'. */
  date: string
  closed?: true
  open?: [number, number]
  note?: string
  /** Whether the exception was verified at the source; unset reads as unverified. */
  source?: 'verified' | 'web'
}

export interface Place {
  id: string
  name: string
  area: string
  /** Neighbourhood — authoritative for the planner's day anchoring. */
  hood: string
  lat: number
  lon: number
  dur: number
  meal: Meal
  open: [number, number]
  src: Source
  visits: number
  last: string
  label: string
  group: PlaceGroup
  /** Preferred arrival window (hours) — e.g. golden-hour spots, no morning gelato. */
  best?: [number, number]
  /** A major commitment (Louvre, Orsay, Versailles) — at most one per day, mornings preferred. */
  role?: 'anchor'
  /** Coverage themes this place satisfies. */
  themes?: Theme[]
  /** Needs a timed reservation — at most two per day. */
  timed?: boolean
  /** Weekdays closed (JS getDay(): 0=Sun … 6=Sat). Real dates prune these.
   * Absorbed by `hours` — a place declares one or the other, never both. */
  closedOn?: number[]
  /** Per-weekday hours (JS getDay order: 0=Sun … 6=Sat); null = closed that
   * day. Overrides `open`/`closedOn` when the trip has real dates; `open`
   * stays as the typical day used when no weekday is known. */
  hours?: ([number, number] | null)[]
  /** Date-specific overrides (one-off closures, seasonal late nights).
   * Beats `hours` and `open` on the named date. */
  exceptions?: PlaceException[]
  /** Consumes an entire day (Versailles) — never a normal candidate. */
  dayTrip?: boolean
  /** Schedulable variants; see Experience. */
  experiences?: Experience[]
}

export interface StartLoc {
  name: string
  area: string
  lat: number
  lon: number
  src: null
}

export interface PlaceInfo {
  price: string
  menu: string
  lang: 'FR' | 'EN'
}

export interface PlaceEntry {
  cost: string
  url: string | null
  needed: boolean
  note: string
}

export interface GraphNode {
  name: string
  hood: string
  /** Curated-day membership; archive-only places (not on any curated day) omit it. */
  day?: number
  x: number
  y: number
  v: boolean
}

export interface Plate {
  id: string
  w: number
  h: number
  caption: string
  video?: string
}

export interface DayStop {
  time: string
  timeNote?: string
  name: string
  sub: string
  desc: string
  kind: 'verified' | 'web-pin' | 'web-image'
  plates?: Plate[]
  pin?: string
  webImage?: { id: string; caption: string }
  provenance?: string
  /** Extra archive facts for the "How I know this" panel; visits/last are parsed from `provenance`. */
  prov?: { range?: string; archive?: string; walkNote?: string }
  transitAfter?: { min: number; measured: boolean }
}

export interface FinishedDay {
  index: number
  title: string
  verifiedLabel: string
  stops: DayStop[]
}

/** Presentation for a place when a builder-committed day renders as a seamless day page. */
export interface PlaceMedia {
  sub: string
  desc: string
  plates?: Plate[]
  webImage?: { id: string; caption: string }
  pin?: string
  prov?: DayStop['prov']
}

export interface Hood {
  id: string
  kicker: string
  days: number[]
  title: string
  body: string
  places: string
  image: string
}

export interface City {
  id: string
  name: string
  tagline: string
  hero: { title: string; body: string; stats: string[] }
  /** Where each day begins, and the copy describing it. */
  start: StartLoc
  startLabel: string
  homeBase: string
  dayStart: number
  dayEnd: number
  places: Place[]
  info: Record<string, PlaceInfo>
  entry: Record<string, PlaceEntry>
  nodes: GraphNode[]
  hoodOrder: string[]
  hoods: Hood[]
  curatedDays: FinishedDay[]
  media: Record<string, PlaceMedia>
  /** Maps slot ids to archive filenames in `public/media/<id>/`. Slots without
   * an entry fall back to the `<slot-id>.jpg` convention, then the placeholder. */
  slotFiles?: Record<string, { img?: string; video?: string }>
  /** Real capture dates ('YYYY-MM') per archive filename — generated by
   * scripts/extract-dates.sh from EXIF/QuickTime metadata. */
  mediaDates?: Record<string, string>
}
