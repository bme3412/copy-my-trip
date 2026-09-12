import { useMemo, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { Page } from '../components/Layout';
import { BriefingBody } from '../components/BriefingBody';
import { downloadFile } from '../components/LocalSaveStatus';
import { assembleBriefing, briefingHtml, briefingText } from '../lib/briefings/assemble';
import { addDate, dateInZone, isDate } from '../lib/trips/schema';
import { useCity } from '../state/CityContext';
import { useLocalTrips } from '../state/TripContext';
export function BriefingPage({ today = false }: {
    today?: boolean;
}) {
    const city = useCity();
    const { snapshotId } = useParams();
    const [params, setParams] = useSearchParams();
    const store = useLocalTrips();
    const versions = store.data.snapshots.filter(s => s.cityId === city.id);
    const snapshot = snapshotId ? versions.find(s => s.id === snapshotId) : versions.at(-1);
    const [mode, setMode] = useState<'app' | 'email' | 'text'>('app');
    const now = dateInZone(new Date(), snapshot?.timeZone ?? city.timeZone);
    const date = params.get('date') ?? (today ? now : addDate(now, 1));
    const briefing = useMemo(() => snapshot && isDate(date) ? assembleBriefing(snapshot, date) : undefined, [snapshot, date]);
    const origin = typeof window === 'undefined' ? '' : window.location.origin;
    const html = briefing ? briefingHtml(briefing, origin) : '';
    return <Page kicker="Local companion" title={date === now ? 'Today' : date === addDate(now, 1) ? 'Tomorrow’s briefing' : `Briefing for ${date}`} sub="A preview of your accepted itinerary. Select a date to explore; your trip dates stay unchanged. No email is sent.">
    <div className="companion-actions"><Link to={`/${city.id}/saved${snapshot ? '/' + snapshot.id : ''}`}>Saved trip</Link><Link to={`/${city.id}/today`}>Today</Link></div>
    {!snapshot ? <p className="companion-notice">{snapshotId ? 'This accepted version is not on this device.' : 'Accept an itinerary first to see Today and tomorrow’s briefing.'} <Link to={`/${city.id}/saved`}>Open saved trips</Link></p> : <>
      <div className="companion-panel companion-controls"><label>Preview date<input type="date" value={date} onChange={e => setParams({ date: e.target.value })}/></label><span>{snapshot.timeZone} · {date === now ? 'Today' : date === addDate(now, 1) ? 'Tomorrow' : 'Selected date'}</span>
        <button onClick={() => setParams({ date: snapshot.days[0].date })}>First trip day</button>
      </div>
      {snapshot.id !== versions.at(-1)?.id && <p className="companion-notice">A newer accepted version exists. This link preserves the older briefing. <Link to={`/${city.id}/saved/${versions.at(-1)!.id}/briefing?date=${date}`}>Open latest version</Link></p>}
      {!briefing ? <p role="alert">Choose a valid date.</p> : <>
        <div className="companion-actions" aria-label="Preview format">{(['app', 'email', 'text'] as const).map(m => <button key={m} aria-pressed={mode === m} onClick={() => setMode(m)}>{m === 'app' ? 'In-app preview' : m === 'email' ? 'Email HTML preview' : 'Plain text'}</button>)}<button onClick={() => downloadFile(`${briefing.id}.html`, html, 'text/html')}>Download HTML</button><button onClick={() => downloadFile(`${briefing.id}.txt`, briefingText(briefing), 'text/plain')}>Download text / offline essentials</button></div>
        {mode === 'app' ? <BriefingBody briefing={briefing}/> : mode === 'email' ? <iframe className="email-preview" sandbox="allow-top-navigation-by-user-activation" title="Email preview — no email sent" srcDoc={html}/> : <pre className="briefing-text">{briefingText(briefing)}</pre>}
      </>}
    </>}
  </Page>;
}
