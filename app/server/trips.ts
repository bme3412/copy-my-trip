import { HttpError, type CloudConfig } from './auth.js';
export async function tripRpc(config: CloudConfig, authorization: string, name: string, params: unknown, fetcher: typeof fetch = fetch): Promise<unknown> {
  const response = await fetcher(`${config.url}/rest/v1/rpc/${name}`, {
    method: 'POST', headers: { apikey: config.key, Authorization: authorization, 'Content-Type': 'application/json' },
    body: JSON.stringify(params), signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    if (error.code === 'PT409') throw new HttpError(409, 'The cloud trip changed or was deleted. Reload its current version before deciding what to save.');
    if (error.code === 'PT404') throw new HttpError(404, 'This cloud trip is unavailable.');
    if (error.code === 'PT413') throw new HttpError(413, 'Cloud storage limit reached. Export your trips before removing older copies.');
    if (response.status === 401 || response.status === 403) throw new HttpError(401, 'Sign in again to access this trip.');
    throw new HttpError(503, 'Cloud saving is unavailable. Your local copy has been kept.');
  }
  return response.json();
}
