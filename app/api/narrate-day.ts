/**
 * Serverless day narration — the LLM's second narrow job (explanation, per
 * build-plan/01-principles.md): turn the engine's computed FACTS about a
 * built day into one paragraph of curator-voice prose. It may only restate
 * the facts it is given; it never invents places, hours, or claims. This IS
 * the day's intro — there is no template fallback; the client shows ghost
 * lines while it's written and nothing if it can't be.
 */
import Anthropic from '@anthropic-ai/sdk'

// Without this, Vercel buffers the whole Node-function response and the
// "stream" arrives as one late blob. Required in production; honored by dev.
export const config = { supportsResponseStreaming: true }

const SYSTEM = `You write the introductory paragraph for one day of a Paris/Rome day-by-day itinerary, in the measured editorial voice of a traveler who has walked these streets for years: warm but precise, no exclamation marks, no advice ("be sure to", "don't miss"), no hype adjectives (stunning, amazing, must-see).

You will receive structured facts: the day's stops in order (with times, meals, neighbourhoods, and per-stop notes in the curator's voice), the day's purpose, the date, sunset and golden hour, and how the day ends.

Rules:
- One paragraph, 4–6 sentences, ≤ 160 words.
- OPEN with a thesis line that frames the day's shape — what it keeps close, what its one big commitment is. Lean on the day's purpose when given; restyle it, don't quote it.
- Then narrate STRICTLY in day order: morning first, evening last. Give texture rather than listing every name — compress each stop's curatorNote, kind and area in your own words; not every stop needs a mention, pick the ones that carry the day.
- CLOSE with the light where it falls: golden hour and sunset near the end of the paragraph, then how the day winds down (dinner, or an evening left open).
- Use ONLY the provided facts. Never invent a place, a time, an opening hour, or a historical claim. You may omit facts; you may not add any.
- If notableClosures names places closed this date, you may use one to explain the day's shape ("with X closed on Mondays, the day stays…") — never present a closed place as visitable.
- Refer to places by their given names; times in 24h as given.
- Return the paragraph only — no preamble, no quotes.

Register example (STYLE ONLY — it describes a different day; never reuse its facts, names, claims or phrasings for the day you are given):
"Ease into Paris before the crowds do — day one keeps its feet by the Seine and its head in one great museum. You start on the Left Bank in Saint-Germain, where the Musée d'Orsay opens the whole trip with a morning of Impressionists under its old railway-station glass; then the afternoon slackens through the Jardin du Luxembourg and the pocket-sized Musée Delacroix. It's a Friday in late-July, so the light stays late: golden hour lands around 20:40 and the sun doesn't set until 21:40 — leaving the evening free to wander to dinner, which closes the day around 21:09."`

export default async function handler(req: { method?: string; body?: unknown }, res: {
  statusCode: number
  status: (code: number) => { json: (body: unknown) => void; send: (body: string) => void }
  setHeader: (k: string, v: string) => void
  write: (chunk: string) => void
  end: () => void
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

  // The paragraph STREAMS: first words reach the page in ~a second and write
  // themselves out, instead of a long blank wait for the finished text.
  let streaming = false
  try {
    const client = new Anthropic()
    const stream = client.messages.stream({
      model: 'claude-sonnet-4-6',
      max_tokens: 300,
      system: SYSTEM,
      messages: [{ role: 'user', content: `Facts for the day:\n${payload}` }],
    })
    // ≤160 words ≈ 1000 chars — the cap is a guardrail, not a scissor.
    let sent = 0
    for await (const event of stream) {
      if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
        if (!streaming) {
          streaming = true
          res.statusCode = 200
          res.setHeader('Content-Type', 'text/plain; charset=utf-8')
          res.setHeader('Cache-Control', 'no-store')
          // Compression middleware buffers streams — refuse it explicitly.
          res.setHeader('Content-Encoding', 'identity')
          res.setHeader('X-Accel-Buffering', 'no')
        }
        const chunk = event.delta.text.slice(0, Math.max(0, 1200 - sent))
        sent += chunk.length
        if (chunk) res.write(chunk)
      }
    }
    if (!streaming) {
      res.status(502).send('no output')
      return
    }
    res.end()
  } catch (err) {
    if (streaming) {
      // Mid-stream failure: a NUL sentinel tells the client to discard and retry
      // rather than cache a paragraph cut off mid-sentence.
      res.write('\u0000')
      res.end()
      return
    }
    res.status(502).send((err instanceof Error ? err.message : 'narration error').slice(0, 200))
  }
}
