-- Cover social foreign-key columns used by account and engagement cleanup/lookups.
create index if not exists social_likes_user_idx on public.social_likes(user_id);
create index if not exists social_comments_author_idx on public.social_comments(author_id);
create index if not exists social_shares_user_idx on public.social_shares(user_id);
