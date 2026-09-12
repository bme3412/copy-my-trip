import assert from 'node:assert/strict';
import { weatherService, weatherConfig } from '../server/conditions/weather';
import { weatherAt, weatherRecord, weatherLines } from '../src/lib/conditions/weather';
import { withWeather } from '../src/lib/conditions/briefing-weather';
import { cloudFixture } from './cloud-fixtures';
import { assembleBriefing, briefingHtml, briefingText } from '../src/lib/briefings/assemble';
const now=new Date('2026-09-12T12:00:00Z'), date='2026-09-13';
const payload=()=>({latitude:48.86,longitude:2.35,timezone:'Europe/Paris',daily_units:{time:'iso8601',temperature_2m_min:'°C',temperature_2m_max:'°C',precipitation_sum:'mm',precipitation_probability_max:'%',wind_speed_10m_max:'km/h'},daily:{time:Array.from({length:7},(_,i)=>`2026-09-${12+i}`),temperature_2m_min:Array(7).fill(15),temperature_2m_max:Array(7).fill(22),precipitation_sum:Array(7).fill(4),precipitation_probability_max:Array(7).fill(70),wind_speed_10m_max:Array(7).fill(18)}});
let checks=0;const test=async(name:string,fn:()=>unknown)=>{await fn();checks++;console.log('PASS '+name);};
const evalConfig=()=>({mode:'evaluation' as const});
async function main(){
 await test('provider request is city-only, bounded and cached; callers cannot mutate cache',async()=>{
  let calls=0;const service=weatherService((async(input,init)=>{calls++;const u=new URL(String(input));assert.equal(u.hostname,'api.open-meteo.com');assert.equal(u.searchParams.get('latitude'),'48.86');assert.ok(!u.search.includes('trip'));assert.equal(init?.redirect,'error');assert.ok(init?.signal);return Response.json(payload());}) as typeof fetch,evalConfig,()=>now);
  const [a,b]=await Promise.all([service('paris',date),service('paris',date)]);assert.equal(calls,1);assert.equal(a.state,'forecast');a.daily!.highC=60;assert.equal(b.daily!.highC,22);assert.equal((await service('paris',date)).daily?.highC,22);
 });
 await test('wrong city, timezone, date, units, null/invalid values fail safely',async()=>{
  for(const mutate of [(p:any)=>p.latitude=41.9,(p:any)=>p.timezone='Europe/Rome',(p:any)=>p.daily.time[1]='2026-09-20',(p:any)=>p.daily_units.temperature_2m_max='°F',(p:any)=>p.daily.precipitation_probability_max[1]=null,(p:any)=>p.daily.temperature_2m_min[1]=40,(p:any)=>p.daily.precipitation_probability_max[1]=101]){
   const p=payload();mutate(p);const service=weatherService((async()=>Response.json(p)) as typeof fetch,evalConfig,()=>now);assert.equal((await service('paris',date)).state,'unavailable');
  }
 });
 await test('out of horizon and disabled modes never contact provider',async()=>{
  const never=(async()=>{throw new Error('Must not fetch');}) as typeof fetch;
  const s=weatherService(never,evalConfig,()=>now);assert.equal((await s('paris','2026-09-19')).state,'out-of-horizon');assert.equal((await s('paris','2026-09-11')).state,'out-of-horizon');
  assert.equal((await weatherService(never,()=>({mode:'disabled'}),()=>now)('paris',date)).state,'disabled');
 });
 await test('provider failure/oversized responses preserve an unavailable record',async()=>{
  for(const f of [async()=>{throw new Error('timeout');},async()=>new Response('offline',{status:503}),async()=>new Response(' '.repeat(65537))])assert.equal((await weatherService(f as typeof fetch,evalConfig,()=>now)('paris',date)).state,'unavailable');
 });
 await test('expired forecast is labeled and wrong-day associations are rejected',()=>{
  const w=weatherRecord('paris',date,'forecast',now,{lowC:15,highC:22,precipitationMm:4,precipitationProbability:70,maxWindKmh:18});
  const stale=weatherAt(w,'paris',date,new Date(+now+3*3600000));assert.equal(stale.state,'stale');assert.ok(weatherLines(stale).some(l=>l.includes('expired')));assert.equal(w.state,'forecast');assert.throws(()=>weatherAt(w,'rome',date,now));assert.throws(()=>weatherAt(w,'paris','2026-09-14',now));
 });
 await test('weather derivatives preserve every accepted fact and source; shared output attribution',()=>{
  const fixture=cloudFixture();const b=assembleBriefing(fixture,date),saved=structuredClone(b),fresh=new Date();
  const w=weatherRecord('paris',date,'forecast',fresh,{lowC:15,highC:22,precipitationMm:4,precipitationProbability:70,maxWindKmh:18});
  const enriched=withWeather(b,w,fresh);assert.deepEqual(b,saved);assert.deepEqual(enriched.stops,b.stops);assert.deepEqual(enriched.warnings,b.warnings);assert.notEqual(enriched.id,b.id);
  const html=briefingHtml(enriched),text=briefingText(enriched);for(const output of [html,text]){assert.ok(output.includes('Open-Meteo'));assert.ok(output.includes('70%'));assert.ok(output.includes('Provider issue time is not supplied'));assert.ok(!output.includes('Weather and live operational updates are not connected'));}
  w.daily!.highC=60;assert.equal(enriched.weather?.daily?.highC,22);
 });
 await test('synthetic conditions stay conspicuous in app/email text and out of provider cache',()=>{
  const b=assembleBriefing(cloudFixture(),date),fresh=new Date();const w=weatherRecord('paris',date,'forecast',fresh,{lowC:15,highC:22,precipitationMm:4,precipitationProbability:70,maxWindKmh:18},true);
  for(const output of [briefingHtml(withWeather(b,w,fresh)),briefingText(withWeather(b,w,fresh))])assert.ok(output.includes('SIMULATED WEATHER'));
 });
 await test('free evaluation mode is rejected in production; commercial key remains server-only',()=>{
  const saved={...process.env};try{process.env.WEATHER_PROVIDER_MODE='evaluation';process.env.NODE_ENV='production';assert.equal(weatherConfig().mode,'disabled');process.env.WEATHER_PROVIDER_MODE='commercial';process.env.OPEN_METEO_API_KEY='test-secret';assert.equal(weatherConfig().mode,'commercial');}finally{process.env=saved;}
 });
 console.log(`${checks} weather checks passed; no live provider or email calls.`);
}
main().catch(e=>{console.error(e);process.exitCode=1;});
