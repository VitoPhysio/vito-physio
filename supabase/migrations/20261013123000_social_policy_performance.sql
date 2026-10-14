-- Keep social RLS permission checks identical while avoiding per-row auth.uid() evaluation.

drop policy if exists social_follows_read on public.social_follows;
create policy social_follows_read on public.social_follows for select to authenticated
  using ((select auth.uid()) in (follower_id, following_id));

drop policy if exists social_follows_insert on public.social_follows;
create policy social_follows_insert on public.social_follows for insert to authenticated
  with check (follower_id = (select auth.uid()) and following_id <> (select auth.uid()));

drop policy if exists social_follows_delete on public.social_follows;
create policy social_follows_delete on public.social_follows for delete to authenticated
  using (follower_id = (select auth.uid()));

drop policy if exists social_posts_read on public.social_posts;
create policy social_posts_read on public.social_posts for select to authenticated
  using (public.social_can_view_profile((select auth.uid()), author_id));

drop policy if exists social_posts_insert on public.social_posts;
create policy social_posts_insert on public.social_posts for insert to authenticated
  with check (author_id = (select auth.uid()));

drop policy if exists social_posts_update on public.social_posts;
create policy social_posts_update on public.social_posts for update to authenticated
  using (author_id = (select auth.uid()))
  with check (author_id = (select auth.uid()));

drop policy if exists social_posts_delete on public.social_posts;
create policy social_posts_delete on public.social_posts for delete to authenticated
  using (author_id = (select auth.uid()));

drop policy if exists social_likes_read on public.social_likes;
create policy social_likes_read on public.social_likes for select to authenticated
  using (exists (select 1 from public.social_posts sp where sp.id = post_id and public.social_can_view_profile((select auth.uid()), sp.author_id)));

drop policy if exists social_likes_insert on public.social_likes;
create policy social_likes_insert on public.social_likes for insert to authenticated
  with check (user_id = (select auth.uid()));

drop policy if exists social_likes_delete on public.social_likes;
create policy social_likes_delete on public.social_likes for delete to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists social_comments_read on public.social_comments;
create policy social_comments_read on public.social_comments for select to authenticated
  using (exists (select 1 from public.social_posts sp where sp.id = post_id and public.social_can_view_profile((select auth.uid()), sp.author_id)));

drop policy if exists social_comments_insert on public.social_comments;
create policy social_comments_insert on public.social_comments for insert to authenticated
  with check (author_id = (select auth.uid()));

drop policy if exists social_comments_delete on public.social_comments;
create policy social_comments_delete on public.social_comments for delete to authenticated
  using (author_id = (select auth.uid()));

drop policy if exists social_shares_read on public.social_shares;
create policy social_shares_read on public.social_shares for select to authenticated
  using (exists (select 1 from public.social_posts sp where sp.id = post_id and public.social_can_view_profile((select auth.uid()), sp.author_id)));

drop policy if exists social_shares_insert on public.social_shares;
create policy social_shares_insert on public.social_shares for insert to authenticated
  with check (user_id = (select auth.uid()));

drop policy if exists social_shares_delete on public.social_shares;
create policy social_shares_delete on public.social_shares for delete to authenticated
  using (user_id = (select auth.uid()));
