import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useCloud } from '../state/CloudContext';
import { notificationRequest } from '../lib/cloud/notifications';
import { serviceDates, validZone, type NotificationState, type SentBriefing } from '../lib/briefings/notifications';
import type { CloudTrip } from '../lib/cloud/schema';
import { BriefingBody } from './BriefingBody';
export function NotificationPanel({ trip }: { trip: CloudTrip }) {
  const cloud = useCloud();
  const token = cloud.session?.access_token;
  const [state, setState] = useState<NotificationState>();
  const [zone, setZone] = useState(trip.segments[0].snapshot.timeZone);
  const [time, setTime] = useState('20:00');
  const [enabled, setEnabled] = useState(false);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [date, setDate] = useState('');
  const [preview, setPreview] = useState<SentBriefing>();
  const alive = useRef(true);
  useEffect(() => { alive.current=true; return () => { alive.current=false; }; }, []);
  useEffect(() => {
    if (!token) return;
    const controller = new AbortController();
    notificationRequest<NotificationState>(token, `?id=${encodeURIComponent(trip.id)}`, undefined, controller.signal).then(next => {
      setState(next); if (next.preference) { setZone(next.preference.zone); setTime(next.preference.time); setEnabled(next.preference.enabled); }
    }).catch(e => { if (!controller.signal.aborted) setMessage(e.message); });
    return () => controller.abort();
  }, [token, trip.id, trip.revision]);
  const dates = useMemo(() => validZone(zone) ? serviceDates(trip,zone) : [], [trip, zone]);
  const chosenDate = dates.includes(date) ? date : dates[0] || '';
  const run = async (work: () => Promise<void>) => {
    if (!token || busy) return; setBusy(true); setMessage('');
    try { await work(); } catch(e) { if(alive.current) setMessage(e instanceof Error ? e.message : 'Unable to complete this request.'); }
    finally { if(alive.current) setBusy(false); }
  };
  const save = (e: FormEvent) => { e.preventDefault(); void run(async () => {
    const next = await notificationRequest<NotificationState>(token!, '', { action:'set', tripId:trip.id, expectedRevision:state?.preference?.revision || 0, enabled, zone, time });
    if(alive.current) { setState(next); setMessage(enabled ? 'Evening itinerary emails enabled for this cloud trip.' : 'Itinerary emails paused. A message already submitted may still arrive.'); }
  }); };
  return <section className="companion-panel" aria-label="Itinerary emails"><h3>Tomorrow, in your inbox</h3>
    <p>An optional evening briefing from the accepted version saved to this account. No weather or live closure monitoring is included.</p>
    {state && !state.ready && <p className="companion-notice">Email delivery is not enabled for this account yet. You can save preferences and preview the briefing.</p>}
    {state?.preference?.suppressed && <p role="alert">Delivery stopped after a bounce or complaint. It cannot be re-enabled from this page.</p>}
    <form className="cloud-form" onSubmit={save}>
      <label>Evening delivery time<input type="time" min="18:00" max="23:59" required value={time} onChange={e=>setTime(e.target.value)} /></label>
      <label>Fixed notification timezone<input value={zone} required placeholder="Europe/Paris" onChange={e=>{setZone(e.target.value);setPreview(undefined);}} /></label>
      <p>{time} in {zone}, wherever you travel. “Tomorrow” follows this timezone; each activity shows its destination timezone.</p>
      <label className="notification-optin"><input type="checkbox" checked={enabled} disabled={!state?.ready || state?.preference?.suppressed} onChange={e=>setEnabled(e.target.checked)} />Email tomorrow’s accepted itinerary to {cloud.session?.user.email}</label>
      <button className="btn btn-primary" disabled={busy || !state || !validZone(zone)}>Save email preferences</button>
      {state?.preference?.enabled && <button type="button" disabled={busy} onClick={()=>void run(async()=>{const next=await notificationRequest<NotificationState>(token!,'',{action:'set',tripId:trip.id,expectedRevision:state.preference!.revision,enabled:false,zone:state.preference!.zone,time:state.preference!.time});if(alive.current){setState(next);setEnabled(false);setMessage('Itinerary emails paused. A message already submitted may still arrive.');}})}>Pause itinerary emails</button>}
    </form>
    {state?.nextDue ? <p>Next eligible evening: {new Date(state.nextDue.at).toLocaleString(undefined,{timeZone:state.preference!.zone})} · {state.preference!.zone}, for {state.nextDue.date}. Delivery can take up to an hour. Late activation starts at the next eligible evening.</p> : state?.preference?.enabled ? <p>No future eligible evening remains for this saved itinerary. Change its accepted dates or use a preview.</p> : <p>Nightly delivery is paused.</p>}
    <label>Briefing date<select value={chosenDate} onChange={e=>{setDate(e.target.value);setPreview(undefined);}}>{dates.map(d=><option key={d}>{d}</option>)}</select></label>
    <div className="companion-actions"><button disabled={busy || !chosenDate} onClick={()=>void run(async()=>{const b=await notificationRequest<SentBriefing>(token!,'',{action:'preview',tripId:trip.id,date:chosenDate,zone});if(alive.current)setPreview(b);})}>Preview email contents</button>
      <button disabled={busy || !state?.ready || !state.preference || state.preference.suppressed || !chosenDate || zone!==state.preference.zone} onClick={()=>void run(async()=>{
        const result=await notificationRequest<{state:string}>(token!,'',{action:'test',tripId:trip.id,date:chosenDate});
        const next=await notificationRequest<NotificationState>(token!,`?id=${encodeURIComponent(trip.id)}`);
        if(alive.current){setState(next);setMessage(result.state==='skipped'?'No new email submitted. This date may already have a test, or delivery is paused.':`Test submission: ${result.state}. Check delivery status below.`);}
      })}>Send one test email to me</button></div>
    <p className="text-muted">Test mail requires a separate click and does not subscribe you. One test per trip date. Briefing links require sign-in and remain available for 90 days, unless you delete the trip or account.</p>
    <p role="status">{message}</p>
    {preview && <div><h4>Email contents preview — no email sent</h4>{preview.items.map(item=><BriefingBody key={`${item.planId}-${item.date}`} briefing={item} storage="account"/>)}</div>}
    {!!state?.deliveries.length && <><h4>Delivery history</h4><ul>{state.deliveries.map(d=><li key={d.id}>{d.service_date} · {d.kind} · {d.state} <Link to={`/${trip.segments[0].snapshot.cityId}/mail/${d.id}`}>Open exact briefing</Link></li>)}</ul><p>Accepted means the provider accepted the request. Delivered means its delivery event was received. Unknown submissions are held for investigation, never automatically resent.</p></>}
  </section>;
}
