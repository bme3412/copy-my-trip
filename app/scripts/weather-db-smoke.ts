/** Disposable local PostgreSQL only; no provider, cloud migration, or email calls. */
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { weatherRecord } from '../src/lib/conditions/weather';
import { cloudFixture } from './cloud-fixtures';
import { notificationFor } from '../src/lib/briefings/notifications';
import { withWeather } from '../src/lib/conditions/briefing-weather';
const host=process.env.PGHOST||'/tmp';if(!['/tmp','localhost','127.0.0.1'].includes(host))throw new Error('Local PostgreSQL only');
const db=`cmt_weather_test_${Date.now()}_${process.pid}`,secret='local-weather-capability-test-only-123456789';
const lit=(v:string)=>"'"+v.replaceAll("'","''")+"'";
const args=(database=db)=>['-X','-q','-A','-t','-v','ON_ERROR_STOP=1','-h',host,'-d',database];
const sql=(s:string,database=db)=>{const r=spawnSync('psql',args(database),{input:s,encoding:'utf8'});if(r.status!==0)throw new Error(r.stderr||'SQL failed');return r.stdout.trim();};
const asyncSql=(s:string)=>new Promise<string>((resolve,reject)=>{const p=spawn('psql',args());let out='',err='';p.stdout.on('data',b=>out+=b);p.stderr.on('data',b=>err+=b);p.on('close',c=>c?reject(new Error(err)):resolve(out.trim()));p.stdin.end(s);});
const json=(v:unknown)=>lit(JSON.stringify(v))+'::jsonb';
let date:string;const call=(action:string,city='paris',day=date,lease:string|null=null,record:unknown=null)=>`select public.cmt_weather_cache_worker(${lit(secret)},${lit(action)},${lit(city)},${lit(day)},${lease?lit(lease)+'::uuid':'null'},${record?json(record):'null'});`;
const result=(s:string)=>JSON.parse(sql(s).split('\n').at(-1)!);
const forbidden=(s:string,code:string)=>sql(`select public.test_error(${lit(s)},${lit(code)});`);
let checks=0;const test=async(name:string,f:()=>unknown)=>{await f();checks++;console.log('PASS '+name);};
async function main(){
 sql(`create database ${db};`,'postgres');try{
 sql(`do $$ begin if not exists(select from pg_roles where rolname='anon') then create role anon nologin; end if; if not exists(select from pg_roles where rolname='authenticated') then create role authenticated nologin; end if; end $$;
 create schema auth;
 create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz,is_anonymous boolean default false);
 create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
 grant usage on schema auth to anon,authenticated;
 grant execute on function auth.uid() to anon,authenticated;
 create function public.test_error(s text,expected text) returns void language plpgsql as $$ declare actual text;begin begin execute s;exception when others then get stacked diagnostics actual=returned_sqlstate;end;if actual is distinct from expected then raise exception 'Expected %, got %',expected,actual;end if;end $$;`);
 for(const migration of ['202609120001_companion_cloud.sql','202609120003_itinerary_emails.sql','202609120004_weather_cache.sql'])sql(readFileSync('../supabase/migrations/'+migration,'utf8'));
 sql(`update public.cmt_mail_control set worker_hash=encode(sha256(convert_to(${lit(secret)},'UTF8')),'hex') where singleton;`);
 date=sql("select (now() at time zone 'Europe/Paris')::date;");
 await test('migration starts disabled; tables use RLS and revoke direct access',()=>{
  assert.equal(result(call('claim')).state,'disabled');assert.equal(sql("select count(*) from pg_class where relname in ('cmt_weather_control','cmt_weather_cache') and relrowsecurity;"),'2');
  forbidden('set role anon;select * from public.cmt_weather_cache','42501');forbidden('set role authenticated;'+call('claim'),'42501');
  forbidden("set role anon;select public.cmt_weather_cache_worker('wrong','ops')",'PT401');
 });
 sql('update public.cmt_weather_control set enabled=true;');
 let lease:string;
 await test('concurrent workers reserve only one fetch and one budget unit',async()=>{
  const responses=await Promise.all([asyncSql('set role anon;'+call('claim')),asyncSql('set role anon;'+call('claim'))]);const r=responses.map(s=>JSON.parse(s.split('\n').at(-1)!));
  assert.deepEqual(r.map(x=>x.state).sort(),['busy','lease']);lease=r.find(x=>x.lease).lease;assert.equal(result(call('ops')).reservedRequests,1);
 });
 const record=weatherRecord('paris',date,'forecast',new Date(),{lowC:15,highC:22,precipitationMm:4,precipitationProbability:70,maxWindKmh:18});
 await test('stale/foreign leases cannot write; private payload and simulations rejected',()=>{
  assert.equal(result(call('finish','paris',date,'11111111-1111-1111-1111-111111111111',record)).state,'superseded');
  forbidden(call('finish','paris',date,lease,{...record,ownerId:'private'}),'PT400');
  forbidden(call('finish','paris',date,lease,{...record,synthetic:true}),'PT400');
  forbidden(call('finish','paris',date,lease,{...record,daily:{...record.daily,precipitationProbability:null}}),'PT400');
 });
 await test('valid record is shared without another budget reservation',()=>{
  assert.equal(result(call('finish','paris',date,lease,record)).state,'stored');const hit=result(call('claim'));assert.equal(hit.state,'hit');assert.deepEqual(hit.record,record);assert.equal(result(call('ops')).reservedRequests,1);
 });
 await test('expired cache refresh is fenced; failures impose a cooldown',()=>{
  sql("update public.cmt_weather_cache set cache_until=now()-interval '1 second';");const next=result(call('claim'));assert.equal(next.state,'lease');
  assert.equal(result(call('finish','paris',date,lease,record)).state,'superseded');assert.equal(result(call('finish','paris',date,next.lease)).state,'unavailable');
  assert.equal(result(call('claim')).state,'busy');assert.equal(sql('select count(*) from public.cmt_weather_cache where record is not null;'),'0');
 });
 await test('crashed lease is reclaimable; global budget bounds different keys',()=>{
  sql('update public.cmt_weather_control set daily_limit=3;');sql("update public.cmt_weather_cache set retry_at=null,lease_until=now()-interval '1 second';");assert.equal(result(call('claim')).state,'lease');
  assert.equal(result(call('claim','rome')).state,'budget');assert.equal(result(call('ops')).reservedRequests,3);
 });
 await test('UTC budget rollover resets reservations, not cache identity',()=>{
  sql("update public.cmt_weather_control set budget_day=budget_day-1;");assert.equal(result(call('claim','rome')).state,'lease');assert.equal(result(call('ops')).reservedRequests,1);
 });
 await test('invalid scope/horizon and expired records fail closed',()=>{
  forbidden(call('claim','madrid'),'PT400');assert.equal(result(call('claim','paris','2099-01-01')).state,'out-of-horizon');
  sql("update public.cmt_weather_cache set lease_until=now()-interval '1 second';");const c=result(call('claim'));
  forbidden(call('finish','paris',date,c.lease,{...record,expiresAt:new Date(Date.now()-1000).toISOString()}),'PT400');
 });
 await test('48-hour cache retention removes old rows without touching trip tables',()=>{
  sql("update public.cmt_weather_cache set updated_at=now()-interval '49 hours';");result(call('claim'));
  assert.equal(sql("select count(*) from public.cmt_weather_cache where updated_at<now()-interval '48 hours';"),'0');
 });
 await test('mail reservation freezes weather; later cache changes cannot alter it; trip deletion removes it',()=>{
  const owner='11111111-1111-1111-1111-111111111111';
  const snapshot=cloudFixture('paris',date,new Date()),trip={id:'weather-trip',revision:1,segments:[{id:snapshot.tripId,snapshot}]};
  const auth=`set role authenticated;select set_config('request.jwt.claim.sub','${owner}',false);`;
  const mail=(action:string,data:unknown)=>`select public.cmt_mail_worker(${lit(secret)},${lit(action)},${json(data)});`;
  sql(`insert into auth.users values('${owner}','fixture@example.invalid',now(),false);update public.cmt_mail_control set enabled=true,pilot_owner='${owner}';`);
  sql(auth+`select public.cmt_save_trip('weather-trip',0,${json(trip.segments)});select public.cmt_set_notifications('weather-trip',0,false,'Europe/Paris','20:00');`);
  const job=result(mail('claim',{ownerId:owner,tripId:trip.id,tripRevision:1,prefRevision:1,kind:'test',date}));
  const b=notificationFor(trip,date,'Europe/Paris');b.items=b.items.map(item=>withWeather(item,record));
  assert.equal(result(mail('submit',{id:job.id,lease:job.lease,briefing:b})).recipient,'fixture@example.invalid');
  result(mail('finish',{id:job.id,lease:job.lease,state:'accepted',providerId:'local-weather-test'}));
  sql(`update public.cmt_weather_cache set record=${json({...record,daily:{...record.daily,highC:30}})};`);
  assert.deepEqual(result(auth+`select public.cmt_read_mail('${job.id}');`).briefing,b);
  sql(auth+"select public.cmt_delete_trip('weather-trip',1);");assert.equal(sql('select count(*) from public.cmt_mail_jobs;'),'0');
  assert.ok(Number(sql('select count(*) from public.cmt_weather_cache;'))>0,'Shared nonpersonal records need not follow individual trip deletion');
 });
 console.log(`${checks} weather PostgreSQL checks passed`);
 }finally{sql(`drop database ${db} with (force);`,'postgres');}
}
main().catch(e=>{console.error(e);process.exitCode=1;});
