-- Optional private cloud copies. No notification subscription or worker is created.
begin;
create table public.cmt_trips (
  owner_id uuid not null references auth.users(id) on delete cascade,
  id text not null check (id ~ '^[a-zA-Z0-9_-]{1,100}$'),
  revision integer not null default 0 check (revision >= 0),
  deleted boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (owner_id, id)
);
create table public.cmt_trip_segments (
  owner_id uuid not null,
  trip_id text not null,
  id text not null check (id ~ '^[a-zA-Z0-9_-]{1,100}$'),
  position integer not null check (position between 0 and 7),
  accepted_version_id text not null,
  primary key (owner_id, trip_id, id),
  unique (owner_id, trip_id, position) deferrable initially deferred,
  foreign key (owner_id, trip_id) references public.cmt_trips(owner_id, id) on delete cascade
);
create table public.cmt_plan_versions (
  owner_id uuid not null,
  trip_id text not null,
  segment_id text not null,
  id text not null check (id ~ '^[a-zA-Z0-9_-]{1,100}$'),
  snapshot jsonb not null check (jsonb_typeof(snapshot) = 'object' and octet_length(snapshot::text) <= 1500000),
  created_at timestamptz not null default now(),
  primary key (owner_id, trip_id, segment_id, id),
  foreign key (owner_id, trip_id) references public.cmt_trips(owner_id, id) on delete cascade
);
alter table public.cmt_trip_segments add foreign key (owner_id, trip_id, id, accepted_version_id)
  references public.cmt_plan_versions(owner_id, trip_id, segment_id, id) deferrable initially deferred;

alter table public.cmt_trips enable row level security;
alter table public.cmt_trip_segments enable row level security;
alter table public.cmt_plan_versions enable row level security;
create policy own_trips on public.cmt_trips for select to authenticated using ((select auth.uid()) = owner_id);
create policy own_segments on public.cmt_trip_segments for select to authenticated using ((select auth.uid()) = owner_id);
create policy own_versions on public.cmt_plan_versions for select to authenticated using ((select auth.uid()) = owner_id);
revoke all on public.cmt_trips, public.cmt_trip_segments, public.cmt_plan_versions from anon, authenticated;
grant select on public.cmt_trips, public.cmt_trip_segments, public.cmt_plan_versions to authenticated;

-- Do not trust caller-supplied owner IDs or unverified/anonymous accounts.
create function public.cmt_owner() returns uuid language plpgsql stable security definer set search_path = '' as $$
declare u uuid := auth.uid();
begin
  if u is null or not exists (select 1 from auth.users where id = u and email_confirmed_at is not null and email is not null and coalesce(is_anonymous, false) = false) then
    raise sqlstate 'PT401' using message = 'Verified account required';
  end if;
  return u;
end $$;

create function public.cmt_read_trips(p_trip_id text default null) returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare u uuid := public.cmt_owner(); result jsonb;
begin
  if p_trip_id is null then
    select coalesce(jsonb_agg(head order by stamp desc), '[]'::jsonb) into result from (
      select t.updated_at stamp, jsonb_build_object('id', t.id, 'revision', t.revision, 'segments',
        (select coalesce(jsonb_agg(jsonb_build_object('id', s.id, 'versionId', v.id,
          'cityName', v.snapshot->>'cityName', 'arriving', v.snapshot#>>'{draft,arriving}', 'departing', v.snapshot#>>'{draft,departing}') order by s.position), '[]'::jsonb)
         from public.cmt_trip_segments s join public.cmt_plan_versions v on (v.owner_id,v.trip_id,v.segment_id,v.id) = (s.owner_id,s.trip_id,s.id,s.accepted_version_id)
         where s.owner_id=u and s.trip_id=t.id)) head
      from public.cmt_trips t where t.owner_id=u and not t.deleted order by t.updated_at desc limit 20
    ) heads;
  else
    select jsonb_build_object('id', t.id, 'revision', t.revision, 'segments',
      (select coalesce(jsonb_agg(jsonb_build_object('id',s.id,'snapshot',v.snapshot) order by s.position), '[]'::jsonb)
       from public.cmt_trip_segments s join public.cmt_plan_versions v on (v.owner_id,v.trip_id,v.segment_id,v.id)=(s.owner_id,s.trip_id,s.id,s.accepted_version_id)
       where s.owner_id=u and s.trip_id=t.id)) into result
    from public.cmt_trips t where t.owner_id=u and t.id=p_trip_id and not t.deleted;
    if result is null then raise sqlstate 'PT404' using message = 'Trip unavailable'; end if;
  end if;
  return result;
end $$;

create function public.cmt_save_trip(p_trip_id text, p_expected_revision integer, p_segments jsonb) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  u uuid := public.cmt_owner(); t public.cmt_trips; s jsonb; snap jsonb; old jsonb;
  pos integer := 0; prev_end date; starts date; ends date; seen text[] := '{}'; sid text; vid text;
begin
  if p_trip_id is null or p_trip_id !~ '^[a-zA-Z0-9_-]{1,100}$' or p_expected_revision is null or p_expected_revision < 0
    or jsonb_typeof(p_segments) is distinct from 'array' then raise sqlstate 'PT400' using message='Invalid request'; end if;
  if jsonb_array_length(p_segments) not between 1 and 8 or octet_length(p_segments::text)>1500000 then raise sqlstate 'PT413' using message='Size limit'; end if;
  -- Serialize account-level creates so concurrent imports cannot exceed the quota.
  perform 1 from auth.users where id=u for update;
  select * into t from public.cmt_trips where owner_id=u and id=p_trip_id for update;
  if not found then
    if p_expected_revision <> 0 then raise sqlstate 'PT409' using message='Stale revision'; end if;
    if (select count(*) from public.cmt_trips where owner_id=u and not deleted) >= 20 then raise sqlstate 'PT413' using message='Trip limit'; end if;
    insert into public.cmt_trips(owner_id,id) values(u,p_trip_id) returning * into t;
  end if;
  if t.deleted then raise sqlstate 'PT409' using message='Trip was deleted'; end if;
  -- Exact retries succeed even when the original response was lost; never roll back a newer version.
  if t.revision > 0 and (public.cmt_read_trips(p_trip_id)->'segments') = p_segments then
    return jsonb_build_object('id',t.id,'revision',t.revision);
  end if;
  if t.revision <> p_expected_revision then raise sqlstate 'PT409' using message='Stale revision'; end if;
  for s in select value from jsonb_array_elements(p_segments) loop
    snap:=s->'snapshot'; sid:=s->>'id'; vid:=snap->>'id';
    if sid is null or sid !~ '^[a-zA-Z0-9_-]{1,100}$' or sid=any(seen) or vid is null or vid !~ '^[a-zA-Z0-9_-]{1,100}$'
      or snap->>'tripId' is distinct from sid or snap->>'schemaVersion' is distinct from '1'
      or snap->>'cityId' not in ('paris','rome') or snap->>'cityId' is null
      or snap->>'timeZone' is distinct from (case when snap->>'cityId'='paris' then 'Europe/Paris' else 'Europe/Rome' end)
      or jsonb_typeof(snap->'days') is distinct from 'array' then raise sqlstate 'PT400' using message='Invalid snapshot identity'; end if;
    seen:=array_append(seen,sid);
    starts:=(snap#>>'{draft,arriving}')::date; ends:=(snap#>>'{draft,departing}')::date;
    if starts is null or ends is null or ends-starts not between 1 and 7 or starts<prev_end or jsonb_array_length(snap->'days')<>ends-starts then
      raise sqlstate 'PT400' using message='Invalid segment window'; end if;
    prev_end:=ends;
    select snapshot into old from public.cmt_plan_versions where owner_id=u and trip_id=p_trip_id and segment_id=sid and id=vid;
    if found and old is distinct from snap then raise sqlstate 'PT409' using message='Immutable version conflict'; end if;
    if old is null then
      if (select count(*) from public.cmt_plan_versions where owner_id=u and trip_id=p_trip_id) >= 128 then raise sqlstate 'PT413' using message='Version limit'; end if;
      insert into public.cmt_plan_versions(owner_id,trip_id,segment_id,id,snapshot) values(u,p_trip_id,sid,vid,snap);
    end if;
    insert into public.cmt_trip_segments(owner_id,trip_id,id,position,accepted_version_id) values(u,p_trip_id,sid,pos,vid)
      on conflict(owner_id,trip_id,id) do update set position=excluded.position,accepted_version_id=excluded.accepted_version_id;
    pos:=pos+1;
  end loop;
  delete from public.cmt_trip_segments where owner_id=u and trip_id=p_trip_id and not(id=any(seen));
  update public.cmt_trips set revision=revision+1,updated_at=now() where owner_id=u and id=p_trip_id returning * into t;
  return jsonb_build_object('id',t.id,'revision',t.revision);
end $$;

create function public.cmt_delete_trip(p_trip_id text, p_expected_revision integer) returns jsonb language plpgsql security definer set search_path = '' as $$
declare u uuid := public.cmt_owner(); t public.cmt_trips;
begin
  perform 1 from auth.users where id=u for update;
  select * into t from public.cmt_trips where owner_id=u and id=p_trip_id for update;
  if not found then raise sqlstate 'PT404' using message='Trip unavailable'; end if;
  if t.deleted then return jsonb_build_object('id',t.id,'revision',t.revision,'deleted',true); end if;
  if p_expected_revision is null or t.revision<>p_expected_revision then raise sqlstate 'PT409' using message='Stale revision'; end if;
  -- There are no jobs yet. Milestone 4 must cancel pending jobs in this transaction before shipping.
  delete from public.cmt_trip_segments where owner_id=u and trip_id=p_trip_id;
  delete from public.cmt_plan_versions where owner_id=u and trip_id=p_trip_id;
  update public.cmt_trips set deleted=true,revision=revision+1,updated_at=now() where owner_id=u and id=p_trip_id returning * into t;
  -- Minimal tombstone blocks delayed/offline writes from resurrecting private data.
  return jsonb_build_object('id',t.id,'revision',t.revision,'deleted',true);
end $$;
revoke all on function public.cmt_owner(), public.cmt_read_trips(text), public.cmt_save_trip(text,integer,jsonb), public.cmt_delete_trip(text,integer) from public, anon, authenticated;
grant execute on function public.cmt_read_trips(text), public.cmt_save_trip(text,integer,jsonb), public.cmt_delete_trip(text,integer) to authenticated;
commit;
