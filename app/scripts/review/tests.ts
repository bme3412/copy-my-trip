import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { AgentsClient, requestBody, reviewPlace } from './agent'
import { emptyReview, integrationRequirements, metrics, prepareRetry, validateProposal, validateReview, type JsonRecord, type Proposal } from './core'
import { fixture } from './cli'
import { prepare, catalogHash } from './store'
import { acceptedExport, createReviewServer } from './server'

const sample = () => fixture(prepare('fixture'))
test('batch freezes exactly twenty distinct records, equally split by provenance', () => {
  const run = prepare(); assert.equal(run.snapshots.length, 20)
  assert.equal(new Set(run.snapshots.map(s => s.id)).size, 20)
  assert.equal(run.snapshots.filter(s => s.place.src === 'verified').length, 10)
  assert.equal(run.catalogHash, catalogHash())
  assert.equal(metrics(run).factualAccuracy, null); assert.equal(metrics(run).totalCostUsd, null)
})
test('fixture status is explicit and never silently upgrades a live run', () => {
  assert.throws(() => fixture(prepare()), /Fixtures cannot/)
  assert.equal(sample().kind, 'fixture')
})
test('proposal validation rejects provenance edits, fabricated citations, stale before values, and wrong experience scope', () => {
  const run = sample(); const s = run.snapshots[0]; const p = run.places[s.id].proposal!
  const bad = (mutate: (p: Proposal) => void, pattern: RegExp) => { const copy = structuredClone(p); mutate(copy); assert.throws(() => validateProposal(copy, s, run.createdAt), pattern) }
  bad(p => { (p.changes[0] as unknown as JsonRecord).field = 'place.src' }, /allowlist/)
  bad(p => { p.changes[0].beforeJson = '"stale"' }, /frozen catalog/)
  bad(p => { p.sources[0].url = 'https://louvre.fr.evil.example/' }, /allowed source domain/)
  bad(p => { p.sources[0].url = 'javascript:alert(1)' }, /HTTPS/)
  bad(p => { p.sources[0].url = 'https://user:password@louvre.fr/' }, /HTTPS/)
  bad(p => { p.changes[0].claims[0].sourceIds = ['invented'] }, /missing source/)
  bad(p => { p.changes[0].experienceId = 'interior' }, /only support place/)
  bad(p => { p.sources[0].accessedAt = '2020-01-01T00:00:00Z' }, /retrieval date/)
  bad(p => { p.changes[0].afterJson = p.changes[0].beforeJson }, /actually change/)
  bad(p => { p.outcome = 'no_change' }, /disagree/)
  bad(p => { (p as unknown as JsonRecord).publish = true }, /unexpected/)
})
test('schema distinguishes unsupported hours from real valid changes', () => {
  const run = sample(); const s = run.snapshots[0]; const p = structuredClone(run.places[s.id].proposal!)
  p.changes[0] = { ...p.changes[0], field: 'place.open', beforeJson: JSON.stringify(s.place.open), afterJson: '[25,26]' }
  assert.throws(() => validateProposal(p, s, run.createdAt), /Invalid proposed/)
  p.changes[0].afterJson = '[9,18]'
  assert.equal(validateProposal(p, s, run.createdAt).changes[0].field, 'place.open')
})
test('acceptance requires every claim to be checked and supported', () => {
  const p = sample().places.louvre.proposal!; const review = emptyReview(p)
  review.decisions[0].decision = 'accepted'
  assert.throws(() => validateReview(review, p), /every claim/)
  review.decisions[0].claims[0] = 'unsupported'; assert.throws(() => validateReview(review, p), /every claim/)
  review.decisions[0].claims[0] = 'supported'; assert.equal(validateReview(review, p).decisions[0].decision, 'accepted')
  review.baselineSeconds = 120; assert.throws(() => validateReview(review, p), /baseline method/)
})
test('metrics do not count pending/unclear claims as accurate or invent time/cost measurements', () => {
  const run = sample(); const state = run.places.louvre
  assert.equal(metrics(run).factualAccuracy, null)
  state.review = emptyReview(state.proposal!)
  state.review.decisions[0] = { decision: 'accepted', claims: ['supported'], note: 'fixture' }
  state.review.seconds = 30; state.review.reviewed = true
  assert.equal(metrics(run).timeSavedSeconds, null); assert.equal(metrics(run).costPerAcceptedChangeUsd, null)
  state.review.baselineSeconds = 120; state.review.baselineNote = 'Independent timed comparison'
  run.cost = { totalUsd: 2, evidence: 'fixture full-run total', recordedAt: run.createdAt }
  const m = metrics(run)
  assert.equal(m.timeSavedSeconds, 90); assert.equal(m.pairedRecords, 1); assert.equal(m.costPerAcceptedChangeUsd, 2)
  assert.equal(m.factualAccuracy, 1); assert.equal(m.adjudicationCoverage, 1 / 20)
  state.review.seconds = 0; assert.equal(metrics(run).timeSavedSeconds, null)
  state.review.decisions[0] = { decision: 'rejected', claims: ['unclear'], note: 'fixture' }
  assert.equal(metrics(run).factualAccuracy, null); assert.equal(metrics(run).costPerAcceptedChangeUsd, null)
})
test('request uses actual Agents API web search, narrow function tools and no writable sandbox', () => {
  const run = prepare(); const req = requestBody(run, run.snapshots[0])
  assert.equal(req.environment.type, 'none')
  assert.deepEqual(req.agent.tools[0], { type: 'web_search', mode: 'live', allowed_domains: ['louvre.fr'] })
  assert.equal(req.agent.tools[1].name, 'submit_place_review')
  assert.match(req.agent.instructions, /courtyard/)
  assert.equal(JSON.stringify(req).includes('OPENAI_API_KEY'), false)
})
test('drafts flag incomplete catalog records and dependent rate-card reconciliation', () => {
  const run = sample(), s = structuredClone(run.snapshots[0]), p = structuredClone(run.places.louvre.proposal!)
  assert.match(integrationRequirements(s, p).join(' '), /complete PlaceEntry/)
  s.media = {}; p.changes[0].field = 'media.desc'
  assert.match(integrationRequirements(s, p).join(' '), /complete media record/)
  s.entry = { rates: [{ label: 'full', price: '€10' }] }; p.changes[0].field = 'entry.cost'
  assert.match(integrationRequirements(s, p).join(' '), /structured rates and asOf/)
})
test('REST transport sets beta header, times out requests, and hides raw provider errors', async () => {
  let seen: RequestInit | undefined
  const transport = (async (_input: unknown, init: RequestInit) => { seen = init; return new Response('{"id":"sess_fixture"}', { status: 200 }) }) as typeof fetch
  const client = new AgentsClient('fixture-key', transport)
  await client.request('', { hello: true })
  assert.equal((seen!.headers as Record<string, string>)['OpenAI-Beta'], 'agents=v1'); assert.ok(seen!.signal)
  const failed = new AgentsClient('fixture-key', (async () => new Response('sensitive upstream body', { status: 401 })) as typeof fetch)
  await assert.rejects(() => failed.request(''), /HTTP 401/)
})
test('documented pending-call flow persists results, tolerates redelivery, and verifies a completed root turn', async () => {
  const run = prepare(); const snapshot = run.snapshots[0]
  const proposal = sample().places[snapshot.id].proposal!; proposal.sources[0].accessedAt = run.createdAt
  let polls = 0, toolReplies = 0, writes = 0
  class Mock extends AgentsClient {
    override async request(path: string, body?: unknown): Promise<JsonRecord> {
      if (path === '') return { id: 'sess_fixture' }
      if (path.endsWith('/events')) { toolReplies++; assert.ok(run.places[snapshot.id].handledCalls.call_1); assert.match(JSON.stringify(body), /input.tool_result/); return {} }
      if (path.includes('/turns')) return { data: [{ id: 'turn_1', status: 'completed', subagent_id: null }] }
      polls++
      return polls <= 2 ? { status: 'requires_action', required_actions: [{ type: 'function_call', name: 'submit_place_review', call_id: 'call_1', turn_id: 'turn_1', arguments: proposal }], usage: null } : { status: 'idle', required_actions: [], usage: { input_tokens: 12, output_tokens: 7 } }
    }
  }
  await reviewPlace(new Mock('unused'), run, snapshot, () => { writes++ }, { wait: async () => {} })
  assert.equal(run.places[snapshot.id].status, 'complete'); assert.equal(toolReplies, 2)
  assert.equal(Object.keys(run.places[snapshot.id].handledCalls).length, 1); assert.ok(writes > 2)
})
test('uncertain session creation is not automatically repeated', async () => {
  const run = prepare(); let creates = 0
  class Mock extends AgentsClient { override async request(): Promise<JsonRecord> { creates++; throw new Error('network failure') } }
  const client = new Mock('unused')
  await assert.rejects(() => reviewPlace(client, run, run.snapshots[0], () => {}), /network failure/)
  await assert.rejects(() => reviewPlace(client, run, run.snapshots[0], () => {}), /creation was uncertain/)
  assert.equal(creates, 1)
})
test('explicit retry retains evidence and charges and refuses a second retry', () => {
  const run = sample(); run.kind = 'live'
  const state = run.places.louvre
  state.status = 'failed'; state.sessionId = 'sess_previous'; state.error = 'Final turn failed'; state.usage = { input_tokens: 50 }
  run.cost = { totalUsd: 1, evidence: 'prior reconciliation', recordedAt: run.createdAt }
  prepareRetry(run, 'louvre')
  assert.equal(run.places.louvre.status, 'pending'); assert.equal(run.places.louvre.sessionId, undefined)
  assert.equal(run.places.louvre.attempts![0].sessionId, 'sess_previous'); assert.ok(run.places.louvre.attempts![0].proposal)
  assert.equal(run.cost, null); assert.equal(requestBody(run, run.snapshots[0]).metadata.attempt, '1')
  run.places.louvre.status = 'failed'; run.places.louvre.sessionId = 'sess_again'
  assert.throws(() => prepareRetry(run, 'louvre'), /only one retry/)
  run.places.louvre.sessionId = undefined; assert.throws(() => prepareRetry(run, 'louvre'), /known failed/)
})
test('timeout cancels work rather than launching another paid session', async () => {
  const run = prepare(); let clock = Date.now(); let cancelled = 0
  class Mock extends AgentsClient {
    override async request(path: string): Promise<JsonRecord> { return path === '' ? { id: 'sess_fixture' } : { status: 'in_progress', required_actions: [] } }
    override async cancel() { cancelled++ }
  }
  await assert.rejects(() => reviewPlace(new Mock('unused'), run, run.snapshots[0], () => {}, { seconds: 1, now: () => clock, wait: async () => { clock += 2000 } }), /time limit/)
  assert.equal(cancelled, 1); assert.equal(run.places.louvre.status, 'failed')
})
test('interruption cancels an active session and avoids creating new work', async () => {
  const run = prepare(); let stop = false, cancelled = 0, calls = 0
  class Mock extends AgentsClient {
    override async request(path: string): Promise<JsonRecord> { calls++; if (path === '') { stop = true; return { id: 'sess_fixture' } } return {} }
    override async cancel() { cancelled++ }
  }
  await assert.rejects(() => reviewPlace(new Mock('unused'), run, run.snapshots[0], () => {}, { shouldStop: () => stop }), /interrupted/)
  assert.equal(cancelled, 1); assert.equal(calls, 1)
  await assert.rejects(() => reviewPlace(new Mock('unused'), run, run.snapshots[1], () => {}, { shouldStop: () => true }), /before creating/)
  assert.equal(calls, 1)
})
test('local review API protects mutations, persists decisions and exports without changing catalog data', async () => {
  const before = catalogHash(); const run = sample(); let writes = 0; let current = run.catalogHash
  const { server, token } = createReviewServer(run, r => { writes++; r.revision++ }, () => current)
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
  const address = server.address(); assert.ok(address && typeof address === 'object')
  const url = `http://127.0.0.1:${address.port}`
  const headers = { 'X-Review-Token': token, 'Content-Type': 'application/json', Origin: url }
  try {
    assert.equal((await fetch(url + '/api/run')).status, 403)
    const html = await (await fetch(url)).text(); assert.match(html, /Nothing publishes automatically/)
    const review = emptyReview(run.places.louvre.proposal!)
    review.decisions[0].decision = 'accepted'
    const send = (extra = {}) => fetch(url + '/api/review', { method: 'POST', headers, body: JSON.stringify({ revision: run.revision, placeId: 'louvre', review, ...extra }) })
    assert.equal((await send()).status, 400)
    review.decisions[0].claims[0] = 'supported'
    assert.equal((await send({ revision: -1 })).status, 409)
    assert.equal((await fetch(url + '/api/review', { method: 'POST', headers: { ...headers, Origin: 'https://evil.example' }, body: '{}' })).status, 403)
    assert.equal((await send()).status, 200); assert.equal(writes, 1)
    const result = await (await fetch(url + '/api/export', { headers })).json() as { published: boolean; changes: unknown[] }
    assert.equal(result.published, false); assert.equal(result.changes.length, 1)
    current = 'changed'; assert.equal((await send()).status, 400)
    assert.equal((await fetch(url + '/api/export', { headers })).status, 400)
    assert.equal((await fetch(url + '/asset?file=../../.env.local')).status, 400)
    assert.equal(catalogHash(), before)
  } finally { server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve())) }
})
test('export rechecks acceptance and remains a review artifact, including fixture identity', () => {
  const run = sample(); run.places.louvre.review = emptyReview(run.places.louvre.proposal!)
  run.places.louvre.review.decisions[0].decision = 'accepted'
  assert.throws(() => acceptedExport(run), /every claim/)
  assert.match(readFileSync('scripts/review/review.html', 'utf8'), /textContent/)
})

// A verifier is a separate assessment, never a fabricated human ground-truth label.
import { applyVerification, validateVerification, verificationBody, verifyPlace, VERIFICATION_VERSION } from './verify'
import { hash, type VerificationReport } from './core'
const auditSample = () => {
  const run = sample(), s = run.snapshots[0], p = run.places[s.id].proposal!
  const report: VerificationReport = { placeId: s.id, proposalHash: hash(p), summary: 'Fixture independent assessment', sources: structuredClone(p.sources), unresolved: [], decisions: [{ decision: 'accepted', useful: true, scopeCorrect: true, completeClaims: true, reason: 'Fixture support', claims: [{ verdict: 'supported', reason: 'Fixture independently read evidence', sourceIds: [p.sources[0].id] }] }] }
  run.places[s.id].verification = { status: 'complete', handledCalls: {}, version: VERIFICATION_VERSION, model: run.model, proposalHash: hash(p), startedAt: run.createdAt, proposal: report }
  return { run, s, p, report }
}
test('verification requires complete ordered coverage, matching proposal, and retrieved evidence', () => {
  const { run, s, p, report } = auditSample()
  assert.equal(validateVerification(report, s, p, run.createdAt).placeId, s.id)
  const bad = (mutate: (r: VerificationReport) => void, pattern: RegExp) => { const r = structuredClone(report); mutate(r); assert.throws(() => validateVerification(r, s, p, run.createdAt), pattern) }
  bad(r => { r.proposalHash = 'other' }, /frozen proposal/)
  bad(r => { r.decisions = [] }, /count mismatch/)
  bad(r => { r.decisions[0].claims = [] }, /claim count/)
  bad(r => { r.decisions[0].claims[0].sourceIds = [] }, /retrieved evidence/)
  bad(r => { r.sources[0].url = 'https://evil.example/' }, /allowed source/)
  for (const field of ['useful', 'scopeCorrect', 'completeClaims'] as const) bad(r => { r.decisions[0][field] = false }, /Acceptance requires/)
  bad(r => { r.decisions[0].claims[0].verdict = 'unclear' }, /Acceptance requires/)
})
test('automated decisions cannot create human accuracy/time results or overwrite a saved review', () => {
  const { run, s } = auditSample(); applyVerification(run, s)
  const state = run.places[s.id]
  assert.equal(state.reviewOrigin, 'automated'); assert.equal(state.review!.decisions[0].decision, 'accepted')
  state.review!.seconds = 30; state.review!.baselineSeconds = 300; state.review!.baselineNote = 'fixture'
  assert.equal(metrics(run).factualAccuracy, null); assert.equal(metrics(run).timeSavedSeconds, null)
  assert.equal(metrics(run).evidenceSupportRate, 1)
  assert.equal(acceptedExport(run).changes[0].reviewOrigin, 'automated')
  assert.throws(() => applyVerification(run, s), /refusing to overwrite/)
  state.verification!.proposal!.decisions[0].decision = 'rejected'
  assert.throws(() => acceptedExport(run), /disagrees/)
})
test('deferral withholds publication candidates without pretending unresolved evidence is supported', () => {
  const { run, s, report } = auditSample()
  report.decisions[0].decision = 'deferred'; report.decisions[0].claims[0].verdict = 'unclear'; report.decisions[0].claims[0].sourceIds = []; report.sources = []
  applyVerification(run, s)
  assert.equal(run.places[s.id].review!.reviewed, false)
  assert.equal(metrics(run).deferred, 1); assert.equal(acceptedExport(run).changes.length, 0)
})
test('fresh verifier request excludes proposer rationale and alleged evidence', () => {
  const { run, s, p } = auditSample(); p.sources[0].evidence = 'UNTRUSTED_PROPOSER_EVIDENCE'; p.changes[0].rationale = 'PROPOSER_RATIONALE'
  const request = verificationBody(run, s, p)
  assert.equal(request.environment.type, 'none'); assert.equal(request.metadata.phase, 'verification')
  assert.equal(request.input.includes('UNTRUSTED_PROPOSER_EVIDENCE'), false); assert.equal(request.input.includes('PROPOSER_RATIONALE'), false)
  assert.match(request.agent.instructions, /REJECT wholesale generic/)
})
test('empty unresolved proposals stay unresolved without making a paid verifier call', async () => {
  const run = sample(), s = run.snapshots[0]
  run.places[s.id].proposal = { placeId: s.id, outcome: 'needs_research', summary: 'Official page blocked', sources: [], changes: [] }
  class NeverCall extends AgentsClient { override async request(): Promise<JsonRecord> { throw new Error('Unexpected paid call') } }
  await verifyPlace(new NeverCall('unused'), run, s, () => {})
  assert.equal(run.places[s.id].review!.reviewed, false); assert.equal(run.places[s.id].verification!.sessionId, undefined)
  assert.equal(metrics(run).factualAccuracy, null)
})
