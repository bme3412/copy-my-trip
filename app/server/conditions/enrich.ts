import { withWeather } from '../../src/lib/conditions/briefing-weather.js';
import { WEATHER_SCOPES, weatherRecord, type WeatherCity, type WeatherRecord } from '../../src/lib/conditions/weather.js';
import type { SentBriefing } from '../../src/lib/briefings/notifications.js';
import { getSharedWeather } from './shared-weather.js';
/** Fetch only during unsent preparation. Frozen sent JSON is read without this function. */
export async function enrichWeather(briefing:SentBriefing,provider=getSharedWeather,enabled=process.env.WEATHER_EMAIL_ENABLED==='true',clock=()=>new Date()):Promise<SentBriefing>{
 if(!enabled)return briefing;
 const requests=new Map<string,Promise<WeatherRecord>>();
 for(const b of briefing.items){
  if(!Object.hasOwn(WEATHER_SCOPES,b.cityId))continue;
  const city=b.cityId as WeatherCity,key=`${city}/${b.date}`;
  if(b.timeZone!==WEATHER_SCOPES[city].timeZone||requests.has(key)||requests.size>=4)continue;
  requests.set(key,Promise.resolve().then(()=>provider(city,b.date)).catch(()=>weatherRecord(city,b.date,'unavailable',clock())));
 }
 const records=new Map(await Promise.all([...requests].map(async([key,p])=>[key,await p] as const)));
 return {...structuredClone(briefing),items:briefing.items.map(b=>{
  if(!Object.hasOwn(WEATHER_SCOPES,b.cityId))return structuredClone(b);
  const city=b.cityId as WeatherCity;if(b.timeZone!==WEATHER_SCOPES[city].timeZone)return structuredClone(b);
  const fallback=()=>weatherRecord(city,b.date,'unavailable',clock());
  try{return withWeather(b,records.get(`${city}/${b.date}`)??fallback(),clock());}catch{return withWeather(b,fallback(),clock());}
 })};
}
