import type { CultureCatalog } from './schema';
import { PARIS_ROOT, entitiesFor, parisDiscovery, placeFor } from './paris-discovery';

export const featuredParisIds = ['a-moveable-feast', 'before-sunset', 'call-my-agent', 'sous-le-ciel-de-paris', 'an-intro-to-jazz-in-paris', 'the-painter-of-modern-life'];
export const recentParisIds = ['the-belly-of-paris', 'paris-13th-district', 'full-time', 'paname-slimane', 'the-seine-past-and-present', 'an-attempt-at-exhausting-a-place-in-paris'];
export const overviewConnectionIds = ['sunset-shop', 'jazz-miles', 'song-seine'];
export const overviewPlaceIds = ['place:shakespeare', 'place:couleeverte'];
export const parisFormats = [
  ['Books', 'book'], ['Films', 'film'], ['TV shows', 'tv_show'], ['Music', 'song'],
  ['Podcast episodes', 'podcast_episode'], ['Essays', 'essay'], ['Playlists', 'playlist'],
] as const;
export const parisBrowse = (kind = '') => `/discover/browse?destination=paris${kind ? `&kind=${kind}` : ''}`;
export const isParisOverview = (pathname: string) => pathname.replace(/\/$/, '') === '/discover/place/paris';

export function overviewSelection(catalog: CultureCatalog) {
  const works = new Map(catalog.works.map(work => [work.id, work]));
  const select = (ids: string[]) => ids.map(id => {
    const work = works.get(id);
    if (!work || work.destinationId !== 'paris') throw Error(`Missing reviewed Paris selection: ${id}`);
    return work;
  });
  const entities = entitiesFor(catalog);
  const connections = overviewConnectionIds.map(id => {
    const connection = parisDiscovery.connections.find(c => c.id === id && c.review === 'reviewed');
    if (!connection || !entities.some(e => e.id === connection.from) || !entities.some(e => e.id === connection.to)) throw Error(`Unavailable reviewed connection: ${id}`);
    return connection;
  });
  const places = overviewPlaceIds.map(id => {
    const entity = entities.find(e => e.id === id);
    const place = entity && placeFor(entity);
    if (!place || !Number.isFinite(place.lat) || !Number.isFinite(place.lon)) throw Error(`Missing verified place: ${id}`);
    return {...place, name: entity.title};
  });
  const playlist = select(['paris-playlist'])[0];
  if (playlist.kind !== 'playlist' || !playlist.tracks?.length) throw Error('Paris playlist unavailable');
  return { featured: select(featuredParisIds), recent: select(recentParisIds), playlist, tracks: select(playlist.tracks), connections, places, entities };
}

export function isParisContext(pathname: string, search: string, catalog: CultureCatalog) {
  const path = pathname.replace(/\/$/, '');
  if (path === '/discover/place/paris' || path.startsWith('/discover/place/paris/')) return true;
  if (path === '/discover/browse') return new URLSearchParams(search).get('destination') === 'paris';
  const workId = path.match(/^\/discover\/work\/([^/]+)$/)?.[1];
  return !!workId && catalog.works.some(work => work.id === workId && work.destinationId === 'paris');
}
export function parisCounts(catalog: CultureCatalog) {
  const works = catalog.works.filter(work => work.destinationId === 'paris');
  return {total: works.length, byKind: Object.fromEntries(parisFormats.map(([, kind]) => [kind, works.filter(work => work.kind === kind).length]))};
}
export const parisSections = [
  ['Overview', PARIS_ROOT], ['Collections', PARIS_ROOT + '/collections'],
  ['Discovery trails', PARIS_ROOT + '/trails'], ['Places', PARIS_ROOT + '/places'],
  ['People', PARIS_ROOT + '/people'], ['Stories', PARIS_ROOT + '/stories'],
  ['My Paris atlas ↗', PARIS_ROOT + '/atlas'],
] as const;
