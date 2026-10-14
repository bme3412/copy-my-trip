// Public application identifier. PKCE does not use a client secret.
export const SPOTIFY_CLIENT_ID = '139bdf08c42847e3873cbcf5f9a2e5d0';
export const SPOTIFY_CALLBACK = '/discover/spotify/callback';
// Spotify catalog versions checked 2026-10-13 against open.spotify.com/track/<id>.
// These are listening alternatives, not claims that the archival performances match.
export const spotifyTracks: Record<string, string> = {
  'paris-seveille': '6U17dRp3HxCaIxOJbQ3Rxt',
  'sous-le-ciel-de-paris': '6978TS7bafY4CzYNQQceuI',
  'la-boheme': '1WvvmEowf7hiz5EnyAwtTj',
  'jai-deux-amours': '6LRIyXY8nWAPLR9AezgSbQ',
  'les-champs-elysees': '2jgbxmCRAbqK1dSMY33g6A',
  'la-seine': '3eDfI95LLKOFEEZl5jrnnj',
  'paris-sera-toujours-paris': '3ODF5U2ymITfYuszl4CJAa',
  'florence-sur-les-champs-elysees': '7hQ8Zgp1B4vBwIL60NtGzn',
};
const TOKEN_KEY = 'elsewhere.spotify.token.v1';
const LOGIN_KEY = 'elsewhere.spotify.login.v1';
type Token = { access_token: string; refresh_token: string; expires_at: number };
type Login = { verifier: string; state: string; created: number; returnTo: string; ids: string[]; index: number };
const random = () => Array.from(crypto.getRandomValues(new Uint8Array(32)), n => n.toString(16).padStart(2, '0')).join('');
export function safeReturnPath(path: string) {
  return path.startsWith('/discover/') && !path.startsWith(SPOTIFY_CALLBACK) ? path : '/discover/place/paris';
}
let sessionGeneration = 0;
export function clearSpotifySession() { sessionGeneration++; sessionStorage.removeItem(TOKEN_KEY); }
export function hasSpotifySession() {
  try { const token = JSON.parse(sessionStorage.getItem(TOKEN_KEY) ?? 'null') as Token | null; return !!token?.access_token && !!token.refresh_token && Number.isFinite(token.expires_at); }
  catch { return false; }
}
export async function authorizeSpotify(ids: string[], index: number, returnTo: string) {
  const verifier = random(), state = random();
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
  const challenge = btoa(String.fromCharCode(...new Uint8Array(digest))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  sessionStorage.setItem(LOGIN_KEY, JSON.stringify({ verifier, state, created: Date.now(), returnTo: safeReturnPath(returnTo), ids, index }));
  const params = new URLSearchParams({client_id: SPOTIFY_CLIENT_ID, response_type: 'code', redirect_uri: location.origin + SPOTIFY_CALLBACK,
    code_challenge_method: 'S256', code_challenge: challenge, state,
    scope: 'streaming user-read-email user-read-private user-modify-playback-state'});
  location.assign(`https://accounts.spotify.com/authorize?${params}`);
}
async function exchange(params: URLSearchParams, previousRefresh?: string): Promise<string> {
  const generation = sessionGeneration;
  const response = await fetch('https://accounts.spotify.com/api/token', {method: 'POST', headers: {'Content-Type': 'application/x-www-form-urlencoded'}, body: params, signal: AbortSignal.timeout(15000)});
  if (!response.ok) {
    if (response.status === 400 || response.status === 401) clearSpotifySession();
    throw Error('Spotify sign-in expired or could not be completed. Please connect again.');
  }
  const data = await response.json();
  const token: Token = {access_token: data.access_token, refresh_token: data.refresh_token ?? previousRefresh, expires_at: Date.now() + data.expires_in * 1000};
  if (generation !== sessionGeneration) throw Error('Spotify was disconnected. Please connect again.');
  if (!token.access_token || !token.refresh_token || !Number.isFinite(token.expires_at)) throw Error('Spotify returned an incomplete sign-in. Please connect again.');
  sessionStorage.setItem(TOKEN_KEY, JSON.stringify(token));
  return token.access_token;
}
let refreshing: Promise<string> | undefined;
export async function spotifyToken(): Promise<string> {
  const raw = sessionStorage.getItem(TOKEN_KEY);
  if (!raw || !hasSpotifySession()) { clearSpotifySession(); throw Error('Connect Spotify to listen here.'); }
  const token = JSON.parse(raw) as Token;
  if (token.expires_at > Date.now() + 60000) return token.access_token;
  if (!refreshing) refreshing = exchange(new URLSearchParams({grant_type: 'refresh_token', refresh_token: token.refresh_token, client_id: SPOTIFY_CLIENT_ID}), token.refresh_token).finally(() => { refreshing = undefined; });
  return refreshing;
}
let callback: Promise<Login> | undefined;
export function finishSpotifyLogin(search: string): Promise<Login> {
  // Deduplicate React StrictMode's effect replay; authorization codes are single-use.
  if (callback) return callback;
  callback = (async () => {
    const params = new URLSearchParams(search);
    const raw = sessionStorage.getItem(LOGIN_KEY);
    sessionStorage.removeItem(LOGIN_KEY);
    if (!raw) throw Error('Spotify sign-in could not be verified. Please connect again.');
    const login = JSON.parse(raw) as Login;
    if (!params.get('state') || params.get('state') !== login.state || Date.now() - login.created > 600000) throw Error('Spotify sign-in expired or could not be verified. Please connect again.');
    if (params.has('error')) throw Error('Spotify connection was cancelled. You can still use the listening links.');
    const code = params.get('code');
    if (!code) throw Error('Spotify did not return an authorization code.');
    await exchange(new URLSearchParams({grant_type: 'authorization_code', code, redirect_uri: location.origin + SPOTIFY_CALLBACK, client_id: SPOTIFY_CLIENT_ID, code_verifier: login.verifier}));
    return login;
  })();
  return callback;
}
export async function startSpotifyTracks(device: string, ids: string[], index: number) {
  const uris = ids.map(id => spotifyTracks[id]).map(id => `spotify:track:${id}`);
  if (!ids.length || ids.some(id => !spotifyTracks[id]) || !Number.isInteger(index) || index < 0 || index >= ids.length) throw Error('This Spotify selection is unavailable.');
  const response = await fetch(`https://api.spotify.com/v1/me/player/play?device_id=${encodeURIComponent(device)}`, {
    method: 'PUT', headers: {Authorization: `Bearer ${await spotifyToken()}`, 'Content-Type': 'application/json'},
    body: JSON.stringify({uris, offset: {position: index}}), signal: AbortSignal.timeout(15000),
  });
  if (response.status === 401) { clearSpotifySession(); throw Error('Please reconnect Spotify.'); }
  if (response.status === 403) throw Error('Spotify playback needs Premium and access to this developer app. You can also open the song in Spotify.');
  if (response.status === 429) throw Error('Spotify is busy. Please wait a moment before trying again.');
  if (!response.ok) throw Error('Spotify could not play this selection. Try again or open the song in Spotify.');
}
