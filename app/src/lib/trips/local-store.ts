import type { TripState } from '../../state/TripContext';
import { boundedJson, record, list, validateDraft, validateSnapshot, type PlanSnapshot } from './schema';
export const STORAGE_KEY = 'cmt-local-companion-v1';
export const LEGACY_KEY = 'cmt-trips-v3';
export const MAX_BYTES = 3000000;
export const MAX_VERSIONS = 20;
export interface LocalData {
    schemaVersion: 1;
    drafts: Record<string, TripState>;
    snapshots: PlanSnapshot[];
}
export interface StoragePort {
    getItem(key: string): string | null;
    setItem(key: string, value: string): void;
    removeItem(key: string): void;
}
export interface LoadResult {
    data: LocalData;
    problem?: string;
    recovery?: string;
    blocked: boolean;
}
export const emptyData = (): LocalData => ({ schemaVersion: 1, drafts: {}, snapshots: [] });
export function parseLocal(raw: string): LocalData {
    if (raw.length > MAX_BYTES)
        throw new Error('Saved data exceeds the local size limit. Export it before resetting.');
    const v: unknown = JSON.parse(raw);
    boundedJson(v);
    record(v);
    if (v.schemaVersion !== 1)
        throw new Error('Unrecognized local format. Your original data is preserved.');
    record(v.drafts);
    if (Object.keys(v.drafts).length > 20)
        throw new Error('Too many local drafts.');
    Object.values(v.drafts).forEach(validateDraft);
    list(v.snapshots, MAX_VERSIONS);
    v.snapshots.forEach(validateSnapshot);
    if (new Set((v.snapshots as PlanSnapshot[]).map(s => s.id)).size !== v.snapshots.length) throw new Error('Duplicate saved version IDs.');
    return v as unknown as LocalData;
}
export function loadLocal(storage: StoragePort): LoadResult {
    let raw: string | null = null;
    try {
        raw = storage.getItem(STORAGE_KEY);
        if (raw !== null)
            return { data: parseLocal(raw), blocked: false };
        const legacy = storage.getItem(LEGACY_KEY);
        if (legacy !== null)
            return { data: emptyData(), blocked: true, recovery: legacy, problem: 'Older local data was found. Export it or import it as a draft for review. It is not an accepted plan.' };
        return { data: emptyData(), blocked: false };
    }
    catch {
        return { data: emptyData(), blocked: true, recovery: raw ?? undefined, problem: 'Local data could not be read safely. It has not been changed. Export/reset it explicitly, or continue in memory.' };
    }
}
export function saveLocal(storage: StoragePort, data: LocalData): void {
    const raw = JSON.stringify(data);
    if (raw.length > MAX_BYTES)
        throw new Error('Local storage limit reached. Export and remove an older version, or continue in memory.');
    parseLocal(raw);
    storage.setItem(STORAGE_KEY, raw);
}
export function importLegacy(raw: string): Record<string, TripState> {
    if (raw.length > MAX_BYTES)
        throw new Error('Legacy data is too large.');
    const v: unknown = JSON.parse(raw);
    boundedJson(v);
    record(v);
    for (const value of Object.values(v))
        validateDraft(value);
    return v as Record<string, TripState>;
}
