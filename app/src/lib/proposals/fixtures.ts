import type { City } from '../../cities/types';
import { stopPlace } from '../planner';
import type { PlanSnapshot } from '../trips/schema';
import type { OperationalCondition } from '../conditions/operations';

export type ClosureScenario = 'all-day' | 'partial' | 'expired' | 'no-options';
/** Imported only by the development preview and offline tests. */
export function closureFixture(city: City, base: PlanSnapshot, dayIndex: number, stopIndex: number, scenario: ClosureScenario, now = new Date()): OperationalCondition[] {
  const day = base.days[dayIndex], stop = day.state.committed[stopIndex];
  if (!stop) throw Error('Choose a saved stop.');
  const preserved = new Set(day.state.committed.filter((_, i) => i !== stopIndex).map(s => s.id));
  const ids = scenario === 'no-options' ? city.places.filter(p => !preserved.has(p.id)).map(p => p.id) : [stop.id];
  return ids.map(id => ({ schemaVersion: 1, id: `simulation-${scenario}-${id}`, cityId: city.id, timeZone: city.timeZone,
    date: day.date, placeId: id, experienceId: scenario === 'partial' ? stopPlace(city, stop)?.experienceId : undefined,
    from: scenario === 'partial' ? stop.timeIn : 0, until: scenario === 'partial' ? Math.min(1440, stop.timeIn + stop.dur) : 1440,
    effect: 'closed', status: 'simulated', source: { label: 'Local closure simulation · no live source' },
    retrievedAt: new Date(+now - 2 * 3600000).toISOString(), expiresAt: new Date(+now + (scenario === 'expired' ? -60000 : 3600000)).toISOString() }));
}
