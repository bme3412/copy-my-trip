import { useCallback, useEffect, useState } from 'react';
import type { CultureWork } from '../../lib/culture/schema';
import { usePlaybackFocus } from './PlaybackFocus';

export function PodcastPlayer({work}: {work: CultureWork}) {
  const [opened, setOpened] = useState(false);
  const focus = usePlaybackFocus();
  const stop = useCallback(() => setOpened(false), []);
  const link = work.listeningLinks?.find(link => {
    try { const url = new URL(link.url); return url.hostname === 'open.spotify.com' && /^\/episode\/[A-Za-z0-9]{22}$/.test(url.pathname); }
    catch { return false; }
  });
  useEffect(() => () => focus.release(stop), [focus, stop]);
  if (work.kind !== 'podcast_episode' || !link) return null;
  const id = new URL(link.url).pathname.split('/').pop();
  return <section aria-label="Spotify podcast player" className="ew-podcast-player">
    {opened ? <><iframe title={`Spotify: ${work.title}`} src={`https://open.spotify.com/embed/episode/${id}`} width="100%" height="232" style={{border:0,borderRadius:12,display:'block'}} allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"/><button type="button" className="ew-button" onClick={() => {stop(); focus.release(stop);}}>Close player</button></> : <button type="button" className="ew-button" onClick={() => {focus.claim(stop); setOpened(true);}}>Listen here with Spotify</button>}
  </section>;
}
