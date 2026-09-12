-- Nonpersonal forecast cache. No trip/owner data and no direct browser privileges.
begin;
create table public.cmt_weather_control (
 singleton boolean primary key default true check(singleton),
 enabled boolean not null default false,
 daily_limit integer not null default 48 check(daily_limit between 1 and 1000),
 budget_day date not null default (now() at time zone 'UTC')::date,
 reserved_requests integer not null default 0 check(reserved_requests>=0)
);
insert into public.cmt_weather_control(singleton) values(true);
create table public.cmt_weather_cache (
 cache_key text primary key, city text not null check(city in ('paris','rome')),
 service_date date not null, window_start date not null,
 record jsonb, cache_until timestamptz, lease uuid, lease_until timestamptz,
 retry_at timestamptz, updated_at timestamptz not null default now()
);
alter table public.cmt_weather_control enable row level security;
alter table public.cmt_weather_cache enable row level security;
revoke all on public.cmt_weather_control, public.cmt_weather_cache from public,anon,authenticated;
create function public.cmt_weather_cache_worker(p_secret text,p_action text,p_city text default null,p_date date default null,p_lease uuid default null,p_record jsonb default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare expected text; c public.cmt_weather_control; row public.cmt_weather_cache;
 zone text; scope text; coords text; today date; key text; fetched timestamptz; expiry timestamptz; d jsonb;
begin
 select worker_hash into expected from public.cmt_mail_control where singleton;
 if p_secret is null or length(p_secret)<32 or expected is null or encode(sha256(convert_to(p_secret,'UTF8')),'hex')<>expected then raise sqlstate 'PT401'; end if;
 -- One small global row serializes budget reservations and same-key leases.
 select * into c from public.cmt_weather_control where singleton for update;
 if p_action='ops' then return jsonb_build_object('enabled',c.enabled,'dailyLimit',c.daily_limit,'budgetDay',c.budget_day,'reservedRequests',c.reserved_requests,'cacheEntries',(select count(*) from public.cmt_weather_cache)); end if;
 if not c.enabled then return jsonb_build_object('state','disabled'); end if;
 if p_city not in ('paris','rome') or p_city is null or p_date is null or p_action not in ('claim','finish') or p_action is null then raise sqlstate 'PT400'; end if;
 zone:=case p_city when 'paris' then 'Europe/Paris' else 'Europe/Rome' end;
 scope:=case p_city when 'paris' then 'Paris city centre' else 'Rome city centre' end;
 coords:=case p_city when 'paris' then '48.86,2.35' else '41.9,12.5' end;
 today:=(now() at time zone zone)::date;
 if p_date<today or p_date>today+6 then return jsonb_build_object('state','out-of-horizon'); end if;
 key:='open-meteo-daily-1|commercial|'||coords||'|'||zone||'|celsius,mm,kmh|7|'||today::text||'|'||p_date::text;
 if p_action='claim' then
   delete from public.cmt_weather_cache where updated_at<now()-interval '48 hours';
   insert into public.cmt_weather_cache(cache_key,city,service_date,window_start) values(key,p_city,p_date,today) on conflict do nothing;
   select * into row from public.cmt_weather_cache where cache_key=key for update;
   if row.record is not null and row.cache_until>now() then return jsonb_build_object('state','hit','record',row.record); end if;
   if row.lease_until>now() or row.retry_at>now() then return jsonb_build_object('state','busy'); end if;
   if c.budget_day<>(now() at time zone 'UTC')::date then
     update public.cmt_weather_control set budget_day=(now() at time zone 'UTC')::date,reserved_requests=0 where singleton;
     c.reserved_requests:=0;
   end if;
   if c.reserved_requests>=c.daily_limit then return jsonb_build_object('state','budget'); end if;
   update public.cmt_weather_control set reserved_requests=reserved_requests+1 where singleton;
   update public.cmt_weather_cache set lease=gen_random_uuid(),lease_until=now()+interval '30 seconds',updated_at=now() where cache_key=key returning * into row;
   return jsonb_build_object('state','lease','lease',row.lease);
 end if;
 select * into row from public.cmt_weather_cache where cache_key=key for update;
 if row.lease is null or p_lease is null or row.lease<>p_lease or row.lease_until<=now() then return jsonb_build_object('state','superseded'); end if;
 if p_record is null then
   update public.cmt_weather_cache set record=null,cache_until=null,lease=null,lease_until=null,retry_at=now()+interval '5 minutes',updated_at=now() where cache_key=key;
   return jsonb_build_object('state','unavailable');
 end if;
 if jsonb_typeof(p_record)<>'object' or octet_length(p_record::text)>4096
   or p_record-array['schemaVersion','adapter','id','cityId','date','timeZone','scope','fetchedAt','issuedAt','expiresAt','source','synthetic','state','daily']<>'{}'::jsonb
   or not coalesce(p_record->'schemaVersion'='1'::jsonb and p_record->>'adapter'='open-meteo-daily-1'
     and p_record->>'id' ~ '^weather-[a-f0-9]{16}$' and p_record->>'cityId'=p_city and p_record->>'date'=p_date::text
     and p_record->>'timeZone'=zone and p_record->>'scope'=scope and p_record->>'source'='https://open-meteo.com/'
     and p_record->'synthetic'='false'::jsonb and p_record->'issuedAt'='null'::jsonb and p_record->>'state'='forecast',false) then raise sqlstate 'PT400'; end if;
 begin
   fetched:=(p_record->>'fetchedAt')::timestamptz; expiry:=(p_record->>'expiresAt')::timestamptz;
   d:=p_record->'daily';
   if jsonb_typeof(d)<>'object' or d-array['lowC','highC','precipitationMm','precipitationProbability','maxWindKmh']<>'{}'::jsonb
     or not coalesce(jsonb_typeof(d->'lowC')='number' and jsonb_typeof(d->'highC')='number'
       and jsonb_typeof(d->'precipitationMm')='number' and jsonb_typeof(d->'precipitationProbability')='number' and jsonb_typeof(d->'maxWindKmh')='number'
       and (d->>'lowC')::numeric>=-90 and (d->>'highC')::numeric<=65 and (d->>'lowC')::numeric<=(d->>'highC')::numeric
       and (d->>'precipitationMm')::numeric between 0 and 2000 and (d->>'precipitationProbability')::numeric between 0 and 100 and (d->>'maxWindKmh')::numeric between 0 and 500,false)
     or fetched is null or expiry is null or fetched>now()+interval '1 minute' or fetched<now()-interval '1 hour'
     or expiry<=now() or expiry<=fetched or expiry>fetched+interval '2 hours' then raise exception 'Invalid forecast'; end if;
 exception when others then raise sqlstate 'PT400'; end;
 update public.cmt_weather_cache set record=p_record,cache_until=least(fetched+interval '1 hour',expiry),lease=null,lease_until=null,retry_at=null,updated_at=now() where cache_key=key;
 return jsonb_build_object('state','stored');
end $$;
revoke all on function public.cmt_weather_cache_worker(text,text,text,date,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.cmt_weather_cache_worker(text,text,text,date,uuid,jsonb) to anon;
commit;
