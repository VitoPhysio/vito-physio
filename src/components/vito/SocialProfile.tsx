import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Check,
  Copy,
  Heart,
  ImagePlus,
  MessageCircle,
  MoreHorizontal,
  Pencil,
  RefreshCw,
  Send,
  Share2,
  Trash2,
  UserPlus,
} from "lucide-react";
import { useRef, useState } from "react";
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
import { PhotoAvatar, fileToPhotoPath, fileToSocialPostPhotoPath } from "@/components/vito/Photo";
import { supabase } from "@/integrations/supabase/client";
import { updateLinkedPhoto } from "@/lib/photo.functions";

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
  const [avatarPreviewOpen, setAvatarPreviewOpen] = useState(false);
  const [coverPreviewOpen, setCoverPreviewOpen] = useState(false);
  const [photoBusy, setPhotoBusy] = useState(false);
  const profileFileRef = useRef<HTMLInputElement>(null);
  const coverFileRef = useRef<HTMLInputElement>(null);
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
      <section className="min-h-dvh w-full bg-background px-4 py-6 text-sm text-muted-foreground sm:px-6">
        This profile could not be loaded. Please try again.
        <Button className="ml-3" size="sm" variant="outline" onClick={() => void profile.refetch()}>
          Retry
        </Button>
      </section>
    );
  }

  const member = profile.data;

  async function saveOwnerPhoto(target: "profile" | "community-cover", file: File | null) {
    setPhotoBusy(true);
    try {
      const path = file ? await fileToPhotoPath(file) : null;
      await updateLinkedPhoto({ data: { target, targetId: profileId, path } });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["social-profile", profileId] }),
        queryClient.invalidateQueries({ queryKey: ["viewer", profileId] }),
        queryClient.invalidateQueries({ queryKey: ["app-header", profileId] }),
      ]);
      toast.success(path ? "Photo updated" : "Photo removed");
      if (target === "profile") setAvatarPreviewOpen(false);
      else setCoverPreviewOpen(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Photo could not be updated.");
    } finally {
      setPhotoBusy(false);
    }
  }

  async function toggleFollow() {
    const { error } = await supabase.rpc("toggle_social_follow", { _following: profileId });
    if (error) {
      toast.error(error.message);
      return;
    }
    await queryClient.invalidateQueries({ queryKey: ["social-profile", profileId] });
  }

  return (
    <section className="min-h-dvh w-full overflow-hidden bg-background">
      <div className="relative h-32 overflow-hidden bg-gradient-to-br from-primary via-primary/90 to-accent sm:h-40">
        <button
          type="button"
          aria-label="View cover photo"
          onClick={() => setCoverPreviewOpen(true)}
          className="absolute inset-0 size-full text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-white"
        >
          {member.cover_path ? (
            <SocialImage
              path={member.cover_path}
              alt="Cover photo"
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(255,255,255,0.24),transparent_34%),radial-gradient(circle_at_80%_80%,rgba(255,255,255,0.18),transparent_32%)]" />
          )}
          <span className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-black/20" />
        </button>
      </div>
      <div className="relative -mt-12 px-4 pb-0 sm:-mt-14 sm:px-7">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <button
            type="button"
            aria-label="View profile picture"
            onClick={() => setAvatarPreviewOpen(true)}
            className="rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
          >
            <PhotoAvatar
              path={member.avatar_path}
              name={member.full_name}
              className="size-20 border-4 border-card bg-secondary text-2xl shadow-xl sm:size-24"
            />
          </button>
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
      <div className="divide-y border-y border-border/70">
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

      <Dialog open={avatarPreviewOpen} onOpenChange={setAvatarPreviewOpen}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Profile picture</DialogTitle>
          </DialogHeader>
          <div className="grid min-h-56 place-items-center overflow-hidden rounded-xl bg-secondary/50 p-3">
            {member.avatar_path ? (
              <SocialImage
                path={member.avatar_path}
                alt={`${member.full_name ?? "Member"} profile picture`}
                className="max-h-[60dvh] max-w-full rounded-lg object-contain"
              />
            ) : (
              <div className="grid size-48 place-items-center rounded-full bg-secondary text-5xl font-bold text-primary">
                {(member.full_name ?? "?").slice(0, 1).toUpperCase()}
              </div>
            )}
          </div>
          {isOwner && (
            <div className="flex flex-wrap justify-center gap-2">
              <Button disabled={photoBusy} onClick={() => profileFileRef.current?.click()}>
                <Pencil className="size-4" />
                {photoBusy ? "Saving…" : "Edit profile picture"}
              </Button>
              <Button
                variant="destructive"
                disabled={photoBusy || !member.avatar_path}
                onClick={() => void saveOwnerPhoto("profile", null)}
              >
                <Trash2 className="size-4" />
                Remove picture
              </Button>
              <input
                ref={profileFileRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="sr-only"
                disabled={photoBusy}
                onChange={(event) => {
                  const file = event.target.files?.[0] ?? null;
                  event.target.value = "";
                  if (file) void saveOwnerPhoto("profile", file);
                }}
              />
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={coverPreviewOpen} onOpenChange={setCoverPreviewOpen}>
        <DialogContent className="sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Cover photo</DialogTitle>
          </DialogHeader>
          <div className="grid min-h-40 place-items-center overflow-hidden rounded-xl bg-secondary/50 p-3">
            {member.cover_path ? (
              <SocialImage
                path={member.cover_path}
                alt="Profile cover photo"
                className="max-h-[65dvh] max-w-full rounded-lg object-contain"
              />
            ) : (
              <div className="grid min-h-40 w-full place-items-center rounded-lg bg-gradient-to-br from-primary/20 to-accent/20 text-sm text-muted-foreground">
                No cover photo yet
              </div>
            )}
          </div>
          {isOwner && (
            <div className="flex flex-wrap justify-center gap-2">
              <Button disabled={photoBusy} onClick={() => coverFileRef.current?.click()}>
                <Pencil className="size-4" />
                {photoBusy ? "Saving…" : "Edit cover photo"}
              </Button>
              <Button
                variant="destructive"
                disabled={photoBusy || !member.cover_path}
                onClick={() => void saveOwnerPhoto("community-cover", null)}
              >
                <Trash2 className="size-4" />
                Remove cover photo
              </Button>
              <input
                ref={coverFileRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="sr-only"
                disabled={photoBusy}
                onChange={(event) => {
                  const file = event.target.files?.[0] ?? null;
                  event.target.value = "";
                  if (file) void saveOwnerPhoto("community-cover", file);
                }}
              />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </section>
  );
}

export function SocialFeed({ viewerId }: { viewerId: string }) {
  const posts = useQuery({
    queryKey: ["social-posts", "feed", viewerId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("list_social_posts", {
        _tab: "feed",
        _limit: 40,
        _offset: 0,
      });
      if (error) throw error;
      return dedupePosts((data ?? []) as SocialPost[]);
    },
  });

  return (
    <section aria-label="Community posts" className="w-full">
      <div className="divide-y border-y border-border/70 bg-accent/5">
        <div className="flex justify-end px-2 py-1">
          <Button
            variant="ghost"
            size="icon"
            className="size-8"
            aria-label="Refresh posts"
            title="Refresh posts"
            onClick={() => void posts.refetch()}
          >
            <RefreshCw className="size-4" />
          </Button>
        </div>
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
        ...(body.trim() ? { _body: body.trim() } : {}),
        ...(mediaPath ? { _media_path: mediaPath } : {}),
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
  const [postOpen, setPostOpen] = useState(false);
  const [comment, setComment] = useState("");
  const comments = useQuery({
    queryKey: ["social-comments", post.id],
    enabled: postOpen,
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
      const nativeShare = typeof navigator.share === "function";
      if (nativeShare)
        await navigator.share({
          title: "VITO Physio post",
          text: post.body ?? "VITO Physio community post",
          url: link,
        });
      else await navigator.clipboard.writeText(link);
      toast.success(nativeShare ? "Post shared" : "Post link copied");
    } catch {
      toast.success("Post share recorded");
    }
    void queryClient.invalidateQueries({ queryKey: ["social-posts"] });
    void data;
  }

  return (
    <>
      <article
        id={`post-${post.id}`}
        role="group"
        tabIndex={0}
        aria-label={`Post by ${post.author_name || "VITO Physio member"}. Activate to open the full post.`}
        onClick={(event) => {
          if ((event.target as HTMLElement).closest("button, a")) return;
          setPostOpen(true);
        }}
        onKeyDown={(event) => {
          if ((event.target as HTMLElement) !== event.currentTarget) return;
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            setPostOpen(true);
          }
        }}
        className="cursor-pointer p-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary sm:p-5"
      >
        <div className="flex gap-3">
          <button
            type="button"
            aria-label={`Open ${post.author_name || "member"}'s profile`}
            onClick={() => window.location.assign(`/members/${post.author_id}`)}
            className="shrink-0 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <PhotoAvatar
              path={post.author_avatar_path}
              name={post.author_name}
              className="size-10"
            />
          </button>
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
                onClick={() => setPostOpen(true)}
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
          </div>
        </div>
      </article>

      <Dialog open={postOpen} onOpenChange={setPostOpen}>
        <DialogContent className="max-h-[92dvh] w-[min(96vw,52rem)] max-w-none overflow-hidden p-0">
          <DialogHeader className="sr-only">
            <DialogTitle>Post by {post.author_name || "VITO Physio member"}</DialogTitle>
            <DialogDescription>Full post and community comments.</DialogDescription>
          </DialogHeader>
          <div className="max-h-[92dvh] space-y-4 overflow-y-auto p-4 sm:space-y-5 sm:p-6">
            <div className="flex gap-3">
              <button
                type="button"
                aria-label={`Open ${post.author_name || "member"}'s profile`}
                onClick={() => window.location.assign(`/members/${post.author_id}`)}
                className="shrink-0 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                <PhotoAvatar
                  path={post.author_avatar_path}
                  name={post.author_name}
                  className="size-11"
                />
              </button>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold">
                  {post.author_name || "VITO Physio member"}
                </p>
                <p className="text-xs text-muted-foreground">{roleLabel(post.author_role)}</p>
              </div>
            </div>
            {post.body && <p className="whitespace-pre-wrap text-sm leading-6">{post.body}</p>}
            {post.media_path && (
              <SocialImage
                path={post.media_path}
                alt="Post media"
                className="max-h-[65vh] w-full rounded-2xl border object-contain"
              />
            )}
            <div className="flex items-center justify-between gap-1 border-y py-2 text-muted-foreground">
              <button
                type="button"
                onClick={() => void like()}
                className={`inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-xs transition-colors hover:bg-secondary ${post.liked ? "text-rose-600" : ""}`}
              >
                <Heart className={`size-4 ${post.liked ? "fill-current" : ""}`} />
                {post.likes_count || "Like"}
              </button>
              <span className="inline-flex items-center gap-1.5 px-2 py-1 text-xs">
                <MessageCircle className="size-4" />
                {post.comments_count || "Comment"}
              </span>
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
            <div className="space-y-3 rounded-xl bg-secondary/40 p-3 sm:p-4">
              <h3 className="text-sm font-semibold">Comments</h3>
              {comments.isLoading && (
                <p className="text-xs text-muted-foreground">Loading comments…</p>
              )}
              {comments.isError && (
                <p className="text-xs text-destructive">
                  Comments could not be loaded. Please try again.
                </p>
              )}
              {!comments.isLoading && !comments.isError && !comments.data?.length && (
                <p className="text-xs text-muted-foreground">Be the first to comment.</p>
              )}
              {comments.data?.map((item) => (
                <div key={item.id} className="flex gap-2">
                  <button
                    type="button"
                    aria-label={`Open ${item.author_name || "member"}'s profile`}
                    onClick={() => window.location.assign(`/members/${item.author_id}`)}
                    className="shrink-0 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  >
                    <PhotoAvatar
                      path={item.author_avatar_path}
                      name={item.author_name}
                      className="size-7"
                    />
                  </button>
                  <div className="min-w-0 flex-1 rounded-xl bg-background px-3 py-2">
                    <p className="text-xs font-bold">{item.author_name || "VITO Physio member"}</p>
                    <p className="mt-1 whitespace-pre-wrap text-sm">{item.body}</p>
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
          </div>
        </DialogContent>
      </Dialog>
    </>
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
    <section className="min-h-dvh w-full overflow-hidden bg-background">
      <div className="h-44 animate-pulse bg-secondary sm:h-56" />
      <div className="space-y-3 px-4 py-5">
        <div className="h-8 w-48 animate-pulse rounded bg-secondary" />
        <div className="h-4 w-72 animate-pulse rounded bg-secondary" />
      </div>
    </section>
  );
}

function SocialImage({ path, alt, className }: { path: string; alt: string; className?: string }) {
  const [open, setOpen] = useState(false);
  const { data: url } = useQuery({
    queryKey: ["social-image", path],
    queryFn: async () =>
      (await supabase.storage.from("avatars").createSignedUrl(path, 3600)).data?.signedUrl ?? null,
    staleTime: 50 * 60 * 1000,
  });
  if (!url)
    return <div className={`bg-secondary ${className ?? "h-40 rounded-xl"}`} aria-label={alt} />;
  return (
    <>
      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          setOpen(true);
        }}
        aria-label={`View ${alt} full size`}
        className="block w-full cursor-zoom-in text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      >
        <img src={url} alt={alt} className={className} />
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[96dvh] w-[min(96vw,72rem)] max-w-none overflow-hidden p-2 sm:p-4">
          <DialogHeader className="sr-only">
            <DialogTitle>{alt}</DialogTitle>
            <DialogDescription>
              Full-size image preview. Close to return to the post.
            </DialogDescription>
          </DialogHeader>
          <img src={url} alt={alt} className="max-h-[88dvh] w-full rounded-lg object-contain" />
        </DialogContent>
      </Dialog>
    </>
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
