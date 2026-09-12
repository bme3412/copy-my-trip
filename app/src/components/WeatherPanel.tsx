import { weatherAt, weatherLines, WEATHER_SOURCE, type WeatherRecord } from '../lib/conditions/weather';
export function WeatherPanel({record}:{record:WeatherRecord}) {
  const w=weatherAt(record,record.cityId,record.date);
  const lines=weatherLines(w);
  return <aside className="companion-panel" aria-label="Weather advisory">
    <p className="companion-kicker">{lines[0]}</p><h3>{lines[1]}</h3><p>{lines[2]}</p>
    <p className="evidence-label">{lines[3]}</p><p>{lines[4]}</p>
    <p className="evidence-label">{lines[5]} {!w.synthetic && <a href={WEATHER_SOURCE} target="_blank" rel="noopener noreferrer">Open-Meteo</a>}</p>
  </aside>;
}
