import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Page } from '../components/Layout';
import { BriefingBody } from '../components/BriefingBody';
import { useCity } from '../state/CityContext';
import { useLocalTrips } from '../state/TripContext';
import { assembleBriefing, briefingHtml, briefingText } from '../lib/briefings/assemble';
import { withWeather } from '../lib/conditions/briefing-weather';
import { weatherRecord, type WeatherCity, type WeatherRecord } from '../lib/conditions/weather';
import type { Briefing } from '../lib/briefings/schema';
export function WeatherPreviewPage(){
 const city=useCity();const store=useLocalTrips();const snapshot=store.data.snapshots.filter(s=>s.cityId===city.id).at(-1);
 const [date,setDate]=useState(snapshot?.days[0]?.date||'');
 const [result,setResult]=useState<{planId:string;date:string;briefing:Briefing}>();const [busy,setBusy]=useState(false);const [mode,setMode]=useState('app');
 const shown=result?.planId===snapshot?.id && result?.date===date ? result.briefing : undefined;
 async function preview(kind:'forecast'|'unavailable'|'stale'|'live'){
  if(!snapshot)return;setBusy(true);
  const base=assembleBriefing(snapshot,date),now=new Date();
  let record:WeatherRecord;
  try{
   if(kind==='live'){
    const r=await fetch(`/api/weather-preview?city=${encodeURIComponent(city.id)}&date=${encodeURIComponent(date)}`,{signal:AbortSignal.timeout(6000)});
    if(!r.ok)throw new Error('Weather unavailable');record=await r.json();
   }else record=weatherRecord(city.id as WeatherCity,date,kind,kind==='stale'?new Date(+now-3*3600000):now,
    kind==='unavailable'?undefined:{lowC:15,highC:22,precipitationMm:4,precipitationProbability:70,maxWindKmh:18},true);
   const briefing=withWeather(base,record,now);setResult({planId:snapshot.id,date,briefing});
  }catch{setResult({planId:snapshot.id,date,briefing:withWeather(base,weatherRecord(city.id as WeatherCity,date,'unavailable',now),now)});}
  finally{setBusy(false);}
 }
 return <Page kicker="Development preview" title="Weather alongside your itinerary" sub="Forecasts are advisory. This preview does not save changes or send an email.">
  {!snapshot?<p><Link to={`/${city.id}/saved`}>Accept a demonstration trip first</Link>.</p>:<>
   <div className="companion-panel companion-controls"><label>Destination date<select value={date} onChange={e=>setDate(e.target.value)}>{snapshot.days.map(d=><option key={d.date}>{d.date}</option>)}</select></label></div>
   <div className="companion-actions"><button disabled={busy} onClick={()=>void preview('forecast')}>Simulate rain</button><button disabled={busy} onClick={()=>void preview('unavailable')}>Simulate outage</button><button disabled={busy} onClick={()=>void preview('stale')}>Simulate expired forecast</button><button disabled={busy} onClick={()=>void preview('live')}>Fetch evaluation forecast</button></div>
   <p role="status">{busy?'Checking forecast…':shown?'Preview ready. Accepted stops and times are unchanged.':'Choose a scenario to preview.'}</p>
   {shown && <><div className="companion-actions">{['app','email','text'].map(m=><button key={m} aria-pressed={mode===m} onClick={()=>setMode(m)}>{m==='app'?'In-app':m==='email'?'Email HTML':'Plain text'}</button>)}</div>
    {mode==='app'?<BriefingBody briefing={shown}/>:mode==='email'?<iframe className="email-preview" sandbox="allow-top-navigation-by-user-activation" title="Weather email preview — not sent" srcDoc={briefingHtml(shown,location.origin)}/>:<pre className="briefing-text">{briefingText(shown)}</pre>}</>}
  </>}
 </Page>;
}
