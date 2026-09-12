import assert from 'node:assert/strict';
import { cloudSegments } from './cloud-fixtures';
import { clone } from '../src/lib/trips/schema';
import { mergeLocalSnapshots, mergeSegment, parseCloudTrip, parseHeads, parseWrite, SessionFence } from '../src/lib/cloud/schema';
import { authenticate, HttpError } from '../server/auth';
import { handleTrips } from '../api/trips';
import { tripRpc } from '../server/trips';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { devTrips } from '../server/dev-trips';
import { handleAccount, confirmPassword } from '../api/account';
let passed = 0;
async function test(name: string, run: () => unknown) { await run(); passed++; console.log('PASS ' + name); }
const request = { action: 'save', tripId: 'my-trip', expectedRevision: 0, segments: cloudSegments };
const token = 'Bearer ' + 'a'.repeat(30);
const config = { url: 'https://example.supabase.co', key: 'sb_publishable_TEST_ONLY' };
const owner = '11111111-1111-1111-1111-111111111111';
const fakeFetch = (data: unknown, status = 200) => (async () => new Response(JSON.stringify(data), { status })) as typeof fetch;
async function main() {
await test('three segments preserve Paris → Rome → Paris and complete snapshot data', () => {
  assert.deepEqual(parseWrite(clone(request)), request);
  assert.deepEqual(parseCloudTrip({ id: 'my-trip', revision: 1, segments: clone(cloudSegments) }).segments, cloudSegments);
});
await test('malformed identity, overlapping dates, nested snapshots and oversized requests fail closed', () => {
  const bad = clone(request); bad.segments[2].id = bad.segments[0].id; assert.throws(() => parseWrite(bad));
  assert.throws(() => parseWrite({ ...request, expectedRevision: -1 }));
  assert.throws(() => parseWrite({ ...request, segments: [cloudSegments[1], cloudSegments[0]] }));
  assert.throws(() => parseWrite({ ...request, segments: [{ id: 'bad', snapshot: {} }] }));
  assert.throws(() => parseWrite(' '.repeat(1_500_001)));
  assert.throws(() => parseHeads([{ id: '../private', revision: 1, segments: [] }]));
});
await test('segment merge preserves other cities and accepted local snapshots', () => {
  const original = clone(cloudSegments);
  const changed = clone(cloudSegments[1].snapshot); changed.id = 'another-version';
  const merged = mergeSegment({ id: 'my-trip', revision: 1, segments: cloudSegments }, changed);
  assert.equal(merged[1].snapshot.id, 'another-version');
  assert.deepEqual(merged[0], original[0]); assert.deepEqual(merged[2], original[2]); assert.deepEqual(cloudSegments, original);
});
await test('download import is idempotent and refuses same-ID content replacement', () => {
  const snapshot = cloudSegments[0].snapshot;
  assert.equal(mergeLocalSnapshots([snapshot], [clone(snapshot)]).length, 1);
  const changed = clone(snapshot); changed.cityName = 'Changed';
  assert.throws(() => mergeLocalSnapshots([snapshot], [changed]));
});
await test('late responses from signed-out or switched accounts are rejected', () => {
  const fence = new SessionFence(); fence.change('A'); const a = fence.ticket();
  assert.ok(fence.current(a)); fence.change('A'); assert.ok(fence.current(a));
  fence.clear(); assert.ok(!fence.current(a)); fence.change('B'); assert.ok(!fence.current(a));
  const b = fence.ticket(); fence.change('A'); assert.ok(!fence.current(b));
});
await test('server validates token against Auth and requires verified nonanonymous user', async () => {
  assert.equal((await authenticate(token, config, fakeFetch({ id: owner, email: 'fixture@example.invalid', email_confirmed_at: '2026-01-01' }))).id, owner);
  await assert.rejects(authenticate(undefined, config, fakeFetch({})), (e: unknown) => e instanceof HttpError && e.status === 401);
  await assert.rejects(authenticate(token, config, fakeFetch({}, 401)), (e: unknown) => e instanceof HttpError && e.status === 401);
  await assert.rejects(authenticate(token, config, fakeFetch({ id: owner, email: 'fixture@example.invalid' })), (e: unknown) => e instanceof HttpError && e.status === 403);
  await assert.rejects(authenticate(token, config, fakeFetch({ id: owner, email: 'fixture@example.invalid', email_confirmed_at: 'yes', is_anonymous: true })), (e: unknown) => e instanceof HttpError && e.status === 403);
});
await test('RPC forwards user token, no elevated credential, and maps stale revisions to conflict', async () => {
  let observed: RequestInit | undefined;
  await tripRpc(config, token, 'cmt_read_trips', {}, (async (_url, init) => { observed = init; return new Response('[]'); }) as typeof fetch);
  assert.equal((observed?.headers as Record<string, string>).Authorization, token);
  await assert.rejects(tripRpc(config, token, 'cmt_save_trip', {}, fakeFetch({ code: 'PT409', message: 'private details' }, 409)), (e: unknown) => e instanceof HttpError && e.status === 409 && !e.message.includes('private details'));
});
await test('API validates before writes, forwards only allowlisted fields and never caches private responses', async () => {
  const headers: Record<string, string> = {}; let code = 0; let output: unknown; let called = 0; let params: unknown;
  const res = { setHeader: (k: string, v: string) => { headers[k] = v; }, status: (c: number) => { code = c; return { json: (v: unknown) => { output = v; } }; } };
  const deps = { config: () => config, authenticate: async () => ({ id: owner, email: 'fixture@example.invalid', authorization: token }), rpc: async (_c: unknown, _a: string, _n: string, p: unknown) => { called++; params = p; return { id: 'my-trip', revision: 1 }; } };
  await handleTrips({ method: 'POST', headers: {}, body: { ...request, owner_id: 'other-owner' } }, res, deps);
  assert.equal(code, 200); assert.equal(called, 1); assert.ok(!('owner_id' in (params as object))); assert.equal(headers['Cache-Control'], 'private, no-store');
  await handleTrips({ method: 'POST', headers: {}, body: { action: 'save' } }, res, deps);
  assert.equal(code, 400); assert.equal(called, 1);
  await handleTrips({ method: 'GET', headers: {}, query: { id: '../other' } }, res, deps);
  assert.equal(code, 400); assert.equal(called, 1);
  await handleTrips({ method: 'POST', headers: {}, body: request }, res, { ...deps, authenticate: async () => { throw new HttpError(401, 'Sign in'); } });
  assert.equal(code, 401); assert.equal(called, 1); assert.deepEqual(output, { error: 'Sign in' });
});
await test('account deletion rejects missing confirmation, injected owner and bad password before RPC', async () => {
  let code = 0; let calls = 0; const headers: Record<string,string> = {};
  const res = { setHeader: (k: string, v: string) => { headers[k] = v; }, status: (c: number) => { code = c; return { json: (_v: unknown) => {} }; } };
  const deps = { config: () => config, confirmPassword: async () => token, rpc: async (_c: unknown, bearer: string, name: string, params: unknown) => { calls++; assert.equal(bearer, token); assert.equal(name, 'cmt_delete_account'); assert.deepEqual(params, {}); return { deleted: true }; } };
  const body = { action: 'delete', confirmation: 'DELETE', password: 'synthetic-password' };
  await handleAccount({ method: 'GET', headers: {} }, res, deps); assert.equal(code, 405);
  await handleAccount({ method: 'POST', headers: {}, body }, res, deps); assert.equal(code, 401);
  await handleAccount({ method: 'POST', headers: { authorization: token }, body: { ...body, owner_id: owner } }, res, deps); assert.equal(code, 400);
  await handleAccount({ method: 'POST', headers: { authorization: token }, body }, res, { ...deps, confirmPassword: async () => { throw new HttpError(403, 'Wrong password'); } }); assert.equal(code, 403); assert.equal(calls, 0);
  await handleAccount({ method: 'POST', headers: { authorization: token }, body }, res, deps); assert.equal(code, 200); assert.equal(calls, 1); assert.equal(headers['Cache-Control'], 'private, no-store');
  let step = 0;
  await assert.rejects(confirmPassword(config, token, 'test', (async () => new Response(JSON.stringify(++step === 1 ? { id: owner, email: 'fixture@example.invalid', email_confirmed_at: 'yes' } : { user: { id: 'different' }, access_token: 'irrelevant' }))) as typeof fetch), (e: unknown) => e instanceof HttpError && e.status === 403);
});
await test('development HTTP adapter bounds streamed bodies, rejects malformed JSON and preserves other routes', async () => {
  const server = createServer((req, res) => { void devTrips(req, res, () => { res.statusCode = 404; res.end('next'); }); });
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  const address = server.address(); assert.ok(address && typeof address !== 'string');
  const url = `http://127.0.0.1:${address.port}`;
  try {
    assert.equal((await fetch(url + '/other')).status, 404);
    const malformed = await fetch(url + '/api/trips', { method: 'POST', body: '{' });
    assert.equal(malformed.status, 400); assert.equal(malformed.headers.get('cache-control'), 'private, no-store');
    assert.equal((await fetch(url + '/api/trips', { method: 'POST', body: 'x'.repeat(1_500_001) })).status, 413);
    const stream = new ReadableStream({ start(controller) { for (let i = 0; i < 24; i++) controller.enqueue(new Uint8Array(65536)); controller.close(); } });
    const streamed = await fetch(url + '/api/trips', { method: 'POST', body: stream, duplex: 'half' } as RequestInit);
    assert.equal(streamed.status, 413);
  } finally { server.closeAllConnections(); await new Promise<void>((resolve, reject) => server.close(e => e ? reject(e) : resolve())); }
});
console.log(`${passed} cloud application checks passed`);
}
main().catch(e => { console.error(e); process.exitCode = 1; });
