import { MusicProvider } from '../src/pages/elsewhere/MusicPlayer';
import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { cultureCatalog } from '../src/lib/culture/seed';
import { overviewSelection, featuredParisIds, recentParisIds, parisBrowse, parisFormats, isParisOverview, isParisContext, parisCounts } from '../src/lib/culture/paris-overview';
import { validateArtwork, workArtwork, approvedArtwork } from '../src/lib/culture/artwork';
import { parisTrackIds } from '../src/lib/culture/audio-selection';
import { parseTrail, entityHref } from '../src/lib/culture/paris-discovery';
import { ParisOverview } from '../src/pages/elsewhere/ParisOverview';
import { ShelfProvider } from '../src/pages/elsewhere/ShelfContext';
import { ParisPersonalProvider } from '../src/pages/elsewhere/ParisPersonalContext';
import { WorkArtwork } from '../src/pages/elsewhere/WorkArtwork';
const selection=overviewSelection(cultureCatalog);
assert.equal(selection.featured.length,6);assert.equal(selection.recent.length,6);
assert.deepEqual(selection.featured.map(w=>w.id),featuredParisIds);assert.deepEqual(selection.recent.map(w=>w.id),recentParisIds);
assert.deepEqual(selection.tracks.map(w=>w.id),parisTrackIds);
assert.deepEqual(selection.places.map(p=>p.id),['shakespeare','couleeverte']);
assert(!selection.places.some(p=>p.id==='seine'));
for(const c of selection.connections)assert.deepEqual(parseTrail(`${c.from},${c.to}`,selection.entities),[c.from,c.to]);
for(const id of [...featuredParisIds,...recentParisIds,'paris-playlist'])assert.throws(()=>overviewSelection({...cultureCatalog,works:cultureCatalog.works.filter(w=>w.id!==id)}));
validateArtwork(cultureCatalog);assert.deepEqual(Object.keys(workArtwork).sort(),[...featuredParisIds].sort());
for(const id of featuredParisIds)assert.equal(approvedArtwork(id),undefined);
const artwork=structuredClone(workArtwork);artwork['before-sunset'].status='approved';assert.throws(()=>validateArtwork(cultureCatalog,artwork));
artwork['before-sunset']={...artwork['before-sunset'],src:'/culture/artwork/fixture.webp',alt:'Fixture film poster',permissionSource:'https://example.org/permission'};validateArtwork(cultureCatalog,artwork);
const pending=structuredClone(workArtwork);pending['before-sunset'].src='/culture/artwork/fixture.webp';assert.throws(()=>validateArtwork(cultureCatalog,pending));
assert.equal(renderToStaticMarkup(<WorkArtwork id="before-sunset"><span>Typography</span></WorkArtwork>),'<span>Typography</span>');
for(const route of ['/discover/place/paris','/discover/place/paris/'])assert(isParisOverview(route));
for(const route of ['/discover/browse','/discover/place/paris/atlas','/discover/place/paris/places/shakespeare','/paris/archive','/paris/itinerary/1'])assert(!isParisOverview(route));
for(const [,kind] of parisFormats){const u=new URL(parisBrowse(kind),'https://example.org');assert.equal(u.searchParams.get('destination'),'paris');assert.equal(u.searchParams.get('kind'),kind);}
const html=renderToStaticMarkup(<MemoryRouter><ShelfProvider><ParisPersonalProvider><MusicProvider works={cultureCatalog.works}><ParisOverview catalog={cultureCatalog}/></MusicProvider></ParisPersonalProvider></ShelfProvider></MemoryRouter>);
for(const anchor of ['paris-search','paris-feature-heading','more-discover-title','paris-places','paris-writer-heading','paris-guide-heading','paris-archive-heading'])assert(html.includes(`id="${anchor}"`));
for(const id of [...featuredParisIds,...recentParisIds,...parisTrackIds.slice(0,4)]) {
 const work=cultureCatalog.works.find(work=>work.id===id)!;
 if([...featuredParisIds,...recentParisIds].includes(id)) assert(html.includes(`aria-label="Preview ${work.title.replaceAll('&','&amp;').replaceAll("'",'&#x27;')}"`));
 else assert(html.includes(work.title.replaceAll("&","&amp;").replaceAll("'","&#x27;")));
}
for(const e of selection.entities.filter(e=>['place','person','collection'].includes(e.kind)))assert(html.includes(entityHref(e)));
assert.equal((html.match(/class="po-work /g)??[]).length,12);
assert(html.includes('8 tracks'));assert(!html.includes('Follow a connection'));assert(html.includes('Place positions · schematic'));
assert(html.includes('Listen with Spotify Premium, or choose YouTube.'));assert(html.includes('▶ Play on Spotify'));
assert.equal((html.match(/class="ew-spotify-play"/g)??[]).length,10);
assert.equal((html.match(/class="ew-youtube-play"/g)??[]).length,10);
for(const track of selection.tracks)assert(html.includes(`Play ${track.title.replaceAll('&','&amp;').replaceAll("'",'&#x27;')} on YouTube`));
console.log('Paris overview: curated IDs, reviewed connections, exact route scope, links, anchors, playlist, map pins and artwork gates passed.');

for(const route of ['/discover/place/paris','/discover/place/paris/atlas','/discover/place/paris/places/shakespeare','/discover/work/before-sunset'])assert(isParisContext(route,'',cultureCatalog));
assert(isParisContext('/discover/browse','?destination=paris&kind=film',cultureCatalog));
for(const route of ['/discover/saved','/discover/place/rome','/discover/work/the-great-beauty','/paris/archive','/discover/place/parisian'])assert(!isParisContext(route,'',cultureCatalog));
assert(!isParisContext('/discover/browse','?destination=rome',cultureCatalog));
assert(!isParisContext('/discover/work/unknown','',cultureCatalog));
const counts=parisCounts(cultureCatalog);
assert.equal(counts.total,cultureCatalog.works.filter(w=>w.destinationId==='paris').length);
assert.equal(counts.byKind.film,137);
assert(html.includes('Curated works'));
assert(html.includes('Explore Paris places'));

// The requested eight films lead the Films filter, including the three new entries.
import { priorityParisFilmIds, prioritizeParisFilms } from '../src/lib/culture/paris-overview';
const orderedFilms=prioritizeParisFilms(cultureCatalog.works.filter(w=>w.kind==='film'&&w.destinationId==='paris'));
assert.deepEqual(orderedFilms.slice(0,8).map(w=>w.id),priorityParisFilmIds);
assert.equal(orderedFilms.length,137);
assert.equal(new Set(orderedFilms.map(w=>w.id)).size,137);
assert.equal(cultureCatalog.works.find(w=>w.id==='film-mon-oncle-1958')?.geography?.area,'greater_paris');
assert.equal(cultureCatalog.works.filter(w=>w.kind==='film'&&w.title==='Les Misérables').length,3);
