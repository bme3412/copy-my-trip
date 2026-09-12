/** Render reviewable pilot content locally. Never sends mail or writes cloud data. */
import { mkdirSync, writeFileSync } from 'node:fs';
import { cloudFixture } from './cloud-fixtures';
import { notificationFor, renderNotification } from '../src/lib/briefings/notifications';
const date = process.argv[2] || '2026-09-13';
if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(Date.parse(date))) throw new Error('Use YYYY-MM-DD');
const snapshot = cloudFixture('paris', date, new Date());
const trip = { id: 'itinerary-delivery-pilot', revision: 1, segments: [{ id: snapshot.tripId, snapshot }] };
const briefing = notificationFor(trip, date, 'America/New_York');
// Placeholder is deliberately not an existing private briefing; a real job gets its own UUID.
const url = 'https://copy-my-trip.com/paris/mail/00000000-0000-0000-0000-000000000000';
const dir = '../build-plan/artifacts/itinerary-email-pilot';
mkdirSync(dir, { recursive: true });
for (const kind of ['test', 'nightly'] as const) {
  const content = renderNotification(briefing, url, `${url}?pause=1`, kind === 'test');
  writeFileSync(`${dir}/${kind}.html`, content.html);
  writeFileSync(`${dir}/${kind}.txt`, content.text);
}
writeFileSync(`${dir}/briefing.json`, JSON.stringify(briefing, null, 2));
console.log(JSON.stringify({ date, zone: briefing.zone, stops: briefing.items.reduce((n, b) => n + b.stops.length, 0), directory: dir, sent: false }));
