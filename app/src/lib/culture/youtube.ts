// Public publisher uploads and oEmbed metadata reviewed 2026-10-13.
// oEmbed availability is not a guarantee of playback in every region/browser.
export type YouTubeRecording = { videoId: string; format: string; publisher: string; note?: string };
export const youtubeTracks: Record<string, YouTubeRecording> = {
  'paris-seveille': {videoId: '3WcCg6rm3uM', format: 'Archive performance', publisher: 'INA Chansons', note: '18 April 1968 performance; differs from the March broadcast linked in the song story.'},
  'sous-le-ciel-de-paris': {videoId: 'SC06NyI6KKU', format: 'Official audio', publisher: 'Edith Piaf Officiel'},
  'la-boheme': {videoId: 'qEVfXcdrk_4', format: 'Archive performance', publisher: 'INA Chansons', note: '4 January 1968 performance; a different recording from the lyrics video in the song story.'},
  'jai-deux-amours': {videoId: 'gRfrUdsL4Pk', format: 'Archive performance', publisher: 'INA Chansons'},
  'les-champs-elysees': {videoId: 'bb-DKKRN4o8', format: 'Animated music video', publisher: 'joedassinVEVO'},
  'la-seine': {videoId: 'vlPZLE2g0Kc', format: 'Film music video', publisher: 'EUROPACORP'},
  'paris-sera-toujours-paris': {videoId: 'tmiI98EG1Fo', format: 'Music video', publisher: 'Zaz Official'},
  'florence-sur-les-champs-elysees': {videoId: 'BDkfB41TDEs', format: 'Official audio', publisher: 'Miles Davis - Topic', note: 'Soundtrack audio with cover artwork, not a film clip.'},
};
export const youtubeWatchUrl = (id: string) => `https://www.youtube.com/watch?v=${youtubeTracks[id].videoId}`;
export function validYouTubeQueue(ids: string[], index: number) {
  return ids.length > 0 && Number.isInteger(index) && index >= 0 && index < ids.length && ids.every(id => Object.hasOwn(youtubeTracks, id));
}
export function youtubeError(code: number) {
  if (code === 101 || code === 150) return 'This video cannot play on other websites. Open it on YouTube, choose Spotify, or skip to the next song.';
  if (code === 100) return 'This video is no longer available. Try the next song or Spotify.';
  if (code === 153) return 'YouTube could not verify this browser. Open the video on YouTube or choose Spotify.';
  return 'YouTube could not play this video. Retry, open it on YouTube, or choose another song.';
}
