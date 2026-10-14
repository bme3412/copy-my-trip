import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import type { CultureWork } from '../../lib/culture/schema';
import { validYouTubeQueue, youtubeError, youtubeTracks, youtubeWatchUrl } from '../../lib/culture/youtube';
import { usePlaybackFocus } from './PlaybackFocus';
import { SpotifyPlay } from './SpotifyPlayer';
import '../../styles/youtube-player.css';
import { loadYouTube, type Player } from '../../lib/culture/youtube-sdk';

type Selection = {ids: string[]; index: number};
type Controls = {play: (ids: string[], index: number) => void; toggle: () => void; currentId?: string; playing: boolean};
const YouTubeContext = createContext<Controls | null>(null);

export function YouTubeProvider({children, works}: {children: ReactNode; works: CultureWork[]}) {
  const focus = usePlaybackFocus();
  const [selection, setSelection] = useState<Selection | null>(null);
  const selected = useRef<Selection | null>(null);
  const player = useRef<Player | null>(null), ready = useRef(false);
  const host = useRef<HTMLDivElement>(null), dock = useRef<HTMLElement>(null);
  const [playing, setPlaying] = useState(false), [message, setMessage] = useState('');
  const [retry, setRetry] = useState(0), [failed, setFailed] = useState(false);
  const [dockHeight, setDockHeight] = useState(0);
  const stop = useCallback(() => {
    ready.current = false;
    player.current?.destroy(); player.current = null;
    selected.current = null; setSelection(null); setPlaying(false); setMessage(''); setFailed(false);
  }, []);
  const play = useCallback((ids: string[], index: number) => {
    if (!validYouTubeQueue(ids, index)) return;
    focus.claim(stop);
    selected.current = {ids, index}; setSelection({ids, index}); setPlaying(false); setMessage('');
    if (ready.current) player.current?.loadVideoById(youtubeTracks[ids[index]].videoId);
    else setRetry(value => value + 1);
    setFailed(false);
  }, [focus, stop]);
  const move = useCallback((delta: number) => {
    const queue = selected.current;
    if (queue && validYouTubeQueue(queue.ids, queue.index + delta)) play(queue.ids, queue.index + delta);
  }, [play]);
  const visible = selection !== null;
  useEffect(() => {
    if (!visible) return;
    let active = true;
    let instance: Player | undefined;
    let timer: number | undefined;
    ready.current = false; setMessage('Loading YouTube…');
    const fail = (text: string) => { if (active) { setMessage(text); setFailed(true); setPlaying(false); } };
    void loadYouTube().then(() => {
      if (!active || !host.current || !selected.current) return;
      const element = document.createElement('div'); host.current.replaceChildren(element);
      timer = window.setTimeout(() => fail('YouTube took too long to connect. Retry or open the video on YouTube.'), 15000);
      instance = new window.YT!.Player(element, {
        width: '100%', height: '100%', videoId: youtubeTracks[selected.current.ids[selected.current.index]].videoId,
        playerVars: {playsinline: 1, controls: 1, autoplay: 0, origin: window.location.origin, rel: 0},
        events: {
          onReady: event => {
            if (!active) return;
            clearTimeout(timer); ready.current = true; setMessage(''); setFailed(false);
            event.target.getIframe().title = 'YouTube · Paris music player';
            // A fresh gesture may still be required by mobile/browser autoplay policy.
            if (document.hidden) setMessage('Press Play to begin listening.');
            else event.target.playVideo();
          },
          onStateChange: event => {
            if (!active) return;
            setPlaying(event.data === 1);
            if (event.data === 1) { if (document.hidden) event.target.pauseVideo(); setMessage(''); setFailed(false); }
            if (event.data === 0) move(1);
          },
          onError: event => { clearTimeout(timer); fail(youtubeError(event.data)); },
          onAutoplayBlocked: () => { if (active) { setPlaying(false); setMessage('Press Play in the video to begin listening.'); } },
        },
      });
      player.current = instance;
    }).catch(error => fail(error instanceof Error ? error.message : 'YouTube is unavailable.'));
    return () => { active = false; clearTimeout(timer); ready.current = false; if (player.current === instance) { instance?.destroy(); player.current = null; } };
  }, [visible, retry, move]);
  useEffect(() => () => { focus.release(stop); }, [focus, stop]);
  useEffect(() => {
    if (!visible || !dock.current) return;
    const observer = new ResizeObserver(entries => setDockHeight(entries[0].target.getBoundingClientRect().height));
    observer.observe(dock.current); return () => observer.disconnect();
  }, [visible]);
  useEffect(() => {
    if (!visible) return;
    const pauseHidden = () => { if (document.hidden && ready.current) player.current?.pauseVideo(); };
    document.addEventListener('visibilitychange', pauseHidden);
    const observer = new IntersectionObserver(entries => {
      if (entries[0].intersectionRatio < 0.5 && ready.current) player.current?.pauseVideo();
    }, {threshold: 0.5});
    if (host.current) observer.observe(host.current);
    return () => { document.removeEventListener('visibilitychange', pauseHidden); observer.disconnect(); };
  }, [visible]);
  const toggle = () => { if ((!ready.current || failed) && selected.current) { play(selected.current.ids, selected.current.index); return; } if (ready.current) { if (playing) player.current?.pauseVideo(); else player.current?.playVideo(); } };
  const id = selection?.ids[selection.index];
  const work = works.find(item => item.id === id);
  const recording = id ? youtubeTracks[id] : undefined;
  return <YouTubeContext.Provider value={{play, toggle, currentId: id, playing}}>
    {children}
    {selection && id && recording && <div className="ew-youtube-space" style={{height: dockHeight || undefined}}><section className="ew-youtube-player" ref={dock} aria-label="YouTube music player">
      <div className="ew-youtube-video" ref={host}/>
      <div className="ew-youtube-info">
        <div className="ew-youtube-heading"><small>PARIS · YOUTUBE · {selection.index + 1} / {selection.ids.length}</small><button type="button" onClick={() => { stop(); focus.release(stop); }} aria-label="Close YouTube player">Close ×</button></div>
        <strong>{work?.title}</strong><span>{work?.creator}</span>
        <p className="ew-youtube-credit">{recording.format} · {recording.publisher}{recording.note && <span>{recording.note}</span>}</p>
        <div className="ew-youtube-actions">
          <button type="button" disabled={selection.index === 0} onClick={() => move(-1)} aria-label="Previous YouTube song">‹ Previous</button>
          <button type="button" disabled={!ready.current || failed} onClick={toggle}>{playing ? 'Pause' : 'Play'}</button>
          <button type="button" disabled={selection.index === selection.ids.length - 1} onClick={() => move(1)} aria-label="Next YouTube song">Next ›</button>
          {failed && <button type="button" onClick={() => { setFailed(false); setRetry(value => value + 1); }}>Retry YouTube</button>}
        </div>
        <div className="ew-youtube-links"><a href={youtubeWatchUrl(id)} target="_blank" rel="noreferrer">Open in YouTube ↗</a><Link to={`/discover/work/${id}`}>Song story</Link>{work && <SpotifyPlay work={work} tracks={selection.ids.map(trackId => works.find(item => item.id === trackId)).filter((item): item is CultureWork => !!item)} index={selection.index}/>}</div>
        <p className="ew-youtube-status" role="status">{message}</p>
      </div>
    </section></div>}
  </YouTubeContext.Provider>;
}

export function YouTubePlay({work, tracks, index = 0}: {work: CultureWork; tracks?: CultureWork[]; index?: number}) {
  const controls = useContext(YouTubeContext);
  const ids = tracks?.map(track => track.id) ?? (work.kind === 'playlist' ? work.tracks : [work.id]);
  if (!controls || !ids || !validYouTubeQueue(ids, index)) return null;
  const selected = work.kind === 'song' && controls.currentId === work.id;
  const active = selected && controls.playing;
  return <button className="ew-youtube-play" type="button" aria-label={`${active ? 'Pause' : 'Play'} ${work.title} on YouTube`} onClick={() => selected ? controls.toggle() : controls.play(ids, index)}>{active ? 'Ⅱ Pause YouTube' : 'YouTube ↗'}</button>;
}
