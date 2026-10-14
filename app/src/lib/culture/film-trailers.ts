import manifest from './film-trailers.json';
export type FilmTrailerSource = {videoId: string; url: string; title: string; publisher: string; thumbnail: string; checkedAt: string};
// Matched to the catalog film, director and release year. Thumbnail URLs come
// directly from YouTube oEmbed; these are trailer previews, not licensed posters.
export const filmTrailers: Record<string, FilmTrailerSource> = manifest;
export const filmTrailer = (id: string): FilmTrailerSource | undefined => Object.hasOwn(filmTrailers, id) ? filmTrailers[id] : undefined;
