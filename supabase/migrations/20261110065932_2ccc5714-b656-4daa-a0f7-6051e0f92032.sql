drop index if exists public.notifications_event_dedupe_idx;
create unique index notifications_event_dedupe_idx on public.notifications(user_id,source_type,source_id,coalesce(actor_id,'00000000-0000-0000-0000-000000000000'::uuid)) where source_type is not null and source_id is not null;
create or replace function public.create_notification(_user_id uuid,_category text,_title text,_body text,_source_type text,_source_id uuid,_actor_id uuid,_path text) returns void language plpgsql security definer set search_path=public as $$
declare _name text; _avatar text;
begin
if _user_id is null or _user_id=_actor_id then return; end if;
if not public.notification_preference_enabled(_user_id,_category) then return; end if;
select full_name,avatar_path into _name,_avatar from public.profiles where id=_actor_id;
insert into public.notifications(user_id,title,body,kind,category,source_type,source_id,actor_id,actor_name,actor_avatar_path,path,data) values(_user_id,_title,_body,_category,_category,_source_type,_source_id,_actor_id,_name,_avatar,_path,jsonb_build_object('source_id',_source_id)) on conflict do nothing;
end $$;
create or replace function public.notify_social_follow() returns trigger language plpgsql security definer set search_path=public as $$ begin perform public.create_notification(new.following_id,'followers','New follower','Someone started following you.','social_follow',new.follower_id,new.follower_id,'/members/'||new.follower_id::text); return new; end $$;
create or replace function public.notify_direct_message() returns trigger language plpgsql security definer set search_path=public as $$ begin
insert into public.notifications(user_id,title,body,kind,category,source_type,source_id,actor_id,actor_name,actor_avatar_path,path,data)
select cp.user_id,'New message','Open VITO Physio to view this private message.','messages','messages','message',new.id,new.sender_id,p.full_name,p.avatar_path,'/messages?conversation='||new.conversation_id::text,jsonb_build_object('conversation_id',new.conversation_id)
from public.conversation_participants cp left join public.profiles p on p.id=new.sender_id where cp.conversation_id=new.conversation_id and cp.user_id<>new.sender_id and public.notification_preference_enabled(cp.user_id,'messages') on conflict do nothing; return new; end $$;
create or replace function public.notify_athlete_care() returns trigger language plpgsql security definer set search_path=public as $$ declare _athlete uuid; _category text; begin
_athlete:=coalesce(new.athlete_id,(select athlete_id from public.injuries where id=new.injury_id));
_category:=case when TG_TABLE_NAME='appointments' then 'appointments' else 'rehabilitation' end;
insert into public.notifications(user_id,title,body,kind,category,source_type,source_id,actor_id,path,data)
select g.user_id,initcap(replace(TG_TABLE_NAME,'_',' ')),'A new care update was added to an athlete record.',_category,_category,TG_TABLE_NAME,new.id,new.created_by,'/dashboard',jsonb_build_object('athlete_id',_athlete,'injury_id',new.injury_id)
from public.athlete_guardians g where g.athlete_id=_athlete and g.user_id is distinct from new.created_by and public.notification_preference_enabled(g.user_id,_category) on conflict do nothing; return new; end $$;
create or replace function public.notification_badge_count(_user_id uuid) returns integer language sql stable security definer set search_path=public as $$ select count(*)::integer from public.notifications where user_id=auth.uid() and _user_id=auth.uid() and read_at is null; $$;
create or replace function public.mark_conversation_read(_conversation_id uuid) returns void language plpgsql security definer set search_path=public as $$ begin
update public.conversation_participants set last_read_at=now() where conversation_id=_conversation_id and user_id=auth.uid();
update public.notifications set read_at=now() where user_id=auth.uid() and category='messages' and data->>'conversation_id'=_conversation_id::text and read_at is null;
end $$;
revoke execute on function public.create_notification(uuid,text,text,text,text,uuid,uuid,text),public.notify_social_follow(),public.notify_direct_message(),public.notify_athlete_care() from public,anon,authenticated;
revoke execute on function public.notification_badge_count(uuid),public.mark_conversation_read(uuid) from public,anon;
grant execute on function public.notification_badge_count(uuid),public.mark_conversation_read(uuid) to authenticated;
create index if not exists notification_delivery_pending_idx on public.notification_deliveries(status,next_attempt_at);
