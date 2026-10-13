import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useOutletContext, useSearchParams } from 'react-router-dom';
import { PARIS } from '../../cities/paris';
import { archiveDay, archivePlace, parisArchiveItems, type ParisArchiveItem } from '../../lib/paris-archive';
import { mediaUrl } from '../../lib/media';
import { responsiveImage } from '../../lib/responsive-media';
import { entitiesFor, entityHref, neighbors } from '../../lib/culture/paris-discovery';
import type { CultureCatalog } from '../../lib/culture/schema';
import { ArchivePhoto } from './ArchivePhoto';
import { ParisPlaceMap } from './ParisPlaceMap';
import '../../styles/elsewhere-archive.css';

function ArchiveImage({ item, large = false }: { item: ParisArchiveItem; large?: boolean }) {
  const [failed, setFailed] = useState(false);
  const src = item.image ? mediaUrl('paris', item.image) : undefined;
  const responsive = responsiveImage(src);
  if (!src || failed) return <div className="pa-missing">{item.video ? 'Original video · open to watch' : 'Photograph unavailable'}<span>{item.place.name}</span></div>;
  return <img {...responsive} src={responsive?.src ?? src} alt={`${item.caption} · ${item.place.name}`} sizes={large ? '(max-width: 900px) 94vw, 70vw' : '(max-width: 600px) 94vw, (max-width: 1000px) 46vw, 30vw'} loading={large ? 'eager' : 'lazy'} onError={() => setFailed(true)} />;
}
export function ParisArchive() {
  const catalog = useOutletContext<CultureCatalog>();
  const [params, setParams] = useSearchParams();
  const resultHeading = useRef<HTMLHeadingElement>(null), previousSelection = useRef('');
  const heading = useRef<HTMLHeadingElement>(null), previousPhoto = useRef<string | null>(null);
  const view = params.get('view') === 'map' ? 'map' : 'gallery';
  const hood = params.get('hood') ?? '', kind = params.get('media') ?? '';
  const photoId = params.get('photo'), selected = parisArchiveItems.find(item => item.id === photoId);
  const selectedPlace = archivePlace(params.get('place'));
  const items = parisArchiveItems.filter(item => (!hood || item.place.hood === hood) && (!kind || (kind === 'video' ? !!item.video : kind === 'photo' ? !item.video : false)));
  const rawPage = Number(params.get('page') ?? 1);
  const places = PARIS.places.filter(place => !hood || place.hood === hood);
  const total = view === 'gallery' ? items.length : places.length, pageSize = view === 'gallery' ? 24 : 12;
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const page = Number.isInteger(rawPage) && rawPage > 0 ? Math.min(rawPage, pages) : 1;
  const shown = items.slice((page - 1) * pageSize, page * pageSize);
  const mapPlaces = useMemo(() => places.slice((page - 1) * pageSize, page * pageSize), [hood, page, pageSize]);
  const set = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    value ? next.set(key, value) : next.delete(key);
    if (key !== 'photo') next.delete('photo');
    if (!['page', 'photo', 'place'].includes(key)) next.delete('page');
    setParams(next, { preventScrollReset: true });
  };
  useEffect(() => {
    if (photoId) heading.current?.focus();
    else if (previousPhoto.current) document.getElementById(`archive-${previousPhoto.current}`)?.focus();
    previousPhoto.current = photoId;
  }, [photoId]);
  const selection = `${view}/${hood}/${kind}/${page}`;
  useEffect(() => {
    if (previousSelection.current && previousSelection.current !== selection) resultHeading.current?.focus();
    previousSelection.current = selection;
  }, [selection]);
  const entities = entitiesFor(catalog);
  const selectedPlaceEntity = selectedPlace && entities.find(entity => entity.placeId === selectedPlace.id);
  const placeEntity = selected && entities.find(entity => entity.placeId === selected.place.id);
  const connections = placeEntity ? neighbors(placeEntity.id).map(({ id }) => entities.find(entity => entity.id === id)!).filter(Boolean) : [];
  const closePhoto = () => { const next = new URLSearchParams(params); next.delete('photo'); setParams(next, { preventScrollReset: true }); };
  const photoLink = (id: string) => { const next = new URLSearchParams(params); next.set('photo', id); return `?${next}`; };
  return <div className="pa">
    {!selected && <header className="pa-intro ew-width"><div><Link className="ew-eyebrow" to="/discover/place/paris">Paris / The travel archive</Link><h1>Paris, through <br/><em>our lens.</em></h1><p>Along the river. Around the corner. In the everyday.<br/>Explore the city through original photographs and film.</p></div><ArchivePhoto photo="cafe" eager sizes="(max-width: 760px) 94vw, 55vw" /></header>}
    <div className="ew-width pa-body">
      {selected ? <section aria-label="Archive detail" className="pa-detail"><button className="pa-back" onClick={closePhoto}>← Back to {view}</button><p className="ew-eyebrow">Original {selected.video ? 'video' : 'photography'}{selected.date ? ` · ${selected.date}` : ''}</p><h1 ref={heading} tabIndex={-1}>{selected.place.name}</h1><p>{selected.caption} · {selected.place.hood}</p><div className="pa-viewer">{selected.video ? <video key={selected.id} controls playsInline preload="metadata" poster={selected.image ? mediaUrl('paris', selected.image) : undefined} src={mediaUrl('paris', selected.video)}><a href={mediaUrl('paris', selected.video)}>Open original video</a></video> : <ArchiveImage key={selected.id} item={selected} large/>}</div><div className="pa-detail-links"><a href={`https://www.google.com/maps/search/?api=1&query=${selected.place.lat},${selected.place.lon}`} target="_blank" rel="noreferrer">Find this place on a map ↗</a>{archiveDay(selected.place.id) && <Link to={`/paris/itinerary/${archiveDay(selected.place.id)}`}>View archive day {archiveDay(selected.place.id)} ↗</Link>}{placeEntity && <Link to={entityHref(placeEntity)}>The story of this place →</Link>}</div><p className="ew-small">Location refers to the catalog place, not the exact camera position.</p>{connections.length > 0 && <section><h2>Follow a cultural connection</h2><div className="pa-detail-links">{connections.map(entity => <Link key={entity.id} to={entityHref(entity)}>{entity.title} →</Link>)}</div></section>}<h2>More from this place</h2><div className="pa-grid">{parisArchiveItems.filter(item => item.place.id === selected.place.id && item.id !== selected.id).map(item => <PhotoCard key={item.id} item={item} href={photoLink(item.id)}/>)}</div>{parisArchiveItems.filter(item => item.place.id === selected.place.id).length === 1 && <p>This is the only mapped image or video for this place so far.</p>}</section> : <>
        {photoId && <p role="status" className="ew-notice">That photograph is unavailable. Explore the archive below.</p>}
        <div className="pa-toolbar"><div className="pa-tabs" aria-label="Archive view">{['gallery', 'map'].map(value => <button key={value} aria-pressed={view === value} onClick={() => set('view', value)}>{value === 'gallery' ? 'Gallery' : 'Map & places'}</button>)}</div><label>Neighborhood<select value={hood} onChange={event => set('hood', event.target.value)}><option value="">All neighborhoods</option>{[...new Set(PARIS.places.map(place => place.hood))].map(value => <option key={value}>{value}</option>)}{hood && !PARIS.places.some(place => place.hood === hood) && <option value={hood}>Unknown neighborhood</option>}</select></label>{view === 'gallery' && <label>Show<select value={kind} onChange={event => set('media', event.target.value)}><option value="">Photos & videos</option><option value="photo">Photos</option><option value="video">Videos</option>{kind && !['photo','video'].includes(kind) && <option value={kind}>Unknown media type</option>}</select></label>}</div>
        {selectedPlace && <aside className="pa-place-note"><h2>{selectedPlace.name}</h2><p>{selectedPlace.hood} · {parisArchiveItems.some(item => item.place.id === selectedPlace.id) ? 'Original media in the archive' : 'Researched place · no mapped original photography'}</p>{parisArchiveItems.filter(item => item.place.id === selectedPlace.id).slice(0,1).map(item => <Link key={item.id} to={photoLink(item.id)}>Explore photographs & video →</Link>)}{archiveDay(selectedPlace.id) && <Link to={`/paris/itinerary/${archiveDay(selectedPlace.id)}`}>View archive day {archiveDay(selectedPlace.id)} ↗</Link>}<a href={`https://www.google.com/maps/search/?api=1&query=${selectedPlace.lat},${selectedPlace.lon}`} target="_blank" rel="noreferrer">Open map ↗</a>{selectedPlaceEntity && <Link to={entityHref(selectedPlaceEntity)}>Explore this place’s story →</Link>}<button onClick={() => set('place','')}>Close place</button></aside>}
        <div className="pa-section-heading"><h2 ref={resultHeading} tabIndex={-1}>{view === 'gallery' ? 'Moments from Paris' : 'Find your way around'}</h2><p role="status">{total} {view === 'gallery' ? 'original photos & videos' : 'catalog places'}{pages > 1 ? ` · page ${page} of ${pages}` : ''}</p></div>
        {view === 'gallery' ? <div className="pa-grid">{shown.map(item => <PhotoCard key={item.id} item={item} href={photoLink(item.id)}/>)}</div> : mapPlaces.length > 0 && <div className="pa-map-layout"><div><ParisPlaceMap places={mapPlaces} selected={selectedPlace?.id ?? ''} onSelect={id => set('place',id)}/><p className="ew-small">Showing the {mapPlaces.length} places listed on this page. Choose a neighborhood to explore a smaller area.</p></div><ol start={(page-1)*pageSize+1}>{mapPlaces.map((place,index) => <li key={place.id}><button aria-pressed={selectedPlace?.id===place.id} onClick={() => set('place',place.id)}><span>{index+1}</span><strong>{place.name}</strong></button><p>{place.hood}<br/>{parisArchiveItems.some(item => item.place.id===place.id) ? 'Original media' : 'Researched place'}</p></li>)}</ol></div>}
        {!total && <p className="pa-place-note">No items in this selection. <button onClick={() => setParams({view}, {preventScrollReset:true})}>Show all neighborhoods</button></p>}
        {pages > 1 && <nav className="pa-pagination" aria-label="Archive pages"><button disabled={page===1} onClick={() => set('page',String(page-1))}>← Previous</button><span>{page} / {pages}</span><button disabled={page===pages} onClick={() => set('page',String(page+1))}>Next →</button></nav>}
        <details className="pa-days"><summary>Explore the original archive days</summary><p>The original day groupings remain available in Copy My Trip.</p><div className="pa-detail-links">{[...new Set(PARIS.nodes.flatMap(node => node.day ? [node.day] : []))].sort().map(day => <Link key={day} to={`/paris/itinerary/${day}`}>Archive day {day} ↗</Link>)}</div></details>
      </>}
    </div>
  </div>;
}
function PhotoCard({item, href}: {item: ParisArchiveItem; href: string}) {
  return <article className="pa-card"><Link id={`archive-${item.id}`} to={href} preventScrollReset aria-label={`Open ${item.caption}, ${item.place.name}`}><div className="pa-card-image"><ArchiveImage item={item}/>{item.video && <span className="pa-video-badge">▶ Video</span>}</div><h3>{item.place.name}</h3><p>{item.caption}</p><small>{item.place.hood}{item.date ? ` · ${item.date}` : ''}</small></Link></article>;
}
