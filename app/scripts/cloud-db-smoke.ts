/** Uses a disposable database on a local PostgreSQL server. No Supabase account or mail service. */
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { cloudSegments } from './cloud-fixtures';
import { clone } from '../src/lib/trips/schema';
const host = process.env.PGHOST || '/tmp';
if (!(host.startsWith('/tmp') || host === '127.0.0.1' || host === 'localhost')) throw new Error('Database tests only allow a local PostgreSQL server.');
const database = `cmt_cloud_test_${Date.now()}_${process.pid}`;
const literal = (v: string) => "'" + v.replaceAll("'", "''") + "'";
const json = (v: unknown) => literal(JSON.stringify(v)) + '::jsonb';
const args = (db: string) => ['-X', '-q', '-A', '-t', '-v', 'ON_ERROR_STOP=1', '-h', host, '-d', db];
function sql(input: string, db = database) {
  const r = spawnSync('psql', args(db), { input, encoding: 'utf8' });
  if (r.status !== 0) throw new Error(r.stderr || r.error?.message || 'psql failed');
  return r.stdout.trim();
}
function asyncSql(input: string) {
  return new Promise<{ status: number | null; output: string }>(resolve => {
    const proc = spawn('psql', args(database)); let output = '';
    proc.stdout.on('data', b => { output += b; }); proc.stderr.on('data', b => { output += b; });
    proc.on('close', status => resolve({ status, output })); proc.stdin.end(input);
  });
}
const a = '11111111-1111-1111-1111-111111111111', b = '22222222-2222-2222-2222-222222222222', unverified = '33333333-3333-3333-3333-333333333333';
const login = (id: string) => `set role authenticated; select set_config('request.jwt.claim.sub',${literal(id)},false);`;
const save = (trip: string, revision: number, segments: unknown = cloudSegments) => `select public.cmt_save_trip(${literal(trip)},${revision},${json(segments)})`;
const expectError = (statement: string, state: string) => `select public.test_error(${literal(statement)},${literal(state)});`;
let passed = 0;
function test(name: string, work: () => void) { work(); passed++; console.log('PASS ' + name); }
async function main() {
  sql(`create database ${database};`, 'postgres');
  try {
    sql(`
      do $$ begin if not exists(select from pg_roles where rolname='authenticated') then create role authenticated nologin; end if;
        if not exists(select from pg_roles where rolname='anon') then create role anon nologin; end if; end $$;
      create schema auth;
      create table auth.users(id uuid primary key, email text, email_confirmed_at timestamptz, is_anonymous boolean default false);
      create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true),'')::uuid $$;
      grant usage on schema auth to authenticated,anon;
      grant execute on function auth.uid() to authenticated,anon;
      insert into auth.users values ('${a}','a@example.invalid',now(),false),('${b}','b@example.invalid',now(),false),('${unverified}','c@example.invalid',null,false);
      create function public.test_assert(ok boolean, msg text) returns void language plpgsql as $$ begin if ok is distinct from true then raise exception '%',msg; end if; end $$;
      create function public.test_error(statement text, expected text) returns void language plpgsql as $$
        declare actual text; begin begin execute statement; exception when others then get stacked diagnostics actual=returned_sqlstate; end;
        if actual is distinct from expected then raise exception 'Expected SQLSTATE %, got %',expected,actual; end if; end $$;
    `);
    sql(readFileSync(resolve('..', 'supabase/migrations/202609120001_companion_cloud.sql'), 'utf8'));
    test('migration applies and all private tables have RLS', () => {
      assert.equal(sql("select count(*) from pg_class where relname in ('cmt_trips','cmt_trip_segments','cmt_plan_versions') and relrowsecurity;"), '3');
    });
    test('real PostgreSQL round trip preserves exact Paris/Rome/Paris accepted snapshots', () => {
      sql(login(a) + save('trip-one', 0) + ';');
      const result = sql(login(a) + "select public.cmt_read_trips('trip-one');").split('\n').at(-1)!;
      assert.deepEqual(JSON.parse(result), { id: 'trip-one', revision: 1, segments: cloudSegments });
    });
    test('identical lost-response retry is idempotent and does not add versions', () => {
      sql(login(a) + save('trip-one', 0) + ';');
      assert.equal(sql("select revision from public.cmt_trips where id='trip-one';"), '1');
      assert.equal(sql("select count(*) from public.cmt_plan_versions;"), '3');
    });
    test('another owner sees no parent, child or version rows and cannot load/delete them', () => {
      sql(login(b) + `select public.test_assert((select count(*) from public.cmt_trips)=0,'trips leaked');
        select public.test_assert((select count(*) from public.cmt_trip_segments)=0,'segments leaked');
        select public.test_assert((select count(*) from public.cmt_plan_versions)=0,'versions leaked');` +
        expectError("select public.cmt_read_trips('trip-one')", 'PT404') + expectError("select public.cmt_delete_trip('trip-one',1)", 'PT404'));
    });
    test('anonymous/unverified access and direct version mutation are denied', () => {
      sql('set role anon;' + expectError("select public.cmt_read_trips(null)", '42501'));
      sql(login(unverified) + expectError(save('bad-trip',0), 'PT401'));
      sql(login(a) + expectError("update public.cmt_plan_versions set snapshot='{}'", '42501') + expectError("delete from public.cmt_trips", '42501'));
    });
    test('owner fields injected into nested input cannot assign another account', () => {
      const injected = clone(cloudSegments) as (typeof cloudSegments[number] & { owner_id?: string })[]; injected[0].owner_id = a;
      sql(login(b) + save('trip-one',0,injected) + ';');
      assert.equal(sql(`select count(*) from public.cmt_plan_versions where owner_id='${b}';`), '3');
      assert.equal(sql(`select revision from public.cmt_trips where owner_id='${a}' and id='trip-one';`), '1');
    });
    test('immutable snapshot collision and stale updates roll back atomically', () => {
      const changed = clone(cloudSegments); changed[0].snapshot.cityName = 'changed';
      sql(login(a) + expectError(save('trip-one',1,changed), 'PT409'));
      changed[0].snapshot.id = 'new-version';
      sql(login(a) + expectError(save('trip-one',0,changed), 'PT409'));
      assert.equal(sql(`select count(*) from public.cmt_plan_versions where owner_id='${a}';`), '3');
    });
    test('duplicate segment IDs and overlapping windows are rejected transactionally', () => {
      sql(login(a) + expectError(save('bad-duplicate',0,[cloudSegments[0],cloudSegments[0]]), 'PT400'));
      sql(login(a) + expectError(save('bad-overlap',0,[cloudSegments[1],cloudSegments[0]]), 'PT400'));
      assert.equal(sql("select count(*) from public.cmt_trips where id like 'bad-%';"), '0');
    });
    const first = clone(cloudSegments), second = clone(cloudSegments);
    first[0].snapshot.id = 'concurrent-first'; second[0].snapshot.id = 'concurrent-second';
    const results = await Promise.all([asyncSql(login(a) + 'begin;' + save('trip-one',1,first) + ';select pg_sleep(0.3);commit;'), asyncSql(login(a) + 'begin;' + save('trip-one',1,second) + ';commit;')]);
    assert.equal(results.filter(r => r.status === 0).length,1);
    assert.ok(results.some(r => r.output.includes('Stale revision')));
    passed++; console.log('PASS concurrent writers: one commit, one conflict, no lost update');
    test('delete removes snapshots, hides the trip and blocks delayed resurrection', () => {
      sql(login(a) + expectError("select public.cmt_delete_trip('trip-one',1)",'PT409') + "select public.cmt_delete_trip('trip-one',2);select public.cmt_delete_trip('trip-one',2);");
      sql(login(a) + expectError(save('trip-one',0),'PT409') + expectError("select public.cmt_read_trips('trip-one')",'PT404'));
      assert.equal(sql(`select count(*) from public.cmt_plan_versions where owner_id='${a}';`),'0');
      assert.equal(sql(`select count(*) from public.cmt_trip_segments where owner_id='${a}';`),'0');
      assert.equal(sql(`select count(*) from public.cmt_plan_versions where owner_id='${b}';`),'3');
    });
    console.log(`${passed} PostgreSQL cloud checks passed`);
  } finally { sql(`drop database ${database} with (force);`, 'postgres'); }
}
main().catch(e => { console.error(e); process.exitCode = 1; });
