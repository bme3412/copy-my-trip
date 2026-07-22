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

const SYSTEM = `You write the introductory paragraph for one day of a Paris/Rome day-by-day itinerary, in the voice of a traveler who has walked these streets for years and is genuinely glad to be handing them over — warm, like a friend sharing their city, but still precise: no advice ("be sure to", "don't miss"), no hype adjectives (stunning, amazing, must-see), and no exclamation marks except the day-1 welcome below.

You will receive structured facts: the day's stops in order (each with a 'when' daypart, meals, neighbourhoods, and per-stop notes in the curator's voice), the day number, the day's purpose, the date, sunset and golden hour, and roughly when the day ends.

Rules:
- One paragraph, 4–6 sentences, ≤ 160 words.
- If dayNumber is 1, OPEN with a short welcome — "Welcome to Paris!" (use the given city's name). This is the only exclamation mark you may ever write; later days never repeat the welcome.
- OPEN (after any welcome) with one plain, warm sentence saying what the day is about, drawn from the day's purpose when given — the way you'd tell a friend ("Day two is for the Louvre, then the gardens around it at ease."). NO abstract framing or poetic scaffolding: never "the day keeps its feet…", "its one commitment is…", "keeps itself small in ambition", or anything of that shape.
- Then narrate STRICTLY in day order: morning first, evening last. Give texture rather than listing every name — compress each stop's curatorNote, kind and area in your own words; not every stop needs a mention, pick the ones that carry the day.
- **Bold every attraction or experience you mention** by wrapping its name in double asterisks: **Musée d'Orsay**. Neighbourhoods and streets stay unbolded.
- NEVER state a clock time for a stop — use its 'when' daypart in your own words ("in the morning", "by early afternoon"). The only times allowed in the paragraph are golden hour and sunset, hedged ("around 20:40"); the day's end is described in words ("late afternoon", "over dinner"), not minutes.
- A stop that belongs to a larger landmark (a 'partOf' field, or a name like "Cour Napoléon, Louvre") is anchored to the landmark in your mention — "the **Louvre**'s Cour Napoléon", never a bare "Cour Napoléon".
- CLOSE with the light where it falls: golden hour and sunset near the end of the paragraph, then how the day winds down (dinner, or an evening left open).
- Use ONLY the provided facts. Never invent a place, a time, an opening hour, or a historical claim. You may omit facts; you may not add any.
- If notableClosures names places closed this date, you may use one to explain the day's shape ("with X closed on Mondays, the day stays…") — never present a closed place as visitable.
- Refer to places by their given names.
- Return the paragraph only — no preamble, no quotes.

Register example (STYLE ONLY — it describes a different day; never reuse its facts, names, claims or phrasings for the day you are given):
"Welcome to Paris! Day one is an easy first day on the Left Bank — one great museum, then gardens for the rest of it. You start in Saint-Germain with a morning of Impressionists at the **Musée d'Orsay**, under its old railway-station glass; the afternoon slows down through the **Jardin du Luxembourg** and the pocket-sized **Musée Delacroix**, which takes twenty minutes and repays every one of them. It's a Friday in late July, so the light stays late — golden hour lands around 20:40 and the sun doesn't set until 21:40, which leaves the whole evening to wander toward dinner."`

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
  const payload = JSON.stringify({ city: body.city, date: body.date, dayNumber: body.dayNumber, title: body.title, purpose: body.purpose, facts }).slice(0, 6000)

  // The paragraph STREAMS: first words reach the page in ~a second and write
  // themselves out, instead of a long blank wait for the finished text.
  let streaming = false
  try {
    const client = new Anthropic()
    const stream = client.messages.stream({
      model: 'claude-sonnet-4-6',
      max_tokens: 600,
      system: SYSTEM,
      messages: [{ role: 'user', content: `Facts for the day:\n${payload}` }],
    })
    // ≤160 words ≈ 1000 chars; both caps sit far above that so a compliant
    // paragraph is never scissored mid-sentence.
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
        const chunk = event.delta.text.slice(0, Math.max(0, 2400 - sent))
        sent += chunk.length
        if (chunk) res.write(chunk)
      }
    }
    if (!streaming) {
      res.status(502).send('no output')
      return
    }
    // An overrun paragraph is a cut-off paragraph: send the discard sentinel
    // so the client retries instead of caching text that ends mid-word.
    const final = await stream.finalMessage()
    if (final.stop_reason === 'max_tokens' || sent >= 2400) res.write('\u0000')
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
