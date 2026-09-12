import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { Webhook } from 'svix';
import { clone, addDate } from '../src/lib/trips/schema';
import { cloudSegments } from './cloud-fixtures';
import { notificationFor, nextSchedule, serviceDates, wallTime, renderNotification, type NotificationPreference } from '../src/lib/briefings/notifications';
import { deliver, tick, type WorkerRpc } from '../server/companion/jobs';
import { handleEvent } from '../api/companion-events';
import cron from '../api/companion-tick';
import narrate from '../api/narrate-day';
import extract from '../api/extract-preferences';
const trip={id:'mail-fixture',revision:1,segments:cloudSegments};
let passed=0;
async function test(name:string, work:()=>unknown){await work();passed++;console.log('PASS '+name);}
async function main(){
await test('calendar conversion handles spring gaps, autumn folds and 23/25-hour days',()=>{
  const iso=(d:string,t:string,z='Europe/Paris')=>new Date(wallTime(d,t,z)).toISOString();
  assert.equal(iso('2026-03-29','02:30'),'2026-03-29T01:30:00.000Z');
  assert.equal(iso('2026-10-25','02:30'),'2026-10-25T00:30:00.000Z');
  assert.equal((wallTime('2026-03-30','00:00','Europe/Paris')-wallTime('2026-03-29','00:00','Europe/Paris'))/3600000,23);
  assert.equal((wallTime('2026-10-26','00:00','Europe/Paris')-wallTime('2026-10-25','00:00','Europe/Paris'))/3600000,25);
  assert.equal(iso('2026-10-04','02:15','Australia/Lord_Howe'),'2026-10-03T15:45:00.000Z');
});
const dates=serviceDates(trip,'Europe/Paris');
const pref:NotificationPreference={tripId:trip.id,revision:1,enabled:true,zone:'Europe/Paris',time:'20:00',activatedAt:'2026-01-01T00:00:00Z',suppressed:false};
const due=wallTime(addDate(dates[0],-1),'20:00',pref.zone);
await test('schedule begins the evening before activities, bounds catch-up, skips late activation and completes',()=>{
  assert.deepEqual(nextSchedule(trip,pref,new Date(due-1000)),{at:new Date(due).toISOString(),date:dates[0]});
  assert.equal(nextSchedule(trip,pref,new Date(due+59*60000),true)?.date,dates[0]);
  assert.notEqual(nextSchedule(trip,pref,new Date(due+61*60000),true)?.date,dates[0]);
  assert.notEqual(nextSchedule(trip,{...pref,activatedAt:new Date(due+1000).toISOString()},new Date(due+2000),true)?.date,dates[0]);
  assert.equal(nextSchedule(trip,{...pref,enabled:false},new Date(due)),null);
  assert.equal(nextSchedule(trip,pref,new Date('2027-01-01')),null);
});
await test('mail preserves accepted facts, all repeated-city segments and HTML escaping without preview-only claims',()=>{
  const before=JSON.stringify(trip);
  for(const date of dates){const b=notificationFor(trip,date,pref.zone);assert.ok(b.items.length);const content=renderNotification(b,'https://example.invalid/paris/mail/id','https://example.invalid/paris/mail/id?pause=1');assert.ok(!content.text.includes('No email has been sent'));assert.ok(!content.html.includes('Local preview only'));for(const item of b.items){const source=trip.segments.find(s=>s.snapshot.id===item.planId)!.snapshot.days.find(d=>d.date===item.date)!;assert.deepEqual(item.stops,source.stops);}}
  const b=notificationFor(trip,dates[0],pref.zone);b.items[0].title='<script>bad()</script>';const c=renderNotification(b,'https://example.invalid/x','https://example.invalid/p');assert.ok(!c.html.includes('<script>'));assert.ok(c.html.includes('&lt;script&gt;'));
  assert.equal(JSON.stringify(trip),before);
});
await test('notification window includes carry-over with full accepted timing and destination date',()=>{
  const altered=clone(trip);const day=altered.segments[0].snapshot.days[0];day.stops[0].timeIn=1430;day.stops[0].dur=60;day.state.committed[0].timeIn=1430;day.state.committed[0].dur=60;altered.segments[0].snapshot.draft.days[0]=clone(day.state);
  const b=notificationFor(altered,addDate(day.date,1),'Europe/Paris');const item=b.items.find(i=>i.date===day.date)!;assert.equal(item.stops[0].timeIn,1430);assert.equal(item.stops[0].dur,60);
  const abroad=notificationFor(trip,dates[0],'America/New_York');assert.ok(abroad.items.every(i=>i.timeZone==='Europe/Paris' || i.timeZone==='Europe/Rome'));
});
let sends=0;const calls:{action:string;data:any}[]=[];
const rpc:WorkerRpc=async<T>(action:string,data?:unknown)=>{calls.push({action,data});return (action==='claim'?{id:'job-one',lease:'lease-one',trip,date:dates[0],zone:pref.zone,kind:'test'}:action==='submit'?{recipient:'verified@example.invalid'}:{}) as T;};
await test('provider send follows durable claim and submission, derives recipient, and uses a stable idempotency key',async()=>{
  const result=await deliver({...pref,ownerId:'owner',trip},dates[0],'test',undefined,{rpc,origin:()=> 'https://example.invalid',fetcher:async(_url,options)=>{sends++;assert.deepEqual(calls.map(c=>c.action),['claim','submit']);assert.equal((options!.headers as Record<string,string>)['Idempotency-Key'],'cmt/job-one');assert.deepEqual(JSON.parse(options!.body as string).to,['verified@example.invalid']);return Response.json({id:'provider-one'});}});
  assert.equal(result.state,'accepted');assert.equal(calls.at(-1)!.action,'finish');assert.equal(sends,1);
});
await test('ambiguous provider timeout is unknown with no automatic retry; rejected reservation never sends',async()=>{
  calls.length=0;
  const result=await deliver({...pref,ownerId:'owner',trip},dates[0],'test',undefined,{rpc,origin:()=> 'https://example.invalid',fetcher:async()=>{sends++;throw new Error('timeout');}});
  assert.equal(result.state,'unknown');assert.equal(sends,2);assert.equal(calls.at(-1)!.data.state,'unknown');
  const reject:WorkerRpc=async<T>(a:string,d?:unknown)=>a==='submit'?null as T:rpc<T>(a,d);
  await deliver({...pref,ownerId:'owner',trip},dates[0],'test',undefined,{rpc:reject,origin:()=> 'https://example.invalid',fetcher:async()=>{throw new Error('should not send');}});
});
await test('cron rejects missing and wrong secrets and respects its global environment pause',async()=>{
  let status=0;let body:any;const res={setHeader(){},status(n:number){status=n;return {json(b:unknown){body=b;}};}};
  delete process.env.CRON_SECRET;await cron({method:'GET',headers:{}},res);assert.equal(status,401);
  process.env.CRON_SECRET='test-cron-secret';await cron({method:'GET',headers:{authorization:'Bearer incorrect'}},res);assert.equal(status,401);
  delete process.env.COMPANION_EMAIL_ENABLED;await cron({method:'GET',headers:{authorization:'Bearer test-cron-secret'}},res);assert.deepEqual(body,{paused:true});
});
await test('tick processes due calendar nights and stops at its submission bound',async()=>{
  let processed=0;const c={...pref,ownerId:'owner',trip};
  await tick({rpc:async<T>()=>[c,c,c,c] as T,now:()=>new Date(due+60000),deliver:async()=>{processed++;return {state:'accepted'};}});assert.equal(processed,2);
});
await test('webhook verifies actual raw bytes, rejects altered/stale signatures and ignores unrelated sender mail',async()=>{
  const secret='whsec_'+randomBytes(32).toString('base64');process.env.RESEND_WEBHOOK_SECRET=secret;process.env.CMT_MAIL_WORKER_SECRET='test-worker';
  const wh=new Webhook(secret), timestamp=new Date(), id='msg-test';let events=0;
  const raw=JSON.stringify({type:'email.delivered',data:{email_id:'provider-test',from:'Copy My Trip <itinerary@mail.copy-my-trip.com>'}},null,2);
  const headers={'svix-id':id,'svix-timestamp':String(Math.floor(+timestamp/1000)),'svix-signature':wh.sign(id,timestamp,raw)};
  const eventRpc:WorkerRpc=async<T>()=>{events++;return {} as T;};
  assert.equal((await handleEvent(new Request('https://example.invalid',{method:'POST',headers,body:raw}),eventRpc)).status,200);assert.equal(events,1);
  assert.equal((await handleEvent(new Request('https://example.invalid',{method:'POST',headers,body:raw+' '}),eventRpc)).status,400);
  const old=new Date(+timestamp-601000);assert.equal((await handleEvent(new Request('https://example.invalid',{method:'POST',headers:{...headers,'svix-timestamp':String(Math.floor(+old/1000)),'svix-signature':wh.sign(id,old,raw)},body:raw}),eventRpc)).status,400);assert.equal(events,1);
  const unrelated=JSON.stringify({type:'email.delivered',data:{email_id:'other-provider',from:'unrelated@example.invalid'}});
  assert.equal((await handleEvent(new Request('https://example.invalid',{method:'POST',headers:{...headers,'svix-signature':wh.sign(id,timestamp,unrelated)},body:unrelated}),eventRpc)).status,200);assert.equal(events,1);
});
await test('unconfigured AI endpoints fail closed with stable errors even for malformed input',async()=>{
  delete process.env.AI_ENABLED;let status=0;const res={statusCode:0,setHeader(){},write(){},end(){},status(n:number){status=n;return {json(){},send(){}};}};
  await narrate({method:'POST',body:'{'},res);assert.equal(status,503);await extract({method:'POST',body:'{'},res);assert.equal(status,503);
});
console.log(`${passed} mail checks passed; no real provider calls or emails`);
}
main().catch(e=>{console.error(e);process.exitCode=1;});
