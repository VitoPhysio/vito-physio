create or replace function public.enqueue_notification_push() returns trigger language plpgsql security definer set search_path=public as $$ begin
insert into public.notification_deliveries(notification_id,device_token_id,next_attempt_at)
select new.id,d.id,now() from public.user_device_tokens d where d.user_id=new.user_id and d.disabled_at is null and coalesce((select push_enabled from public.notification_preferences where user_id=new.user_id),true)
on conflict do nothing; return new; end $$;
create trigger enqueue_notification_push after insert on public.notifications for each row execute function public.enqueue_notification_push();
revoke execute on function public.enqueue_notification_push() from public,anon,authenticated;
update public.notification_deliveries set next_attempt_at=now() where status='queued' and next_attempt_at is null;