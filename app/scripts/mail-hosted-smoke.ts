/** Disabled-delivery hosted test. Never contacts an email provider. */
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync, unlinkSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import { cloudSegments } from './cloud-fixtures';
import { notificationFor, serviceDates } from '../src/lib/briefings/notifications';
const ref='wxpsiguklujutvttrqrn';
if(process.env.CMT_ALLOW_MAIL_HOSTED!==ref) throw new Error('Explicit hosted test opt-in required');
const path='../supabase/.temp/mail-hosted-fixture.json';
const keys=JSON.parse(execFileSync('supabase',['projects','api-keys','--project-ref',ref,'--output','json'],{encoding:'utf8'})) as {name:string;type:string;api_key:string}[];
const publicKey=keys.find(k=>k.type==='publishable')!.api_key;
const make=(key=publicKey)=>createClient(`https://${ref}.supabase.co`,key,{auth:{persistSession:false,autoRefreshToken:false}});
const admin=make(keys.find(k=>k.name==='service_role')!.api_key);
const sql=(input:string)=>execFileSync('psql',['-X','-q','-A','-t','-v','ON_ERROR_STOP=1','-h','aws-0-us-east-1.pooler.supabase.com','-p','6543','-U',`postgres.${ref}`,'-d','postgres'],{input,encoding:'utf8',env:{...process.env,PGPASSWORD:readFileSync('../supabase/.temp/preview-db-password','utf8').trim(),PGSSLMODE:'require'}}).trim();
const lit=(v:string)=>"'"+v.replaceAll("'","''")+"'";
type Fixture={users:{id:string;email:string;password:string}[];tripId:string;mailId?:string};
const fixture:Fixture=existsSync(path)?JSON.parse(readFileSync(path,'utf8')):{users:[],tripId:`mail-hosted-${Date.now()}`};
const persist=()=>writeFileSync(path,JSON.stringify(fixture),{mode:0o600});
async function main(){
 if(process.argv.includes('--cleanup')){
  if(process.argv.includes('--expect-trip-deleted')) {
   const t=await admin.from('cmt_trips').select('deleted').eq('owner_id',fixture.users[0].id).eq('id',fixture.tripId).single();assert.ok(!t.error);assert.equal(t.data?.deleted,true);
   for(const table of ['cmt_mail_jobs','cmt_notification_preferences','cmt_plan_versions']){const rows=await admin.from(table).select('owner_id').eq('owner_id',fixture.users[0].id);assert.ok(!rows.error);assert.deepEqual(rows.data,[]);}
   console.log('PASS hosted browser trip deletion cancelled/removed its mail preferences, briefing and accepted versions');
  }

  for(const user of fixture.users){
   assert.match(user.email,/^cmt-mail-preview-\d+-[ab]@example\.invalid$/);
   const current=await admin.auth.admin.getUserById(user.id);
   if(current.error?.status===404)continue;
   assert.equal(current.data.user?.email,user.email);
   assert.equal(current.data.user?.user_metadata.purpose,'cmt-mail-hosted-preview-20260912');
   assert.ok(!(await admin.auth.admin.deleteUser(user.id)).error);
   for(const table of ['cmt_trips','cmt_mail_jobs','cmt_notification_preferences','cmt_mail_suppression']){
    const r=await admin.from(table).select('owner_id').eq('owner_id',user.id);assert.ok(!r.error);assert.deepEqual(r.data,[]);
   }
  }
  unlinkSync(path);console.log('PASS removed only tagged fixture accounts and their private cloud/mail data');return;
 }
 if(process.argv.includes('--advance')) {
  const owner=make();assert.ok(!(await owner.auth.signInWithPassword(fixture.users[0])).error);
  const prefs=await owner.rpc('cmt_notification_state',{p_trip_id:fixture.tripId});assert.ok(!prefs.error);
  assert.equal(prefs.data.preference.zone,'America/New_York');assert.equal(prefs.data.preference.time,'21:00');assert.equal(prefs.data.preference.enabled,false);assert.equal(prefs.data.preference.revision,4);
  const current=await owner.rpc('cmt_read_trips',{p_trip_id:fixture.tripId});assert.ok(!current.error);assert.equal(current.data.revision,1);
  current.data.segments[0].snapshot.id+='-v2';current.data.segments[0].snapshot.days[0].title='Updated demonstration heading';
  const saved=await owner.rpc('cmt_save_trip',{p_trip_id:fixture.tripId,p_expected_revision:1,p_segments:current.data.segments});assert.ok(!saved.error);
  const old=await owner.rpc('cmt_read_mail',{p_id:fixture.mailId});assert.ok(!old.error);assert.equal(old.data.newerVersion,true);assert.notEqual(old.data.briefing.items[0].title,'Updated demonstration heading');
  console.log('PASS browser preference readback and explicit pause; newer cloud version preserves the prior briefing');return;
 }
 assert.equal(fixture.users.length,0,'Clean up existing fixture first');
 assert.equal(sql("select enabled::text || ':' || (pilot_owner is null)::text || ':' || require_pilot::text from public.cmt_mail_control;"),'false:true:true');
 assert.equal(sql("select count(*) from pg_class where relname in ('cmt_mail_control','cmt_mail_suppression','cmt_notification_preferences','cmt_mail_jobs','cmt_mail_events') and relrowsecurity;"),'5');
 assert.equal(sql("select has_table_privilege('authenticated','public.cmt_mail_jobs','select')::text || ':' || has_table_privilege('anon','public.cmt_mail_control','select')::text;"),'false:false');
 console.log('PASS migration applied; five mail tables have RLS; direct access revoked; global delivery disabled');
 const run=Date.now();const clients=[];
 for(const label of ['a','b']){
  const email=`cmt-mail-preview-${run}-${label}@example.invalid`,password=`CmtMailPreview-${run}-${label}!Only`;
  const created=await admin.auth.admin.createUser({email,password,email_confirm:true,user_metadata:{purpose:'cmt-mail-hosted-preview-20260912'}});
  assert.ok(!created.error && created.data.user,'Create tagged fixture without signup email');
  fixture.users.push({id:created.data.user!.id,email,password});persist();
  const c=make();assert.ok(!(await c.auth.signInWithPassword({email,password})).error);clients.push(c);
 }
 const [owner,other]=clients;
 let r=await owner.rpc('cmt_save_trip',{p_trip_id:fixture.tripId,p_expected_revision:0,p_segments:cloudSegments});assert.ok(!r.error);
 const read=await owner.rpc('cmt_notification_state',{p_trip_id:fixture.tripId});assert.ok(!read.error);assert.equal(read.data.ready,false);assert.equal(read.data.preference,null);
 const set={p_trip_id:fixture.tripId,p_expected_revision:0,p_enabled:false,p_zone:'Europe/Paris',p_time:'20:00'};
 r=await owner.rpc('cmt_set_notifications',set);assert.ok(!r.error);assert.equal(r.data.preference.revision,1);
 assert.equal((await owner.rpc('cmt_set_notifications',set)).error?.code,'PT409');
 assert.equal((await owner.rpc('cmt_set_notifications',{...set,p_expected_revision:1,p_enabled:true})).error?.code,'PT403');
 assert.equal((await other.rpc('cmt_notification_state',{p_trip_id:fixture.tripId})).error?.code,'PT404');
 assert.equal((await make().rpc('cmt_mail_worker',{p_secret:'invalid-test-capability',p_action:'ops'})).error?.code,'PT401');
 console.log('PASS real Auth/RPC: owner preferences, stale revision protection, cross-owner denial, disabled sending and worker authorization');
 const trip={id:fixture.tripId,revision:1,segments:cloudSegments};const date=serviceDates(trip,'Europe/Paris')[0];const briefing=notificationFor(trip,date,'Europe/Paris');
 // Cancelled synthetic job only: no reservation or email submission.
 fixture.mailId=sql(`insert into public.cmt_mail_jobs(owner_id,trip_id,service_date,kind,state,trip_revision,pref_revision,zone,lease_until,briefing,error_code) values(${lit(fixture.users[0].id)}::uuid,${lit(fixture.tripId)},${lit(date)}::date,'test','cancelled',1,1,'Europe/Paris',now(),${lit(JSON.stringify(briefing))}::jsonb,'synthetic_no_email_sent') returning id;`);persist();
 r=await owner.rpc('cmt_read_mail',{p_id:fixture.mailId});assert.ok(!r.error);assert.deepEqual(r.data.briefing,briefing);assert.equal(r.data.state,'cancelled');
 assert.equal((await other.rpc('cmt_read_mail',{p_id:fixture.mailId})).error?.code,'PT404');
 console.log('PASS exact frozen briefing readback and cross-owner isolation; cancelled fixture, no email');
 console.log(JSON.stringify({tripId:fixture.tripId,mailId:fixture.mailId,email:fixture.users[0].email}));
}
main().catch(e=>{console.error(e instanceof Error?e.message:'Hosted test failed');process.exitCode=1;});
