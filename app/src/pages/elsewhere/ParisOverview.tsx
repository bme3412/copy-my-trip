import { MusicPlay } from './MusicPlayer';
import { MediaPreview } from './MediaPreview';
import { useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { formatLabel, type CultureCatalog, type CultureWork } from '../../lib/culture/schema';
import { entityHref, PARIS_ROOT, type DiscoveryEntity } from '../../lib/culture/paris-discovery';
import { overviewSelection, parisBrowse, parisFormats, parisCounts, prioritizeParisFilms } from '../../lib/culture/paris-overview';
import { ArchivePhoto } from './ArchivePhoto';
import { WorkCover } from './WorkPresentation';
import { SaveWork } from './ShelfContext';
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
function WorkCarousel({works,onPreview,id}:{works:CultureWork[];onPreview:(work:CultureWork)=>void;id:string}) {
  const rail=useRef<HTMLDivElement>(null);
  const move=(direction:number)=>{const node=rail.current;if(node)node.scrollBy({left:direction*node.clientWidth,behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});};
  return <div className="po-carousel"><div className="po-carousel-controls"><span>Browse sideways</span><button type="button" aria-label="Scroll cards left" aria-controls={id} onClick={()=>move(-1)}>←</button><button type="button" aria-label="Scroll cards right" aria-controls={id} onClick={()=>move(1)}>→</button></div><div id={id} ref={rail} className="po-work-grid po-card-rail" tabIndex={0} role="region" aria-label="Work cards, scroll horizontally">{works.map(work=><CompactWorkCard key={work.id} work={work} onPreview={onPreview}/>)}</div></div>;
}
const discoveryTabs=['Places','People','Collections','Photography','Map'] as const;
export function ParisOverview({catalog}:{catalog:CultureCatalog}) {
  const selection=useMemo(()=>overviewSelection(catalog),[catalog]);
  const {featured,recent,playlist,tracks,places,entities}=selection;
  const [preview,setPreview]=useState<CultureWork | null>(null);
  const counts=parisCounts(catalog);
  const [format,setFormat]=useState<string | null>(null);
  const [page,setPage]=useState(0);
  const chooseFormat=(value:string|null)=>{setFormat(value);setPage(0);};
  const [discoveryTab,setDiscoveryTab]=useState<(typeof discoveryTabs)[number]>('Places');
  const tabButtons=useRef<(HTMLButtonElement|null)[]>([]);
  const filteredWorks=format===null ? featured : catalog.works.filter(work=>work.destinationId==='paris' && (!format || work.kind===format));
  const visibleWorks=format==='film'?prioritizeParisFilms(filteredWorks):filteredWorks;
  const formatTitle=format===null ? 'Editor’s picks' : format==='' ? 'All works' : parisFormats.find(([,kind])=>kind===format)?.[0] ?? 'Works';
  const [selected,setSelected]=useState(places[0].id);
  const selectedPlace=entities.find(e=>e.placeId===selected)!;
  return <div className="po-overview">
    {preview && <MediaPreview key={preview.id} work={preview} onClose={()=>setPreview(null)}/>}
    <section className="po-hero" aria-labelledby="paris-title"><ArchivePhoto photo="sunset" eager sizes="(min-width:1100px) calc(100vw - 232px), 100vw"/><div className="po-hero-copy"><p className="po-monograph">Elsewhere city collection · France</p><h1 id="paris-title">Paris</h1><p className="po-hero-subtitle">A city of stories.</p><p>Books, films, music, podcasts and places.<br/>Explore the connections that bring Paris to life.</p><dl className="po-hero-stats"><div><dt>{counts.total}</dt><dd>Curated works</dd></div><div><dt>{counts.byKind.film}</dt><dd>Films</dd></div><div><dt>{counts.byKind.song}</dt><dd>Songs</dd></div></dl></div></section>
    <nav className="po-shortcuts" aria-label="Paris formats"><button type="button" aria-pressed={format===''} aria-controls="paris-search" onClick={()=>chooseFormat('')}>All works <span>{counts.total}</span></button>{parisFormats.map(([label,kind])=><button type="button" aria-pressed={format===kind} aria-controls="paris-search" onClick={()=>chooseFormat(kind)} key={kind}>{label} <span>{counts.byKind[kind]}</span></button>)}</nav>
    <PersonalNotice/>
    <section id="paris-search" aria-labelledby="paris-feature-heading"><div className="po-section-heading"><div><h2 id="paris-feature-heading">{formatTitle}</h2><p className="po-section-caption">{format===null?'Handpicked stories with a Paris connection':format==='film'?'Eight starting points, then the full film collection':'Explore the Paris collection'}</p></div>{format===null ? <button type="button" className="po-filter-reset" onClick={()=>chooseFormat('')}>See all works →</button> : <button type="button" className="po-filter-reset" onClick={()=>chooseFormat(null)}>Editor’s picks →</button>}</div>{format!==null && <p className="po-filter-count" role="status">{visibleWorks.length} {visibleWorks.length===1?'work':'works'} · Paris</p>}<WorkCarousel key={`${format}-${page}`} id="paris-work-cards" works={visibleWorks.slice(page*8,page*8+8)} onPreview={setPreview}/>{format!==null && visibleWorks.length>0 && <div className="po-pagination"><button type="button" disabled={page===0} onClick={()=>setPage(value=>value-1)}>Previous 8</button><span role="status">{page*8+1}–{Math.min(page*8+8,visibleWorks.length)} of {visibleWorks.length}</span><button type="button" disabled={(page+1)*8>=visibleWorks.length} onClick={()=>setPage(value=>value+1)}>Next 8</button></div>}{!visibleWorks.length && <p>No works in this format yet. Choose another format or All works.</p>}</section>
    <section className="po-invitation"><p>A bookshop leads to a film. A song takes you to the river. Find your own way into Paris.</p><div><span>Let a story lead you somewhere.</span><Link to={PARIS_ROOT + "/places"}>Explore Paris places →</Link></div></section>
    <div className="po-middle">
      <section className="po-panel po-playlist" aria-labelledby="po-playlist-title">
        <div className="po-playlist-feature"><ArchivePhoto photo="river" sizes="(max-width:650px) 90vw, 320px"/><div className="po-playlist-heading"><p className="po-label">The Paris soundtrack · {tracks.length} tracks</p><h2 id="po-playlist-title">{playlist.title}</h2><p>{playlist.description}</p><MusicPlay work={playlist}/><div className="po-playlist-save"><SaveWork id={playlist.id} title="Paris playlist"/><button type="button" onClick={()=>setPreview(playlist)} aria-haspopup="dialog">About this playlist</button></div></div></div>
        <details className="po-track-disclosure"><summary>Show the {tracks.length} tracks</summary>
        <ol className="po-playlist-rows">{tracks.map((track,index)=><li key={track.id}><span className="po-track-index" aria-hidden="true">{String(index+1).padStart(2,'0')}</span><div className="po-track-copy"><button type="button" onClick={()=>setPreview(track)} aria-haspopup="dialog">{track.title}</button><p>{track.creator}</p></div><MusicPlay work={track} tracks={tracks} index={index}/><SaveWork id={track.id} title={track.title}/></li>)}</ol></details>
        <p className="po-playlist-note">Listen with Spotify Premium, or choose YouTube. Recordings may differ by service.</p>
      </section>


    </div>
    <section aria-labelledby="more-discover-title"><div className="po-section-heading"><h2 id="more-discover-title">Recently added</h2><Link to={parisBrowse()}>View all</Link></div><WorkCarousel id="paris-recent-cards" works={recent} onPreview={setPreview}/></section>
    <section className="po-discovery-tabs" aria-label="Discover more of Paris"><div className="po-tab-list" role="tablist" aria-label="Paris discovery sections">{discoveryTabs.map((tab,index)=><button key={tab} ref={node=>{tabButtons.current[index]=node;}} id={`paris-tab-${tab}`} role="tab" aria-selected={discoveryTab===tab} aria-controls={`paris-panel-${tab}`} tabIndex={discoveryTab===tab?0:-1} onClick={()=>setDiscoveryTab(tab)} onKeyDown={event=>{let next=index;if(event.key==='ArrowRight')next=(index+1)%discoveryTabs.length;else if(event.key==='ArrowLeft')next=(index+discoveryTabs.length-1)%discoveryTabs.length;else if(event.key==='Home')next=0;else if(event.key==='End')next=discoveryTabs.length-1;else return;event.preventDefault();setDiscoveryTab(discoveryTabs[next]);tabButtons.current[next]?.focus();}}>{tab}</button>)}</div>
      <div role="tabpanel" id="paris-panel-Places" aria-labelledby="paris-tab-Places" hidden={discoveryTab!=='Places'} tabIndex={0}><section id="paris-places" aria-labelledby="po-places-title"><div className="po-section-heading"><h2 id="po-places-title">Places</h2><Link to="/paris/archive">Archive</Link></div>{entities.filter(e=>e.kind==='place').map(entity=><CompactEntity key={entity.id} entity={entity} catalog={catalog}/>)}</section></div>
      <div role="tabpanel" id="paris-panel-People" aria-labelledby="paris-tab-People" hidden={discoveryTab!=='People'} tabIndex={0}><section aria-labelledby="paris-writer-heading"><div className="po-section-heading"><h2 id="paris-writer-heading">People</h2></div>{entities.filter(e=>e.kind==='person').map(entity=><CompactEntity key={entity.id} entity={entity} catalog={catalog}/>)}</section></div>
      <div role="tabpanel" id="paris-panel-Collections" aria-labelledby="paris-tab-Collections" hidden={discoveryTab!=='Collections'} tabIndex={0}><section aria-labelledby="paris-guide-heading"><div className="po-section-heading"><h2 id="paris-guide-heading">Collections</h2><Link to={`${PARIS_ROOT}/collections`}>View all</Link></div><div className="po-collections">{entities.filter(e=>e.kind==='collection').map(entity=><article key={entity.id}><p className="po-label">Free editorial guide · {entity.members?.length} starting points</p><h3><Link to={entityHref(entity)}>{entity.title}</Link></h3><p>{entity.summary}</p><PersonalActions entity={entity} catalog={catalog} showActivity={false}/></article>)}</div></section></div>
      <div role="tabpanel" id="paris-panel-Photography" aria-labelledby="paris-tab-Photography" hidden={discoveryTab!=='Photography'} tabIndex={0}><section aria-labelledby="paris-archive-heading"><div className="po-section-heading"><h2 id="paris-archive-heading">Original photography</h2><Link to="/paris/archive">All photographs</Link></div><div className="po-photographs">{(['notredame','garden','cafe'] as const).map(photo=><ArchivePhoto key={photo} photo={photo} sizes="(max-width:600px) 90vw, (min-width:1100px) calc((100vw - 280px)/3), 30vw"/>)}</div></section></div>
      <div role="tabpanel" id="paris-panel-Map" aria-labelledby="paris-tab-Map" hidden={discoveryTab!=='Map'} tabIndex={0}>      <section className="po-panel po-map" aria-labelledby="po-map-title"><h2 id="po-map-title">Places in Paris</h2><ParisPlaceMap places={places} selected={selected} onSelect={setSelected}/><div className="po-map-choice" aria-live="polite"><h3><Link to={entityHref(selectedPlace)}>{selectedPlace.title}</Link></h3><p>Catalog reference point</p></div><div className="po-map-options" aria-label="Select a mapped place">{places.map((place,index)=><button key={place.id} type="button" aria-pressed={selected===place.id} onClick={()=>setSelected(place.id)}>{index+1}. {place.name}</button>)}</div><Link to="/paris/archive?view=map">Open the full archive map</Link></section></div>
    </section>
    <nav className="po-bottom-nav" aria-label="Continue discovering Paris"><Link to={`${PARIS_ROOT}/stories`}>Story archive →</Link><Link to={`${PARIS_ROOT}/trails`}>Discovery trails →</Link><Link to={`${PARIS_ROOT}/atlas`}>My Paris atlas →</Link><span>Saved on this device</span></nav>
  </div>;
}
