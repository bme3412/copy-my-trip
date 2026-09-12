import { cloudConfig, HttpError } from '../auth.js';
import { parseCloudTrip, type CloudTrip } from '../../src/lib/cloud/schema.js';
import { nextSchedule, notificationFor, renderNotification, type NotificationPreference } from '../../src/lib/briefings/notifications.js';
import { enrichWeather } from '../conditions/enrich.js';
import type { SentBriefing } from '../../src/lib/briefings/notifications.js';
export type WorkerRpc = <T = unknown>(action: string, data?: unknown) => Promise<T>;
export const mailConfigured = () => process.env.COMPANION_EMAIL_ENABLED === 'true' && !!process.env.CMT_MAIL_WORKER_SECRET && !!process.env.RESEND_API_KEY && !!process.env.RESEND_WEBHOOK_SECRET && !!process.env.COMPANION_APP_ORIGIN && !!process.env.CRON_SECRET;
export const workerRpc: WorkerRpc = async <T>(action: string, data: unknown = {}) => {
  const config = cloudConfig();
  const secret = process.env.CMT_MAIL_WORKER_SECRET;
  if (!secret) throw new HttpError(503, 'Itinerary email is not configured.');
  const r = await fetch(`${config.url}/rest/v1/rpc/cmt_mail_worker`, { method: 'POST',
    headers: { apikey: config.key, 'Content-Type': 'application/json' },
    body: JSON.stringify({ p_secret: secret, p_action: action, p_data: data }), signal: AbortSignal.timeout(15000) });
  if (!r.ok) throw new HttpError(503, 'Itinerary email is temporarily unavailable.');
  return r.json() as Promise<T>;
};
export interface Candidate extends NotificationPreference { ownerId: string; trip: CloudTrip }
interface Claim { id: string; lease: string; trip: CloudTrip; date: string; zone: string; kind: 'test' | 'nightly' }
export function appOrigin() {
  const u = new URL(process.env.COMPANION_APP_ORIGIN || '');
  if (u.protocol !== 'https:' || u.username || u.password || u.pathname !== '/' || u.search || u.hash) throw new Error('Invalid email app origin');
  return u.origin;
}
export async function deliver(candidate: Candidate, date: string, kind: 'test' | 'nightly', dueAt?: string,
  deps: { rpc: WorkerRpc; fetcher: typeof fetch; origin: () => string; enrich?: (briefing:SentBriefing)=>Promise<SentBriefing> } = { rpc: workerRpc, fetcher: fetch, origin: appOrigin }) {
  const origin = deps.origin(); // validate before any claim
  const job = await deps.rpc<Claim | null>('claim', { ownerId: candidate.ownerId, tripId: candidate.trip.id, tripRevision: candidate.trip.revision, prefRevision: candidate.revision, kind, date, dueAt });
  if (!job) return { state: 'skipped' };
  const identity = { id: job.id, lease: job.lease };
  let briefing, content;
  try {
    briefing = notificationFor(parseCloudTrip(job.trip), job.date, job.zone);
    briefing = await (deps.enrich ?? enrichWeather)(briefing);
    const city = job.trip.segments[0].snapshot.cityId;
    content = renderNotification(briefing, `${origin}/${city}/mail/${job.id}`, `${origin}/${city}/mail/${job.id}?pause=1`, kind === 'test');
  } catch {
    await deps.rpc('fail', identity);
    return { id: job.id, state: 'failed' };
  }
  const reservation = await deps.rpc<{ recipient: string } | null>('submit', { ...identity, briefing });
  if (!reservation) return { id: job.id, state: 'skipped' };
  // Reservation is durable before the network side effect. Unknown outcomes are never automatically resent.
  let outcome: { state: 'accepted' | 'failed' | 'unknown'; providerId?: string; error?: string };
  try {
    const response = await deps.fetcher('https://api.resend.com/emails', { method: 'POST',
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json', 'Idempotency-Key': `cmt/${job.id}` },
      body: JSON.stringify({ from: 'Copy My Trip <itinerary@mail.copy-my-trip.com>', to: [reservation.recipient], ...content }),
      signal: AbortSignal.timeout(15000) });
    if (response.ok) {
      const result = await response.json();
      outcome = typeof result.id === 'string' ? { state: 'accepted', providerId: result.id } : { state: 'unknown', error: 'invalid_provider_response' };
    } else {
      // 5xx/408 may follow acceptance; do not guess. Other 4xx are confirmed rejection.
      outcome = response.status >= 500 || response.status === 408 ? { state: 'unknown', error: 'provider_uncertain' } : { state: 'failed', error: `provider_${response.status}` };
    }
  } catch { outcome = { state: 'unknown', error: 'network_uncertain' }; }
  await deps.rpc('finish', { ...identity, ...outcome });
  return { id: job.id, state: outcome.state };
}
export async function tick(deps = { rpc: workerRpc, deliver, now: () => new Date() }) {
  const candidates = await deps.rpc<Candidate[]>('candidates');
  let attempted = 0;
  const results = [];
  // Pilot deliberately bounded: <=20 trip candidates and <=2 submissions per invocation.
  for (const candidate of candidates) {
    try {
      candidate.trip = parseCloudTrip(candidate.trip);
      const due = nextSchedule(candidate.trip, candidate, deps.now(), true);
      if (!due || Date.parse(due.at) > +deps.now()) continue;
      const result = await deps.deliver(candidate, due.date, 'nightly', due.at);
      results.push(result);
      if (result.state !== 'skipped' && ++attempted >= 2) break;
    } catch { results.push({ state: 'worker_error' }); }
  }
  return { inspected: candidates.length, results };
}
