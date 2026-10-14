import '../../styles/floating-player.css';
import type { ReactNode } from 'react';
import type { CultureWork } from '../../lib/culture/schema';
import { youtubeTracks } from '../../lib/culture/youtube';
import { PlaybackFocusProvider } from './PlaybackFocus';
import { SpotifyPlay, SpotifyProvider } from './SpotifyPlayer';
import { YouTubePlay, YouTubeProvider } from './YouTubePlayer';

export function MusicProvider({children, works}: {children: ReactNode; works: CultureWork[]}) {
  return <PlaybackFocusProvider><SpotifyProvider works={works}><YouTubeProvider works={works}>{children}</YouTubeProvider></SpotifyProvider></PlaybackFocusProvider>;
}
export function MusicPlay({work, tracks, index = 0}: {work: CultureWork; tracks?: CultureWork[]; index?: number}) {
  if (!youtubeTracks[work.id] && work.id !== 'paris-playlist') return null;
  return <div className="ew-music-options"><SpotifyPlay work={work} tracks={tracks} index={index}/><YouTubePlay work={work} tracks={tracks} index={index}/>{work.kind === 'song' && <small>{youtubeTracks[work.id].format}</small>}</div>;
}
