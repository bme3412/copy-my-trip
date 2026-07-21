import { placeLatestLabel } from '../lib/media'
import { fmt, type Candidate } from '../lib/planner'
import { useCity } from '../state/CityContext'
import { MenuIcon, TicketIcon, WalkIcon } from './icons'

/** What choosing this candidate does to the rest of the day — computed by
 * pre-flighting the replay, shown as honest deltas beside the choice. */
export interface CandidateImpact {
  /** "next leg 9 min walk (was 14 min métro) · day ends 21:40 (+15 min)" */
  line: string
  /** Downstream stops the swap would break (flagged, not hidden). */
  broken: number
}

export function CandidateCard({
  cand,
  onChoose,
  exitClass,
  delay,
  hovered,
  onHover,
  impact,
  chooseLabel = 'Choose this',
}: {
  cand: Candidate
  onChoose: () => void
  exitClass: string
  delay: number
  hovered: boolean
  onHover: (id: string | null) => void
  impact?: CandidateImpact
  chooseLabel?: string
}) {
  const city = useCity()
  const info = city.info[cand.p.id]
  const entry = city.entry[cand.p.id]
  const verified = cand.p.src === 'verified'
  return (
    <div
      className={`card deal-in ${exitClass}`}
      onMouseEnter={() => onHover(cand.p.id)}
      onMouseLeave={() => onHover(null)}
      style={{
        display: 'grid',
        gridTemplateColumns: '1fr 200px',
        gap: 22,
        alignItems: 'center',
        padding: '20px 22px',
        animationDelay: exitClass ? '0ms' : `${delay}ms`,
        borderColor: hovered ? 'var(--color-accent)' : undefined,
      }}
    >
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 7, flexWrap: 'wrap' }}>
          <span className="tag tag-outline">{cand.p.label}</span>
          <span className={verified ? 'tag tag-accent' : 'tag tag-neutral'}>
            {verified
              ? `From your archive${placeLatestLabel(city, cand.p.id) ? ` · shot ${placeLatestLabel(city, cand.p.id)}` : ''}`
              : 'From web notes'}
          </span>
          {cand.p.meal && <span className="tag tag-meal">{cand.p.meal}</span>}
          {cand.p.role === 'anchor' && <span className="tag tag-accent-2">Anchor · one per day</span>}
          {cand.p.timed && <span className="tag tag-neutral">timed entry</span>}
        </div>
        <div style={{ fontFamily: 'var(--font-heading)', fontSize: 20, fontWeight: 600, lineHeight: 1.15 }}>{cand.p.name}</div>
        <div className="text-muted" style={{ fontSize: 12.5, marginBottom: 9 }}>
          {cand.p.area}
        </div>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 14,
            flexWrap: 'wrap',
            fontFamily: 'var(--font-body)',
            fontSize: 12,
            color: 'color-mix(in srgb, var(--color-text) 68%, transparent)',
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
            <WalkIcon size={12} />
            {cand.t.min} min {cand.t.mode} · {cand.t.measured ? 'measured' : 'estimated'}
          </span>
          <span>arrive {fmt(cand.arrive)}</span>
          <span>{cand.dur} min here</span>
        </div>
        {cand.p.open[1] < 22 && (
          <div className="text-muted" style={{ fontSize: 11, marginTop: 5 }}>
            open to {cand.p.open[1]}:00
          </div>
        )}
        {info && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 8, fontSize: 12, flexWrap: 'wrap' }}>
            <span style={{ fontVariantNumeric: 'tabular-nums', letterSpacing: 1.5 }}>
              <span style={{ color: 'var(--color-text)' }}>{info.price}</span>
              <span className="text-muted">{'$$$$'.slice(info.price.length)}</span>
            </span>
            <a href={info.menu} target="_blank" rel="noopener" style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
              <MenuIcon size={12} />
              View menu
            </a>
            <span className="text-muted">{info.lang === 'FR' ? 'menu · FR→EN' : 'menu in English'}</span>
          </div>
        )}
        {entry && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 8, fontSize: 12, flexWrap: 'wrap' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontVariantNumeric: 'tabular-nums' }}>
              <TicketIcon size={12} />
              {entry.cost}
            </span>
            {entry.url && (
              <a href={entry.url} target="_blank" rel="noopener">
                {entry.needed ? 'Book tickets' : 'Reserve slot'}
              </a>
            )}
            {entry.note && <span className="text-muted">{entry.note}</span>}
          </div>
        )}
      </div>
      <div
        style={{
          borderLeft: '1px solid var(--color-divider)',
          paddingLeft: 20,
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
          alignSelf: 'stretch',
          justifyContent: 'center',
        }}
      >
        <div style={{ fontFamily: 'var(--font-body)', fontSize: 12, lineHeight: 1.5, color: 'var(--color-accent-700)', fontVariantNumeric: 'tabular-nums' }}>
          {cand.forecast}
        </div>
        {cand.reasons && cand.reasons.length > 0 && (
          <div className="text-muted" style={{ fontFamily: 'var(--font-body)', fontSize: 11.5, lineHeight: 1.5 }}>
            {cand.reasons
              .filter((r) => r.value >= 0)
              .map((r) => r.note)
              .join(' · ')}
          </div>
        )}
        {impact && impact.line && (
          <div className="text-muted" style={{ fontFamily: 'var(--font-body)', fontSize: 11.5, lineHeight: 1.5, fontVariantNumeric: 'tabular-nums' }}>
            {impact.line}
          </div>
        )}
        {impact && impact.broken > 0 && (
          <div style={{ fontFamily: 'var(--font-body)', fontSize: 11.5, lineHeight: 1.5, color: 'var(--color-accent-2-700)' }}>
            would break {impact.broken} later {impact.broken === 1 ? 'stop' : 'stops'}
          </div>
        )}
        <button className="btn btn-primary" style={{ width: '100%' }} onClick={onChoose}>
          {chooseLabel}
        </button>
      </div>
    </div>
  )
}
