begin;
-- Self-service deletion. No owner argument or administrative key crosses the API.
create function public.cmt_delete_account() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare u uuid := public.cmt_owner(); now_seconds numeric := extract(epoch from now());
begin
  if not exists (
    select 1 from jsonb_array_elements(coalesce(auth.jwt()->'amr', '[]'::jsonb)) a
    where a->>'method' = 'password'
      and (a->>'timestamp')::numeric between now_seconds - 300 and now_seconds + 30
  ) then
    raise sqlstate 'PT403' using message = 'Recent password authentication required';
  end if;
  -- Serialize against trip writes; existing foreign keys cascade private content.
  perform 1 from auth.users where id = u for update;
  delete from auth.users where id = u;
  if not found then raise sqlstate 'PT404' using message = 'Account unavailable'; end if;
  return jsonb_build_object('deleted', true);
end $$;
revoke all on function public.cmt_delete_account() from public, anon, authenticated;
grant execute on function public.cmt_delete_account() to authenticated;
commit;
