import { Webhook } from 'svix';
import { workerRpc, type WorkerRpc } from '../server/companion/jobs.js';
const json = (status: number, body: unknown) => Response.json(body, { status, headers: { 'Cache-Control': 'private, no-store' } });
export async function handleEvent(request: Request, rpc: WorkerRpc = workerRpc) {
  if (request.method !== 'POST') return json(405, { error: 'POST only' });
  if (!process.env.RESEND_WEBHOOK_SECRET || !process.env.CMT_MAIL_WORKER_SECRET) return json(503, { error: 'Webhook unavailable' });
  if (Number(request.headers.get('content-length') || 0) > 65536) return json(413, { error: 'Too large' });
  let event: { type?: string; data?: { email_id?: string; from?: string } };
  const id = request.headers.get('svix-id') || '';
  try {
    // Consume bounded raw bytes; JSON round-tripping would invalidate the signature.
    const reader = request.body?.getReader();
    if (!reader) return json(400, { error: 'Body required' });
    const chunks: Uint8Array[] = []; let length = 0;
    while (true) { const { value, done } = await reader.read(); if (done) break; length += value.length; if (length > 65536) { await reader.cancel(); return json(413, { error: 'Too large' }); } chunks.push(value); }
    const raw = Buffer.concat(chunks).toString('utf8');
    new Webhook(process.env.RESEND_WEBHOOK_SECRET).verify(raw, {
      'svix-id': id, 'svix-timestamp': request.headers.get('svix-timestamp') || '', 'svix-signature': request.headers.get('svix-signature') || '',
    });
    event = JSON.parse(raw) as typeof event;
    if (!event || typeof event.type !== 'string' || typeof event.data?.email_id !== 'string' || event.data.email_id.length > 100 || id.length > 200) return json(400, { error: 'Invalid event' });
  } catch { return json(400, { error: 'Invalid signature or event' }); }
  if (typeof event.data?.from !== 'string' || !/^(Copy My Trip <)?itinerary@mail\.copy-my-trip\.com>?$/.test(event.data.from)) return json(200, { ignored: true });
  try { await rpc('event', { id, providerId: event.data!.email_id, type: event.type }); return json(200, { received: true }); }
  catch { return json(503, { error: 'Event storage unavailable' }); }
}
// Vercel Web Standard handler preserves the raw body for signature verification.
export default { fetch: (request: Request) => handleEvent(request) };
