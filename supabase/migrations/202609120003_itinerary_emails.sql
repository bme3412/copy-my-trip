-- Opt-in itinerary mail. All writes use narrow functions; no browser admin credential.
begin;
create table public.cmt_mail_control (
  singleton boolean primary key default true check(singleton),
  enabled boolean not null default false,
  worker_hash text,
  pilot_owner uuid references auth.users(id) on delete set null,
  daily_limit integer not null default 5 check(daily_limit between 1 and 100),
  require_pilot boolean not null default true
);
insert into public.cmt_mail_control(singleton) values(true);
create table public.cmt_mail_suppression (
  owner_id uuid primary key references auth.users(id) on delete cascade,
  reason text not null, created_at timestamptz not null default now()
);
create table public.cmt_notification_preferences (
  owner_id uuid not null, trip_id text not null, revision integer not null default 1,
  enabled boolean not null default false, zone text not null, local_time text not null,
  activated_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  primary key(owner_id,trip_id), foreign key(owner_id,trip_id) references public.cmt_trips(owner_id,id) on delete cascade
);
create table public.cmt_mail_jobs (
  id uuid primary key default gen_random_uuid(), owner_id uuid not null, trip_id text not null,
  service_date date not null, kind text not null check(kind in ('nightly','test')),
  state text not null check(state in ('preparing','submitting','accepted','delivered','failed','unknown','cancelled','bounced','complained','suppressed')),
  trip_revision integer not null, pref_revision integer not null, zone text not null,
  lease uuid not null default gen_random_uuid(), lease_until timestamptz not null,
  attempts integer not null default 1, snapshot jsonb, briefing jsonb,
  recipient text, provider_id text unique, error_code text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), submitted_at timestamptz,
  unique(owner_id,trip_id,service_date,kind),
  foreign key(owner_id,trip_id) references public.cmt_trips(owner_id,id) on delete cascade
);
create index cmt_mail_jobs_owner on public.cmt_mail_jobs(owner_id,trip_id,created_at desc);
create table public.cmt_mail_events (
  id text primary key, provider_id text not null, event_type text not null,
  received_at timestamptz not null default now()
);
-- Events hold only provider IDs/outcomes (no addresses or itinerary); expire after 90 days.
alter table public.cmt_mail_control enable row level security;
alter table public.cmt_mail_suppression enable row level security;
alter table public.cmt_notification_preferences enable row level security;
alter table public.cmt_mail_jobs enable row level security;
alter table public.cmt_mail_events enable row level security;
revoke all on public.cmt_mail_control,public.cmt_mail_suppression,public.cmt_notification_preferences,public.cmt_mail_jobs,public.cmt_mail_events from public,anon,authenticated;

create function public.cmt_mail_ready(u uuid) returns boolean language sql stable security definer set search_path='' as $$
  select coalesce(enabled and worker_hash is not null and (not require_pilot or pilot_owner=u), false) from public.cmt_mail_control where singleton
$$;
create function public.cmt_notification_state(p_trip_id text) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=public.cmt_owner(); pref jsonb;
begin
  if not exists(select from public.cmt_trips where owner_id=u and id=p_trip_id and not deleted) then raise sqlstate 'PT404'; end if;
  select jsonb_build_object('tripId',trip_id,'revision',revision,'enabled',enabled,'zone',zone,'time',local_time,'activatedAt',activated_at,
    'suppressed',exists(select from public.cmt_mail_suppression where owner_id=u)) into pref from public.cmt_notification_preferences where owner_id=u and trip_id=p_trip_id;
  return jsonb_build_object('preference',pref,'ready',public.cmt_mail_ready(u),'deliveries',
    (select coalesce(jsonb_agg(x order by x.updated_at desc),'[]'::jsonb) from
      (select id,service_date,kind,state,updated_at from public.cmt_mail_jobs where owner_id=u and trip_id=p_trip_id order by updated_at desc limit 20) x));
end $$;
create function public.cmt_set_notifications(p_trip_id text,p_expected_revision integer,p_enabled boolean,p_zone text,p_time text) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=public.cmt_owner(); p public.cmt_notification_preferences;
begin
  perform 1 from auth.users where id=u for update;
  if not exists(select from public.cmt_trips where owner_id=u and id=p_trip_id and not deleted) then raise sqlstate 'PT404'; end if;
  if p_enabled is null or p_time is null or p_time !~ '^(18|19|20|21|22|23):[0-5][0-9]$' or p_zone is null
    or not exists(select from pg_timezone_names where name=p_zone) then raise sqlstate 'PT400'; end if;
  if p_enabled and (not coalesce(public.cmt_mail_ready(u),false) or exists(select from public.cmt_mail_suppression where owner_id=u)) then raise sqlstate 'PT403' using message='Mail unavailable'; end if;
  select * into p from public.cmt_notification_preferences where owner_id=u and trip_id=p_trip_id for update;
  if p_expected_revision is null or coalesce(p.revision,0)<>p_expected_revision then raise sqlstate 'PT409'; end if;
  insert into public.cmt_notification_preferences(owner_id,trip_id,enabled,zone,local_time) values(u,p_trip_id,p_enabled,p_zone,p_time)
  on conflict(owner_id,trip_id) do update set enabled=p_enabled,zone=p_zone,local_time=p_time,revision=cmt_notification_preferences.revision+1,
    activated_at=now(),updated_at=now();
  -- An HTTP submission already reserved cannot reliably be recalled; never label it cancelled.
  update public.cmt_mail_jobs set state='cancelled',snapshot=null,updated_at=now() where owner_id=u and trip_id=p_trip_id and state='preparing';
  return public.cmt_notification_state(p_trip_id);
end $$;
create function public.cmt_read_mail(p_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=public.cmt_owner(); result jsonb;
begin
 select jsonb_build_object('id',j.id,'briefing',j.briefing,'state',j.state,'kind',j.kind,'newerVersion',t.revision>j.trip_revision) into result
 from public.cmt_mail_jobs j join public.cmt_trips t on (t.owner_id,t.id)=(j.owner_id,j.trip_id)
 where j.id=p_id and j.owner_id=u and not t.deleted and j.briefing is not null;
 if result is null then raise sqlstate 'PT404'; end if;
 return result;
end $$;
-- A trip tombstone must remove mail contents/preferences in the same transaction.
create function public.cmt_trip_mail_delete() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.deleted and not old.deleted then
   delete from public.cmt_mail_jobs where owner_id=new.owner_id and trip_id=new.id;
   delete from public.cmt_notification_preferences where owner_id=new.owner_id and trip_id=new.id;
 end if;
 return new;
end $$;
create trigger cmt_trip_mail_delete after update of deleted on public.cmt_trips for each row execute function public.cmt_trip_mail_delete();

-- The server has a separate random worker capability, not a service-role key.
-- Constant-size SHA-256 comparison; missing configuration fails closed.
create function public.cmt_mail_worker(p_secret text,p_action text,p_data jsonb default '{}'::jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare c public.cmt_mail_control; u uuid; p public.cmt_notification_preferences; j public.cmt_mail_jobs; t public.cmt_trips;
  snapshots jsonb; mail text; newstate text;
begin
 select * into c from public.cmt_mail_control where singleton;
 if p_secret is null or length(p_secret)<32 or c.worker_hash is null or encode(sha256(convert_to(p_secret,'UTF8')),'hex')<>c.worker_hash then raise sqlstate 'PT401'; end if;
 if p_action='event' then
   if p_data->>'type' not in ('email.sent','email.delivered','email.delivery_delayed','email.failed','email.bounced','email.complained','email.suppressed') then return '{}'::jsonb; end if;
   insert into public.cmt_mail_events(id,provider_id,event_type) values(p_data->>'id',p_data->>'providerId',p_data->>'type') on conflict do nothing;
   -- Reconciliation also runs at finish: an event may precede the HTTP response.
 elsif p_action='candidates' then
   update public.cmt_mail_jobs set state='failed',snapshot=null,error_code='preparation_expired',updated_at=now() where state='preparing' and attempts>=3 and lease_until<now();
   update public.cmt_mail_jobs set state='unknown',error_code='submission_interrupted',updated_at=now() where state='submitting' and lease_until<now();
   delete from public.cmt_mail_events where received_at<now()-interval '90 days';
   delete from public.cmt_mail_jobs where created_at<now()-interval '90 days';
   if not c.enabled then return '[]'::jsonb; end if;
   return (select coalesce(jsonb_agg(x),'[]'::jsonb) from (
    select prefrow.owner_id as "ownerId",prefrow.trip_id as "tripId",prefrow.revision,prefrow.zone,prefrow.local_time as "time",prefrow.activated_at as "activatedAt",prefrow.enabled,false as suppressed,
      jsonb_build_object('id',triprow.id,'revision',triprow.revision,'segments',(select jsonb_agg(jsonb_build_object('id',s.id,'snapshot',v.snapshot) order by s.position)
      from public.cmt_trip_segments s join public.cmt_plan_versions v on (v.owner_id,v.trip_id,v.segment_id,v.id)=(s.owner_id,s.trip_id,s.id,s.accepted_version_id)
      where s.owner_id=prefrow.owner_id and s.trip_id=prefrow.trip_id)) as trip
    from public.cmt_notification_preferences prefrow join public.cmt_trips triprow on (triprow.owner_id,triprow.id)=(prefrow.owner_id,prefrow.trip_id)
    where prefrow.enabled and not triprow.deleted and (not c.require_pilot or prefrow.owner_id=c.pilot_owner)
      and not exists(select from public.cmt_mail_suppression where owner_id=prefrow.owner_id)
    order by prefrow.updated_at limit 20) x);
 elsif p_action='claim' then
   u:=(p_data->>'ownerId')::uuid;
   perform 1 from auth.users where id=u for update;
   select * into p from public.cmt_notification_preferences where owner_id=u and trip_id=p_data->>'tripId';
   select * into t from public.cmt_trips where owner_id=u and id=p_data->>'tripId';
   if not coalesce(public.cmt_mail_ready(u),false) or t.id is null or t.deleted or p.trip_id is null
      or (p_data->>'kind'='nightly' and not p.enabled) or p.revision<>(p_data->>'prefRevision')::integer or t.revision<>(p_data->>'tripRevision')::integer
      or exists(select from public.cmt_mail_suppression where owner_id=u) then return 'null'::jsonb; end if;
   if p_data->>'kind'='nightly' and ((p_data->>'dueAt')::timestamptz>now() or (p_data->>'dueAt')::timestamptz<now()-interval '60 minutes'
      or (p_data->>'dueAt')::timestamptz<p.activated_at or now()>=((p_data->>'date')::date::timestamp at time zone p.zone)) then return 'null'::jsonb; end if;
   select * into j from public.cmt_mail_jobs where owner_id=u and trip_id=t.id and service_date=(p_data->>'date')::date and kind=p_data->>'kind' for update;
   if j.id is not null and (j.state<>'preparing' or j.lease_until>now() or j.attempts>=3) then return 'null'::jsonb; end if;
   select jsonb_build_object('id',t.id,'revision',t.revision,'segments',jsonb_agg(jsonb_build_object('id',s.id,'snapshot',v.snapshot) order by s.position)) into snapshots
   from public.cmt_trip_segments s join public.cmt_plan_versions v on (v.owner_id,v.trip_id,v.segment_id,v.id)=(s.owner_id,s.trip_id,s.id,s.accepted_version_id) where s.owner_id=u and s.trip_id=t.id;
   insert into public.cmt_mail_jobs(owner_id,trip_id,service_date,kind,state,trip_revision,pref_revision,zone,lease_until,snapshot)
   values(u,t.id,(p_data->>'date')::date,p_data->>'kind','preparing',t.revision,p.revision,p.zone,now()+interval '5 minutes',snapshots)
   on conflict(owner_id,trip_id,service_date,kind) do update set lease=gen_random_uuid(),lease_until=now()+interval '5 minutes',attempts=cmt_mail_jobs.attempts+1,
     snapshot=excluded.snapshot,trip_revision=t.revision,pref_revision=p.revision,zone=p.zone,updated_at=now()
   returning * into j;
   return jsonb_build_object('id',j.id,'lease',j.lease,'trip',j.snapshot,'date',j.service_date,'zone',j.zone,'kind',j.kind);
 elsif p_action in ('submit','finish','fail') then
   select owner_id into u from public.cmt_mail_jobs where id=(p_data->>'id')::uuid;
   if u is null then return 'null'::jsonb; end if;
   perform 1 from auth.users where id=u for update;
   select * into j from public.cmt_mail_jobs where id=(p_data->>'id')::uuid for update;
   if j.lease<>(p_data->>'lease')::uuid then return 'null'::jsonb; end if;
   if p_action='submit' then
     if j.state<>'preparing' or j.lease_until<now() then return 'null'::jsonb; end if;
     select * into p from public.cmt_notification_preferences where owner_id=u and trip_id=j.trip_id;
     select * into t from public.cmt_trips where owner_id=u and id=j.trip_id;
     select email into mail from auth.users where id=u and email_confirmed_at is not null and not coalesce(is_anonymous,false);
     if t.revision<>j.trip_revision and not t.deleted and p.revision=j.pref_revision and (j.kind='test' or p.enabled) then
       update public.cmt_mail_jobs set lease_until=now()-interval '1 second',snapshot=null,updated_at=now() where id=j.id; return 'null'::jsonb;
     end if;
     if not coalesce(public.cmt_mail_ready(u),false) or mail is null or t.deleted or p.revision<>j.pref_revision or t.revision<>j.trip_revision
       or (j.kind='nightly' and not p.enabled) or exists(select from public.cmt_mail_suppression where owner_id=u) then
       update public.cmt_mail_jobs set state='cancelled',snapshot=null,updated_at=now() where id=j.id; return 'null'::jsonb;
     end if;
     -- Serialize the global daily cap across different owners.
     perform 1 from public.cmt_mail_control where singleton for update;
     if (select count(*) from public.cmt_mail_jobs where submitted_at>=date_trunc('day',now() at time zone 'UTC') at time zone 'UTC')>=c.daily_limit then return 'null'::jsonb; end if;
     if octet_length((p_data->'briefing')::text)>1500000 or p_data#>>'{briefing,tripId}'<>j.trip_id or (p_data#>>'{briefing,tripRevision}')::integer<>j.trip_revision then raise sqlstate 'PT400'; end if;
     update public.cmt_mail_jobs set state='submitting',briefing=p_data->'briefing',snapshot=null,recipient=mail,submitted_at=now(),lease_until=now()+interval '5 minutes',updated_at=now() where id=j.id;
     return jsonb_build_object('recipient',mail);
   elsif p_action='fail' then
     update public.cmt_mail_jobs set state='failed',snapshot=null,error_code='assembly_failed',updated_at=now() where id=j.id and state='preparing';
   else
     if j.state not in ('submitting','unknown') then return 'null'::jsonb; end if;
     newstate:=p_data->>'state';
     if newstate not in ('accepted','failed','unknown') then raise sqlstate 'PT400'; end if;
     update public.cmt_mail_jobs set state=newstate,provider_id=p_data->>'providerId',recipient=null,error_code=p_data->>'error',updated_at=now() where id=j.id;
   end if;
 elsif p_action='ops' then
   return jsonb_build_object('enabled',c.enabled,'dailyLimit',c.daily_limit,'pilotOnly',c.require_pilot,'states',(select coalesce(jsonb_object_agg(state,n),'{}') from (select state,count(*) n from public.cmt_mail_jobs group by state) x));
 else raise sqlstate 'PT400'; end if;
 -- Monotonic reconciliation by severity, independent of arrival order or replay.
 for j in select * from public.cmt_mail_jobs where provider_id is not null and (p_action='event' and provider_id=p_data->>'providerId' or p_action='finish' and id=(case when p_action='finish' then p_data->>'id' else null end)::uuid) loop
   perform 1 from auth.users where id=j.owner_id for update;
   perform 1 from public.cmt_mail_jobs where id=j.id for update;
   select case when bool_or(event_type='email.complained') then 'complained' when bool_or(event_type='email.bounced') then 'bounced'
    when bool_or(event_type='email.suppressed') then 'suppressed' when bool_or(event_type='email.delivered') then 'delivered'
    when bool_or(event_type='email.failed') then 'failed' else j.state end into newstate from public.cmt_mail_events where provider_id=j.provider_id;
   update public.cmt_mail_jobs set state=newstate,recipient=null,updated_at=now() where id=j.id;
   if newstate in ('complained','bounced','suppressed') then
     insert into public.cmt_mail_suppression(owner_id,reason) values(j.owner_id,newstate) on conflict do nothing;
     update public.cmt_notification_preferences set enabled=false,revision=revision+1,updated_at=now() where owner_id=j.owner_id and enabled;
     update public.cmt_mail_jobs set state='cancelled',snapshot=null,updated_at=now() where owner_id=j.owner_id and state='preparing';
   end if;
 end loop;
 return '{}'::jsonb;
end $$;
revoke all on function public.cmt_mail_ready(uuid),public.cmt_trip_mail_delete(),public.cmt_notification_state(text),public.cmt_set_notifications(text,integer,boolean,text,text),public.cmt_read_mail(uuid),public.cmt_mail_worker(text,text,jsonb) from public,anon,authenticated;
grant execute on function public.cmt_notification_state(text),public.cmt_set_notifications(text,integer,boolean,text,text),public.cmt_read_mail(uuid) to authenticated;
grant execute on function public.cmt_mail_worker(text,text,jsonb) to anon;
commit;
