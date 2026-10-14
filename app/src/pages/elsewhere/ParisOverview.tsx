import { MusicPlay } from './MusicPlayer';
import { MediaPreview } from './MediaPreview';
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { formatLabel, type CultureCatalog, type CultureWork } from '../../lib/culture/schema';
import { entityHref, PARIS_ROOT, trailHref, type DiscoveryEntity } from '../../lib/culture/paris-discovery';
import { overviewSelection, parisBrowse, parisFormats, parisCounts } from '../../lib/culture/paris-overview';
import { ArchivePhoto } from './ArchivePhoto';
import { WorkCover } from './WorkPresentation';
import { SaveWork } from './ShelfContext';
import { Evidence } from './ParisConnections';
import { PersonalActions, PersonalNotice } from './ParisDiscoveryPages';
import { LicensedPhoto, entityPhoto } from './LicensedPhoto';
import { ParisPlaceMap } from './ParisPlaceMap';

export function CompactWorkCard({work,recent=false,onPreview}:{work:CultureWork;recent?:boolean;onPreview?:(work:CultureWork)=>void}) {
  const preview=onPreview;
  return <article className={`po-work po-kind-${work.kind}${recent?' po-recent-work':''}`}>
    <p className="po-card-kicker"><span>{work.kind==='song'?'Listen':work.kind==='film'||work.kind==='tv_show'?'Watch':work.kind==='podcast_episode'?'Podcast':'Read'} / {formatLabel(work.kind)}</span><span>{work.year}</span></p>
    {preview ? <button className="po-work-art po-preview-trigger" type="button" onClick={()=>onPreview(work)} aria-label={`Preview ${work.title}`} aria-haspopup="dialog"><WorkCover work={work}/></button> : <Link className="po-work-art" to={`/discover/work/${work.id}`} aria-label={`Explore ${work.title}`}><WorkCover work={work}/></Link>}
    <div className="po-work-copy"><h3>{preview ? <button className="po-preview-title" type="button" onClick={()=>onPreview(work)} aria-haspopup="dialog">{work.title}</button> : <Link to={`/discover/work/${work.id}`}>{work.title}</Link>}</h3><p className="po-creator">{work.podcast?.show??work.creator}</p><p className="po-summary">{work.description}</p><MusicPlay work={work}/><div className="po-card-footer"><SaveWork id={work.id} title={work.title}/>{preview ? <button type="button" onClick={()=>onPreview(work)} aria-label={`Preview details for ${work.title}`} aria-haspopup="dialog">Details →</button> : <Link to={`/discover/work/${work.id}`}>Details →</Link>}</div></div>
  </article>;
}
function CompactEntity({entity,catalog}:{entity:DiscoveryEntity;catalog:CultureCatalog}) {
  const photo=entityPhoto(entity.id);
  return <article className="po-entity">{photo?<LicensedPhoto photo={photo} sizes="(max-width:600px) 45vw, 180px"/>:entity.photo?<ArchivePhoto photo={entity.photo} sizes="(max-width:600px) 45vw, 180px"/>:<div className="po-entity-type" aria-hidden="true">{entity.kind==='person'?'Aa':'↗'}</div>}<div><p className="po-label">{entity.kind}</p><h3><Link to={entityHref(entity)}>{entity.title}</Link></h3><p>{entity.summary}</p><PersonalActions entity={entity} catalog={catalog} showActivity={false}/></div></article>;
}
export function ParisOverview({catalog}:{catalog:CultureCatalog}) {
  const selection=useMemo(()=>overviewSelection(catalog),[catalog]);
  const {featured,recent,playlist,tracks,connections,places,entities}=selection;
  const [preview,setPreview]=useState<CultureWork | null>(null);
  const counts=parisCounts(catalog);
  const [format,setFormat]=useState<string | null>(null);
  const visibleWorks=format===null ? featured : catalog.works.filter(work=>work.destinationId==='paris' && (!format || work.kind===format));
  const formatTitle=format===null ? 'Editor’s picks' : format==='' ? 'All works' : parisFormats.find(([,kind])=>kind===format)?.[0] ?? 'Works';
  const [selected,setSelected]=useState(places[0].id);
  const selectedPlace=entities.find(e=>e.placeId===selected)!;
  return <div className="po-overview">
    {preview && <MediaPreview key={preview.id} work={preview} onClose={()=>setPreview(null)}/>}
    <section className="po-hero" aria-labelledby="paris-title"><ArchivePhoto photo="sunset" eager sizes="(min-width:1100px) calc(100vw - 232px), 100vw"/><div className="po-hero-copy"><p className="po-monograph">Elsewhere city collection · France</p><h1 id="paris-title">Paris</h1><p className="po-hero-subtitle">A city of stories.</p><p>Books, films, music, podcasts and places.<br/>Explore the connections that bring Paris to life.</p><dl className="po-hero-stats"><div><dt>{counts.total}</dt><dd>Curated works</dd></div><div><dt>{counts.byKind.film}</dt><dd>Films</dd></div><div><dt>{counts.byKind.song}</dt><dd>Songs</dd></div></dl></div></section>
    <nav className="po-shortcuts" aria-label="Paris formats"><button type="button" aria-pressed={format===''} aria-controls="paris-search" onClick={()=>setFormat('')}>All works <span>{counts.total}</span></button>{parisFormats.map(([label,kind])=><button type="button" aria-pressed={format===kind} aria-controls="paris-search" onClick={()=>setFormat(kind)} key={kind}>{label} <span>{counts.byKind[kind]}</span></button>)}</nav>
    <PersonalNotice/>
    <section id="paris-search" aria-labelledby="paris-feature-heading"><div className="po-section-heading"><div><h2 id="paris-feature-heading">{formatTitle}</h2><p className="po-section-caption">{format===null?'Handpicked stories with a Paris connection':'Explore the Paris collection'}</p></div>{format===null ? <button type="button" className="po-filter-reset" onClick={()=>setFormat('')}>See all works →</button> : <button type="button" className="po-filter-reset" onClick={()=>setFormat(null)}>Editor’s picks →</button>}</div>{format!==null && <p className="po-filter-count" role="status">{visibleWorks.length} {visibleWorks.length===1?'work':'works'} · Paris</p>}<div className="po-work-grid">{visibleWorks.map(work=><CompactWorkCard key={work.id} work={work} onPreview={setPreview}/>)}</div>{!visibleWorks.length && <p>No works in this format yet. Choose another format or All works.</p>}</section>
    <section className="po-invitation"><p>A bookshop leads to a film. A song takes you to the river. Find your own way into Paris.</p><div><span>Let a story lead you somewhere.</span><Link to={PARIS_ROOT + "/places"}>Explore Paris places →</Link></div></section>
    <div className="po-middle">
      <section className="po-panel po-playlist" aria-labelledby="po-playlist-title"><h2 id="po-playlist-title">Featured playlist</h2><div className="po-playlist-intro"><ArchivePhoto photo="river" sizes="(max-width:1099px) 30vw, 150px"/><div><p className="po-label">Elsewhere · {tracks.length} tracks</p><h3><Link to={`/discover/work/${playlist.id}`}>{playlist.title}</Link></h3><p>{playlist.description}</p></div></div><MusicPlay work={playlist}/><p className="ew-small">Play on Spotify while you explore. Connect a Premium account, or choose YouTube. Recordings may differ by service.</p><ol className="po-tracks">{tracks.map((track,index)=><li key={track.id}><Link to={`/discover/work/${track.id}`}>{track.title}</Link><span>{track.creator}</span><MusicPlay work={track} tracks={tracks} index={index}/></li>)}</ol><div className="po-actions"><Link to={`/discover/work/${playlist.id}`}>Explore all {tracks.length} tracks →</Link><SaveWork id={playlist.id} title="Paris playlist"/></div></section>
      <section className="po-panel po-connections" aria-labelledby="po-connections-title"><h2 id="po-connections-title">Follow a connection</h2><ul>{connections.map(connection=>{const from=entities.find(e=>e.id===connection.from)!,to=entities.find(e=>e.id===connection.to)!;return <li key={connection.id}><p className="po-label">{connection.label}</p><h3><Link to={entityHref(from)}>{from.title}</Link><span aria-hidden="true"> → </span><Link to={entityHref(to)}>{to.title}</Link></h3><p>{connection.explanation}</p><Evidence ids={connection.sourceIds} catalog={catalog}/><Link className="po-follow" to={trailHref([from.id,to.id])}>Follow this connection →</Link></li>;})}</ul></section>
      <section className="po-panel po-map" aria-labelledby="po-map-title"><h2 id="po-map-title">Places in Paris</h2><ParisPlaceMap places={places} selected={selected} onSelect={setSelected}/><div className="po-map-choice" aria-live="polite"><h3><Link to={entityHref(selectedPlace)}>{selectedPlace.title} ↗</Link></h3><p>Catalog reference point</p></div><div className="po-map-options" aria-label="Select a mapped place">{places.map((place,index)=><button key={place.id} type="button" aria-pressed={selected===place.id} onClick={()=>setSelected(place.id)}>{index+1}. {place.name}</button>)}</div><Link to="/paris/archive?view=map">Open the full archive map ↗</Link></section>
    </div>
    <section aria-labelledby="more-discover-title"><div className="po-section-heading"><h2 id="more-discover-title">Recently added</h2><Link to={parisBrowse()}>View all ↗</Link></div><div className="po-work-grid">{recent.map(work=><CompactWorkCard key={work.id} work={work} recent onPreview={setPreview}/>)}</div></section>
    <div className="po-lower-grid"><section id="paris-places" aria-labelledby="po-places-title"><div className="po-section-heading"><h2 id="po-places-title">Places</h2><Link to="/paris/archive">Archive ↗</Link></div>{entities.filter(e=>e.kind==='place').map(entity=><CompactEntity key={entity.id} entity={entity} catalog={catalog}/>)}</section><section aria-labelledby="paris-writer-heading"><div className="po-section-heading"><h2 id="paris-writer-heading">People</h2></div>{entities.filter(e=>e.kind==='person').map(entity=><CompactEntity key={entity.id} entity={entity} catalog={catalog}/>)}</section></div>
    <section aria-labelledby="paris-guide-heading"><div className="po-section-heading"><h2 id="paris-guide-heading">Collections</h2><Link to={`${PARIS_ROOT}/collections`}>View all ↗</Link></div><div className="po-collections">{entities.filter(e=>e.kind==='collection').map(entity=><article key={entity.id}><p className="po-label">Free editorial guide · {entity.members?.length} starting points</p><h3><Link to={entityHref(entity)}>{entity.title}</Link></h3><p>{entity.summary}</p><PersonalActions entity={entity} catalog={catalog} showActivity={false}/></article>)}</div></section>
    <section aria-labelledby="paris-archive-heading"><div className="po-section-heading"><h2 id="paris-archive-heading">Original photography</h2><Link to="/paris/archive">All photographs ↗</Link></div><div className="po-photographs">{(['notredame','garden','cafe'] as const).map(photo=><ArchivePhoto key={photo} photo={photo} sizes="(max-width:600px) 90vw, (min-width:1100px) calc((100vw - 280px)/3), 30vw"/>)}</div></section>
    <nav className="po-bottom-nav" aria-label="Continue discovering Paris"><Link to={`${PARIS_ROOT}/stories`}>Story archive →</Link><Link to={`${PARIS_ROOT}/trails`}>Discovery trails →</Link><Link to={`${PARIS_ROOT}/atlas`}>My Paris atlas →</Link><span>Saved on this device</span></nav>
  </div>;
}
