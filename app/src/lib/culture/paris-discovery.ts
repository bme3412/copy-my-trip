import { parisTrackIds } from './audio-selection';
import type { CultureCatalog, CultureWork } from './schema';
import places from '../../cities/paris/data/places.json';

export const PARIS_ROOT = '/discover/place/paris';
export type EntityKind = 'work' | 'place' | 'person' | 'theme' | 'story' | 'collection';
// Work IDs are references, not a second copy of work metadata. Future media retain this interface.
export type MediaKind = CultureWork['kind'] | 'tv_show' | 'tv_episode' | 'podcast_show' | 'podcast_episode' | 'artist' | 'album' | 'song';
export type DiscoveryEntity = { id: string; kind: EntityKind; title: string; summary: string; sourceIds: string[]; workId?: string; placeId?: string; photo?: 'hero' | 'river' | 'cafe'; paragraphs?: string[]; members?: string[] };
export type Connection = { id: string; from: string; to: string; label: string; explanation: string; basis: 'source' | 'editorial'; review: 'reviewed' | 'pending'; sourceIds: string[] };
export type DiscoverySource = { id: string; title: string; url: string; checkedAt: string };
export type ParisDiscovery = { schemaVersion: 1; entities: DiscoveryEntity[]; connections: Connection[]; sources: DiscoverySource[] };
const essay = 'https://www.criterion.com/current/posts/4445-the-before-trilogy-time-regained';
export const parisDiscovery: ParisDiscovery = {
  schemaVersion: 1,
  sources: [
    { id: 'before-essay', title: 'Criterion · The Before Trilogy: Time Regained', url: essay, checkedAt: '2026-10-12' },
    { id: 'bookshop-history', title: 'Shakespeare and Company · Official history', url: 'https://www.shakespeareandcompany.com/history', checkedAt: '2026-10-12' },
  ],
  entities: [
    {id:'collection:work-and-everyday-life',kind:'collection',title:'Work and everyday life',summary:'Restaurant labor, commuting and a changing city. Three perspectives to explore together.',sourceIds:[],members:['work:a-waiter-in-paris','work:full-time','work:impossible-city']},
    {id:'collection:walking-and-observation',kind:'collection',title:'Walking and observation',summary:'Move through Paris, then stop to notice what passes by.',sourceIds:[],members:['work:cleo-from-5-to-7','work:the-flaneur','work:an-attempt-at-exhausting-a-place-in-paris']},
    {id:'collection:the-seine',kind:'collection',title:'The Seine',summary:'Follow the river from a film conversation into history and an episode about its changing role.',sourceIds:[],members:['work:before-sunset','work:the-seine','work:the-seine-past-and-present']},
    { id: 'place:shakespeare', kind: 'place', placeId: 'shakespeare', title: 'Shakespeare and Company', summary: 'A bookshop, a meeting place, and the beginning of a film reunion.', sourceIds: ['bookshop-history', 'before-essay'], paragraphs: ['George Whitman opened this English-language bookshop in 1951. It took the name Shakespeare and Company in 1964, honoring Sylvia Beach’s earlier shop. These are two distinct bookstores.', 'The shop’s own history lists James Baldwin among its early visitors. Before Sunset gives it another role: the setting of Jesse’s book reading.'] },
    { id: 'place:couleeverte', kind: 'place', placeId: 'couleeverte', title: 'Promenade Plantée', summary: 'An elevated Paris walk that appears in Before Sunset.', sourceIds: ['before-essay'] },
    { id: 'place:seine', kind: 'place', title: 'The banks of the Seine', summary: 'A broad river setting, rather than a precise film location.', sourceIds: ['before-essay'], photo: 'river' },
    { id: 'person:james-baldwin', kind: 'person', title: 'James Baldwin', summary: 'The author of Giovanni’s Room, and an early visitor to George Whitman’s bookshop.', sourceIds: ['baldwin-prh', 'bookshop-history'] },
    { id: 'person:richard-linklater', kind: 'person', title: 'Richard Linklater', summary: 'The filmmaker behind Before Sunset.', sourceIds: ['before-essay'] },
    { id: 'theme:literary-paris', kind: 'theme', title: 'Literary Paris', summary: 'Begin with a book, a writer or a bookshop. Follow the connections between them.', sourceIds: [], photo: 'cafe' },
    { id: 'theme:city-in-conversation', kind: 'theme', title: 'A city in conversation', summary: 'An editorial lens on walking, attention and the words exchanged along the way.', sourceIds: [], photo: 'hero' },
    { id: 'story:bookshop-reunion', kind: 'story', title: 'A bookshop, a beginning', summary: 'Take a closer look at the first connection in Before Sunset.', sourceIds: ['before-essay'], paragraphs: ['A reading brings Jesse to Shakespeare and Company; meeting Céline turns the afternoon in a new direction.', 'Try watching the opening with attention to the room. Who is listening, and when does an ordinary public event become something private?', 'Then follow the bookshop into a different kind of story: its own history. A film scene and a writer’s visit are different sorts of connections. Each deserves its own source.'] },
    { id: 'story:two-bookshops', kind: 'story', title: 'One name, two bookshops', summary: 'A small distinction that changes how you read the literary city.', sourceIds: ['bookshop-history'], photo: 'cafe', paragraphs: ['The current Shakespeare and Company opened in 1951 as Le Mistral. Its founder, George Whitman, adopted the present name in 1964 in tribute to Sylvia Beach.', 'Beach’s original Shakespeare and Company opened in 1919. When following a writer through Paris, check which shop a source means.', 'Names can connect places without making their histories interchangeable. Let that distinction guide the next bookshop story you read.'] },
    { id: 'story:walking-and-talking', kind: 'story', title: 'The city between sentences', summary: 'A viewing prompt for the walking conversations of Before Sunset.', sourceIds: ['before-essay'], photo: 'river', paragraphs: ['Criterion’s essay identifies the Promenade Plantée and the banks of the Seine among the settings of the film’s conversation.', 'Watch how a change of setting affects what you notice. Is the city in the foreground, or do you stop seeing it as you listen?', 'This is a prompt for looking, not a reconstruction of a walking route. Follow a connection to explore the places individually.'] },
    { id: 'collection:literary-paris', kind: 'collection', title: 'Paris: the literary city', summary: 'A free guide through a film, a bookshop, a writer and a novel. Read in order or start anywhere.', sourceIds: [], photo: 'cafe', members: ['story:two-bookshops', 'work:before-sunset', 'place:shakespeare', 'person:james-baldwin', 'work:giovannis-room'] },
  ],
  connections: [
    ...([
      ['labor-commute','a-waiter-in-paris','full-time','Follow restaurant work with a film about hotel work and commuting. This is an editorial pairing, not an adaptation.'],
      ['commute-city','full-time','impossible-city','Consider a fictional working day alongside a nonfiction account of the city and its suburbs.'],
      ['cleo-flaneur','cleo-from-5-to-7','the-flaneur','Pair a film journey with a writer’s observations of Paris. No shared itinerary is implied.'],
      ['flaneur-perec','the-flaneur','an-attempt-at-exhausting-a-place-in-paris','Turn from walking to observing one square. Two different ways of noticing the city.'],
      ['sunset-seine-book','before-sunset','the-seine','Move from the river as a film setting to a nonfiction river history.'],
      ['seine-book-episode','the-seine','the-seine-past-and-present','Pair river history with a 2024 conversation about the Seine. This does not assert that the episode discusses the book.'],
    ] as const).map(([id,from,to,explanation]):Connection=>({id,from:`work:${from}`,to:`work:${to}`,label:'Editorial connection',explanation,basis:'editorial',review:'reviewed',sourceIds:[]})),
    ...parisTrackIds.map((id):Connection=>({id:`playlist-${id}`,from:'work:paris-playlist',to:`work:${id}`,label:'Selected track',explanation:'Included in Elsewhere’s Paris playlist as an editorial selection. Open the song for its specific Paris connection and sources.',basis:'editorial',review:'reviewed',sourceIds:[]})),
    {id:'jazz-bookshop',from:'work:an-intro-to-jazz-in-paris',to:'place:shakespeare',label:'Bookseller interviewed',explanation:'The publisher identifies guest Alex Freiman as a bookseller at Shakespeare and Company and places the interview in the neighboring Square René Viviani.',basis:'source',review:'reviewed',sourceIds:['earful-jazz']},
    {id:'song-seine',from:'work:la-seine',to:'place:seine',label:'Song subject',explanation:'The official film video identifies La Seine, the duet from Un monstre à Paris. The river is a broad setting, not a verified recording location.',basis:'source',review:'reviewed',sourceIds:['la-seine-europacorp']},
    {id:'piaf-river',from:'work:sous-le-ciel-de-paris',to:'place:seine',label:'Editorial connection',explanation:'Explore original river photography alongside this Paris chanson. This pairing does not assert a performance or recording location.',basis:'editorial',review:'reviewed',sourceIds:[]},
    {id:'jazz-miles',from:'work:an-intro-to-jazz-in-paris',to:'work:florence-sur-les-champs-elysees',label:'Editorial connection',explanation:'Continue from a conversation about Paris jazz to a film soundtrack. This pairing does not imply that the episode discusses this track.',basis:'editorial',review:'reviewed',sourceIds:[]},
    {id:'walking-conversation',from:'work:walking-through-paris',to:'theme:city-in-conversation',label:'Editorial connection',explanation:'An illustration and walking conversation offers another way to notice the city. This is an editorial pairing, not a shared route.',basis:'editorial',review:'reviewed',sourceIds:[]},
    {id:'stone-walking',from:'work:carving-paris',to:'work:walking-through-paris',label:'Editorial connection',explanation:'Pair a conversation about limestone with one about observing Paris on foot. The guests are not asserted to have met.',basis:'editorial',review:'reviewed',sourceIds:[]},
    { id: 'sunset-shop', from: 'work:before-sunset', to: 'place:shakespeare', label: 'Book-reading setting', explanation: 'Criterion identifies this bookshop as the setting of Jesse’s reading.', basis: 'source', review: 'reviewed', sourceIds: ['before-essay'] },
    { id: 'sunset-promenade', from: 'work:before-sunset', to: 'place:couleeverte', label: 'Film setting', explanation: 'Criterion names the promenade among the settings of their conversation.', basis: 'source', review: 'reviewed', sourceIds: ['before-essay'] },
    { id: 'sunset-river', from: 'work:before-sunset', to: 'place:seine', label: 'River setting', explanation: 'Criterion names the banks of the Seine, without specifying a precise stop.', basis: 'source', review: 'reviewed', sourceIds: ['before-essay'] },
    { id: 'shop-baldwin', from: 'place:shakespeare', to: 'person:james-baldwin', label: 'Early visitor', explanation: 'The bookshop’s official history lists Baldwin among its early visitors.', basis: 'source', review: 'reviewed', sourceIds: ['bookshop-history'] },
    { id: 'baldwin-novel', from: 'person:james-baldwin', to: 'work:giovannis-room', label: 'Author', explanation: 'The publisher identifies James Baldwin as the novel’s author.', basis: 'source', review: 'reviewed', sourceIds: ['baldwin-prh'] },
    { id: 'linklater-film', from: 'person:richard-linklater', to: 'work:before-sunset', label: 'Director', explanation: 'Criterion discusses Linklater’s direction of the film.', basis: 'source', review: 'reviewed', sourceIds: ['before-essay'] },
    ...([
      ['literary-shop', 'theme:literary-paris', 'place:shakespeare', 'A bookshop offers one way into the literary city.'],
      ['literary-novel', 'theme:literary-paris', 'work:giovannis-room', 'Explore Paris through a novel, then follow its author.'],
      ['conversation-film', 'theme:city-in-conversation', 'work:before-sunset', 'Consider how walking shapes the film’s conversation.'],
      ['story-shop', 'story:bookshop-reunion', 'place:shakespeare', 'Continue from the viewing prompt to the place.'],
      ['story-film', 'story:bookshop-reunion', 'work:before-sunset', 'Return to the film behind this viewing prompt.'],
      ['history-shop', 'story:two-bookshops', 'place:shakespeare', 'Explore the present-day shop after reading its history.'],
      ['walking-film', 'story:walking-and-talking', 'work:before-sunset', 'Take the viewing prompt back to the film.'],
      ['walking-theme', 'story:walking-and-talking', 'theme:city-in-conversation', 'Explore this editorial theme.'],
    ] as const).map(([id, from, to, explanation]): Connection => ({ id, from, to, label: 'Editorial connection', explanation, basis: 'editorial', review: 'reviewed', sourceIds: [] })),
  ],
};
export function entitiesFor(catalog: CultureCatalog, data = parisDiscovery): DiscoveryEntity[] {
  return [...catalog.works.filter(w => w.destinationId === 'paris').map(w => ({ id: `work:${w.id}`, kind: 'work' as const, workId: w.id, title: w.title, summary: w.description, sourceIds: w.sourceIds })), ...data.entities];
}
const validId = (id: unknown): id is string => typeof id === 'string' && /^(work|place|person|theme|story|collection):[a-z0-9-]{1,80}$/.test(id);
export function validateDiscovery(data: ParisDiscovery, catalog: CultureCatalog): void {
  if(data.schemaVersion !== 1 || !Array.isArray(data.entities) || !Array.isArray(data.connections) || !Array.isArray(data.sources)) throw Error('Invalid discovery dataset');
  const entities = entitiesFor(catalog, data), ids = new Set(entities.map(e => e.id));
  const sources = [...catalog.sources, ...data.sources];
  const sourceIds = new Set(sources.map(s => s.id));
  if(ids.size !== entities.length || sourceIds.size !== sources.length) throw Error('Duplicate discovery ID');
  for(const s of sources) if(!/^https:\/\//.test(s.url) || !/^\d{4}-\d{2}-\d{2}$/.test(s.checkedAt)) throw Error('Invalid source');
  const checkSources = (list: string[]) => { if(!Array.isArray(list) || list.some(id => !sourceIds.has(id))) throw Error('Missing evidence'); };
  for(const e of entities) {
    if(!validId(e.id) || !e.id.startsWith(`${e.kind}:`) || !e.title?.trim() || !e.summary?.trim()) throw Error('Invalid entity');
    checkSources(e.sourceIds);
    if(e.kind === 'work' && (e.id !== `work:${e.workId}` || !catalog.works.some(w => w.id === e.workId && w.destinationId === 'paris'))) throw Error('Missing work');
    if(e.placeId && !places.some(p => p.id === e.placeId)) throw Error('Missing place');
    if(['place','person','story'].includes(e.kind) && !e.sourceIds.length) throw Error('Unsupported entity');
    if(e.kind === 'story' && !e.paragraphs?.length) throw Error('Empty story');
    if(e.kind === 'collection' && (!e.members?.length || e.members.some(id => !ids.has(id) || id.startsWith('collection:')) || new Set(e.members).size !== e.members.length)) throw Error('Invalid collection');
  }
  if(new Set(data.connections.map(c => c.id)).size !== data.connections.length) throw Error('Duplicate connection');
  for(const c of data.connections) {
    if(!ids.has(c.from) || !ids.has(c.to) || c.from === c.to || !c.label?.trim() || !c.explanation?.trim() || !['source','editorial'].includes(c.basis) || !['reviewed','pending'].includes(c.review)) throw Error('Invalid connection');
    checkSources(c.sourceIds);
    if(c.basis === 'source' && !c.sourceIds.length) throw Error('Unsupported connection');
  }
}
export function neighbors(id: string, data = parisDiscovery) {
  return data.connections.filter(c => c.review === 'reviewed' && (c.from === id || c.to === id)).map(connection => ({ id: connection.from === id ? connection.to : connection.from, connection }));
}
export function connectionBetween(a: string, b: string) { return neighbors(a).find(n => n.id === b)?.connection; }
export function entityHref(entity: DiscoveryEntity) {
  if(entity.workId) return `/discover/work/${entity.workId}`;
  const section = {place:'places',person:'people',theme:'themes',story:'stories',collection:'collections',work:'works'}[entity.kind];
  return `${PARIS_ROOT}/${section}/${entity.id.split(':')[1]}`;
}
export function trailHref(ids: string[]) { return `${PARIS_ROOT}/trails?path=${encodeURIComponent(ids.join(','))}`; }
export function parseTrail(raw: string | null, entities: DiscoveryEntity[]): string[] {
  if(!raw) return [];
  const ids = raw.split(',');
  if(ids.length > 24 || ids.some(id => !entities.some(e => e.id === id)) || ids.some((id,i) => i > 0 && !connectionBetween(ids[i-1],id))) throw Error('This trail contains an unavailable connection.');
  return ids;
}
export function branchTrail(ids: string[], index: number, next: string) {
  if(index < 0 || index >= ids.length || index >= 23 || !connectionBetween(ids[index],next)) throw Error('Cannot follow this connection');
  return [...ids.slice(0,index+1),next];
}
export function searchEntities(entities: DiscoveryEntity[], catalog: CultureCatalog, q: string, kind = '') {
  const norm = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
  const terms = norm(q).trim().split(/\s+/).filter(Boolean);
  return entities.filter(e => (!kind || e.kind === kind) && terms.every(t => norm(`${e.title} ${e.summary} ${catalog.works.find(w => w.id === e.workId)?.creator ?? ''}`).includes(t)));
}
export function parisDate(date = new Date()) { return new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Paris',year:'numeric',month:'2-digit',day:'2-digit'}).format(date); }
export function dailyStory(date = new Date(), data = parisDiscovery) {
  const stories = data.entities.filter(e => e.kind === 'story');
  const day = Math.floor(Date.parse(`${parisDate(date)}T00:00:00Z`)/86400000);
  return stories[((day % stories.length)+stories.length)%stories.length];
}
export function readingMinutes(entity: DiscoveryEntity) { return Math.max(1,Math.ceil((entity.paragraphs ?? []).join(' ').split(/\s+/).length/200)); }
export function placeFor(entity: DiscoveryEntity) { return places.find(p => p.id === entity.placeId); }
export const beforeSunsetPlaces = parisDiscovery.connections.filter(c => c.review === 'reviewed' && c.from === 'work:before-sunset' && c.to.startsWith('place:')).map(c => ({entity:parisDiscovery.entities.find(e => e.id === c.to)!,connection:c}));
