import type { Pace, Theme } from '../cities/types'

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
 * already requests a strict schema; this is the client-side belt to that. */
export function sanitizeExtracted(raw: unknown): ExtractedPrefs | null {
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
  const summary = typeof r.summary === 'string' ? r.summary.slice(0, 280) : ''
  if (interests.length === 0 && Object.keys(themeWeights).length === 0 && !pace) return null
  return { interests, themeWeights, pace, summary }
}

/** Call the extraction endpoint. Throws with a readable message on failure —
 * including the local-dev case where no API server is running. */
export async function extractPreferences(brief: string, cityName: string): Promise<ExtractedPrefs> {
  const res = await fetch('/api/extract-preferences', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ brief: brief.slice(0, 1200), city: cityName }),
  })
  if (!res.ok) {
    if (res.status === 404) throw new Error('The extraction API isn’t running — use `vercel dev` locally, or the deployed app.')
    const detail = await res.text().catch(() => '')
    throw new Error(`Extraction failed (${res.status})${detail ? `: ${detail.slice(0, 120)}` : ''}`)
  }
  const parsed = sanitizeExtracted(await res.json())
  if (!parsed) throw new Error('Couldn’t read anything usable from that brief — try being more specific.')
  return parsed
}
