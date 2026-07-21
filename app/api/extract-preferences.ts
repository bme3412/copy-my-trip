/**
 * Serverless preference extraction — the one narrow LLM job in the planner:
 * read a free-text trip brief, return structured *inputs* for the
 * deterministic engine (theme weights, interests, pace). It never invents
 * stops, times, or hours; feasibility stays in code.
 *
 * Runs as a Vercel function so the Anthropic key stays server-side
 * (ANTHROPIC_API_KEY in the Vercel env / .env.local for `vercel dev` —
 * never VITE_-prefixed, which would bundle it into the client).
 */
import Anthropic from '@anthropic-ai/sdk'

const INTEREST_VOCAB = ['Museums', 'Architecture', 'Food & markets', 'Neighborhoods', 'History', 'Art', 'Views', 'Nightlife']
const THEMES = ['monumental', 'historic', 'artistic', 'neighborhood', 'everyday', 'afterdark']

const SCHEMA = {
  type: 'object',
  properties: {
    interests: { type: 'array', items: { type: 'string', enum: INTEREST_VOCAB } },
    themeWeights: {
      type: 'object',
      properties: Object.fromEntries(THEMES.map((t) => [t, { type: 'number' }])),
      additionalProperties: false,
    },
    pace: { type: ['string', 'null'], enum: ['gentle', 'balanced', 'full', null] },
    summary: { type: 'string' },
  },
  required: ['interests', 'themeWeights', 'pace', 'summary'],
  additionalProperties: false,
}

const SYSTEM = `You extract travel preferences from a first-time visitor's free-text trip brief for a day-by-day city planner. You do NOT plan anything — a deterministic engine schedules; you only produce its inputs.

Rules:
- interests: only values from the fixed vocabulary, only when the brief clearly supports them.
- themeWeights: a lean per theme, -1..1. The themes mean: monumental (icons, landmarks), historic (old Paris, churches, history), artistic (museums, galleries, art), neighborhood (streets, local quarters, wandering), everyday (food, markets, cafés, ordinary life), afterdark (evenings, views at night, going out). Map explicit dislikes to NEGATIVE weights — "we hate crowds and big monuments" is monumental: -0.6, not an omission. Omit themes the brief says nothing about. Be conservative: ±0.3 for a mention, ±0.6 for enthusiasm or clear aversion, ±1 only for emphatic statements.
- pace: only when clearly implied ("we like slow mornings" → gentle; "we want to see everything" → full). Otherwise null.
- summary: one warm sentence reading the brief back, so the traveler can correct you. No advice, no itinerary.
- Never infer beyond what's written. An unmentioned preference is not a preference.`

export default async function handler(req: { method?: string; body?: unknown }, res: {
  status: (code: number) => { json: (body: unknown) => void; send: (body: string) => void }
  setHeader: (k: string, v: string) => void
}) {
  if (req.method !== 'POST') {
    res.status(405).send('POST only')
    return
  }
  const body = (typeof req.body === 'string' ? JSON.parse(req.body) : req.body) as { brief?: unknown; city?: unknown }
  const brief = typeof body?.brief === 'string' ? body.brief.trim().slice(0, 1200) : ''
  const city = typeof body?.city === 'string' ? body.city.slice(0, 40) : 'the city'
  if (brief.length < 8) {
    res.status(400).send('brief too short')
    return
  }

  try {
    const client = new Anthropic()
    const response = await client.messages.create({
      model: 'claude-opus-4-8',
      max_tokens: 1000,
      system: SYSTEM,
      output_config: { format: { type: 'json_schema', schema: SCHEMA } },
      messages: [{ role: 'user', content: `Trip brief for ${city}:\n\n${brief}` }],
    })
    const text = response.content.find((b) => b.type === 'text')
    if (!text || text.type !== 'text') {
      res.status(502).send('no output')
      return
    }
    res.setHeader('Content-Type', 'application/json')
    res.status(200).json(JSON.parse(text.text))
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'extraction error'
    res.status(502).send(msg.slice(0, 200))
  }
}
