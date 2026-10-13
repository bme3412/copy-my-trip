/** Versioned discovery contract, independent of City/TripState and device storage. */
export const CULTURE_FORMATS = [
  {kind:'book', label:'Books', group:'Reading', action:'READ'},
  {kind:'film', label:'Films', group:'Screen', action:'WATCH'},
  {kind:'tv_show', label:'TV shows', group:'Screen', action:'WATCH'},
  {kind:'essay', label:'Essays', group:'Short reading', action:'READ'},
  {kind:'poem', label:'Poems', group:'Short reading', action:'READ'},
  {kind:'song', label:'Songs', group:'Music', action:'LISTEN'},
  {kind:'playlist', label:'Playlists', group:'Music', action:'PLAYLIST'},
  {kind:'podcast_episode', label:'Podcast episodes', group:'Podcasts', action:'LISTEN'},
] as const;
export type CultureKind = typeof CULTURE_FORMATS[number]['kind'];
export const isCultureKind = (value: unknown): value is CultureKind => CULTURE_FORMATS.some(f=>f.kind===value);
export const isAudio = (work: CultureWork) => work.kind==='song'||work.kind==='podcast_episode';
export interface CultureSource { id: string; title: string; url: string; checkedAt: string; policy: 'citation-and-facts-only' }
export interface CultureWork {
  id: string; title: string; creator: string; kind: CultureKind; year?: number;
  yearLabel?: 'First published' | 'Film released' | 'English edition' | 'Cited edition' | 'Film year' | 'Recording released' | 'Performance broadcast' | 'Episode published' | 'Series began';
  edition?: string;
  form: string; language: string; description: string;
  destinationId: 'paris' | 'rome';
  relationship: { type: 'primarily_set_in' | 'about' | 'soundtrack' | 'curated_selection'; scope: 'city'; statement: string; sourceId: string; review: 'source_reported' | 'editorial' };
  sourceIds: string[];
  immersion: 'unreviewed';
  recording?: string;
  publishedOn?: string;
  durationSeconds?: number;
  podcast?: {show: string; episode?: number; guest: string};
  listeningLinks?: {provider: string; url: string; sourceId: string}[];
  context?: string[];
  tracks?: string[];
  publication?: { originalYear?: number; edition?: {year:number; label:string; isbn?:string; translator?:string; sourceId:string}; sourceId:string };
  series?: {start:number; end?:number; sourceId:string};
  parentPublication?: {title:string; sourceId:string};
  identifiers?: {scheme:'isbn'|'publisher'|'podcast_guid'|'youtube'; value:string; sourceId:string}[];
  musicDates?: {compositionYear?:number; recordingYear?:number; sourceId:string};
  geography?: {area:'paris_city'|'greater_paris'|'both'; note:string; sourceId:string};
}
export interface CultureDestination { id: 'paris' | 'rome'; name: string; country: string; introduction: string; archive: 'original' | 'none' }
export interface CultureCatalog { schemaVersion: 1 | 2 | 3; revision: string; destinations: CultureDestination[]; sources: CultureSource[]; works: CultureWork[] }
function object(v: unknown): asserts v is Record<string, unknown> { if (!v || typeof v !== 'object' || Array.isArray(v)) throw Error('Invalid catalog object'); }
function text(v: unknown, max = 1200): asserts v is string { if (typeof v !== 'string' || !v.trim() || v.length > max) throw Error('Invalid catalog text'); }
function keys(v: Record<string,unknown>, allowed: string[]) { if (Object.keys(v).some(k => !allowed.includes(k))) throw Error('Unexpected catalog field'); }
const id = (v: unknown) => typeof v === 'string' && /^[a-z0-9-]{1,80}$/.test(v);
function safeUrl(v:unknown) { text(v);const u=new URL(v);if(u.protocol!=='https:'||u.username||u.password)throw Error('Unsafe citation'); }
function validDate(v:unknown):v is string {return typeof v==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(v)&&Number.isFinite(Date.parse(v))&&new Date(v).toISOString().slice(0,10)===v;}
/** Filtered API envelopes may omit playlist members. Full catalog loads additionally validate integrity. */
export const CATALOG_LIMITS = {destinations:20,sources:2000,works:500} as const;
export function parseCatalog(value: unknown): CultureCatalog {
  object(value); keys(value,['schemaVersion','revision','destinations','sources','works']);
  if(value.schemaVersion!==1&&value.schemaVersion!==2&&value.schemaVersion!==3) throw Error('Unsupported catalog'); text(value.revision,80);
  for(const [key,limit] of Object.entries(CATALOG_LIMITS)) if(!Array.isArray(value[key]) || value[key].length>limit) throw Error('Invalid catalog list');
  const destinations = value.destinations as unknown[], sources = value.sources as unknown[], works = value.works as unknown[];
  const unique = (items: unknown[]) => { const ids=new Set(); for(const item of items){object(item);if(!id(item.id)||ids.has(item.id))throw Error('Duplicate or invalid ID');ids.add(item.id);} };
  unique(destinations);unique(sources);unique(works);
  for(const d of destinations) { object(d);keys(d,['id','name','country','introduction','archive']); if(!['paris','rome'].includes(String(d.id))||!['original','none'].includes(String(d.archive)))throw Error('Invalid destination'); for(const k of ['name','country','introduction'])text(d[k]); }
  const sourceIds = new Set(sources.map(s => (s as CultureSource).id));
  for(const s of sources){object(s);keys(s,['id','title','url','checkedAt','policy']);text(s.title);safeUrl(s.url);if(s.policy!=='citation-and-facts-only'||!validDate(s.checkedAt))throw Error('Invalid source policy');}
  for(const w of works){
    object(w);
    const legacy=['id','title','creator','kind','year','yearLabel','form','language','description','destinationId','relationship','sourceIds','immersion','edition'];
    keys(w,value.schemaVersion===1?legacy:[...legacy,'recording','publishedOn','durationSeconds','podcast','listeningLinks','context','tracks',...(value.schemaVersion===3?['publication','series','parentPublication','identifiers','musicDates','geography']:[])]);
    for(const k of ['title','creator','form','language','description'])text(w[k]);
    if(!isCultureKind(w.kind)||(value.schemaVersion===1&&!['book','film'].includes(w.kind))||(value.schemaVersion===2&&['tv_show','essay','poem'].includes(w.kind)))throw Error('Invalid work kind');
    const legacyWork=['book','film','essay','poem'].includes(w.kind), audio=w.kind==='song'||w.kind==='podcast_episode';
    if(legacyWork||w.year!==undefined||w.yearLabel!==undefined){
      const labels=legacyWork?['First published','Film released','English edition','Cited edition','Film year']:w.kind==='song'?['Recording released','Performance broadcast']:w.kind==='tv_show'?['Series began']:['Episode published'];
      if(!Number.isInteger(w.year)||Number(w.year)<1400||Number(w.year)>2100||!labels.includes(String(w.yearLabel)))throw Error('Invalid work year');
    }
    if(w.yearLabel==='Cited edition'){text(w.edition,200);}else if(w.edition!==undefined)throw Error('Unexpected edition metadata');
    if(!destinations.some(d=>(d as CultureDestination).id===w.destinationId)||w.immersion!=='unreviewed')throw Error('Unreviewed interpretation cannot publish');
    if(!Array.isArray(w.sourceIds)||!w.sourceIds.length||new Set(w.sourceIds).size!==w.sourceIds.length||!w.sourceIds.every(s=>sourceIds.has(s)))throw Error('Missing source');
    if(value.schemaVersion===3)validateExpandedMetadata(w);
    object(w.relationship);keys(w.relationship,['type','scope','statement','sourceId','review']);
    const types=w.kind==='playlist'?['curated_selection']:w.kind==='song'?['about','soundtrack']:w.kind==='podcast_episode'?['about']:['primarily_set_in','about'];
    if(!types.includes(String(w.relationship.type))||w.relationship.scope!=='city'||w.relationship.review!==(w.kind==='playlist'?'editorial':'source_reported')||!w.sourceIds.includes(w.relationship.sourceId))throw Error('Unsupported geographic claim');text(w.relationship.statement);
    if(audio){
      text(w.recording,400);
      if(!Array.isArray(w.listeningLinks)||!w.listeningLinks.length||w.listeningLinks.length>4)throw Error('Missing listening link');
      for(const link of w.listeningLinks){object(link);keys(link,['provider','url','sourceId']);text(link.provider,100);safeUrl(link.url);if(!w.sourceIds.includes(link.sourceId))throw Error('Listening link lacks evidence');}
    }else if(w.recording!==undefined||w.listeningLinks!==undefined||w.durationSeconds!==undefined)throw Error('Unexpected audio metadata');
    if(w.durationSeconds!==undefined&&(!Number.isInteger(w.durationSeconds)||Number(w.durationSeconds)<1||Number(w.durationSeconds)>86400))throw Error('Invalid duration');
    if(w.kind==='podcast_episode'){
      object(w.podcast);keys(w.podcast,['show','episode','guest']);text(w.podcast.show,200);text(w.podcast.guest,200);
      if(w.podcast.episode!==undefined&&(!Number.isInteger(w.podcast.episode)||Number(w.podcast.episode)<1))throw Error('Invalid episode number');
      if(!validDate(w.publishedOn)||Number(w.publishedOn.slice(0,4))!==w.year)throw Error('Invalid publication date');
    }else if(w.podcast!==undefined||w.publishedOn!==undefined)throw Error('Unexpected podcast metadata');
    if(w.context!==undefined&&(!Array.isArray(w.context)||!w.context.length||w.context.length>6))throw Error('Invalid context');
    if(Array.isArray(w.context))w.context.forEach(p=>text(p));
    if(w.kind==='playlist'){
      if(w.year!==undefined||!Array.isArray(w.tracks)||!w.tracks.length||w.tracks.length>50||!w.tracks.every(id)||new Set(w.tracks).size!==w.tracks.length)throw Error('Invalid playlist');
    }else if(w.tracks!==undefined)throw Error('Unexpected track list');
  }
  return value as unknown as CultureCatalog;
}
export function validatePlaylistTracks(catalog:CultureCatalog) {
  for(const playlist of catalog.works.filter(w=>w.kind==='playlist'))for(const id of playlist.tracks??[]){
    const track=catalog.works.find(w=>w.id===id);
    if(!track||track.kind!=='song'||track.destinationId!==playlist.destinationId)throw Error('Playlist references an unavailable song');
  }
}
export const isCatalogArea = (area:unknown):area is 'paris_city'|'greater_paris' => area==='paris_city'||area==='greater_paris';
export interface CatalogQuery { q?: string; destination?: string; kind?: string; area?: string }
export function queryCatalog(catalog: CultureCatalog, query: CatalogQuery): CultureWork[] {
  if(query.area&&!isCatalogArea(query.area))return [];
  const normalize=(s:string)=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
  const terms=normalize((query.q??'').slice(0,120)).trim().split(/\s+/).filter(Boolean);
  return catalog.works.filter(w=>(!query.destination||w.destinationId===query.destination)&&(!query.kind||w.kind===query.kind)&&(!query.area||(w.destinationId==='paris'&&(w.geography?.area===query.area||w.geography?.area==='both')))&&terms.every(t=>normalize([w.title,w.creator,w.form,w.language,w.destinationId,w.podcast?.show??'',w.podcast?.guest??'',w.description].join(' ')).includes(t)));
}

function validateExpandedMetadata(w:Record<string,unknown>) {
  const reading=['book','essay','poem'].includes(String(w.kind));
  const year=(n:unknown)=>{if(!Number.isInteger(n)||Number(n)<1400||Number(n)>2100)throw Error('Invalid metadata year');};
  const source=(v:unknown)=>{if(!(w.sourceIds as unknown[]).includes(v))throw Error('Metadata lacks evidence');};
  if(w.publication!==undefined){
    if(!reading)throw Error('Unexpected publication metadata');object(w.publication);const p=w.publication;
    keys(p,['originalYear','edition','sourceId']);source(p.sourceId);if(p.originalYear===undefined&&p.edition===undefined)throw Error('Empty publication');
    if(p.originalYear!==undefined)year(p.originalYear);
    if(p.edition!==undefined){object(p.edition);const e=p.edition;keys(e,['year','label','isbn','translator','sourceId']);year(e.year);text(e.label,200);source(e.sourceId);if(e.isbn!==undefined&&(typeof e.isbn!=='string'||!/^\d{13}$/.test(e.isbn)))throw Error('Invalid ISBN');if(e.translator!==undefined)text(e.translator,200);if(p.originalYear!==undefined&&Number(e.year)<Number(p.originalYear))throw Error('Edition precedes original');}
  }
  if(w.series!==undefined){if(w.kind!=='tv_show')throw Error('Unexpected series');object(w.series);keys(w.series,['start','end','sourceId']);year(w.series.start);source(w.series.sourceId);if(w.series.end!==undefined){year(w.series.end);if(Number(w.series.end)<Number(w.series.start))throw Error('Invalid series span');}if(w.year!==w.series.start)throw Error('Series date mismatch');}
  if(w.kind==='tv_show'&&!w.series)throw Error('Missing series metadata');
  if(w.parentPublication!==undefined){if(!reading)throw Error('Unexpected parent');object(w.parentPublication);keys(w.parentPublication,['title','sourceId']);text(w.parentPublication.title,200);source(w.parentPublication.sourceId);}
  if(w.musicDates!==undefined){if(w.kind!=='song')throw Error('Unexpected music dates');object(w.musicDates);keys(w.musicDates,['compositionYear','recordingYear','sourceId']);source(w.musicDates.sourceId);if(w.musicDates.compositionYear===undefined&&w.musicDates.recordingYear===undefined)throw Error('Empty music dates');for(const k of ['compositionYear','recordingYear'])if(w.musicDates[k]!==undefined)year(w.musicDates[k]);}
  if(w.geography!==undefined){if(w.destinationId!=='paris')throw Error('Paris geography on another city');object(w.geography);keys(w.geography,['area','note','sourceId']);if(!['paris_city','greater_paris','both'].includes(String(w.geography.area)))throw Error('Invalid area');text(w.geography.note);source(w.geography.sourceId);}
  if(w.identifiers!==undefined){if(!Array.isArray(w.identifiers)||!w.identifiers.length||w.identifiers.length>8)throw Error('Invalid identifiers');const seen=new Set();for(const i of w.identifiers){object(i);keys(i,['scheme','value','sourceId']);if(!['isbn','publisher','podcast_guid','youtube'].includes(String(i.scheme)))throw Error('Unknown identifier');text(i.value,300);source(i.sourceId);if(i.scheme==='isbn'&&!/^\d{13}$/.test(String(i.value)))throw Error('Invalid identifier ISBN');const key=`${i.scheme}:${i.value}`;if(seen.has(key))throw Error('Duplicate identifier');seen.add(key);}}
}
export function workDateLabel(work:CultureWork):string {
  if(work.series)return work.series.end===work.series.start?`Series · ${work.series.start}`:work.series.end?`Series · ${work.series.start}–${work.series.end}`:`Series began ${work.series.start}`;
  if(work.publication?.originalYear)return `First published ${work.publication.originalYear}`;
  if(work.publication?.edition)return `Selected edition ${work.publication.edition.year}`;
  return work.year?`${work.yearLabel??''} ${work.year}`.trim():'';
}
export function geographyLabel(work:CultureWork):string {
  return work.geography?.area==='both'?'Paris & Greater Paris':work.geography?.area==='greater_paris'?'Greater Paris':work.geography?.area==='paris_city'?'Paris city':work.destinationId==='paris'?'Paris':'Rome';
}
export function formatLabel(kind:CultureKind){return ({book:'Book',film:'Film',tv_show:'TV show',essay:'Essay',poem:'Poem',song:'Song',playlist:'Playlist',podcast_episode:'Podcast episode'} as const)[kind];}
