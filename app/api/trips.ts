import { authenticate, cloudConfig, HttpError } from '../server/auth.js';
import { tripRpc } from '../server/trips.js';
import { cloudId, MAX_CLOUD_BYTES, parseCloudTrip, parseHeads, parseWrite } from '../src/lib/cloud/schema.js';
type Request = { method?: string; headers: Record<string, string | string[] | undefined>; query?: Record<string, string | string[] | undefined>; body?: unknown };
type Response = { setHeader(k: string, v: string): void; status(code: number): { json(body: unknown): void } };
export async function handleTrips(req: Request, res: Response, deps = { config: cloudConfig, authenticate, rpc: tripRpc }) {
  res.setHeader('Cache-Control', 'private, no-store');
  res.setHeader('Vary', 'Authorization');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  try {
    if (!['GET', 'POST'].includes(req.method ?? '')) { res.setHeader('Allow', 'GET, POST'); throw new HttpError(405, 'Method not allowed.'); }
    if (Number(req.headers['content-length'] ?? 0) > MAX_CLOUD_BYTES) throw new HttpError(413, 'Request exceeds the cloud size limit.');
    const config = deps.config();
    const header = req.headers.authorization;
    const user = await deps.authenticate(typeof header === 'string' ? header : undefined, config);
    if (req.method === 'GET') {
      const id = req.query?.id;
      if (id !== undefined && !cloudId(id)) throw new HttpError(400, 'Invalid trip ID.');
      const data = await deps.rpc(config, user.authorization, 'cmt_read_trips', { p_trip_id: id ?? null });
      res.status(200).json(id ? parseCloudTrip(data) : parseHeads(data));
    } else {
      let body;
      try { body = parseWrite(req.body); } catch { throw new HttpError(400, 'Invalid trip request. Check its dates, segments and accepted snapshot.'); }
      const data = await deps.rpc(config, user.authorization, body.action === 'save' ? 'cmt_save_trip' : 'cmt_delete_trip', {
        p_trip_id: body.tripId, p_expected_revision: body.expectedRevision, ...(body.action === 'save' ? { p_segments: body.segments } : {}),
      });
      res.status(200).json(data);
    }
  } catch (e) {
    res.status(e instanceof HttpError ? e.status : 503).json({ error: e instanceof HttpError ? e.message : 'Cloud service unavailable. Your local copy has been kept.' });
  }
}
export default handleTrips;
