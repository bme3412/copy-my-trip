import { authenticate, cloudConfig, HttpError, type CloudConfig } from '../server/auth.js';
import { tripRpc } from '../server/trips.js';
type Request = { method?: string; headers: Record<string, string | string[] | undefined>; body?: unknown };
type Response = { setHeader(k: string, v: string): void; status(code: number): { json(body: unknown): void } };
export async function confirmPassword(config: CloudConfig, authorization: string, password: string, fetcher: typeof fetch = fetch) {
  const user = await authenticate(authorization, config, fetcher);
  const response = await fetcher(`${config.url}/auth/v1/token?grant_type=password`, {
    method: 'POST', headers: { apikey: config.key, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: user.email, password }), signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) throw new HttpError(response.status === 429 ? 429 : 403, 'Could not confirm your password. Check it and try again later.');
  const data = await response.json();
  if (data.user?.id !== user.id || typeof data.access_token !== 'string') throw new HttpError(403, 'Account verification failed.');
  return `Bearer ${data.access_token}`;
}
export async function handleAccount(req: Request, res: Response, deps = { config: cloudConfig, confirmPassword, rpc: tripRpc }) {
  res.setHeader('Cache-Control', 'private, no-store'); res.setHeader('Vary', 'Authorization'); res.setHeader('X-Content-Type-Options', 'nosniff');
  try {
    if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); throw new HttpError(405, 'Method not allowed.'); }
    const body = req.body as { action?: unknown; confirmation?: unknown; password?: unknown } | undefined;
    if (Number(req.headers['content-length'] ?? 0) > 4096) throw new HttpError(413, 'Request too large.');
    if (!body || body.action !== 'delete' || body.confirmation !== 'DELETE' || typeof body.password !== 'string' || !body.password || body.password.length > 1024 || Object.keys(body).some(k => !['action', 'confirmation', 'password'].includes(k))) throw new HttpError(400, 'Confirm deletion and enter your current password.');
    if (typeof req.headers.authorization !== 'string') throw new HttpError(401, 'Sign in before deleting your account.');
    const config = deps.config();
    const fresh = await deps.confirmPassword(config, req.headers.authorization, body.password);
    const result = await deps.rpc(config, fresh, 'cmt_delete_account', {});
    if ((result as { deleted?: boolean })?.deleted !== true) throw new HttpError(503, 'Deletion could not be confirmed. Try signing in to check the account.');
    res.status(200).json({ deleted: true });
  } catch (e) { res.status(e instanceof HttpError ? e.status : 503).json({ error: e instanceof HttpError ? e.message : 'Account service unavailable. Deletion could not be confirmed.' }); }
}
export default handleAccount;
