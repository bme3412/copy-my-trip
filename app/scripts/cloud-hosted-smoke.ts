// Explicit preview-only acceptance test. No confirmation emails are sent.
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import { cloudSegments } from './cloud-fixtures';

const ref = 'wxpsiguklujutvttrqrn';
const url = `https://${ref}.supabase.co`;
const statePath = '../supabase/.temp/hosted-test-users.json';
const keys = JSON.parse(readFileSync('../supabase/.temp/preview-api-keys.json', 'utf8')) as { name: string; type: string; api_key: string }[];
const publicKey = keys.find(k => k.type === 'publishable')!.api_key;
const admin = createClient(url, keys.find(k => k.name === 'service_role')!.api_key, { auth: { persistSession: false, autoRefreshToken: false } });
type FixtureUser = { id: string; email: string; password: string };
let users: FixtureUser[] = [];
const state = () => writeFileSync(statePath, JSON.stringify(users), { mode: 0o600 });
async function cleanup() {
  for (const user of users) {
    assert.ok(user.email.startsWith('cmt-test-') && user.email.endsWith('@example.invalid'));
    const result = await admin.auth.admin.deleteUser(user.id);
    assert.ok(!result.error, 'Synthetic account cleanup must succeed');
  }
  users = []; state();
  console.log('PASS removed synthetic preview accounts and cascaded their trip data');
}
async function api(token: string | undefined, body?: unknown, id?: string) {
  const response = await fetch(`http://127.0.0.1:4318/api/trips${id ? `?id=${encodeURIComponent(id)}` : ''}`, {
    method: body === undefined ? 'GET' : 'POST', headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), 'Content-Type': 'application/json' },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  assert.equal(response.headers.get('cache-control'), 'private, no-store');
  return { status: response.status, body: await response.json() };
}
async function main() {
  if (process.env.CMT_ALLOW_PREVIEW_TEST !== ref) throw new Error('Explicit preview test opt-in required');
  if (process.argv.includes('--cleanup')) { users = JSON.parse(readFileSync(statePath, 'utf8')); await cleanup(); return; }
  try { assert.equal(JSON.parse(readFileSync(statePath, 'utf8')).length, 0, 'Clean up previous fixture users before another run'); }
  catch (e) { if ((e as NodeJS.ErrnoException).code !== 'ENOENT') throw e; }
  const run = Date.now().toString(36);
  const tokens: string[] = [];
  for (const label of ['a', 'b']) {
    const email = `cmt-test-${run}-${label}@example.invalid`;
    const password = `CmtPreview-${run}-${label}!Only2026`;
    const result = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { purpose: 'disposable companion acceptance test' } });
    if (result.error) console.error('Synthetic user creation:', { status: result.error.status, code: result.error.code });
    assert.ok(!result.error && result.data.user, 'Create synthetic verified user');
    users.push({ id: result.data.user.id, email, password }); state();
    const client = createClient(url, publicKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const login = await client.auth.signInWithPassword({ email, password });
    assert.ok(!login.error && login.data.session, 'Sign in with real Supabase Auth');
    tokens.push(login.data.session.access_token);
  }
  console.log('PASS real Supabase Auth password sign-in for two synthetic verified accounts');
  assert.equal((await api(undefined)).status, 401);
  assert.deepEqual((await api(tokens[0])).body, []);
  console.log('PASS local HTTP adapter reaches protected API with private no-store responses');
  const tripId = `preview-test-${run}`;
  const save = { action: 'save', tripId, expectedRevision: 0, segments: cloudSegments };
  const first = await api(tokens[0], save); assert.equal(first.status, 200); assert.equal(first.body.revision, 1);
  if (process.argv.includes('--lifecycle')) {
    const account = async (password: string, extra = {}) => {
      const response = await fetch('http://127.0.0.1:4318/api/account', { method: 'POST', headers: { Authorization: `Bearer ${tokens[0]}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'delete', confirmation: 'DELETE', password, ...extra }) });
      assert.equal(response.headers.get('cache-control'), 'private, no-store');
      return response.status;
    };
    assert.equal(await account('wrong-password'), 403);
    assert.equal(await account(users[0].password, { owner_id: users[1].id }), 400);
    console.log('PASS live deletion rejects wrong password and caller-supplied owner');
    const generated = await admin.auth.admin.generateLink({ type: 'recovery', email: users[0].email });
    assert.ok(!generated.error && generated.data.properties.email_otp, 'Generate a synthetic recovery code without sending email');
    const recovery = createClient(url, publicKey, { auth: { persistSession: false, autoRefreshToken: false } });
    assert.ok((await recovery.auth.verifyOtp({ email: users[0].email, token: '000000', type: 'recovery' })).error, 'Invalid code must fail');
    const verified = await recovery.auth.verifyOtp({ email: users[0].email, token: generated.data.properties.email_otp, type: 'recovery' });
    assert.ok(!verified.error && verified.data.session, 'Verify real recovery code');
    const recoveryDelete = await fetch(`${url}/rest/v1/rpc/cmt_delete_account`, { method: 'POST', headers: { apikey: publicKey, Authorization: `Bearer ${verified.data.session.access_token}`, 'Content-Type': 'application/json' }, body: '{}' });
    assert.equal(recoveryDelete.status, 403, 'Recovery session alone cannot delete an account');
    const newPassword = users[0].password + '-changed';
    assert.ok(!(await recovery.auth.updateUser({ password: newPassword })).error, 'Update password after recovery');
    await recovery.auth.signOut({ scope: 'global' });
    const login = createClient(url, publicKey, { auth: { persistSession: false, autoRefreshToken: false } });
    assert.ok((await login.auth.signInWithPassword({ email: users[0].email, password: users[0].password })).error, 'Old password rejected');
    const renewed = await login.auth.signInWithPassword({ email: users[0].email, password: newPassword });
    assert.ok(!renewed.error && renewed.data.session, 'New password accepted');
    tokens[0] = renewed.data.session.access_token;
    console.log('PASS real recovery OTP, password update, old-password rejection and new-password sign-in');
    assert.equal(await account(newPassword), 200, 'Self-service deletion succeeds');
    const gone = await admin.auth.admin.getUserById(users[0].id); assert.ok(gone.error, 'Deleted Auth user absent');
    for (const table of ['cmt_trips', 'cmt_trip_segments', 'cmt_plan_versions']) {
      const rows = await admin.from(table).select('owner_id').eq('owner_id', users[0].id); assert.ok(!rows.error); assert.deepEqual(rows.data, []);
    }
    assert.ok((await login.auth.signInWithPassword({ email: users[0].email, password: newPassword })).error, 'Deleted user cannot sign in');
    assert.ok(!(await admin.auth.admin.getUserById(users[1].id)).error, 'Other account preserved');
    users = users.slice(1); state();
    console.log('PASS self-account deletion cascades cloud rows and preserves other accounts');
    console.log('PASS second synthetic account retained for browser form verification; run --cleanup');
    return;
  }
  const detail = await api(tokens[0], undefined, tripId); assert.equal(detail.status, 200); assert.deepEqual(detail.body.segments, cloudSegments);
  console.log('PASS Paris → Rome → Paris full snapshots survive HTTP / Auth / PostgREST / PostgreSQL round trip');
  assert.deepEqual((await api(tokens[0], save)).body, first.body);
  console.log('PASS lost-response retry is idempotent');
  assert.deepEqual((await api(tokens[1])).body, []);
  assert.equal((await api(tokens[1], undefined, tripId)).status, 404);
  for (const table of ['cmt_trips', 'cmt_trip_segments', 'cmt_plan_versions']) {
    const response = await fetch(`${url}/rest/v1/${table}?select=*&owner_id=eq.${users[0].id}`, { headers: { apikey: publicKey, Authorization: `Bearer ${tokens[1]}` } });
    assert.equal(response.status, 200); assert.deepEqual(await response.json(), []);
  }
  console.log('PASS second account cannot read first account parent, segment or version rows');
  const changed = structuredClone(cloudSegments);
  changed[0].snapshot.id += '-new';
  const next = { ...save, segments: changed, expectedRevision: 1 };
  const competing = { ...save, segments: structuredClone(changed), expectedRevision: 1 };
  competing.segments[0].snapshot.id += '-competing';
  const race = await Promise.all([api(tokens[0], next), api(tokens[0], competing)]);
  assert.deepEqual(race.map(r => r.status).sort(), [200, 409]);
  assert.equal((await api(tokens[0], { action: 'delete', tripId, expectedRevision: 1 })).status, 409);
  console.log('PASS concurrent edits allow one writer; stale saves/deletes do not overwrite');
  const direct = await fetch(`${url}/rest/v1/cmt_trips`, { method: 'POST', headers: { apikey: publicKey, Authorization: `Bearer ${tokens[0]}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ id: 'forbidden', owner_id: users[0].id }) });
  assert.equal(direct.status, 403);
  console.log('PASS direct table writes denied');
  assert.equal((await api(tokens[0], { action: 'delete', tripId, expectedRevision: 2 })).status, 200);
  assert.equal((await api(tokens[0], save)).status, 409);
  assert.equal((await api(tokens[0], undefined, tripId)).status, 404);
  console.log('PASS cloud deletion and tombstone prevent delayed resurrection');
  // Keep one synthetic trip and the accounts briefly for manual browser automation.
  assert.equal((await api(tokens[0], { ...save, tripId: `browser-${run}` })).status, 200);
  console.log('PASS browser fixture prepared; run --cleanup after UI verification');
}
main().catch(async (error: unknown) => {
  console.error('Hosted verification failed:', error instanceof assert.AssertionError ? error.message.split('\n')[0] : (error as { code?: string }).code ?? 'unexpected error');
  try { if (users.length) await cleanup(); } catch { console.error('Fixture cleanup needs retry using the private state file.'); }
  process.exitCode = 1;
});
