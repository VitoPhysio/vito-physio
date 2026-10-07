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
- Backend is the user-connected external Supabase project; never enable Lovable Cloud. Why: user owns the data there.
- Roles live only in user_roles, assigned by the handle_new_user trigger. Why: prevents privilege escalation.
- Profile/athlete/organisation photos live in the private 'avatars' bucket, uploaded via the uploadPhoto server fn and shown with signed URLs. Why: workspace blocks public buckets.
- Sign-in aliases use each profile's unique VITO account ID; athlete and organisation IDs remain record-linking identifiers. Why: shared record IDs cannot safely identify one login account.

- Athlete Home, Discover and Profile share a portal presentation layer and reuse clinical data/functions; the existing staff dashboard remains separate. Why: preserve management flows while keeping community identity isolated from clinical records.
- Unavailable community features render honest empty states without querying undeployed tables. Why: avoid broken schemas and accidental clinical-directory exposure.
