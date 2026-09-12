import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { cloudAvailable, getCloudClient, cloudRequest, CloudError } from '../lib/cloud/client';
import { SessionFence, type CloudHead, type CloudTrip, type CloudWrite } from '../lib/cloud/schema';

interface CloudState {
  available: boolean; session: Session | null; heads: CloudHead[]; busy: boolean;
  status: string; conflict: boolean; refresh(): Promise<void>;
  load(id: string): Promise<CloudTrip | undefined>; write(body: CloudWrite): Promise<boolean>;
  signOut(accountDeleted?: boolean): Promise<void>;
}
const fallback: CloudState = { available: false, session: null, heads: [], busy: false, status: 'Local only', conflict: false,
  refresh: async () => {}, load: async () => undefined, write: async () => false, signOut: async () => {} };
const Context = createContext<CloudState>(fallback);
export function CloudProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [heads, setHeads] = useState<CloudHead[]>([]);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('Local only');
  const [conflict, setConflict] = useState(false);
  const fence = useRef(new SessionFence());
  const active = useRef<Session | null>(null);
  const pending = useRef(false);
  useEffect(() => {
    if (!cloudAvailable) return;
    let cancelled = false;
    let unsubscribe: (() => void) | undefined;
    void getCloudClient().then(client => {
      if (cancelled || !client) return;
      const { data: { subscription } } = client.auth.onAuthStateChange((_event, next) => {
      const different = active.current?.user.id !== next?.user.id;
      fence.current.change(next?.user.id ?? null);
      active.current = next; setSession(next);
      if (different || !next) { pending.current = false; setHeads([]); setBusy(false); setConflict(false); setStatus(previous => next ? 'Signed in · local plans have not been uploaded' : previous.startsWith('Account deleted.') ? previous : 'Local only'); }
      });
      unsubscribe = () => subscription.unsubscribe();
    }).catch(() => { if (!cancelled) setStatus('Account service could not load. Local planning remains available.'); });
    return () => { cancelled = true; unsubscribe?.(); fence.current.clear(); active.current = null; };
  }, []);
  const run = async <T,>(work: (token: string) => Promise<T>): Promise<T | undefined> => {
    const current = active.current;
    if (!current || pending.current) return undefined;
    const ticket = fence.current.ticket();
    pending.current = true; setBusy(true);
    try {
      const result = await work(current.access_token);
      return fence.current.current(ticket) ? result : undefined;
    } catch (e) {
      if (fence.current.current(ticket)) { setConflict(e instanceof CloudError && e.status === 409); setStatus(e instanceof Error ? e.message : 'Cloud save failed. Local data has been kept.'); }
      return undefined;
    } finally { if (fence.current.current(ticket)) { pending.current = false; setBusy(false); } }
  };
  const refresh = async () => {
    const result = await run(token => cloudRequest(token));
    if (result) { setHeads(result as CloudHead[]); setConflict(false); setStatus('Cloud list refreshed. Choose which accepted version to save.'); }
  };
  const load = async (id: string) => {
    const result = await run(token => cloudRequest(token, undefined, id));
    return result as CloudTrip | undefined;
  };
  const write = async (body: CloudWrite) => {
    setStatus(body.action === 'save' ? 'Saving accepted itinerary to your account…' : 'Removing cloud copy…');
    const result = await run(token => cloudRequest(token, body));
    if (!result) return false;
    setConflict(false);
    setStatus(body.action === 'save' ? 'Saved to your account. The local copy is unchanged.' : 'Cloud copy removed. Local copies are unchanged.');
    const list = await run(token => cloudRequest(token));
    if (list) setHeads(list as CloudHead[]);
    return true;
  };
  const signOut = async (accountDeleted = false) => {
    fence.current.clear(); active.current = null; pending.current = false;
    setSession(null); setHeads([]); setBusy(false); setConflict(false); setStatus(accountDeleted ? 'Account deleted. Your deliberately saved device copies remain available.' : 'Signed out · account data cleared from this session');
    // In-memory auth plus remounting account content prevents previous-owner data lingering in the UI.
    const result = await (await getCloudClient())?.auth.signOut({ scope: 'local' });
    if (result?.error && !accountDeleted) setStatus('Signed out on this page. Server session revocation could not be confirmed; close this tab to discard its in-memory session.');
  };
  return <Context.Provider value={{ available: cloudAvailable, session, heads, busy, status, conflict, refresh, load, write, signOut }}>{children}</Context.Provider>;
}
export const useCloud = () => useContext(Context);
