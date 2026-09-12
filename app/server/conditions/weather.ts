import { addDate, dateInZone, isDate } from '../../src/lib/trips/schema.js';
import { WEATHER_SCOPES, weatherRecord, weatherAt, type WeatherCity, type WeatherRecord } from '../../src/lib/conditions/weather.js';
const DAILY='temperature_2m_min,temperature_2m_max,precipitation_sum,precipitation_probability_max,wind_speed_10m_max';
type Config={mode:'disabled'|'evaluation'|'commercial';key?:string};
export function weatherConfig(): Config {
  if(process.env.WEATHER_PROVIDER_MODE==='commercial' && process.env.OPEN_METEO_API_KEY) return {mode:'commercial',key:process.env.OPEN_METEO_API_KEY};
  if(process.env.WEATHER_PROVIDER_MODE==='evaluation' && process.env.NODE_ENV!=='production' && !process.env.VERCEL_ENV) return {mode:'evaluation'};
  return {mode:'disabled'};
}
/** Nonpersonal cache only; bounded per process, not a durable shared production cache. */
export function weatherService(fetcher:typeof fetch=fetch, config:()=>Config=weatherConfig, clock=()=>new Date()) {
  const cache=new Map<string,{at:number;record:WeatherRecord}>();
  const pending=new Map<string,Promise<WeatherRecord>>();
  return async (city:WeatherCity,date:string):Promise<WeatherRecord>=>{
    if(!Object.hasOwn(WEATHER_SCOPES,city) || !isDate(date)) throw new Error('Choose Paris/Rome and a valid date');
    const now=clock(), scope=WEATHER_SCOPES[city], cfg=config(), today=dateInZone(now,scope.timeZone);
    if(cfg.mode==='disabled')return weatherRecord(city,date,'disabled',now);
    if(date<today || date>addDate(today,6))return weatherRecord(city,date,'out-of-horizon',now);
    const key=`${cfg.mode}/${city}/${date}`, saved=cache.get(key);
    if(saved && +now>=saved.at && +now-saved.at<3600000)return structuredClone(saved.record);
    if(pending.has(key))return structuredClone(await pending.get(key)!);
    const task=(async()=>{
      try {
        const url=new URL(cfg.mode==='commercial'?'https://customer-api.open-meteo.com/v1/forecast':'https://api.open-meteo.com/v1/forecast');
        for(const [k,v] of Object.entries({latitude:scope.latitude,longitude:scope.longitude,timezone:scope.timeZone,daily:DAILY,forecast_days:7,temperature_unit:'celsius',wind_speed_unit:'kmh',precipitation_unit:'mm',...(cfg.key?{apikey:cfg.key}:{})}))url.searchParams.set(k,String(v));
        // No trip, account, address, stop list, or precise traveler position leaves the application.
        const r=await fetcher(url,{signal:AbortSignal.timeout(4000),redirect:'error'});
        if(!r.ok || Number(r.headers.get('content-length')||0)>65536)throw new Error('Provider unavailable');
        const reader=r.body?.getReader();if(!reader)throw new Error('Missing body');
        const chunks:Uint8Array[]=[];let size=0;
        for(;;){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>65536){await reader.cancel();throw new Error('Oversized forecast');}chunks.push(value);}
        const bytes=new Uint8Array(size);let off=0;for(const c of chunks){bytes.set(c,off);off+=c.length;}
        const p=JSON.parse(new TextDecoder().decode(bytes));
        if(p.timezone!==scope.timeZone || !Number.isFinite(p.latitude)||!Number.isFinite(p.longitude) || Math.abs(p.latitude-scope.latitude)>0.25 || Math.abs(p.longitude-scope.longitude)>0.25)throw new Error('Wrong forecast scope');
        const units=p.daily_units;
        for(const [field,unit] of Object.entries({time:'iso8601',temperature_2m_min:'°C',temperature_2m_max:'°C',precipitation_sum:'mm',precipitation_probability_max:'%',wind_speed_10m_max:'km/h'}))if(units?.[field]!==unit)throw new Error('Unexpected units');
        const dates=p.daily?.time;
        if(!Array.isArray(dates)||dates.length!==7||dates.some((d,i)=>d!==addDate(today,i)))throw new Error('Wrong forecast dates');
        const i=dates.indexOf(date);const pick=(field:string)=>{const a=p.daily[field];if(!Array.isArray(a)||a.length!==dates.length||typeof a[i]!=='number')throw new Error('Missing daily value');return a[i];};
        const record=weatherAt(weatherRecord(city,date,'forecast',now,{lowC:pick('temperature_2m_min'),highC:pick('temperature_2m_max'),precipitationMm:pick('precipitation_sum'),precipitationProbability:pick('precipitation_probability_max'),maxWindKmh:pick('wind_speed_10m_max')}),city,date,now);
        if(cache.size>=32)cache.delete(cache.keys().next().value!);cache.set(key,{at:+now,record});return structuredClone(record);
      }catch{return weatherRecord(city,date,'unavailable',now);}
    })();
    pending.set(key,task);try{return await task;}finally{pending.delete(key);}
  };
}
export const getWeather=weatherService();
