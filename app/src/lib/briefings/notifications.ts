import { addDate, dateInZone, contentHash, type PlanSnapshot } from '../trips/schema.js';
import type { CloudTrip } from '../cloud/schema.js';
import { assembleBriefing, briefingText, briefingHtmlContent } from './assemble.js';
import { escapeHtml, type Briefing } from './schema.js';
export interface NotificationPreference {
  tripId: string; revision: number; enabled: boolean; zone: string; time: string;
  activatedAt: string; suppressed: boolean;
}
export interface SentBriefing {
  schemaVersion: 1; tripId: string; tripRevision: number; serviceDate: string;
  zone: string; windowStart: string; windowEnd: string; items: Briefing[];
}
export interface DeliveryHead { id: string; service_date: string; kind: 'nightly' | 'test'; state: string; updated_at: string }
export interface NotificationState {
  preference: NotificationPreference | null; deliveries: DeliveryHead[]; ready: boolean;
  nextDue: { at: string; date: string } | null;
}
const formatters = new Map<string, Intl.DateTimeFormat>();
const wallCache = new Map<string, number>();
const parts = (instant: number, zone: string) => {
  if (formatters.size > 64) formatters.clear();
  if (!formatters.has(zone)) formatters.set(zone, new Intl.DateTimeFormat('en-CA', { timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }));
  const p = formatters.get(zone)!.formatToParts(instant);
  const v = (key: string) => p.find(x => x.type === key)!.value;
  return `${v('year')}-${v('month')}-${v('day')}T${v('hour')}:${v('minute')}`;
};
export function validZone(zone: unknown): zone is string {
  if (typeof zone !== 'string' || zone.length > 80) return false;
  try { new Intl.DateTimeFormat('en', { timeZone: zone }).format(); return true; } catch { return false; }
}
/** Wall-clock conversion: earlier occurrence in a fold; shift forward by the gap.
 * Probe offsets on both sides of transitions. No repeated 24h arithmetic for local dates. */
export function wallTime(date: string, time: string, zone: string): number {
  const key = `${zone}/${date}/${time}`;
  const cached = wallCache.get(key); if(cached !== undefined) return cached;
  if(wallCache.size > 2048) wallCache.clear();
  const keep = (stamp: number) => { wallCache.set(key,stamp);return stamp; };
  const desired = `${date}T${time}`;
  const naive = Date.parse(desired + ':00Z');
  if (!Number.isFinite(naive) || !validZone(zone)) throw new Error('Invalid calendar time');
  const offsets = new Set<number>();
  for (let hours = -36; hours <= 36; hours += 6) {
    const stamp = naive + hours * 3600000;
    offsets.add(Date.parse(parts(stamp, zone) + ':00Z') - stamp);
  }
  const candidates = [...offsets].map(offset => naive - offset).sort((a,b) => a-b);
  const exact = candidates.find(stamp => parts(stamp, zone) === desired);
  if (exact !== undefined) return keep(exact);
  const shifted = candidates.filter(stamp => parts(stamp, zone) > desired).sort((a,b) => parts(a,zone).localeCompare(parts(b,zone)))[0];
  if (shifted === undefined) throw new Error('Calendar time unavailable');
  return keep(shifted);
}
function stopWindow(snapshot: PlanSnapshot, date: string, minutes: number) {
  const whole = Math.floor(minutes);
  return wallTime(addDate(date, Math.floor(whole / 1440)), `${Math.floor((whole % 1440) / 60).toString().padStart(2,'0')}:${(whole % 60).toString().padStart(2,'0')}`, snapshot.timeZone) + (minutes - whole) * 60000;
}
export function notificationFor(trip: CloudTrip, date: string, zone: string): SentBriefing {
  const start = wallTime(date, '00:00', zone), end = wallTime(addDate(date, 1), '00:00', zone);
  const items: Briefing[] = [];
  for (const { snapshot } of trip.segments) for (const day of snapshot.days) {
    const b = assembleBriefing(snapshot, day.date);
    b.id = `mail-${contentHash({plan: snapshot.id, destinationDate: day.date, serviceDate: date, zone, template: 1})}`;
    // Include overlapping overnight activities and their full accepted timings.
    // Never shorten or reschedule a stop at the notification-zone boundary.
    b.stops = b.stops.filter(s => stopWindow(snapshot, day.date, s.timeIn + s.dur + (s.returnAfter?.min ?? 0)) > start && stopWindow(snapshot, day.date, s.timeIn) < end);
    const emptyDayInWindow = !day.stops.length && stopWindow(snapshot, day.date, 720) >= start && stopWindow(snapshot, day.date, 720) < end;
    if (b.stops.length || emptyDayInWindow) {
      b.firsthand = b.stops.filter(s => s.source === 'verified').length;
      items.push(b);
    }
  }
  return { schemaVersion: 1, tripId: trip.id, tripRevision: trip.revision, serviceDate: date, zone,
    windowStart: new Date(start).toISOString(), windowEnd: new Date(end).toISOString(), items };
}
export function serviceDates(trip: CloudTrip, zone: string): string[] {
  const dates = new Set<string>();
  for (const { snapshot } of trip.segments) for (const day of snapshot.days) {
    const start = stopWindow(snapshot, day.date, 0);
    const end = stopWindow(snapshot, day.date, Math.max(1440, ...day.stops.map(s => s.timeIn + s.dur + (s.returnAfter?.min ?? 0))));
    for (let d = dateInZone(new Date(start), zone), count = 0; d <= dateInZone(new Date(end), zone) && count < 32; d = addDate(d, 1), count++) dates.add(d);
  }
  return [...dates].sort().filter(date => notificationFor(trip, date, zone).items.length > 0);
}
export function nextSchedule(trip: CloudTrip, pref: NotificationPreference, now: Date, catchUp = false): { at: string; date: string } | null {
  if (!pref.enabled || pref.suppressed) return null;
  for (const date of serviceDates(trip, pref.zone)) {
    const due = wallTime(addDate(date, -1), pref.time, pref.zone);
    if (due < Date.parse(pref.activatedAt)) continue; // late opt-in never backfills
    if (due >= +now || (catchUp && +now - due <= 3600000 && +now < wallTime(date, '00:00', pref.zone))) return { at: new Date(due).toISOString(), date };
  }
  return null;
}
export function renderNotification(b: SentBriefing, url: string, pauseUrl: string, test = false) {
  const heading = `${test ? 'Test · ' : ''}Tomorrow’s itinerary · ${b.serviceDate}`;
  const context = `Calendar day ${b.serviceDate} in ${b.zone}. Activity times use the destination zones shown below. Overnight activities retain their full accepted times.`;
  const text = [heading, context, ...b.items.map(item => briefingText(item, true)), `Open this exact briefing (sign in): ${url}`, `Pause itinerary emails: ${pauseUrl}`].join('\n\n');
  const sections = b.items.map(item => briefingHtmlContent(item, new URL(url).origin, true)).join('');
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;background:#faf7f0;color:#302c26;font-family:Georgia,serif"><main style="max-width:640px;margin:auto;padding:28px"><h1>${escapeHtml(heading)}</h1><p>${escapeHtml(context)}</p>${sections}<p><a href="${escapeHtml(url)}">Open this exact briefing</a> (sign in)</p><p><a href="${escapeHtml(pauseUrl)}">Pause itinerary emails</a></p></main></body></html>`;
  if (!b.items.length || BufferSafeSize(text + html) > 750000) throw new Error('Briefing is empty or too large');
  return { subject: heading, text, html };
}
const BufferSafeSize = (s: string) => new TextEncoder().encode(s).length;
