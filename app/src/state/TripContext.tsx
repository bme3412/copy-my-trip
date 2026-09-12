import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { CITIES } from '../cities';
import type { City, Pace } from '../cities/types';
import { blankDay, stayLoc, type DayState } from '../lib/planner';
import { acceptSnapshot, canEdit, catalogVersion, draftHash } from '../lib/trips/snapshot';
import { clone, plannedDays, PLANNER_VERSION, type PlanSnapshot } from '../lib/trips/schema';
import { emptyData, importLegacy, loadLocal, MAX_VERSIONS, saveLocal, STORAGE_KEY, type LocalData, type LoadResult } from '../lib/trips/local-store';
import { useCity } from './CityContext';
import { mergeLocalSnapshots } from '../lib/cloud/schema';
import type { ItineraryProposal } from '../lib/proposals/schema';
import { persistProposal } from '../lib/proposals/validate';
const LOCAL_LOCK = 'cmt-local-companion-write';
const withLocalLock = <T,>(work: () => T): Promise<T> => navigator.locks ? navigator.locks.request(LOCAL_LOCK, work) : Promise.resolve().then(work);
export interface TripState {
    arriving: string;
    departing: string;
    pace: Pace;
    interests: string[];
    /** Neighbourhood the traveler is staying in — days start and end here. */
    stayHood: string;
    planId: string | null;
    originPresetId?: string;
    edited?: boolean;
    unplaced?: { placeId: string; reason: string }[];
    demo?: boolean;
    dayContexts?: import('../lib/plan-presets').StoredDayContext[];
    scheduledFor?: {
        arriving: string;
        departing: string;
        stayHood: string;
    };
    release?: {
        planner: string;
        catalog: string;
    };
    /** Shuffle counter for plan generation — the same seed regenerates the same
     * plans; bumping it rotates the picks. Deterministic variety, no RNG. */
    planSeed?: number;
    /** The traveler's free-text trip brief, as typed. */
    brief?: string;
    /** What the LLM read from the brief — stored so regeneration is
     * deterministic and never re-calls the API. */
    extracted?: import('../lib/extract').ExtractedPrefs;
    days: DayState[];
    /** One-line purpose per day, set when a generated plan is chosen. */
    dayPurposes?: string[];
    /** The pace each day was BUILT at, set when a generated plan is chosen.
     * Edits re-time a day at this pace, never at today's `pace` slider — a
     * plan the traveler never asked to re-pace must not silently drift. */
    dayPaces?: Pace[];
    /** LLM narration per day index, keyed by the day's content so edits
     * invalidate — fetched once, then served from state. */
    dayNarrations?: Record<number, {
        key: string;
        text: string;
    }>;
}
export const MAX_DAYS = 7;
export function defaultTrip(city: City): TripState {
    return { arriving: '', departing: '', pace: 'balanced', interests: [], stayHood: '', planId: null,
        planSeed: Date.now() % 1009, days: Array.from({ length: MAX_DAYS }, () => blankDay(city, stayLoc(city))) };
}
function initialLoad(): LoadResult {
    if (typeof window === 'undefined')
        return { data: emptyData(), blocked: false };
    try {
        return loadLocal(window.localStorage);
    }
    catch {
        return { data: emptyData(), blocked: true, problem: 'Storage is unavailable. Your changes will remain in memory only.' };
    }
}
interface TripStore {
    data: LocalData;
    status: string;
    blocked: boolean;
    recovery?: string;
    setDraft: (cityId: string, updater: (draft: TripState) => TripState) => void;
    accept: (city: City, demo?: boolean) => PlanSnapshot;
    acceptProposal: (city: City, proposal: ItineraryProposal, optionId: string) => Promise<PlanSnapshot>;
    remove: (id: string) => void;
    recover: () => void;
    reset: () => Promise<void>;
    retry: () => Promise<void>;
    importSnapshots: (snapshots: PlanSnapshot[]) => Promise<void>;
}
const TripStoreContext = createContext<TripStore | null>(null);
export function TripProvider({ children }: {
    children: ReactNode;
}) {
    const [loaded] = useState(initialLoad);
    const [baseline] = useState(() => { try { return window.localStorage.getItem(STORAGE_KEY); } catch { return null; } });
    const persisted = useRef(baseline);
    const explicitWrite = useRef(0);
    const [defaults] = useState(() => Object.fromEntries(Object.values(CITIES).map(city => [city.id, defaultTrip(city)])));
    const [data, setData] = useState<LocalData>(() => ({ ...loaded.data, drafts: { ...defaults, ...loaded.data.drafts } }));
    const [blocked, setBlocked] = useState(loaded.blocked);
    const [status, setStatus] = useState(loaded.problem ?? 'Saving on this device…');
    const write = (next: LocalData, replace = false) => {
        if (!replace && window.localStorage.getItem(STORAGE_KEY) !== persisted.current) {
            setBlocked(true);
            throw Error('Local data changed in another tab. Export unsaved work if needed, then reload.');
        }
        saveLocal(window.localStorage, next);
        persisted.current = window.localStorage.getItem(STORAGE_KEY);
    };
    useEffect(() => {
        const changed = (event: StorageEvent) => {
            if ((event.key === STORAGE_KEY || event.key === null) && event.storageArea === window.localStorage && window.localStorage.getItem(STORAGE_KEY) !== persisted.current) {
                setBlocked(true);
                setStatus('Local data changed in another tab. Export unsaved work if needed, then reload before saving.');
            }
        };
        window.addEventListener('storage', changed);
        return () => window.removeEventListener('storage', changed);
    }, []);
    useEffect(() => {
        if (blocked)
            return;
        let cancelled = false;
        const generation = explicitWrite.current;
        void withLocalLock(() => {
            if (cancelled || generation !== explicitWrite.current) return;
            write(data);
            setStatus('Saved on this device · cloud copies are managed separately');
        }).catch(err => {
            setStatus(`Not saved: ${err instanceof Error ? err.message : 'Storage unavailable'}. Your current plan is still in memory.`);
        });
        return () => { cancelled = true; };
    }, [data, blocked]);
    const store: TripStore = { data, status, blocked, recovery: loaded.recovery,
        importSnapshots: async snapshots => {
            if (blocked) throw new Error('Resolve local storage recovery before keeping cloud copies here.');
            await withLocalLock(() => {
                const current = loadLocal(window.localStorage);
                if (current.blocked) throw Error('Resolve local storage recovery before keeping cloud copies here.');
                const next = { ...current.data, snapshots: mergeLocalSnapshots(current.data.snapshots, snapshots) };
                // Merge inside the same lock as proposal acceptance, then confirm durability.
                write(next); explicitWrite.current++; setData(next);
            });
        },
        acceptProposal: async (city, proposal, optionId) => {
            if (blocked) throw Error('Reload after resolving the local storage notice before accepting.');
            if (!navigator.locks) throw Error('This browser cannot safely coordinate acceptance across tabs. Use a browser with Web Locks support.');
            return withLocalLock(() => {
                const result = persistProposal(window.localStorage, city, proposal, optionId);
                explicitWrite.current++;
                persisted.current = window.localStorage.getItem(STORAGE_KEY);
                setData(result.data);
                setStatus('Alternative saved on this device · cloud copies are managed separately');
                return result.snapshot;
            });
        },
        setDraft: (id, updater) => setData(d => ({ ...d, drafts: { ...d.drafts, [id]: updater(d.drafts[id] ?? defaults[id]) } })),
        accept: (city, demo = false) => {
            const draft = data.drafts[city.id];
            const previous = data.snapshots.filter(s => s.cityId === city.id).at(-1);
            if (previous?.inputsHash === draftHash(draft))
                return previous;
            if (data.snapshots.length >= MAX_VERSIONS)
                throw new Error('Twenty versions are saved. Export and remove an older version before accepting another.');
            if (draft.release && (draft.release.planner !== PLANNER_VERSION || draft.release.catalog !== catalogVersion(city)))
                throw new Error('This draft uses an older engine or catalog. Keep its saved view; compose a new plan to regenerate.');
            const snapshot = acceptSnapshot(city, draft, previous?.draft.arriving === draft.arriving ? previous : undefined, new Date(), demo || !!draft.demo);
            setData(d => ({ ...d, snapshots: [...d.snapshots, snapshot] }));
            return snapshot;
        },
        remove: id => setData(d => ({ ...d, snapshots: d.snapshots.filter(s => s.id !== id) })),
        recover: () => {
            if (!loaded.recovery)
                return;
            try {
                const drafts = importLegacy(loaded.recovery);
                setData(d => ({ ...d, drafts: { ...d.drafts, ...drafts } }));
                setBlocked(false);
            }
            catch {
                setStatus('This data cannot be imported safely as a draft. Export the original for recovery; nothing was deleted.');
            }
        },
        reset: async () => {
            try {
                const clean = { ...emptyData(), drafts: defaults };
                await withLocalLock(() => { write(clean, true); explicitWrite.current++; });
                setData(clean);
                setBlocked(false);
                setStatus('Local workspace reset. Older-format storage was left intact.');
            }
            catch {
                setStatus('Storage is still unavailable. Continue in memory or export your work.');
            }
        },
        retry: async () => {
            try {
                if (blocked)
                    throw new Error('Export/recover the original data before replacing it.');
                await withLocalLock(() => write(data));
                setStatus('Saved on this device · cloud copies are managed separately');
            }
            catch (err) {
                setStatus(err instanceof Error ? err.message : 'Storage unavailable');
            }
        },
    };
    return <TripStoreContext.Provider value={store}>{children}</TripStoreContext.Provider>;
}
export function useLocalTrips() { const value = useContext(TripStoreContext); if (!value)
    throw new Error('TripProvider missing'); return value; }
export function useTrip() {
    const city = useCity();
    const store = useLocalTrips();
    const trip = store.data.drafts[city.id];
    const update = (patch: Partial<TripState>) => store.setDraft(city.id, t => ({ ...t, ...patch }));
    const dayCount = plannedDays(trip) || 4;
    const accepted = store.data.snapshots.filter(s => s.cityId === city.id).at(-1);
    const editable = !trip.release || (trip.release.planner === PLANNER_VERSION && trip.release.catalog === catalogVersion(city));
    const result = useMemo(() => ({ trip, dayCount, accepted, editable }), [trip, dayCount, accepted, editable]);
    return { ...result, update,
        updateDay: (index: number, day: DayState) => store.setDraft(city.id, t => ({ ...t, edited: true, days: t.days.map((d, i) => i === index ? day : d) })),
        resetDay: (index: number) => store.setDraft(city.id, t => ({ ...t, edited: true, days: t.days.map((d, i) => i === index ? blankDay(city, stayLoc(city, t.stayHood)) : d) })),
        setDays: (days: DayState[]) => update({ days }),
        setDayNarration: (index: number, entry: {
            key: string;
            text: string;
        }) => store.setDraft(city.id, t => ({ ...t, dayNarrations: { ...t.dayNarrations, [index]: entry } })),
        accept: () => store.accept(city),
        editAccepted: (snapshot: PlanSnapshot) => { if (!canEdit(snapshot, city))
            throw new Error('This version is read-only with the current engine/catalog.'); update({ ...clone(snapshot.draft), release: snapshot.release }); },
    };
}
export { STORAGE_KEY };
