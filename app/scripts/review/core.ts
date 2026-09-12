import { createHash } from 'node:crypto'

export const FIELDS = ['place.open', 'place.hours', 'place.closedOn', 'entry.cost', 'entry.needed', 'entry.note', 'media.desc'] as const
export type Field = typeof FIELDS[number]
export type JsonRecord = Record<string, unknown>
export type Verdict = 'pending' | 'supported' | 'unsupported' | 'unclear'
export interface Source { id: string; url: string; title: string; accessedAt: string; evidence: string }
export interface Claim { text: string; sourceIds: string[] }
export interface Change { field: Field; experienceId: string | null; beforeJson: string; afterJson: string; rationale: string; claims: Claim[] }
export interface Proposal { placeId: string; outcome: 'changes' | 'no_change' | 'needs_research'; summary: string; sources: Source[]; changes: Change[] }
export interface Snapshot {
  id: string; name: string; domains: string[]; place: JsonRecord; entry: JsonRecord; media: JsonRecord
  assets: { file: string; slotId: string; captureMonth: string | null }[]
}
export interface Decision { decision: 'pending' | 'accepted' | 'rejected'; claims: Verdict[]; note: string }
export interface PlaceReview {
  decisions: Decision[]; seconds: number; baselineSeconds: number | null; baselineNote: string; reviewed: boolean
}
export interface SessionState<T> {
  sessionId?: string; status: 'pending' | 'running' | 'complete' | 'failed'; error?: string
  failureCode?: string
  startedAt?: string; finishedAt?: string; proposal?: T; usage?: unknown
  handledCalls: Record<string, { turnId: string; success: boolean; output: string }>
}
export interface VerificationClaim { verdict: Exclude<Verdict, 'pending'>; reason: string; sourceIds: string[] }
export interface VerificationDecision { decision: 'accepted' | 'rejected' | 'deferred'; useful: boolean; scopeCorrect: boolean; completeClaims: boolean; reason: string; claims: VerificationClaim[] }
export interface VerificationReport { placeId: string; proposalHash: string; summary: string; sources: Source[]; decisions: VerificationDecision[]; unresolved: string[] }
export interface VerificationState extends SessionState<VerificationReport> { proposalHash: string; version: string; model: string }
export interface PlaceRun extends SessionState<Proposal> {
  review?: PlaceReview
  reviewOrigin?: 'human' | 'automated' | 'mixed'
  verification?: VerificationState
  attempts?: Omit<PlaceRun, 'attempts' | 'review'>[]
}
export interface Run {
  version: 1; id: string; kind: 'live' | 'fixture'; createdAt: string; batchId: string; catalogHash: string
  model: string; promptVersion: string; revision: number; snapshots: Snapshot[]; places: Record<string, PlaceRun>
  cost: { totalUsd: number; evidence: string; recordedAt: string } | null
}
export const hash = (v: unknown) => createHash('sha256').update(JSON.stringify(v)).digest('hex')
export function prepareRetry(run: Run, placeId: string): void {
  const state = run.places[placeId]
  if (!state || state.status !== 'failed' || !state.sessionId || state.review || state.attempts?.length) throw new Error('Retry requires a known failed session without reviews and permits only one retry per place')
  const { attempts: _attempts, review: _review, ...previous } = state
  run.places[placeId] = { status: 'pending', handledCalls: {}, attempts: [previous] }
  run.cost = null
}
function assert(ok: unknown, message: string): asserts ok { if (!ok) throw new Error(message) }
export function object(v: unknown, label = 'object'): JsonRecord {
  assert(v !== null && typeof v === 'object' && !Array.isArray(v), `${label} must be an object`)
  return v as JsonRecord
}
function exact(v: JsonRecord, fields: string[], label: string) {
  assert(Object.keys(v).every(k => fields.includes(k)) && fields.every(k => k in v), `${label}: unexpected or missing fields`)
}
function str(v: unknown, label: string, max = 2000): asserts v is string {
  assert(typeof v === 'string' && v.trim().length > 0 && v.length <= max, `${label}: expected nonempty string ≤ ${max} characters`)
}
function array(v: unknown, label: string, max: number): asserts v is unknown[] { assert(Array.isArray(v) && v.length <= max, `${label}: invalid array (max ${max})`) }
export function permittedUrl(url: string, domains: string[]): boolean {
  try { const u = new URL(url); return u.protocol === 'https:' && !u.username && !u.password && !u.port && domains.some(d => u.hostname === d || u.hostname.endsWith(`.${d}`)) } catch { return false }
}
export function currentValue(snapshot: Snapshot, field: Field, experienceId: string | null): unknown {
  const [section, key] = field.split('.')
  let target = snapshot[section as 'place' | 'entry' | 'media']
  if (experienceId) {
    assert(section === 'place', 'Experience overrides only support place fields')
    const variants = snapshot.place.experiences as JsonRecord[] | undefined
    const found = variants?.find(e => e.id === experienceId)
    assert(found, 'Unknown experience ID')
    target = found
  }
  return target[key] ?? null
}
function hourTuple(v: unknown): boolean { return Array.isArray(v) && v.length === 2 && v.every(x => typeof x === 'number' && Number.isFinite(x) && x >= 0 && x <= 24) && v[0] < v[1] }
function validAfter(field: Field, value: unknown): boolean {
  if (field === 'place.open') return hourTuple(value)
  if (field === 'place.hours') return Array.isArray(value) && value.length === 7 && value.every(h => h === null || hourTuple(h)) && value.some(h => h !== null)
  if (field === 'place.closedOn') return Array.isArray(value) && value.length <= 6 && new Set(value).size === value.length && value.every(x => Number.isInteger(x) && x >= 0 && x <= 6)
  if (field === 'entry.needed') return typeof value === 'boolean'
  return typeof value === 'string' && value.trim().length > 0 && value.length <= (field === 'media.desc' ? 1500 : 500)
}

/** Structural and provenance-reference validation. This cannot establish factual truth. */
export function validateProposal(raw: unknown, snapshot: Snapshot, createdAt: string): Proposal {
  const p = object(raw, 'proposal')
  exact(p, ['placeId', 'outcome', 'summary', 'sources', 'changes'], 'proposal')
  assert(p.placeId === snapshot.id, 'Wrong place ID')
  assert(['changes', 'no_change', 'needs_research'].includes(String(p.outcome)), 'Invalid outcome')
  str(p.summary, 'summary'); array(p.sources, 'sources', 8); array(p.changes, 'changes', 8)
  const sourceIds = new Set<string>()
  const sourceUrls = new Set<string>()
  for (const rawSource of p.sources) {
    const s = object(rawSource, 'source'); exact(s, ['id', 'url', 'title', 'accessedAt', 'evidence'], 'source')
    str(s.id, 'source.id', 60); str(s.url, 'source.url', 2000); str(s.title, 'source.title', 200); str(s.evidence, 'source.evidence', 1200)
    assert(!sourceIds.has(s.id) && !sourceUrls.has(s.url), 'Duplicate source')
    sourceIds.add(s.id); sourceUrls.add(s.url)
    assert(permittedUrl(s.url, snapshot.domains), 'Source must be HTTPS on an allowed source domain')
    str(s.accessedAt, 'accessedAt', 40)
    assert(/^\d{4}-\d{2}-\d{2}T/.test(s.accessedAt) && Number.isFinite(Date.parse(s.accessedAt)) && Date.parse(s.accessedAt) >= Date.parse(createdAt) - 86400000 && Date.parse(s.accessedAt) <= Date.now() + 300000, 'Source retrieval date is invalid or outside this run')
  }
  assert(p.outcome === 'changes' ? p.changes.length > 0 : p.changes.length === 0, 'Outcome and changes disagree')
  assert(p.outcome === 'needs_research' || sourceIds.size > 0, 'Research conclusion requires citations')
  const targets = new Set<string>()
  const edited = structuredClone(snapshot)
  for (const rawChange of p.changes) {
    const c = object(rawChange, 'change'); exact(c, ['field', 'experienceId', 'beforeJson', 'afterJson', 'rationale', 'claims'], 'change')
    assert(FIELDS.includes(c.field as Field), 'Field is not in the proposal allowlist')
    assert(c.experienceId === null || typeof c.experienceId === 'string', 'Invalid experienceId')
    str(c.beforeJson, 'beforeJson', 3000); str(c.afterJson, 'afterJson', 3000); str(c.rationale, 'rationale')
    const field = c.field as Field; const exp = c.experienceId as string | null
    const before = JSON.parse(c.beforeJson); const after = JSON.parse(c.afterJson)
    assert(JSON.stringify(before) === JSON.stringify(currentValue(snapshot, field, exp)), 'Before value differs from the frozen catalog')
    assert(JSON.stringify(before) !== JSON.stringify(after), 'Change must actually change a value')
    assert(validAfter(field, after), 'Invalid proposed value for field')
    const target = `${exp ?? 'parent'}:${field}`; assert(!targets.has(target), 'Duplicate change target'); targets.add(target)
    array(c.claims, 'claims', 12); assert(c.claims.length > 0, 'Change requires atomic factual claims')
    for (const rawClaim of c.claims) {
      const claim = object(rawClaim, 'claim'); exact(claim, ['text', 'sourceIds'], 'claim'); str(claim.text, 'claim.text', 600)
      array(claim.sourceIds, 'claim.sourceIds', 8)
      assert(claim.sourceIds.length > 0 && claim.sourceIds.every(id => typeof id === 'string' && sourceIds.has(id)), 'Claim references missing source')
    }
    const [section, key] = field.split('.')
    const dest = exp ? (edited.place.experiences as JsonRecord[]).find(e => e.id === exp)! : edited[section as 'place' | 'entry' | 'media']
    dest[key] = after
  }
  for (const place of [edited.place, ...((edited.place.experiences ?? []) as JsonRecord[])]) {
    assert(!(place.hours !== undefined && place.closedOn !== undefined), 'hours and closedOn cannot coexist; needs a richer manual migration')
  }
  return p as unknown as Proposal
}

export function emptyReview(p: Proposal): PlaceReview {
  return { decisions: p.changes.map(c => ({ decision: 'pending', claims: c.claims.map(() => 'pending'), note: '' })), seconds: 0, baselineSeconds: null, baselineNote: '', reviewed: false }
}
/** A sound field proposal can still require a wider, separately validated catalog edit. */
export function integrationRequirements(snapshot: Snapshot, proposal: Proposal): string[] {
  const requirements: string[] = []
  if (proposal.changes.some(c => c.field.startsWith('entry.')) && Object.keys(snapshot.entry).length === 0) requirements.push('Create a complete PlaceEntry record before publication; these proposed fields alone are not a complete entry.')
  if (proposal.changes.some(c => c.field === 'media.desc') && Object.keys(snapshot.media).length === 0) requirements.push('Create a complete media record before publication; a description alone may not satisfy the catalog schema.')
  if (proposal.changes.some(c => c.field === 'entry.cost') && snapshot.entry.rates) requirements.push('Reconcile the existing structured rates and asOf date with this price proposal before publication.')
  return requirements
}
export function validateReview(raw: unknown, p: Proposal): PlaceReview {
  const r = object(raw, 'review'); exact(r, ['decisions', 'seconds', 'baselineSeconds', 'baselineNote', 'reviewed'], 'review')
  assert(typeof r.seconds === 'number' && Number.isFinite(r.seconds) && r.seconds >= 0 && r.seconds <= 86400, 'Invalid review duration')
  assert(r.baselineSeconds === null || typeof r.baselineSeconds === 'number' && Number.isFinite(r.baselineSeconds) && r.baselineSeconds > 0 && r.baselineSeconds <= 86400, 'Invalid manual baseline')
  assert(typeof r.baselineNote === 'string' && r.baselineNote.length <= 2000, 'Invalid baseline note')
  if (r.baselineSeconds !== null) assert(r.baselineNote.trim().length > 0, 'Record the measured manual baseline method')
  assert(typeof r.reviewed === 'boolean', 'Invalid reviewed state')
  array(r.decisions, 'decisions', p.changes.length); assert(r.decisions.length === p.changes.length, 'Decision count mismatch')
  r.decisions.forEach((rawD, i) => {
    const d = object(rawD, 'decision'); exact(d, ['decision', 'claims', 'note'], 'decision')
    assert(['pending', 'accepted', 'rejected'].includes(String(d.decision)), 'Invalid decision')
    assert(typeof d.note === 'string' && d.note.length <= 2000, 'Invalid decision note')
    array(d.claims, 'verdicts', p.changes[i].claims.length)
    assert(d.claims.length === p.changes[i].claims.length && d.claims.every(v => ['pending', 'supported', 'unsupported', 'unclear'].includes(String(v))), 'Invalid claim verdicts')
    if (d.decision === 'accepted') assert(d.claims.every(v => v === 'supported'), 'Accept only after checking every claim against its sources')
    if (r.reviewed) assert(d.decision !== 'pending' && d.claims.every(v => v !== 'pending'), 'Finish every change and claim before marking the place reviewed')
  })
  return r as unknown as PlaceReview
}

export function metrics(run: Run) {
  let accepted = 0, rejected = 0, supported = 0, unsupported = 0, unclear = 0, pending = 0, paired = 0, baseline = 0, assisted = 0
  let proposed = 0, reviewed = 0, seconds = 0
  let humanSupported = 0, humanUnsupported = 0
  for (const r of Object.values(run.places)) {
    if (!r.proposal) continue
    proposed += r.proposal.changes.length
    const review = r.review ?? emptyReview(r.proposal)
    seconds += review.seconds
    if (review.reviewed) reviewed++
    if ((!r.reviewOrigin || r.reviewOrigin === 'human') && review.reviewed && review.baselineSeconds !== null && review.seconds > 0) { paired++; baseline += review.baselineSeconds; assisted += review.seconds }
    for (const d of review.decisions) {
      if (d.decision === 'accepted') accepted++
      if (d.decision === 'rejected') rejected++
      for (const v of d.claims) { if (v === 'supported') supported++; else if (v === 'unsupported') unsupported++; else if (v === 'unclear') unclear++; else pending++ }
      if (!r.reviewOrigin || r.reviewOrigin === 'human') for (const v of d.claims) { if (v === 'supported') humanSupported++; else if (v === 'unsupported') humanUnsupported++ }
    }
  }
  return {
    places: run.snapshots.length, researched: Object.values(run.places).filter(r => r.status === 'complete').length, reviewed, proposed, accepted, rejected,
    outcomes: {
      changes: Object.values(run.places).filter(r => r.status === 'complete' && r.proposal?.outcome === 'changes').length,
      noChange: Object.values(run.places).filter(r => r.status === 'complete' && r.proposal?.outcome === 'no_change').length,
      needsResearch: Object.values(run.places).filter(r => r.status === 'complete' && r.proposal?.outcome === 'needs_research').length,
      failed: Object.values(run.places).filter(r => r.status === 'failed').length,
    },
    claims: { supported, unsupported, unclear, pending },
    factualAccuracy: humanSupported + humanUnsupported ? humanSupported / (humanSupported + humanUnsupported) : null,
    humanClaims: { supported: humanSupported, unsupported: humanUnsupported },
    evidenceSupportRate: supported + unsupported ? supported / (supported + unsupported) : null,
    automatedReviews: Object.values(run.places).filter(r => r.reviewOrigin === 'automated' || r.reviewOrigin === 'mixed').length,
    verificationCompleted: Object.values(run.places).filter(r => r.verification?.status === 'complete').length,
    deferred: Object.values(run.places).flatMap(r => r.verification?.status === 'complete' ? r.verification.proposal?.decisions ?? [] : []).filter(d => d.decision === 'deferred').length,
    adjudicationCoverage: supported + unsupported + unclear + pending ? (supported + unsupported) / (supported + unsupported + unclear + pending) : null,
    reviewSeconds: seconds, pairedRecords: paired, pairedBaselineSeconds: baseline, pairedAssistedSeconds: assisted,
    timeSavedSeconds: paired ? baseline - assisted : null,
    totalCostUsd: run.cost?.totalUsd ?? null, costPerAcceptedChangeUsd: run.cost && accepted ? run.cost.totalUsd / accepted : null,
  }
}
