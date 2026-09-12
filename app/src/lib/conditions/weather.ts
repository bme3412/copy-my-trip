import { contentHash, isDate } from '../trips/schema.js';
export const WEATHER_SOURCE = 'https://open-meteo.com/';
export const WEATHER_SCOPES = {
  paris: { name: 'Paris city centre', latitude: 48.86, longitude: 2.35, timeZone: 'Europe/Paris' },
  rome: { name: 'Rome city centre', latitude: 41.90, longitude: 12.50, timeZone: 'Europe/Rome' },
} as const;
export type WeatherCity = keyof typeof WEATHER_SCOPES;
export type WeatherState = 'forecast' | 'stale' | 'unavailable' | 'out-of-horizon' | 'disabled';
export interface WeatherRecord {
  schemaVersion: 1; adapter: 'open-meteo-daily-1'; id: string; cityId: WeatherCity; date: string;
  timeZone: string; scope: string; fetchedAt: string; issuedAt: null; expiresAt: string;
  source: typeof WEATHER_SOURCE; synthetic: boolean; state: WeatherState;
  daily?: { lowC: number; highC: number; precipitationMm: number; precipitationProbability: number; maxWindKmh: number };
}
export function weatherRecord(cityId: WeatherCity, date: string, state: WeatherState, now: Date, daily?: WeatherRecord['daily'], synthetic = false): WeatherRecord {
  if (!isDate(date) || !Number.isFinite(+now)) throw new Error('Invalid weather date');
  const scope=WEATHER_SCOPES[cityId];
  const record = { schemaVersion: 1 as const, adapter: 'open-meteo-daily-1' as const, cityId,date,timeZone:scope.timeZone,scope:scope.name,
    fetchedAt:now.toISOString(),issuedAt:null,expiresAt:new Date(+now+2*3600000).toISOString(),source:WEATHER_SOURCE as typeof WEATHER_SOURCE,synthetic,state,...(daily?{daily}:{}) };
  return { ...record, id:`weather-${contentHash(record)}` };
}
/** Validate again at the presentation boundary; a saved forecast is never silently refreshed. */
export function weatherAt(record: WeatherRecord, cityId: string, date: string, now = new Date()): WeatherRecord {
  const scope=WEATHER_SCOPES[record.cityId];
  if(!scope || !/^weather-[a-f0-9]{16}$/.test(record.id) || record.schemaVersion!==1 || record.adapter!=='open-meteo-daily-1' || record.cityId!==cityId || record.date!==date || !isDate(date)
    || record.timeZone!==scope.timeZone || record.scope!==scope.name || record.source!==WEATHER_SOURCE || record.issuedAt!==null
    || typeof record.synthetic!=='boolean' || !['forecast','stale','unavailable','out-of-horizon','disabled'].includes(record.state)) throw new Error('Weather scope mismatch');
  const fetched=Date.parse(record.fetchedAt), expires=Date.parse(record.expiresAt);
  if(!Number.isFinite(fetched) || !Number.isFinite(expires) || fetched>+now+60000 || expires<=fetched || expires-fetched>2*3600000) throw new Error('Invalid weather freshness');
  if(record.state==='forecast' || record.state==='stale') {
    const d=record.daily;
    if(!d || ![d.lowC,d.highC,d.precipitationMm,d.precipitationProbability,d.maxWindKmh].every(Number.isFinite)
      || d.lowC< -90 || d.highC>65 || d.lowC>d.highC || d.precipitationMm<0 || d.precipitationMm>2000
      || d.precipitationProbability<0 || d.precipitationProbability>100 || d.maxWindKmh<0 || d.maxWindKmh>500) throw new Error('Invalid weather values');
  }
  return structuredClone({ ...record, state: record.state==='forecast' && expires<=+now ? 'stale' : record.state });
}
export function weatherLines(w: WeatherRecord): string[] {
  const lead=w.synthetic?'SIMULATED WEATHER — preview only':'Weather advisory';
  const status=w.state==='forecast' && w.daily
    ? `${w.daily.lowC}–${w.daily.highC} °C · precipitation ${w.daily.precipitationMm} mm · maximum hourly precipitation chance ${w.daily.precipitationProbability}% · maximum wind ${w.daily.maxWindKmh} km/h`
    : w.state==='stale'?'This saved forecast has expired; do not treat it as current weather.'
    : w.state==='out-of-horizon'?'Forecast unavailable for this date. This preview supports today and the next six destination dates.'
    : w.state==='disabled'?'Weather is not enabled. Your accepted itinerary remains available.'
    :'Weather is unavailable. Your accepted itinerary remains available.';
  return [lead,`${w.scope} · ${w.date} · ${w.timeZone}`,status,
    w.state==='forecast' || w.state==='stale' ? `Retrieved ${w.fetchedAt} · expires ${w.expiresAt}. Provider issue time is not supplied.` : `Checked ${w.fetchedAt}. No usable forecast was retrieved.`,
    'City-centre daily summary; not a forecast for each stop or day-trip destination. Activities have not been changed. This is not an operational or severe-weather alert service.',
    w.synthetic?'Synthetic test values; no provider forecast was used.':'Weather data by Open-Meteo (CC BY 4.0); daily fields selected and reformatted.'];
}
