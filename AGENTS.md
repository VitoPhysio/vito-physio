<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## Rules
- Community navigation reserves matching side-rail space on signed-in Home and authenticated community pages; staff workspace paths use the shared isWorkspacePath predicate to omit both navigation and its spacing. Why: avoid covered content and community icons inside clinical/admin workspaces.
- Staff workspaces share dropdown navigation and case grouping; saved case edits whitelist clinical fields and use the existing signed-in client/RLS with row IDs preserved. Why: keep navigation consistent and prevent edits from relinking records or changing ownership.
- Chat gestures use a shared tested hook; messaging reads and writes use the signed-in Supabase client with participant-scoped policies. Why: preserve existing chats while avoiding actions during scrolling and access outside a conversation.
- Non-athlete profile editing reuses shared community fields through user-scoped server functions and never calls the athlete-save RPC; profile kind comes from user_roles. Why: preserve athlete records and prevent identity or role escalation without schema changes.
- Preserve the legacy /index preview address as a redirect to /. Why: saved editor navigation must open the existing homepage rather than a missing page.
- Backend is the user-connected external Supabase project; never enable Lovable Cloud. Why: user owns the data there.
- Roles live only in user_roles, assigned by the handle_new_user trigger. Why: prevents privilege escalation.
- Profile/athlete/organisation photos live in the private 'avatars' bucket, uploaded via the uploadPhoto server fn and shown with signed URLs. Why: workspace blocks public buckets.
- Sign-in aliases use each profile's unique VITO account ID; athlete and organisation IDs remain record-linking identifiers. Why: shared record IDs cannot safely identify one login account.

- Athlete Home, Discover and Profile share a portal presentation layer and reuse clinical data/functions; the existing staff dashboard remains separate. Why: preserve management flows while keeping community identity isolated from clinical records.
- Unavailable community features render honest empty states without querying undeployed tables. Why: avoid broken schemas and accidental clinical-directory exposure.
