import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useCloud } from '../state/CloudContext';
import { useLocalTrips } from '../state/TripContext';
import { accountEmailReady, getCloudClient } from '../lib/cloud/client';
import { mergeSegment, type CloudTrip } from '../lib/cloud/schema';
import type { PlanSnapshot } from '../lib/trips/schema';
import { AccountRecovery } from './AccountRecovery';
import { NotificationPanel } from './NotificationPanel';
import { AccountDeletion } from './AccountDeletion';

function SignIn() {
  const [recovery, setRecovery] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const submit = async (e: FormEvent) => {
    e.preventDefault(); if (busy || (mode === 'signup' && !accountEmailReady)) return;
    setBusy(true); setMessage('');
    try {
      const cloudClient = await getCloudClient();
      if (!cloudClient) throw new Error('Cloud unavailable');
      const { error } = mode === 'signin' ? await cloudClient.auth.signInWithPassword({ email, password }) : await cloudClient.auth.signUp({ email, password });
      setPassword('');
      setMessage(error ? 'Could not complete sign-in. Check your details and email verification, or try again later.' : mode === 'signup' ? 'Check your email to confirm the account, then return here to sign in. This does not enable itinerary emails.' : 'Signed in.');
    } catch { setMessage('Account service unavailable. You can continue planning locally.'); }
    finally { setBusy(false); }
  };
  if (recovery) return <AccountRecovery close={() => setRecovery(false)} />;
  return <form onSubmit={submit} className="cloud-form">
    <p>Sign in to save accepted trips privately across devices. Planning remains available without an account. You will sign in again after reloading this page.</p>
    <label>Email<input type="email" autoComplete="email" required value={email} onChange={e => setEmail(e.target.value)} disabled={busy} /></label>
    <label>Password<input type="password" autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} minLength={mode === 'signup' ? 12 : undefined} required value={password} onChange={e => setPassword(e.target.value)} disabled={busy} /></label>
    {mode === 'signup' && !accountEmailReady && <p role="status">Account email delivery is being set up. New accounts are not available yet; you can plan and save trips on this device.</p>}
    <div className="companion-actions"><button className="btn btn-primary" disabled={busy || (mode === 'signup' && !accountEmailReady)}>{busy ? 'Connecting…' : mode === 'signin' ? 'Sign in' : 'Create account'}</button><button type="button" disabled={busy} onClick={() => { setMode(mode === 'signin' ? 'signup' : 'signin'); setPassword(''); setMessage(''); }}>{mode === 'signin' ? 'Create an optional account' : 'Use an existing account'}</button></div>
    <p role="status">{message}</p>
    <button type="button" disabled={busy} onClick={() => { setPassword(''); setRecovery(true); }}>Forgot password?</button>
  </form>;
}
function AccountTrips({ snapshot }: { snapshot?: PlanSnapshot }) {
  const cloud = useCloud();
  const local = useLocalTrips();
  const [target, setTarget] = useState('');
  const [opened, setOpened] = useState<CloudTrip>();
  const [error, setError] = useState('');
  const [removing, setRemoving] = useState(false);
  const current = cloud.heads.find(h => h.id === (target || snapshot?.tripId));
  const alreadySaved = current?.segments.some(s => s.id === snapshot?.tripId && s.versionId === snapshot.id);
  const refresh = async () => { setOpened(undefined); setRemoving(false); await cloud.refresh(); };
  const save = async () => {
    if (!snapshot) return;
    setError(''); setOpened(undefined);
    try {
      // Existing trip is read explicitly before merging. Its revision is the write precondition.
      const head = cloud.heads.find(h => h.id === (target || snapshot.tripId));
      const existing = head ? await cloud.load(head.id) : undefined;
      if (head && !existing) return;
      await cloud.write({ action: 'save', tripId: target || snapshot.tripId, expectedRevision: head?.revision ?? 0, segments: mergeSegment(existing, snapshot) });
    } catch (e) { setError(e instanceof Error ? e.message : 'Unable to prepare this save.'); }
  };
  const keep = async () => {
    if (!opened) return;
    try { await local.importSnapshots(opened.segments.map(s => s.snapshot)); setError('Copied to this device. These copies remain available after sign-out.'); }
    catch (e) { setError(e instanceof Error ? e.message : 'Could not keep a local copy.'); }
  };
  return <>
    <p>Signed in as {cloud.session?.user.email}. Account creation does not subscribe you to itinerary emails.</p>
    <div className="companion-actions"><button disabled={cloud.busy} onClick={refresh}>Load / refresh cloud trips</button><button onClick={() => void cloud.signOut()}>Sign out</button></div>
    {snapshot && <div className="cloud-form"><label>Save this accepted version to<select value={target} disabled={cloud.busy} onChange={e => setTarget(e.target.value)}><option value="">Its own cloud trip</option>{cloud.heads.filter(h => h.id !== snapshot.tripId).map(h => <option key={h.id} value={h.id}>{h.segments.map(s => s.cityName).join(' → ')} · {h.segments[0]?.arriving}</option>)}</select></label><p>{alreadySaved ? 'This accepted version is listed in your cloud trip.' : 'Local only until you save this accepted version to your account.'} Dates must be ordered without overlapping overnight stays.</p><button className="btn btn-primary" disabled={cloud.busy || cloud.conflict} onClick={save}>Save accepted version to account</button></div>}
    <p role="status">{cloud.status}</p>
    {cloud.conflict && <p className="companion-notice">Nothing was overwritten. Refresh and open the cloud copy, then choose whether to keep it or save your local accepted version.</p>}
    {error && <p role="status" className="companion-notice">{error}</p>}
    <ul>{cloud.heads.map(h => <li key={h.id}><button disabled={cloud.busy} onClick={async () => { setRemoving(false); setError(''); setOpened(await cloud.load(h.id)); }}>{h.segments.map(s => s.cityName).join(' → ')} · {h.segments[0]?.arriving} · revision {h.revision}</button></li>)}</ul>
    {opened && <section className="companion-panel"><h3>Cloud trip · revision {opened.revision}</h3><p>This account copy is held in memory only. Keep a copy on this device to preview or edit it here.</p><ol>{opened.segments.map(s => <li key={s.id}>{s.snapshot.cityName} · {s.snapshot.draft.arriving} to {s.snapshot.draft.departing} · {s.snapshot.days.length} days{local.data.snapshots.some(x => x.id === s.snapshot.id) && <> · <Link to={`/${s.snapshot.cityId}/saved/${s.snapshot.id}`}>Open local version</Link></>}</li>)}</ol><div className="companion-actions"><button disabled={cloud.busy} onClick={keep}>Keep a copy on this device</button><button disabled={cloud.busy} onClick={() => setRemoving(true)}>Remove cloud trip…</button></div>{removing && <div role="alert"><p>Delete this cloud trip and all its saved cloud versions? Local copies remain. Export a local copy first if you need it.</p><button disabled={cloud.busy} onClick={async () => { if (await cloud.write({ action: 'delete', tripId: opened.id, expectedRevision: opened.revision })) { setOpened(undefined); setRemoving(false); } }}>Confirm cloud deletion</button><button onClick={() => setRemoving(false)}>Cancel</button></div>}</section>}
    {opened && <NotificationPanel key={`${cloud.session?.user.id}-${opened.id}-${opened.revision}`} trip={opened} />}
    <AccountDeletion />
  </>;
}
export function CloudSavePanel({ snapshot }: { snapshot?: PlanSnapshot }) {
  const cloud = useCloud();
  return <section className="companion-panel" aria-label="Optional cloud save"><h2>Optional account & cloud save</h2>{cloud.status.startsWith('Account deleted.') && <p role="status">{cloud.status}</p>}{!cloud.available ? <p>Cloud accounts are not connected in this environment. Your saved trips remain available on this device; you can export them for backup.</p> : cloud.session ? <AccountTrips key={cloud.session.user.id} snapshot={snapshot} /> : <SignIn />}</section>;
}
