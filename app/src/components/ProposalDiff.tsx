import { fmt, type CommittedStop, type DayState } from '../lib/planner';
import { diffDay, totalTravel } from '../lib/proposals/diff';

function StopFacts({ stop }: { stop: CommittedStop }) {
  return <><strong>{stop.name}</strong><span>{fmt(stop.timeIn)}–{fmt(stop.timeIn + stop.dur)} · {stop.dur} min visit</span>
    <span>{stop.travelMin} min {stop.travelMode === 'metro' ? 'métro' : 'walk'} to this stop · estimated</span>
    <span>{stop.timing?.linger ?? 0} min free time afterward</span>
    {stop.returnAfter && <span>Return: {stop.returnAfter.min} min {stop.returnAfter.mode} to {stop.returnAfter.to.area}</span>}</>;
}
export function ProposalDiff({ before, after }: { before: DayState; after: DayState }) {
  return <div className="proposal-diff">
    <p>Total estimated travel: <strong>{totalTravel(before)} → {totalTravel(after)} min</strong>. Day ends: <strong>{fmt(before.clock)} → {fmt(after.clock)}</strong>.</p>
    <p>Arrival gaps include saved waits and travel. Any final free time is preserved.</p>
    <div className="proposal-diff-head"><span>Saved itinerary</span><span>Proposed itinerary</span></div>
    <ol>{diffDay(before, after).map((row, i) => <li key={i} className={`proposal-row proposal-${row.kind}`}>
      <span className="proposal-change">{row.kind}</span>
      <div className="proposal-facts">{row.before ? <StopFacts stop={row.before} /> : <span>Not in the saved day</span>}</div>
      <div className="proposal-facts">{row.after ? <StopFacts stop={row.after} /> : <span>Removed from this day</span>}</div>
    </li>)}</ol>
  </div>;
}
