/** Uses a disposable database on a local PostgreSQL server. No Supabase account or mail service. */
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { cloudSegments } from './cloud-fixtures';
import { clone } from '../src/lib/trips/schema';
const host = process.env.PGHOST || '/tmp';
if (!(host.startsWith('/tmp') || host === '127.0.0.1' || host === 'localhost')) throw new Error('Database tests only allow a local PostgreSQL server.');
const database = `cmt_mail_test_${Date.now()}_${process.pid}`;
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
    sql(readFileSync(resolve('..','supabase/migrations/202609120003_itinerary_emails.sql'),'utf8'));
    const secret = 'local-mail-worker-secret-for-tests-only-123456789';
    const worker = (action:string,data:unknown={}) => `select public.cmt_mail_worker(${literal(secret)},${literal(action)},${json(data)});`;
    const result = (input:string) => JSON.parse(sql(input).split('\n').at(-1)!);
    const prep = (enabled:boolean,rev:number=0) => `select public.cmt_set_notifications('trip-one',${rev},${enabled},'Europe/Paris','20:00');`;
    sql(login(a)+save('trip-one',0)+';');
    test('mail starts disabled; owner can save a paused preference but cannot activate',()=>{
      sql(login(a)+prep(false)); sql(login(a)+expectError(prep(true,1),'PT403'));
      assert.equal(result(login(a)+"select public.cmt_notification_state('trip-one');").ready,false);
    });
    sql(`update public.cmt_mail_control set worker_hash=encode(sha256(convert_to(${literal(secret)},'UTF8')),'hex'),enabled=true,pilot_owner='${a}';`);
    sql(login(a)+prep(true,1));
    test('no private table writes or worker access without its separate capability',()=>{
      sql(login(a)+expectError("select * from public.cmt_mail_jobs",'42501'));
      sql(login(a)+expectError(worker('ops'),'42501'));
      sql('set role anon;'+expectError("select public.cmt_mail_worker('wrong','ops','{}')",'PT401'));
      sql(login(b)+expectError("select public.cmt_notification_state('trip-one')",'PT404'));
    });
    const data = {ownerId:a,tripId:'trip-one',tripRevision:1,prefRevision:2,kind:'test',date:'2026-07-20'};
    const concurrent=await Promise.all([asyncSql('set role anon;'+worker('claim',data)),asyncSql('set role anon;'+worker('claim',data))]);
    const claims=concurrent.map(r=>{assert.equal(r.status,0,r.output);return JSON.parse(r.output.trim());}).filter(Boolean);
    assert.equal(claims.length,1); passed++;console.log('PASS concurrent workers create one logical job and one lease');
    let job=claims[0]; let identity={id:job.id,lease:job.lease};
    test('claimed source contains the exact accepted snapshots, including repeated cities',()=>assert.deepEqual(job.trip,{id:'trip-one',revision:1,segments:cloudSegments}));
    test('stale itinerary before submission is rebuilt; stale lease cannot submit',()=>{
      const changed=clone(cloudSegments);changed[0].snapshot.id='new-for-email';
      sql(login(a)+save('trip-one',1,changed)+';');
      assert.equal(result(worker('submit',{...identity,briefing:{tripId:'trip-one',tripRevision:1}})),null);
      job=result(worker('claim',{...data,tripRevision:2}));assert.equal(job.trip.revision,2);
      assert.equal(result(worker('submit',{...identity,briefing:{tripId:'trip-one',tripRevision:1}})),null);
      identity={id:job.id,lease:job.lease};
    });
    test('pause cancels queued work and blocks submission',()=>{
      sql(login(a)+prep(false,2));
      assert.equal(result(worker('submit',{...identity,briefing:{tripId:'trip-one',tripRevision:2}})),null);
      assert.equal(sql(`select state from public.cmt_mail_jobs where id='${job.id}';`),'cancelled');
    });
    sql(login(a)+prep(true,3));
    const second={...data,tripRevision:2,prefRevision:4,date:'2026-07-21'};
    job=result(worker('claim',second)); identity={id:job.id,lease:job.lease};
    test('submission derives the verified recipient and freezes the briefing',()=>{
      const r=result(worker('submit',{...identity,briefing:{tripId:'trip-one',tripRevision:2,items:['frozen-test']},recipient:'attacker@example.invalid'}));
      assert.equal(r.recipient,'a@example.invalid');
      assert.equal(result(worker('submit',{...identity,briefing:{tripId:'trip-one',tripRevision:2}})),null);
      assert.equal(result(login(a)+`select public.cmt_read_mail('${job.id}');`).briefing.items[0],'frozen-test');
      sql(login(b)+expectError(`select public.cmt_read_mail('${job.id}')`,'PT404'));
    });
    test('crash after reservation becomes unknown and cannot be automatically claimed again',()=>{
      sql(`update public.cmt_mail_jobs set lease_until=now()-interval '1 minute' where id='${job.id}';`);
      result(worker('candidates'));assert.equal(sql(`select state from public.cmt_mail_jobs where id='${job.id}';`),'unknown');
      assert.equal(result(worker('claim',second)),null);
    });
    test('early delivered event is reconciled after response; duplicates and out-of-order events cannot downgrade',()=>{
      result(worker('event',{id:'evt-1',providerId:'provider-1',type:'email.delivered'}));
      result(worker('finish',{...identity,state:'accepted',providerId:'provider-1'}));
      result(worker('event',{id:'evt-1',providerId:'provider-1',type:'email.delivered'}));
      result(worker('event',{id:'evt-2',providerId:'provider-1',type:'email.sent'}));
      assert.equal(sql(`select state from public.cmt_mail_jobs where id='${job.id}';`),'delivered');
      assert.equal(sql('select count(*) from public.cmt_mail_events;'),'2');
    });
    test('daily budget and global pause prevent new submissions',()=>{
      sql('update public.cmt_mail_control set daily_limit=1;');
      const capped=result(worker('claim',{...second,date:'2026-07-22'}));
      const cappedId={id:capped.id,lease:capped.lease};
      assert.equal(result(worker('submit',{...cappedId,briefing:{tripId:'trip-one',tripRevision:2}})),null);
      sql('update public.cmt_mail_control set enabled=false,daily_limit=5;');
      assert.equal(result(worker('submit',{...cappedId,briefing:{tripId:'trip-one',tripRevision:2}})),null);
      assert.deepEqual(result(worker('candidates')),[]);
      sql('update public.cmt_mail_control set enabled=true;');
    });
    test('nightly claims reject future ticks, backfill outside an hour and targets already begun',()=>{
      for(const dueAt of [new Date(Date.now()+3600000).toISOString(),new Date(Date.now()-3660000).toISOString(),new Date().toISOString()])
        assert.equal(result(worker('claim',{...second,kind:'nightly',date:'2026-07-23',dueAt})),null);
    });
    test('complaint suppresses all owner mail and cannot be re-enabled by the traveler',()=>{
      result(worker('event',{id:'evt-3',providerId:'provider-1',type:'email.complained'}));
      assert.equal(result(login(a)+"select public.cmt_notification_state('trip-one');").preference.suppressed,true);
      sql(login(a)+expectError(prep(true,5),'PT403'));
      assert.equal(result(worker('claim',{...second,date:'2026-07-22',prefRevision:5})),null);
    });
    test('trip deletion removes mail contents/preferences; account deletion cascades suppression',()=>{
      sql(login(a)+"select public.cmt_delete_trip('trip-one',2);");
      assert.equal(sql('select count(*) from public.cmt_mail_jobs;'),'0');
      assert.equal(sql('select count(*) from public.cmt_notification_preferences;'),'0');
      sql(`delete from auth.users where id='${a}';`);
      assert.equal(sql('select count(*) from public.cmt_mail_suppression;'),'0');
    });
    console.log(`${passed} PostgreSQL mail checks passed`);
  } finally { sql(`drop database ${database} with (force);`, 'postgres'); }
}
main().catch(e=>{console.error(e);process.exitCode=1;});
