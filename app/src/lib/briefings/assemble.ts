const fmt = (minutes: number) => { const rounded = Math.round(minutes); return `${Math.floor(rounded / 60)}:${(rounded % 60).toString().padStart(2, '0')}`; };
import { clone, contentHash, isDate, validateSnapshot, type PlanSnapshot } from '../trips/schema.js';
import { escapeHtml as e, safeUrl, type Briefing } from './schema.js';
import { daySummary, emailDocument, friendlyDate, linkStyle, proseHtml, proseText, smallStyle, sourceLabel } from './presentation.js';
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
    return [b.demo ? 'DEMONSTRATION TRIP' : 'ACCEPTED ITINERARY', `${b.cityName} · ${friendlyDate(b.date)} · ${b.date}`, `All activity times: ${b.cityName} local time (${b.timeZone}).`, b.title, proseText(b.purpose), daySummary(b), b.stops.some(s => s.timeIn+s.dur+(s.returnAfter?.min??0)>1440) ? 'Times past 24:00 continue into the following day; full accepted times are shown.' : '',
        ...weatherText(b), ...(b.weather && !b.weather.synthetic ? [WEATHER_SOURCE] : []), ...b.warnings.map(w => 'Review: ' + w),
        ...b.stops.flatMap((s, i) => [`${i+1}. ${s.name}`, scheduleLine(s), s.area, sourceLabel(s), proseText(s.description), s.timed ? 'Suggested entry time — not a reservation.' : '', s.returnAfter ? `Then ${s.returnAfter.min} min ${s.returnAfter.mode} back to ${s.returnAfter.destination} (estimated).` : '', safeUrl(s.directions) ? `Directions: ${safeUrl(s.directions)}` : '']),
        'TRIP NOTES', conditions(b), `${b.firsthand} of ${b.stops.length} stops marked firsthand for the selected experience. Archive visits are historical, not current operating information.`,
        ...b.stops.map((s,i)=>`${i+1}. ${s.name}: ${s.evidence}${s.image ? ' · '+s.image.caption : ''}`),
        sent ? '' : 'Local preview only. No email has been sent.', `Accepted ${b.acceptedAt}`, `Plan ${b.planId} · Briefing ${b.id}`,
    ].filter(Boolean).join('\n\n');
}
export function briefingHtmlContent(b: Briefing, origin = '', sent = false): string {
    const absolute = (url: string) => safeUrl(url.startsWith('/') && origin ? origin.replace(/\/$/, '') + url : url);
    const link = sent ? undefined : absolute(`/${b.cityId}/saved/${b.planId}/briefing?date=${b.date}`);
    const stops = b.stops.map((s, i) => `<section style="border-top:1px solid #e5dfd5;padding:22px 0">
      <p style="margin:0 0 6px;font:12px/1.6 Arial,Helvetica,sans-serif;color:#b94716">${e(scheduleLine(s))}</p>
      <h3 style="margin:0 0 3px;font:normal 24px/1.2 Georgia,serif;color:#142033">${i+1}. ${e(s.name)}</h3>
      <p style="margin:0 0 8px;${smallStyle}">${e(s.area)} · ${e(sourceLabel(s))}</p>
      ${s.image && absolute(s.image.url) ? `<img style="display:block;width:100%;max-width:480px;height:auto;margin:14px 0 5px;border-radius:6px" width="480" src="${e(absolute(s.image.url))}" alt="${e(s.image.caption)}"><p style="margin:0 0 12px;${smallStyle}">${e(s.image.caption)}</p>` : ''}
      ${s.description ? `<p style="margin:10px 0 14px">${proseHtml(s.description)}</p>` : ''}
      ${s.timed ? '<p style="color:#994016">Suggested entry time — not a reservation.</p>' : ''}
      ${s.returnAfter ? `<p>Then ${s.returnAfter.min} min ${e(s.returnAfter.mode)} back to ${e(s.returnAfter.destination)} (estimated).</p>` : ''}
      ${safeUrl(s.directions) ? `<a style="${linkStyle}" href="${e(safeUrl(s.directions))}">Directions to ${e(s.name)} →</a>` : ''}</section>`).join('');
    return `<p style="${smallStyle};margin:20px 0 6px">${b.demo ? 'DEMONSTRATION TRIP' : 'ACCEPTED ITINERARY'} · ${e(b.cityName)} · ${e(friendlyDate(b.date))}</p>
      <h2 style="font:normal 28px/1.2 Georgia,serif;margin:0 0 12px">${e(b.title)}</h2>
      <p style="${smallStyle}">All activity times: ${e(b.cityName)} local time (${e(b.timeZone)}).</p>
      ${b.stops.some(s => s.timeIn+s.dur+(s.returnAfter?.min??0)>1440) ? `<p style="${smallStyle}">Times past 24:00 continue into the following day; full accepted times are shown.</p>` : ''}
      ${b.purpose ? `<p>${proseHtml(b.purpose)}</p>` : ''}
      <p style="padding:12px 14px;background:#f1eee6;border-left:3px solid #bd501c;font-size:13px">${e(daySummary(b))}</p>
      ${weatherHtml(b)}${b.warnings.map(w => `<p style="color:#994016">Review: ${e(w)}</p>`).join('')}${stops}
      <footer style="border-top:1px solid #e5dfd5;padding-top:18px;${smallStyle};overflow-wrap:anywhere;word-break:break-word">
      <h3 style="font:600 13px Arial,Helvetica,sans-serif;margin:0 0 10px">Trip notes</h3><p>${e(conditions(b))}</p>
      <p>${b.firsthand} of ${b.stops.length} stops marked firsthand for the selected experience. Archive visits are historical, not current operating information.</p>
      ${b.stops.map((s,i)=>`<p style="margin:5px 0">${i+1}. ${e(s.name)}: ${e(s.evidence)}</p>`).join('')}
      ${sent ? '' : '<p>Local preview only. No email has been sent.</p>'}<p style="font-size:10px">Accepted ${e(b.acceptedAt)}<br>Plan ${e(b.planId)}<br>Briefing ${e(b.id)}</p></footer>
      ${link ? `<a style="${linkStyle}" target="_top" href="${e(link)}">Open this exact briefing</a>` : ''}`;
}
export function briefingHtml(b: Briefing, origin = '', sent = false): string {
    return emailDocument(`${b.cityName} · ${b.date}`, briefingHtmlContent(b, origin, sent), daySummary(b));
}
