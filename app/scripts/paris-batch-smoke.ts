import assert from 'node:assert/strict';
import { cultureCatalog } from '../src/lib/culture/seed';
import { CATALOG_LIMITS, CULTURE_FORMATS, parseCatalog, queryCatalog, workDateLabel, validatePlaylistTracks } from '../src/lib/culture/schema';
import { parisDiscovery, validateDiscovery, parseTrail, entitiesFor } from '../src/lib/culture/paris-discovery';
import { PARIS_KEY, emptyPersonal, writePersonal, parsePersonal, exportBackup, restoreBackup } from '../src/lib/culture/paris-personal';
import { SHELF_KEY, writeBookmark, parseShelf } from '../src/lib/culture/shelf';
import handler from '../api/catalog';
import baseline from '../../editorial/paris-atlas-120/existing-catalog.json';
import decisions from '../../editorial/paris-atlas-120/decisions.json';
import batch from '../src/lib/culture/paris-batch.json';
const copy=(v:any)=>JSON.parse(JSON.stringify(v));
assert.deepEqual(batch.works,decisions.approvedWorks);assert.deepEqual(batch.sources,decisions.sources);
assert.equal(batch.works.length,22);assert.equal(cultureCatalog.works.length,504);
for(const old of baseline.works){const current=cultureCatalog.works.find(w=>w.id===old.id)!;for(const [key,value] of Object.entries(old))assert.deepEqual((current as any)[key],value,`${old.id}: ${key} changed`);}
assert.equal(parseCatalog(baseline).schemaVersion,2);
const v1=copy(baseline);v1.schemaVersion=1;v1.works=v1.works.filter((w:any)=>['book','film'].includes(w.kind));assert.equal(parseCatalog(v1).works.length,21);
for(const version of [1,2]){const c=copy(cultureCatalog);c.schemaVersion=version;assert.throws(()=>parseCatalog(c));}
for(const kind of ['tv_show','essay','poem'])assert.ok(CULTURE_FORMATS.some(f=>f.kind===kind));
assert.equal(CULTURE_FORMATS.find(f=>f.kind==='tv_show')!.action,'WATCH');assert.equal(CULTURE_FORMATS.find(f=>f.kind==='poem')!.action,'READ');
const fixture=copy(cultureCatalog);const essay=fixture.works.find((w:any)=>w.kind==='essay');fixture.works.push({...essay,id:'synthetic-poem',kind:'poem',form:'Poem'});assert.equal(parseCatalog(fixture).works.at(-1)?.kind,'poem');
for(const modify of [
 (c:any)=>c.works.find((w:any)=>w.kind==='tv_show').series.end=1800,
 (c:any)=>c.works.find((w:any)=>w.kind==='tv_show').series.sourceId='absent',
 (c:any)=>c.works.find((w:any)=>w.kind==='book').publication.edition.year=1300,
 (c:any)=>c.works.find((w:any)=>w.kind==='book').publication.edition.isbn='invalid',
 (c:any)=>c.works.find((w:any)=>w.kind==='essay').parentPublication.sourceId='absent',
 (c:any)=>c.works[0].geography.area='made-up',
 (c:any)=>c.works[0].geography.sourceId='absent',
 (c:any)=>c.works[0].identifiers.push(c.works[0].identifiers[0]),
 (c:any)=>c.works[0].publication.originalYear=2099,
]){const c=copy(cultureCatalog);modify(c);assert.throws(()=>parseCatalog(c));}
const large=copy(cultureCatalog);for(let i=0;i<Math.min(120,CATALOG_LIMITS.works-cultureCatalog.works.length);i++){large.works.push({...copy(large.works[0]),id:`fixture-${i}`});large.sources.push({...large.sources[0],id:`source-${i}`});}assert.ok(parseCatalog(large).works.length>100);const over=copy(large);while(over.works.length<=CATALOG_LIMITS.works)over.works.push({...over.works[0],id:`over-${over.works.length}`});assert.throws(()=>parseCatalog(over));
const ids=(q:any)=>queryCatalog(cultureCatalog,q).map(w=>w.id);
assert.ok(ids({area:'greater_paris'}).includes('full-time'));assert.ok(ids({area:'paris_city'}).includes('full-time'));
assert.ok(ids({area:'greater_paris'}).includes('les-miserables-ladj-ly'));assert.ok(!ids({area:'paris_city'}).includes('les-miserables-ladj-ly'));
assert.equal(ids({area:'paris_city',destination:'rome'}).length,0);assert.equal(ids({area:'bad'}).length,0);
assert.equal(ids({q:'Mary Winston Nicklin',kind:'podcast_episode'}).length,1);assert.equal(ids({q:'new paris podcast'}).length,5);
assert.equal(ids({kind:'tv_show'}).length,44);assert.equal(ids({kind:'essay'}).length,1);assert.equal(ids({kind:'poem'}).length,0);
assert.equal(workDateLabel(cultureCatalog.works.find(w=>w.id==='the-belly-of-paris')!),'First published 1873');
assert.equal(cultureCatalog.works.find(w=>w.id==='impossible-city')?.year,2024);assert.equal(cultureCatalog.works.find(w=>w.id==='the-other-paris')?.creator,'Lucy Sante');
const response=(query:any)=>{let status=0,body:any;handler({method:'GET',query},{setHeader(){},status:s=>({json:b=>{status=s;body=b;}})});return{status,body};};
assert.equal(response({area:'bad'}).status,400);assert.equal(response({area:['paris_city']}).status,400);
assert.deepEqual(response({area:'greater_paris',kind:'film'}).body.works.map((w:any)=>w.id),ids({area:'greater_paris',kind:'film'}));
for(const d of decisions.records.filter(r=>!r.publicationEligible&&!r.existingWorkId)){assert.equal(response({id:(d as any).workId??`not-published-${d.seedId}`}).status,404);}
assert.ok(!JSON.stringify(response({}).body).includes('Adieu Paris'));
validatePlaylistTracks(cultureCatalog);assert.deepEqual(cultureCatalog.works.find(w=>w.id==='paris-playlist')?.tracks,baseline.works.find(w=>w.id==='paris-playlist')?.tracks);
validateDiscovery(parisDiscovery,cultureCatalog);for(const collection of parisDiscovery.entities.filter(e=>e.kind==='collection'&&['collection:work-and-everyday-life','collection:walking-and-observation','collection:the-seine'].includes(e.id))){assert.ok(collection.members);assert.deepEqual(parseTrail(collection.members!.join(','),entitiesFor(cultureCatalog)),collection.members);}
const memory=new Map<string,string>([['saved-trips','unchanged']]);const storage={getItem:(k:string)=>memory.get(k)??null,setItem:(k:string,v:string)=>{memory.set(k,v)},removeItem:(k:string)=>{memory.delete(k)}};
for(const id of ['call-my-agent','the-painter-of-modern-life','paname-slimane'])writeBookmark(storage,id,true);
writePersonal(storage,d=>({...d,activities:[{id:'work:call-my-agent',status:'watched',at:'2026-10-12T12:00:00Z'},{id:'work:the-painter-of-modern-life',status:'read',at:'2026-10-12T12:00:00Z'}]}));
const backup=exportBackup(storage);writePersonal(storage,()=>emptyPersonal());restoreBackup(storage,backup);assert.equal(parsePersonal(storage.getItem(PARIS_KEY)).activities.length,2);assert.equal(parseShelf(storage.getItem(SHELF_KEY)).workIds.length,3);
writePersonal(storage,d=>({...d,activities:d.activities.filter(a=>a.id!=='work:call-my-agent')}));writeBookmark(storage,'call-my-agent',false);assert.equal(parsePersonal(storage.getItem(PARIS_KEY)).activities.length,1);assert.equal(parseShelf(storage.getItem(SHELF_KEY)).workIds.length,2);assert.equal(memory.get('saved-trips'),'unchanged');
console.log('PASS Paris batch: exact reviewed artifact, legacy identity/metadata preservation, v1/v2/v3, formats, date distinctions, evidence, capacity, geography/API, playlist, collections, activity undo and backup recovery');
