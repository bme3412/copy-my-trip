import { authenticate, cloudConfig, HttpError } from '../server/auth.js';
import { tripRpc } from '../server/trips.js';
import { deliver, mailConfigured } from '../server/companion/jobs.js';
import { cloudId, parseCloudTrip } from '../src/lib/cloud/schema.js';
import { nextSchedule, notificationFor, serviceDates, validZone, type NotificationState } from '../src/lib/briefings/notifications.js';
type Request = { method?: string; headers: Record<string,string | string[] | undefined>; query?: Record<string,string | string[] | undefined>; body?: unknown };
type Response = { setHeader(k:string,v:string):void; status(code:number):{json(body:unknown):void} };
export default async function handler(req: Request, res: Response) {
  res.setHeader('Cache-Control','private, no-store'); res.setHeader('Vary','Authorization');
  try {
    if (!['GET','POST'].includes(req.method || '')) throw new HttpError(405,'Method not allowed.');
    if (Number(req.headers['content-length'] || 0)>4096) throw new HttpError(413,'Request too large.');
    const config = cloudConfig();
    const user = await authenticate(typeof req.headers.authorization === 'string' ? req.headers.authorization : undefined, config);
    const rpc = (name:string, params:unknown) => tripRpc(config,user.authorization,name,params);
    const mailId = req.query?.mail;
    if (req.method==='GET' && mailId !== undefined) {
      if (typeof mailId !== 'string' || !/^[a-f0-9-]{36}$/.test(mailId)) throw new HttpError(400,'Invalid briefing ID.');
      res.status(200).json(await rpc('cmt_read_mail',{p_id:mailId})); return;
    }
    let body: Record<string,unknown> = {};
    if (req.method==='POST') {
      try { const raw=typeof req.body==='string'?req.body:JSON.stringify(req.body); if (!raw || Buffer.byteLength(raw)>4096) throw 0; body=JSON.parse(raw); if (!body || typeof body!=='object' || Array.isArray(body)) throw 0; }
      catch { throw new HttpError(400,'Invalid request.'); }
    }
    const tripId = req.method==='GET' ? req.query?.id : body.tripId;
    if (!cloudId(tripId)) throw new HttpError(400,'Choose a cloud trip.');
    const trip = parseCloudTrip(await rpc('cmt_read_trips',{p_trip_id:tripId}));
    let state = await rpc('cmt_notification_state',{p_trip_id:tripId}) as NotificationState;
    if (req.method==='POST') {
      if (body.action==='set') {
        if (Object.keys(body).some(k=>!['tripId','action','expectedRevision','enabled','zone','time'].includes(k)) || !Number.isSafeInteger(body.expectedRevision) || typeof body.enabled!=='boolean' || !validZone(body.zone) || typeof body.time!=='string' || !/^(18|19|20|21|22|23):[0-5][0-9]$/.test(body.time)) throw new HttpError(400,'Choose an evening time and valid IANA timezone.');
        if (body.enabled && !mailConfigured()) throw new HttpError(503,'Delivery is not enabled in this environment.');
        state=await rpc('cmt_set_notifications',{p_trip_id:tripId,p_expected_revision:body.expectedRevision,p_enabled:body.enabled,p_zone:body.zone,p_time:body.time}) as NotificationState;
      } else if (body.action==='test') {
        if (Object.keys(body).some(k=>!['tripId','action','date'].includes(k)) || !mailConfigured() || !state.ready || !state.preference || state.preference.suppressed) throw new HttpError(503,'Test delivery is not enabled.');
        const dates=serviceDates(trip,state.preference.zone);
        if (typeof body.date!=='string' || !dates.includes(body.date)) throw new HttpError(400,'Choose an accepted activity date.');
        const outcome=await deliver({...state.preference,ownerId:user.id,trip},body.date,'test');
        res.status(200).json(outcome); return;
      } else if (body.action==='preview') {
        if (typeof body.date!=='string' || !validZone(body.zone) || !serviceDates(trip,body.zone).includes(body.date)) throw new HttpError(400,'Choose an accepted activity date.');
        res.status(200).json(notificationFor(trip,body.date,body.zone)); return;
      } else throw new HttpError(400,'Unknown notification action.');
    }
    state.ready=state.ready && mailConfigured();
    state.nextDue=state.preference ? nextSchedule(trip,state.preference,new Date()) : null;
    res.status(200).json(state);
  } catch(e) { res.status(e instanceof HttpError?e.status:503).json({error:e instanceof HttpError?e.message:'Itinerary email is unavailable. Your trip is safe.'}); }
}
