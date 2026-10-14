import { useState, type CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import type { CultureCatalog } from '../../lib/culture/schema';
import { ArchivePhoto } from './ArchivePhoto';

const destinations=[
  {id:'paris',name:'Paris',country:'France',line:'Art, cafés and everyday life'},
  {id:'rome',name:'Rome',country:'Italy',line:'Ancient layers, modern life'},
  {id:'london',name:'London',country:'United Kingdom',line:'Tradition and reinvention'},
  {id:'barcelona',name:'Barcelona',country:'Spain',line:'Design, creativity and sun'},
  {id:'amsterdam',name:'Amsterdam',country:'Netherlands',line:'Canals, culture and open minds'},
  {id:'lisbon',name:'Lisbon',country:'Portugal',line:'Hills, music and the sea'},
  {id:'madrid',name:'Madrid',country:'Spain',line:'Art and late-night life'},
  {id:'florence',name:'Florence',country:'Italy',line:'Renaissance and beyond'},
  {id:'venice',name:'Venice',country:'Italy',line:'Beauty on the water'},
  {id:'vienna',name:'Vienna',country:'Austria',line:'Music, coffee and imperial history'},
  {id:'prague',name:'Prague',country:'Czechia',line:'Old streets and hidden corners'},
  {id:'berlin',name:'Berlin',country:'Germany',line:'History, creativity and change'},
  {id:'copenhagen',name:'Copenhagen',country:'Denmark',line:'Design and everyday life'},
  {id:'athens',name:'Athens',country:'Greece',line:'Ancient roots, modern energy'},
  {id:'edinburgh',name:'Edinburgh',country:'Scotland',line:'History, nature and inspiration'},
];
export function DestinationLanding({catalog}:{catalog:CultureCatalog}) {
  const [query,setQuery]=useState('');
  const live=new Set<string>(catalog.destinations.map(city=>city.id));
  const cities=destinations.filter(city=>`${city.name} ${city.country}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()));
  return <div className="ew-landing"><section className="ew-wide ew-hero ew-landing-hero"><ArchivePhoto photo="river" eager sizes="100vw"/><div className="ew-hero-copy"><p className="ew-eyebrow">ELSEWHERE</p><h1>Discover more. Plan better.<br/><em>Travel deeper.</em></h1><p className="ew-lede">Explore the world's cities through extraordinary places, local experiences, history, books, films, and culture. Save what inspires you and turn your discoveries into a trip that's uniquely yours.</p><form className="ew-hero-search" onSubmit={event=>{event.preventDefault();document.getElementById('destinations')?.scrollIntoView({block:'start'});}}><label className="ew-sr-only" htmlFor="destination-search">Search destinations by city or country</label><input id="destination-search" type="search" value={query} maxLength={120} onChange={event=>setQuery(event.target.value)} placeholder="Search cities or countries…"/><button className="ew-button" type="submit">Explore</button></form><div className="ew-landing-shortcuts"><a href="#destinations">Cities</a><Link to="/discover/browse?destination=paris&kind=book#collection">Books</Link><Link to="/discover/browse?destination=paris&kind=film#collection">Films</Link><Link to="/paris/archive">Places & photography</Link></div></div></section>
    <section id="destinations" className="ew-width ew-destination-directory"><div className="ew-section-title"><div><h2>Explore Europe</h2><p>15 cities on the horizon. Start with Paris and Rome.</p></div><span className="ew-directory-status">2 destinations open · 13 coming soon</span></div><p className="ew-sr-only" role="status">{cities.length} matching destinations</p><div className="ew-city-grid">{cities.map((city,index)=>{const available=live.has(city.id);const content=<><div className={`ew-city-art ew-city-art-${city.id}`} style={{'--city-hue':`${25+(index*31)%200}`} as CSSProperties}>{city.id==='paris'?<ArchivePhoto photo="hero" sizes="(max-width: 600px) 90vw, (max-width: 1000px) 45vw, 20vw"/>:<><span className="ew-city-art-country">{city.country}</span><strong>{city.name}</strong><span className="ew-city-art-note">{available?'A cultural introduction':'A future chapter'}</span></>}</div><div className="ew-city-copy"><div><h3>{city.name}</h3><span className={available?'ew-city-live':'ew-city-soon'}>{available?'Explore':'Coming soon'}</span></div><p className="ew-eyebrow">{city.country}</p><p>{city.line}</p></div></>;return available?<Link className="ew-city-card" key={city.id} to={`/discover/place/${city.id}`}>{content}</Link>:<article className="ew-city-card is-coming" key={city.id} aria-label={`${city.name} — coming soon`}>{content}</article>;})}</div>{!cities.length&&<div className="ew-empty"><h3>No destinations match that search.</h3><button className="ew-button" onClick={()=>setQuery('')}>Show all destinations</button></div>}
    </section></div>;
}
