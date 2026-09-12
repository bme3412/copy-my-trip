import type { City, Place, StartLoc } from '../cities/types'
import type { Candidate, CommittedStop, DayState } from '../lib/planner'

/** The print-style route map: the day's stops as numbered rings on a cream
 * field — filled gold for archive places, dashed for web — joined by dotted
 * travel lines from home, with the river as a soft ribbon underneath. An open
 * deck adds its candidates as clickable dashed pins. No tiles, no tokens:
 * the day's own geometry, drawn in the system's ink. */

const PAD = 64

interface Pt {
  lat: number
  lon: number
}

export function RouteMap({
  city,
  day,
  home,
  candidates = [],
  hoverId = null,
  onHover,
  onChoose,
  portrait = false,
}: {
  city: City
  day: DayState
  home: StartLoc
  candidates?: Candidate[]
  hoverId?: string | null
  onHover?: (id: string | null) => void
  onChoose?: (c: Candidate) => void
  portrait?: boolean
}) {
  const W = portrait ? 640 : 1000
  const H = portrait ? 660 : 420
  const stops: { c: CommittedStop; p: Place }[] = []
  for (const c of day.committed) {
    const p = city.places.find((pl) => pl.id === c.id)
    if (p) stops.push({ c, p })
  }

  // Fit home + stops + candidates (the river is backdrop — it may run off-frame).
  const fitPts: Pt[] = [home, ...stops.map((x) => x.p), ...candidates.map((c) => c.p)]
  if (fitPts.length === 0) return null
  const midLat = fitPts.reduce((a, p) => a + p.lat, 0) / fitPts.length
  const kx = Math.cos((midLat * Math.PI) / 180)
  const xs = fitPts.map((p) => p.lon * kx)
  const ys = fitPts.map((p) => -p.lat)
  const minX = Math.min(...xs)
  const minY = Math.min(...ys)
  const spanX = Math.max(Math.max(...xs) - minX, 1e-4)
  const spanY = Math.max(Math.max(...ys) - minY, 1e-4)
  const s = Math.min((W - 2 * PAD) / spanX, (H - 2 * PAD) / spanY)
  const ox = (W - s * spanX) / 2
  const oy = (H - s * spanY) / 2
  const X = (p: Pt) => ox + (p.lon * kx - minX) * s
  const Y = (p: Pt) => oy + (-p.lat - minY) * s
  const xy = (p: Pt) => `${X(p).toFixed(1)},${Y(p).toFixed(1)}`

  const route: Pt[] = [home]
  for (const { c, p } of stops) { route.push(p); if (c.returnAfter) route.push(c.returnAfter.to) }
  const loc = day.loc as Pt
  const labels: { x: number; y: number; width: number; text: string }[] = []
  for (const { p, c } of stops) {
    const text = c.name.length > 25 ? c.name.slice(0, 23) + '…' : c.name
    const width = text.length * 7.2 + 18
    const x = X(p) + width + 26 < W ? X(p) + 20 : X(p) - width - 20
    let y = Y(p) - 12
    for (const shift of [0, -28, 28, -56, 56, -84, 84]) {
      const candidateY = Math.max(8, Math.min(H - 30, Y(p) - 12 + shift))
      if (!labels.some(l => x < l.x + l.width + 5 && x + width + 5 > l.x && candidateY < l.y + 29 && candidateY + 29 > l.y)) { y = candidateY; break }
    }
    labels.push({ x, y, width, text })
  }

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      role={candidates.length ? 'group' : 'img'}
      aria-label={`Map of the day's route: ${stops.length} stops from ${home.name}`}
      style={{ display: 'block', width: '100%', height: '100%' }}
    >
      {/* the river, a soft ribbon under everything */}
      {city.river && city.river.length >= 2 && (
        <polyline
          points={city.river.map(([lat, lon]) => xy({ lat, lon })).join(' ')}
          fill="none"
          stroke={portrait ? '#8fbeff' : 'var(--color-neutral-300)'}
          strokeWidth={portrait ? 30 : 16}
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity={0.8}
        />
      )}

      {/* dotted travel line, home through every stop */}
      {route.length >= 2 && (
        <polyline
          points={route.map(xy).join(' ')}
          fill="none"
          stroke="var(--color-accent)"
          strokeWidth={portrait ? 3 : 1.5}
          strokeDasharray="5 7"
          strokeLinecap="round"
        />
      )}

      {/* candidate feelers from wherever the traveler currently is */}
      {candidates.map((cand) => (
        <line
          key={`l-${cand.p.id}`}
          x1={X(loc)}
          y1={Y(loc)}
          x2={X(cand.p)}
          y2={Y(cand.p)}
          stroke="var(--color-neutral-400)"
          strokeWidth={1}
          strokeDasharray="2 6"
        />
      ))}

      {/* home */}
      <circle cx={X(home)} cy={Y(home)} r={5} fill="var(--color-text)" />
      <text x={X(home) + 12} y={Y(home) + 4} fontSize={11} fill="var(--color-neutral-600)" fontFamily="var(--font-body)">
        {home.name}
      </text>

      {/* numbered stop rings — filled gold = archive, dashed = web */}
      {stops.map((x, i) => {
        const verified = x.c.src === 'verified'
        return (
          <g key={`${x.c.id}@${x.c.timeIn}`}>
            <title>{i + 1}. {x.c.name}</title>
            {portrait && <>
              <line x1={X(x.p)} y1={Y(x.p)} x2={labels[i].x + labels[i].width / 2} y2={labels[i].y + 12} stroke="#a1aec2" strokeWidth={1} />
              <rect x={labels[i].x} y={labels[i].y} width={labels[i].width} height={24} rx={4} fill="#182337" />
              <text x={labels[i].x + 9} y={labels[i].y + 16} fontSize={13} fontFamily="var(--font-body)" fill="white">{labels[i].text}</text>
            </>}
            <circle
              cx={X(x.p)}
              cy={Y(x.p)}
              r={12}
              fill="var(--color-bg)"
              stroke={verified ? 'var(--color-accent)' : 'var(--color-neutral-400)'}
              strokeWidth={verified ? 1.8 : 1.4}
              strokeDasharray={verified ? undefined : '3 3'}
            />
            <text
              x={X(x.p)}
              y={Y(x.p) + 4}
              textAnchor="middle"
              fontSize={12}
              fontFamily="var(--font-heading)"
              fill={verified ? 'var(--color-accent-700)' : 'var(--color-neutral-600)'}
            >
              {i + 1}
            </text>
          </g>
        )
      })}

      {/* candidates: dashed accent pins, hover-linked to the cards */}
      {candidates.map((cand) => {
        const hovered = hoverId === cand.p.id
        return (
          <g
            key={`c-${cand.p.id}`}
            role="button"
            tabIndex={onChoose ? 0 : undefined}
            aria-label={`Choose ${cand.p.name}`}
            style={{ cursor: onChoose ? 'pointer' : undefined }}
            onClick={onChoose ? () => onChoose(cand) : undefined}
            onKeyDown={onChoose ? e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onChoose(cand) } } : undefined}
            onMouseEnter={onHover ? () => onHover(cand.p.id) : undefined}
            onMouseLeave={onHover ? () => onHover(null) : undefined}
          >
            <circle
              cx={X(cand.p)}
              cy={Y(cand.p)}
              r={hovered ? 12 : 10}
              fill={hovered ? 'var(--color-accent-100)' : 'var(--color-bg)'}
              stroke="var(--color-accent)"
              strokeWidth={hovered ? 2.2 : 1.4}
              strokeDasharray="4 3"
            />
            <text
              x={X(cand.p)}
              y={Y(cand.p) + 26}
              textAnchor="middle"
              fontSize={11}
              fontFamily="var(--font-body)"
              fill={hovered ? 'var(--color-accent-800)' : 'var(--color-neutral-700)'}
            >
              {cand.p.name.split(',')[0].split(' — ')[0]}
            </text>
          </g>
        )
      })}
    </svg>
  )
}
