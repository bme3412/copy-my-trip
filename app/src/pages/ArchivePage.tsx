import { Fragment, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { ArchiveMap, type MapNode } from '../components/ArchiveMap'
import { slug } from '../lib/slug'
import { useCity } from '../state/CityContext'

type GraphMode = 'day' | 'hood'

// Provided via app/.env.local — without it the schematic fallback renders.
const MAPBOX_TOKEN: string | undefined = import.meta.env ? import.meta.env.VITE_MAPBOX_TOKEN : undefined

export function ArchivePage() {
  const city = useCity()
  const NODES = city.nodes
  const [mode, setMode] = useState<GraphMode>('day')
  const [hoverName, setHoverName] = useState<string | null>(null)
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const pulseSlug = searchParams.get('place')
  // Archive-only places have no curated day to jump to.
  const openDay = (n: { name: string; day?: number }) => {
    if (n.day) navigate(`/${city.id}/day/${n.day}#${slug(n.name)}`, { viewTransition: true })
  }
  // Real GPS positions come from the places catalogue, joined by name.
  const mapNodes: MapNode[] = NODES.flatMap((n) => {
    const p = city.places.find((pl) => pl.name === n.name)
    return p ? [{ ...n, lat: p.lat, lon: p.lon }] : []
  })
  const pulseName = pulseSlug ? (NODES.find((n) => slug(n.name) === pulseSlug)?.name ?? null) : null

  const groups = (
    mode === 'day'
      ? [
          ...[1, 2, 3, 4].map((dn) => ({ label: `Day ${dn}`, rows: NODES.filter((n) => n.day === dn) })),
          { label: 'Beyond the days', rows: NODES.filter((n) => n.day === undefined) },
        ]
      : city.hoodOrder.map((h) => ({ label: h, rows: NODES.filter((n) => n.hood === h) }))
  ).filter((g) => g.rows.length)

  const segStyle = (active: boolean) =>
    active
      ? { color: 'var(--color-accent)', boxShadow: 'inset 0 0 0 1px var(--color-accent)', cursor: 'pointer' as const }
      : { cursor: 'pointer' as const }

  return (
    <div className="page-enter archive-bleed">
      <div className="archive-map-area">
        {MAPBOX_TOKEN && mapNodes.length > 0 ? (
          <ArchiveMap
            token={MAPBOX_TOKEN}
            nodes={mapNodes}
            mode={mode}
            hoverName={hoverName}
            pulseName={pulseName}
            onHover={setHoverName}
            onOpen={openDay}
          />
        ) : (
        <div style={{ position: 'absolute', inset: 0, background: 'var(--color-neutral-100)', padding: 32 }}>
          <div style={{ fontFamily: 'var(--font-heading)', fontSize: 11, letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--color-accent)' }}>
            Clustered by GPS · Paris centre
          </div>
          <svg viewBox="0 0 520 520" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}>
            <path
              d="M-10 300 C 120 250, 220 340, 320 300 S 520 250, 540 280"
              fill="none"
              stroke="color-mix(in srgb, var(--color-accent) 30%, transparent)"
              strokeWidth="14"
              strokeLinecap="round"
            />
            <path
              d="M210 300 q 40 -20 70 0 q -35 30 -70 0"
              fill="none"
              stroke="color-mix(in srgb, var(--color-accent) 30%, transparent)"
              strokeWidth="1.5"
            />
          </svg>
          {NODES.map((n) => (
            <div
              key={n.name}
              className={`gnode${hoverName === n.name ? ' gnode-hot' : ''}${pulseSlug === slug(n.name) ? ' gnode-pulse' : ''}`}
              onMouseEnter={() => setHoverName(n.name)}
              onMouseLeave={() => setHoverName(null)}
              onClick={() => openDay(n)}
              style={{ position: 'absolute', left: `${n.x}%`, top: `${n.y}%`, transform: 'translate(-50%,-50%)', textAlign: 'center', width: 110 }}
            >
              {n.v ? (
                <span
                  className="gnode-ring"
                  style={{
                    display: 'block',
                    width: 26,
                    height: 26,
                    borderRadius: '50%',
                    border: '2px solid var(--color-accent)',
                    background: 'var(--color-accent-100)',
                    margin: '0 auto',
                  }}
                />
              ) : (
                <span
                  className="gnode-ring"
                  style={{ display: 'block', width: 18, height: 18, borderRadius: '50%', border: '1.5px dashed var(--color-neutral-500)', margin: '0 auto' }}
                />
              )}
              <span style={{ fontFamily: 'var(--font-body)', fontSize: 11, display: 'block', marginTop: 5, lineHeight: 1.25 }}>{n.name}</span>
              <span className="text-muted" style={{ fontFamily: 'var(--font-body)', fontSize: 10, fontVariantNumeric: 'tabular-nums' }}>
                {mode === 'day' ? (n.day ? `Day ${n.day}` : 'archive') : n.hood}
              </span>
            </div>
          ))}
          <div
            style={{
              position: 'absolute',
              left: 32,
              bottom: 24,
              fontFamily: 'var(--font-body)',
              fontSize: 11,
              color: 'color-mix(in srgb, var(--color-text) 55%, transparent)',
              display: 'flex',
              alignItems: 'center',
              gap: 16,
            }}
          >
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 14, height: 14, borderRadius: '50%', border: '2px solid var(--color-accent)', background: 'var(--color-accent-100)' }} />
              from the archive
            </span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 12, height: 12, borderRadius: '50%', border: '1.5px dashed var(--color-neutral-500)' }} />
              web-filled
            </span>
          </div>
        </div>
        )}

      </div>

      {/* the index, floating over the map */}
      <div className="archive-overlay">
        <div style={{ padding: '16px 22px 0' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 10, flexWrap: 'wrap' }}>
            <span className="card-kicker">{NODES.length} places · every trip merged</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span className="text-muted" style={{ fontSize: 10, letterSpacing: '.1em' }}>
                GROUP BY
              </span>
              <div className="seg">
                <label className="seg-opt" style={segStyle(mode === 'day')} onClick={() => setMode('day')}>
                  Day
                </label>
                <label className="seg-opt" style={segStyle(mode === 'hood')} onClick={() => setMode('hood')}>
                  Neighborhood
                </label>
              </div>
            </div>
          </div>
        </div>
        <div className="overlay-scroll">
          <table className="table">
            <thead>
              <tr>
                <th>Place</th>
                <th>Day</th>
                <th>Neighborhood</th>
              </tr>
            </thead>
            <tbody>
              {groups.map((grp) => (
                <Fragment key={grp.label}>
                  <tr>
                    <td colSpan={3} style={{ borderBottom: 'none', paddingTop: 16, paddingBottom: 2 }}>
                      <span className="card-kicker">{grp.label}</span>
                    </td>
                  </tr>
                  {grp.rows.map((n) => (
                    <tr
                      key={n.name}
                      onMouseEnter={() => setHoverName(n.name)}
                      onMouseLeave={() => setHoverName(null)}
                      onClick={() => openDay(n)}
                      style={{ cursor: n.day ? 'pointer' : 'default', background: hoverName === n.name ? 'color-mix(in srgb, var(--color-accent) 7%, transparent)' : undefined }}
                    >
                      <td style={{ fontFamily: 'var(--font-heading)', fontSize: 15 }}>{n.name}</td>
                      <td style={{ fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{n.day ? `Day ${n.day}` : '—'}</td>
                      <td style={{ fontSize: 13 }}>{n.hood}</td>
                    </tr>
                  ))}
                </Fragment>
              ))}
            </tbody>
          </table>
          <p className="text-muted" style={{ fontSize: 12, lineHeight: 1.6, marginTop: 18 }}>
            A pin is a place, not a trip. Group by <em>day</em> to read the route each day draws through the city, or by{' '}
            <em>neighborhood</em> to see where the archive runs deepest. Photos and video both fold into the same node.
          </p>
        </div>
      </div>
    </div>
  )
}
