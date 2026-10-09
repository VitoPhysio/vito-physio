revoke execute on function public.can_read_communication(uuid, public.communications) from public, anon, authenticated;
grant execute on function public.can_read_communication(uuid, public.communications) to service_role;
