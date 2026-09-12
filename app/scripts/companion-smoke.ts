import assert from 'node:assert/strict';
import { CITIES } from '../src/cities';
import { generatePlan, PLAN_PRESETS, restoreDayContext } from '../src/lib/plan-presets';
import { replayDay, removeAt, stayLoc, stopPlace } from '../src/lib/planner';
import { defaultTrip } from '../src/state/TripContext';
import { acceptSnapshot, canEdit, catalogVersion } from '../src/lib/trips/snapshot';
import { addDate, clone, dateInZone, PLANNER_VERSION, validateSnapshot } from '../src/lib/trips/schema';
import { emptyData, importLegacy, LEGACY_KEY, loadLocal, parseLocal, saveLocal, STORAGE_KEY, type StoragePort } from '../src/lib/trips/local-store';
import { assembleBriefing, briefingHtml, briefingText, scheduleLine } from '../src/lib/briefings/assemble';
import { safeUrl } from '../src/lib/briefings/schema';
import { dayContentKey } from '../src/lib/narrate';
let passed = 0;
function test(name: string, fn: () => void) { fn(); passed++; console.log('PASS ' + name); }
const city = CITIES.paris;
function fixture(cityId = 'paris', count = 7) {
    const c = CITIES[cityId], stay = stayLoc(c, c.hoodOrder[0]), arriving = '2026-09-12';
    const plan = generatePlan(c, PLAN_PRESETS[0], count, 'balanced', stay, arriving, [], 0);
    const draft = { ...defaultTrip(c), arriving, departing: addDate(arriving, count), stayHood: c.hoodOrder[0], planSeed: 0, planId: plan.preset.id, originPresetId: plan.preset.id, days: plan.days, dayPaces: plan.paces, dayPurposes: plan.purposes, dayContexts: plan.contexts, release: { planner: PLANNER_VERSION, catalog: catalogVersion(c) } };
    return { c, stay, plan, draft, snapshot: acceptSnapshot(c, draft, undefined, new Date('2026-09-12T10:00:00Z')) };
}
const f = fixture();
const memory = (): StoragePort => { const map = new Map<string, string>(); return { getItem: k => map.get(k) ?? null, setItem: (k, v) => { map.set(k, v); }, removeItem: k => { map.delete(k); } }; };
test('save/load preserves every accepted fact and resolved context', () => {
    const s = memory();
    const data = { ...emptyData(), drafts: { paris: f.draft }, snapshots: [f.snapshot] };
    saveLocal(s, data);
    assert.deepEqual(loadLocal(s).data, JSON.parse(JSON.stringify(data)));
    assert.deepEqual(loadLocal(s).data.snapshots[0].days.map(d => d.state), clone(f.draft.days));
});
for (const cityId of ['paris', 'rome'])
    test(`${cityId}: full no-op replay preserves timing, durations, waits and return legs`, () => {
        const f = fixture(cityId);
        f.plan.days.forEach((day, i) => {
            const r = replayDay(f.c, day, f.plan.paces[i], f.stay, restoreDayContext(f.plan.contexts[i]).opts);
            assert.deepEqual(clone(r.day.committed), clone(day.committed), `${cityId} day ${i + 1}`);
            assert.equal(r.day.clock, day.clock);
            assert.equal(r.day.loc.lat, day.loc.lat);
            assert.equal(r.day.loc.lon, day.loc.lon);
        });
        if (cityId === 'rome')
            assert.equal(f.plan.days[3].committed.find(s => s.meal === 'lunch')?.timeIn, 723);
        if (cityId === 'paris') {
            const day = f.plan.days[5];
            assert.ok(day.committed[0].returnAfter);
            assert.equal(day.committed.at(-1)?.travelMin, 5);
        }
    });
test('edit preserves origin context and never mutates accepted output', () => {
    const before = clone(f.snapshot);
    const ctx = restoreDayContext(f.plan.contexts[1]);
    const r = removeAt(city, f.draft.days[1], 1, f.plan.paces[1], f.stay, ctx.opts);
    const draft = { ...f.draft, edited: true, days: f.draft.days.map((d, i) => i === 1 ? { ...r.day, flags: r.flags } : d) };
    const next = acceptSnapshot(city, draft, f.snapshot, new Date('2026-09-12T10:01:00Z'));
    assert.equal(next.parentId, f.snapshot.id);
    assert.equal(next.draft.originPresetId, f.draft.originPresetId);
    assert.deepEqual(next.draft.dayContexts, f.snapshot.draft.dayContexts);
    assert.deepEqual(f.snapshot, before);
    assert.notEqual(next.id, f.snapshot.id);
    assert.notEqual(assembleBriefing(next, next.days[1].date).id, assembleBriefing(f.snapshot, f.snapshot.days[1].date).id);
});
test('unknown experience blocks edits; old engine still renders snapshot', () => {
    const old = clone(f.snapshot);
    old.release.planner = 'retired-engine';
    assert.equal(canEdit(old, city), false);
    assert.equal(assembleBriefing(old, old.days[0].date).stops.length, old.days[0].stops.length);
    const day = clone(f.draft.days[0]);
    day.committed[0].experienceId = 'unknown-interior';
    assert.equal(stopPlace(city, day.committed[0]), undefined);
    const r = removeAt(city, day, 1, 'balanced', f.stay);
    assert.equal(r.day, day);
    assert.ok(r.flags.length);
});
test('corrupt, unsupported, and oversized data preserved for recovery', () => {
    for (const raw of ['{broken', '{"schemaVersion":42}', 'x'.repeat(3000001)]) {
        const s = memory();
        s.setItem(STORAGE_KEY, raw);
        const r = loadLocal(s);
        assert.equal(r.blocked, true);
        assert.equal(r.recovery, raw);
        assert.equal(s.getItem(STORAGE_KEY), raw);
    }
    const tampered = clone(f.snapshot);
    tampered.days[0].stops[0].timeIn += 10;
    assert.throws(() => validateSnapshot(tampered));
});
test('storage denial and quota keep caller data usable', () => {
    const blocked: StoragePort = { getItem: () => { throw Error('denied'); }, setItem: () => { throw Error('quota'); }, removeItem: () => { throw Error('denied'); } };
    assert.equal(loadLocal(blocked).blocked, true);
    assert.throws(() => saveLocal(blocked, { ...emptyData(), snapshots: [f.snapshot] }));
    assert.ok(assembleBriefing(f.snapshot, f.snapshot.days[0].date).stops.length);
});
test('legacy state remains original and can only import as drafts', () => {
    const s = memory(), raw = JSON.stringify({ paris: f.draft });
    s.setItem(LEGACY_KEY, raw);
    const r = loadLocal(s);
    assert.equal(r.blocked, true);
    assert.equal(r.data.snapshots.length, 0);
    assert.equal(importLegacy(raw).paris.arriving, f.draft.arriving);
    assert.equal(s.getItem(LEGACY_KEY), raw);
});
test('plain text and HTML preserve schedule and provenance without models', () => {
    const b = assembleBriefing(f.snapshot, f.snapshot.days[0].date), html = briefingHtml(b, 'https://example.test'), text = briefingText(b);
    for (const s of b.stops) {
        assert.ok(text.includes(scheduleLine(s)));
        assert.ok(text.includes(s.evidence));
        assert.ok(html.includes(scheduleLine(s)));
        assert.equal(s.source, f.snapshot.days[0].state.committed.find(c => c.id === s.id)!.src);
    }
    assert.ok(html.includes(b.planId));
    assert.ok(text.includes('not connected'));
    assert.ok(html.includes('No email has been sent'));
});
test('HTML escaping and links resist injected scripts, handlers and schemes', () => {
    const b = assembleBriefing(f.snapshot, f.snapshot.days[0].date);
    b.title = '<script>alert(1)</script>';
    b.stops[0].name = '" onload="alert(1)';
    b.stops[0].directions = 'javascript:alert(1)';
    b.stops[0].image = { url: 'data:text/html,<script>x</script>', caption: '<img onerror=x>' };
    const html = briefingHtml(b);
    assert.ok(!html.includes('<script>'));
    assert.ok(!html.includes('href="javascript:'));
    assert.ok(!html.includes('src="data:'));
    assert.ok(html.includes('&lt;script&gt;'));
    for (const u of ['//evil.test', 'javascript:alert(1)', 'data:x', '/\\evil.test', 'https://a.test/\nx'])
        assert.equal(safeUrl(u), undefined);
});
test('Rome has no Paris imagery; evidence gaps stay explicit', () => {
    const r = fixture('rome');
    for (const day of r.snapshot.days)
        for (const s of day.stops) {
            assert.equal(s.source, 'web');
            assert.equal(s.image, undefined);
            assert.ok(s.evidence.includes('no firsthand'));
        }
    const d = clone(f.draft);
    d.days[0].committed[0] = { ...d.days[0].committed[0], id: 'cafehugo', experienceId: undefined, src: 'verified' };
    const snap = acceptSnapshot(city, d);
    assert.ok(snap.days[0].stops[0].evidence.includes('unavailable'));
});
test('preview dates never modify trip; calendar dates survive DST and host zones', () => {
    const before = JSON.stringify(f.snapshot);
    assert.equal(assembleBriefing(f.snapshot, '2026-09-11').status, 'before');
    assert.equal(assembleBriefing(f.snapshot, '2026-09-20').status, 'completed');
    assert.equal(assembleBriefing(f.snapshot, '2026-09-17').status, 'travel');
    assert.equal(addDate('2026-03-28', 1), '2026-03-29');
    assert.equal(addDate('2026-10-24', 1), '2026-10-25');
    assert.equal(dateInZone(new Date('2026-09-12T23:30:00Z'), 'Europe/Paris'), '2026-09-13');
    assert.equal(dateInZone(new Date('2026-09-12T23:30:00Z'), 'America/New_York'), '2026-09-12');
    assert.equal(JSON.stringify(f.snapshot), before);
    const empty = clone(f.snapshot);
    empty.days[0].state.committed = [];
    empty.days[0].stops = [];
    empty.draft.days[0].committed = [];
    assert.equal(assembleBriefing(empty, empty.days[0].date).status, 'empty');
});
test('narration cache includes city, date, experience and resolved context', () => {
    const d = f.draft.days[0], a = dayContentKey(d, { city: 'paris', date: '2026-09-12' });
    assert.notEqual(a, dayContentKey(d, { city: 'rome', date: '2026-09-12' }));
    assert.notEqual(a, dayContentKey(d, { city: 'paris', date: '2026-09-13' }));
    const changed = clone(d);
    changed.committed[0].experienceId = 'another';
    assert.notEqual(a, dayContentKey(changed, { city: 'paris', date: '2026-09-12' }));
});
test('malformed nested display data is rejected before rendering', () => {
    const data = { ...emptyData(), snapshots: [clone(f.snapshot)] };
    (data.snapshots[0].days[0].stops[0] as unknown as Record<string, unknown>).name = { bad: true };
    assert.throws(() => parseLocal(JSON.stringify(data)));
});
test('empty accepted envelopes cannot reach the renderer', () => {
    const empty = clone(f.snapshot);
    empty.days = []; empty.draft.arriving = ''; empty.draft.departing = '';
    assert.throws(() => validateSnapshot(empty));
});
test('changed dates or home base require a newly generated schedule', () => {
    const draft = { ...f.draft, scheduledFor: { arriving: f.draft.arriving, departing: f.draft.departing, stayHood: f.draft.stayHood } };
    assert.throws(() => acceptSnapshot(city, { ...draft, arriving: '2026-09-13' }), /freshly generated/);
    assert.throws(() => acceptSnapshot(city, { ...draft, stayHood: 'another neighborhood' }), /freshly generated/);
});
console.log(`${passed} companion checks passed`);
