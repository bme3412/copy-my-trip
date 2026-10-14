import assert from 'node:assert/strict';
import { bookCover } from '../src/lib/culture/covers';
import { cultureCatalog } from '../src/lib/culture/seed';
import { parseCatalog, queryCatalog, validatePlaylistTracks } from '../src/lib/culture/schema';
import { parseShelf, SHELF_KEY, writeBookmark } from '../src/lib/culture/shelf';
import handler from '../api/catalog';
import baseline from '../../editorial/paris-atlas-120/existing-catalog.json';
const previous=parseCatalog(baseline);
const previousIds=new Set(previous.works.map(w=>w.id));
const clone=()=>JSON.parse(JSON.stringify(cultureCatalog));
assert.equal(parseCatalog(clone()).works.length,504);
const cases=[
  [{destination:'paris',kind:'book'},['the-only-street-in-paris','the-seine','paris-paris','the-other-paris','impossible-city','a-waiter-in-paris','the-flaneur','the-most-beautiful-walk-in-the-world','the-new-paris','my-paris-dream','the-sweet-life-in-paris','pancakes-in-paris','giovannis-room']],
  [{destination:'rome',kind:'film'},['the-great-beauty']],
  [{q:'Agnes'},['cleo-from-5-to-7']],
  [{q:'Lahiri'},['roman-stories']],
  [{q:'Berlin'},[]],
  [{destination:'lisbon'},[]],
  [{q:'Paris Rome'},[]],
] as const;
for(const [query,expected] of cases)assert.deepEqual(queryCatalog(cultureCatalog,query).filter(w=>previousIds.has(w.id)).map(w=>w.id),expected);
for(const mutate of [
  (c:any)=>c.works.push(c.works[0]),
  (c:any)=>c.works[0].sourceIds=['missing'],
  (c:any)=>c.sources[0].url='javascript:alert(1)',
  (c:any)=>c.works[0].relationship.type='filmed_at',
  (c:any)=>c.works[0].relationship.scope='neighborhood',
  (c:any)=>c.works[0].immersion='inhabit_city',
  (c:any)=>c.works[0].relationship.review='curator_approved',
  (c:any)=>c.works[0].privateGps=[1,2],
  (c:any)=>c.sources[0].rawPayload='unlicensed content',
]){const c=clone();mutate(c);assert.throws(()=>parseCatalog(c));}
assert.equal(cultureCatalog.works.filter(w=>w.id==='cleo-from-5-to-7').length,1);
assert.equal(cultureCatalog.works.find(w=>w.id==='the-flaneur')?.yearLabel,'Cited edition');
assert.ok(!cultureCatalog.works.some(w=>['the-intouchables','paris-je-taime'].includes(w.id)));
const missingEdition=clone();delete missingEdition.works[0].edition;assert.throws(()=>parseCatalog(missingEdition));
assert.ok(cultureCatalog.works.filter(w=>bookCover(w)).length>=14);
for(const work of cultureCatalog.works){const cover=bookCover(work);if(work.kind==='film')assert.equal(cover,undefined);if(cover){if(cover.isbn)assert.match(cover.isbn,/^\d{13}$/);assert.equal(new URL(cover.src).hostname,'covers.openlibrary.org');assert.ok(cover.src.endsWith('?default=false'));}}
const memory=new Map<string,string>([['cmt-local-companion-v1','do not touch']]);
const storage={getItem:(k:string)=>memory.get(k)??null,setItem:(k:string,v:string)=>{memory.set(k,v);}};
writeBookmark(storage,'giovannis-room',true);writeBookmark(storage,'giovannis-room',true);
assert.deepEqual(parseShelf(memory.get(SHELF_KEY)!).workIds,['giovannis-room']);
writeBookmark(storage,'roman-stories',true);writeBookmark(storage,'giovannis-room',false);
assert.deepEqual(parseShelf(memory.get(SHELF_KEY)!).workIds,['roman-stories']);
assert.equal(memory.get('cmt-local-companion-v1'),'do not touch');
for(const raw of ['{broken','{"schemaVersion":2,"workIds":[]}','{"schemaVersion":1,"workIds":["x","x"]}']){memory.set(SHELF_KEY,raw);assert.throws(()=>writeBookmark(storage,'roman-stories',true));assert.equal(memory.get(SHELF_KEY),raw);}
assert.throws(()=>writeBookmark({getItem:()=>null,setItem:()=>{throw Error('quota');}},'roman-stories',true));
let reads=0;assert.throws(()=>writeBookmark({getItem:()=>++reads===1?null:'{"schemaVersion":1,"workIds":["other"]}',setItem:()=>assert.fail()},'roman-stories',true));
const response=(method:string,query:Record<string,unknown>)=>{let status=0,body:any;handler({method,query},{setHeader(){},status:s=>({json:b=>{status=s;body=b;}})});return{status,body};};
assert.equal(response('POST',{}).status,405);assert.equal(response('GET',{id:'missing'}).status,404);
assert.equal(response('GET',{kind:['book','film']}).status,400);assert.equal(response('GET',{private:'true'}).status,400);
assert.equal(response('GET',{destination:'berlin'}).status,400);
const result=response('GET',{id:'roman-stories'});assert.equal(result.status,200);assert.equal(parseCatalog(result.body).works[0].id,'roman-stories');
assert.equal(response('GET',{q:'no-such-title-xyz'}).body.works.length,0);
assert.equal(cultureCatalog.destinations.find(d=>d.id==='rome')?.archive,'none');
console.log('PASS culture: 7 golden queries; source/scope/rights validation; API success/error contracts; persisted idempotent bookmarks, corrupt/quota/conflict recovery and trip isolation');

// Audio contract, backward compatibility, filtered envelopes and playlist integrity.
const legacy=JSON.parse(JSON.stringify(previous));legacy.schemaVersion=1;legacy.works=legacy.works.filter((w:any)=>['book','film'].includes(w.kind));
assert.equal(parseCatalog(legacy).works.length,21);
const audioInLegacy=clone();audioInLegacy.schemaVersion=1;assert.throws(()=>parseCatalog(audioInLegacy));
assert.equal(queryCatalog(cultureCatalog,{destination:'paris',kind:'song'}).length,160);
assert.equal(queryCatalog(cultureCatalog,{destination:'paris',kind:'podcast_episode'}).length,46);
assert.equal(queryCatalog(cultureCatalog,{q:'earful tower'}).length,6);
assert.equal(queryCatalog(cultureCatalog,{q:'Gregory'}).at(0)?.id,'carving-paris');
assert.equal(queryCatalog(cultureCatalog,{destination:'rome',kind:'song'}).length,0);
assert.equal(queryCatalog(cultureCatalog,{q:'Edith Piaf'}).at(0)?.id,'sous-le-ciel-de-paris');
for(const kind of ['song','playlist','podcast_episode'])assert.equal(response('GET',{kind}).status,200);
assert.equal(response('GET',{kind:'album'}).status,400);
assert.equal(parseCatalog(response('GET',{id:'paris-playlist'}).body).works[0].tracks?.length,8);
validatePlaylistTracks(cultureCatalog);
for(const mutate of [
 (c:any)=>c.works.find((w:any)=>w.kind==='playlist').tracks.push('absent'),
 (c:any)=>c.works.find((w:any)=>w.kind==='playlist').tracks.push('roman-stories'),
 (c:any)=>c.works.find((w:any)=>w.kind==='playlist').tracks.push('paris-playlist'),
]){const c=clone();mutate(c);assert.throws(()=>validatePlaylistTracks(c));}
for(const mutate of [
 (c:any)=>c.works.find((w:any)=>w.kind==='playlist').tracks.push('la-seine'),
 (c:any)=>c.works.find((w:any)=>w.kind==='song').durationSeconds=-1,
 (c:any)=>c.works.find((w:any)=>w.kind==='song').listeningLinks[0].url='javascript:bad',
 (c:any)=>c.works.find((w:any)=>w.kind==='song').listeningLinks[0].sourceId='absent',
 (c:any)=>c.works.find((w:any)=>w.kind==='podcast_episode').publishedOn='2020-02-31',
 (c:any)=>delete c.works.find((w:any)=>w.kind==='podcast_episode').podcast,
]){const c=clone();mutate(c);assert.throws(()=>parseCatalog(c));}
const saves=new Map<string,string>([['saved-trips','unchanged']]);
const audioStore={getItem:(k:string)=>saves.get(k)??null,setItem:(k:string,v:string)=>{saves.set(k,v);}};
writeBookmark(audioStore,'paris-playlist',true);
assert.deepEqual(parseShelf(audioStore.getItem(SHELF_KEY)).workIds,['paris-playlist']);
writeBookmark(audioStore,'la-seine',true);writeBookmark(audioStore,'paris-playlist',false);
assert.deepEqual(parseShelf(audioStore.getItem(SHELF_KEY)).workIds,['la-seine']);
assert.equal(saves.get('saved-trips'),'unchanged');
console.log('PASS audio: v1 compatibility, v2 metadata, sourced listening URLs, playlist integrity, scoped search, API filters and independent saves');

const importedPodcasts=cultureCatalog.works.filter(w=>w.id.startsWith('podcast-'));
assert.equal(importedPodcasts.length,39);
const episodeUrls=importedPodcasts.map(w=>new URL(w.listeningLinks![0].url));
assert.equal(new Set(episodeUrls.map(url=>url.pathname)).size,39);
for(const url of episodeUrls){assert.equal(url.hostname,'open.spotify.com');assert.match(url.pathname,/^\/episode\/[A-Za-z0-9]{22}$/);}
assert.equal(queryCatalog(cultureCatalog,{q:'Chambre de Bonne'}).length,1);
console.log('PASS podcast import: 39 distinct Spotify episodes, sourced metadata and searchable titles');

// Books without a verified publication date stay undated; supplied dates remain validated.
const undated=structuredClone(cultureCatalog);
const undatedBook=undated.works.find(w=>w.kind==='book')!;
delete undatedBook.year;delete undatedBook.yearLabel;delete undatedBook.edition;
assert.doesNotThrow(()=>parseCatalog(undated));
const badBookDate=structuredClone(undated);badBookDate.works.find(w=>w.kind==='book')!.year=999;
assert.throws(()=>parseCatalog(badBookDate));
assert.equal(queryCatalog(cultureCatalog,{destination:'paris',kind:'book'}).length,113);
assert.equal(queryCatalog(cultureCatalog,{q:'Seven Ages of Paris'}).length,1);
assert.match(cultureCatalog.works.find(w=>w.id==='the-sun-also-rises')!.relationship.statement,/Partial Paris connection/);
console.log('PASS expanded books: 113 Paris books, undated metadata validation, unique titles and partial geography');
