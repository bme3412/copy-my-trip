import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, Outlet, ScrollRestoration, useLoaderData, useLocation, useOutletContext, useParams, useRouteError, useSearchParams, type LoaderFunctionArgs } from 'react-router-dom';
import { parseCatalog, queryCatalog, type CultureCatalog } from '../../lib/culture/schema';
import { ArchivePhoto } from './ArchivePhoto';
import { ShelfProvider, useShelf } from './ShelfContext';
import '../../styles/elsewhere.css';
import '../../styles/elsewhere-redesign.css';
import { WorkList, WorkDetails } from './WorkPresentation';
import { DestinationLanding } from './DestinationLanding';
import '../../styles/elsewhere-landing.css';
import { BeforeSunsetPage } from './BeforeSunsetPage';
import { ParisDestination } from './ParisDestination';
import '../../styles/elsewhere-paris.css';
export async function discoveryLoader({request}:LoaderFunctionArgs) {
  const response=await fetch('/api/catalog',{signal:request.signal});
  if(!response.ok)throw Error('The collection could not be loaded.');
  return parseCatalog(await response.json());
}
function ShellContent({catalog}:{catalog:CultureCatalog}) {
  const location=useLocation(),main=useRef<HTMLElement>(null),initial=useRef(true),shelf=useShelf();
  useEffect(()=>{document.title='Elsewhere · Discover a place through its stories';if(initial.current){initial.current=false;return;}main.current?.focus();},[location.pathname]);
  return <div className="ew"><a className="skip-link" href="#ew-main">Skip to content</a>
    <header className="ew-header"><Link className="ew-brand" to="/discover">Elsewhere</Link><nav aria-label="Elsewhere navigation"><NavLink end to="/discover">Destinations</NavLink><NavLink to="/discover/browse">Discover</NavLink><NavLink to="/discover/place/paris">Paris</NavLink><NavLink to="/discover/saved">Saved<span className="ew-saved-count">{shelf.ids.length}</span></NavLink><Link to="/paris/saved">My trips ↗</Link></nav></header>
    {shelf.error&&<div className="ew-notice" role="alert">{shelf.error} <Link to="/discover/saved">Saved list & recovery</Link></div>}
    <div className="ew-announcement" role="status" aria-live="polite">{shelf.message}</div>
    <main ref={main} id="ew-main" tabIndex={-1}><Outlet context={catalog}/></main>
    <footer className="ew-footer"><Link className="ew-brand" to="/discover">Elsewhere</Link><p>Places, stories, and the paths between them.</p><Link to="/paris">Trip planning by Copy My Trip ↗</Link></footer><ScrollRestoration/>
  </div>;
}
export function DiscoveryLayout(){const catalog=useLoaderData() as CultureCatalog;return <ShelfProvider><ShellContent catalog={catalog}/></ShelfProvider>;}
export function DiscoveryError(){const error=useRouteError();return <div className="ew ew-error"><Link className="ew-brand" to="/discover">Elsewhere</Link><h1>A little pause in the journey.</h1><p>{error instanceof Error?error.message:'The collection is unavailable right now.'}</p><button className="ew-button" onClick={()=>window.location.reload()}>Try again</button> <Link to="/paris">Continue to trip planning ↗</Link></div>;}
export function DiscoveryLoading(){return <div className="ew ew-error" role="status"><p className="ew-eyebrow">Elsewhere</p><h1>Opening the collection…</h1></div>;}
function useCatalog(){return useOutletContext<CultureCatalog>();}
export function DiscoveryEntry(){const catalog=useCatalog(),[params]=useSearchParams();return ['q','kind','destination','work'].some(key=>params.has(key))?<DiscoveryHome/>:<DestinationLanding catalog={catalog}/>;}
export function DiscoveryHome(){
  const catalog=useCatalog(),[params,setParams]=useSearchParams();
  const q=params.get('q')??'',destination=params.get('destination')??'',kind=params.get('kind')??'';
  const works=queryCatalog(catalog,{q,destination,kind}).sort((a,b)=>a.title.localeCompare(b.title,'en'));
  const selected=works.find(w=>w.id===params.get('work'));
  const previous=useRef<{id?:string;filters:string}>({filters:''}),detail=useRef<HTMLElement>(null);
  const filters=JSON.stringify([q,destination,kind]);
  useEffect(()=>{
    if(selected) detail.current?.focus({preventScroll:true});
    else if(previous.current.id && previous.current.filters===filters) document.getElementById(`result-${previous.current.id}`)?.focus({preventScroll:true});
    previous.current={id:selected?.id,filters};
  },[selected?.id,filters]);
  const change=(key:string,value:string)=>{const next=new URLSearchParams(params);next.delete('work');if(value)next.set(key,value);else next.delete(key);setParams(next,{replace:true,preventScrollReset:true});};
  const close=()=>{const next=new URLSearchParams(params);next.delete('work');setParams(next,{preventScrollReset:true});};
  const clear=()=>setParams({},{preventScrollReset:true});
  const resultHref=(id:string)=>{const next=new URLSearchParams(params);next.set('work',id);return `/discover/browse?${next}#collection`;};
  const formats=[{group:'Reading',items:[['book','Books']]},{group:'Screen',items:[['film','Films'],['tv_show','TV shows'],['tv_episode','TV episodes']]},{group:'Podcasts',items:[['podcast_show','Podcast shows'],['podcast_episode','Podcast episodes']]},{group:'Music',items:[['artist','Artists'],['album','Albums'],['song','Songs']]}];
  const count=(value:string)=>catalog.works.filter(w=>w.kind===value).length;
  return <div className={`ew-library ew-discover ${selected?'has-selection':''}`}>
    <header className="ew-width ew-library-intro"><p className="ew-eyebrow">The cultural library</p><h1>Find your next <em>connection.</em></h1><p className="ew-lede">Stories, screens and sounds that bring places into focus.</p></header>
    <section id="collection" className="ew-width ew-collection" aria-label="Cultural collection">
      <div className="ew-library-controls"><label className="ew-library-search">Search the collection<input type="search" value={q} maxLength={120} onChange={e=>change('q',e.target.value)} placeholder="Title, creator or city…"/></label><label>Format<select value={kind} onChange={e=>change('kind',e.target.value)}><option value="">All formats · {catalog.works.length}</option>{formats.map(group=><optgroup key={group.group} label={group.group}>{group.items.map(([value,label])=><option key={value} value={value} disabled={!count(value)}>{label} · {count(value)||'not yet available'}</option>)}</optgroup>)}{kind&&!formats.some(g=>g.items.some(([value])=>value===kind))&&<option value={kind}>Unknown format</option>}</select></label><label>City<select value={destination} onChange={e=>change('destination',e.target.value)}><option value="">All cities</option>{catalog.destinations.map(d=><option key={d.id} value={d.id}>{d.name}</option>)}{destination&&!catalog.destinations.some(d=>d.id===destination)&&<option value={destination}>Unknown city</option>}</select></label></div>
      <p className="ew-library-note">Search matches titles, creators and cities. Books and films are available now; television, podcasts and music will appear as records are verified.</p>
      <div className="ew-library-results-heading"><p className="ew-result-count" role="status">{works.length} {works.length===1?'work':'works'}{destination?` · ${catalog.destinations.find(d=>d.id===destination)?.name??'Unknown city'}`:' · All cities'}</p>{(q||kind||destination)&&<button className="ew-text-button" onClick={clear}>Clear all filters</button>}</div>
      <div className={`ew-browser ${selected?'is-open':''}`}><div className="ew-results">{works.length?<WorkList works={works} hrefFor={resultHref} selectedId={selected?.id}/>:<div className="ew-empty"><h3>No matches in this small collection.</h3><p>Try another title, creator or city, or clear your filters.</p><button className="ew-button" onClick={clear}>Show all works</button></div>}</div>{selected&&<section className="ew-selected" ref={detail} tabIndex={-1} aria-label={`${selected.title} details`}><button className="ew-text-button ew-close" onClick={close}>← Back to results <span aria-hidden="true">×</span></button><WorkDetails work={selected} catalog={catalog} embedded/></section>}</div>
    </section>

  </div>;
}
export function DestinationPage(){const catalog=useCatalog(),{destinationId}=useParams();const destination=catalog.destinations.find(d=>d.id===destinationId);if(!destination)return <Missing/>;
  if(destination.id==='paris')return <ParisDestination catalog={catalog}/>;
  return <div className="ew-destination"><section className={`ew-wide ew-hero ew-destination-hero ${destination.archive==='none'?'ew-no-archive':''}`}>{destination.archive==='original'&&<ArchivePhoto photo="river" eager sizes="100vw"/>}<div className="ew-hero-copy"><p className="ew-eyebrow">{destination.country} / A cultural introduction</p><h1>{destination.name},<br/><em>beyond the guidebook.</em></h1><p className="ew-lede">{destination.introduction}</p><div className="ew-inline-links"><Link className="ew-button" to={`/${destination.id}/compose`}>Plan a visit ↗</Link><Link className="ew-link" to={`/${destination.id}/archive`}>Explore the place map ↗</Link></div>{destination.archive==='none'&&<p className="ew-small">A researched chapter. No firsthand photographs yet.</p>}</div></section><div className="ew-width ew-detail"><Link className="ew-back" to="/discover">← All discoveries</Link>{destination.archive==='original'&&<section className="ew-gallery"><div className="ew-section-title"><div><p className="ew-eyebrow">Original photography</p><h2>A city of a thousand stories.</h2></div><Link className="ew-link" to="/paris/archive">View the full archive ↗</Link></div><div className="ew-photo-strip">{(['hero','cafe','river'] as const).map(photo=><ArchivePhoto key={photo} photo={photo} sizes="(max-width: 760px) 90vw, 30vw"/>)}</div></section>}<section><p className="ew-eyebrow">Read & watch</p><h2>Your cultural starting points</h2><p className="ew-intro-note">City connections are attributed to the linked publisher or film source. These are starting points for discovery, not firsthand recommendations.</p><WorkList works={catalog.works.filter(w=>w.destinationId===destination.id)}/></section></div></div>;
}
export function WorkPage(){const catalog=useCatalog(),{workId}=useParams();const work=catalog.works.find(w=>w.id===workId);if(!work)return <Missing/>;if(work.id==='before-sunset')return <BeforeSunsetPage work={work}/>;return <div className="ew-width ew-detail"><Link className="ew-back" to={`/discover/browse?destination=${work.destinationId}`}>← Back to the collection</Link><WorkDetails work={work} catalog={catalog}/></div>;}
export function SavedPage(){const catalog=useCatalog(),shelf=useShelf();const [confirm,setConfirm]=useState(false);const works=shelf.ids.flatMap(id=>catalog.works.filter(w=>w.id===id));const missing=shelf.ids.filter(id=>!catalog.works.some(w=>w.id===id));
  return <div className="ew-width ew-detail"><p className="ew-eyebrow">Your own way in</p><h1>Keep a little <em>elsewhere.</em></h1><p className="ew-lede">A book for the train. A film for a quiet evening. A few things to come back to.</p><p className="ew-small">Saved in this browser, on this device. This list is separate from your account and saved trips.</p>{works.length?<WorkList works={works}/>:<div className="ew-empty"><h2>{shelf.error?'Your list needs attention.':'Your collection starts with a little curiosity.'}</h2><p>{shelf.error?'Use the recovery tools below to keep a copy of the original data.':'Save a book or film while exploring. Find it here when you return.'}</p><Link className="ew-button" to="/discover">Explore the collection ↗</Link></div>}{missing.map(id=><div className="ew-notice" key={id}>A previously saved work is no longer in this collection. <button onClick={()=>void shelf.save(id,false)}>Remove unavailable work</button></div>)}<details className="ew-recovery"><summary>Backup & recovery</summary><p>Export your list before clearing browser data. Reset affects only Elsewhere bookmarks on this device.</p><button onClick={shelf.exportData}>Export original saved data</button> <button onClick={()=>setConfirm(true)}>Reset saved list…</button>{confirm&&<p>Remove all Elsewhere bookmarks from this device? <button disabled={shelf.busy} onClick={()=>{void shelf.reset();setConfirm(false);}}>Confirm reset</button> <button onClick={()=>setConfirm(false)}>Cancel</button></p>}</details></div>;
}
export function Missing(){return <div className="ew-width ew-detail ew-empty"><h1>This chapter isn’t here.</h1><p>The link may be out of date. Your saved trips are unchanged.</p><Link to="/discover" className="ew-button">Back to discovery</Link></div>;}
