/**
 * Serverless day narration — the LLM's second narrow job (explanation, per
 * build-plan/01-principles.md): turn the engine's computed FACTS about a
 * built day into 2–3 sentences of curator-voice prose. It may only restate
 * the facts it is given; it never invents places, hours, or claims. The
 * client always has the deterministic deck as instant render and fallback.
 */
import Anthropic from '@anthropic-ai/sdk'

const SYSTEM = `You write the short introductory paragraph for one day of a Paris/Rome day-by-day itinerary, in the measured editorial voice of a traveler who has walked these streets for years: warm but precise, no exclamation marks, no advice ("be sure to", "don't miss"), no hype adjectives (stunning, amazing, must-see).

You will receive structured facts: the day's stops in order (with times, meals, neighbourhoods), the date, sunset and golden hour, notable closures the day works around, and how the day ends.

Rules:
- 2–3 sentences, one paragraph, ≤ 90 words.
- Use ONLY the provided facts. Never invent a place, a time, an opening hour, or a historical claim. You may omit facts; you may not add any.
- Weave in the date/light naturally when it matters (a slot set for golden hour, a day that ends before dusk, a closure that shaped the route).
- Refer to places by their given names; times in 24h as given.
- Return the paragraph only — no preamble, no quotes.`

export default async function handler(req: { method?: string; body?: unknown }, res: {
  status: (code: number) => { json: (body: unknown) => void; send: (body: string) => void }
  setHeader: (k: string, v: string) => void
}) {
  if (req.method !== 'POST') {
    res.status(405).send('POST only')
    return
  }
  const body = (typeof req.body === 'string' ? JSON.parse(req.body) : req.body) as Record<string, unknown>
  const facts = body?.facts
  if (typeof facts !== 'object' || facts === null) {
    res.status(400).send('facts required')
    return
  }
  const payload = JSON.stringify({ city: body.city, date: body.date, title: body.title, purpose: body.purpose, facts }).slice(0, 6000)

  try {
    const client = new Anthropic()
    const response = await client.messages.create({
      model: 'claude-opus-4-8',
      max_tokens: 400,
      system: SYSTEM,
      messages: [{ role: 'user', content: `Facts for the day:\n${payload}` }],
    })
    const text = response.content.find((b) => b.type === 'text')
    if (!text || text.type !== 'text') {
      res.status(502).send('no output')
      return
    }
    res.setHeader('Content-Type', 'application/json')
    res.status(200).json({ narration: text.text.trim().slice(0, 700) })
  } catch (err) {
    res.status(502).send((err instanceof Error ? err.message : 'narration error').slice(0, 200))
  }
}
