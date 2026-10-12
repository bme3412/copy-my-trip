import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { CITIES } from '../src/cities';
import { catalogVersion, canEdit } from '../src/lib/trips/snapshot';
import { canonical, clone, PLANNER_VERSION, SNAPSHOT_SCHEMA, validateSnapshot, type PlanSnapshot } from '../src/lib/trips/schema';
import { STORAGE_KEY, LEGACY_KEY, parseLocal, loadLocal, importLegacy } from '../src/lib/trips/local-store';
import { replayDay, stayLoc } from '../src/lib/planner';
import { restoreDayContext } from '../src/lib/plan-presets';
import { assembleBriefing } from '../src/lib/briefings/assemble';
const contracts = JSON.parse(readFileSync('scripts/fixtures/preservation/contracts.json','utf8'));
const snapshots: PlanSnapshot[] = JSON.parse(readFileSync('scripts/fixtures/preservation/accepted-v1.json','utf8'));
assert.equal(PLANNER_VERSION, contracts.planner); assert.equal(SNAPSHOT_SCHEMA, contracts.schemaVersion);
assert.equal(STORAGE_KEY, contracts.storageKey); assert.equal(LEGACY_KEY, contracts.legacyKey);
for (const s of snapshots) {
  const before = canonical(s), city = CITIES[s.cityId];
  assert.equal(catalogVersion(city), contracts.catalogs[city.id]); validateSnapshot(s); assert.ok(canEdit(s, city));
  const data = {schemaVersion:1, drafts:{[city.id]:s.draft}, snapshots:[s]};
  assert.equal(canonical(parseLocal(JSON.stringify(data))),canonical(data));
  for (const [i,d] of s.days.entries()) {
    const result = replayDay(city,d.state,s.draft.dayPaces![i],stayLoc(city,s.draft.stayHood),restoreDayContext(s.draft.dayContexts![i]!).opts);
    assert.deepEqual(clone(result.day.committed), d.state.committed);
    assert.equal(result.day.clock,d.state.clock);
    assert.equal(assembleBriefing(s,d.date).stops.length,d.stops.length);
  }
  for (const release of [{...s.release,planner:'retired-engine'}, {...s.release,catalog:'retired-catalog'}]) {
    const old = {...clone(s),release}; validateSnapshot(old); assert.equal(canEdit(old,city),false);
    assert.deepEqual(assembleBriefing(old,old.days[0].date).stops,assembleBriefing(s,s.days[0].date).stops);
  }
  assert.equal(canonical(s),before);
  const raw = JSON.stringify({[city.id]:s.draft});
  assert.deepEqual(importLegacy(raw),{[city.id]:s.draft});
  const legacy = loadLocal({getItem:k=>k===LEGACY_KEY?raw:null,setItem:()=>assert.fail('must not write'),removeItem:()=>assert.fail('must not remove')});
  assert.ok(legacy.blocked); assert.equal(legacy.recovery,raw);
}
for (const raw of ['{broken','{"schemaVersion":42}']) {
  const result = loadLocal({getItem:()=>raw,setItem:()=>assert.fail('must preserve'),removeItem:()=>assert.fail('must preserve')});
  assert.ok(result.blocked); assert.equal(result.recovery,raw);
}
assert.ok(snapshots.some(s=>s.days.some(d=>d.stops.some(x=>x.returnAfter))));
assert.ok(snapshots.some(s=>s.days.some(d=>d.stops.some(x=>x.experienceId))));
assert.ok(snapshots.every(s=>s.draft.dayNarrations?.['0']));
console.log('PASS preservation: frozen Paris/Rome snapshots, catalog hashes, storage keys, replay, retired releases, narration and recovery');
