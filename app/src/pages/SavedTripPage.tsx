import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Page } from '../components/Layout';
import { downloadFile } from '../components/LocalSaveStatus';
import { useCity } from '../state/CityContext';
import { useLocalTrips, useTrip } from '../state/TripContext';
import { addDate, dateInZone, PLANNER_VERSION } from '../lib/trips/schema';
import { canEdit, catalogVersion, draftHash } from '../lib/trips/snapshot';
import { generatePlan, PLAN_PRESETS } from '../lib/plan-presets';
import { stayLoc } from '../lib/planner';
import { CloudSavePanel } from '../components/CloudSavePanel';
export function SavedTripPage() {
    const city = useCity();
    const { snapshotId } = useParams();
    const navigate = useNavigate();
    const { trip, update, accept, editAccepted } = useTrip();
    const store = useLocalTrips();
    const [error, setError] = useState('');
    const [deleting, setDeleting] = useState(false);
    const versions = store.data.snapshots.filter(s => s.cityId === city.id);
    const snapshot = snapshotId ? versions.find(s => s.id === snapshotId) : versions.at(-1);
    const changed = !snapshot || snapshot.inputsHash !== draftHash(trip);
    const sample = () => {
        const arriving = addDate(dateInZone(new Date(), city.timeZone), 1);
        const plan = generatePlan(city, PLAN_PRESETS[0], 4, 'balanced', stayLoc(city, city.hoodOrder[0]), arriving, [], 0);
        update({ arriving, departing: addDate(arriving, 4), pace: 'balanced', stayHood: city.hoodOrder[0], interests: [], brief: '', extracted: undefined, planSeed: 0,
            scheduledFor: { arriving, departing: addDate(arriving, 4), stayHood: city.hoodOrder[0] }, planId: plan.preset.id, originPresetId: plan.preset.id, edited: false, demo: true, unplaced: plan.unplaced, days: plan.days, dayPaces: plan.paces, dayPurposes: plan.purposes, dayContexts: plan.contexts, dayNarrations: {}, release: { planner: PLANNER_VERSION, catalog: catalogVersion(city) } });
        navigate(`/${city.id}/itinerary/1`);
    };
    const save = () => { try {
        const s = accept();
        navigate(`/${city.id}/saved/${s.id}`);
        setError('');
    }
    catch (e) {
        setError(e instanceof Error ? e.message : 'Could not accept this trip.');
    } };
    return <Page kicker="On this device" title="Your saved trip" sub="Accept the itinerary you reviewed. Its schedule stays exactly as saved; edits become a new version only when you accept them.">
    {error && <p role="alert" className="companion-notice">{error}</p>}
    <div className="companion-actions"><button className="btn btn-primary" onClick={save} disabled={!changed}>Accept & save current itinerary</button><Link className="btn btn-secondary" to={`/${city.id}/itinerary/1`}>Review working draft</Link></div>
    {!snapshot && <div className="companion-panel"><h2>{snapshotId ? 'Saved version not found' : 'No accepted itinerary yet'}</h2><p>{snapshotId ? 'This version may have been removed from this device. Choose a remaining version below.' : 'Compose a trip or explore a labeled sample, review it, then accept it.'}</p><button onClick={sample}>Create a {city.name} demonstration draft</button><p>Starts tomorrow for four days. Creating it replaces the working draft; accepted versions remain available.</p><Link to={`/${city.id === 'paris' ? 'rome' : 'paris'}/saved`}>Try {city.id === 'paris' ? 'researched-only Rome' : 'the Paris archive'}</Link></div>}
    {snapshot && <section className="companion-panel">
      <p className="companion-kicker">{snapshot.demo ? 'Demonstration trip · ' : ''}{snapshot.cityName} · {snapshot.days[0].date} to {snapshot.draft.departing} (checkout)</p>
      <h2>Accepted {new Date(snapshot.acceptedAt).toLocaleString()}</h2>
      {changed && <p className="companion-notice">The working draft differs from this version. Preview continues to use this accepted schedule until you accept a new version.</p>}
      {!canEdit(snapshot, city) && <p className="companion-notice">This engine or catalog version is no longer supported for editing. Its saved schedule and briefing remain readable. Compose a new trip to use the current catalog.</p>}
      <div className="companion-actions"><Link className="btn btn-primary" to={`/${city.id}/saved/${snapshot.id}/briefing`}>Preview tomorrow</Link><Link to={`/${city.id}/today`}>Today</Link><button disabled={!canEdit(snapshot, city)} onClick={() => { editAccepted(snapshot); navigate(`/${city.id}/itinerary/1`); }}>Edit a copy of this version</button><button onClick={() => downloadFile(`${snapshot.id}.json`, JSON.stringify(snapshot, null, 2))}>Export accepted version</button></div>
      <ol className="saved-days">{snapshot.days.map((d, i) => <li key={d.date}><Link to={`/${city.id}/saved/${snapshot.id}/briefing?date=${d.date}`}><strong>Day {i + 1} · {d.date}</strong><span>{d.title} · {d.stops.length} stops</span></Link></li>)}</ol>
      <p className="version-ref">Version {snapshot.id}<br />Engine {snapshot.release.planner} · catalog {snapshot.release.catalog}</p>
      {import.meta.env.DEV && city.id === 'paris' && <p><Link to={`/${city.id}/saved/${snapshot.id}/alternatives`}>Preview closure alternatives · local simulation</Link></p>}
      <button onClick={() => setDeleting(true)}>Remove this saved version…</button>{deleting && <div role="alert"><p>Remove this version from this device? Export it first if you want to keep it.</p><button onClick={() => { store.remove(snapshot.id); setDeleting(false); navigate(`/${city.id}/saved`); }}>Confirm removal</button> <button onClick={() => setDeleting(false)}>Cancel</button></div>}
    </section>}
    {versions.length > 0 && <details className="companion-panel"><summary>Accepted version history ({versions.length})</summary><ul>{[...versions].reverse().map(s => <li key={s.id}><Link to={`/${city.id}/saved/${s.id}`}>{s.days[0].date} · accepted {new Date(s.acceptedAt).toLocaleString()} · {s.id.slice(-8)}</Link></li>)}</ul></details>}
    <CloudSavePanel snapshot={snapshot} />
  </Page>;
}
