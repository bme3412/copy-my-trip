import { useRef, useState } from 'react';
import { Form, Link, useLocation } from 'react-router-dom';
import { PARIS_ROOT } from '../../lib/culture/paris-discovery';
import { parisBrowse, parisFormats } from '../../lib/culture/paris-overview';
import { useShelf } from './ShelfContext';

function ParisLinks({onNavigate}:{onNavigate?:()=>void}) {
  return <nav aria-label="Paris sections" onClick={onNavigate}>
    <Link className="po-current" aria-current="page" to={PARIS_ROOT}>Overview</Link>
    {parisFormats.map(([label,kind])=><Link key={kind} to={parisBrowse(kind)}>{label}</Link>)}
    <Link to={`${PARIS_ROOT}#paris-places`}>Places</Link><Link to={`${PARIS_ROOT}#paris-writer-heading`}>People</Link>
    <Link className="po-atlas-link" to={`${PARIS_ROOT}/atlas`}>My Paris atlas ↗</Link>
  </nav>;
}
export function ParisOverviewNavigation() {
  const [open,setOpen] = useState(false), toggle=useRef<HTMLButtonElement>(null), location=useLocation();
  const shelf=useShelf();
  const close=()=>{setOpen(false);toggle.current?.focus();};
  return <>
    <aside className="po-sidebar"><Link className="ew-brand" to="/discover">Elsewhere</Link><p className="po-city">Paris</p><ParisLinks/><p className="po-device">Your discoveries.<br/>Saved on this device.</p></aside>
    <header className="po-topbar" onKeyDown={event=>{if(open&&event.key==='Escape'){event.preventDefault();close();}}}><div className="po-mobile-brand"><Link className="ew-brand" to="/discover">Elsewhere</Link><button ref={toggle} type="button" aria-expanded={open} aria-controls="po-paris-menu" onClick={()=>setOpen(v=>!v)}>Paris menu <span aria-hidden="true">{open?'−':'+'}</span></button></div>
      <nav aria-label="Elsewhere navigation"><Link to={parisBrowse()}>Explore</Link><Link to={`${PARIS_ROOT}/stories`}>Stories</Link><Link to="/paris/archive?view=map">Archive map</Link><Link to="/discover/saved">Saved <span className="ew-saved-count">{shelf.ids.length}</span></Link><Link to="/paris/saved">My trips ↗</Link></nav>
      <Form key={location.key} className="po-search" action="/discover/browse" method="get" role="search"><input type="hidden" name="destination" value="paris"/><label className="ew-sr-only" htmlFor="po-search">Search Paris titles, creators and summaries</label><input id="po-search" name="q" type="search" maxLength={120} placeholder="Search Paris…"/><button type="submit" aria-label="Search Paris">↗</button></Form>
    </header>
    <div id="po-paris-menu" className="po-mobile-menu" hidden={!open} onKeyDown={event=>{if(event.key==='Escape'){event.preventDefault();close();}}}><ParisLinks onNavigate={close}/></div>
  </>;
}
