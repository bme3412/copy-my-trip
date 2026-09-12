import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useCloud } from '../state/CloudContext';

export function AccountDeletion() {
  const cloud = useCloud(); const [open, setOpen] = useState(false);
  const [confirmation, setConfirmation] = useState(''); const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false); const [message, setMessage] = useState('');
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const remove = async (event: FormEvent) => {
    event.preventDefault(); if (busy || !cloud.session || confirmation !== 'DELETE') return;
    setBusy(true); setMessage('');
    try {
      const response = await fetch('/api/account', { method: 'POST', cache: 'no-store', credentials: 'same-origin', headers: { Authorization: `Bearer ${cloud.session.access_token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'delete', confirmation, password }), signal: AbortSignal.timeout(25000) });
      const data = await response.json().catch(() => null);
      if (!mounted.current) return;
      setPassword('');
      if (!response.ok || data?.deleted !== true) { setMessage(data?.error || 'Deletion could not be confirmed. Try signing in again to check your account.'); return; }
      await cloud.signOut(true);
    } catch { if (mounted.current) setMessage('Connection interrupted. Deletion could not be confirmed. Try signing in again to check your account.'); }
    finally { if (mounted.current) { setBusy(false); setPassword(''); } }
  };
  return <section aria-label="Delete account"><h3>Account settings</h3>{!open ? <button onClick={() => setOpen(true)}>Delete my account…</button> : <form className="cloud-form" onSubmit={remove}>
    <p>Delete {cloud.session?.user.email} and all its cloud trips and saved cloud versions? This cannot be undone. Export any trips you want to keep first.</p>
    <p>Copies already kept on a device remain there. Provider backups may retain deleted data until their retention period expires.</p>
    <label>Type DELETE to confirm<input autoComplete="off" required pattern="DELETE" value={confirmation} onChange={e => setConfirmation(e.target.value)} disabled={busy} /></label>
    <label>Current password<input type="password" autoComplete="current-password" required maxLength={1024} value={password} onChange={e => setPassword(e.target.value)} disabled={busy} /></label>
    <div className="companion-actions"><button disabled={busy || confirmation !== 'DELETE'}>{busy ? 'Deleting account…' : 'Permanently delete my account'}</button><button type="button" disabled={busy} onClick={() => { setOpen(false); setPassword(''); setConfirmation(''); setMessage(''); }}>Cancel</button></div><p role="status">{message}</p>
  </form>}</section>;
}
