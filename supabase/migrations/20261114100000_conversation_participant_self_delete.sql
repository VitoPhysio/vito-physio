grant delete on public.conversation_participants to authenticated;

create policy "participants delete own membership" on public.conversation_participants
for delete to authenticated
using (user_id = auth.uid());
