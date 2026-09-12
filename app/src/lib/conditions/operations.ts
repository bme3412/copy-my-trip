import { boundedJson, isDate } from '../trips/schema';

/** One destination-local calendar day. Overnight effects use two records. */
export interface OperationalCondition {
  schemaVersion: 1;
  id: string;
  cityId: string;
  timeZone: string;
  date: string;
  placeId: string;
  experienceId?: string;
  from: number;
  until: number;
  effect: 'closed';
  status: 'simulated' | 'verified' | 'unverified' | 'retracted';
  source: { label: string; url?: string };
  retrievedAt: string;
  expiresAt: string;
}

export function parseConditions(value: unknown): OperationalCondition[] {
  boundedJson(value);
  if (!Array.isArray(value) || value.length > 256) throw Error('Invalid closure records.');
  for (const c of value) {
    if (!c || c.schemaVersion !== 1 || c.effect !== 'closed' ||
      !['simulated', 'verified', 'unverified', 'retracted'].includes(c.status) ||
      ![c.id, c.cityId, c.timeZone, c.placeId, c.source?.label].every(v => typeof v === 'string' && v.length > 0 && v.length < 300) ||
      (c.experienceId !== undefined && (typeof c.experienceId !== 'string' || !c.experienceId || c.experienceId.length > 100)) ||
      !isDate(c.date) || !Number.isInteger(c.from) || !Number.isInteger(c.until) || c.from < 0 || c.until > 1440 || c.from >= c.until ||
      typeof c.retrievedAt !== 'string' || typeof c.expiresAt !== 'string' || !Number.isFinite(Date.parse(c.retrievedAt)) || !Number.isFinite(Date.parse(c.expiresAt)) || Date.parse(c.expiresAt) <= Date.parse(c.retrievedAt))
      throw Error('Invalid closure record.');
    new Intl.DateTimeFormat('en', { timeZone: c.timeZone });
    if (c.source.url !== undefined) {
      if (typeof c.source.url !== 'string' || c.source.url.length > 2048) throw Error('Invalid closure source.');
      const url = new URL(c.source.url);
      if (url.protocol !== 'https:' || url.username || url.password) throw Error('Invalid closure source.');
    }
    if (c.status === 'verified' && !c.source.url) throw Error('A verified condition needs a source.');
  }
  if (new Set(value.map(c => c.id)).size !== value.length) throw Error('Duplicate closure records.');
  return JSON.parse(JSON.stringify(value));
}

export function conditionActive(c: OperationalCondition, now: Date): boolean {
  return (c.status === 'simulated' || c.status === 'verified') &&
    Date.parse(c.retrievedAt) <= +now && +now < Date.parse(c.expiresAt);
}

/** Half-open intervals; a visit ending when the closure starts is unaffected. */
export function closureOverlaps(c: OperationalCondition, cityId: string, date: string | undefined,
  stop: { id: string; experienceId?: string }, start: number, duration: number): boolean {
  return c.cityId === cityId && c.date === date && c.placeId === stop.id &&
    (c.experienceId === undefined || c.experienceId === stop.experienceId) && start < c.until && start + duration > c.from;
}
