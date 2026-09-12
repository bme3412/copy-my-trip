import assert from 'node:assert/strict';
import { CITIES } from '../src/cities';
import { generatePlan, PLAN_PRESETS } from '../src/lib/plan-presets';
import { buildCandidates, replayDay, returnFromDayTrip, stayLoc, stopPlace, truncateDay } from '../src/lib/planner';
import { defaultTrip } from '../src/state/TripContext';
import { acceptSnapshot } from '../src/lib/trips/snapshot';
import { clone, contentHash, validateSnapshot } from '../src/lib/trips/schema';
import { emptyData, loadLocal, saveLocal, STORAGE_KEY, type StoragePort } from '../src/lib/trips/local-store';
import { closureOverlaps, parseConditions } from '../src/lib/conditions/operations';
import { buildProposal, proposalContext } from '../src/lib/proposals/build';
import { closureFixture } from '../src/lib/proposals/fixtures';
import { acceptProposalSnapshot, persistProposal } from '../src/lib/proposals/validate';
import { diffDay } from '../src/lib/proposals/diff';
import { assembleBriefing } from '../src/lib/briefings/assemble';

let passed = 0;
function test(name: string, run: () => void) { run(); passed++; console.log('PASS ' + name); }
const city = CITIES.paris, now = new Date('2026-09-12T12:00:00Z');
const plan = generatePlan(city, PLAN_PRESETS[0], 4, 'balanced', stayLoc(city, city.hoodOrder[0]), '2026-09-13', [], 0);
const draft = { ...defaultTrip(city), arriving: '2026-09-13', departing: '2026-09-17', stayHood: city.hoodOrder[0],
  planSeed: 0, planId: plan.preset.id, days: plan.days, dayPaces: plan.paces, dayPurposes: plan.purposes, dayContexts: plan.contexts };
const base = acceptSnapshot(city, draft, undefined, now);
const conditions = closureFixture(city, base, 0, 1, 'all-day', now);
const proposal = buildProposal(city, base, 0, conditions, now);
const option = proposal.options[0];
assert.ok(option, 'Paris fixture must have a feasible alternative');
const memory = (): StoragePort => { const map = new Map<string, string>(); return { getItem: k => map.get(k) ?? null, setItem: (k, v) => { map.set(k, v); }, removeItem: k => { map.delete(k); } }; };
const seed = () => { const storage = memory(); saveLocal(storage, { ...emptyData(), drafts: { paris: draft }, snapshots: [base] }); return storage; };

test('deterministic, bounded alternatives leave catalog and accepted plan untouched', () => {
  const before = contentHash({ city, base, conditions });
  assert.deepEqual(buildProposal(city, base, 0, conditions, now), proposal);
  assert.ok(proposal.options.length > 0 && proposal.options.length <= 3);
  assert.equal(contentHash({ city, base, conditions }), before);
  for (const o of proposal.options) {
    assert.equal(o.day.committed.length, base.days[0].stops.length);
    assert.notEqual(o.day.committed[1].id, base.days[0].stops[1].id);
    const ids = base.draft.days.flatMap((d, i) => (i === 0 ? o.day : d).committed.map(s => s.id));
    assert.equal(new Set(ids).size, ids.length);
    assert.deepEqual(o.day.meals, base.days[0].state.meals);
  }
});
test('partial closures respect date, city, experience and half-open time boundaries', () => {
  const c = { ...conditions[0], experienceId: 'inside', from: 600, until: 720 };
  assert.equal(closureOverlaps(c, city.id, c.date, { id: c.placeId, experienceId: 'inside' }, 660, 30), true);
  assert.equal(closureOverlaps(c, city.id, c.date, { id: c.placeId, experienceId: 'outside' }, 660, 30), false);
  assert.equal(closureOverlaps(c, city.id, c.date, { id: c.placeId, experienceId: 'inside' }, 570, 30), false);
  assert.equal(closureOverlaps(c, city.id, c.date, { id: c.placeId, experienceId: 'inside' }, 720, 30), false);
  assert.equal(closureOverlaps(c, 'rome', c.date, { id: c.placeId, experienceId: 'inside' }, 660, 30), false);
  assert.equal(closureOverlaps(c, city.id, '2026-09-14', { id: c.placeId, experienceId: 'inside' }, 660, 30), false);
  assert.equal(buildProposal(city, base, 0, [{ ...conditions[0], from: 0, until: 1 }], now).status, 'unaffected');
});
test('candidate filtering and replay enforce the same closure', () => {
  const { stay, pace, opts } = proposalContext(city, base, 0), day = base.days[0].state;
  const cands = buildCandidates(city, truncateDay(city, day, 1, pace, stay), pace, new Set(), { ...opts, closures: conditions, limit: 128 });
  assert.ok(cands.every(c => c.p.id !== conditions[0].placeId));
  assert.ok(replayDay(city, day, pace, stay, { ...opts, closures: conditions }).flags.some(f => f.note.includes('operational closure')));
  for (const o of proposal.options) assert.equal(replayDay(city, o.day, pace, stay, { ...opts, closures: conditions }).flags.length, 0);
});
test('a closed experience can be replaced by an open experience at the same venue', () => {
  const c = clone(city), place = c.places.find(p => p.id === base.days[0].stops[1].id)!;
  place.experiences = [{ id: 'gallery', name: 'Fixture gallery' }, { id: 'garden', name: 'Fixture garden' }];
  const b = acceptSnapshot(c, draft, undefined, now);
  const cs = closureFixture(c, b, 0, 1, 'partial', now);
  assert.equal(cs[0].experienceId, 'gallery');
  const p = buildProposal(c, b, 0, cs, now);
  assert.ok(p.options.some(o => o.day.committed[1].id === place.id && o.day.committed[1].experienceId === 'garden'));
});
test('expired, unverified, retracted and future-retrieved evidence cannot propose a change', () => {
  const variants = [closureFixture(city, base, 0, 1, 'expired', now), [{ ...conditions[0], status: 'unverified' as const }],
    [{ ...conditions[0], status: 'retracted' as const }], [{ ...conditions[0], retrievedAt: new Date(+now + 60000).toISOString() }]];
  for (const cs of variants) { const p = buildProposal(city, base, 0, cs, now); assert.equal(p.options.length, 0); assert.equal(p.status, 'unavailable'); }
});
test('no feasible option and conflicting closures retain the original', () => {
  assert.equal(buildProposal(city, base, 0, closureFixture(city, base, 0, 1, 'no-options', now), now).options.length, 0);
  const second = closureFixture(city, base, 0, 2, 'all-day', now);
  const p = buildProposal(city, base, 0, [...conditions, ...second], now);
  assert.equal(p.options.length, 0); assert.match(p.reason, /Multiple/);
});
test('invalid scopes and incompatible saved versions are rejected', () => {
  for (const invalid of [{ ...conditions[0], until: 1500 }, { ...conditions[0], date: '2026-02-30' }, { ...conditions[0], source: { label: 'bad', url: 'javascript:alert(1)' } }]) assert.throws(() => parseConditions([invalid]));
  assert.throws(() => buildProposal(city, base, 0, [{ ...conditions[0], timeZone: 'Europe/Rome' }], now));
  assert.throws(() => buildProposal(city, base, 0, [{ ...conditions[0], experienceId: 'unknown' }], now));
  const old = clone(base); old.release.planner = 'unsupported';
  assert.throws(() => buildProposal(city, old, 0, conditions, now), /read-only/);
});
test('timed incumbents block replacement; timed suffixes keep exact slots', () => {
  const timed = base.days[1].state.committed.findIndex(s => stopPlace(city, s)?.timed);
  assert.ok(timed >= 0);
  const p = buildProposal(city, base, 1, closureFixture(city, base, 1, timed, 'all-day', now), now);
  assert.equal(p.options.length, 0); assert.match(p.reason, /commitment/);
  const lunch = base.days[1].state.committed.findIndex(s => s.meal === 'lunch');
  for (const o of buildProposal(city, base, 1, closureFixture(city, base, 1, lunch, 'all-day', now), now).options)
    base.days[1].state.committed.forEach((s, i) => { if (stopPlace(city, s)?.timed) assert.equal(o.day.committed[i].timeIn, s.timeIn); });
});
test('acceptance saves the exact preview and retains every other accepted day', () => {
  const original = clone(base), next = acceptProposalSnapshot(city, base, proposal, option.id, new Date(+now + 60000));
  validateSnapshot(next);
  assert.equal(next.parentId, base.id); assert.equal(next.tripId, base.tripId); assert.equal(next.demo, true);
  assert.deepEqual(next.days[0].state, option.day);
  assert.deepEqual(next.days.slice(1), base.days.slice(1)); assert.deepEqual(base, original);
  const { stay, pace, opts } = proposalContext(city, next, 0);
  assert.deepEqual(clone(replayDay(city, next.days[0].state, pace, stay, opts).day.committed), clone(option.day.committed));
  assert.ok(assembleBriefing(next, next.days[0].date).demo);
  const diff = diffDay(base.days[0].state, next.days[0].state);
  assert.equal(diff.filter(r => r.kind === 'removed').length, 1);
  assert.equal(diff.filter(r => r.kind === 'added').length, 1);
});
test('trailing waits and explicit return legs survive a replacement elsewhere', () => {
  const modified = clone(draft);
  modified.days[0] = returnFromDayTrip(city, modified.days[0], stayLoc(city, draft.stayHood));
  modified.days[0].trailingWaitUntil = 1440; modified.days[0].clock = 1440;
  const b = acceptSnapshot(city, modified, undefined, now);
  const p = buildProposal(city, b, 0, closureFixture(city, b, 0, 1, 'all-day', now), now);
  assert.ok(p.options.length); assert.equal(p.options[0].day.trailingWaitUntil, 1440);
  assert.equal(p.options[0].day.clock, 1440);
  assert.deepEqual(p.options[0].day.committed.at(-1)?.returnAfter, modified.days[0].committed.at(-1)?.returnAfter);
});
test('tampered and expired proposals cannot be accepted', () => {
  const altered = clone(proposal); altered.options[0].day.committed[0].timeIn++;
  assert.throws(() => acceptProposalSnapshot(city, base, altered, option.id, now), /changed/);
  assert.throws(() => acceptProposalSnapshot(city, base, proposal, option.id, new Date(proposal.expiresAt)), /expired/);
  assert.throws(() => acceptProposalSnapshot(city, base, proposal, 'unknown', now), /Choose/);
});
test('durable accept/reload appends once; duplicate acceptance and stale/deleted bases fail', () => {
  const storage = seed(), before = storage.getItem(STORAGE_KEY);
  // Rejecting a preview is no storage operation.
  buildProposal(city, base, 0, conditions, now); assert.equal(storage.getItem(STORAGE_KEY), before);
  const result = persistProposal(storage, city, proposal, option.id, new Date(+now + 60000));
  const loaded = loadLocal(storage); assert.equal(loaded.blocked, false);
  assert.deepEqual(loaded.data.snapshots, [base, result.snapshot]);
  assert.deepEqual(loaded.data.drafts.paris, result.snapshot.draft);
  assert.throws(() => persistProposal(storage, city, proposal, option.id, now), /newer version/);
  saveLocal(storage, { ...emptyData(), snapshots: [] });
  assert.throws(() => persistProposal(storage, city, proposal, option.id, now), /removed/);
});
test('acceptance preserves separate unaccepted working edits', () => {
  const storage = seed(), data = loadLocal(storage).data;
  data.drafts.paris.brief = 'A separate working edit'; saveLocal(storage, data);
  persistProposal(storage, city, proposal, option.id, new Date(+now + 60000));
  assert.equal(loadLocal(storage).data.drafts.paris.brief, 'A separate working edit');
});
test('quota and version bounds never report a successful save or alter the base', () => {
  const storage = seed(), before = storage.getItem(STORAGE_KEY);
  const quota = { ...storage, setItem: () => { throw Error('quota'); } };
  assert.throws(() => persistProposal(quota, city, proposal, option.id, now), /quota/);
  assert.equal(storage.getItem(STORAGE_KEY), before);
  const snapshots = [base, ...Array.from({ length: 19 }, (_, i) => ({ ...clone(base), id: `extra-${i}`, tripId: `other-${i}` }))];
  saveLocal(storage, { ...emptyData(), snapshots });
  assert.throws(() => persistProposal(storage, city, proposal, option.id, now), /Twenty/);
});
console.log(`${passed} proposal checks passed. No live sources, model calls or messages.`);
