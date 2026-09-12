import type { City } from '../../cities/types';
import type { TripState } from '../../state/TripContext';
import { builtDayTitle } from '../built-day';
import { mediaUrl, placeDatesLabel, fileDateLabel } from '../media';
import { stopPlace } from '../planner';
import { addDate, clone, contentHash, plannedDays, PLANNER_VERSION, validateSnapshot, type PlanSnapshot } from './schema';
export function catalogVersion(city: City): string { return contentHash(city); }
export function canEdit(snapshot: PlanSnapshot, city: City): boolean {
    return snapshot.release.planner === PLANNER_VERSION && snapshot.release.catalog === catalogVersion(city);
}
export function draftHash(draft: TripState): string {
    const { dayNarrations: _narrations, ...facts } = draft;
    return contentHash(facts);
}
export function acceptSnapshot(city: City, draft: TripState, previous?: PlanSnapshot, now = new Date(), demo = false): PlanSnapshot {
    if (draft.scheduledFor && (draft.arriving !== draft.scheduledFor.arriving || draft.departing !== draft.scheduledFor.departing || draft.stayHood !== draft.scheduledFor.stayHood))
        throw new Error('Dates or home base changed. Choose a freshly generated plan before accepting its schedule.');
    const count = plannedDays(draft);
    if (!count)
        throw new Error('Choose valid dates for 1–7 days. Departure is the checkout date.');
    if (!draft.days.slice(0, count).some(d => d.committed.length))
        throw new Error('Build at least one day before accepting this trip.');
    const inputsHash = draftHash(draft);
    const id = `plan-${now.getTime().toString(36)}-${inputsHash}`;
    const snapshot: PlanSnapshot = {
        schemaVersion: 1, id, tripId: previous?.tripId ?? id, parentId: previous?.id,
        acceptedAt: now.toISOString(), cityId: city.id, cityName: city.name,
        timeZone: city.timeZone, demo, release: { planner: PLANNER_VERSION, catalog: catalogVersion(city) }, inputsHash,
        draft: clone(draft), days: draft.days.slice(0, count).map((state, i) => ({
            date: addDate(draft.arriving, i), title: builtDayTitle(city, state), purpose: draft.dayPurposes?.[i] ?? '', state: clone(state),
            warnings: [...(state.flags ?? []).map(f => `${state.committed[f.index]?.name ?? 'Day'}: ${f.note}`), ...(i === 0 ? (draft.unplaced ?? []).map(r => `Unplaced request (${r.placeId}): ${r.reason}`) : [])],
            stops: state.committed.map(s => {
                const place = stopPlace(city, s);
                if (!place)
                    throw new Error(`Review ${s.name}: its saved experience is not in this catalog.`);
                const media = city.media[s.id];
                const plate = s.src === 'verified' ? media?.plates?.find(p => city.slotFiles?.[p.id]?.img) : undefined;
                const file = plate && city.slotFiles?.[plate.id]?.img;
                const note = city.places.find(p => p.id === s.id)?.experiences?.find(e => e.id === s.experienceId)?.note;
                const dates = s.src === 'verified' ? placeDatesLabel(city, s.id) : null;
                return {
                    id: s.id, experienceId: s.experienceId, name: s.name, area: s.area, timeIn: s.timeIn, dur: s.dur,
                    travelMin: s.travelMin, travelMode: s.travelMode, source: s.src,
                    description: note ?? (s.experienceId && s.src === 'web' ? 'Researched experience; not documented by a firsthand visit.' : media?.desc ?? ''),
                    evidence: s.src === 'web' ? 'Web-researched experience · no firsthand archive evidence' : file ? `Firsthand archive${dates ? ' · ' + dates : ''} · historical visit, not current operating information` : 'Marked firsthand in the catalog · archive image unavailable',
                    image: file && plate ? { url: mediaUrl(city.id, file), caption: plate.caption + (fileDateLabel(city, file) ? ' · ' + fileDateLabel(city, file) : '') } : undefined,
                    directions: `https://www.google.com/maps/dir/?api=1&destination=${place.lat},${place.lon}`,
                    timed: !!place.timed,
                    returnAfter: s.returnAfter ? { min: s.returnAfter.min, mode: s.returnAfter.mode, destination: s.returnAfter.to.area } : undefined,
                };
            }),
        })),
    };
    validateSnapshot(snapshot);
    return clone(snapshot);
}
