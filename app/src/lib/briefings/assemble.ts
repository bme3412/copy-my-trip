const fmt = (minutes: number) => { const rounded = Math.round(minutes); return `${Math.floor(rounded / 60)}:${(rounded % 60).toString().padStart(2, '0')}`; };
import { clone, contentHash, isDate, validateSnapshot, type PlanSnapshot } from '../trips/schema.js';
import { escapeHtml as e, safeUrl, type Briefing } from './schema.js';
import { weatherAt, weatherLines, WEATHER_SOURCE } from '../conditions/weather.js';
const weatherText = (b: Briefing) => b.weather ? weatherLines(weatherAt(b.weather,b.cityId,b.date)) : [];
const conditions = (b: Briefing) => b.weather ? 'Live operational updates are not connected.' : b.conditions;
const weatherHtml = (b: Briefing) => b.weather ? `<aside>${weatherText(b).map(line=>`<p>${e(line)}</p>`).join('')}${b.weather.synthetic?'':`<a href="${WEATHER_SOURCE}">Weather data by Open-Meteo</a>`}</aside>` : '';
export function assembleBriefing(snapshot: PlanSnapshot, date: string): Briefing {
    validateSnapshot(snapshot);
    if (!isDate(date))
        throw new Error('Choose a valid preview date.');
    const day = snapshot.days.find(d => d.date === date);
    return {
        schemaVersion: 1, id: `briefing-${contentHash({ plan: snapshot.id, date, template: 1 })}`, planId: snapshot.id, tripId: snapshot.tripId,
        cityId: snapshot.cityId, cityName: snapshot.cityName, date, timeZone: snapshot.timeZone, acceptedAt: snapshot.acceptedAt, demo: snapshot.demo,
        title: day?.title ?? (date < snapshot.days[0].date ? 'Your trip has not started' : 'Your trip is complete'),
        purpose: day?.purpose ?? '', status: !day ? date < snapshot.days[0].date ? 'before' : 'completed' : day.stops.length ? day.stops.some(s => s.returnAfter) ? 'travel' : 'active' : 'empty',
        stops: clone(day?.stops ?? []), warnings: clone(day?.warnings ?? []), firsthand: day?.stops.filter(s => s.source === 'verified').length ?? 0,
        conditions: 'Weather and live operational updates are not connected.',
    };
}
export const scheduleLine = (s: Briefing['stops'][number]) => `${fmt(s.timeIn)}–${fmt(s.timeIn + s.dur)} · ${s.dur} min · ${s.travelMin} min ${s.travelMode} to arrive (estimated)`;
export function briefingText(b: Briefing, sent = false): string {
    return [b.demo ? 'DEMONSTRATION TRIP' : 'ACCEPTED ITINERARY', `${b.cityName} · ${b.date} · ${b.timeZone}`, b.title, b.purpose,
        `Plan ${b.planId} · Briefing ${b.id}`, `Accepted ${b.acceptedAt}`, `${b.firsthand} of ${b.stops.length} stops marked firsthand for the selected experience.`,
        ...weatherText(b), ...(b.weather && !b.weather.synthetic ? [WEATHER_SOURCE] : []), ...b.warnings.map(w => 'Review: ' + w),
        ...b.stops.flatMap(s => [`${scheduleLine(s)} — ${s.name}`, s.area, s.description, s.evidence, s.timed ? 'Suggested entry time — not a reservation.' : '', s.returnAfter ? `Then ${s.returnAfter.min} min ${s.returnAfter.mode} back to ${s.returnAfter.destination} (estimated).` : '', safeUrl(s.directions) ?? '']),
        b.stops.length ? '' : 'No accepted activities on this date.', conditions(b), sent ? '' : 'Local preview only. No email has been sent.',
    ].filter(Boolean).join('\n\n');
}
export function briefingHtmlContent(b: Briefing, origin = '', sent = false): string {
    const absolute = (url: string) => safeUrl(url.startsWith('/') && origin ? origin.replace(/\/$/, '') + url : url);
    const link = sent ? undefined : absolute(`/${b.cityId}/saved/${b.planId}/briefing?date=${b.date}`);
    return `<p>${b.demo ? 'DEMONSTRATION TRIP' : 'ACCEPTED ITINERARY'}</p><h1>${e(b.title)}</h1><p>${e(b.cityName)} · ${e(b.date)} · ${e(b.timeZone)}</p><p>${e(b.purpose)}</p>${weatherHtml(b)}<p>${b.firsthand} of ${b.stops.length} stops marked firsthand for the selected experience.</p>${b.warnings.map(w => `<p>Review: ${e(w)}</p>`).join('')}${b.stops.map(s => `<section style="border-top:1px solid #d5caba;padding:20px 0"><p>${e(scheduleLine(s))}</p><h2>${e(s.name)}</h2><p>${e(s.area)}</p><p>${e(s.evidence)}</p>${s.image && absolute(s.image.url) ? `<img style="max-width:100%;height:auto" width="480" src="${e(absolute(s.image.url))}" alt="${e(s.image.caption)}"><p>${e(s.image.caption)}</p>` : ''}<p>${e(s.description)}</p>${s.timed ? '<p>Suggested entry time — not a reservation.</p>' : ''}${s.returnAfter ? `<p>Then ${s.returnAfter.min} min ${e(s.returnAfter.mode)} back to ${e(s.returnAfter.destination)} (estimated).</p>` : ''}${safeUrl(s.directions) ? `<a href="${e(safeUrl(s.directions))}">Directions to ${e(s.name)}</a>` : ''}</section>`).join('')}${!b.stops.length ? '<p>No accepted activities on this date.</p>' : ''}<p>${e(conditions(b))}</p>${sent ? '' : '<p>Local preview only. No email has been sent.</p>'}<p>Accepted ${e(b.acceptedAt)}<br>Plan ${e(b.planId)}<br>Briefing ${e(b.id)}</p>${link ? `<a target="_top" href="${e(link)}">Open this exact briefing</a>` : ''}`;
}
export function briefingHtml(b: Briefing, origin = '', sent = false): string {
    return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${e(b.cityName)} · ${e(b.date)}</title></head><body style="margin:0;background:#faf7f0;color:#302c26;font-family:Georgia,serif"><main style="max-width:640px;margin:auto;padding:28px">${briefingHtmlContent(b, origin, sent)}</main></body></html>`;
}
