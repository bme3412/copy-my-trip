import { Fragment } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useCity } from '../state/CityContext'

const STEPS = [
  { num: '01', label: 'Plan', seg: 'compose' },
  { num: '02', label: 'Itinerary', seg: 'itinerary' },
]

/** The poster's section numerals, repurposed as wayfinding through the trip flow. */
export function FlowStepper() {
  const city = useCity()
  const { pathname } = useLocation()
  const seg = pathname.split('/')[2] ?? ''
  const current = Math.max(0, STEPS.findIndex((s) => s.seg === seg))

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 30 }}>
      {STEPS.map((s, i) => {
        const reached = i <= current
        const active = i === current
        const to = s.seg === 'itinerary' ? `/${city.id}/itinerary/1` : `/${city.id}/${s.seg}`
        return (
          <Fragment key={s.seg}>
            {i > 0 && <span aria-hidden style={{ flex: '0 1 44px', height: 1, background: 'var(--color-divider)' }} />}
            <Link
              to={to}
              viewTransition
              style={{
                display: 'inline-flex',
                alignItems: 'baseline',
                gap: 8,
                textDecoration: 'none',
                fontFamily: 'var(--font-heading)',
                fontSize: 13,
                letterSpacing: '.08em',
                color: reached ? 'var(--color-accent)' : 'color-mix(in srgb, var(--color-text) 40%, transparent)',
                borderBottom: active ? '2px solid var(--color-accent)' : '2px solid transparent',
                paddingBottom: 4,
              }}
            >
              <span style={{ fontVariantNumeric: 'tabular-nums', fontSize: 12 }}>{s.num}</span>
              <span style={{ color: reached ? 'var(--color-text)' : 'inherit' }}>{s.label}</span>
            </Link>
          </Fragment>
        )
      })}
    </div>
  )
}
