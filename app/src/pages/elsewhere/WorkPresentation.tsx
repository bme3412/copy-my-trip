import { useState } from 'react';
import { bookCover } from '../../lib/culture/covers';
import { Link } from 'react-router-dom';
import type { CultureCatalog, CultureWork } from '../../lib/culture/schema';
import { SaveWork } from './ShelfContext';

export function WorkCover({work}:{work:CultureWork}) {
  const cover=bookCover(work);
  const [failed,setFailed]=useState<string>();
  const [loaded,setLoaded]=useState<string>();
  return <div aria-hidden="true" className={`ew-cover ew-cover-${work.id}${cover?' ew-cover-has-image':''}${cover&&failed!==cover.src&&loaded===cover.src?' ew-cover-image':''}`} >{cover&&failed!==cover.src&&<img src={cover.src} alt="" loading="lazy" decoding="async" referrerPolicy="no-referrer" style={{opacity:loaded===cover.src?1:0}} onLoad={()=>setLoaded(cover.src)} onError={()=>setFailed(cover.src)}/>}<span>{work.kind==='book'?'READ':'WATCH'} / {work.year}</span><strong>{work.title}</strong><em>{work.creator}</em></div>;
}
export function WorkList({works,hrefFor,selectedId}:{works:CultureWork[];hrefFor?:(id:string)=>string;selectedId?:string}) {
  return <div className="ew-work-list">{works.map(work=><article key={work.id} className={`ew-work ${selectedId===work.id?'is-selected':''}`}><WorkCover work={work}/><div className="ew-work-body"><p className="ew-eyebrow">{work.form} · {work.destinationId==='paris'?'Paris':'Rome'}</p><h3><Link id={`result-${work.id}`} to={hrefFor?.(work.id)??`/discover/work/${work.id}`} preventScrollReset={!!hrefFor} aria-current={selectedId===work.id?'true':undefined}>{work.title}</Link></h3><p className="ew-byline">{work.creator} · {work.year}</p><p>{work.description}</p><div className="ew-work-actions"><span className="ew-city-tag">{work.destinationId==='paris'?'Paris':'Rome'}</span><SaveWork id={work.id} title={work.title}/></div></div></article>)}</div>;
}
export function WorkDetails({work,catalog,embedded=false}:{work:CultureWork;catalog:CultureCatalog;embedded?:boolean}) {
  const destination=catalog.destinations.find(d=>d.id===work.destinationId)!;
  const Heading=embedded?'h3':'h1';
  const cover=bookCover(work);
  return <div className={embedded?'ew-work-content is-embedded':'ew-work-content'}><section className="ew-work-detail"><WorkCover work={work}/><div><p className="ew-eyebrow">{work.form} / {work.language}</p><Heading>{work.title}</Heading><p className="ew-detail-byline">{work.creator}</p><p className="ew-small">{work.yearLabel} {work.year}{work.edition&&<> · {work.edition}</>}</p><p className="ew-lede">{work.description}</p><SaveWork id={work.id} title={work.title}/><p className="ew-small">Your saved list stays on this device.</p>{embedded&&work.id==='before-sunset'&&<Link className="ew-link" to="/discover/work/before-sunset">Explore the film & Paris places ↗</Link>}</div></section><section className="ew-evidence"><div><p className="ew-eyebrow">The {destination.name} connection</p><h3>A story {work.relationship.type==='about'?'about':'set in'} {destination.name}.</h3><p>{work.relationship.statement}</p><p className="ew-small">Source-reported city setting. Neighborhoods and filming locations are not verified here. A curator’s immersion assessment has not yet been made.</p><Link className="ew-link" to={`/discover/place/${destination.id}`}>Explore {destination.name} ↗</Link></div><aside><h3>Follow the source</h3>{cover&&<p><a href={cover.source} target="_blank" rel="noreferrer">Cover service: Open Library ↗</a><small>Cover edition: {cover.edition}. Availability varies; a typographic cover is shown when unavailable.</small></p>}{work.sourceIds.map(id=>{const source=catalog.sources.find(s=>s.id===id)!;return <p key={id}><a href={source.url} target="_blank" rel="noreferrer">{source.title} ↗<span className="ew-sr-only"> (opens in a new tab)</span></a><small>Source checked {source.checkedAt}</small></p>;})}<p className="ew-small">Links are for further reading. No streaming or purchase availability is promised.</p></aside></section></div>;
}
