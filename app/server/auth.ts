export class HttpError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
export type CloudConfig = { url: string; key: string };
export function cloudConfig(): CloudConfig {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key || !key.startsWith('sb_publishable_')) throw new HttpError(503, 'Cloud saving is not configured. Your local trip is still available.');
  const parsed = new URL(url);
  if (parsed.protocol !== 'https:' || parsed.username || parsed.password || parsed.pathname !== '/') throw new HttpError(503, 'Cloud configuration is invalid.');
  return { url: parsed.origin, key };
}
export async function authenticate(authorization: string | undefined, config: CloudConfig, fetcher: typeof fetch = fetch) {
  if (!authorization || !/^Bearer [A-Za-z0-9._-]{20,8192}$/.test(authorization)) throw new HttpError(401, 'Sign in to use cloud saving.');
  const response = await fetcher(`${config.url}/auth/v1/user`, { headers: { apikey: config.key, Authorization: authorization }, signal: AbortSignal.timeout(10000) });
  if (response.status === 401 || response.status === 403) throw new HttpError(401, 'Your sign-in has expired. Sign in again.');
  if (!response.ok) throw new HttpError(503, 'Account verification is temporarily unavailable.');
  const user = await response.json();
  if (!user || typeof user.id !== 'string' || !/^[0-9a-f-]{36}$/i.test(user.id)) throw new HttpError(401, 'Account verification failed.');
  if (!user.email_confirmed_at || !user.email || user.is_anonymous) throw new HttpError(403, 'Verify your account email before saving trips online.');
  return { id: user.id as string, email: user.email as string, authorization };
}
