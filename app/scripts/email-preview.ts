import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { cloudFixture } from './cloud-fixtures';
import { notificationFor, renderNotification } from '../src/lib/briefings/notifications';

// Synthetic accepted itinerary only. This script never calls the mail provider or database.
const snapshot = cloudFixture('paris', '2026-09-13');
const trip = { id: 'email-layout-preview', revision: 1, segments: [{ id: snapshot.tripId, snapshot }] };
const briefing = notificationFor(trip, '2026-09-13', 'America/New_York');
const result = renderNotification(briefing, 'https://copy-my-trip.com/paris/saved', 'https://copy-my-trip.com/paris/saved');
const output = resolve('node_modules/.tmp/email-preview');
mkdirSync(output, { recursive: true });
writeFileSync(resolve(output,'index.html'), result.html);
writeFileSync(resolve(output,'plain.txt'), result.text);
console.log(`Preview only; no email sent. ${output}/index.html`);
