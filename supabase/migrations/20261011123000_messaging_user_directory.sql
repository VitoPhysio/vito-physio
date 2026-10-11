drop function if exists public.list_messaging_users();

create or replace function public.list_messaging_users(_query text default null)
returns table(id uuid, full_name text, avatar_path text, role text)
language sql stable security definer set search_path = public as $$
  select p.id, p.full_name, p.avatar_path, coalesce(ur.role::text, 'athlete')
  from public.profiles p
  left join lateral (
    select r.role
    from public.user_roles r
    where r.user_id = p.id
    order by r.id
    limit 1
  ) ur on true
  where p.id <> coalesce(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid)
    and exists (select 1 from public.user_roles r where r.user_id = p.id)
    and (
      nullif(trim(_query), '') is null
      or p.full_name ilike '%' || trim(_query) || '%'
    )
  order by lower(trim(coalesce(p.full_name, ''))), p.id
  limit 200;
$$;

revoke execute on function public.list_messaging_users(text) from public, anon;
grant execute on function public.list_messaging_users(text) to authenticated;
