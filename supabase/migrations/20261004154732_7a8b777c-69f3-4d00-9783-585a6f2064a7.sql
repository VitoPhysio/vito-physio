revoke execute on function public.can_view_athlete(uuid, uuid) from public;
revoke execute on function public.can_read_communication(uuid, public.communications) from public;
revoke execute on function public.get_sender_names(uuid[]) from public;
grant execute on function public.can_view_athlete(uuid, uuid) to authenticated;
grant execute on function public.can_read_communication(uuid, public.communications) to authenticated;
grant execute on function public.get_sender_names(uuid[]) to authenticated;