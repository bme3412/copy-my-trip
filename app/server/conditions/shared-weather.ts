import { cloudConfig } from '../auth.js';
import { weatherConfig, weatherService } from './weather.js';
import { weatherAt, weatherRecord, type WeatherCity, type WeatherRecord } from '../../src/lib/conditions/weather.js';
export type CacheRpc=(action:'claim'|'finish',city:WeatherCity,date:string,lease?:string,record?:WeatherRecord)=>Promise<{state:string;lease?:string;record?:WeatherRecord}>;
export const cacheRpc:CacheRpc=async(action,city,date,lease,record)=>{
 const cfg=cloudConfig();if(!process.env.CMT_MAIL_WORKER_SECRET)throw new Error('Weather worker unavailable');
 const r=await fetch(`${cfg.url}/rest/v1/rpc/cmt_weather_cache_worker`,{method:'POST',headers:{apikey:cfg.key,'Content-Type':'application/json'},
  body:JSON.stringify({p_secret:process.env.CMT_MAIL_WORKER_SECRET,p_action:action,p_city:city,p_date:date,p_lease:lease??null,p_record:record??null}),signal:AbortSignal.timeout(4000)});
 if(!r.ok)throw new Error('Weather cache unavailable');return r.json();
};
const commercialWeather=weatherService();
export function sharedWeather(rpc:CacheRpc=cacheRpc,provider=commercialWeather,configured=()=>weatherConfig().mode==='commercial',clock=()=>new Date()){
 return async(city:WeatherCity,date:string):Promise<WeatherRecord>=>{
  const unavailable=(state:'unavailable'|'disabled'|'out-of-horizon'='unavailable')=>weatherRecord(city,date,state,clock());
  if(!configured())return unavailable('disabled');
  try{
   const claim=await rpc('claim',city,date);
   if(claim.state==='disabled'||claim.state==='out-of-horizon')return unavailable(claim.state);
   if(claim.state==='hit' && claim.record){const r=weatherAt(claim.record,city,date,clock());return r.state==='forecast'&&!r.synthetic?r:unavailable();}
   if(claim.state!=='lease'||!claim.lease)return unavailable();
   let record:WeatherRecord|undefined;
   try{const fetched=weatherAt(await provider(city,date),city,date,clock());if(fetched.state==='forecast'&&!fetched.synthetic)record=fetched;}catch{/* Preserve itinerary delivery on source failure. */}
   const stored=await rpc('finish',city,date,claim.lease,record);
   // Only use data whose durable cache write was accepted under our current lease.
   return stored.state==='stored'&&record?record:unavailable();
  }catch{return unavailable();}
 };
}
export const getSharedWeather=sharedWeather();
