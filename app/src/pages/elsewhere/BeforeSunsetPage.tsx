import { FilmTrailer } from './FilmTrailer';
import { Link, useSearchParams } from 'react-router-dom';
import type { CultureWork, CultureCatalog } from '../../lib/culture/schema';
import { ArchivePhoto } from './ArchivePhoto';
import { SaveWork } from './ShelfContext';
import { ParisPlaceMap } from './ParisPlaceMap';
import { beforeSunsetPlaces, entitiesFor, entityHref, placeFor } from '../../lib/culture/paris-discovery';
import { ParisConnections } from './ParisConnections';
import { PersonalActions, PersonalNotice } from './ParisDiscoveryPages';
import '../../styles/elsewhere-film.css';
const filmSource='https://www.criterion.com/films/28693-before-sunset';
const essay='https://www.criterion.com/current/posts/4445-the-before-trilogy-time-regained';
const pins=beforeSunsetPlaces.flatMap(({entity})=>{const place=placeFor(entity);return place?[place]:[];});
const connections=beforeSunsetPlaces.map(({entity,connection})=>({id:entity.placeId??'seine',name:entity.title,type:'Paris · Place',copy:connection.explanation,href:entityHref(entity)}));
export function BeforeSunsetPage({work,catalog}:{work:CultureWork;catalog:CultureCatalog}) {
  const [params,setParams]=useSearchParams();
  const selected=connections.find(p=>p.id===params.get('place'))??connections[0];
  const select=(id:string)=>{const next=new URLSearchParams(params);next.set('place',id);setParams(next,{replace:true,preventScrollReset:true});};
  return <div className="ew-film">
    <section className="ew-film-hero"><ArchivePhoto eager sizes="100vw"/><div className="ew-film-intro">
      <Link className="ew-film-breadcrumb" to="/discover/browse?destination=paris&kind=film">Discover / Films / Before Sunset</Link>
      <p className="ew-eyebrow">Film · {work.year}</p><h1>{work.title}</h1><p className="ew-film-deck">One afternoon. A conversation unfinished.</p>
      <p>Jesse and Céline meet again in Paris. With a flight to catch and years to account for, a walk becomes a chance to discover who they have become.</p>
      <div className="ew-film-actions"><a className="ew-button" href="#film-trailer">Watch trailer ↓</a><a className="ew-button" href="#film-places">Explore the places ↓</a><SaveWork id={work.id} title={work.title}/></div>
      <div className="ew-film-tags"><span>Paris</span><span>Film</span><span>Conversation</span><span>Time & memory</span></div>
    </div><span className="ew-film-photo-note">Original Paris photograph · not a film still</span></section>
    <nav className="ew-film-nav" aria-label="Film sections"><a href="#film-overview">Overview</a><a href="#film-trailer">Trailer</a><a href="#film-places">Places · 3</a><a href="#film-map">Map</a><a href="#film-context">The trilogy</a><a href="#film-sources">Sources</a></nav>
    <div className="ew-width pd"><PersonalNotice/><PersonalActions showSave={false} entity={entitiesFor(catalog).find(e=>e.workId===work.id)!} catalog={catalog}/><ParisConnections root="work:before-sunset" catalog={catalog}/></div><div className="ew-film-body"><div className="ew-film-main">
      <section id="film-overview" className="ew-film-panel"><h2>At a glance</h2><dl className="ew-film-facts">{[['Director',work.creator],['Starring','Ethan Hawke · Julie Delpy'],['Film year',String(work.year)],['Runtime','80 minutes'],['Setting','Paris, France'],['Language','English']].map(([label,value])=><div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl><a className="ew-link" href={filmSource} target="_blank" rel="noreferrer">Film details at Criterion</a></section>
      <section id="film-places" className="ew-film-panel"><p className="ew-eyebrow">The city on screen</p><h2>Places in the story</h2><p>Three connections described in Criterion’s film essay.</p><div className="ew-film-places">{connections.map((place,i)=><button key={place.id} aria-pressed={selected.id===place.id} onClick={()=>select(place.id)}><span className="ew-film-number">{i+1}</span><span><strong>{place.name}</strong><small>{place.type}</small><span>{place.copy}</span></span><span aria-hidden="true">→</span></button>)}</div><div className="ew-film-place-detail" aria-live="polite"><p className="ew-eyebrow">Explore the archive</p><h3>{selected.name}</h3><p>{selected.id==='seine'?'The source identifies the river, not a precise stop or boarding point.':'The map uses the existing place catalog’s reference point, not an exact camera position.'}</p><Link className="ew-link" to={selected.href}>Explore {selected.name}</Link></div><p className="ew-small">Historical film connections, not a scene-by-scene itinerary. Numbers identify places; they do not establish scene order or walking directions.</p></section>
      <section id="film-map" className="ew-film-panel"><h2>Find the places</h2><p>Two catalog locations. The Seine connection covers a wider area.</p><ParisPlaceMap places={pins} selected={selected.id} onSelect={select}/><p className="ew-small">1 · Shakespeare and Company &nbsp; 2 · Promenade Plantée. No route is implied.</p><Link className="ew-link" to="/paris/archive">Open the Paris archive</Link></section>
    </div><aside className="ew-film-side">
      <FilmTrailer work={work}/><section className="ew-film-preview"><ArchivePhoto photo="river"/><div><p className="ew-eyebrow">Watch & read</p><h2>A moment from the film</h2><p>Criterion hosts a scene preview alongside its film notes.</p><a className="ew-button" href={filmSource} target="_blank" rel="noreferrer">View scene at Criterion</a></div></section>
      <section id="film-context" className="ew-film-panel"><h2>Where it fits</h2><p>The middle chapter of Richard Linklater’s Before trilogy, following the same two people across the years.</p><ol className="ew-film-trilogy"><li><span>1995</span><strong>Before Sunrise</strong></li><li aria-current="true"><span>2004</span><strong>Before Sunset</strong></li><li><span>2013</span><strong>Before Midnight</strong></li></ol><a className="ew-link" href={essay} target="_blank" rel="noreferrer">Read about the trilogy</a></section>
      <section className="ew-film-panel"><p className="ew-eyebrow">Viewing prompts</p><h2>Things to notice</h2><h3>Time between meetings</h3><p>What do the characters choose to tell each other first?</p><h3>A city in conversation</h3><p>Notice how walking changes the rhythm of an exchange.</p><h3>The unsaid</h3><p>Watch the pauses as closely as the words.</p></section>
      <section className="ew-film-panel ew-film-paris"><h2>Keep exploring Paris</h2><p>Find more stories and original travel photographs.</p><Link className="ew-button" to="/discover/place/paris">Discover Paris</Link></section>
    </aside><section id="film-sources" className="ew-film-sources"><h2>Follow the sources</h2><p><a href={filmSource} target="_blank" rel="noreferrer">Criterion · film, cast and runtime</a></p><p><a href={essay} target="_blank" rel="noreferrer">Dennis Lim · The Before Trilogy: Time Regained</a></p><p className="ew-small">Checked October 12, 2026. Paris photographs come from the original archive. The trailer and its thumbnail are supplied by Warner Bros. Rewind on YouTube.</p></section></div>
  </div>;
}
