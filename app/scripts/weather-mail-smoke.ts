import assert from 'node:assert/strict';
import { cloudFixture } from './cloud-fixtures';
import { notificationFor, type NotificationPreference } from '../src/lib/briefings/notifications';
import { assembleBriefing } from '../src/lib/briefings/assemble';
import { enrichWeather } from '../server/conditions/enrich';
import { sharedWeather, type CacheRpc } from '../server/conditions/shared-weather';
import { weatherRecord } from '../src/lib/conditions/weather';
import { deliver, type WorkerRpc } from '../server/companion/jobs';
const now=()=>new Date(),date='2026-09-13',snapshot=cloudFixture('paris',date),trip={id:'weather-mail-test',revision:1,segments:[{id:snapshot.tripId,snapshot}]};
const base=notificationFor(trip,date,'Europe/Paris');
const forecast=async(city:'paris'|'rome',day:string)=>weatherRecord(city,day,'forecast',now(),{lowC:15,highC:22,precipitationMm:4,precipitationProbability:70,maxWindKmh:18});
let checks=0;const test=async(name:string,f:()=>unknown)=>{await f();checks++;console.log('PASS '+name);};
async function main(){
 await test('flag off returns original briefing and performs no lookup',async()=>{
  assert.equal(await enrichWeather(base,async()=>{throw new Error('must not fetch');},false),base);
 });
 await test('repeated destinations share retrieval while preserving distinct briefing identities',async()=>{
  let calls=0;const mixed={...structuredClone(base),items:[base.items[0],assembleBriefing(cloudFixture('rome',date),date),{...base.items[0],id:'different-window'}]};
  const result=await enrichWeather(mixed,async(c,d)=>{calls++;return forecast(c,d);},true);
  assert.equal(calls,2);assert.notEqual(result.items[0].id,result.items[2].id);
  result.items.forEach((b,i)=>assert.deepEqual(b.stops,mixed.items[i].stops));assert.ok(!mixed.items[0].weather);
 });
 await test('busy/budget/cache failures never bypass shared cache to call provider',async()=>{
  for(const state of ['busy','budget','disabled','superseded']){let calls=0;const get=sharedWeather(async()=>({state}),async(c,d)=>{calls++;return forecast(c,d);},()=>true);assert.notEqual((await get('paris',date)).state,'forecast');assert.equal(calls,0);}
  const get=sharedWeather(async()=>{throw new Error('db down');},forecast,()=>true);assert.equal((await get('paris',date)).state,'unavailable');
 });
 await test('only a current lease can publish a validated durable forecast',async()=>{
  const calls:string[]=[];const rpc:CacheRpc=async(action)=>{calls.push(action);return action==='claim'?{state:'lease',lease:'lease'}:{state:'stored'};};
  assert.equal((await sharedWeather(rpc,forecast,()=>true)('paris',date)).state,'forecast');assert.deepEqual(calls,['claim','finish']);
  const reject:CacheRpc=async action=>action==='claim'?{state:'lease',lease:'lease'}:{state:'superseded'};
  assert.equal((await sharedWeather(reject,forecast,()=>true)('paris',date)).state,'unavailable');
 });
 await test('invalid cached/synthetic weather and provider exceptions preserve unavailable fallback',async()=>{
  const invalid=await forecast('rome',date);assert.equal((await sharedWeather(async()=>({state:'hit',record:invalid}),forecast,()=>true)('paris',date)).state,'unavailable');
  const fallback=await enrichWeather(base,async()=>{throw new Error('source timeout');},true);assert.equal(fallback.items[0].weather?.state,'unavailable');assert.deepEqual(fallback.items[0].stops,base.items[0].stops);
 });
 const pref:NotificationPreference={tripId:trip.id,revision:1,enabled:true,zone:'Europe/Paris',time:'20:00',activatedAt:now().toISOString(),suppressed:false};
 await test('weather is frozen before reservation; provider failure still sends itinerary',async()=>{
  const order:string[]=[];let frozen:any;const rpc:WorkerRpc=async<T>(action:string,data:any)=>{order.push(action);if(action==='submit')frozen=structuredClone(data.briefing);return (action==='claim'?{id:'weather-job',lease:'lease',trip,date,zone:pref.zone,kind:'test'}:action==='submit'?{recipient:'test@example.invalid'}:{}) as T;};
  const result=await deliver({...pref,ownerId:'owner',trip},date,'test',undefined,{rpc,origin:()=> 'https://example.invalid',enrich:async b=>{order.push('weather');return enrichWeather(b,async()=>{throw new Error('outage');},true);},fetcher:async(_url,init)=>{order.push('send');assert.equal(frozen.items[0].weather.state,'unavailable');assert.ok(JSON.parse(init!.body as string).text.includes('Weather is unavailable'));return Response.json({id:'fake-provider'});}});
  assert.equal(result.state,'accepted');assert.deepEqual(order,['claim','weather','submit','send','finish']);assert.deepEqual(frozen.items[0].stops,base.items[0].stops);
 });
 await test('revision/pause rejection after weather retrieval prevents any email',async()=>{
  let requests=0;const rpc:WorkerRpc=async<T>(action:string)=> (action==='claim'?{id:'changed',lease:'lease',trip,date,zone:pref.zone,kind:'test'}:null) as T;
  const result=await deliver({...pref,ownerId:'owner',trip},date,'test',undefined,{rpc,origin:()=> 'https://example.invalid',enrich:b=>enrichWeather(b,forecast,true),fetcher:async()=>{requests++;return Response.json({id:'unexpected'});}});
  assert.equal(result.state,'skipped');assert.equal(requests,0);
 });
 console.log(`${checks} weather/mail integration checks passed; no external sends`);
}
main().catch(e=>{console.error(e);process.exitCode=1;});
