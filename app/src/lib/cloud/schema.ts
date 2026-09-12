import { boundedJson, canonical, record, validateSnapshot, type PlanSnapshot } from '../trips/schema.js';

export const MAX_CLOUD_BYTES = 1_500_000;
export const cloudId = (v: unknown): v is string => typeof v === 'string' && /^[a-zA-Z0-9_-]{1,100}$/.test(v);
export interface CloudSegment { id: string; snapshot: PlanSnapshot }
export interface CloudTrip { id: string; revision: number; segments: CloudSegment[] }
export interface CloudHead {
  id: string; revision: number;
  segments: { id: string; versionId: string; cityName: string; arriving: string; departing: string }[];
}
export interface SaveRequest { action: 'save'; tripId: string; expectedRevision: number; segments: CloudSegment[] }
export interface DeleteRequest { action: 'delete'; tripId: string; expectedRevision: number }
export type CloudWrite = SaveRequest | DeleteRequest;
export function validateSegments(v: unknown): asserts v is CloudSegment[] {
  if (!Array.isArray(v) || v.length < 1 || v.length > 8) throw new Error('Save between one and eight trip segments.');
  const ids = new Set<string>();
  let end = '';
  for (const s of v) {
    record(s);
    if (!cloudId(s.id) || ids.has(s.id)) throw new Error('Segment IDs must be unique and stable.');
    ids.add(s.id);
    validateSnapshot(s.snapshot);
    if (!cloudId(s.snapshot.id) || !cloudId(s.snapshot.tripId) || s.id !== s.snapshot.tripId) throw new Error('Segment must retain its original trip identity.');
    if (s.snapshot.draft.arriving < end) throw new Error('Trip segments must be ordered without overlapping overnight dates.');
    end = s.snapshot.draft.departing;
  }
}
export function parseWrite(raw: unknown): CloudWrite {
  const serialized = typeof raw === 'string' ? raw : JSON.stringify(raw);
  if (!serialized || new TextEncoder().encode(serialized).length > MAX_CLOUD_BYTES) throw new Error('Cloud request exceeds the size limit.');
  const v: unknown = typeof raw === 'string' ? JSON.parse(raw) : raw;
  boundedJson(v); record(v);
  if (!cloudId(v.tripId) || !Number.isSafeInteger(v.expectedRevision) || (v.expectedRevision as number) < 0) throw new Error('Invalid trip or revision.');
  if (v.action === 'save') validateSegments(v.segments);
  else if (v.action !== 'delete') throw new Error('Unknown cloud action.');
  return v as unknown as CloudWrite;
}
export function parseCloudTrip(v: unknown): CloudTrip {
  boundedJson(v); record(v);
  if (!cloudId(v.id) || !Number.isSafeInteger(v.revision) || (v.revision as number) < 1) throw new Error('Invalid cloud trip.');
  validateSegments(v.segments);
  return v as unknown as CloudTrip;
}
export function parseHeads(v: unknown): CloudHead[] {
  boundedJson(v);
  if (!Array.isArray(v) || v.length > 20) throw new Error('Invalid cloud list.');
  for (const h of v) {
    record(h);
    if (!cloudId(h.id) || !Number.isSafeInteger(h.revision) || (h.revision as number) < 1 || !Array.isArray(h.segments) || h.segments.length > 8) throw new Error('Invalid cloud trip header.');
    for (const s of h.segments) {
      record(s);
      if (!cloudId(s.id) || !cloudId(s.versionId) || typeof s.cityName !== 'string' || typeof s.arriving !== 'string' || typeof s.departing !== 'string') throw new Error('Invalid cloud segment header.');
    }
  }
  return v as CloudHead[];
}
export function mergeSegment(trip: CloudTrip | undefined, snapshot: PlanSnapshot): CloudSegment[] {
  const segments = [...(trip?.segments ?? []).filter(s => s.id !== snapshot.tripId), { id: snapshot.tripId, snapshot }]
    .sort((a, b) => a.snapshot.draft.arriving.localeCompare(b.snapshot.draft.arriving));
  validateSegments(segments);
  return segments;
}
/** A repeated import must never replace a different accepted schedule with the same ID. */
export function mergeLocalSnapshots(existing: PlanSnapshot[], incoming: PlanSnapshot[]): PlanSnapshot[] {
  const result = [...existing];
  for (const s of incoming) {
    validateSnapshot(s);
    const old = result.find(x => x.id === s.id);
    if (old && canonical(old) !== canonical(s)) throw new Error('A local version has the same ID but different content. Export it before resolving this conflict.');
    if (!old) result.push(s);
  }
  if (result.length > 20) throw new Error('This device has room for twenty accepted versions. Export/remove an older version first.');
  return result;
}
/** Invalidates completions from requests started by a previous account/session. */
export class SessionFence {
  private epoch = 0;
  private owner: string | null = null;
  change(owner: string | null) { if (this.owner !== owner) { this.owner = owner; this.epoch++; } }
  clear() { this.owner = null; this.epoch++; }
  ticket() { return this.epoch; }
  current(ticket: number) { return ticket === this.epoch && this.owner !== null; }
}
