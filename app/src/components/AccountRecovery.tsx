import { useEffect, useRef, useState, type FormEvent } from 'react';
import { accountEmailReady, createRecoveryClient } from '../lib/cloud/client';

export function AccountRecovery({ close }: { close(): void }) {
  const [stage, setStage] = useState<'email' | 'code' | 'password' | 'done'>('email');
  const [email, setEmail] = useState(''); const [code, setCode] = useState('');
  const [password, setPassword] = useState(''); const [again, setAgain] = useState('');
  const [busy, setBusy] = useState(false); const [message, setMessage] = useState('');
  const client = useRef<ReturnType<typeof createRecoveryClient> | null>(null);
  useEffect(() => () => { void client.current?.then(c => c?.auth.signOut({ scope: 'local' })); }, []);
  const submit = async (event: FormEvent) => {
    event.preventDefault(); if (busy) return;
    setBusy(true); setMessage('');
    try {
      const auth = (await (client.current ??= createRecoveryClient()))?.auth;
      if (!auth) throw new Error();
      if (stage === 'email') {
        if (!accountEmailReady) return;
        const { error } = await auth.resetPasswordForEmail(email.trim());
        if (error) { setMessage('Recovery is temporarily unavailable. Please try again later.'); return; }
        setStage('code'); setMessage('If this address has an account, a code has been requested. Check your email, including spam.');
      } else if (stage === 'code') {
        const { error } = await auth.verifyOtp({ email: email.trim(), token: code.trim(), type: 'recovery' });
        setCode('');
        if (error) { setMessage('The code is invalid or expired. Try again, or request a new code.'); return; }
        setStage('password');
      } else if (stage === 'password') {
        if (password.length < 12 || password !== again) { setMessage('Use at least 12 characters and enter the same password twice.'); return; }
        const { error } = await auth.updateUser({ password });
        setPassword(''); setAgain('');
        if (error) { setMessage('Could not update the password. Try a different password or request a new code.'); return; }
        const logout = await auth.signOut({ scope: 'global' });
        setStage('done');
        setMessage(logout.error ? 'Password updated. Session revocation could not be confirmed. Sign in with the new password.' : 'Password updated. Sign in with your new password.');
      }
    } catch { setMessage('Account service unavailable. Please try again later.'); }
    finally { setBusy(false); }
  };
  return <form className="cloud-form" onSubmit={submit} aria-label="Password recovery">
    <h3>Reset your password</h3>
    <p>Verify a code sent to your account email, then choose a new password. Your saved trips stay as they are.</p>
    {!accountEmailReady && <p role="status">Account email delivery is being set up. Password recovery is not available yet; you can continue planning locally.</p>}
    {stage === 'email' && <label>Account email<input type="email" autoComplete="email" required value={email} onChange={e => setEmail(e.target.value)} disabled={busy} /></label>}
    {stage === 'code' && <><p>Enter the code sent to {email}.</p><label>Recovery code<input inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6,10}" required value={code} onChange={e => setCode(e.target.value)} disabled={busy} /></label></>}
    {stage === 'password' && <><label>New password<input type="password" autoComplete="new-password" minLength={12} required value={password} onChange={e => setPassword(e.target.value)} disabled={busy} /></label><label>Repeat new password<input type="password" autoComplete="new-password" minLength={12} required value={again} onChange={e => setAgain(e.target.value)} disabled={busy} /></label></>}
    <div className="companion-actions">{stage !== 'done' && <button className="btn btn-primary" disabled={busy || (stage === 'email' && !accountEmailReady)}>{busy ? 'Working…' : stage === 'email' ? 'Send recovery code' : stage === 'code' ? 'Verify code' : 'Set new password'}</button>}{stage === 'code' && <button type="button" disabled={busy} onClick={() => { setCode(''); setStage('email'); setMessage(''); }}>Request another code</button>}<button type="button" disabled={busy} onClick={close}>Back to sign in</button></div>
    {stage === 'email' && <button type="button" className="btn" disabled={busy} onClick={event => {
      if (!event.currentTarget.form?.reportValidity()) return;
      setStage('code'); setMessage('Enter the recovery code from your email.');
    }}>I already have a code</button>}
    <p role="status">{message}</p>
  </form>;
}
