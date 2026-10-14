import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { authorizeSpotify, clearSpotifySession, finishSpotifyLogin, hasSpotifySession, safeReturnPath, SPOTIFY_CALLBACK, spotifyToken, spotifyTracks, startSpotifyTracks } from '../../lib/culture/spotify';
import type { CultureWork } from '../../lib/culture/schema';
import '../../styles/spotify-player.css';
import { usePlaybackFocus } from './PlaybackFocus';

type Playback = { paused: boolean; position: number; duration: number; track_window: {current_track: {id: string; name: string; uri: string; artists: {name: string}[]; album: {images: {url: string}[]}}} };
type SDKPlayer = {
  addListener: (event: string, listener: (value: never) => void) => void;
  connect: () => Promise<boolean>; disconnect: () => void; activateElement: () => Promise<void>;
  togglePlay: () => Promise<void>; previousTrack: () => Promise<void>; nextTrack: () => Promise<void>;
  setVolume: (volume: number) => Promise<void>;
  seek: (position: number) => Promise<void>; getCurrentState: () => Promise<Playback | null>;
};
declare global {
  interface Window {
    Spotify?: {Player: new (options: {name: string; getOAuthToken: (cb: (token: string) => void) => void; volume: number}) => SDKPlayer};
    onSpotifyWebPlaybackSDKReady?: () => void;
  }
}
let sdkLoading: Promise<void> | undefined;
function loadSDK() {
  if (window.Spotify) return Promise.resolve();
  if (!sdkLoading) sdkLoading = new Promise<void>((resolve, reject) => {
    const script = document.createElement('script');
    const timer = window.setTimeout(() => { script.remove(); sdkLoading = undefined; reject(Error('Spotify took too long to load. Please try again.')); }, 15000);
    window.onSpotifyWebPlaybackSDKReady = () => { clearTimeout(timer); resolve(); };
    script.src = 'https://sdk.scdn.co/spotify-player.js'; script.async = true;
    script.onerror = () => { clearTimeout(timer); script.remove(); sdkLoading = undefined; reject(Error('Spotify could not load. Check your connection or browser settings.')); };
    document.head.appendChild(script);
  });
  return sdkLoading;
}
type Selection = {ids: string[]; index: number};
type Controls = {toggle: () => void; play: (ids: string[], index?: number) => void; busy: boolean; currentId?: string; paused: boolean};
const SpotifyContext = createContext<Controls | null>(null);
const time = (ms: number) => `${Math.floor(ms / 60000)}:${String(Math.floor(ms / 1000) % 60).padStart(2, '0')}`;

export function SpotifyProvider({children, works = []}: {children: ReactNode; works?: CultureWork[]}) {
  const location = useLocation(), navigate = useNavigate();
  const focus = usePlaybackFocus();
  const player = useRef<SDKPlayer | null>(null), device = useRef<string | null>(null);
  const generation = useRef(0), requestVersion = useRef(0), locked = useRef(false);
  const [selection, setSelection] = useState<Selection | null>(null);
  const [playback, setPlayback] = useState<Playback | null>(null);
  const [busy, setBusy] = useState(false), [message, setMessage] = useState('');
  const [volume,setVolume]=useState(0.5);
  const [connected, setConnected] = useState(false);
  const [needsAuth, setNeedsAuth] = useState(false);
  const dock = useRef<HTMLElement>(null);
  const [dockHeight, setDockHeight] = useState(0);
  const stop = useCallback(() => { requestVersion.current++; generation.current++; player.current?.disconnect(); player.current = null; device.current = null; setNeedsAuth(false); setConnected(false); setPlayback(null); setSelection(null); setMessage(''); }, []);
  useEffect(() => () => { focus.release(stop); }, [focus, stop]);
  const report = (error: unknown) => setMessage(error instanceof Error ? error.message : 'Spotify playback is unavailable. Please try again.');
  useEffect(() => () => { generation.current++; player.current?.disconnect(); player.current = null; device.current = null; }, []);
  useEffect(() => {
    if (location.pathname !== SPOTIFY_CALLBACK) return;
    let active = true;
    setBusy(true);
    void finishSpotifyLogin(location.search).then(login => {
      if (!active) return;
      const ids = login.ids.filter(id => spotifyTracks[id]);
      focus.claim(stop);
      setSelection({ids, index: Math.min(login.index, Math.max(0, ids.length - 1))});
      setNeedsAuth(false); setConnected(true); setBusy(false); setMessage('Spotify connected. Press Play to begin listening.');
      navigate(safeReturnPath(login.returnTo), {replace: true});
    }).catch(error => {
      if (active) { setBusy(false); report(error); navigate('/discover/place/paris', {replace: true}); }
    }).finally(() => { if (active) setBusy(false); });
    return () => { active = false; };
  }, [location.pathname, location.search, navigate, focus, stop]);
  useEffect(() => {
    if (!playback || playback.paused) return;
    const timer = window.setInterval(() => {
      void player.current?.getCurrentState().then(state => { if (state) setPlayback(state); }).catch(() => {});
    }, 1000);
    return () => clearInterval(timer);
  }, [playback?.paused, !!playback]);

  async function ensurePlayer() {
    if (player.current && device.current) return {player: player.current, device: device.current};
    const version = ++generation.current;
    await loadSDK();
    if (version !== generation.current) throw Error('Spotify connection was closed.');
    player.current?.disconnect();
    const instance = new window.Spotify!.Player({name: 'Elsewhere · Paris', volume,
      getOAuthToken: cb => { void spotifyToken().then(cb).catch(report); }});
    player.current = instance;
    const isCurrent = () => version === generation.current && player.current === instance;
    instance.addListener('player_state_changed', (state: Playback | null) => { if (isCurrent()) setPlayback(state); });
    instance.addListener('not_ready', () => { if (!isCurrent()) return; device.current = null; setPlayback(null); setMessage('Spotify disconnected. Press Play to reconnect.'); });
    instance.addListener('autoplay_failed', () => setMessage('Your browser paused playback. Press Play to listen.'));
    return new Promise<{player: SDKPlayer; device: string}>((resolve, reject) => {
      const timer = window.setTimeout(() => { if (isCurrent()) { generation.current++; player.current = null; device.current = null; } instance.disconnect(); reject(Error('Spotify could not connect. Please try again.')); }, 15000);
      const fail = (text: string) => { clearTimeout(timer); if (isCurrent()) { generation.current++; player.current = null; device.current = null; setPlayback(null); setMessage(text); } instance.disconnect(); reject(Error(text)); };
      instance.addListener('ready', ({device_id}: {device_id: string}) => {
        clearTimeout(timer);
        if (version !== generation.current) { instance.disconnect(); reject(Error('Spotify connection was closed.')); return; }
        device.current = device_id; setConnected(true); resolve({player: instance, device: device_id});
      });
      instance.addListener('authentication_error', () => { if (!isCurrent()) return; clearSpotifySession(); setNeedsAuth(true); device.current = null; setPlayback(null); setConnected(false); fail('Please reconnect Spotify.'); });
      instance.addListener('account_error', () => fail('A Spotify Premium account is required to listen here.'));
      instance.addListener('initialization_error', () => fail('This browser cannot initialize Spotify playback. Try another browser or open Spotify.'));
      instance.addListener('playback_error', () => setMessage('This recording is unavailable for playback. Try another song or open Spotify.'));
      void instance.connect().then(ok => { if (!ok) fail('Spotify could not connect. Please try again.'); }).catch(() => fail('Spotify could not connect. Please try again.'));
    });
  }
  async function play(ids: string[], index = 0) {
    if (locked.current || !ids.length) return;
    focus.claim(stop);
    const request = ++requestVersion.current;
    locked.current = true; setBusy(true); setMessage(''); setSelection({ids, index});
    // Called before the first await when the player exists, preserving the user gesture on iOS.
    try {
      if (!hasSpotifySession()) { setNeedsAuth(true); setMessage('Connect your Spotify account to listen here. Premium Individual, Duo and Family are supported.'); return; }
      setNeedsAuth(false);
      const activation = player.current?.activateElement();
      if (activation) await activation;
      const ready = await ensurePlayer();
      if (!activation) await ready.player.activateElement();
      if (request !== requestVersion.current) return;
      await startSpotifyTracks(ready.device, ids, index);
    } catch (error) { if (request !== requestVersion.current) return; if (!hasSpotifySession()) { setNeedsAuth(true); setPlayback(null); } report(error); }
    finally { locked.current = false; setBusy(false); }
  }
  async function control(action: 'togglePlay' | 'previousTrack' | 'nextTrack', position?: number) {
    if (locked.current) return;
    if (!player.current || !device.current) { if (selection) void play(selection.ids, selection.index); return; }
    locked.current = true; setBusy(true); setMessage('');
    try { await player.current.activateElement(); await (position === undefined ? player.current[action]() : player.current.seek(position)); }
    catch (error) { report(error); }
    finally { locked.current = false; setBusy(false); }
  }
  async function connect() {
    if (!selection || locked.current) return;
    locked.current = true; setBusy(true);
    try { await authorizeSpotify(selection.ids, selection.index, location.pathname + location.search); }
    catch (error) { report(error); }
    finally { locked.current = false; setBusy(false); }
  }
  const current = playback?.track_window.current_track;
  const currentId = Object.keys(spotifyTracks).find(id => spotifyTracks[id] === current?.id);
  const selectedId = currentId ?? selection?.ids[selection.index];
  const selectedWork = works.find(work => work.id === selectedId);
  const spotifyId = current?.id ?? (selectedId ? spotifyTracks[selectedId] : undefined);
  const visible = !!selection || !!message || location.pathname === SPOTIFY_CALLBACK;
  useEffect(() => {
    if (!visible || !dock.current) return;
    const observer = new ResizeObserver(entries => setDockHeight(entries[0].target.getBoundingClientRect().height));
    observer.observe(dock.current);
    return () => observer.disconnect();
  }, [visible]);
  return <SpotifyContext.Provider value={{play, toggle: () => void control('togglePlay'), busy, currentId, paused: playback?.paused ?? true}}>
    {children}
    {visible && <div className="ew-spotify-space" style={{height: dockHeight || undefined}}><section ref={dock} className="ew-spotify-player" aria-label="Spotify music player">
      <div className="ew-spotify-track">{current?.album.images[0] ? <img src={current.album.images[0].url} alt="" width="64" height="64"/> : <span className="ew-player-art" aria-hidden="true">♫</span>}<div><small>ELSEWHERE · SPOTIFY</small><strong>{current?.name ?? selectedWork?.title ?? 'Paris · eight songs'}</strong><span>{current?.artists.map(artist => artist.name).join(', ') ?? selectedWork?.creator ?? 'Listen while you explore'}</span></div></div>
      <p className="ew-player-state" role="status">{busy ? 'Connecting…' : needsAuth ? 'Ready to connect' : playback ? playback.paused ? 'Paused' : 'Streaming on Spotify' : 'Ready to play'}</p>
      <div className="ew-spotify-controls">
        <button type="button" disabled={busy || !playback} onClick={() => void control('previousTrack')} aria-label="Previous song">‹</button>
        <button type="button" disabled={busy || !selection} onClick={() => needsAuth ? void connect() : playback ? void control('togglePlay') : selection && void play(selection.ids, selection.index)}>{busy ? 'Please wait…' : needsAuth ? 'Connect Spotify' : !playback || playback.paused ? 'Play' : 'Pause'}</button>
        <button type="button" disabled={busy || !playback} onClick={() => void control('nextTrack')} aria-label="Next song">›</button>
      </div>
      {playback && <SeekBar position={playback.position} duration={playback.duration} disabled={busy} onSeek={position => void control('togglePlay', position)}/>}
      {playback && <label className="ew-player-volume">Volume<input type="range" min="0" max="1" step="0.05" value={volume} disabled={busy} onChange={event=>{const value=Number(event.target.value);setVolume(value);void player.current?.setVolume(value).catch(report);}}/></label>}
      <div className="ew-spotify-links">{spotifyId && <a href={`https://open.spotify.com/track/${spotifyId}`} target="_blank" rel="noreferrer">Open in Spotify ↗</a>}{selectedId && <Link to={`/discover/work/${selectedId}`}>Song story</Link>}<button type="button" disabled={busy} onClick={() => {generation.current++; player.current?.disconnect(); player.current = null; device.current = null; clearSpotifySession(); setNeedsAuth(false); setConnected(false); setPlayback(null); setSelection(null); setMessage('');}}>{connected ? 'Disconnect' : 'Close'}</button></div>
      {message && <p className="ew-spotify-message" role="status">{message}</p>}
    </section></div>}
  </SpotifyContext.Provider>;
}

export function SpotifyPlay({work, tracks, index = 0}: {work: CultureWork; tracks?: CultureWork[]; index?: number}) {
  const controls = useContext(SpotifyContext);
  const ids = tracks?.map(track => track.id) ?? (work.kind === 'playlist' ? work.tracks : [work.id]);
  if (!controls || !ids?.length || ids.some(id => !spotifyTracks[id])) return null;
  const selected = work.kind === 'song' && controls.currentId === work.id;
  const active = selected && !controls.paused;
  return <button className="ew-spotify-play" type="button" disabled={controls.busy} aria-label={`${active ? 'Pause' : 'Play'} ${work.title} on Spotify`} onClick={() => selected ? controls.toggle() : controls.play(ids, index)}>{active ? 'Pause Spotify' : selected ? 'Resume Spotify' : '▶ Play on Spotify'}</button>;
}
export function SpotifyCallback() { return <p role="status">Connecting Spotify…</p>; }

function SeekBar({position, duration, disabled, onSeek}: {position: number; duration: number; disabled: boolean; onSeek: (position: number) => void}) {
  const [draft, setDraft] = useState<number | null>(null);
  const value = draft ?? position;
  const commit = () => { if (draft !== null) { onSeek(draft); setDraft(null); } };
  return <div className="ew-spotify-progress"><span>{time(value)}</span><input aria-label="Playback position" aria-valuetext={`${time(value)} of ${time(duration)}`} type="range" min="0" step="1000" max={duration} value={value} disabled={disabled}
    onChange={event => setDraft(Number(event.target.value))} onPointerUp={commit} onPointerCancel={() => setDraft(null)} onBlur={commit}
    onKeyUp={event => { if (['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home','End','PageUp','PageDown'].includes(event.key)) commit(); }}/><span>{time(duration)}</span></div>;
}
