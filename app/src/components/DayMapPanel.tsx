import type { City, StartLoc } from '../cities/types';
import { fmt, type Candidate, type DayState } from '../lib/planner';
import { RouteMap } from './RouteMap';
import { TripMap } from './TripMap';

export function DayMapPanel({ city, day, home, number, date, token, candidates, hoverId, onHover, onChoose }: {
  city: City; day: DayState; home: StartLoc; number: number; date?: string; token?: string;
  candidates: Candidate[]; hoverId: string | null; onHover: (id: string | null) => void; onChoose: (c: Candidate) => void;
}) {
  const walk = day.committed.reduce((sum, s) => sum + (s.travelMode === 'walk' ? s.travelMin : 0) + (s.returnAfter?.mode === 'walk' ? s.returnAfter.min : 0), 0);
  const metro = day.committed.reduce((sum, s) => sum + Number(s.travelMode === 'metro') + Number(s.returnAfter?.mode === 'metro'), 0);
  const props = { city, day, home, candidates, hoverId, onHover, onChoose };
  return <aside className="day-map-panel" id="day-route-map" aria-label={`Day ${number} route overview`}>
    <div className="map-heading"><span className="map-live-dot" />{city.name} <span> / </span> Day {number}<span className="map-heading-date">{date || 'Choose your dates'}</span></div>
    <div className="day-map-canvas">{token ? <TripMap {...props} token={token} /> : <RouteMap {...props} portrait />}</div>
    <div className="route-summary">
      <div className="route-summary-heading"><span className="route-eyebrow">Day {number} · planned route</span><span>{day.committed.length} stops</span></div>
      <h2>{day.committed.length ? `${day.committed[0].name} → ${day.committed.at(-1)!.name}` : 'A day waiting to be explored'}</h2>
      <div className="route-accent-rule" />
      <dl><div><dt>Walking · est.</dt><dd>{walk} <small>min</small></dd></div><div><dt>Métro legs · est.</dt><dd>{metro}</dd></div><div><dt>Planned finish</dt><dd>{day.committed.length ? fmt(day.clock) : '—'}</dd></div></dl>
      <p>{token ? 'Connections are schematic; follow live directions when traveling.' : 'Schematic map · connections are not street-level directions.'}</p>
      <a className="mobile-map-jump" href="#itinerary-top">Back to itinerary ↑</a>
    </div>
  </aside>;
}
