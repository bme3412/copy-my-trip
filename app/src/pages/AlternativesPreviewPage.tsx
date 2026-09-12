import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Page } from '../components/Layout';
import { ProposalDiff } from '../components/ProposalDiff';
import { useCity } from '../state/CityContext';
import { useLocalTrips } from '../state/TripContext';
import { buildProposal } from '../lib/proposals/build';
import { closureFixture, type ClosureScenario } from '../lib/proposals/fixtures';
import type { ItineraryProposal } from '../lib/proposals/schema';
import { canEdit } from '../lib/trips/snapshot';
import { fmt } from '../lib/planner';

/** Development-only entry point. No source retrieval, model, cloud save or email. */
export function AlternativesPreviewPage() {
  const city = useCity(), store = useLocalTrips(), { snapshotId } = useParams(), navigate = useNavigate();
  const base = store.data.snapshots.find(s => s.id === snapshotId && s.cityId === city.id);
  const [dayIndex, setDay] = useState(0), [stopIndex, setStop] = useState(0);
  const [scenario, setScenario] = useState<ClosureScenario>('all-day');
  const [proposal, setProposal] = useState<ItineraryProposal>();
  const [selected, setSelected] = useState(''), [notice, setNotice] = useState(''), [busy, setBusy] = useState(false);
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const timer = window.setInterval(() => setNow(Date.now()), 1000); return () => window.clearInterval(timer); }, []);
  const clear = () => { setProposal(undefined); setSelected(''); setNotice(''); };
  const option = proposal?.options.find(o => o.id === selected);
  const latest = base && store.data.snapshots.filter(s => s.tripId === base.tripId).at(-1);
  const expired = !!proposal && now >= Date.parse(proposal.expiresAt);
  const unavailable = !base || !canEdit(base, city) || latest?.id !== base.id || store.blocked;
  const preview = () => {
    if (!base) return;
    try {
      const time = new Date();
      setProposal(buildProposal(city, base, dayIndex, closureFixture(city, base, dayIndex, stopIndex, scenario, time), time));
      setSelected(''); setNotice(''); setNow(+time);
    } catch (e) { setNotice(e instanceof Error ? e.message : 'Could not preview alternatives.'); }
  };
  const accept = async () => {
    if (!proposal || !option) return;
    setBusy(true); setNotice('');
    try {
      const snapshot = await store.acceptProposal(city, proposal, option.id);
      navigate(`/${city.id}/saved/${snapshot.id}`);
    } catch (e) { setNotice(e instanceof Error ? e.message : 'The alternative was not saved.'); }
    finally { setBusy(false); }
  };
  return <Page kicker="Local experiment" title="Review itinerary alternatives" sub="Compare a possible change with your accepted day. Your saved itinerary stays unchanged until you accept an alternative.">
    <p className="companion-notice"><strong>Simulation · no live closure information.</strong> These scenarios test the planning flow. Accepting creates a labeled demonstration version on this device; the original remains in history.</p>
    <Link to={`/${city.id}/saved/${snapshotId ?? ''}`}>← Back to saved itinerary</Link>
    {!base ? <p role="alert">Saved version not found. Choose an accepted trip first.</p> : <>
      <section className="companion-panel proposal-controls" aria-label="Closure scenario">
        <h2>What changes?</h2>
        <label>Saved day<select value={dayIndex} onChange={e => { setDay(Number(e.target.value)); setStop(0); clear(); }}>{base.days.map((d, i) => <option key={d.date} value={i}>Day {i + 1} · {d.date}</option>)}</select></label>
        <label>Affected stop<select value={stopIndex} onChange={e => { setStop(Number(e.target.value)); clear(); }}>{base.days[dayIndex].stops.map((s, i) => <option key={`${s.id}-${i}`} value={i}>{fmt(s.timeIn)} · {s.name}</option>)}</select></label>
        <label>Simulated scenario<select value={scenario} onChange={e => { setScenario(e.target.value as ClosureScenario); clear(); }}>
          <option value="all-day">Venue closed all day</option><option value="partial">Selected experience closed during the visit</option><option value="expired">Expired closure evidence</option><option value="no-options">No feasible replacements</option>
        </select></label>
        <p>Timed entries are not confirmed bookings. This preview cannot replace a timed stop or move a later timed entry. Estimated travel is not a guaranteed connection.</p>
        {unavailable && <p role="alert">This version is no longer editable, a newer version exists, or local data changed. Return to the latest saved itinerary or reload before continuing.</p>}
        <button className="btn btn-primary" disabled={unavailable || busy || !base.days[dayIndex].stops.length} onClick={preview}>Preview alternatives</button>
      </section>
      {proposal && <section className="companion-panel proposal-review" aria-label="Alternative review">
        <p className="companion-kicker">Simulated closure · Day {dayIndex + 1}</p><h2>Your options</h2>
        <p role="status">{proposal.reason}</p>
        <details><summary>Scenario evidence and scope</summary><p>Source: Local closure simulation · no live source. {proposal.conditions.length} record(s).</p>
          <p>Retrieved {new Date(proposal.conditions[0]?.retrievedAt).toLocaleString()}. Evidence expires {new Date(proposal.conditions[0]?.expiresAt).toLocaleString()}.</p>
          <p>{proposal.conditions[0]?.date} · {city.timeZone} · {fmt(proposal.conditions[0]?.from ?? 0)}–{fmt(proposal.conditions[0]?.until ?? 0)}. {scenario === 'partial' ? 'Only the selected experience, if the catalog distinguishes one.' : 'Whole-venue scope.'}</p>
        </details>
        {!!proposal.options.length && <fieldset className="proposal-options"><legend>Choose an alternative to inspect</legend>{proposal.options.map(o => <label key={o.id} className={o.id === selected ? 'is-selected' : ''}>
          <input type="radio" name="alternative" value={o.id} checked={selected === o.id} onChange={() => setSelected(o.id)} />
          <span><strong>{o.title}</strong><small>{o.extraTravel > 0 ? '+' : ''}{o.extraTravel} min estimated travel · other stops retained</small></span>
        </label>)}</fieldset>}
        {option && <><ProposalDiff before={base.days[dayIndex].state} after={option.day} />
          <p>Review valid until {new Date(proposal.expiresAt).toLocaleTimeString()}. Accept the exact proposal below; the other days stay as saved.</p>
          {expired && <p role="alert">This preview expired. Preview alternatives again before accepting.</p>}
          <button className="btn btn-primary" disabled={busy || unavailable || expired} onClick={accept}>{busy ? 'Saving…' : 'Accept this demonstration on this device'}</button></>}
        <div className="companion-actions"><button disabled={busy} onClick={() => { clear(); setNotice('Original itinerary kept. No new version was saved.'); }}>Keep original itinerary</button></div>
      </section>}
    </>}
    {notice && <p role="status" className="companion-notice">{notice}</p>}
  </Page>;
}
