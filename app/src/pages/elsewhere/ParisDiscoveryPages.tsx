import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useOutletContext, useParams, useSearchParams } from 'react-router-dom';
import { CULTURE_FORMATS, formatLabel, type CultureCatalog } from '../../lib/culture/schema';
import { branchTrail, connectionBetween, dailyStory, entitiesFor, entityHref, neighbors, PARIS_ROOT, parisDate, parseTrail, placeFor, readingMinutes, trailHref, type DiscoveryEntity } from '../../lib/culture/paris-discovery';
import { type ActivityStatus } from '../../lib/culture/paris-personal';
import { ArchivePhoto } from './ArchivePhoto';
import { LicensedPhoto, entityPhoto } from './LicensedPhoto';
import '../../styles/elsewhere-paris-hub.css';
import { ParisAudio } from './AudioPresentation';
import { WorkCover } from './WorkPresentation';
import { SaveWork, useShelf } from './ShelfContext';
import { ConnectionReason, Evidence, ParisConnections } from './ParisConnections';
import { useParisPersonal } from './ParisPersonalContext';
import { ParisPlaceMap } from './ParisPlaceMap';
export function ParisNav(){return <nav className="pd-nav" aria-label="Explore Paris"><Link to={PARIS_ROOT}>Paris stories</Link><Link to={`${PARIS_ROOT}/stories`}>Story archive</Link><Link to={`${PARIS_ROOT}/collections`}>Collections</Link><Link to={`${PARIS_ROOT}/trails`}>Discovery trails</Link><Link to={`${PARIS_ROOT}/atlas`}>My Paris atlas</Link></nav>;}
export function activityFor(entity:DiscoveryEntity,catalog:CultureCatalog):ActivityStatus|undefined {
  if(entity.kind==='place')return 'visited';
  if(entity.kind==='story')return 'read';
  const kind=catalog.works.find(w=>w.id===entity.workId)?.kind;
  const action=CULTURE_FORMATS.find(format=>format.kind===kind)?.action;
  return action==='READ'?'read':action==='WATCH'?'watched':action==='LISTEN'?'listened':undefined;
}
export function PersonalActions({entity,catalog,showSave=true,showActivity=true}:{entity:DiscoveryEntity;catalog:CultureCatalog;showSave?:boolean;showActivity?:boolean}) {
  const personal=useParisPersonal(),saved=personal.data.saved.some(s=>s.id===entity.id),status=activityFor(entity,catalog),marked=personal.data.activities.some(a=>a.id===entity.id&&a.status===status);
  return <div className="pd-actions">{showSave&&(entity.workId?<SaveWork id={entity.workId} title={entity.title}/>:<button disabled={personal.busy} aria-label={`${saved?'Remove':'Save'} ${entity.title}`} aria-pressed={saved} onClick={()=>void personal.edit(d=>({...d,saved:saved?d.saved.filter(s=>s.id!==entity.id):[...d.saved,{id:entity.id,at:new Date().toISOString()}]}))}>{saved?'✓ Saved':'Save'} {entity.kind}</button>)}{showActivity&&status&&<button className="ew-save" disabled={personal.busy} aria-pressed={marked} onClick={()=>void personal.edit(d=>({...d,activities:marked?d.activities.filter(a=>a.id!==entity.id):[...d.activities.filter(a=>a.id!==entity.id),{id:entity.id,status,at:new Date().toISOString()}]}))}>{marked?`Undo ${status==='listened'?'listened to':status}`:`Mark as ${status==='listened'?'listened to':status}`}</button>}</div>;
}
export function PersonalNotice(){const personal=useParisPersonal();return <>{personal.error&&<p className="ew-notice" role="alert">{personal.error} <Link to={`${PARIS_ROOT}/atlas#recovery`}>Backup & recovery</Link></p>}<div className="ew-announcement" role="status">{personal.message}</div></>;}
function EntityArt({entity,catalog}:{entity:DiscoveryEntity;catalog:CultureCatalog}){const work=catalog.works.find(w=>w.id===entity.workId),photo=entityPhoto(entity.id);return photo?<LicensedPhoto photo={photo}/>:work?<WorkCover work={work}/>:entity.photo?<ArchivePhoto photo={entity.photo} sizes="(max-width:760px) 90vw, 30vw"/>:<div className={`pd-type-art pd-type-${entity.kind}`}><span>{entity.kind==='place'?'↗':entity.kind==='person'?'Aa':'✳'}</span><strong>{entity.title}</strong><small>{entity.kind==='place'?'A place in the Paris catalog':entity.kind==='person'?'A life behind the work':'Follow an idea'}</small></div>;}
export function EntityCard({entity,catalog}:{entity:DiscoveryEntity;catalog:CultureCatalog}){return <article className="pd-card">{entityPhoto(entity.id)?<div className="pd-card-art"><EntityArt entity={entity} catalog={catalog}/></div>:<Link className="pd-card-art" aria-label={`Explore ${entity.title}`} to={entityHref(entity)}><EntityArt entity={entity} catalog={catalog}/></Link>}<div><p className="ew-eyebrow">{entity.workId?formatLabel(catalog.works.find(w=>w.id===entity.workId)!.kind):entity.kind}</p><h3><Link to={entityHref(entity)}>{entity.title}</Link></h3><p>{entity.summary}</p><PersonalActions entity={entity} catalog={catalog}/></div></article>;}
function useParisDay(){const [day,setDay]=useState(()=>parisDate());useEffect(()=>{const timer=window.setInterval(()=>setDay(parisDate()),60000);return()=>window.clearInterval(timer);},[]);return day;}
export function ParisHub({catalog}:{catalog:CultureCatalog}) {
  const day=useParisDay(),entities=entitiesFor(catalog),story=dailyStory(new Date(`${day}T12:00:00Z`));
  const bookshop=entities.find(e=>e.id==='place:shakespeare');
  const film=catalog.works.find(w=>w.id==='before-sunset');
  const baldwin=entities.find(e=>e.id==='person:james-baldwin');
  const novel=catalog.works.find(w=>w.id==='giovannis-room');
  const collection=entities.find(e=>e.id==='collection:literary-paris');
  const connection=connectionBetween('work:before-sunset','place:shakespeare');
  return <div className="pd pd-hub">
    <section className="pd-hero"><ArchivePhoto eager sizes="100vw"/><div className="pd-hero-copy"><p className="ew-eyebrow">Paris / Follow your curiosity</p><h1>Every story<br/>leads <em>somewhere.</em></h1><p>Books, films, music, people and places.<br/>A different way into Paris.</p></div></section>
    <div className="ew-width pd-body"><ParisNav/><PersonalNotice/>
      <section id="paris-search" className="pd-section" aria-labelledby="paris-feature-heading">
        <div className="pd-section-heading"><div><p className="ew-eyebrow">Start with a connection</p><h2 id="paris-feature-heading">A bookshop. A film. A Paris afternoon.</h2></div><Link to="/discover/browse?destination=paris">All Paris works ↗</Link></div>
        {bookshop&&film&&<article className="pd-lead-feature">
          <LicensedPhoto photo="shakespeare" sizes="(max-width:760px) 92vw, 55vw"/>
          <div className="pd-lead-copy"><p className="ew-eyebrow">Film → Place</p><h3>{film.title}<span>at {bookshop.title}</span></h3><p>{bookshop.summary}</p>{connection&&<ConnectionReason connection={connection} catalog={catalog}/>}
            <div className="pd-feature-links"><Link className="ew-button" to={`/discover/work/${film.id}`}>Explore the film →</Link><Link to={entityHref(bookshop)}>Explore the bookshop ↗</Link><SaveWork id={film.id} title={film.title}/></div>
            <aside className="pd-today"><p className="ew-eyebrow">From the story archive · {day}</p><h4><Link to={entityHref(story)}>{story.title} →</Link></h4><p>{story.summary}</p><span className="ew-small">{readingMinutes(story)} min read · A rotating editorial selection</span></aside>
          </div>
        </article>}
      </section>
      <ParisAudio catalog={catalog}/>
      <BatchHighlights catalog={catalog}/>
      {baldwin&&novel&&<section className="pd-section" aria-labelledby="paris-writer-heading"><div className="pd-section-heading"><div><p className="ew-eyebrow">A writer and his work</p><h2 id="paris-writer-heading">James Baldwin’s Paris</h2></div></div>
        <article className="pd-writer-feature"><LicensedPhoto photo="baldwin" sizes="(max-width:600px) 92vw, 28vw"/><div className="pd-writer-copy"><h3><Link to={entityHref(baldwin)}>{baldwin.title}</Link></h3><p>{baldwin.summary}</p><Link to={entityHref(baldwin)}>Explore the writer →</Link><PersonalActions entity={baldwin} catalog={catalog} showActivity={false}/></div><div className="pd-novel"><Link className="pd-novel-cover" to={`/discover/work/${novel.id}`} aria-label={`Explore ${novel.title}`}><WorkCover work={novel}/></Link><h3><Link to={`/discover/work/${novel.id}`}>{novel.title}</Link></h3><p>{novel.description}</p><SaveWork id={novel.id} title={novel.title}/></div></article>
      </section>}
      {collection&&<section className="pd-section" aria-labelledby="paris-guide-heading"><div className="pd-section-heading"><h2 id="paris-guide-heading">Literary Paris</h2><Link to={`${PARIS_ROOT}/collections`}>Free collections ↗</Link></div><article className="pd-guide-feature"><ArchivePhoto photo="cafe" sizes="(max-width:760px) 92vw, 40vw"/><div><p className="ew-eyebrow">A free editorial guide</p><h3>{collection.title}</h3><p>{collection.summary}</p><div className="pd-feature-links"><Link className="ew-button" to={entityHref(collection)}>Explore the collection →</Link><PersonalActions entity={collection} catalog={catalog} showActivity={false}/></div><p className="ew-small">Another way in: <Link to={`${PARIS_ROOT}/themes/city-in-conversation`}>A city in conversation ↗</Link></p></div></article></section>}
      <section className="pd-section" aria-labelledby="paris-archive-heading"><div className="pd-section-heading"><div><p className="ew-eyebrow">Personally photographed</p><h2 id="paris-archive-heading">From the Paris archive</h2></div><Link to="/paris/archive">Explore all photographs ↗</Link></div><div className="pd-archive-strip">{(['notredame','garden','sunset'] as const).map(photo=><ArchivePhoto key={photo} photo={photo} sizes="(max-width:600px) 92vw, 30vw"/>)}</div></section>
      <section className="pd-atlas-invite"><div><p className="ew-eyebrow">Saved on this device</p><h2>Keep the connections that stay with you.</h2><p>Your saved discoveries and trails, together in your Paris atlas.</p></div><Link className="ew-button" to={`${PARIS_ROOT}/atlas`}>Open my Paris atlas →</Link></section>
    </div>
  </div>;
}
export function ParisEntityPage(){
  const catalog=useOutletContext<CultureCatalog>(),{section,entityId}=useParams(),entities=entitiesFor(catalog),kind=({places:'place',people:'person',themes:'theme',stories:'story',collections:'collection'} as Record<string,string>)[section??''],entity=entities.find(e=>e.id===`${kind}:${entityId}`);
  if(!entity)return <ParisMissing/>;
  return <ParisEntityContent entity={entity} catalog={catalog}/>;
}
function ParisEntityContent({entity,catalog}:{entity:DiscoveryEntity;catalog:CultureCatalog}){
  const place=placeFor(entity),pins=useMemo(()=>place?[place]:[],[place]),entities=entitiesFor(catalog);
  return <div className="pd"><div className="ew-width pd-body"><ParisNav/><PersonalNotice/><header className="pd-entity-header"><div><p className="ew-eyebrow">Paris / {entity.kind}{entity.kind==='story'?` · ${readingMinutes(entity)} min read`:''}</p><h1>{entity.title}</h1><p className="ew-lede">{entity.summary}</p><PersonalActions entity={entity} catalog={catalog}/><p className="ew-small">Saved on this device</p></div><EntityArt entity={entity} catalog={catalog}/></header>
    <div className="pd-editorial-layout"><section className="pd-panel pd-prose"><h2>{entity.kind==='story'?'A closer look':entity.kind==='collection'?'An invitation to explore':'The story behind it'}</h2>{(entity.paragraphs??[entity.summary]).map((p,i)=><p key={i}>{p}</p>)}<Evidence ids={entity.sourceIds} catalog={catalog}/>{entity.kind==='place'&&<p><Link to="/paris/archive">Explore the original Paris archive ↗</Link></p>}{entity.id==='place:shakespeare'&&<p><a href="https://www.shakespeareandcompany.com" target="_blank" rel="noreferrer">Visit the official bookshop site for current visitor information ↗</a></p>}</section>{place&&<section className="pd-panel"><h2>Find the place</h2><p>{place.name} · {place.area}</p><ParisPlaceMap places={pins} selected={place.id} onSelect={()=>{}}/><p className="ew-small">Catalog reference point. No walking route or exact camera position is implied.</p></section>}</div>
    {entity.members&&<section className="pd-section"><p className="ew-eyebrow">Free editorial guide · {entity.members.length} starting points</p><h2>Inside this collection</h2><ol className="pd-collection-list">{entity.members.map((id,i)=>{const item=entities.find(e=>e.id===id)!;return <li key={id}><span>{i+1}</span><div><p className="ew-eyebrow">{item.kind}</p><h3><Link to={entityHref(item)}>{item.title}</Link></h3><p>{item.summary}</p><Link to={trailHref([item.id])}>Start a trail here →</Link></div><PersonalActions entity={item} catalog={catalog}/></li>;})}</ol><p className="ew-small">A reading order, not a walking route. Saving this guide does not save each item or track your progress.</p></section>}
    {entity.kind!=='collection'&&<ParisConnections root={entity.id} catalog={catalog}/>}
  </div></div>;
}
export function ParisIndexPage(){const catalog=useOutletContext<CultureCatalog>(),{section}=useParams();if(!['stories','collections'].includes(section??''))return <ParisMissing/>;return <div className="pd ew-width pd-body"><ParisNav/><PersonalNotice/><p className="ew-eyebrow">Paris / {section}</p><h1>{section==='stories'?'One place. Another perspective.':'A few ways into the city.'}</h1><p className="ew-lede">{section==='stories'?'Short editorial stories and viewing prompts. Revisit any story, any day.':'Free guides to follow at your own pace. No progress score, just possibilities.'}</p><div className="pd-cards pd-three">{entitiesFor(catalog).filter(e=>e.kind===(section==='stories'?'story':'collection')).map(entity=><EntityCard key={entity.id} entity={entity} catalog={catalog}/>)}</div></div>;}
export function ParisTrailPage(){
  const catalog=useOutletContext<CultureCatalog>(),entities=entitiesFor(catalog),[params,setParams]=useSearchParams(),personal=useParisPersonal(),[title,setTitle]=useState('My Paris discoveries'),focus=useRef<HTMLHeadingElement>(null),previous=useRef('');
  let path:string[]=[],error='';try{path=parseTrail(params.get('path'),entities);}catch(e){error=(e as Error).message;}
  const rawStep=Number(params.get('step')??path.length-1),step=Number.isInteger(rawStep)&&rawStep>=0&&rawStep<path.length?rawStep:path.length-1,current=entities.find(e=>e.id===path[step]),signature=`${path.join(',')}/${step}`;
  const savedTitle=personal.data.trails.find(t=>t.path.join(',')===path.join(','))?.title;
  useEffect(()=>{setTitle(savedTitle??'My Paris discoveries');},[savedTitle]);
  useEffect(()=>{if(previous.current&&previous.current!==signature)focus.current?.focus({preventScroll:true});previous.current=signature;},[signature]);
  const follow=(next:string)=>{const branch=branchTrail(path,step,next);setParams({path:branch.join(',')},{preventScrollReset:true});};
  const save=()=>{const now=new Date().toISOString();void personal.edit(d=>{const existing=d.trails.find(t=>t.path.join(',')===path.join(','));return {...d,trails:[...d.trails.filter(t=>t.id!==existing?.id),{id:existing?.id??crypto.randomUUID(),title:title.trim()||'My Paris discoveries',path,at:now}]};});};
  return <div className="pd ew-width pd-body"><ParisNav/><PersonalNotice/><p className="ew-eyebrow">Follow the connections</p><h1>Your discovery trail.</h1><p className="ew-lede">One story opens another. Follow the path, or branch in a new direction.</p>{error&&<p className="ew-notice" role="alert">{error} <Link to={trailHref(['work:before-sunset'])}>Start again with Before Sunset</Link></p>}{!path.length&&!error&&<p className="pd-panel">Choose a starting point. <Link to={trailHref(['work:before-sunset'])}>Begin with Before Sunset →</Link></p>}
    {path.length>0&&<div className="pd-trail-layout"><ol className="pd-trail">{path.map((id,i)=>{const entity=entities.find(e=>e.id===id)!,reason=i?connectionBetween(path[i-1],id):undefined;return <li key={`${i}-${id}`} className={i===step?'is-current':''}><span className="pd-step">{i+1}</span><div>{reason&&<ConnectionReason connection={reason} catalog={catalog}/>}<p className="ew-eyebrow">{entity.kind}</p><h2><Link to={entityHref(entity)}>{entity.title}</Link></h2><p>{entity.summary}</p><button aria-pressed={i===step} onClick={()=>{const next=new URLSearchParams(params);next.set('step',String(i));setParams(next,{preventScrollReset:true});}}>Continue from here</button></div></li>;})}</ol><section className="pd-panel"><h2 tabIndex={-1} ref={focus}>Where next?</h2><p>From {current?.title}. Choosing a connection replaces steps after this point.</p>{step>=23?<p>This trail has reached 24 steps. Save it, then begin another.</p>:<ul className="pd-next">{neighbors(current!.id).map(({id,connection})=><li key={connection.id}><button onClick={()=>follow(id)}>{entities.find(e=>e.id===id)?.title} →</button><ConnectionReason connection={connection} catalog={catalog}/></li>)}</ul>}{!neighbors(current!.id).length&&<p>No reviewed connections yet. <Link to={PARIS_ROOT}>Choose another starting point</Link>.</p>}<form onSubmit={e=>{e.preventDefault();save();}}><label>Name your trail<input value={title} onChange={e=>setTitle(e.target.value)} maxLength={120} required/></label><button className="ew-button" disabled={personal.busy}>Save this trail</button></form><p className="ew-small">Saved on this device. This does not create a trip.</p><Link to={`${PARIS_ROOT}/atlas`}>View saved trails ↗</Link></section></div>}
    <section className="pd-section"><h2>Saved discovery trails</h2>{personal.data.trails.length?<ul className="pd-saved-trails">{personal.data.trails.map(t=><li key={t.id}><Link to={trailHref(t.path)}>{t.title}</Link><span>{t.path.length} steps</span><button disabled={personal.busy} onClick={()=>void personal.edit(d=>({...d,trails:d.trails.filter(x=>x.id!==t.id)}))}>Delete {t.title}</button></li>)}</ul>:<p>Your saved trails will appear here.</p>}</section>
  </div>;
}
export function ParisMissing(){return <div className="pd ew-width pd-body"><ParisNav/><h1>This connection is unavailable.</h1><p>Your saved items are kept. Choose another starting point.</p><Link className="ew-button" to={PARIS_ROOT}>Explore Paris →</Link></div>;}
// Used by the atlas to include existing work bookmarks without copying or migrating their key.
export function useParisSavedIds(){const shelf=useShelf(),personal=useParisPersonal();return [...new Set([...shelf.ids.map(id=>`work:${id}`),...personal.data.saved.map(s=>s.id)])];}

function BatchHighlights({catalog}:{catalog:CultureCatalog}) {
 const ids=['the-belly-of-paris','paris-13th-district','call-my-agent','paname-slimane','the-seine-past-and-present'];
 const works=ids.flatMap(id=>catalog.works.filter(w=>w.id===id));
 if(!works.length)return null;
 return <section className="pd-section" aria-labelledby="more-discover-title"><div className="pd-section-heading"><div><p className="ew-eyebrow">Books, screens and sound</p><h2 id="more-discover-title">More to discover</h2></div><Link to="/discover/browse?destination=paris">All Paris works ↗</Link></div><div className="pd-batch-grid">{works.map(work=><article key={work.id}><Link className="pd-batch-art" to={`/discover/work/${work.id}`} aria-label={`Explore ${work.title}`}><WorkCover work={work}/></Link><p className="ew-eyebrow">{formatLabel(work.kind)}</p><h3><Link to={`/discover/work/${work.id}`}>{work.title}</Link></h3><p>{work.description}</p><SaveWork id={work.id} title={work.title}/></article>)}</div></section>;
}
