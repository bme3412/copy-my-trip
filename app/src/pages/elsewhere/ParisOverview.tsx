import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { formatLabel, type CultureCatalog, type CultureWork } from '../../lib/culture/schema';
import { entityHref, PARIS_ROOT, trailHref, type DiscoveryEntity } from '../../lib/culture/paris-discovery';
import { overviewSelection, parisBrowse, parisFormats } from '../../lib/culture/paris-overview';
import { ArchivePhoto } from './ArchivePhoto';
import { WorkCover } from './WorkPresentation';
import { SaveWork } from './ShelfContext';
import { Evidence } from './ParisConnections';
import { PersonalActions, PersonalNotice } from './ParisDiscoveryPages';
import { LicensedPhoto, entityPhoto } from './LicensedPhoto';
import { ParisPlaceMap } from './ParisPlaceMap';

export function CompactWorkCard({work,recent=false}:{work:CultureWork;recent?:boolean}) {
  return <article className={`po-work po-kind-${work.kind}${recent?' po-recent-work':''}`}>
    <Link className="po-work-art" to={`/discover/work/${work.id}`} aria-label={`Explore ${work.title}`}><WorkCover work={work}/></Link>
    <div className="po-work-copy"><p className="po-label">{formatLabel(work.kind)}</p><h3><Link to={`/discover/work/${work.id}`}>{work.title}</Link></h3><p className="po-creator">{work.podcast?.show??work.creator}</p><p className="po-summary">{work.description}</p><SaveWork id={work.id} title={work.title}/></div>
  </article>;
}
function CompactEntity({entity,catalog}:{entity:DiscoveryEntity;catalog:CultureCatalog}) {
  const photo=entityPhoto(entity.id);
  return <article className="po-entity">{photo?<LicensedPhoto photo={photo} sizes="(max-width:600px) 45vw, 180px"/>:entity.photo?<ArchivePhoto photo={entity.photo} sizes="(max-width:600px) 45vw, 180px"/>:<div className="po-entity-type" aria-hidden="true">{entity.kind==='person'?'Aa':'↗'}</div>}<div><p className="po-label">{entity.kind}</p><h3><Link to={entityHref(entity)}>{entity.title}</Link></h3><p>{entity.summary}</p><PersonalActions entity={entity} catalog={catalog} showActivity={false}/></div></article>;
}
export function ParisOverview({catalog}:{catalog:CultureCatalog}) {
  const selection=useMemo(()=>overviewSelection(catalog),[catalog]);
  const {featured,recent,playlist,tracks,connections,places,entities}=selection;
  const [selected,setSelected]=useState(places[0].id);
  const selectedPlace=entities.find(e=>e.placeId===selected)!;
  return <div className="po-overview">
    <section className="po-hero" aria-labelledby="paris-title"><ArchivePhoto photo="sunset" eager sizes="(min-width:1100px) calc(100vw - 232px), 100vw"/><div className="po-hero-copy"><h1 id="paris-title">Paris</h1><p className="po-hero-subtitle">A city of stories.</p><p>Books, films, music, podcasts and places.<br/>Explore the connections that bring Paris to life.</p></div></section>
    <nav className="po-shortcuts" aria-label="Paris formats"><Link to={parisBrowse()}>All works</Link>{parisFormats.map(([label,kind])=><Link to={parisBrowse(kind)} key={kind}>{label}</Link>)}</nav>
    <PersonalNotice/>
    <section id="paris-search" aria-labelledby="paris-feature-heading"><div className="po-section-heading"><h2 id="paris-feature-heading">Editor’s picks</h2><Link to={parisBrowse()}>See all works ↗</Link></div><div className="po-work-grid">{featured.map(work=><CompactWorkCard key={work.id} work={work}/>)}</div></section>
    <div className="po-middle">
      <section className="po-panel po-playlist" aria-labelledby="po-playlist-title"><h2 id="po-playlist-title">Featured playlist</h2><div className="po-playlist-intro"><ArchivePhoto photo="river" sizes="(max-width:1099px) 30vw, 150px"/><div><p className="po-label">Elsewhere · {tracks.length} tracks</p><h3><Link to={`/discover/work/${playlist.id}`}>{playlist.title}</Link></h3><p>{playlist.description}</p></div></div><ol className="po-tracks">{tracks.slice(0,4).map(track=><li key={track.id}><Link to={`/discover/work/${track.id}`}>{track.title}</Link><span>{track.creator}</span></li>)}</ol><div className="po-actions"><Link to={`/discover/work/${playlist.id}`}>Explore all {tracks.length} tracks →</Link><SaveWork id={playlist.id} title="Paris playlist"/></div></section>
      <section className="po-panel po-connections" aria-labelledby="po-connections-title"><h2 id="po-connections-title">Follow a connection</h2><ul>{connections.map(connection=>{const from=entities.find(e=>e.id===connection.from)!,to=entities.find(e=>e.id===connection.to)!;return <li key={connection.id}><p className="po-label">{connection.label}</p><h3><Link to={entityHref(from)}>{from.title}</Link><span aria-hidden="true"> → </span><Link to={entityHref(to)}>{to.title}</Link></h3><p>{connection.explanation}</p><Evidence ids={connection.sourceIds} catalog={catalog}/><Link className="po-follow" to={trailHref([from.id,to.id])}>Follow this connection →</Link></li>;})}</ul></section>
      <section className="po-panel po-map" aria-labelledby="po-map-title"><h2 id="po-map-title">Places in Paris</h2><ParisPlaceMap places={places} selected={selected} onSelect={setSelected}/><div className="po-map-choice" aria-live="polite"><h3><Link to={entityHref(selectedPlace)}>{selectedPlace.title} ↗</Link></h3><p>Catalog reference point</p></div><div className="po-map-options" aria-label="Select a mapped place">{places.map((place,index)=><button key={place.id} type="button" aria-pressed={selected===place.id} onClick={()=>setSelected(place.id)}>{index+1}. {place.name}</button>)}</div><Link to="/paris/archive?view=map">Open the full archive map ↗</Link></section>
    </div>
    <section aria-labelledby="more-discover-title"><div className="po-section-heading"><h2 id="more-discover-title">Recently added</h2><Link to={parisBrowse()}>View all ↗</Link></div><div className="po-work-grid">{recent.map(work=><CompactWorkCard key={work.id} work={work} recent/>)}</div></section>
    <div className="po-lower-grid"><section id="paris-places" aria-labelledby="po-places-title"><div className="po-section-heading"><h2 id="po-places-title">Places</h2><Link to="/paris/archive">Archive ↗</Link></div>{entities.filter(e=>e.kind==='place').map(entity=><CompactEntity key={entity.id} entity={entity} catalog={catalog}/>)}</section><section aria-labelledby="paris-writer-heading"><div className="po-section-heading"><h2 id="paris-writer-heading">People</h2></div>{entities.filter(e=>e.kind==='person').map(entity=><CompactEntity key={entity.id} entity={entity} catalog={catalog}/>)}</section></div>
    <section aria-labelledby="paris-guide-heading"><div className="po-section-heading"><h2 id="paris-guide-heading">Collections</h2><Link to={`${PARIS_ROOT}/collections`}>View all ↗</Link></div><div className="po-collections">{entities.filter(e=>e.kind==='collection').map(entity=><article key={entity.id}><p className="po-label">Free editorial guide · {entity.members?.length} starting points</p><h3><Link to={entityHref(entity)}>{entity.title}</Link></h3><p>{entity.summary}</p><PersonalActions entity={entity} catalog={catalog} showActivity={false}/></article>)}</div></section>
    <section aria-labelledby="paris-archive-heading"><div className="po-section-heading"><h2 id="paris-archive-heading">Original photography</h2><Link to="/paris/archive">All photographs ↗</Link></div><div className="po-photographs">{(['notredame','garden','cafe'] as const).map(photo=><ArchivePhoto key={photo} photo={photo} sizes="(max-width:600px) 90vw, (min-width:1100px) calc((100vw - 280px)/3), 30vw"/>)}</div></section>
    <nav className="po-bottom-nav" aria-label="Continue discovering Paris"><Link to={`${PARIS_ROOT}/stories`}>Story archive →</Link><Link to={`${PARIS_ROOT}/trails`}>Discovery trails →</Link><Link to={`${PARIS_ROOT}/atlas`}>My Paris atlas →</Link><span>Saved on this device</span></nav>
  </div>;
}
