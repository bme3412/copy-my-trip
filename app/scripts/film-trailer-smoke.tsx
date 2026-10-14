import assert from 'node:assert/strict';
import {renderToStaticMarkup} from 'react-dom/server';
import {cultureCatalog} from '../src/lib/culture/seed';
import {filmTrailers,filmTrailer} from '../src/lib/culture/film-trailers';
import {FilmTrailer} from '../src/pages/elsewhere/FilmTrailer';
import {WorkCover} from '../src/pages/elsewhere/WorkPresentation';
const films=cultureCatalog.works.filter(work=>work.kind==='film');
for(const id of Object.keys(filmTrailers))assert(films.some(film=>film.id===id));
for(const film of films){
 const trailer=filmTrailer(film.id);
 if(!trailer){assert.equal(renderToStaticMarkup(<FilmTrailer work={film}/>),'');continue;}
 assert.match(trailer.videoId,/^[\w-]{11}$/);
 assert.equal(new URL(trailer.url).searchParams.get('v'),trailer.videoId);
 assert.equal(new URL(trailer.thumbnail).hostname,'i.ytimg.com');
 assert(trailer.thumbnail.includes('/vi/'+trailer.videoId+'/'));
 const html=renderToStaticMarkup(<FilmTrailer work={film}/>);
 assert(html.includes('Watch trailer on YouTube'));
 assert(html.includes(trailer.thumbnail));
 assert(!html.includes('<iframe'),'Players must load only after a click');
 assert(renderToStaticMarkup(<WorkCover work={film}/>).includes(trailer.thumbnail));
}
assert.equal(filmTrailer('toString'),undefined);
assert.equal(renderToStaticMarkup(<FilmTrailer work={cultureCatalog.works.find(work=>work.kind==='book')!}/>),'');
console.log('Film trailers: all '+films.length+' catalog films checked; available trailers matched; thumbnail/video identity, click-to-load and non-film exclusion passed.');
