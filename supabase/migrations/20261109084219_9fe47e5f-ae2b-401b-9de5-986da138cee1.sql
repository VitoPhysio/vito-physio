revoke execute on function public.notification_preference_enabled(uuid, text) from public, anon, authenticated;
revoke execute on function public.create_notification(uuid, text, text, text, text, uuid, uuid, text) from public, anon, authenticated;
revoke execute on function public.notify_social_like() from public, anon, authenticated;
revoke execute on function public.notify_social_comment() from public, anon, authenticated;
revoke execute on function public.notify_social_follow() from public, anon, authenticated;
revoke execute on function public.notify_social_share() from public, anon, authenticated;
revoke execute on function public.notify_direct_message() from public, anon, authenticated;
revoke execute on function public.notify_athlete_care() from public, anon, authenticated;