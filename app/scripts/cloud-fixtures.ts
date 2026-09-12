import { CITIES } from '../src/cities';
import { generatePlan, PLAN_PRESETS } from '../src/lib/plan-presets';
import { stayLoc } from '../src/lib/planner';
import { defaultTrip } from '../src/state/TripContext';
import { acceptSnapshot, catalogVersion } from '../src/lib/trips/snapshot';
import { addDate, PLANNER_VERSION } from '../src/lib/trips/schema';
export function cloudFixture(cityId = 'paris', arriving = '2026-09-13', acceptedAt = new Date(arriving + 'T10:00:00Z')) {
  const city = CITIES[cityId];
  const plan = generatePlan(city, PLAN_PRESETS[0], 2, 'balanced', stayLoc(city, city.hoodOrder[0]), arriving, [], 0);
  return acceptSnapshot(city, { ...defaultTrip(city), arriving, departing: addDate(arriving, 2), stayHood: city.hoodOrder[0], planSeed: 0,
    planId: plan.preset.id, originPresetId: plan.preset.id, days: plan.days, dayPaces: plan.paces, dayPurposes: plan.purposes, dayContexts: plan.contexts,
    release: { planner: PLANNER_VERSION, catalog: catalogVersion(city) } }, undefined, acceptedAt, true);
}
export const cloudSegments = [cloudFixture(), cloudFixture('rome', '2026-09-16'), cloudFixture('paris', '2026-09-19')].map(snapshot => ({ id: snapshot.tripId, snapshot }));
