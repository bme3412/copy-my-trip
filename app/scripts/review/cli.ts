import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { AgentsClient, reviewPlace } from './agent'
import { currentValue, integrationRequirements, metrics, prepareRetry, validateProposal, type Run, type Proposal } from './core'
import { createReviewServer, acceptedExport } from './server'
import { catalogHash, load, lock, prepare, readKey, runDir, save } from './store'
import { verifyPlace } from './verify'

/** Deliberately artificial values for testing UI behavior, never research findings. */
export function fixture(run: Run): Run {
  if (run.kind !== 'fixture') throw new Error('Fixtures cannot populate a live run')
  for (const s of run.snapshots) {
    const proposal: Proposal = {
      placeId: s.id, outcome: 'changes', summary: 'TEST FIXTURE — no live research performed. Exercise the review controls; do not treat this as a factual recommendation.',
      sources: [{ id: 'fixture-source', url: `https://${s.domains[0]}/`, title: 'Fixture reference — homepage was NOT fetched', accessedAt: run.createdAt, evidence: 'Synthetic evidence for interface testing only. This is not a verified source statement.' }],
      changes: [{ field: 'entry.note', experienceId: null, beforeJson: JSON.stringify(currentValue(s, 'entry.note', null)), afterJson: JSON.stringify(`TEST ONLY: review entry information for ${s.name}.`), rationale: 'Synthetic change to exercise source adjudication and acceptance.', claims: [{ text: 'TEST ONLY — this statement has not been researched.', sourceIds: ['fixture-source'] }] }],
    }
    run.places[s.id] = { status: 'complete', handledCalls: {}, proposal: validateProposal(proposal, s, run.createdAt), usage: null }
  }
  return run
}
function summary(run: Run): string {
  const m = metrics(run)
  const percent = (x: number | null) => x === null ? 'Not measured' : `${(x * 100).toFixed(1)}%`
  return `# Paris review pilot — ${run.id}\n\n${run.kind === 'fixture' ? '**TEST FIXTURE — NOT LIVE RESEARCH.**\n\n' : ''}Nothing was published.\n\n` +
    `- Places researched: ${m.researched}/20; reviewed: ${m.reviewed}/20\n- Proposed changes: ${m.proposed}; accepted: ${m.accepted}; rejected: ${m.rejected}\n` +
    `- Research outcomes: ${m.outcomes.changes} with changes; ${m.outcomes.noChange} no change; ${m.outcomes.needsResearch} need more research; ${m.outcomes.failed} failed\n` +
    `- Human-adjudicated factual accuracy: ${percent(m.factualAccuracy)} (${m.humanClaims.supported} supported / ${m.humanClaims.supported + m.humanClaims.unsupported} human-adjudicated claims)\n` +
    `- Evidence support rate (may include model judgments): ${percent(m.evidenceSupportRate)}\n- Automated assessments: ${m.verificationCompleted}/20; deferred changes: ${m.deferred}\n` +
    `- Adjudication coverage: ${percent(m.adjudicationCoverage)}; unclear: ${m.claims.unclear}; pending: ${m.claims.pending}\n` +
    `- Review time recorded: ${(m.reviewSeconds / 60).toFixed(1)} minutes\n- Time saved: ${m.timeSavedSeconds === null ? 'Not measured — requires matched, timed manual baselines' : `${(m.timeSavedSeconds / 60).toFixed(1)} minutes across ${m.pairedRecords} paired records`}\n` +
    `- Total recorded cost: ${m.totalCostUsd === null ? 'Not measured' : `$${m.totalCostUsd.toFixed(4)}`}\n- Cost per accepted change: ${m.costPerAcceptedChangeUsd === null ? 'Not measured' : `$${m.costPerAcceptedChangeUsd.toFixed(4)}`}\n\n` +
    `Automated evidence support is not independently measured factual accuracy. Human accuracy excludes automated and mixed reviews. Time saved compares only measured human work with matched manual baselines; verifier runtime is not human time. Cost must include research, verification, failed attempts and search. API token usage is best-effort, not a final bill.\n`
}
function proposalsMarkdown(run: Run): string {
  const escape = (value: string) => value.replace(/[\\`*_{}\[\]<>#|]/g, '\\$&')
  return `# Paris proposals — ${run.id}\n\n${run.kind === 'fixture' ? '**SYNTHETIC TEST DATA — not research.**\n\n' : ''}Drafts only. No changes were published. Automated decisions below include their own evidence and reasons; they are not human ground truth. Deferred changes are withheld from the accepted export.\n\n` + run.snapshots.map(snapshot => {
    const state = run.places[snapshot.id], p = state.proposal
    if (!p) return `## ${escape(snapshot.name)}\n\nStatus: ${state.status}. ${escape(state.error ?? 'Research pending.')}\n`
    validateProposal(p, snapshot, run.createdAt)
    return `## ${escape(snapshot.name)}\n\nResearch status: ${state.status}${state.failureCode ? ` (${state.failureCode})` : ''}. Outcome: ${p.outcome}. Session: ${state.sessionId ?? 'fixture'}.\n\n${state.status !== 'complete' ? '**Submitted draft preserved, but the research turn did not complete.**\n\n' : ''}${escape(p.summary)}\n\n` + integrationRequirements(snapshot, p).map(r => `Integration requirement: ${escape(r)}\n\n`).join('') + p.changes.map((change, i) =>
      `### ${i + 1}. ${change.field}${change.experienceId ? ` / ${escape(change.experienceId)}` : ''}\n\n${state.verification?.status === 'complete' && state.verification.proposal ? `**Automatic decision: ${state.verification.proposal.decisions[i].decision}.** ${escape(state.verification.proposal.decisions[i].reason)}\n\n` : ''}${escape(change.rationale)}\n\n` +
      `\`\`\`json\n${JSON.stringify({ before: JSON.parse(change.beforeJson), proposed: JSON.parse(change.afterJson) }, null, 2)}\n\`\`\`\n\n` +
      change.claims.map(c => `- ${escape(c.text)} (${c.sourceIds.map(escape).join(', ')})`).join('\n') + '\n\n').join('') +
      'Original sources (retrieval and evidence are agent-reported):\n\n' + p.sources.map(s => `- **${escape(s.id)}**: [${escape(s.title)}](${new URL(s.url).href.replace(/\(/g, '%28').replace(/\)/g, '%29')}) — ${s.accessedAt}. ${escape(s.evidence)}`).join('\n') + '\n\n' +
      (state.verification?.status === 'complete' && state.verification.proposal ? 'Verifier sources (retrieval and evidence are verifier-reported):\n\n' + state.verification.proposal.sources.map(s => `- **${escape(s.id)}**: [${escape(s.title)}](${new URL(s.url).href.replace(/\(/g, '%28').replace(/\)/g, '%29')}) — ${s.accessedAt}. ${escape(s.evidence)}`).join('\n') + '\n\n' : '')
  }).join('\n')
}
async function main() {
  const [command, id, arg] = process.argv.slice(2)
  if (command === 'prepare' || command === 'fixture') {
    const run = prepare(command === 'fixture' ? 'fixture' : 'live')
    if (command === 'fixture') fixture(run)
    save(run)
    console.log(`${run.id}\n20 frozen Paris records saved to ${runDir(run.id)}\nNext: npm run review -- ${command === 'fixture' ? 'serve' : 'run'} ${run.id}`)
    return
  }
  if (!id || !['run', 'verify', 'serve', 'report', 'attach', 'usage', 'cancel', 'retry'].includes(command)) {
    console.log('Paris curator pilot (run from app/)\n\n  npm run review -- prepare\n  npm run review -- run RUN_ID\n  npm run review -- verify RUN_ID\n  npm run review -- serve RUN_ID [PORT]\n  npm run review -- usage RUN_ID\n  npm run review -- report RUN_ID\n  npm run review -- attach RUN_ID PLACE_ID SESSION_ID\n  npm run review -- cancel RUN_ID\n  npm run review -- retry RUN_ID PLACE_ID\n  npm run review -- fixture\n\nLive runs require OPENAI_API_KEY in the environment or app/.env.local. Fixture runs are synthetic and isolated. No command publishes or modifies city data.')
    return
  }
  const release = lock(id)
  let serverOwnsLock = false
  try {
    const run = load(id)
    if (command === 'serve') {
      const port = arg ? Number(arg) : 4317
      if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error('Port must be 1024..65535')
      const { server } = createReviewServer(run)
      await new Promise<void>((resolve, reject) => { server.once('error', reject); server.listen(port, '127.0.0.1', resolve) })
      serverOwnsLock = true
      console.log(`Curator review: http://127.0.0.1:${port}\n${run.kind === 'fixture' ? 'TEST FIXTURE — no live research. ' : ''}Accepting saves decisions only. Stop this server before resuming research.`)
      const stop = () => server.close(() => { release(); process.exit(0) })
      process.once('SIGINT', stop); process.once('SIGTERM', stop)
      return
    }
    if (command === 'report') {
      if (catalogHash() !== run.catalogHash) throw new Error('Catalog changed; report export blocked pending a fresh review')
      writeFileSync(join(runDir(id), 'report.md'), summary(run), { mode: 0o600 })
      writeFileSync(join(runDir(id), 'proposals.md'), proposalsMarkdown(run), { mode: 0o600 })
      writeFileSync(join(runDir(id), 'accepted-proposals.json'), JSON.stringify(acceptedExport(run), null, 2), { mode: 0o600 })
      writeFileSync(join(runDir(id), 'verification-report.json'), JSON.stringify({ runId: run.id, kind: run.kind, published: false, notice: 'Automated assessment is not human ground truth.', metrics: metrics(run), places: run.snapshots.map(s => ({ id: s.id, name: s.name, reviewOrigin: run.places[s.id].reviewOrigin ?? null, review: run.places[s.id].review ?? null, verification: run.places[s.id].verification ?? null })) }, null, 2), { mode: 0o600 })
      console.log(summary(run)); return
    }
    if (command === 'attach') {
      const sid = process.argv[5]
      if (!arg || !Object.hasOwn(run.places, arg) || !/^sess_[\w-]+$/.test(sid ?? '')) throw new Error('Supply a batch place ID and its actual session ID from Platform logs')
      if (run.places[arg].sessionId) throw new Error('A session is already attached')
      const attachedKey = readKey()
      if (!attachedKey) throw new Error('OPENAI_API_KEY is required to verify session ownership before attaching')
      const session = await new AgentsClient(attachedKey).request(`/${encodeURIComponent(sid)}`)
      const metadata = session.metadata as Record<string, unknown> | undefined
      if (metadata?.pilot_run !== run.id || metadata?.place_id !== arg) throw new Error('Session metadata does not match this pilot run and place')
      run.places[arg].sessionId = sid; save(run); console.log('Session attached. Run again to collect it.'); return
    }
    if (run.kind !== 'live') throw new Error('Fixture runs cannot call the Agents API')
    const key = readKey()
    if (!key) throw new Error('OPENAI_API_KEY is missing. Add it to app/.env.local (never paste it into chat), then rerun. No API call was made.')
    const client = new AgentsClient(key)
    if (command === 'retry') {
      const state = arg && Object.hasOwn(run.places, arg) ? run.places[arg] : undefined
      if (!state || state.status !== 'failed' || !state.sessionId) throw new Error('Supply a place with a known failed session')
      const session = await client.request(`/${encodeURIComponent(state.sessionId)}`)
      const turns = await client.request(`/${encodeURIComponent(state.sessionId)}/turns?limit=20&order=desc`)
      const root = Array.isArray(turns.data) ? (turns.data as Record<string, unknown>[]).find(t => !t.subagent_id) : undefined
      if (!['idle', 'failed'].includes(String(session.status)) || !root || !['failed', 'cancelled'].includes(String(root.status))) throw new Error('Retry requires confirmed inactive session and failed/cancelled root turn')
      state.usage = session.usage ?? null
      prepareRetry(run, arg!); save(run)
      console.log('Preserved the failed attempt and cleared cost reconciliation. Run this batch again to research only unfinished records.'); return
    }
    if (command === 'cancel') {
      for (const p of Object.values(run.places)) if (p.sessionId && p.status !== 'complete') { await client.cancel(p.sessionId); p.status = 'failed'; p.error = 'Cancellation requested by curator'; save(run) }
      for (const p of Object.values(run.places).map(p => p.verification)) if (p?.sessionId && p.status !== 'complete') { await client.cancel(p.sessionId); p.status = 'failed'; p.error = 'Verification cancellation requested'; save(run) }
      console.log('Cancellation requested for unfinished sessions. Check Platform logs for final usage.'); return
    }
    if (command === 'usage') {
      for (const state of Object.values(run.places)) for (const p of [state, ...(state.attempts ?? []), ...(state.verification ? [state.verification] : [])]) if (p.sessionId) {
        p.usage = (await client.request(`/${encodeURIComponent(p.sessionId)}`)).usage ?? null
        if (p.status === 'failed') {
          const turns = await client.request(`/${encodeURIComponent(p.sessionId)}/turns?limit=20&order=desc`)
          const root = Array.isArray(turns.data) ? (turns.data as Record<string, unknown>[]).find(t => !t.subagent_id) : undefined
          const code = (root?.error as Record<string, unknown> | undefined)?.code
          if (typeof code === 'string' && /^[a-zA-Z0-9_]{1,100}$/.test(code)) { p.failureCode = code; p.error = `Research turn failed (${code}). ${p.proposal ? 'Submitted draft is preserved.' : ''}` }
        }
        save(run)
      }
      console.log('Refreshed best-effort usage. Record reconciled model + search cost in the review UI.'); return
    }
    if (catalogHash() !== run.catalogHash) throw new Error('Catalog changed; prepare a new frozen run')
    const seconds = Number(process.env.REVIEW_PLACE_TIMEOUT_SECONDS ?? 240)
    if (!Number.isInteger(seconds) || seconds < 30 || seconds > 900) throw new Error('REVIEW_PLACE_TIMEOUT_SECONDS must be 30..900')
    if (run.cost) { run.cost = null; save(run); console.log('Cleared prior cost reconciliation because research is resuming.') }
    let interrupted = false
    const stopResearch = () => { interrupted = true; console.log('Stopping after the current request; cancelling the active session…') }
    process.once('SIGINT', stopResearch); process.once('SIGTERM', stopResearch)
    try {
      // Sequential; retries are explicit and retain prior attempts. Never automatically repeat uncertain creation.
      for (const snapshot of run.snapshots) {
        if (interrupted) throw new Error('Research interrupted')
        if (command === 'verify') {
          if (run.places[snapshot.id].review) continue
          console.log(`Verifying ${snapshot.name} (up to ${seconds}s; token/tool charges apply)`)
          await verifyPlace(client, run, snapshot, () => save(run), { seconds, shouldStop: () => interrupted })
          console.log(`Automated decisions saved: ${snapshot.id}`)
        } else {
          if (run.places[snapshot.id].status === 'complete') continue
          console.log(`Researching ${snapshot.name} (up to ${seconds}s; token/tool charges apply)`)
          await reviewPlace(client, run, snapshot, () => save(run), { seconds, shouldStop: () => interrupted })
          console.log(`Draft saved: ${snapshot.id}`)
        }
      }
    } finally { process.removeListener('SIGINT', stopResearch); process.removeListener('SIGTERM', stopResearch) }
    console.log(`${command === 'verify' ? 'Automated verification' : 'Research'} complete. npm run review -- serve ${run.id}`)
  } finally { if (!serverOwnsLock) release() }
}
if (process.env.CMT_REVIEW_TEST !== '1') main().catch(err => { console.error(err instanceof Error ? err.message : err); process.exitCode = 1 })
