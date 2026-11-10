// @ts-nocheck -- uses tables missing from the generated database types
import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { Marked } from "marked";
import DOMPurify from "dompurify";
import TurndownService from "turndown";
import ReactMarkdown from "react-markdown";
import remarkDirective from "remark-directive";
import remarkGfm from "remark-gfm";
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  Bold,
  Bookmark,
  BookOpen,
  Check,
  Clock3,
  FileText,
  HeartPulse,
  ImagePlus,
  Palette,
  Type,
  Eraser,
  PenLine,
  Search,
  Share2,
  Sparkles,
  Underline,
  Tag,
} from "lucide-react";
import { toast } from "sonner";
import type { User } from "@supabase/supabase-js";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { uploadBlogArticleImage } from "@/lib/blog.functions";
import type { Database } from "@/integrations/supabase/types";

export type BlogArticle = Database["public"]["Tables"]["blog_articles"]["Row"];
const BLOG_WRITER_ROLES = [
  "super_admin",
  "vito_admin",
  "clinical_professional",
  "clinical_supervisor",
];
const CATEGORY_OPTIONS = [
  "Clinical insights",
  "Rehab & recovery",
  "Injury prevention",
  "Athlete stories",
  "Sporting stories",
  "Team culture",
];

export function useBlogAccess(userId: string) {
  return useQuery({
    queryKey: ["blog-access", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId);
      if (error) throw error;
      const roles = (data ?? []).map((item) => item.role);
      return {
        roles,
        canWrite: roles.some((role) => BLOG_WRITER_ROLES.includes(role)),
        isAdmin: roles.some((role) => ["super_admin", "vito_admin"].includes(role)),
      };
    },
    staleTime: 60_000,
  });
}

export function BlogFeed({ user }: { user: User }) {
  const access = useBlogAccess(user.id);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All stories");
  const [view, setView] = useState<"published" | "drafts">("published");
  const articles = useQuery({
    queryKey: ["blog-articles", user.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("blog_articles")
        .select("*")
        .order("published_at", { ascending: false, nullsFirst: false })
        .order("updated_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data ?? [];
    },
  });
  const visible = useMemo(() => {
    const rows = (articles.data ?? []).filter((article) =>
      view === "drafts" ? article.status === "draft" : article.status === "published",
    );
    const needle = query.trim().toLowerCase();
    return rows.filter((article) => {
      const categoryMatch = category === "All stories" || article.category === category;
      const queryMatch =
        !needle ||
        `${article.title} ${article.excerpt} ${article.category} ${article.author_name}`
          .toLowerCase()
          .includes(needle);
      return categoryMatch && queryMatch;
    });
  }, [articles.data, category, query, view]);

  const featured = visible[0];
  const rest = visible.slice(1);

  return (
    <main className="min-h-[calc(100dvh-4rem)] bg-background pb-24 text-foreground">
      <section className="relative overflow-hidden bg-hero-glow">
        <div className="mx-auto max-w-6xl px-5 py-4 sm:px-8">
          <div className="flex justify-end">
            {access.data?.canWrite && (
              <Button asChild className="rounded-full bg-brand-gradient px-5 shadow-glow">
                <Link to="/blog/write">
                  <PenLine className="mr-2 size-4" /> Write an article
                </Link>
              </Button>
            )}
          </div>
          <div className="mt-4 flex flex-col gap-3 border-t border-primary/10 pt-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap items-center gap-2">
              {access.data?.canWrite && (
                <div className="mr-2 flex rounded-full border bg-card p-1 shadow-sm">
                  {(["published", "drafts"] as const).map((item) => (
                    <button
                      key={item}
                      type="button"
                      onClick={() => setView(item)}
                      className={`rounded-full px-3 py-1.5 text-xs font-semibold capitalize transition ${view === item ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
                    >
                      {item === "drafts" ? "My drafts" : "Latest stories"}
                    </button>
                  ))}
                </div>
              )}
              {(["All stories", ...CATEGORY_OPTIONS] as const).map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => setCategory(item)}
                  className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${category === item ? "border-primary bg-primary text-primary-foreground" : "border-border/80 bg-card/80 text-muted-foreground hover:border-primary/40 hover:text-foreground"}`}
                >
                  {item}
                </button>
              ))}
            </div>
            <label className="relative block w-full sm:max-w-xs">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                aria-label="Search articles"
                placeholder="Find a story…"
                className="h-10 rounded-full bg-card pl-9"
              />
            </label>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-6xl px-5 py-8 sm:px-8 sm:py-10">
        {access.isLoading || articles.isLoading ? (
          <div className="grid gap-5 md:grid-cols-2">
            {[0, 1, 2, 3].map((item) => (
              <div key={item} className="h-64 animate-pulse rounded-3xl bg-muted" />
            ))}
          </div>
        ) : articles.error ? (
          <div className="rounded-3xl border bg-card p-8 text-center">
            <BookOpen className="mx-auto size-9 text-primary/60" />
            <h2 className="mt-3 text-lg font-bold">The journal is taking a breather</h2>
            <p className="mt-2 text-sm text-muted-foreground">We couldn’t load stories just now.</p>
            <Button variant="outline" className="mt-5" onClick={() => void articles.refetch()}>
              Try again
            </Button>
          </div>
        ) : visible.length ? (
          <>
            {view === "published" && featured && <FeaturedArticle article={featured} />}
            {rest.length > 0 && (
              <section className="mt-8" aria-label="More stories">
                <div className="mb-4 flex items-end justify-between gap-4">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.16em] text-primary">
                      {view === "drafts" ? "Work in progress" : "Keep exploring"}
                    </p>
                    <h2 className="mt-1 font-serif text-2xl font-bold sm:text-3xl">
                      {view === "drafts" ? "Your drafts" : "More good reads"}
                    </h2>
                  </div>
                  <span className="text-sm text-muted-foreground">{visible.length} stories</span>
                </div>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {(view === "drafts" ? visible : rest).map((article) => (
                    <ArticleCard key={article.id} article={article} draft={view === "drafts"} />
                  ))}
                </div>
              </section>
            )}
            {view === "published" && visible.length === 1 && (
              <p className="mt-5 text-center text-sm text-muted-foreground">
                That’s the latest. Check back soon for another story.
              </p>
            )}
          </>
        ) : (
          <div className="rounded-3xl border border-dashed bg-card/70 px-6 py-16 text-center">
            <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-secondary text-primary">
              {view === "drafts" ? (
                <FileText className="size-6" />
              ) : (
                <Sparkles className="size-6" />
              )}
            </span>
            <h2 className="mt-4 font-serif text-2xl font-bold">
              {view === "drafts"
                ? "No drafts yet"
                : query || category !== "All stories"
                  ? "No stories found"
                  : "The first chapter is waiting"}
            </h2>
            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">
              {view === "drafts"
                ? "Your unfinished articles will live here. Start a new story whenever inspiration strikes."
                : query || category !== "All stories"
                  ? "Try another search or choose a different topic."
                  : "There are no published articles yet. Clinicians and administrators can start the journal with a practical tip, a recovery story or a fresh idea."}
            </p>
            {access.data?.canWrite && view === "drafts" && (
              <Button asChild className="mt-5 rounded-full">
                <Link to="/blog/write">
                  <PenLine className="mr-2 size-4" /> Start writing
                </Link>
              </Button>
            )}
          </div>
        )}
      </div>
    </main>
  );
}

function FeaturedArticle({ article }: { article: BlogArticle }) {
  const readTime = estimateReadTime(article.content_markdown);
  return (
    <Link
      to="/blog/$slug"
      params={{ slug: article.slug }}
      className="group grid overflow-hidden rounded-[2rem] border bg-card shadow-sm transition hover:-translate-y-0.5 hover:shadow-card-lift md:grid-cols-[1.05fr_0.95fr]"
    >
      <div className="relative min-h-64 overflow-hidden bg-gradient-to-br from-primary via-primary/85 to-accent p-7 text-white sm:min-h-80 sm:p-10">
        {article.cover_image_url ? (
          <img
            src={article.cover_image_url}
            alt=""
            className="absolute inset-0 size-full object-cover"
          />
        ) : (
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_20%,rgba(255,255,255,0.30),transparent_35%),radial-gradient(circle_at_82%_78%,rgba(255,255,255,0.22),transparent_34%)]" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-black/10 to-black/15" />
        <div className="relative flex h-full min-h-52 flex-col justify-between sm:min-h-60">
          <span className="inline-flex w-fit items-center gap-2 rounded-full bg-white/15 px-3 py-1.5 text-xs font-bold backdrop-blur">
            <Sparkles className="size-3.5" /> Editor’s pick
          </span>
          <div>
            <span className="rounded-full border border-white/40 bg-black/15 px-3 py-1 text-xs font-semibold backdrop-blur">
              {article.category}
            </span>
            <p className="mt-4 text-sm text-white/80">A VITO journal story</p>
          </div>
        </div>
      </div>
      <div className="flex flex-col justify-center p-6 sm:p-10">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-medium text-muted-foreground">
          <span>{article.author_name}</span>
          <span aria-hidden="true">·</span>
          <span>{formatDate(article.published_at ?? article.created_at)}</span>
          <span aria-hidden="true">·</span>
          <span className="inline-flex items-center gap-1">
            <Clock3 className="size-3.5" /> {readTime} min read
          </span>
        </div>
        <h2 className="mt-5 font-serif text-3xl font-bold leading-tight tracking-tight group-hover:text-primary sm:text-4xl">
          <BlogInlineMarkdown content={article.title} />
        </h2>
        <p className="mt-4 line-clamp-3 text-sm leading-7 text-muted-foreground sm:text-base">
          <BlogInlineMarkdown
            content={article.excerpt || excerptFromMarkdown(article.content_markdown)}
          />
        </p>
        <span className="mt-7 inline-flex items-center gap-2 text-sm font-bold text-primary">
          Read the story{" "}
          <ArrowUpRight className="size-4 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
        </span>
      </div>
    </Link>
  );
}

function ArticleCard({ article, draft = false }: { article: BlogArticle; draft?: boolean }) {
  const destination = draft ? "/blog/edit/$articleId" : "/blog/$slug";
  return (
    <Link
      to={destination as never}
      params={(draft ? { articleId: article.id } : { slug: article.slug }) as never}
      className="group flex min-h-64 flex-col overflow-hidden rounded-3xl border bg-card transition hover:-translate-y-1 hover:border-primary/25 hover:shadow-card-lift"
    >
      <div className="relative h-36 overflow-hidden bg-gradient-to-br from-primary/15 via-secondary to-accent/25">
        {article.cover_image_url ? (
          <img
            src={article.cover_image_url}
            alt=""
            className="size-full object-cover transition duration-500 group-hover:scale-[1.03]"
          />
        ) : (
          <div className="flex size-full items-center justify-center bg-[radial-gradient(circle_at_22%_25%,rgba(124,58,237,0.18),transparent_40%),radial-gradient(circle_at_85%_80%,rgba(251,146,60,0.20),transparent_35%)]">
            <HeartPulse className="size-10 text-primary/40" strokeWidth={1.2} />
          </div>
        )}
        <span className="absolute left-3 top-3 rounded-full bg-background/90 px-3 py-1 text-[11px] font-bold text-primary shadow-sm backdrop-blur">
          {draft ? "Draft" : article.category}
        </span>
      </div>
      <div className="flex flex-1 flex-col p-5">
        <p className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <span>{draft ? "Updated" : article.author_name}</span>
          <span aria-hidden="true">·</span>
          <span>
            {formatDate(draft ? article.updated_at : (article.published_at ?? article.created_at))}
          </span>
        </p>
        <h3 className="mt-3 font-serif text-xl font-bold leading-snug group-hover:text-primary">
          <BlogInlineMarkdown content={article.title} />
        </h3>
        <p className="mt-2 line-clamp-3 text-sm leading-6 text-muted-foreground">
          <BlogInlineMarkdown
            content={article.excerpt || excerptFromMarkdown(article.content_markdown)}
          />
        </p>
        <span className="mt-auto flex items-center gap-1 pt-4 text-xs font-bold text-primary">
          {draft ? "Continue editing" : "Read article"}{" "}
          <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-1" />
        </span>
      </div>
    </Link>
  );
}

export function BlogArticlePage({ user, slug }: { user: User; slug: string }) {
  const access = useBlogAccess(user.id);
  const [showFullArticle, setShowFullArticle] = useState(false);
  useEffect(() => setShowFullArticle(false), [slug]);
  const articleQuery = useQuery({
    queryKey: ["blog-article", slug],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("blog_articles")
        .select("*")
        .eq("slug", slug)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
  const article = articleQuery.data;
  const bookmarkQuery = useQuery({
    queryKey: ["blog-bookmark", user.id, article?.id],
    enabled: Boolean(article?.id && article.status === "published"),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("blog_bookmarks")
        .select("article_id")
        .eq("user_id", user.id)
        .eq("article_id", article!.id)
        .maybeSingle();
      if (error) throw error;
      return Boolean(data);
    },
  });
  const related = useQuery({
    queryKey: ["blog-related", article?.id, article?.category],
    enabled: Boolean(article && article.status === "published"),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("blog_articles")
        .select("*")
        .eq("status", "published")
        .eq("category", article!.category)
        .neq("id", article!.id)
        .order("published_at", { ascending: false })
        .limit(3);
      if (error) throw error;
      return data ?? [];
    },
  });

  async function toggleBookmark() {
    if (!article) return;
    const currentlySaved = Boolean(bookmarkQuery.data);
    const result = currentlySaved
      ? await supabase
          .from("blog_bookmarks")
          .delete()
          .eq("user_id", user.id)
          .eq("article_id", article.id)
      : await supabase.from("blog_bookmarks").insert({ user_id: user.id, article_id: article.id });
    if (result.error) {
      toast.error("Your bookmark could not be updated. Please try again.");
      return;
    }
    await bookmarkQuery.refetch();
    toast.success(currentlySaved ? "Bookmark removed." : "Article bookmarked.");
  }

  async function shareArticle() {
    if (!article || typeof window === "undefined") return;
    const shareData = { title: article.title, text: article.excerpt, url: window.location.href };
    try {
      if (navigator.share) {
        await navigator.share(shareData);
      } else {
        await navigator.clipboard.writeText(window.location.href);
        toast.success("Article link copied.");
      }
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") return;
      toast.error("Could not share the article. You can copy its link from the address bar.");
    }
  }

  if (articleQuery.isLoading || access.isLoading) {
    return (
      <main className="mx-auto min-h-[70vh] max-w-4xl animate-pulse px-5 py-16">
        <div className="h-8 w-32 rounded-full bg-muted" />
        <div className="mt-8 h-20 rounded-2xl bg-muted" />
        <div className="mt-6 h-96 rounded-2xl bg-muted" />
      </main>
    );
  }
  if (
    articleQuery.error ||
    !article ||
    (article.status === "draft" && article.author_id !== user.id && !access.data?.isAdmin)
  ) {
    return (
      <main className="mx-auto flex min-h-[70vh] max-w-xl flex-col items-center justify-center px-5 text-center">
        <BookOpen className="size-10 text-primary/60" />
        <h1 className="mt-4 font-serif text-2xl font-bold">This story isn’t available</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          It may be a draft or its link may have changed.
        </p>
        <Button asChild variant="outline" className="mt-5">
          <Link to="/blog">
            <ArrowLeft className="mr-2 size-4" /> Back to the journal
          </Link>
        </Button>
      </main>
    );
  }
  const readTime = estimateReadTime(article.content_markdown);

  return (
    <main className="min-h-screen bg-background pb-24 text-foreground">
      <div className="mx-auto max-w-5xl px-5 pt-6 sm:px-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Button
            asChild
            variant="ghost"
            size="sm"
            className="-ml-3 rounded-full text-muted-foreground"
          >
            <Link to="/blog">
              <ArrowLeft className="mr-2 size-4" /> All stories
            </Link>
          </Button>
          {article.status === "draft" && (
            <span className="rounded-full bg-accent/15 px-3 py-1 text-xs font-bold text-accent-foreground">
              Draft preview
            </span>
          )}
          {access.data?.canWrite && (article.author_id === user.id || access.data.isAdmin) && (
            <Button asChild variant="outline" size="sm" className="rounded-full">
              <Link to="/blog/edit/$articleId" params={{ articleId: article.id }}>
                <PenLine className="mr-2 size-4" /> Edit story
              </Link>
            </Button>
          )}
        </div>
      </div>
      <article className="mx-auto max-w-5xl px-5 pb-12 sm:px-8">
        <header className="mx-auto max-w-3xl pb-8 pt-8 sm:pb-12 sm:pt-12">
          <div className="flex flex-wrap items-center gap-2 text-xs font-bold uppercase tracking-[0.13em] text-primary">
            <Tag className="size-3.5" /> {article.category}
            <span className="mx-1 text-muted-foreground">/</span>
            <span className="inline-flex items-center gap-1.5 font-semibold normal-case tracking-normal text-muted-foreground">
              <Clock3 className="size-3.5" /> {readTime} min read
            </span>
          </div>
          <h1 className="mt-5 font-serif text-4xl font-bold leading-[1.08] tracking-tight sm:text-6xl">
            <BlogInlineMarkdown content={article.title} />
          </h1>
          {article.excerpt && (
            <p className="mt-5 text-lg leading-8 text-muted-foreground sm:text-xl">
              <BlogInlineMarkdown content={article.excerpt} />
            </p>
          )}
          <div className="mt-7 flex flex-wrap items-center gap-x-3 gap-y-1 border-y py-4 text-sm">
            <span className="font-semibold">{article.author_name}</span>
            <span className="text-muted-foreground">·</span>
            <time
              className="text-muted-foreground"
              dateTime={article.published_at ?? article.created_at}
            >
              {formatDate(article.published_at ?? article.created_at)}
            </time>
          </div>
          {article.status === "published" && (
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="rounded-full"
                onClick={() => void shareArticle()}
              >
                <Share2 className="mr-2 size-4" /> Share article
              </Button>
              <Button
                type="button"
                variant={bookmarkQuery.data ? "secondary" : "outline"}
                size="sm"
                className="rounded-full"
                disabled={bookmarkQuery.isLoading}
                aria-pressed={Boolean(bookmarkQuery.data)}
                onClick={() => void toggleBookmark()}
              >
                <Bookmark
                  className="mr-2 size-4"
                  fill={bookmarkQuery.data ? "currentColor" : "none"}
                />
                {bookmarkQuery.data ? "Bookmarked" : "Bookmark"}
              </Button>
            </div>
          )}
        </header>
        {article.cover_image_url && (
          <div className="mx-auto mb-10 max-w-4xl overflow-hidden rounded-3xl border">
            <img
              src={article.cover_image_url}
              alt=""
              className="max-h-[30rem] w-full object-cover"
            />
          </div>
        )}
        <div className="mx-auto max-w-[70ch]">
          {showFullArticle ? (
            <BlogMarkdown content={article.content_markdown} />
          ) : (
            <div>
              <BlogMarkdown
                content={article.excerpt || excerptFromMarkdown(article.content_markdown)}
              />
              <div className="mt-7 flex justify-center border-t border-border/70 pt-6">
                <Button
                  type="button"
                  variant="outline"
                  className="rounded-full border-primary/30 px-5 text-primary hover:bg-primary/5 hover:text-primary"
                  aria-expanded={false}
                  onClick={() => setShowFullArticle(true)}
                >
                  Continue reading <ArrowRight className="ml-2 size-4" />
                </Button>
              </div>
            </div>
          )}
        </div>
      </article>
      {related.data && related.data.length > 0 && (
        <section className="border-t bg-secondary/25 py-10 sm:py-14" aria-label="Related stories">
          <div className="mx-auto max-w-6xl px-5 sm:px-8">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-primary">
              More from {article.category}
            </p>
            <h2 className="mt-2 font-serif text-2xl font-bold sm:text-3xl">
              Keep the good ideas going
            </h2>
            <div className="mt-5 grid gap-4 sm:grid-cols-3">
              {related.data.map((item) => (
                <ArticleCard key={item.id} article={item} />
              ))}
            </div>
          </div>
        </section>
      )}
    </main>
  );
}

export function BlogEditor({ user, articleId }: { user: User; articleId?: string }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const access = useBlogAccess(user.id);
  const articleQuery = useQuery({
    queryKey: ["blog-article-edit", articleId],
    enabled: Boolean(articleId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("blog_articles")
        .select("*")
        .eq("id", articleId!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [excerpt, setExcerpt] = useState("");
  const [category, setCategory] = useState(CATEGORY_OPTIONS[0]!);
  const [coverImageUrl, setCoverImageUrl] = useState("");
  const [content, setContent] = useState("");
  const [preview, setPreview] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [formatColor, setFormatColor] = useState("violet");
  const [formatSize, setFormatSize] = useState("18");
  const editorRef = useRef<HTMLDivElement>(null);
  const titleEditorRef = useRef<HTMLDivElement>(null);
  const excerptEditorRef = useRef<HTMLDivElement>(null);
  const activeEditorRef = useRef<HTMLDivElement | null>(null);
  const activeFieldRef = useRef<"title" | "excerpt" | "body">("body");
  const savedSelectionRef = useRef<Range | null>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const markdownContentRef = useRef(content);
  const titleValueRef = useRef(title);
  const excerptValueRef = useRef(excerpt);
  markdownContentRef.current = content;
  titleValueRef.current = title;
  excerptValueRef.current = excerpt;
  const [editorReady, setEditorReady] = useState(false);
  const [keyboardInset, setKeyboardInset] = useState(0);
  const [initialized, setInitialized] = useState(false);
  const existing = articleQuery.data;

  useEffect(() => {
    if (!existing || initialized) return;
    setTitle(existing.title);
    setSlug(existing.slug);
    setExcerpt(existing.excerpt);
    setCategory(existing.category);
    setCoverImageUrl(existing.cover_image_url ?? "");
    setContent(existing.content_markdown);
    setInitialized(true);
  }, [existing, initialized]);

  useEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport) return;
    const updateKeyboardInset = () => {
      const inset = Math.max(0, window.innerHeight - viewport.height - viewport.offsetTop);
      setKeyboardInset(inset > 100 ? inset : 0);
    };
    updateKeyboardInset();
    viewport.addEventListener("resize", updateKeyboardInset);
    viewport.addEventListener("scroll", updateKeyboardInset);
    window.addEventListener("resize", updateKeyboardInset);
    return () => {
      viewport.removeEventListener("resize", updateKeyboardInset);
      viewport.removeEventListener("scroll", updateKeyboardInset);
      window.removeEventListener("resize", updateKeyboardInset);
    };
  }, []);

  useEffect(() => {
    if (!preview) {
      if (editorRef.current)
        editorRef.current.innerHTML = markdownToEditorHtml(markdownContentRef.current);
      if (titleEditorRef.current)
        titleEditorRef.current.innerHTML = markdownToEditorHtml(titleValueRef.current);
      if (excerptEditorRef.current)
        excerptEditorRef.current.innerHTML = markdownToEditorHtml(excerptValueRef.current);
      savedSelectionRef.current = null;
    }
  }, [preview, initialized, editorReady]);

  const hasWriteAccess = Boolean(access.data?.canWrite);
  if (access.isLoading || (articleId && articleQuery.isLoading)) {
    return (
      <main className="mx-auto min-h-[70vh] max-w-4xl animate-pulse px-5 py-12">
        <div className="h-12 rounded-xl bg-muted" />
        <div className="mt-5 h-80 rounded-xl bg-muted" />
      </main>
    );
  }
  if (!hasWriteAccess) {
    return (
      <main className="mx-auto flex min-h-[70vh] max-w-xl flex-col items-center justify-center px-5 text-center">
        <PenLine className="size-10 text-muted-foreground" />
        <h1 className="mt-4 font-serif text-2xl font-bold">Writing is for our clinical team</h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          Clinicians and administrators can create and publish VITO journal articles.
        </p>
        <Button asChild variant="outline" className="mt-5">
          <Link to="/blog">
            <ArrowLeft className="mr-2 size-4" /> Back to the journal
          </Link>
        </Button>
      </main>
    );
  }
  if (articleId && (!existing || (existing.author_id !== user.id && !access.data?.isAdmin))) {
    return (
      <main className="mx-auto flex min-h-[70vh] max-w-xl flex-col items-center justify-center px-5 text-center">
        <FileText className="size-10 text-muted-foreground" />
        <h1 className="mt-4 font-serif text-2xl font-bold">Draft not found</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          This article may have been removed or may not be yours to edit.
        </p>
        <Button asChild variant="outline" className="mt-5">
          <Link to="/blog">
            <ArrowLeft className="mr-2 size-4" /> Back to the journal
          </Link>
        </Button>
      </main>
    );
  }

  function updateTitle(value: string, plainText = value) {
    setTitle(value);
    if (!articleId || !initialized) setSlug(slugify(plainText));
  }

  function captureEditorSelection() {
    const editor = activeEditorRef.current ?? editorRef.current;
    const selection = window.getSelection();
    if (!editor || !selection?.rangeCount) return;
    const range = selection.getRangeAt(0);
    if (editor.contains(range.commonAncestorContainer)) {
      savedSelectionRef.current = range.cloneRange();
    }
  }

  function getEditorRange(): Range | null {
    const editor = activeEditorRef.current ?? editorRef.current;
    if (!editor) return null;
    const selection = window.getSelection();
    let range = savedSelectionRef.current;
    if (!range || !editor.contains(range.commonAncestorContainer)) {
      range = selection?.rangeCount ? selection.getRangeAt(0).cloneRange() : null;
    }
    if (!range || !editor.contains(range.commonAncestorContainer)) {
      range = document.createRange();
      range.selectNodeContents(editor);
      range.collapse(false);
    }
    if (range.collapsed) {
      const node = range.startContainer;
      if (node.nodeType === Node.TEXT_NODE && node.textContent) {
        const text = node.textContent;
        let start = range.startOffset;
        let end = range.startOffset;
        while (start > 0 && /[\p{L}\p{N}_'-]/u.test(text[start - 1] ?? "")) start--;
        while (end < text.length && /[\p{L}\p{N}_'-]/u.test(text[end] ?? "")) end++;
        if (start === end && start > 0) start--;
        if (start === end && end < text.length) end++;
        if (start !== end) {
          range.setStart(node, start);
          range.setEnd(node, end);
        }
      }
      if (range.collapsed) {
        const element =
          node.nodeType === Node.ELEMENT_NODE ? (node as Element) : node.parentElement;
        const block = element?.closest("p, li, h1, h2, h3, h4, h5, h6, blockquote");
        if (block && editor.contains(block)) range.selectNodeContents(block);
        else if (editor.textContent?.trim()) range.selectNodeContents(editor);
      }
    }
    return range;
  }

  function formatSelectedText(format: "bold" | "underline" | "color" | "size" | "clear") {
    const editor = activeEditorRef.current ?? editorRef.current;
    const range = getEditorRange();
    if (!editor || !range || range.collapsed) {
      toast.error(
        "Write a few words first, then place your cursor in the text or select a phrase.",
      );
      return;
    }
    editor.focus();
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);

    const selected = range.extractContents();
    let wrapper: HTMLElement;
    if (format === "clear") {
      removeInlineFormatting(selected);
      wrapper = document.createElement("span");
      wrapper.className = "blog-manual-format blog-no-auto";
    } else if (format === "bold") {
      wrapper = document.createElement("strong");
      wrapper.className = "blog-manual-format";
    } else {
      wrapper = document.createElement(format === "underline" ? "u" : "span");
      const styleClass =
        format === "underline"
          ? "blog-underline"
          : format === "color"
            ? `blog-color-${formatColor}`
            : `blog-size-${formatSize}`;
      wrapper.className = `blog-manual-format ${styleClass}`;
    }
    wrapper.append(selected);
    range.insertNode(wrapper);
    const appliedRange = document.createRange();
    appliedRange.selectNodeContents(wrapper);
    selection?.removeAllRanges();
    selection?.addRange(appliedRange);
    savedSelectionRef.current = appliedRange.cloneRange();
    const formattedMarkdown = editorHtmlToMarkdown(editor.innerHTML);
    if (activeFieldRef.current === "title")
      updateTitle(formattedMarkdown, editor.textContent ?? "");
    else if (activeFieldRef.current === "excerpt") setExcerpt(formattedMarkdown);
    else setContent(formattedMarkdown);
    editor.focus();
  }

  async function insertArticlePhoto(file: File, input: HTMLInputElement) {
    input.value = "";
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      toast.error("Choose a PNG, JPG or WEBP photo.");
      return;
    }
    if (file.size > 6 * 1024 * 1024) {
      toast.error("Article photos must be 6 MB or smaller.");
      return;
    }
    setUploadingPhoto(true);
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      let binary = "";
      for (let offset = 0; offset < bytes.length; offset += 0x8000) {
        binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
      }
      const url = await uploadBlogArticleImage({
        data: {
          base64: btoa(binary),
          contentType: file.type as "image/jpeg" | "image/png" | "image/webp",
        },
      });
      const editor = editorRef.current;
      if (!editor) throw new Error("The article editor is not ready.");
      const extensionIndex = file.name.lastIndexOf(".");
      const alt =
        (extensionIndex > 0 ? file.name.slice(0, extensionIndex) : file.name)
          .replaceAll(String.fromCharCode(92), "")
          .replaceAll("[", "")
          .replaceAll("]", "")
          .trim() || "Article photo";
      const selection = window.getSelection();
      const range = savedSelectionRef.current?.cloneRange();
      const insertion =
        range && editor.contains(range.commonAncestorContainer)
          ? range
          : (() => {
              const fallback = document.createRange();
              fallback.selectNodeContents(editor);
              fallback.collapse(false);
              return fallback;
            })();
      insertion.deleteContents();
      const image = document.createElement("img");
      image.src = url;
      image.alt = alt;
      image.className = "blog-article-image";
      insertion.insertNode(image);
      const spacer = document.createElement("br");
      image.after(spacer);
      const nextRange = document.createRange();
      nextRange.setStartAfter(spacer);
      nextRange.collapse(true);
      selection?.removeAllRanges();
      selection?.addRange(nextRange);
      savedSelectionRef.current = nextRange.cloneRange();
      editor.focus();
      setContent(editorHtmlToMarkdown(editor.innerHTML));
      toast.success("Photo added to your story.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "The photo could not be uploaded.");
    } finally {
      setUploadingPhoto(false);
    }
  }

  async function saveArticle(status: "draft" | "published"): Promise<void> {
    if (title.trim().length < 4) {
      toast.error("Add a title of at least four characters.");
      return;
    }
    if (excerpt.length > 260) {
      toast.error("Keep the summary under 260 characters.");
      return;
    }
    if (content.trim().length < 80) {
      toast.error("Add a little more to the story before saving.");
      return;
    }
    const cleanSlug = slugify(slug || title);
    if (!cleanSlug) {
      toast.error("Add a valid article title or link slug.");
      return;
    }
    setSaving(true);
    let finalSlug = cleanSlug;
    const { data: collision } = await supabase
      .from("blog_articles")
      .select("id")
      .eq("slug", cleanSlug)
      .limit(1);
    if (collision?.[0] && collision[0].id !== articleId)
      finalSlug = `${cleanSlug}-${Date.now().toString(36).slice(-5)}`;
    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name")
      .eq("id", user.id)
      .maybeSingle();
    const row = {
      title: title.trim(),
      slug: finalSlug,
      excerpt: excerpt.trim(),
      category,
      cover_image_url: coverImageUrl.trim() || null,
      content_markdown: content.trim(),
      status,
      published_at:
        status === "published" ? (existing?.published_at ?? new Date().toISOString()) : null,
      author_id: existing?.author_id ?? user.id,
      author_name: existing?.author_name ?? profile?.full_name?.trim() ?? "VITO Physio team",
    };
    const result = articleId
      ? await supabase
          .from("blog_articles")
          .update(row)
          .eq("id", articleId)
          .select("id,slug")
          .maybeSingle()
      : await supabase.from("blog_articles").insert(row).select("id,slug").single();
    setSaving(false);
    if (result.error || !result.data) {
      toast.error(result.error?.message ?? "The article could not be saved. Please try again.");
      return;
    }
    toast.success(status === "published" ? "Your story is live." : "Draft saved.");
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["blog-articles"] }),
      queryClient.invalidateQueries({ queryKey: ["blog-article", result.data.slug] }),
      queryClient.invalidateQueries({ queryKey: ["blog-related"] }),
    ]);
    if (status === "published") {
      void navigate({ to: "/blog/$slug", params: { slug: result.data.slug } });
    } else if (!articleId) {
      void navigate({ to: "/blog/edit/$articleId", params: { articleId: result.data.id } });
    }
  }

  return (
    <main className="min-h-screen bg-background pb-24 text-foreground">
      <div className="mx-auto max-w-6xl px-5 py-6 sm:px-8 sm:py-10">
        <div className="sticky top-0 z-40 -mx-5 flex flex-wrap items-center justify-between gap-3 border-b bg-background/95 px-5 py-3 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-background/80 sm:-mx-8 sm:px-8">
          <Button
            asChild
            variant="ghost"
            size="sm"
            className="-ml-3 rounded-full text-muted-foreground"
          >
            <Link to="/blog">
              <ArrowLeft className="mr-2 size-4" /> Back to journal
            </Link>
          </Button>
          <div className="flex items-center gap-2">
            {existing && (
              <span
                className={`rounded-full px-3 py-1 text-xs font-bold ${existing.status === "published" ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" : "bg-secondary text-muted-foreground"}`}
              >
                {existing.status === "published" ? "Published" : "Draft"}
              </span>
            )}
            <Button
              type="button"
              variant="outline"
              className="rounded-full"
              disabled={saving || uploadingPhoto}
              onClick={() => void saveArticle("draft")}
            >
              <FileText className="mr-2 size-4" /> Save draft
            </Button>
            <Button
              type="button"
              className="rounded-full bg-brand-gradient shadow-glow"
              disabled={saving || uploadingPhoto}
              onClick={() => void saveArticle("published")}
            >
              <Check className="mr-2 size-4" />{" "}
              {saving
                ? "Saving…"
                : existing?.status === "published"
                  ? "Update & publish"
                  : "Publish story"}
            </Button>
          </div>
        </div>
        <div className="mt-4 grid gap-8">
          <section className="min-w-0 rounded-3xl border bg-card p-5 shadow-sm sm:p-8">
            <div className="sticky top-[4.25rem] z-30 -mx-5 flex items-center justify-end gap-3 border-b bg-card/95 px-5 py-3 backdrop-blur supports-[backdrop-filter]:bg-card/85 sm:-mx-8 sm:px-8">
              <div className="flex rounded-full border bg-background p-1">
                <button
                  type="button"
                  onClick={() => setPreview(false)}
                  className={`rounded-full px-3 py-1.5 text-xs font-semibold ${!preview ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
                >
                  Write
                </button>
                <button
                  type="button"
                  onClick={() => setPreview(true)}
                  className={`rounded-full px-3 py-1.5 text-xs font-semibold ${preview ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
                >
                  Preview
                </button>
              </div>
            </div>
            {!preview ? (
              <div className="mt-6 space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="blog-title">Headline</Label>
                  <div
                    ref={titleEditorRef}
                    id="blog-title"
                    role="textbox"
                    aria-label="Headline"
                    aria-multiline="false"
                    contentEditable={!saving}
                    suppressContentEditableWarning
                    data-placeholder="Headline"
                    onFocus={(event) => {
                      activeEditorRef.current = event.currentTarget;
                      activeFieldRef.current = "title";
                    }}
                    onMouseUp={captureEditorSelection}
                    onKeyUp={captureEditorSelection}
                    onInput={(event) => {
                      captureEditorSelection();
                      updateTitle(
                        editorHtmlToMarkdown(event.currentTarget.innerHTML).replace(/\n/g, " "),
                        event.currentTarget.textContent ?? "",
                      );
                    }}
                    className="min-h-12 rounded-md border border-input bg-background px-3 py-2 font-serif text-xl leading-8 shadow-sm outline-none empty:before:content-[attr(data-placeholder)] empty:before:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring sm:text-2xl [&_.blog-color-violet]:text-violet-700 dark:[&_.blog-color-violet]:text-violet-300 [&_.blog-color-blue]:text-blue-700 dark:[&_.blog-color-blue]:text-blue-300 [&_.blog-color-teal]:text-teal-700 dark:[&_.blog-color-teal]:text-teal-300 [&_.blog-color-rose]:text-rose-700 dark:[&_.blog-color-rose]:text-rose-300 [&_.blog-color-amber]:text-amber-700 dark:[&_.blog-color-amber]:text-amber-300 [&_.blog-size-12]:text-[12px] [&_.blog-size-14]:text-[14px] [&_.blog-size-16]:text-[16px] [&_.blog-size-18]:text-[18px] [&_.blog-size-20]:text-[20px] [&_.blog-size-24]:text-[24px] [&_.blog-size-28]:text-[28px] [&_.blog-size-32]:text-[32px]"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="blog-slug">Article link</Label>
                  <div className="flex items-center rounded-lg border bg-muted/40 px-3">
                    <span className="shrink-0 text-xs text-muted-foreground">/blog/</span>
                    <Input
                      id="blog-slug"
                      value={slug}
                      onChange={(event) => setSlug(slugify(event.target.value))}
                      className="border-0 bg-transparent shadow-none focus-visible:ring-0"
                      placeholder="your-story-title"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="blog-excerpt">Short introduction</Label>
                  <div
                    ref={excerptEditorRef}
                    id="blog-excerpt"
                    role="textbox"
                    aria-label="Short introduction"
                    aria-multiline="true"
                    contentEditable={!saving}
                    suppressContentEditableWarning
                    data-placeholder="Short introduction"
                    onFocus={(event) => {
                      activeEditorRef.current = event.currentTarget;
                      activeFieldRef.current = "excerpt";
                    }}
                    onMouseUp={captureEditorSelection}
                    onKeyUp={captureEditorSelection}
                    onInput={(event) => {
                      captureEditorSelection();
                      setExcerpt(
                        editorHtmlToMarkdown(event.currentTarget.innerHTML)
                          .replace(/\n/g, " ")
                          .slice(0, 260),
                      );
                    }}
                    className="min-h-24 rounded-md border border-input bg-background px-3 py-2 text-sm leading-6 shadow-sm outline-none empty:before:content-[attr(data-placeholder)] empty:before:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring [&_.blog-color-violet]:text-violet-700 dark:[&_.blog-color-violet]:text-violet-300 [&_.blog-color-blue]:text-blue-700 dark:[&_.blog-color-blue]:text-blue-300 [&_.blog-color-teal]:text-teal-700 dark:[&_.blog-color-teal]:text-teal-300 [&_.blog-color-rose]:text-rose-700 dark:[&_.blog-color-rose]:text-rose-300 [&_.blog-color-amber]:text-amber-700 dark:[&_.blog-color-amber]:text-amber-300 [&_.blog-size-12]:text-[12px] [&_.blog-size-14]:text-[14px] [&_.blog-size-16]:text-[16px] [&_.blog-size-18]:text-[18px] [&_.blog-size-20]:text-[20px] [&_.blog-size-24]:text-[24px] [&_.blog-size-28]:text-[28px] [&_.blog-size-32]:text-[32px]"
                  />
                  <p className="text-right text-xs text-muted-foreground">{excerpt.length}/260</p>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="blog-category">Topic</Label>
                    <select
                      id="blog-category"
                      value={category}
                      onChange={(event) => setCategory(event.target.value)}
                      className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      {CATEGORY_OPTIONS.map((option) => (
                        <option key={option}>{option}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="blog-cover">
                      Cover image URL{" "}
                      <span className="font-normal text-muted-foreground">(optional)</span>
                    </Label>
                    <Input
                      id="blog-cover"
                      value={coverImageUrl}
                      onChange={(event) => setCoverImageUrl(event.target.value)}
                      placeholder="https://…"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex flex-wrap items-end justify-between gap-3">
                    <Label htmlFor="blog-content">Your story</Label>
                    <div className="flex items-center gap-2">
                      <input
                        ref={photoInputRef}
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        className="sr-only"
                        aria-label="Choose a photo for your article"
                        onChange={(event) => {
                          const file = event.currentTarget.files?.[0];
                          if (file) void insertArticlePhoto(file, event.currentTarget);
                        }}
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="rounded-full"
                        disabled={uploadingPhoto || saving}
                        onClick={() => photoInputRef.current?.click()}
                      >
                        <ImagePlus className="mr-2 size-4" />
                        {uploadingPhoto ? "Uploading…" : "Add photo"}
                      </Button>
                    </div>
                  </div>
                  <div
                    className="fixed inset-x-3 z-[80] flex flex-wrap items-center justify-center gap-2 rounded-xl border bg-background/95 p-2 shadow-lg backdrop-blur supports-[backdrop-filter]:bg-background/90 sm:inset-x-auto sm:left-1/2 sm:w-fit sm:max-w-[94vw] sm:-translate-x-1/2"
                    style={{
                      bottom: `calc(${keyboardInset}px + env(safe-area-inset-bottom) + 0.5rem)`,
                    }}
                    role="toolbar"
                    aria-label="Text formatting"
                    onMouseDownCapture={captureEditorSelection}
                    onTouchStartCapture={captureEditorSelection}
                  >
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-9 px-3"
                      aria-label="Bold selected text"
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => formatSelectedText("bold")}
                    >
                      <Bold className="size-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-9 px-3"
                      aria-label="Underline selected text"
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => formatSelectedText("underline")}
                    >
                      <Underline className="size-4" />
                    </Button>
                    <div className="flex items-center gap-1">
                      <select
                        aria-label="Choose text color"
                        value={formatColor}
                        onMouseDown={captureEditorSelection}
                        onChange={(event) => setFormatColor(event.target.value)}
                        className="h-9 rounded-md border bg-background px-2 text-sm"
                      >
                        <option value="violet">Violet</option>
                        <option value="blue">Blue</option>
                        <option value="teal">Teal</option>
                        <option value="rose">Rose</option>
                        <option value="amber">Amber</option>
                      </select>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-9 px-3"
                        aria-label="Apply text color"
                        onMouseDown={(event) => event.preventDefault()}
                        onClick={() => formatSelectedText("color")}
                      >
                        <Palette className="mr-1 size-4" /> Color
                      </Button>
                    </div>
                    <div className="flex items-center gap-1">
                      <select
                        aria-label="Choose font size"
                        value={formatSize}
                        onMouseDown={captureEditorSelection}
                        onChange={(event) => setFormatSize(event.target.value)}
                        className="h-9 rounded-md border bg-background px-2 text-sm"
                      >
                        {[12, 14, 16, 18, 20, 24, 28, 32].map((size) => (
                          <option key={size} value={size}>
                            {size}px
                          </option>
                        ))}
                      </select>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-9 px-3"
                        aria-label="Apply font size"
                        onMouseDown={(event) => event.preventDefault()}
                        onClick={() => formatSelectedText("size")}
                      >
                        <Type className="mr-1 size-4" /> Size
                      </Button>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-9 px-3 text-muted-foreground"
                      aria-label="Clear formatting from selected text"
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => formatSelectedText("clear")}
                    >
                      <Eraser className="mr-1 size-4" /> Clear
                    </Button>
                  </div>
                  <div
                    ref={(node) => {
                      editorRef.current = node;
                      if (node) setEditorReady(true);
                    }}
                    id="blog-content"
                    role="textbox"
                    aria-label="Your article story"
                    aria-multiline="true"
                    data-placeholder="Write your article…"
                    contentEditable={!uploadingPhoto && !saving}
                    suppressContentEditableWarning
                    onFocus={(event) => {
                      activeEditorRef.current = event.currentTarget;
                      activeFieldRef.current = "body";
                    }}
                    onMouseUp={captureEditorSelection}
                    onKeyUp={captureEditorSelection}
                    onInput={(event) => {
                      captureEditorSelection();
                      setContent(editorHtmlToMarkdown(event.currentTarget.innerHTML));
                    }}
                    onPaste={(event) => {
                      event.preventDefault();
                      const editor = event.currentTarget;
                      const clipboard = event.clipboardData;
                      const pastedHtml = clipboard.getData("text/html");
                      const safeHtml = pastedHtml
                        ? DOMPurify.sanitize(pastedHtml, {
                            ALLOWED_TAGS: [
                              "p",
                              "br",
                              "strong",
                              "b",
                              "em",
                              "i",
                              "u",
                              "h1",
                              "h2",
                              "h3",
                              "h4",
                              "ul",
                              "ol",
                              "li",
                              "blockquote",
                              "a",
                              "img",
                              "hr",
                              "del",
                              "code",
                              "pre",
                            ],
                            ALLOWED_ATTR: ["href", "src", "alt", "title"],
                          })
                        : "";
                      const container = document.createElement("div");
                      if (safeHtml) container.innerHTML = safeHtml;
                      else
                        container.append(document.createTextNode(clipboard.getData("text/plain")));
                      const selection = window.getSelection();
                      const range = selection?.rangeCount ? selection.getRangeAt(0) : null;
                      if (!range || !editor.contains(range.commonAncestorContainer)) return;
                      range.deleteContents();
                      const fragment = document.createDocumentFragment();
                      while (container.firstChild) fragment.append(container.firstChild);
                      const lastInserted = fragment.lastChild;
                      range.insertNode(fragment);
                      if (lastInserted) {
                        range.setStartAfter(lastInserted);
                        range.collapse(true);
                        selection?.removeAllRanges();
                        selection?.addRange(range);
                      }
                      captureEditorSelection();
                      setContent(editorHtmlToMarkdown(editor.innerHTML));
                    }}
                    className="blog-rich-editor min-h-[28rem] w-full resize-y overflow-auto rounded-md border border-input bg-background px-3 py-3 text-base leading-7 text-foreground shadow-sm outline-none transition focus-visible:ring-2 focus-visible:ring-ring empty:before:content-[attr(data-placeholder)] empty:before:text-muted-foreground [&_h1]:my-4 [&_h1]:font-serif [&_h1]:text-3xl [&_h1]:font-bold [&_h2]:my-3 [&_h2]:font-serif [&_h2]:text-2xl [&_h2]:font-bold [&_h3]:my-3 [&_h3]:text-xl [&_h3]:font-semibold [&_p]:my-3 [&_ul]:my-3 [&_ul]:list-disc [&_ul]:pl-7 [&_ol]:my-3 [&_ol]:list-decimal [&_ol]:pl-7 [&_li]:my-1 [&_blockquote]:my-4 [&_blockquote]:border-l-4 [&_blockquote]:border-primary/30 [&_blockquote]:pl-4 [&_blockquote]:italic [&_a]:text-primary [&_a]:underline [&_img]:my-4 [&_img]:max-h-[28rem] [&_img]:rounded-xl [&_.blog-color-violet]:text-violet-700 dark:[&_.blog-color-violet]:text-violet-300 [&_.blog-color-blue]:text-blue-700 dark:[&_.blog-color-blue]:text-blue-300 [&_.blog-color-teal]:text-teal-700 dark:[&_.blog-color-teal]:text-teal-300 [&_.blog-color-rose]:text-rose-700 dark:[&_.blog-color-rose]:text-rose-300 [&_.blog-color-amber]:text-amber-700 dark:[&_.blog-color-amber]:text-amber-300 [&_.blog-size-12]:text-[12px] [&_.blog-size-14]:text-[14px] [&_.blog-size-16]:text-[16px] [&_.blog-size-18]:text-[18px] [&_.blog-size-20]:text-[20px] [&_.blog-size-24]:text-[24px] [&_.blog-size-28]:text-[28px] [&_.blog-size-32]:text-[32px] [&_mark]:rounded-sm [&_mark]:bg-violet-100 [&_mark]:font-semibold [&_mark]:text-violet-950 dark:[&_mark]:bg-violet-900/70 dark:[&_mark]:text-violet-100"
                  />
                </div>
              </div>
            ) : (
              <div className="mt-6 rounded-2xl bg-background p-4 sm:p-8">
                {title && (
                  <h1 className="font-serif text-3xl font-bold sm:text-4xl">
                    <BlogInlineMarkdown content={title} />
                  </h1>
                )}
                {excerpt && (
                  <div className="mt-4 text-lg leading-7 text-muted-foreground">
                    <BlogInlineMarkdown content={excerpt} />
                  </div>
                )}
                {content && (
                  <div className="mt-6 border-t pt-6">
                    <BlogMarkdown content={content} />
                  </div>
                )}
              </div>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}

function removeInlineFormatting(fragment: DocumentFragment) {
  fragment.querySelectorAll("*").forEach((element) => {
    if (element.tagName === "BR" || element.tagName === "IMG") return;
    element.replaceWith(...Array.from(element.childNodes));
  });
}

function markdownToEditorHtml(markdown: string): string {
  const marked = new Marked({ gfm: true });
  const wrappers: Array<{ open: string; close: string; htmlOpen: string; htmlClose: string }> = [];
  const nonce = `VITOFMT${Math.random().toString(36).slice(2)}X`;
  const expanded = markdown.replace(
    /:(color|size|underline|plain)\[([^\]]*)\](?:\{\.([a-z0-9-]+)\})?/g,
    (_whole, kind: string, inner: string, className?: string) => {
      const id = wrappers.length;
      const open = `${nonce}OPEN${id}X`;
      const close = `${nonce}CLOSE${id}X`;
      let tag = "span";
      let classes = "blog-manual-format";
      if (kind === "underline") {
        tag = "u";
        classes += " blog-underline";
      } else if (kind === "plain") {
        classes += " blog-no-auto";
      } else if (kind === "color" || kind === "size") {
        const valid =
          kind === "color"
            ? /^blog-color-(violet|blue|teal|rose|amber)$/.test(className ?? "")
            : /^blog-size-(12|14|16|18|20|24|28|32)$/.test(className ?? "");
        if (valid) classes += ` ${className}`;
      }
      wrappers.push({
        open,
        close,
        htmlOpen: `<${tag} class="${classes}">`,
        htmlClose: `</${tag}>`,
      });
      return `${open}${inner}${close}`;
    },
  );
  let html = String(marked.parse(expanded));
  for (const wrapper of wrappers) {
    html = html.replace(wrapper.open, wrapper.htmlOpen).replace(wrapper.close, wrapper.htmlClose);
  }
  return DOMPurify.sanitize(html, { ADD_ATTR: ["class"] });
}

function editorHtmlToMarkdown(html: string): string {
  const safeHtml = DOMPurify.sanitize(html, {
    ALLOWED_TAGS: [
      "p",
      "br",
      "strong",
      "b",
      "em",
      "i",
      "u",
      "span",
      "mark",
      "h1",
      "h2",
      "h3",
      "h4",
      "h5",
      "h6",
      "ul",
      "ol",
      "li",
      "blockquote",
      "a",
      "img",
      "hr",
      "del",
      "code",
      "pre",
    ],
    ALLOWED_ATTR: ["href", "src", "alt", "title", "class"],
    ALLOW_DATA_ATTR: false,
  });
  const turndown = new TurndownService({
    headingStyle: "atx",
    bulletListMarker: "-",
    codeBlockStyle: "fenced",
  });
  turndown.addRule("blogManualFormatting", {
    filter: (node) => node instanceof HTMLElement && node.classList.contains("blog-manual-format"),
    replacement: (inner, node) => {
      if (!(node instanceof HTMLElement)) return inner;
      const classes = node.classList;
      if (classes.contains("blog-no-auto")) return `:plain[${inner}]`;
      if (classes.contains("blog-underline") || node.tagName === "U") return `:underline[${inner}]`;
      const color = [...classes].find((name) =>
        /^blog-color-(violet|blue|teal|rose|amber)$/.test(name),
      );
      if (color) return `:color[${inner}]{.${color}}`;
      const size = [...classes].find((name) => /^blog-size-(12|14|16|18|20|24|28|32)$/.test(name));
      if (size) return `:size[${inner}]{.${size}}`;
      if (node.tagName === "STRONG" || node.tagName === "B") return `**${inner}**`;
      return inner;
    },
  });
  turndown.addRule("blogImages", {
    filter: "img",
    replacement: (_inner, node) => {
      const image = node as HTMLImageElement;
      if (!image.src || !/^https?:/i.test(image.src)) return "";
      const alt = image.alt.replace(/[\\[\\]]/g, "");
      return `\n\n![${alt}](${image.src})\n\n`;
    },
  });
  turndown.addRule("blogUnderline", {
    filter: "u",
    replacement: (inner, node) =>
      node instanceof HTMLElement && node.classList.contains("blog-manual-format")
        ? inner
        : `:underline[${inner}]`,
  });
  return turndown
    .turndown(safeHtml)
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

type BlogDirectiveNode = {
  type?: string;
  name?: string;
  attributes?: Record<string, string | null | undefined>;
  data?: { hName?: string; hProperties?: Record<string, unknown> };
  children?: unknown[];
};

const blogFormattingPlugin =
  () =>
  (tree: unknown): void => {
    const transform = (value: unknown): void => {
      if (!value || typeof value !== "object") return;
      const node = value as BlogDirectiveNode;
      if (node.type === "textDirective" && node.name) {
        const classes = ["blog-manual-format"];
        const attributes = node.attributes ?? {};
        const rawClasses = attributes["class"] ?? attributes["className"];
        if (typeof rawClasses === "string") classes.push(...rawClasses.split(/\s+/));

        if (node.name === "underline") {
          node.data = { hName: "u", hProperties: { className: classes } };
        } else if (node.name === "plain") {
          node.data = { hName: "span", hProperties: { className: [...classes, "blog-no-auto"] } };
        } else if (node.name === "color" || node.name === "size") {
          const allowedClasses = classes.filter((name) =>
            node.name === "color"
              ? /^blog-color-(violet|blue|teal|rose|amber)$/.test(name)
              : /^blog-size-(12|14|16|18|20|24|28|32)$/.test(name),
          );
          node.data = {
            hName: "span",
            hProperties: { className: ["blog-manual-format", ...allowedClasses] },
          };
        }
      }
      node.children?.forEach(transform);
    };
    transform(tree);
  };

function BlogInlineMarkdown({ content }: { content: string }) {
  return (
    <span className="[&_.blog-color-violet]:text-violet-700 dark:[&_.blog-color-violet]:text-violet-300 [&_.blog-color-blue]:text-blue-700 dark:[&_.blog-color-blue]:text-blue-300 [&_.blog-color-teal]:text-teal-700 dark:[&_.blog-color-teal]:text-teal-300 [&_.blog-color-rose]:text-rose-700 dark:[&_.blog-color-rose]:text-rose-300 [&_.blog-color-amber]:text-amber-700 dark:[&_.blog-color-amber]:text-amber-300 [&_.blog-size-12]:text-[12px] [&_.blog-size-14]:text-[14px] [&_.blog-size-16]:text-[16px] [&_.blog-size-18]:text-[18px] [&_.blog-size-20]:text-[20px] [&_.blog-size-24]:text-[24px] [&_.blog-size-28]:text-[28px] [&_.blog-size-32]:text-[32px]">
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkDirective, blogFormattingPlugin]}
        components={{
          p: ({ children }) => <>{children}</>,
          span: ({ children, className, ...props }) => (
            <span className={className} {...props}>
              {children}
            </span>
          ),
          u: ({ children, className, ...props }) => (
            <u className={className} {...props}>
              {children}
            </u>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </span>
  );
}

export function BlogMarkdown({ content }: { content: string }) {
  return (
    <div className="space-y-5 break-words text-[1.0625rem] leading-8 text-foreground/90 [&_a]:font-semibold [&_a]:text-primary [&_a]:underline [&_a]:decoration-primary/30 [&_a]:underline-offset-4 hover:[&_a]:decoration-primary [&_blockquote]:my-7 [&_blockquote]:border-l-4 [&_blockquote]:border-accent [&_blockquote]:pl-5 [&_blockquote]:font-serif [&_blockquote]:text-xl [&_blockquote]:italic [&_code]:rounded [&_code]:bg-secondary [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-[0.9em] [&_h2]:mb-3 [&_h2]:mt-10 [&_h2]:font-serif [&_h2]:text-2xl [&_h2]:font-bold [&_h2]:leading-tight sm:[&_h2]:text-3xl [&_h3]:mb-2 [&_h3]:mt-8 [&_h3]:font-serif [&_h3]:text-xl [&_h3]:font-bold [&_img]:mx-auto [&_img]:my-8 [&_img]:max-h-[40rem] [&_img]:rounded-2xl [&_img]:object-contain [&_li]:my-2 [&_ol]:list-decimal [&_ol]:space-y-1 [&_ol]:pl-6 [&_p]:my-5 [&_pre]:overflow-x-auto [&_pre]:rounded-xl [&_pre]:bg-foreground [&_pre]:p-4 [&_pre]:text-background [&_ul]:list-disc [&_ul]:space-y-1 [&_ul]:pl-6 [&_hr]:my-8 [&_hr]:border-border [&_mark]:rounded-sm [&_mark]:bg-violet-100 [&_mark]:px-1 [&_mark]:py-0.5 [&_mark]:font-semibold [&_mark]:text-violet-950 dark:[&_mark]:bg-violet-900/70 dark:[&_mark]:text-violet-100 [&_.blog-color-violet]:text-violet-700 dark:[&_.blog-color-violet]:text-violet-300 [&_.blog-color-blue]:text-blue-700 dark:[&_.blog-color-blue]:text-blue-300 [&_.blog-color-teal]:text-teal-700 dark:[&_.blog-color-teal]:text-teal-300 [&_.blog-color-rose]:text-rose-700 dark:[&_.blog-color-rose]:text-rose-300 [&_.blog-color-amber]:text-amber-700 dark:[&_.blog-color-amber]:text-amber-300 [&_.blog-size-12]:text-[12px] [&_.blog-size-14]:text-[14px] [&_.blog-size-16]:text-[16px] [&_.blog-size-18]:text-[18px] [&_.blog-size-20]:text-[20px] [&_.blog-size-24]:text-[24px] [&_.blog-size-28]:text-[28px] [&_.blog-size-32]:text-[32px]">
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkDirective, blogFormattingPlugin]}
        components={{
          span: ({ children, className, ...props }) => (
            <span className={className} {...props}>
              {children}
            </span>
          ),
          u: ({ children, className, ...props }) => (
            <u className={className} {...props}>
              {children}
            </u>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}

export function estimateReadTime(content: string) {
  return Math.max(1, Math.ceil((content.trim().match(/\S+/g)?.length ?? 0) / 220));
}

export function formatDate(value: string) {
  return new Date(value).toLocaleDateString(undefined, {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function excerptFromMarkdown(content: string) {
  return content
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/[#>*_`~]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 190);
}

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 90);
}
