/** Explicitly authorized two-message pilot. Never use for a general mailing list. */
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync, unlinkSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import { CITIES } from '../src/cities';
import { cloudFixture } from './cloud-fixtures';
import { acceptSnapshot } from '../src/lib/trips/snapshot';
import { notificationFor, serviceDates } from '../src/lib/briefings/notifications';
const ref='wxpsiguklujutvttrqrn', origin='https://copy-my-trip.com', email='erhardbr@gmail.com';
const purpose='cmt-two-email-pilot-20260912', statePath='../supabase/.temp/mail-live-pilot.json';
if(process.env.CMT_APPROVED_MAIL_PILOT!=='two-emails-erhardbr-20260912') throw new Error('Explicit approved pilot opt-in required');
const mode=process.argv[2];
assert.ok(['setup','send-test','status','pause','cleanup'].includes(mode));
const keys=JSON.parse(execFileSync('supabase',['projects','api-keys','--project-ref',ref,'--output','json'],{encoding:'utf8'})) as {name:string;type:string;api_key:string}[];
const pub=keys.find(k=>k.type==='publishable')!.api_key;
const make=(key=pub)=>createClient(`https://${ref}.supabase.co`,key,{auth:{persistSession:false,autoRefreshToken:false}});
const admin=make(keys.find(k=>k.name==='service_role')!.api_key);
const sql=(input:string)=>execFileSync('psql',['-X','-q','-A','-t','-v','ON_ERROR_STOP=1','-h','aws-0-us-east-1.pooler.supabase.com','-p','6543','-U',`postgres.${ref}`,'-d','postgres'],{input,encoding:'utf8',env:{...process.env,PGPASSWORD:readFileSync('../supabase/.temp/preview-db-password','utf8').trim(),PGSSLMODE:'require'}}).trim();
const lit=(s:string)=>"'"+s.replaceAll("'","''")+"'";
type State={id:string;email:string;password:string;tripId:string;date:string;zone:string;time:string;testId?:string;paused?:boolean};
let state:State;
const persist=()=>writeFileSync(statePath,JSON.stringify(state),{mode:0o600});
async function main(){
 if(mode==='setup' && !existsSync(statePath)){
  assert.equal(sql("select count(*) from auth.users where lower(email)='erhardbr@gmail.com';"),'0','Never replace an existing account');
  assert.equal(sql("select (not enabled and pilot_owner is null and require_pilot and worker_hash is not null)::text from public.cmt_mail_control;"),'true');
  assert.ok(Date.now()<Date.parse('2026-09-13T00:00:00Z'),'Approved evening window has passed; do not backfill');
  const password=randomBytes(36).toString('base64url');
  const created=await admin.auth.admin.createUser({email,password,email_confirm:true,user_metadata:{purpose}});
  assert.ok(!created.error && created.data.user,'Create authorized temporary account without an additional signup email');
  state={id:created.data.user!.id,email,password,tripId:'itinerary-delivery-pilot-20260912',date:'2026-09-13',zone:'America/New_York',time:'20:00'};persist();
 }else {state=JSON.parse(readFileSync(statePath,'utf8'));}
 assert.equal(state.email,email);
 const current=await admin.auth.admin.getUserById(state.id);
 assert.equal(current.data.user?.email,email);assert.equal(current.data.user?.user_metadata.purpose,purpose);
 // Global stop must still take effect if the owner session or hosted API later fails.
 if(mode==='pause')sql(`update public.cmt_mail_control set enabled=false where singleton and pilot_owner=${lit(state.id)}::uuid;`);
 const owner=make();const auth=await owner.auth.signInWithPassword({email,password:state.password});assert.ok(!auth.error && auth.data.session);
 const api=async(path:string,body?:unknown)=>{
  const r=await fetch(origin+path,{method:body?'POST':'GET',headers:{Authorization:`Bearer ${auth.data.session!.access_token}`,...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(45000)});
  const result=await r.json();assert.equal(r.status,200,`Production ${path} HTTP ${r.status}: ${result.error||''}`);return result;
 };
 if(mode==='setup'){
  assert.equal(sql(`select count(*) from public.cmt_trips where owner_id=${lit(state.id)}::uuid;`),'0','Setup already saved a trip; inspect instead of replacing');
  const fixture=cloudFixture('paris',state.date,new Date());
  const snapshot=acceptSnapshot(CITIES.paris,{...fixture.draft,departing:'2026-09-14'},undefined,new Date(),true);
  const trip={id:state.tripId,revision:1,segments:[{id:snapshot.tripId,snapshot}]};
  assert.deepEqual(serviceDates(trip,state.zone),[state.date],'Only one schedulable demo day');
  const sample=JSON.parse(readFileSync('../build-plan/artifacts/itinerary-email-pilot/briefing.json','utf8'));
  assert.deepEqual(notificationFor(trip,state.date,state.zone).items[0].stops,sample.items[0].stops,'Same seven reviewed stops and timings');
  await api('/api/trips',{action:'save',tripId:state.tripId,expectedRevision:0,segments:trip.segments});
  await api('/api/notifications',{action:'set',tripId:state.tripId,expectedRevision:0,enabled:false,zone:state.zone,time:state.time});
  assert.equal(sql(`update public.cmt_mail_control set enabled=true,pilot_owner=${lit(state.id)}::uuid,daily_limit=2 where singleton and not enabled and pilot_owner is null and require_pilot returning enabled;`),'t');
  const preferences=await api('/api/notifications',{action:'set',tripId:state.tripId,expectedRevision:1,enabled:true,zone:state.zone,time:state.time});
  assert.equal(preferences.ready,true);assert.equal(preferences.nextDue.at,'2026-09-13T00:00:00.000Z');
  console.log(JSON.stringify({pilotOwner:state.id,tripId:state.tripId,recipient:email,onlyDate:state.date,scheduled:preferences.nextDue,submitted:0}));
 }else if(mode==='send-test'){
  assert.ok(!state.paused);
  const result=await api('/api/notifications',{action:'test',tripId:state.tripId,date:state.date});
  if(result.id){state.testId=result.id;persist();}
  console.log(JSON.stringify({test:result}));
  assert.ok(['accepted','delivered','skipped'].includes(result.state),'Inspect uncertain/failed submission; never resend automatically');
  const duplicate=await api('/api/notifications',{action:'test',tripId:state.tripId,date:state.date});
  assert.equal(duplicate.state,'skipped');console.log('PASS duplicate test request did not submit a second email');
 }else if(mode==='pause'){
  const pref=await api(`/api/notifications?id=${state.tripId}`);
  if(pref.preference.enabled)await api('/api/notifications',{action:'set',tripId:state.tripId,expectedRevision:pref.preference.revision,enabled:false,zone:state.zone,time:state.time});
  sql(`update public.cmt_mail_control set enabled=false where singleton and pilot_owner=${lit(state.id)}::uuid;`);
  state.paused=true;persist();console.log('PASS pilot preferences and global delivery paused');
 }else if(mode==='cleanup'){
  assert.ok(state.paused,'Pause before cleanup');
  const jobs=await admin.from('cmt_mail_jobs').select('kind,state').eq('owner_id',state.id);assert.ok(!jobs.error);assert.equal(jobs.data?.length,2);assert.ok(jobs.data?.every(j=>j.state==='delivered'),'Retain fixture while outcomes need investigation');
  assert.ok(!(await admin.auth.admin.deleteUser(state.id)).error);
  assert.equal(sql(`select count(*) from public.cmt_mail_jobs where owner_id=${lit(state.id)}::uuid;`),'0');
  unlinkSync(statePath);console.log('PASS only the tagged temporary pilot account and its private data removed');return;
 }
 const result=await api(`/api/notifications?id=${state.tripId}`);
 console.log(JSON.stringify({preference:result.preference,nextDue:result.nextDue,deliveries:result.deliveries}));
 const jobs=await admin.from('cmt_mail_jobs').select('id,kind,state,provider_id,submitted_at,error_code').eq('owner_id',state.id);assert.ok(!jobs.error);
 assert.ok((jobs.data?.filter(j=>j.submitted_at).length||0)<=2,'Stop: pilot exceeded approved submission count');
 console.log(JSON.stringify({jobs:jobs.data}));
 for(const job of jobs.data||[]){
  if(!job.submitted_at)continue;
  const frozen=await api(`/api/notifications?mail=${job.id}`);
  const trip=await api(`/api/trips?id=${state.tripId}`);
  assert.deepEqual(frozen.briefing,notificationFor(trip,state.date,state.zone));
  const unauth=await fetch(origin+`/api/notifications?mail=${job.id}`);assert.equal(unauth.status,401);
 }
 console.log('PASS production private briefing matches accepted facts; anonymous access rejected');
}
main().catch(e=>{console.error(e instanceof Error?e.message:'Pilot failed');process.exitCode=1;});
