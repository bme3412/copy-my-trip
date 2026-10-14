import { MusicPlay } from './MusicPlayer';
import { MediaPreview } from './MediaPreview';
import { useMemo, useRef, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { formatLabel, type CultureCatalog, type CultureWork } from '../../lib/culture/schema';
import { overviewSelection, parisFormats, parisCounts, prioritizeParisFilms } from '../../lib/culture/paris-overview';
import { ArchivePhoto } from './ArchivePhoto';
import { WorkCover } from './WorkPresentation';
import { SaveWork } from './ShelfContext';
import { PersonalNotice } from './ParisDiscoveryPages';

function FormatIcon({kind}:{kind:CultureWork['kind']}) {
  const paths:Record<CultureWork['kind'],ReactNode>={
    book:<><path d="M12 5c-3-2-6-2-9-1v15c3-1 6-1 9 1 3-2 6-2 9-1V4c-3-1-6-1-9 1Z"/><path d="M12 5v15"/></>,
    film:<><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M7 3v18M17 3v18M3 8h4m10 0h4M3 16h4m10 0h4"/></>,
    tv_show:<><rect x="3" y="7" width="18" height="14" rx="2"/><path d="m8 2 4 5 4-5"/></>,
    podcast_episode:<><rect x="9" y="2" width="6" height="12" rx="3"/><path d="M5 10v2a7 7 0 0 0 14 0v-2M12 19v3M8 22h8"/></>,
    song:<><path d="M9 18V5l12-2v13M9 9l12-2"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></>,
    playlist:<><path d="M3 5h12M3 10h12M3 15h7M18 10v9l3-1"/><circle cx="15" cy="19" r="3"/></>,
    essay:<><path d="M14 3H5v18h14V8Z M14 3v5h5M8 12h8M8 16h6"/></>,
    poem:<><path d="M14 3H5v18h14V8Z M14 3v5h5M8 12h8M8 16h4"/></>,
  };
  return <svg className="po-format-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">{paths[kind]}</svg>;
}
export function CompactWorkCard({work,recent=false,onPreview}:{work:CultureWork;recent?:boolean;onPreview?:(work:CultureWork)=>void}) {
  const preview=onPreview;
  return <article className={`po-work po-kind-${work.kind}${recent?' po-recent-work':''}`}>
    <p className="po-card-kicker"><span><FormatIcon kind={work.kind}/>{work.kind==='podcast_episode'?'Podcast':work.kind==='song'?'Music':formatLabel(work.kind)}</span><span>{work.year}</span></p>
    {preview ? <button className="po-work-art po-preview-trigger" type="button" onClick={()=>onPreview(work)} aria-label={`Preview ${work.title}`} aria-haspopup="dialog"><WorkCover work={work}/></button> : <Link className="po-work-art" to={`/discover/work/${work.id}`} aria-label={`Explore ${work.title}`}><WorkCover work={work}/></Link>}
    <div className="po-work-copy"><h3>{preview ? <button className="po-preview-title" type="button" onClick={()=>onPreview(work)} aria-haspopup="dialog">{work.title}</button> : <Link to={`/discover/work/${work.id}`}>{work.title}</Link>}</h3><p className="po-creator">{work.podcast?.show??work.creator}</p><p className="po-summary">{work.description}</p><MusicPlay work={work}/><div className="po-card-footer"><SaveWork id={work.id} title={work.title}/>{preview ? <button type="button" onClick={()=>onPreview(work)} aria-label={`Preview details for ${work.title}`} aria-haspopup="dialog">Details →</button> : <Link to={`/discover/work/${work.id}`}>Details →</Link>}</div></div>
  </article>;
}
function WorkCarousel({works,onPreview,id,heading,grid=false}:{works:CultureWork[];onPreview:(work:CultureWork)=>void;id:string;heading:ReactNode;grid?:boolean}) {
  const rail=useRef<HTMLDivElement>(null);
  const move=(direction:number)=>{const node=rail.current;if(node)node.scrollBy({left:direction*node.clientWidth,behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});};
  return <div className="po-carousel"><div className="po-carousel-heading">{heading}{!grid && <div className="po-carousel-controls"><button type="button" aria-label="Scroll cards left" aria-controls={id} onClick={()=>move(-1)}>←</button><button type="button" aria-label="Scroll cards right" aria-controls={id} onClick={()=>move(1)}>→</button></div>}</div><div id={id} ref={rail} className={`po-work-grid ${grid?'po-paged-grid':'po-card-rail'}`} tabIndex={grid?undefined:0} role="region" aria-label={grid?'Work cards':'Work cards, scroll horizontally'}>{works.map(work=><CompactWorkCard key={work.id} work={work} onPreview={onPreview}/>)}</div></div>;
}
export function ParisOverview({catalog}:{catalog:CultureCatalog}) {
  const selection=useMemo(()=>overviewSelection(catalog),[catalog]);
  const {featured,playlist,tracks}=selection;
  const [preview,setPreview]=useState<CultureWork | null>(null);
  const counts=parisCounts(catalog);
  const [format,setFormat]=useState<string | null>(null);
  const [page,setPage]=useState(0);
  const chooseFormat=(value:string|null)=>{setFormat(value);setPage(0);};
  const filteredWorks=format===null ? featured : catalog.works.filter(work=>work.destinationId==='paris' && (!format || work.kind===format));
  const visibleWorks=format==='film'?prioritizeParisFilms(filteredWorks):filteredWorks;
  const formatTitle=format===null ? 'Editor’s picks' : format==='' ? 'All works' : parisFormats.find(([,kind])=>kind===format)?.[0] ?? 'Works';
  return <div className="po-overview">
    {preview && <MediaPreview key={preview.id} work={preview} onClose={()=>setPreview(null)}/>}
    <section className="po-hero po-city-intro" aria-labelledby="paris-title"><div className="po-hero-copy"><p className="po-monograph">France · Île-de-France</p><h1 id="paris-title">Paris</h1><p className="po-city-description">Discover the places, stories and culture that make the city yours.</p></div><ArchivePhoto photo="garden" eager sizes="(min-width:1024px) 55vw, 100vw"/></section>
    <nav className="po-shortcuts" aria-label="Paris formats"><button type="button" aria-pressed={format===null} aria-controls="paris-search" onClick={()=>chooseFormat(null)}>Editor’s picks</button><button type="button" aria-pressed={format===''} aria-controls="paris-search" onClick={()=>chooseFormat('')}>All works <span>{counts.total}</span></button>{parisFormats.map(([label,kind])=><button type="button" aria-pressed={format===kind} aria-controls="paris-search" onClick={()=>chooseFormat(kind)} key={kind}>{label} <span>{counts.byKind[kind]}</span></button>)}</nav>
    <PersonalNotice/>
    <section id="paris-search" aria-labelledby="paris-feature-heading"><WorkCarousel key={`${format}-${page}`} id="paris-work-cards" grid={format!==null} heading={<div><h2 id="paris-feature-heading">{formatTitle}</h2><p className="po-section-caption">{format===null?'Handpicked stories with a Paris connection':`${visibleWorks.length} works · Paris`}</p></div>} works={visibleWorks.slice(page*8,page*8+8)} onPreview={setPreview}/>{format!==null && visibleWorks.length>0 && <div className="po-pagination"><button type="button" disabled={page===0} onClick={()=>setPage(value=>value-1)}>Previous 8</button><span role="status">{page*8+1}–{Math.min(page*8+8,visibleWorks.length)} of {visibleWorks.length}</span><button type="button" disabled={(page+1)*8>=visibleWorks.length} onClick={()=>setPage(value=>value+1)}>Next 8</button></div>}{!visibleWorks.length && <p>No works in this format yet. Choose another format or All works.</p>}</section>
    <div className="po-middle">
      <section className="po-panel po-playlist" aria-labelledby="po-playlist-title">
        <div className="po-playlist-feature"><ArchivePhoto photo="river" sizes="(max-width:650px) 90vw, 320px"/><div className="po-playlist-heading"><p className="po-label">The Paris soundtrack · {tracks.length} tracks</p><h2 id="po-playlist-title">{playlist.title}</h2><p>{playlist.description}</p><MusicPlay work={playlist}/><div className="po-playlist-save"><SaveWork id={playlist.id} title="Paris playlist"/><button type="button" onClick={()=>setPreview(playlist)} aria-haspopup="dialog">About this playlist</button></div></div></div>
        <details className="po-track-disclosure"><summary>Show the {tracks.length} tracks</summary>
        <ol className="po-playlist-rows">{tracks.map((track,index)=><li key={track.id}><span className="po-track-index" aria-hidden="true">{String(index+1).padStart(2,'0')}</span><div className="po-track-copy"><button type="button" onClick={()=>setPreview(track)} aria-haspopup="dialog">{track.title}</button><p>{track.creator}</p></div><MusicPlay work={track} tracks={tracks} index={index}/><SaveWork id={track.id} title={track.title}/></li>)}</ol></details>
        <p className="po-playlist-note">Listen with Spotify Premium, or choose YouTube. Recordings may differ by service.</p>
      </section>


    </div>

  </div>;
}
