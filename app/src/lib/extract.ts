import type { City, Pace, Theme } from '../cities/types'

/** A concrete ask pulled from the brief — "save the Seine cruise for the
 * last night" — matched to a real catalog place, honored by the engine. */
export interface ExtractedRequest {
  placeId: string
  kind: 'include' | 'avoid'
  /** Which day it belongs to; omitted = any day. */
  day?: 'first' | 'last' | number
  /** When in the day; omitted = whenever it fits. */
  slot?: 'morning' | 'afternoon' | 'evening'
}

/** What the LLM may extract from a free-text trip brief. The LLM interprets;
 * the deterministic engine schedules — extraction only ever produces *inputs*
 * (weights, interests, pace), never stops or times. Stored in trip state so
 * regeneration is reproducible without another API call. */
export interface ExtractedPrefs {
  /** Interests from the fixed vocabulary — gates like the Versailles day read these. */
  interests: string[]
  /** Per-theme lean, −1..1. Negative is a real dislike, not absence of interest. */
  themeWeights: Partial<Record<Theme, number>>
  /** Only set when the brief clearly implies one. */
  pace: Pace | null
  /** Concrete asks — pinned or avoided places, validated against the catalog. */
  requests: ExtractedRequest[]
  /** One-line readback shown to the user for correction. */
  summary: string
}

export const INTEREST_VOCAB = [
  'Museums',
  'Architecture',
  'Food & markets',
  'Neighborhoods',
  'History',
  'Art',
  'Views',
  'Nightlife',
] as const

export const THEMES: Theme[] = ['monumental', 'historic', 'artistic', 'neighborhood', 'everyday', 'afterdark']
const PACES = ['gentle', 'balanced', 'full']

/** Never trust model output structurally: clamp, filter, truncate. The server
 * already requests a strict schema; this is the client-side belt to that.
 * `validPlaceIds` gates requests — an id not in the catalog is dropped. */
export function sanitizeExtracted(raw: unknown, validPlaceIds?: ReadonlySet<string>): ExtractedPrefs | null {
  if (typeof raw !== 'object' || raw === null) return null
  const r = raw as Record<string, unknown>
  const interests = Array.isArray(r.interests)
    ? r.interests.filter((i): i is string => typeof i === 'string' && (INTEREST_VOCAB as readonly string[]).includes(i))
    : []
  const themeWeights: Partial<Record<Theme, number>> = {}
  if (typeof r.themeWeights === 'object' && r.themeWeights !== null) {
    for (const [k, v] of Object.entries(r.themeWeights as Record<string, unknown>)) {
      if (THEMES.includes(k as Theme) && typeof v === 'number' && Number.isFinite(v) && v !== 0) {
        themeWeights[k as Theme] = Math.max(-1, Math.min(1, v))
      }
    }
  }
  const pace = typeof r.pace === 'string' && PACES.includes(r.pace) ? (r.pace as Pace) : null
  const requests: ExtractedRequest[] = []
  if (Array.isArray(r.requests) && validPlaceIds) {
    for (const q of r.requests.slice(0, 4)) {
      if (typeof q !== 'object' || q === null) continue
      const { placeId, kind, day, slot } = q as Record<string, unknown>
      if (typeof placeId !== 'string' || !validPlaceIds.has(placeId)) continue
      if (kind !== 'include' && kind !== 'avoid') continue
      const out: ExtractedRequest = { placeId, kind }
      if (day === 'first' || day === 'last') out.day = day
      else if (typeof day === 'number' && Number.isInteger(day) && day >= 1 && day <= 7) out.day = day
      if (slot === 'morning' || slot === 'afternoon' || slot === 'evening') out.slot = slot
      requests.push(out)
    }
  }
  const summary = typeof r.summary === 'string' ? r.summary.slice(0, 280) : ''
  if (interests.length === 0 && Object.keys(themeWeights).length === 0 && !pace && requests.length === 0) return null
  return { interests, themeWeights, pace, requests, summary }
}

/** Call the extraction endpoint. The catalog rides along so concrete asks
 * ("save the bateaux mouches for the last night") resolve to real place ids —
 * and only real ones survive the sanitizer. Throws on failure; callers decide
 * how quietly to handle it. */
export async function extractPreferences(brief: string, city: City): Promise<ExtractedPrefs> {
  const res = await fetch('/api/extract-preferences', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      brief: brief.slice(0, 1200),
      city: city.name,
      places: city.places.map((p) => ({ id: p.id, name: p.name })),
    }),
  })
  if (!res.ok) throw new Error(`extraction unavailable (${res.status})`)
  const parsed = sanitizeExtracted(await res.json(), new Set(city.places.map((p) => p.id)))
  if (!parsed) throw new Error('nothing usable in the brief')
  return parsed
}
