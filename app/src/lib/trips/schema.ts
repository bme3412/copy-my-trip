import type { TripState } from '../../state/TripContext';
import type { DayState } from '../planner';
export const SNAPSHOT_SCHEMA = 1;
export const PLANNER_VERSION = 'local-companion-1';
export interface FrozenStop {
    id: string;
    experienceId?: string;
    name: string;
    area: string;
    timeIn: number;
    dur: number;
    travelMin: number;
    travelMode: 'walk' | 'metro';
    source: 'verified' | 'web';
    description: string;
    evidence: string;
    directions: string;
    image?: {
        url: string;
        caption: string;
    };
    timed: boolean;
    returnAfter?: {
        min: number;
        mode: string;
        destination: string;
    };
}
export interface SnapshotDay {
    date: string;
    title: string;
    purpose: string;
    state: DayState;
    stops: FrozenStop[];
    warnings: string[];
}
export interface PlanSnapshot {
    schemaVersion: 1;
    id: string;
    tripId: string;
    parentId?: string;
    acceptedAt: string;
    cityId: string;
    cityName: string;
    timeZone: string;
    demo: boolean;
    release: {
        planner: string;
        catalog: string;
    };
    inputsHash: string;
    draft: TripState;
    days: SnapshotDay[];
}
/** Stable identity/checksum, not authentication or a cryptographic signature. */
export function canonical(value: unknown): string {
    if (Array.isArray(value))
        return '[' + value.map(canonical).join(',') + ']';
    if (value && typeof value === 'object')
        return '{' + Object.entries(value).filter(([, v]) => v !== undefined).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).map(([k, v]) => JSON.stringify(k) + ':' + canonical(v)).join(',') + '}';
    return JSON.stringify(value) ?? 'null';
}
export function contentHash(value: unknown): string {
    const str = canonical(value);
    let a = 2166136261;
    let b = 5381;
    for (let i = 0; i < str.length; i++) {
        a = Math.imul(a ^ str.charCodeAt(i), 16777619);
        b = Math.imul(b, 33) ^ str.charCodeAt(i);
    }
    return (a >>> 0).toString(16).padStart(8, '0') + (b >>> 0).toString(16).padStart(8, '0');
}
export const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v));
export function isDate(v: unknown): v is string {
    return typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) && Number.isFinite(Date.parse(v)) && new Date(v + 'T12:00:00Z').toISOString().slice(0, 10) === v;
}
export function addDate(date: string, days: number): string {
    if (!isDate(date))
        throw new Error('Choose a valid date.');
    const d = new Date(date + 'T12:00:00Z');
    d.setUTCDate(d.getUTCDate() + days);
    return d.toISOString().slice(0, 10);
}
export function dateInZone(now: Date, timeZone: string): string {
    const p = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now);
    return `${p.find(x => x.type === 'year')!.value}-${p.find(x => x.type === 'month')!.value}-${p.find(x => x.type === 'day')!.value}`;
}
export function plannedDays(t: Pick<TripState, 'arriving' | 'departing'>): number {
    if (!isDate(t.arriving) || !isDate(t.departing))
        return 0;
    const n = Math.round((Date.parse(t.departing) - Date.parse(t.arriving)) / 86400000);
    return n >= 1 && n <= 7 ? n : 0;
}
export function record(v: unknown): asserts v is Record<string, unknown> {
    if (!v || typeof v !== 'object' || Array.isArray(v))
        throw new Error('Expected an object.');
}
export function text(v: unknown): asserts v is string { if (typeof v !== 'string' || v.length > 20000)
    throw new Error('Invalid text.'); }
export function num(v: unknown, max = 10000): asserts v is number { if (typeof v !== 'number' || !Number.isFinite(v) || v < 0 || v > max)
    throw new Error('Invalid number.'); }
export function list(v: unknown, max = 200): asserts v is unknown[] { if (!Array.isArray(v) || v.length > max)
    throw new Error('Invalid list.'); }
function enumValue(v: unknown, options: unknown[]) { if (!options.includes(v))
    throw new Error('Invalid value.'); }
/** Bounds all JSON, including optional/future fields, before rendering or restoring. */
export function boundedJson(v: unknown, depth = 0): void {
    if (depth > 24)
        throw new Error('Saved data is too deeply nested.');
    if (typeof v === 'string')
        text(v);
    else if (typeof v === 'number' && !Number.isFinite(v))
        throw new Error('Invalid number.');
    else if (Array.isArray(v)) {
        list(v, 1000);
        v.forEach(x => boundedJson(x, depth + 1));
    }
    else if (v && typeof v === 'object')
        for (const [k, x] of Object.entries(v)) {
            if (['__proto__', 'prototype', 'constructor'].includes(k))
                throw new Error('Unsafe saved key.');
            boundedJson(x, depth + 1);
        }
}
export function validateDay(v: unknown): void {
    record(v);
    num(v.clock);
    if (v.trailingWaitUntil !== undefined)
        num(v.trailingWaitUntil);
    record(v.loc);
    for (const k of ['lat', 'lon'])
        if (typeof v.loc[k] !== 'number' || !Number.isFinite(v.loc[k]))
            throw new Error('Invalid location.');
    record(v.meals);
    for (const k of ['coffee', 'lunch', 'dinner'])
        enumValue(v.meals[k], [true, false]);
    list(v.committed, 30);
    for (const s of v.committed) {
        record(s);
        for (const k of ['id', 'name', 'area', 'label'])
            text(s[k]);
        enumValue(s.src, ['verified', 'web']);
        enumValue(s.group, ['food', 'sight', 'indoor', 'park']);
        enumValue(s.meal, [null, 'coffee', 'lunch', 'dinner']);
        enumValue(s.travelMode, ['walk', 'metro']);
        enumValue(s.measured, [true, false]);
        for (const k of ['timeIn', 'dur', 'travelMin'])
            num(s[k]);
        if (s.experienceId !== undefined)
            text(s.experienceId);
        if (s.timing) {
            record(s.timing);
            for (const k of ['notBefore', 'duration', 'linger'])
                num(s.timing[k]);
        }
        if (s.returnAfter) {
            record(s.returnAfter);
            num(s.returnAfter.min);
            enumValue(s.returnAfter.mode, ['walk', 'metro']);
            record(s.returnAfter.to);
            text(s.returnAfter.to.name);
            text(s.returnAfter.to.area);
            for (const k of ['lat', 'lon'])
                if (typeof s.returnAfter.to[k] !== 'number')
                    throw new Error('Invalid return location.');
        }
        if (s.reasons) {
            list(s.reasons);
            for (const r of s.reasons) {
                record(r);
                text(r.note);
                text(r.term);
                if (typeof r.value !== 'number')
                    throw new Error('Invalid reason.');
            }
        }
    }
    if (v.flags) {
        list(v.flags);
        for (const f of v.flags) {
            record(f);
            num(f.index, 30);
            text(f.note);
        }
    }
}
export function validateDraft(v: unknown): asserts v is TripState {
    record(v);
    for (const k of ['arriving', 'departing', 'stayHood'])
        text(v[k]);
    enumValue(v.pace, ['gentle', 'balanced', 'full']);
    if (v.planId !== null)
        text(v.planId);
    list(v.interests, 20);
    v.interests.forEach(text);
    list(v.days, 7);
    if (v.days.length !== 7)
        throw new Error('Expected seven working day slots.');
    v.days.forEach(validateDay);
    if (v.unplaced) { list(v.unplaced); for (const r of v.unplaced) { record(r); text(r.placeId); text(r.reason); } }
    if (v.planSeed !== undefined)
        num(v.planSeed);
    for (const key of ['originPresetId', 'brief'])
        if (v[key] !== undefined)
            text(v[key]);
    for (const key of ['demo', 'edited'])
        if (v[key] !== undefined)
            enumValue(v[key], [true, false]);
    for (const key of ['arriving', 'departing'])
        if (v[key] !== '' && !isDate(v[key]))
            throw new Error('Invalid draft date.');
    if (v.scheduledFor) {
        record(v.scheduledFor);
        for (const key of ['arriving', 'departing', 'stayHood'])
            text(v.scheduledFor[key]);
    }
    if (v.release) {
        record(v.release);
        text(v.release.planner);
        text(v.release.catalog);
    }
    if (v.dayPaces) {
        list(v.dayPaces, 7);
        v.dayPaces.forEach(p => enumValue(p, ['gentle', 'balanced', 'full']));
    }
    if (v.dayPurposes) {
        list(v.dayPurposes, 7);
        v.dayPurposes.forEach(text);
    }
    if (v.dayContexts) {
        list(v.dayContexts, 7);
        for (const c of v.dayContexts) {
            if (!c)
                continue;
            record(c);
            text(c.purpose);
            enumValue(c.pace, ['gentle', 'balanced', 'full']);
            record(c.profile);
            record(c.opts);
            if (c.opts.closures !== undefined || c.opts.allowSamePlaceExperience !== undefined)
                throw new Error('Temporary proposal constraints cannot be stored as permanent day context.');
            for (const bias of ['themeBias', 'themeAvoid'])
                if (c.opts[bias]) {
                    record(c.opts[bias]);
                    list(c.opts[bias].themes, 10);
                    c.opts[bias].themes.forEach(text);
                    num(c.opts[bias].weight, 100);
                }
            for (const key of ['maxStops', 'rankWeight', 'limit', 'weekday'])
                if (c.opts[key] !== undefined)
                    num(c.opts[key], 100);
            if (c.opts.pins) {
                list(c.opts.pins);
                for (const pin of c.opts.pins) {
                    record(pin);
                    text(pin.id);
                    if (pin.notBefore !== undefined)
                        num(pin.notBefore);
                }
            }
            for (const key of ['blockAnchors', 'blockTimed', 'deepCuts'])
                if (c.opts[key] !== undefined)
                    enumValue(c.opts[key], [true, false]);
            for (const k of ['exclude', 'usedHoods'])
                if (c.opts[k]) {
                    list(c.opts[k]);
                    c.opts[k].forEach(text);
                }
        }
    }
    if (v.extracted) {
        record(v.extracted);
        list(v.extracted.interests, 20);
        v.extracted.interests.forEach(text);
        if (v.extracted.requests) {
            list(v.extracted.requests);
            for (const r of v.extracted.requests) {
                record(r);
                text(r.placeId);
                enumValue(r.kind, ['include', 'avoid']);
            }
        }
    }
    if (v.dayNarrations) {
        record(v.dayNarrations);
        for (const n of Object.values(v.dayNarrations)) {
            record(n);
            text(n.key);
            text(n.text);
        }
    }
}
export function validateSnapshot(v: unknown): asserts v is PlanSnapshot {
    record(v);
    if (v.schemaVersion !== 1)
        throw new Error('Unsupported snapshot schema. Export it for recovery; nothing has been deleted.');
    for (const k of ['id', 'tripId', 'acceptedAt', 'cityId', 'cityName', 'timeZone', 'inputsHash'])
        text(v[k]);
    if (!Number.isFinite(Date.parse(v.acceptedAt as string)))
        throw new Error('Invalid acceptance time.');
    new Intl.DateTimeFormat('en', { timeZone: v.timeZone as string });
    record(v.release);
    text(v.release.planner);
    text(v.release.catalog);
    enumValue(v.demo, [true, false]);
    validateDraft(v.draft);
    list(v.days, 7);
    if (plannedDays(v.draft) === 0 || v.days.length !== plannedDays(v.draft))
        throw new Error('Snapshot dates do not match its days.');
    for (const [i, d] of v.days.entries()) {
        record(d);
        if (d.date !== addDate(v.draft.arriving, i))
            throw new Error('Invalid snapshot day date.');
        text(d.title);
        text(d.purpose);
        validateDay(d.state);
        list(d.stops, 30);
        list(d.warnings);
        d.warnings.forEach(text);
        const state = d.state as DayState;
        if (canonical(state) !== canonical(v.draft.days[i]))
            throw new Error('Accepted day differs from its saved draft.');
        if (d.stops.length !== state.committed.length)
            throw new Error('Snapshot stops do not match.');
        for (const [j, s] of d.stops.entries()) {
            record(s);
            for (const k of ['id', 'name', 'area', 'description', 'evidence', 'directions'])
                text(s[k]);
            enumValue(s.source, ['verified', 'web']);
            enumValue(s.timed, [true, false]);
            enumValue(s.travelMode, ['walk', 'metro']);
            for (const k of ['timeIn', 'dur', 'travelMin'])
                num(s[k]);
            const c = state.committed[j];
            if (s.id !== c.id || s.experienceId !== c.experienceId || s.timeIn !== c.timeIn || s.dur !== c.dur || s.travelMin !== c.travelMin || s.travelMode !== c.travelMode || s.source !== c.src)
                throw new Error('Snapshot display differs from accepted output.');
            if (s.image) {
                record(s.image);
                text(s.image.url);
                text(s.image.caption);
            }
            if (s.returnAfter) {
                record(s.returnAfter);
                num(s.returnAfter.min);
                text(s.returnAfter.mode);
                text(s.returnAfter.destination);
            }
        }
    }
}
