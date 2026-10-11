create index if not exists messages_sender_idx on public.messages(sender_id);

revoke execute on function public.touch_conversation_after_message() from public, anon, authenticated;
