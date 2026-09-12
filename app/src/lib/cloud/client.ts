import type { SupabaseClient } from '@supabase/supabase-js';
import { parseCloudTrip, parseHeads, type CloudWrite } from './schema';

const url = import.meta.env?.VITE_SUPABASE_URL;
const key = import.meta.env?.VITE_SUPABASE_PUBLISHABLE_KEY;
function configured() {
  if (!url || !key?.startsWith('sb_publishable_')) return false;
  try { const u = new URL(url); return u.protocol === 'https:' && !u.username && !u.password && u.pathname === '/'; } catch { return false; }
}
// No service-role/secret key, persistent auth token, URL token exchange, or automatic account creation.
export const cloudAvailable = configured();
export const accountEmailReady = import.meta.env?.VITE_ACCOUNT_EMAIL_READY === 'true';
export async function createRecoveryClient() {
  if (!cloudAvailable) return null;
  const { createClient } = await import('@supabase/supabase-js');
  return createClient(url, key, { auth: { persistSession: false, detectSessionInUrl: false, autoRefreshToken: false, storageKey: 'cmt-recovery-' + crypto.randomUUID() } });
}
let client: Promise<SupabaseClient> | undefined;
export function getCloudClient(): Promise<SupabaseClient | null> {
  if (!cloudAvailable) return Promise.resolve(null);
  return client ??= import('@supabase/supabase-js').then(({ createClient }) => createClient(url, key, {
    auth: { persistSession: false, detectSessionInUrl: false, autoRefreshToken: true },
  }));
}
export class CloudError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
export async function cloudRequest(token: string, body?: CloudWrite, id?: string) {
  let response: Response;
  try {
    response = await fetch(`/api/trips${id ? `?id=${encodeURIComponent(id)}` : ''}`, {
      // Same-origin cookies support protected hosting previews. Account identity
      // still comes exclusively from the verified Supabase bearer token.
      method: body ? 'POST' : 'GET', cache: 'no-store', credentials: 'same-origin',
      headers: { Authorization: `Bearer ${token}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
      body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(25000),
    });
  } catch { throw new CloudError(503, 'Connection interrupted. Your local copy is safe. Reload the cloud list before retrying.'); }
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new CloudError(response.status, typeof data?.error === 'string' ? data.error : 'Cloud service unavailable. Your local copy is safe.');
  if (body) {
    if (!data || data.id !== body.tripId || !Number.isSafeInteger(data.revision) || data.revision < 1 || (body.action === 'delete' && data.deleted !== true)) throw new CloudError(503, 'Cloud confirmation was incomplete. Reload before retrying.');
    return data as { id: string; revision: number; deleted?: boolean };
  }
  return id ? parseCloudTrip(data) : parseHeads(data);
}
