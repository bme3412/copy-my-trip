import { aiAvailable } from './ai-availability'
import { contentHash } from './trips/schema'
import type { City } from '../cities/types'
import { effectiveHours, fmt, placeVariants, stopPlace, type DayState } from './planner'
import { euTzOffsetMin, sunTimes } from './sun'

/** The day intro is written by the narrator — computed facts in, curator
 * prose out. There is no template fallback: while the paragraph is being
 * written the page shows ghost lines, and without the API it shows nothing.
 * A 404 marks the endpoint gone for the session; transient failures retry. */

let unavailable = false
export const narrationUnavailable = () => !aiAvailable || unavailable

/** Cache key: the narration belongs to exactly this sequence at these times.
 * The version prefix retires narrations written under an older prompt or a
 * truncating token cap — bump it and every stored day rewrites itself. */
const NARRATION_VERSION = 'v4'
export function dayContentKey(day: DayState, context: unknown = null): string {
  return `${NARRATION_VERSION}:` + contentHash({day, context})
}

const shortName = (name: string) => name.split(',')[0].split(' — ')[0]

/** First-visit icons (with any of their variants) closed on this date and not
 * on the day — the fact that explains the day's shape. */
function notableClosures(city: City, day: DayState, date: string, weekday: number): string[] {
  const visited = new Set(day.committed.map((s) => s.id))
  const names: string[] = []
  for (const p of city.places) {
    if (p.rank !== 1 || visited.has(p.id)) continue
    for (const v of placeVariants(p)) {
      if (effectiveHours(v, date, weekday) === null) {
        names.push(shortName(v.name))
        break
      }
    }
  }
  return [...new Set(names)].slice(0, 2)
}

/** Clock → the arc of the day. The narrator never sees exact stop times, so
 * it can't quote "9:19" — it says "in the morning". */
function daypart(m: number): string {
  if (m < 10 * 60) return 'early morning'
  if (m < 12 * 60) return 'late morning'
  if (m < 14 * 60) return 'midday'
  if (m < 16 * 60) return 'early afternoon'
  if (m < 18 * 60) return 'late afternoon'
  if (m < 20 * 60) return 'early evening'
  return 'evening'
}

/** Everything the narrator may say, and nothing it may not. */
export function buildDayFacts(city: City, day: DayState, date: string, weekday: number, title: string, dayNumber: number, purpose?: string) {
  const sun = sunTimes(city.start.lat, city.start.lon, date, euTzOffsetMin(date))
  const last = day.committed[day.committed.length - 1]
  return {
    city: city.name,
    date,
    dayNumber,
    title,
    purpose,
    facts: {
      stops: day.committed.map((c) => {
        const parent = city.places.find((p) => p.id === c.id)
        return {
          name: c.name,
          // An experience of a larger landmark carries the landmark's name.
          partOf: c.experienceId && parent && parent.name !== c.name ? parent.name : undefined,
          when: daypart(c.timeIn),
          minutes: c.dur,
          meal: c.meal,
          hood: stopPlace(city, c)?.hood,
          area: c.area,
          kind: stopPlace(city, c)?.label,
          fromArchive: c.src === 'verified',
          // Archive curator notes AND authored web-tier editorial copy — the
          // narration may only compress what's here, never add to it.
          curatorNote: parent?.experiences?.find(e => e.id === c.experienceId)?.note ?? (c.experienceId && c.src === 'web' ? undefined : city.media[c.id]?.desc),
        }
      }),
      notableClosures: notableClosures(city, day, date, weekday),
      sunset: fmt(sun.sunset),
      goldenHourFrom: fmt(sun.sunset - 60),
      walkingMinutes: day.committed.filter((c) => c.travelMode === 'walk').reduce((a, c) => a + c.travelMin, 0),
      metroHops: day.committed.filter((c) => c.travelMode === 'metro').length,
      // Rounded to the quarter-hour — the close of a day is a mood, not a minute.
      endsAround: last ? fmt(Math.round((last.timeIn + last.dur) / 15) * 15) : undefined,
    },
  }
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms))

// ── Fetch ownership lives HERE, not in the component ──
// React StrictMode double-mounts effects in dev: a component-owned fetch gets
// cancelled by the first unmount while the remount sees "already attempted"
// and never refetches. Module-level dedupe means both passes share one fetch,
// its chunks fan out to whoever is listening, and its result survives.

const inflight = new Map<string, Promise<string | null>>()
const finished = new Map<string, string | null>()
const partials = new Map<string, string>()
const listeners = new Map<string, Set<(t: string) => void>>()

/** Subscribe to a narration's streaming text; replays the partial so far.
 * Returns the unsubscribe. */
export function onNarrationChunk(key: string, cb: (t: string) => void): () => void {
  let set = listeners.get(key)
  if (!set) listeners.set(key, (set = new Set()))
  set.add(cb)
  const partial = partials.get(key)
  if (partial) cb(partial)
  return () => {
    set!.delete(cb)
  }
}

/** A finished narration (or null for a final failure); undefined = not done. */
export function narrationResult(key: string): string | null | undefined {
  return finished.get(key)
}

/** Fetch a day's narration exactly once per content key, no matter how many
 * effects ask. Chunks stream to subscribers; the settled result is memoized. */
export function ensureNarration(key: string, payload: unknown): Promise<string | null> {
  const settled = finished.get(key)
  if (settled !== undefined) return Promise.resolve(settled)
  let p = inflight.get(key)
  if (!p) {
    p = fetchNarration(payload, (t) => {
      partials.set(key, t)
      for (const cb of listeners.get(key) ?? []) cb(t)
    }).then((text) => {
      finished.set(key, text)
      inflight.delete(key)
      partials.delete(key)
      return text
    })
    inflight.set(key, p)
  }
  return p
}

/** Up to 3 attempts with backoff. The narration STREAMS — `onChunk` receives
 * the text so far as it's written, so the paragraph appears within a second
 * and types itself out. A NUL byte mid-stream means the server lost the
 * model partway: discard and retry rather than keep a cut-off paragraph.
 * Returns null when the narration genuinely can't be had — the caller
 * renders nothing rather than a template. */
export async function fetchNarration(payload: unknown, onChunk?: (textSoFar: string) => void): Promise<string | null> {
  if (unavailable) return null
  if (!aiAvailable) return null
  for (let attempt = 0; attempt < 3; attempt++) {
    // A hard ceiling per attempt: a stuck connection aborts instead of
    // hanging the page — 20s to finish, and the stream resets the clock
    // by finishing well inside it.
    const abort = new AbortController()
    const timer = setTimeout(() => abort.abort(), 20_000)
    try {
      const r = await fetch('/api/narrate-day', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: abort.signal,
      })
      if (r.status === 404 || r.status === 503) {
        unavailable = true
        console.info('[narrate] endpoint unavailable — run `npm run dev:full` for narrated days')
        return null
      }
      if (r.ok && r.body) {
        const reader = r.body.getReader()
        const decoder = new TextDecoder()
        let text = ''
        let broken = false
        for (;;) {
          const { done, value } = await reader.read()
          if (done) break
          text += decoder.decode(value, { stream: true })
          if (text.includes('\u0000')) {
            broken = true
            break
          }
          onChunk?.(text)
        }
        if (!broken && text.trim().length > 0) {
          clearTimeout(timer)
          return text.trim()
        }
      }
    } catch {
      /* network hiccup or timeout — retry below */
    } finally {
      clearTimeout(timer)
    }
    onChunk?.('') // clear any partial draft before the retry
    await wait(1000)
  }
  return null
}
