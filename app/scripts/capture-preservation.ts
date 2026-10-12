// Explicit baseline capture only. Never run automatically in CI.
import { writeFileSync } from 'node:fs';
import { CITIES } from '../src/cities';
import { generatePlan, PLAN_PRESETS } from '../src/lib/plan-presets';
import { stayLoc } from '../src/lib/planner';
import { defaultTrip } from '../src/state/TripContext';
import { acceptSnapshot, catalogVersion } from '../src/lib/trips/snapshot';
import { PLANNER_VERSION } from '../src/lib/trips/schema';
const snapshots = Object.values(CITIES).map(city => {
  const arriving = '2026-09-12';
  const plan = generatePlan(city, PLAN_PRESETS[0], 7, 'balanced', stayLoc(city, city.hoodOrder[0]), arriving, [], 0);
  return acceptSnapshot(city, { ...defaultTrip(city), arriving, departing: '2026-09-19', stayHood: city.hoodOrder[0], planSeed: 0,
    planId: plan.preset.id, originPresetId: plan.preset.id, days: plan.days, dayPaces: plan.paces, dayPurposes: plan.purposes, dayContexts: plan.contexts,
    dayNarrations: { '0': { key: 'synthetic-preservation-fixture', text: 'A saved demonstration introduction.' } },
    release: { planner: PLANNER_VERSION, catalog: catalogVersion(city) } }, undefined, new Date('2026-09-12T10:00:00Z'), true);
});
writeFileSync('scripts/fixtures/preservation/accepted-v1.json', JSON.stringify(snapshots, null, 2) + '\n');
writeFileSync('scripts/fixtures/preservation/contracts.json', JSON.stringify({ schemaVersion: 1, planner: PLANNER_VERSION, storageKey: 'cmt-local-companion-v1', legacyKey: 'cmt-trips-v3', catalogs: Object.fromEntries(Object.values(CITIES).map(c => [c.id, catalogVersion(c)])) }, null, 2) + '\n');
