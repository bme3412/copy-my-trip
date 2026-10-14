import { useCallback, useEffect, useRef, useState } from 'react';
import type { CultureWork } from '../../lib/culture/schema';
import { filmTrailer, type FilmTrailerSource } from '../../lib/culture/film-trailers';
import { loadYouTube, type Player } from '../../lib/culture/youtube-sdk';
import { usePlaybackFocus } from './PlaybackFocus';
import '../../styles/film-trailer.css';

export function TrailerThumbnail({work}: {work: CultureWork}) {
  const source = filmTrailer(work.id);
  const [failed, setFailed] = useState<string>();
  if (!source) return null;
  return <figure className="ew-trailer-thumbnail">
    {failed !== source.thumbnail ? <img src={source.thumbnail} alt={`${work.title} (${work.year}) · YouTube trailer thumbnail`} loading="lazy" decoding="async" width="480" height="360" onError={() => setFailed(source.thumbnail)}/> : <div className="ew-trailer-image-fallback">{work.title}</div>}
    <figcaption>YouTube trailer · {source.publisher}</figcaption>
  </figure>;
}
export function FilmTrailer({work, compact=false}: {work: CultureWork; compact?: boolean}) {
  const source = work.kind === 'film' ? filmTrailer(work.id) : undefined;
  return source ? <Trailer key={source.videoId} work={work} source={source} compact={compact}/> : null;
}
function Trailer({work, source, compact}: {work: CultureWork; source: FilmTrailerSource; compact: boolean}) {
  const focus = usePlaybackFocus();
  const [open, setOpen] = useState(false), [message, setMessage] = useState('');
  const [failed, setFailed] = useState(false), [attempt, setAttempt] = useState(0);
  const host = useRef<HTMLDivElement>(null), player = useRef<Player | null>(null);
  const stop = useCallback(() => { player.current?.destroy(); player.current = null; setOpen(false); setMessage(''); setFailed(false); }, []);
  const start = () => { focus.claim(stop); setFailed(false); setOpen(true); setAttempt(value => value + 1); };
  useEffect(() => {
    if (!open) return;
    let active = true;
    let instance: Player | undefined;
    let timer: number | undefined;
    const fail = (message: string) => { if (active) { setFailed(true); setMessage(message); } };
    setMessage('Loading trailer…');
    void loadYouTube().then(() => {
      if (!active || !host.current) return;
      const element = document.createElement('div'); host.current.replaceChildren(element);
      timer = window.setTimeout(() => fail('The trailer took too long to load. Retry or watch it on YouTube.'), 15000);
      instance = new window.YT!.Player(element, {width: '100%', height: '100%', videoId: source.videoId,
        playerVars: {controls: 1, playsinline: 1, autoplay: 0, rel: 0, origin: window.location.origin},
        events: {
          onReady: event => { if (!active) return; clearTimeout(timer); setMessage(''); setFailed(false); event.target.getIframe().title = `${work.title} · YouTube trailer`; if (!document.hidden) event.target.playVideo(); },
          onStateChange: event => { if (!active) return; if (event.data === 1) { if (document.hidden) event.target.pauseVideo(); setMessage(''); setFailed(false); } },
          onError: event => { clearTimeout(timer); fail(event.data === 101 || event.data === 150 ? 'This trailer cannot play on other websites. Watch it on YouTube using the link below.' : 'This trailer is unavailable in this player. Retry or watch it on YouTube.'); },
          onAutoplayBlocked: () => { if (active) setMessage('Press Play in the video to watch the trailer.'); },
        },
      });
      player.current = instance;
    }).catch(error => fail(error instanceof Error ? error.message : 'The trailer could not load.'));
    const pause = () => { if (document.hidden) player.current?.pauseVideo?.(); };
    document.addEventListener('visibilitychange', pause);
    const observer = new IntersectionObserver(entries => {
      if (entries[0].intersectionRatio < 0.5) player.current?.pauseVideo?.();
    }, {threshold: 0.5});
    if (host.current) observer.observe(host.current);
    return () => { active = false; clearTimeout(timer); observer.disconnect(); document.removeEventListener('visibilitychange', pause); if (player.current === instance) { instance?.destroy(); player.current = null; } };
  }, [open, attempt, source, work.title]);
  useEffect(() => () => { focus.release(stop); }, [focus, stop]);
  return <section id="film-trailer" className="ew-film-trailer" aria-label={`${work.title} trailer`}>
    <div className="ew-trailer-heading">{!compact && <div><p className="ew-eyebrow">Watch on YouTube</p><h2>Watch the trailer</h2></div>}{open && <button type="button" className="ew-button" onClick={() => { stop(); focus.release(stop); }}>Close trailer</button>}</div>
    {open ? <div ref={host} className="ew-trailer-video"/> : <button className="ew-trailer-launch" type="button" onClick={start} aria-label={`Watch ${work.title} trailer`}><TrailerThumbnail work={work}/><span className="ew-trailer-cta">▶ Watch trailer</span></button>}
    {!compact && <p className="ew-trailer-source">{source.publisher} · Trailer for {work.title} ({work.year})</p>}
    <a className="ew-link" href={source.url} target="_blank" rel="noreferrer">Watch trailer on YouTube</a>
    {message && <p role="status" className="ew-small">{message}</p>}{failed && <button type="button" className="ew-button" onClick={start}>Retry trailer</button>}
  </section>;
}
