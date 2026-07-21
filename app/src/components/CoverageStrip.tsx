import type { Theme } from '../cities/types'

const LABELS: [Theme, string][] = [
  ['monumental', 'Monumental'],
  ['historic', 'Historic'],
  ['artistic', 'Artistic'],
  ['neighborhood', 'Neighborhood'],
  ['everyday', 'Everyday'],
  ['afterdark', 'After dark'],
]

/** Six-dot coverage of what a first trip should contain. */
export function CoverageStrip({ covered, compact }: { covered: ReadonlySet<Theme>; compact?: boolean }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: compact ? 8 : 14,
        flexWrap: 'wrap',
        fontFamily: 'var(--font-body)',
        fontSize: compact ? 10.5 : 11.5,
      }}
    >
      {LABELS.map(([theme, label]) => {
        const on = covered.has(theme)
        return (
          <span
            key={theme}
            title={`${label} Paris ${on ? '— covered' : '— not yet covered'}`}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 5,
              color: on ? 'var(--color-accent-700)' : 'color-mix(in srgb, var(--color-text) 45%, transparent)',
            }}
          >
            <span
              style={{
                width: compact ? 7 : 8,
                height: compact ? 7 : 8,
                borderRadius: '50%',
                background: on ? 'var(--color-accent)' : 'transparent',
                border: on ? 'none' : '1.5px solid var(--color-neutral-400)',
              }}
            />
            {label}
          </span>
        )
      })}
    </div>
  )
}
