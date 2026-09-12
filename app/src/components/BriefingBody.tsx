import type { Briefing } from '../lib/briefings/schema';
import { safeUrl } from '../lib/briefings/schema';
import { scheduleLine } from '../lib/briefings/assemble';
import { ImageSlot } from './ImageSlot';
import { WeatherPanel } from './WeatherPanel';
export function BriefingBody({ briefing: b, storage = 'device' }: {
    briefing: Briefing; storage?: 'device' | 'account';
}) {
    return <article className="briefing-body">
    <p className="companion-kicker">{b.demo ? 'Demonstration trip' : 'Accepted itinerary'} · {b.cityName}</p>
    <h2>{b.title}</h2><p>{b.date} · {b.timeZone}</p><p>{b.purpose}</p>
    {b.weather && <WeatherPanel record={b.weather}/>}
    <p className="evidence-label">{b.firsthand} of {b.stops.length} stops marked firsthand for the selected experience.</p>
    {b.warnings.length > 0 && <aside className="companion-notice"><h3>Review these constraints</h3><ul>{b.warnings.map((w, i) => <li key={i}>{w}</li>)}</ul></aside>}
    {!b.stops.length && <p className="companion-notice">{b.status === 'before' ? 'Your trip has not started. Select a trip date to preview.' : b.status === 'completed' ? 'Your trip has ended. Saved days remain available.' : 'An open day: no activities have been accepted for this date.'}</p>}
    {b.status === 'travel' && <p>Day-trip travel is included below. These journey durations are estimates.</p>}
    <ol className="briefing-stops">{b.stops.map((s, i) => <li key={`${s.id}-${i}`} data-stop-id={s.id}>
      <div className="briefing-stop-heading"><p className="schedule-facts">{scheduleLine(s)}</p><h3>{s.name}</h3><p>{s.area}</p></div>
      <p className="evidence-label">{s.evidence}</p>
      {s.image && safeUrl(s.image.url) && <figure><div className="briefing-photo"><ImageSlot src={safeUrl(s.image.url)} placeholder={s.image.caption} unavailableLabel="Archive image unavailable. The accepted itinerary remains readable."/></div><figcaption>{s.image.caption}</figcaption></figure>}
      <p>{s.description}</p>{s.timed && <p>Suggested entry time — not a reservation.</p>}
      {s.returnAfter && <p className="companion-notice">Then {s.returnAfter.min} min {s.returnAfter.mode} back to {s.returnAfter.destination} (estimated).</p>}
      {safeUrl(s.directions) && <a href={safeUrl(s.directions)} target="_blank" rel="noopener noreferrer">Directions to {s.name}</a>}
    </li>)}</ol>
    <p className="companion-notice">{b.weather ? 'Live operational updates are not connected.' : b.conditions} Historical visits do not establish current hours.</p>
    <footer><p>Accepted {new Date(b.acceptedAt).toLocaleString()} · {storage === 'device' ? 'stored on this device' : 'saved in your account'}</p><p className="version-ref">Plan {b.planId}<br />Briefing {b.id}</p></footer>
  </article>;
}
