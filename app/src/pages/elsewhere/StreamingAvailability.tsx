import availability from '../../lib/culture/tv-availability.json';
export function StreamingAvailability({id}:{id:string}) {
 const entry=(availability as Record<string,{territory:string;reportedAt:string;providers:string;access:string;source:string}>)[id];
 if(!entry)return null;
 return <section className="po-streaming-availability"><h3>Where to watch</h3><p>{entry.providers}</p><p>{entry.access}</p><small>U.S. listings supplied October 13, 2026. Availability varies by season and region; additional fees or library access may apply.</small><a href={entry.source} target="_blank" rel="noreferrer">Check current availability<span className="ew-sr-only"> (opens in a new tab)</span></a></section>;
}
