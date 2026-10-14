import { useRef, useState } from 'react';
import { Form, Link, NavLink, useLocation } from 'react-router-dom';
import { PARIS_ROOT } from '../../lib/culture/paris-discovery';
import { parisSections } from '../../lib/culture/paris-overview';
import { useShelf } from './ShelfContext';

function ParisLinks({onNavigate}: {onNavigate?: () => void}) {
  return <nav aria-label="Paris sections" onClick={onNavigate}>
    {parisSections.map(([label, href]) => <NavLink key={href} end={href === PARIS_ROOT} to={href} className={({isActive}) => isActive ? 'po-current' : ''}>{label}</NavLink>)}
  </nav>;
}
export function ParisOverviewNavigation() {
  const [open, setOpen] = useState(false);
  const toggle = useRef<HTMLButtonElement>(null);
  const location = useLocation(), shelf = useShelf();
  const close = () => {setOpen(false); toggle.current?.focus();};
  return <>
    <header className="po-topbar" onKeyDown={event => {if (open && event.key === 'Escape') {event.preventDefault(); close();}}}>
      <Link className="ew-brand" to="/discover">Elsewhere<span aria-hidden="true">·</span></Link>
      <Form key={location.key} className="po-search" action="/discover/browse" method="get" role="search">
        <input type="hidden" name="destination" value="paris"/>
        <label className="ew-sr-only" htmlFor="po-search">Search Paris titles, creators and summaries</label>
        <input id="po-search" name="q" type="search" maxLength={120} defaultValue={new URLSearchParams(location.search).get('q') ?? ''} placeholder="Search Paris stories, books, cinema…"/>
        <button type="submit" aria-label="Search Paris">↗</button>
      </Form>
      <nav aria-label="Elsewhere navigation"><Link to="/paris/archive?view=map">Archive map</Link><Link to="/discover/saved">Saved <span className="ew-saved-count">{shelf.ids.length}</span></Link><Link to={PARIS_ROOT + '/collections'}>My collections ↗</Link></nav>
      <button className="po-menu-toggle" ref={toggle} type="button" aria-expanded={open} aria-controls="po-paris-menu" onClick={() => setOpen(value => !value)}>Paris menu {open ? '−' : '+'}</button>
    </header>
    <aside className="po-sidebar"><p className="po-destination-label">Current destination</p><p className="po-city">Paris</p><p className="po-region">France · Île-de-France</p><ParisLinks/><div className="po-field-note"><p>● Field note</p><span>Follow a story beyond the page. The next chapter might be a place.</span></div><p className="po-device">Your discoveries.<br/>Saved on this device.</p></aside>
    <div id="po-paris-menu" className="po-mobile-menu" hidden={!open} onKeyDown={event => {if(event.key === 'Escape') {event.preventDefault(); close();}}}><ParisLinks onNavigate={close}/></div>
  </>;
}
