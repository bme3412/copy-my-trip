import { escapeHtml as e, type Briefing } from './schema.js';

/** Only emphasis is supported. Escape source text before adding our own HTML. */
export const proseText = (text: string) => text.replace(/\*\*([^*\n]+)\*\*/g, '$1').replace(/\*([^*\n]+)\*/g, '$1');
export const proseHtml = (text: string) => e(text).replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>').replace(/\*([^*\n]+)\*/g, '<em>$1</em>');
export const friendlyDate = (date: string) => new Intl.DateTimeFormat('en-US', { weekday: 'long', month: 'long', day: 'numeric', timeZone: 'UTC' }).format(new Date(`${date}T12:00:00Z`));
const clock = (minutes: number) => { const n = Math.round(minutes); return `${Math.floor(n/60)}:${String(n%60).padStart(2,'0')}`; };
export function daySummary(b: Briefing): string {
  if (!b.stops.length) return 'No accepted activities on this date.';
  const start = Math.min(...b.stops.map(s => s.timeIn));
  const end = Math.max(...b.stops.map(s => s.timeIn+s.dur+(s.returnAfter?.min ?? 0)));
  const walk = b.stops.reduce((n,s)=>n+(s.travelMode==='walk'?s.travelMin:0)+(s.returnAfter?.mode==='walk'?s.returnAfter.min:0),0);
  const metro = b.stops.reduce((n,s)=>n+Number(s.travelMode==='metro')+Number(s.returnAfter?.mode==='metro'),0);
  return [`${b.stops.length} ${b.stops.length===1?'stop':'stops'}`, `${clock(start)}–${clock(end)}`, ...(walk?[`${walk} min walking (est.)`]:[]), ...(metro?[`${metro} métro ${metro===1?'leg':'legs'} (est.)`]:[])].join(' · ');
}
export function sourceLabel(s: Briefing['stops'][number]): string {
  return s.source === 'verified' ? s.image ? 'From the firsthand archive' : 'Catalog firsthand · no archive image' : 'Web-researched';
}
export const smallStyle = 'font:12px/1.6 Arial,Helvetica,sans-serif;color:#62665f';
export const linkStyle = 'color:#b94716;text-decoration:underline';
export function emailDocument(title: string, content: string, preheader = ''): string {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${e(title)}</title></head><body style="margin:0;padding:0;background:#f6f4ef;color:#142033;font:15px/1.65 Arial,Helvetica,sans-serif">${preheader?`<div style="display:none;max-height:0;overflow:hidden;opacity:0;mso-hide:all">${e(preheader)}</div>`:''}<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:20px 12px"><table role="presentation" width="640" cellpadding="0" cellspacing="0" style="width:100%;max-width:640px;background:#fffefa;border:1px solid #e5dfd5"><tr><td style="padding:26px 22px"><p style="margin:0 0 22px;font:600 12px Arial,Helvetica,sans-serif;letter-spacing:1.5px;color:#b94716">COPY MY TRIP</p>${content}</td></tr></table></td></tr></table></body></html>`;
}
