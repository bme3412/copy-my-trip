import type { Briefing } from '../briefings/schema.js';
import { contentHash } from '../trips/schema.js';
import { weatherAt, type WeatherRecord } from './weather.js';
/** An unsent derivative only; never edits the accepted plan or a stored sent briefing. */
export function withWeather(b: Briefing, record: WeatherRecord, now = new Date()): Briefing {
  const weather=weatherAt(record,b.cityId,b.date,now);
  if(weather.timeZone!==b.timeZone)throw new Error('Weather timezone differs from the accepted destination');
  return { ...structuredClone(b), id:`briefing-${contentHash({baseBriefingId:b.id,plan:b.planId,date:b.date,weather:weather.id,template:2})}`, weather };
}
