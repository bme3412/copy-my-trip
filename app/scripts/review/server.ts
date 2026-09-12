import { createServer, type IncomingMessage } from 'node:http'
import { readFileSync } from 'node:fs'
import { join, extname } from 'node:path'
import { randomBytes } from 'node:crypto'
import { emptyReview, integrationRequirements, metrics, object, validateProposal, validateReview, type Run } from './core'
import { APP, assetPath, catalogHash, save } from './store'
import { validateVerification } from './verify'

async function body(req: IncomingMessage): Promise<unknown> {
  let bytes = 0; const chunks: Buffer[] = []
  for await (const chunk of req) {
    bytes += chunk.length
    if (bytes > 128_000) throw new Error('Request too large')
    chunks.push(chunk)
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8'))
}
export function acceptedExport(run: Run) {
  const changes = run.snapshots.flatMap(snapshot => {
    const r = run.places[snapshot.id]
    if (!r.proposal || !r.review) return []
    const proposal = validateProposal(r.proposal, snapshot, run.createdAt)
    const review = validateReview(r.review, proposal)
    const audit = r.verification?.status === 'complete' && r.verification.proposal ? validateVerification(r.verification.proposal, snapshot, proposal, r.verification.startedAt ?? run.createdAt) : undefined
    if (r.reviewOrigin === 'automated' && !audit) throw new Error('Automated decisions require completed verification evidence')
    if (r.reviewOrigin === 'automated') review.decisions.forEach((d, i) => {
      if (d.decision === 'accepted' && (audit!.decisions[i].decision !== 'accepted' || d.claims.some(v => v !== 'supported'))) throw new Error('Automated acceptance disagrees with verifier evidence')
    })
    return proposal.changes.flatMap((change, i) => review.decisions[i].decision === 'accepted' ? [{ placeId: snapshot.id, change,
      sources: proposal.sources.filter(s => change.claims.some(c => c.sourceIds.includes(s.id))), review: review.decisions[i], reviewOrigin: r.reviewOrigin ?? 'human',
      verification: audit ? { model: r.verification!.model, sessionId: r.verification!.sessionId ?? null, version: r.verification!.version, proposalHash: r.verification!.proposalHash, decision: audit.decisions[i], sources: audit.sources.filter(s => audit.decisions[i].claims.some(c => c.sourceIds.includes(s.id))) } : null,
      integrationRequirements: integrationRequirements(snapshot, proposal) }] : [])
  })
  return { kind: run.kind, published: false, notice: 'Review artifact only. No catalog files were modified. Requires a separate editorial change and full city validation.', runId: run.id, catalogHash: run.catalogHash, changes, metrics: metrics(run) }
}

export function createReviewServer(run: Run, persist: (r: Run) => void = save, currentHash: () => string = catalogHash) {
  const token = randomBytes(24).toString('hex')
  const payload = () => ({ run, metrics: metrics(run), catalogCurrent: currentHash() === run.catalogHash,
    integrationRequirements: Object.fromEntries(run.snapshots.map(s => [s.id, run.places[s.id].proposal ? integrationRequirements(s, run.places[s.id].proposal!) : []])) })
  const server = createServer(async (req, res) => {
    const address = server.address()
    const host = typeof address === 'object' && address ? `127.0.0.1:${address.port}` : ''
    const origin = `http://${host}`
    const nonce = randomBytes(18).toString('base64')
    res.setHeader('Cache-Control', 'no-store')
    res.setHeader('X-Content-Type-Options', 'nosniff')
    res.setHeader('Referrer-Policy', 'no-referrer')
    res.setHeader('Content-Security-Policy', `default-src 'none'; script-src 'nonce-${nonce}'; style-src 'unsafe-inline'; img-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'`)
    const json = (value: unknown, status = 200) => { res.statusCode = status; res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(value)) }
    if (req.headers.host !== host) { json({ error: 'Unrecognized host' }, 403); return }
    try {
      const url = new URL(req.url ?? '/', origin)
      if (req.method === 'GET' && url.pathname === '/') {
        const html = readFileSync(join(APP, 'scripts/review/review.html'), 'utf8')
        res.setHeader('Content-Type', 'text/html; charset=utf-8')
        res.end(html.replaceAll('__NONCE__', nonce).replace('__TOKEN__', token)); return
      }
      if (req.method === 'GET' && url.pathname === '/asset') {
        const file = url.searchParams.get('file') ?? ''
        if (!/\.jpe?g$/i.test(extname(file))) { json({ error: 'Only selected JPEG previews are available' }, 400); return }
        const path = assetPath(run, file)
        res.setHeader('Content-Type', 'image/jpeg'); res.end(readFileSync(path)); return
      }
      if (req.headers['x-review-token'] !== token) { json({ error: 'Review token required' }, 403); return }
      if (req.method === 'GET' && url.pathname === '/api/run') { json(payload()); return }
      if (req.method === 'GET' && url.pathname === '/api/export') {
        if (currentHash() !== run.catalogHash) throw new Error('Catalog changed since this snapshot; prepare a fresh review before exporting')
        json(acceptedExport(run)); return
      }
      if (req.method !== 'POST' || !['/api/review', '/api/cost'].includes(url.pathname)) { json({ error: 'Not found' }, 404); return }
      if (req.headers.origin !== origin || req.headers['content-type'] !== 'application/json') { json({ error: 'Same-origin JSON required' }, 403); return }
      const input = object(await body(req))
      if (input.revision !== run.revision) { json({ error: 'This page is stale. Reload before saving.' }, 409); return }
      if (url.pathname === '/api/review') {
        if (typeof input.placeId !== 'string' || !Object.hasOwn(run.places, input.placeId)) throw new Error('Unknown place')
        const state = run.places[input.placeId]
        if (state.status !== 'complete' || !state.proposal) throw new Error('Research must complete before review')
        const review = validateReview(input.review, state.proposal)
        if (currentHash() !== run.catalogHash && review.decisions.some(d => d.decision === 'accepted')) throw new Error('Catalog changed since the snapshot; acceptance is blocked')
        state.review = review
        state.reviewOrigin = state.reviewOrigin === 'automated' || state.reviewOrigin === 'mixed' ? 'mixed' : 'human'
      } else {
        if (typeof input.totalUsd !== 'number' || !Number.isFinite(input.totalUsd) || input.totalUsd < 0 || input.totalUsd > 10000 || typeof input.evidence !== 'string' || !input.evidence.trim() || input.evidence.length > 2000) throw new Error('Enter a nonnegative reconciled total and billing evidence, including model and search charges')
        run.cost = { totalUsd: input.totalUsd, evidence: input.evidence, recordedAt: new Date().toISOString() }
      }
      persist(run); json(payload())
    } catch (err) { json({ error: err instanceof Error ? err.message : 'Request failed' }, 400) }
  })
  return { server, token }
}
export { emptyReview }
