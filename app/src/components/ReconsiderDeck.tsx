import { useState } from 'react'
import type { Candidate } from '../lib/planner'
import { CandidateCard, type CandidateImpact } from './CandidateCard'

/** The builder's candidate deck, relocated into the itinerary: the same fan
 * of ways forward, opened either at a stop (reconsider) or at the end of an
 * unfinished day (append). Presentational — the page computes candidates,
 * impacts and the swap; this runs the choose choreography. */
export function ReconsiderDeck({
  kicker,
  heading,
  sub,
  cands,
  impacts,
  chooseLabel,
  keepLabel,
  emptyNote,
  onChoose,
  onKeep,
  hoverId,
  onHover,
}: {
  kicker: string
  heading: string
  sub?: string
  cands: Candidate[]
  impacts?: (CandidateImpact | undefined)[]
  chooseLabel?: string
  /** The quiet close action — "Keep Café Hugo" / "Close". */
  keepLabel: string
  /** Shown when no alternative survives the filters. */
  emptyNote: string
  onChoose: (c: Candidate) => void
  onKeep: () => void
  hoverId: string | null
  onHover: (id: string | null) => void
}) {
  const [exitingId, setExitingId] = useState<string | null>(null)
  const startChoose = (c: Candidate) => {
    if (exitingId) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      onChoose(c)
      return
    }
    setExitingId(c.p.id)
    window.setTimeout(() => {
      onChoose(c)
      setExitingId(null)
    }, 300)
  }

  return (
    <div className="commit-enter" style={{ margin: '4px 0 28px' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', marginBottom: 4 }}>
        <div>
          <h4
            style={{
              fontSize: 15,
              margin: 0,
              fontFamily: 'var(--font-heading)',
              letterSpacing: '.06em',
              textTransform: 'uppercase',
              color: 'var(--color-accent)',
            }}
          >
            {kicker}
          </h4>
          <div style={{ fontFamily: 'var(--font-heading)', fontSize: 19, marginTop: 4 }}>{heading}</div>
        </div>
        <button className="linklike" style={{ fontSize: 12.5, textDecoration: 'none' }} onClick={onKeep}>
          {keepLabel}
        </button>
      </div>
      {sub && (
        <p className="text-muted" style={{ fontSize: 13, lineHeight: 1.55, margin: '0 0 16px', maxWidth: 560 }}>
          {sub}
        </p>
      )}
      {cands.length === 0 ? (
        <div style={{ border: '1px dashed var(--color-divider)', borderRadius: 6, padding: 22, maxWidth: 560 }}>
          <p className="text-muted" style={{ fontSize: 13.5, lineHeight: 1.6, margin: 0 }}>
            {emptyNote}
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, maxWidth: 720 }}>
          {cands.map((cand, i) => (
            <CandidateCard
              key={cand.p.id}
              cand={cand}
              onChoose={() => startChoose(cand)}
              delay={i * 60}
              exitClass={exitingId ? (exitingId === cand.p.id ? 'cand-chosen-exit' : 'cand-rejected-exit') : ''}
              hovered={hoverId === cand.p.id}
              onHover={onHover}
              impact={impacts?.[i]}
              chooseLabel={chooseLabel}
            />
          ))}
        </div>
      )}
    </div>
  )
}
