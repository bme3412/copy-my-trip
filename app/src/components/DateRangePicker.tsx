import { useEffect, useRef, useState } from 'react'
import { CalendarIcon } from './icons'

interface Props {
  arriving: string
  departing: string
  onChange: (range: { arriving: string; departing: string }) => void
}

const DOW = ['M', 'T', 'W', 'T', 'F', 'S', 'S']
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
const iso = (y: number, m: number, d: number) => `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
const pretty = (v: string) =>
  v ? new Date(v + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }) : ''

/** Booking-style dates: two friendly fields; clicking one drops a calendar
 * beneath it. Picking an arrival auto-advances to departure. */
export function DateRangePicker({ arriving, departing, onChange }: Props) {
  const [openFor, setOpenFor] = useState<'arriving' | 'departing' | null>(null)
  const today = new Date()
  const todayIso = iso(today.getFullYear(), today.getMonth(), today.getDate())
  const initial = arriving ? new Date(arriving + 'T12:00:00') : today
  const [view, setView] = useState({ y: initial.getFullYear(), m: initial.getMonth() })
  const rootRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!openFor) return
    const close = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpenFor(null)
    }
    const esc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpenFor(null)
    }
    document.addEventListener('mousedown', close)
    document.addEventListener('keydown', esc)
    return () => {
      document.removeEventListener('mousedown', close)
      document.removeEventListener('keydown', esc)
    }
  }, [openFor])

  const move = (delta: number) => {
    const d = new Date(view.y, view.m + delta, 1)
    setView({ y: d.getFullYear(), m: d.getMonth() })
  }
  const atMin = view.y === today.getFullYear() && view.m === today.getMonth()

  const pick = (date: string) => {
    if (openFor === 'arriving' || !arriving || date <= arriving) {
      onChange({ arriving: date, departing: departing > date ? departing : '' })
      setOpenFor('departing')
    } else {
      onChange({ arriving, departing: date })
      setOpenFor(null)
    }
  }

  const first = new Date(view.y, view.m, 1)
  const daysInMonth = new Date(view.y, view.m + 1, 0).getDate()
  const lead = (first.getDay() + 6) % 7
  const cells: (number | null)[] = [...Array(lead).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)]

  const field = (kind: 'arriving' | 'departing', label: string, value: string, placeholder: string) => (
    <div className="field" style={{ flex: 1 }}>
      <label>{label}</label>
      <button
        type="button"
        className="input"
        onClick={() => setOpenFor(openFor === kind ? null : kind)}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 8,
          textAlign: 'left',
          cursor: 'pointer',
          color: value ? 'var(--color-text)' : 'color-mix(in srgb, var(--color-text) 45%, transparent)',
          borderColor: openFor === kind ? 'var(--color-accent)' : undefined,
        }}
      >
        {value ? pretty(value) : placeholder}
        <CalendarIcon size={15} style={{ opacity: 0.5, flexShrink: 0 }} />
      </button>
    </div>
  )

  return (
    <div ref={rootRef} style={{ position: 'relative', maxWidth: 480 }}>
      <div style={{ display: 'flex', gap: 20 }}>
        {field('arriving', 'Arriving', arriving, 'Add date')}
        {field('departing', 'Departing', departing, 'Add date')}
      </div>
      {openFor && (
        <div className="cal cal-pop panel-enter">
          <div className="cal-head">
            <button className="btn btn-ghost btn-icon" onClick={() => move(-1)} disabled={atMin} aria-label="Previous month">
              ‹
            </button>
            <span style={{ fontFamily: 'var(--font-heading)', fontSize: 16 }}>
              {MONTHS[view.m]} <span style={{ fontVariantNumeric: 'tabular-nums' }}>{view.y}</span>
            </span>
            <button className="btn btn-ghost btn-icon" onClick={() => move(1)} aria-label="Next month">
              ›
            </button>
          </div>
          <div className="cal-grid">
            {DOW.map((d, i) => (
              <span key={i} className="cal-dow">
                {d}
              </span>
            ))}
            {cells.map((day, i) => {
              if (day === null) return <span key={`x${i}`} />
              const date = iso(view.y, view.m, day)
              const past = date < todayIso
              const isStart = date === arriving
              const isEnd = date === departing
              const inRange = arriving && departing && date > arriving && date < departing
              return (
                <button
                  key={date}
                  className={`cal-day${isStart || isEnd ? ' cal-endpoint' : ''}${inRange ? ' cal-inrange' : ''}`}
                  disabled={past}
                  onClick={() => pick(date)}
                >
                  {day}
                </button>
              )
            })}
          </div>
          <div className="text-muted" style={{ fontFamily: 'var(--font-body)', fontSize: 11.5, marginTop: 8 }}>
            {openFor === 'arriving' ? 'Pick your arrival day' : 'Now pick the day you leave'}
          </div>
        </div>
      )}
    </div>
  )
}
