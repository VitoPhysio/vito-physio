import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Check,
  Copy,
  Heart,
  ImagePlus,
  MessageCircle,
  MoreHorizontal,
  Send,
  Share2,
  UserPlus,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { PhotoAvatar, fileToSocialPostPhotoPath } from "@/components/vito/Photo";
import { supabase } from "@/integrations/supabase/client";

export type SocialTab = "posts" | "replies" | "media";

type SocialProfileSummary = {
  user_id: string;
  full_name: string | null;
  avatar_path: string | null;
  cover_path: string | null;
  role: string | null;
  headline: string | null;
  bio: string | null;
  sport: string | null;
  player_position: string | null;
  school_name: string | null;
  team: string | null;
  interests: string[];
  skills: string[];
  district: string | null;
  country: string | null;
  followers_count: number;
  following_count: number;
  posts_count: number;
  is_following: boolean;
};

type SocialPost = {
  id: string;
  author_id: string;
  author_name: string | null;
  author_avatar_path: string | null;
  author_role: string | null;
  body: string | null;
  media_path: string | null;
  parent_post_id: string | null;
  created_at: string;
  likes_count: number;
  comments_count: number;
  shares_count: number;
  liked: boolean;
  shared: boolean;
};

type SocialComment = {
  id: string;
  author_id: string;
  author_name: string | null;
  author_avatar_path: string | null;
  body: string;
  created_at: string;
};

const ROLE_LABEL: Record<string, string> = {
  super_admin: "Super admin",
  vito_admin: "VITO admin",
  clinical_professional: "Clinical professional",
  clinical_supervisor: "Clinical supervisor",
  school_admin: "School admin",
  coach: "Coach",
  athlete: "Athlete",
  parent: "Parent / guardian",
};

export function roleLabel(role: string | null | undefined) {
  return role ? (ROLE_LABEL[role] ?? role.replaceAll("_", " ")) : "VITO Physio member";
}

export function SocialProfile({
  profileId,
  viewerId,
  isOwner = profileId === viewerId,
  onEditProfile,
}: {
  profileId: string;
  viewerId: string;
  isOwner?: boolean;
  onEditProfile?: () => void;
}) {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<SocialTab>("posts");
  const profile = useQuery({
    queryKey: ["social-profile", profileId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("social_profile_summary", { _user_id: profileId });
      if (error) throw error;
      return (data?.[0] as SocialProfileSummary | undefined) ?? null;
    },
  });
  const posts = useQuery({
    queryKey: ["social-posts", profileId, tab],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("list_social_posts", {
        _profile_id: profileId,
        _tab: tab,
        _limit: 40,
        _offset: 0,
      });
      if (error) throw error;
      return dedupePosts((data ?? []) as SocialPost[]);
    },
    enabled: Boolean(profile.data),
  });

  if (profile.isLoading) return <SocialLoading />;
  if (profile.isError || !profile.data) {
    return (
      <section className="rounded-2xl border bg-card p-6 text-sm text-muted-foreground shadow-sm">
        This profile could not be loaded. Please try again.
        <Button className="ml-3" size="sm" variant="outline" onClick={() => void profile.refetch()}>
          Retry
        </Button>
      </section>
    );
  }

  const member = profile.data;
  async function toggleFollow() {
    const { error } = await supabase.rpc("toggle_social_follow", { _following: profileId });
    if (error) {
      toast.error(error.message);
      return;
    }
    await queryClient.invalidateQueries({ queryKey: ["social-profile", profileId] });
  }

  return (
    <section className="overflow-hidden rounded-2xl border bg-card shadow-sm">
      <div className="relative h-32 overflow-hidden bg-gradient-to-br from-primary via-primary/90 to-accent sm:h-40">
        {member.cover_path ? (
          <SocialImage path={member.cover_path} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(255,255,255,0.24),transparent_34%),radial-gradient(circle_at_80%_80%,rgba(255,255,255,0.18),transparent_32%)]" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-black/20" />
      </div>
      <div className="relative -mt-12 px-4 pb-0 sm:-mt-14 sm:px-7">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <PhotoAvatar
            path={member.avatar_path}
            name={member.full_name}
            className="size-20 border-4 border-card bg-secondary text-2xl shadow-xl sm:size-24"
          />
          {isOwner ? (
            <div className="flex flex-wrap gap-2 pb-1">
              {onEditProfile && (
                <Button variant="outline" size="sm" onClick={onEditProfile}>
                  Edit Profile
                </Button>
              )}
            </div>
          ) : (
            <Button
              size="sm"
              variant={member.is_following ? "outline" : "default"}
              onClick={() => void toggleFollow()}
            >
              {member.is_following ? <Check className="size-4" /> : <UserPlus className="size-4" />}
              {member.is_following ? "Following" : "Follow"}
            </Button>
          )}
        </div>
        <div className="space-y-3 pb-5 pt-3">
          <div>
            <h1 className="text-2xl font-black tracking-tight sm:text-3xl">
              {member.full_name || "VITO Physio member"}
            </h1>
            <p className="mt-1 text-sm font-semibold text-primary">{roleLabel(member.role)}</p>
          </div>
          {member.headline && <p className="text-sm font-medium">{member.headline}</p>}
          {(member.sport || member.player_position || member.team || member.school_name) && (
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm font-semibold text-primary">
              {[member.sport, member.player_position, member.team || member.school_name]
                .filter(Boolean)
                .map((item, index, items) => (
                  <span key={`${item}-${index}`} className="inline-flex items-center gap-2">
                    {item}
                    {index < items.length - 1 && (
                      <span aria-hidden="true" className="text-accent">
                        ·
                      </span>
                    )}
                  </span>
                ))}
            </div>
          )}
          {member.bio && (
            <p className="max-w-2xl whitespace-pre-wrap text-sm leading-6 text-muted-foreground">
              {member.bio}
            </p>
          )}
          {(member.interests.length > 0 || member.skills.length > 0) && (
            <div className="flex flex-wrap gap-2">
              {[...member.interests, ...member.skills].map((item) => (
                <span
                  key={item}
                  className="rounded-full bg-secondary px-3 py-1 text-xs font-medium"
                >
                  {item}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
      <div className="grid grid-cols-3 border-y bg-secondary/30 text-center">
        <Count label="Posts" value={member.posts_count} />
        <Count label="Followers" value={member.followers_count} />
        <Count label="Following" value={member.following_count} />
      </div>
      <div
        className="flex overflow-x-auto border-b px-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        role="tablist"
        aria-label="Profile posts"
      >
        {(
          [
            ["posts", "Posts"],
            ["replies", "Replies"],
            ["media", "Media"],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={tab === value}
            onClick={() => setTab(value)}
            className={`min-w-28 border-b-2 px-4 py-3 text-sm font-semibold transition-colors ${tab === value ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="divide-y">
        {posts.isLoading && <div className="p-6 text-sm text-muted-foreground">Loading posts…</div>}
        {posts.isError && (
          <div className="p-6 text-sm text-muted-foreground">
            Posts could not be loaded.
            <Button
              className="ml-3"
              size="sm"
              variant="outline"
              onClick={() => void posts.refetch()}
            >
              Retry
            </Button>
          </div>
        )}
        {!posts.isLoading && !posts.isError && !posts.data?.length && (
          <div className="p-8 text-center text-sm text-muted-foreground">No {tab} yet.</div>
        )}
        {posts.data?.map((post) => (
          <SocialPostCard key={post.id} post={post} />
        ))}
      </div>
    </section>
  );
}

export function SocialFeed({ viewerId }: { viewerId: string }) {
  const posts = useQuery({
    queryKey: ["social-posts", "feed", viewerId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("list_social_posts", {
        _profile_id: null,
        _tab: "feed",
        _limit: 40,
        _offset: 0,
      });
      if (error) throw error;
      return dedupePosts((data ?? []) as SocialPost[]);
    },
  });

  return (
    <section className="mx-auto mt-5 w-full max-w-6xl px-4 sm:px-5">
      <div className="mb-3 flex items-end justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-accent">
            Community feed
          </p>
          <h2 className="mt-1 text-xl font-black tracking-tight">For You</h2>
        </div>
        <Button variant="ghost" size="sm" onClick={() => void posts.refetch()}>
          Refresh
        </Button>
      </div>
      <div className="overflow-hidden rounded-2xl border bg-card shadow-sm">
        {posts.isLoading && (
          <div className="p-6 text-sm text-muted-foreground">Loading community posts…</div>
        )}
        {posts.isError && (
          <div className="p-6 text-sm text-muted-foreground">
            Community posts are unavailable right now.
          </div>
        )}
        {!posts.isLoading && !posts.isError && !posts.data?.length && (
          <div className="p-8 text-center text-sm text-muted-foreground">
            Posts from the VITO community will appear here.
          </div>
        )}
        {posts.data?.map((post) => (
          <SocialPostCard key={post.id} post={post} />
        ))}
      </div>
    </section>
  );
}

export function SocialComposerDialog({
  open,
  onOpenChange,
  userId,
  onPublished,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId?: string;
  onPublished?: () => void;
}) {
  const [body, setBody] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState("");
  const [busy, setBusy] = useState(false);
  const queryClient = useQueryClient();

  function reset() {
    setBody("");
    setFile(null);
    setPreview("");
  }

  async function publish() {
    if (!userId || (!body.trim() && !file)) return;
    setBusy(true);
    try {
      const mediaPath = file ? await fileToSocialPostPhotoPath(file) : null;
      const { error } = await supabase.rpc("create_social_post", {
        _body: body.trim() || null,
        _media_path: mediaPath,
        _parent_post_id: null,
      });
      if (error) throw error;
      await queryClient.invalidateQueries({ queryKey: ["social-posts"] });
      toast.success("Post published");
      reset();
      onOpenChange(false);
      onPublished?.();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Post could not be published.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) reset();
        onOpenChange(next);
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Send className="size-5 text-primary" />
            Create post
          </DialogTitle>
          <DialogDescription>
            Share a sports update, reflection, or picture with the VITO community.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <Textarea
            value={body}
            onChange={(event) => setBody(event.target.value)}
            maxLength={2000}
            rows={5}
            placeholder="What is happening in your sporting world?"
          />
          {preview && (
            <img
              src={preview}
              alt="Selected post preview"
              className="max-h-64 w-full rounded-xl border object-cover"
            />
          )}
          <div className="flex items-center justify-between gap-3">
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-full border px-3 py-2 text-sm font-semibold text-primary transition hover:bg-secondary">
              <ImagePlus className="size-4" /> Add picture
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="sr-only"
                onChange={(event) => {
                  const next = event.target.files?.[0] ?? null;
                  setFile(next);
                  setPreview(next ? URL.createObjectURL(next) : "");
                }}
              />
            </label>
            <Button
              disabled={busy || !userId || (!body.trim() && !file)}
              onClick={() => void publish()}
            >
              {busy ? "Publishing…" : "Publish"}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Pictures must be PNG, JPG, or WEBP and under 2MB.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function SocialPostCard({ post }: { post: SocialPost }) {
  const queryClient = useQueryClient();
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [comment, setComment] = useState("");
  const comments = useQuery({
    queryKey: ["social-comments", post.id],
    enabled: commentsOpen,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("list_social_comments", { _post_id: post.id });
      if (error) throw error;
      return (data ?? []) as SocialComment[];
    },
  });

  async function like() {
    const { error } = await supabase.rpc("toggle_social_like", { _post_id: post.id });
    if (error) toast.error(error.message);
    else void queryClient.invalidateQueries({ queryKey: ["social-posts"] });
  }

  async function addComment() {
    if (!comment.trim()) return;
    const { error } = await supabase.rpc("add_social_comment", {
      _post_id: post.id,
      _body: comment.trim(),
    });
    if (error) {
      toast.error(error.message);
      return;
    }
    setComment("");
    await queryClient.invalidateQueries({ queryKey: ["social-comments", post.id] });
    await queryClient.invalidateQueries({ queryKey: ["social-posts"] });
  }

  async function share() {
    const { data, error } = await supabase.rpc("share_social_post", { _post_id: post.id });
    if (error) {
      toast.error(error.message);
      return;
    }
    const link = `${window.location.origin}/profile#post-${post.id}`;
    try {
      if (navigator.share)
        await navigator.share({
          title: "VITO Physio post",
          text: post.body ?? "VITO Physio community post",
          url: link,
        });
      else await navigator.clipboard.writeText(link);
      toast.success(navigator.share ? "Post shared" : "Post link copied");
    } catch {
      toast.success("Post share recorded");
    }
    void queryClient.invalidateQueries({ queryKey: ["social-posts"] });
    void data;
  }

  return (
    <article id={`post-${post.id}`} className="p-4 sm:p-5">
      <div className="flex gap-3">
        <PhotoAvatar path={post.author_avatar_path} name={post.author_name} className="size-10" />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-bold">
                {post.author_name || "VITO Physio member"}
              </p>
              <p className="text-xs text-muted-foreground">
                {roleLabel(post.author_role)} · {formatDate(post.created_at)}
              </p>
            </div>
            <button
              type="button"
              aria-label="Post options"
              className="rounded-full p-1 text-muted-foreground hover:bg-secondary"
            >
              <MoreHorizontal className="size-4" />
            </button>
          </div>
          {post.body && <p className="mt-3 whitespace-pre-wrap text-sm leading-6">{post.body}</p>}
          {post.media_path && (
            <SocialImage
              path={post.media_path}
              alt="Post media"
              className="mt-3 max-h-[28rem] w-full rounded-2xl border object-cover"
            />
          )}
          <div className="mt-3 flex items-center justify-between gap-1 text-muted-foreground">
            <button
              type="button"
              onClick={() => void like()}
              className={`inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-xs transition-colors hover:bg-secondary ${post.liked ? "text-rose-600" : ""}`}
            >
              <Heart className={`size-4 ${post.liked ? "fill-current" : ""}`} />
              {post.likes_count || "Like"}
            </button>
            <button
              type="button"
              onClick={() => setCommentsOpen((open) => !open)}
              className="inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-xs transition-colors hover:bg-secondary"
            >
              <MessageCircle className="size-4" />
              {post.comments_count || "Comment"}
            </button>
            <button
              type="button"
              onClick={() => void share()}
              className="inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-xs transition-colors hover:bg-secondary"
            >
              <Share2 className="size-4" />
              {post.shares_count || "Share"}
            </button>
            <button
              type="button"
              aria-label="Copy post link"
              onClick={() =>
                void navigator.clipboard
                  ?.writeText(`${window.location.origin}/profile#post-${post.id}`)
                  .then(() => toast.success("Post link copied"))
              }
              className="rounded-full p-2 hover:bg-secondary"
            >
              <Copy className="size-4" />
            </button>
          </div>
          {commentsOpen && (
            <div className="mt-4 space-y-3 rounded-xl bg-secondary/40 p-3">
              {comments.isLoading && (
                <p className="text-xs text-muted-foreground">Loading comments…</p>
              )}
              {comments.data?.map((item) => (
                <div key={item.id} className="flex gap-2">
                  <PhotoAvatar
                    path={item.author_avatar_path}
                    name={item.author_name}
                    className="size-7"
                  />
                  <div className="min-w-0 rounded-xl bg-background px-3 py-2">
                    <p className="text-xs font-bold">{item.author_name || "VITO Physio member"}</p>
                    <p className="mt-1 text-sm">{item.body}</p>
                  </div>
                </div>
              ))}
              <div className="flex items-end gap-2">
                <Textarea
                  value={comment}
                  onChange={(event) => setComment(event.target.value)}
                  rows={2}
                  maxLength={800}
                  placeholder="Write a comment…"
                  aria-label="Write a comment"
                />
                <Button
                  size="icon"
                  disabled={!comment.trim()}
                  onClick={() => void addComment()}
                  aria-label="Send comment"
                >
                  <Send className="size-4" />
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </article>
  );
}

function Count({ label, value }: { label: string; value: number }) {
  return (
    <div className="px-3 py-3">
      <p className="text-sm font-bold">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}

function SocialLoading() {
  return (
    <section className="overflow-hidden rounded-2xl border bg-card shadow-sm">
      <div className="h-44 animate-pulse bg-secondary sm:h-56" />
      <div className="space-y-3 p-5">
        <div className="h-8 w-48 animate-pulse rounded bg-secondary" />
        <div className="h-4 w-72 animate-pulse rounded bg-secondary" />
      </div>
    </section>
  );
}

function SocialImage({ path, alt, className }: { path: string; alt: string; className?: string }) {
  const { data: url } = useQuery({
    queryKey: ["social-image", path],
    queryFn: async () =>
      (await supabase.storage.from("avatars").createSignedUrl(path, 3600)).data?.signedUrl ?? null,
    staleTime: 50 * 60 * 1000,
  });
  return url ? (
    <img src={url} alt={alt} className={className} />
  ) : (
    <div className={`bg-secondary ${className ?? "h-40 rounded-xl"}`} aria-label={alt} />
  );
}

function dedupePosts(posts: SocialPost[]) {
  return Array.from(new Map(posts.map((post) => [post.id, post])).values());
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}
