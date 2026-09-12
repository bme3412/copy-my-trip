import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react'
import { Link } from 'react-router-dom'
import { useCity } from '../state/CityContext'

const destinations = [
  { id: 'paris', name: 'Paris', country: 'France', detail: 'Personal photo archive & curated days', monogram: 'P' },
  { id: 'rome', name: 'Rome', country: 'Italy', detail: 'Researched places & flexible itineraries', monogram: 'R' },
]

export function CitySelector() {
  const city = useCity()
  const [open, setOpen] = useState(false)
  const panelId = useId()
  const root = useRef<HTMLDivElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  const firstOption = useRef<HTMLAnchorElement>(null)

  useEffect(() => {
    if (!open) return
    const dismiss = (event: PointerEvent) => {
      if (event.target instanceof Node && !root.current?.contains(event.target)) setOpen(false)
    }
    document.addEventListener('pointerdown', dismiss)
    return () => document.removeEventListener('pointerdown', dismiss)
  }, [open])

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === 'Escape' && open) {
      event.preventDefault()
      setOpen(false)
      trigger.current?.focus()
    }
    if (event.target === trigger.current && event.key === 'ArrowDown') {
      event.preventDefault()
      setOpen(true)
      // Focus after React has mounted the destination links.
      requestAnimationFrame(() => firstOption.current?.focus())
    }
  }

  return <div className="city-selector" ref={root} onKeyDown={onKeyDown} onBlur={event => {
    if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false)
  }}>
    <div className="city-selector-row">
      <span className="city-selector-name" aria-hidden="true">{city.name}</span>
      <button type="button" className="city-selector-trigger" ref={trigger} aria-expanded={open} aria-controls={panelId}
        aria-label={`Change city, currently ${city.name}`} onClick={() => setOpen(value => !value)}>
        Change city
        <svg aria-hidden="true" width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="m5 7.5 5 5 5-5" /></svg>
      </button>
    </div>
    {open && <nav className="city-selector-panel" id={panelId} aria-label="Choose a city">
      <div className="city-selector-heading">Where would you like to go?</div>
      {destinations.map((destination, index) => <Link key={destination.id} ref={index === 0 ? firstOption : undefined}
        to={`/${destination.id}`} aria-current={destination.id === city.id ? 'page' : undefined}
        className="city-selector-option" onClick={() => setOpen(false)}>
        <span className={`city-selector-monogram city-selector-${destination.id}`} aria-hidden="true">{destination.monogram}</span>
        <span className="city-selector-info"><span className="city-selector-title">{destination.name}<small>{destination.country}</small></span><span className="city-selector-detail">{destination.detail}</span></span>
        {destination.id === city.id ? <span className="city-selector-current"><svg aria-hidden="true" width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="m4 10 4 4 8-8" /></svg><span className="visually-hidden">Current city</span></span> : <span className="city-selector-arrow" aria-hidden="true">→</span>}
      </Link>)}
      <p className="city-selector-note">Your saved trips stay with their city.</p>
    </nav>}
  </div>
}
