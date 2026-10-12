/** Small, versioned discovery contract. Deliberately independent of City/TripState. */
export interface CultureSource { id: string; title: string; url: string; checkedAt: string; policy: 'citation-and-facts-only' }
export interface CultureWork {
  id: string; title: string; creator: string; kind: 'book' | 'film'; year: number;
  yearLabel: 'First published' | 'Film released' | 'English edition' | 'Cited edition' | 'Film year';
  edition?: string;
  form: string; language: string; description: string;
  destinationId: 'paris' | 'rome';
  relationship: { type: 'primarily_set_in' | 'about'; scope: 'city'; statement: string; sourceId: string; review: 'source_reported' };
  sourceIds: string[];
  // Interpretation is withheld until curator review, never inferred from keywords.
  immersion: 'unreviewed';
}
export interface CultureDestination { id: 'paris' | 'rome'; name: string; country: string; introduction: string; archive: 'original' | 'none' }
export interface CultureCatalog { schemaVersion: 1; revision: string; destinations: CultureDestination[]; sources: CultureSource[]; works: CultureWork[] }
function object(v: unknown): asserts v is Record<string, unknown> { if (!v || typeof v !== 'object' || Array.isArray(v)) throw Error('Invalid catalog object'); }
function text(v: unknown, max = 1200): asserts v is string { if (typeof v !== 'string' || !v.trim() || v.length > max) throw Error('Invalid catalog text'); }
function keys(v: Record<string,unknown>, allowed: string[]) { if (Object.keys(v).some(k => !allowed.includes(k))) throw Error('Unexpected catalog field'); }
const id = (v: unknown) => typeof v === 'string' && /^[a-z0-9-]{1,80}$/.test(v);
export function parseCatalog(value: unknown): CultureCatalog {
  object(value); keys(value,['schemaVersion','revision','destinations','sources','works']);
  if(value.schemaVersion!==1) throw Error('Unsupported catalog'); text(value.revision,80);
  for(const key of ['destinations','sources','works']) if(!Array.isArray(value[key]) || value[key].length>100) throw Error('Invalid catalog list');
  const destinations = value.destinations as unknown[], sources = value.sources as unknown[], works = value.works as unknown[];
  const unique = (items: unknown[]) => { const ids=new Set(); for(const item of items){object(item);if(!id(item.id)||ids.has(item.id))throw Error('Duplicate or invalid ID');ids.add(item.id);} };
  unique(destinations);unique(sources);unique(works);
  for(const d of destinations) { object(d);keys(d,['id','name','country','introduction','archive']); if(!['paris','rome'].includes(String(d.id))||!['original','none'].includes(String(d.archive)))throw Error('Invalid destination'); for(const k of ['name','country','introduction'])text(d[k]); }
  const sourceIds = new Set(sources.map(s => (s as CultureSource).id));
  for(const s of sources){object(s);keys(s,['id','title','url','checkedAt','policy']);text(s.title);text(s.url);const u=new URL(s.url);if(u.protocol!=='https:'||u.username||u.password)throw Error('Unsafe citation');if(s.policy!=='citation-and-facts-only'||typeof s.checkedAt!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(s.checkedAt))throw Error('Invalid source policy');}
  for(const w of works){
    object(w);keys(w,['id','title','creator','kind','year','yearLabel','form','language','description','destinationId','relationship','sourceIds','immersion','edition']);
    for(const k of ['title','creator','form','language','description'])text(w[k]);
    if(!['book','film'].includes(String(w.kind))||!Number.isInteger(w.year)||Number(w.year)<1400||Number(w.year)>2100||!['First published','Film released','English edition','Cited edition','Film year'].includes(String(w.yearLabel)))throw Error('Invalid work metadata');
    if(w.yearLabel==='Cited edition'){text(w.edition,200);}else if(w.edition!==undefined)throw Error('Unexpected edition metadata');
    if(!destinations.some(d=>(d as CultureDestination).id===w.destinationId)||w.immersion!=='unreviewed')throw Error('Unreviewed interpretation cannot publish');
    if(!Array.isArray(w.sourceIds)||!w.sourceIds.length||!w.sourceIds.every(s=>sourceIds.has(s)))throw Error('Missing source');
    object(w.relationship);keys(w.relationship,['type','scope','statement','sourceId','review']);
    if(!['primarily_set_in','about'].includes(String(w.relationship.type))||w.relationship.scope!=='city'||w.relationship.review!=='source_reported'||!w.sourceIds.includes(w.relationship.sourceId))throw Error('Unsupported geographic claim');text(w.relationship.statement);
  }
  return value as unknown as CultureCatalog;
}
export interface CatalogQuery { q?: string; destination?: string; kind?: string }
export function queryCatalog(catalog: CultureCatalog, query: CatalogQuery): CultureWork[] {
  const normalize=(s:string)=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
  const terms=normalize((query.q??'').slice(0,120)).trim().split(/\s+/).filter(Boolean);
  return catalog.works.filter(w=>(!query.destination||w.destinationId===query.destination)&&(!query.kind||w.kind===query.kind)&&terms.every(t=>normalize([w.title,w.creator,w.form,w.language,w.destinationId].join(' ')).includes(t)));
}
