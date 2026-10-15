import { useRef, useState } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Compass,
  Home,
  LayoutDashboard,
  MessageCircle,
  Newspaper,
  Plus,
  Send,
  Trophy,
  UserRound,
  Users,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { VitoBrandLockup, VitoLoadingMark } from "@/components/vito/VitoBrandLockup";
import { WhatsAppConsultationButton } from "@/components/vito/WhatsAppConsultationButton";

type HomeTab = {
  value: "for-you" | "learn" | "updates" | "sports-hub";
  label: string;
};

type PathwayStep = {
  icon: LucideIcon;
  title: string;
  detail: string;
};

const homeTabs: HomeTab[] = [
  { value: "for-you", label: "For You" },
  { value: "learn", label: "Learn" },
  { value: "updates", label: "Updates" },
  { value: "sports-hub", label: "Sports Hub" },
];

/** Compact care highlights on the signed-in Home, navigable by arrows, touch, or trackpad. */
export function SignedInHomeHighlights({ steps }: { steps: PathwayStep[] }) {
  const trackRef = useRef<HTMLDivElement>(null);

  function move(direction: -1 | 1) {
    const track = trackRef.current;
    if (!track) return;
    const card = track.querySelector<HTMLElement>("[data-highlight-card]");
    track.scrollBy({
      left: direction * (card ? card.offsetWidth + 16 : track.clientWidth),
      behavior: "smooth",
    });
  }

  return (
    <section
      aria-label="Care highlights"
      className="relative mx-auto max-w-6xl px-4 pb-1 pt-0 sm:px-5"
    >
      <div
        ref={trackRef}
        className="flex snap-x snap-mandatory gap-4 overflow-x-auto scroll-smooth pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        aria-label="Home hero and care highlights"
      >
        <article
          data-highlight-card
          className="flex h-56 min-h-56 min-w-[min(88vw,40rem)] snap-start flex-col justify-center gap-2 rounded-2xl border bg-card p-4 shadow-sm sm:min-w-[40rem] sm:p-5"
        >
          <h1 className="text-3xl font-black leading-none tracking-tight sm:text-4xl">
            <span className="bg-brand-gradient bg-clip-text text-transparent">VITO</span>{" "}
            <span className="text-foreground">Physio</span>
          </h1>
          <p className="max-w-xl text-[11px] leading-4 text-muted-foreground sm:text-sm">
            Sports injury care through rehabilitation and return to play.
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              asChild
              size="lg"
              className="h-11 rounded-full bg-brand-gradient px-5 text-sm font-bold shadow-glow ring-2 ring-primary/25 transition-transform hover:-translate-y-0.5 sm:text-base"
            >
              <Link to="/dashboard">
                <LayoutDashboard aria-hidden="true" className="mr-2 size-4" />
                Go to Your Workspace
              </Link>
            </Button>
            <WhatsAppConsultationButton compact />
          </div>
        </article>
        <article
          data-highlight-card
          className="flex h-56 min-h-56 min-w-[min(88vw,40rem)] snap-start items-center gap-3 rounded-2xl border bg-card p-3 shadow-sm sm:min-w-[40rem] sm:gap-4 sm:p-4"
        >
          <VitoBrandLockup compact showTagline={false} className="shrink-0" imageClassName="p-1" />
          <div className="min-w-0 border-l pl-3 sm:pl-4">
            <p className="text-xs font-bold uppercase tracking-[0.12em] text-accent">
              Care that moves with you
            </p>
            <p className="mt-1 text-xs leading-5 text-muted-foreground sm:text-sm">
              One connected record for injury care, rehabilitation, follow-ups, and recovery
              progress.
            </p>
          </div>
        </article>
        <article
          data-highlight-card
          className="h-56 min-h-56 min-w-[min(88vw,40rem)] snap-start rounded-2xl border bg-card p-3 shadow-sm sm:min-w-[40rem] sm:p-4"
        >
          <div className="mb-2 flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.12em] text-accent">
                The care pathway
              </p>
              <h2 className="mt-0.5 text-base font-bold sm:text-lg">From injury to return</h2>
            </div>
            <span className="shrink-0 text-[10px] text-muted-foreground sm:text-xs">
              Six connected steps
            </span>
          </div>
          <ol
            aria-label="Care pathway steps"
            tabIndex={0}
            className="flex gap-1.5 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            {steps.map(({ icon: Icon, title, detail }, index) => (
              <li
                key={title}
                className="flex min-w-[4.5rem] flex-1 flex-col items-center gap-1 rounded-xl bg-secondary/70 px-1.5 py-1.5 text-center sm:min-w-[4.75rem]"
                title={detail}
              >
                <span className="grid size-6 place-items-center rounded-full bg-primary/10 text-primary">
                  <Icon aria-hidden="true" className="size-3.5" />
                </span>
                <span className="text-[9px] font-bold text-accent">0{index + 1}</span>
                <span className="text-[10px] font-semibold leading-tight">{title}</span>
              </li>
            ))}
          </ol>
        </article>
      </div>
      <div className="pointer-events-none absolute inset-y-0 right-2 z-10 flex items-center gap-1 sm:right-3">
        <Button
          type="button"
          variant="outline"
          size="icon"
          aria-label="Previous Home card"
          onClick={() => move(-1)}
          className="pointer-events-auto size-7 rounded-full border bg-background/95 shadow-sm"
        >
          <ArrowLeft aria-hidden="true" className="size-3.5" />
        </Button>
        <Button
          type="button"
          variant="outline"
          size="icon"
          aria-label="Next Home card"
          onClick={() => move(1)}
          className="pointer-events-auto size-7 rounded-full border bg-background/95 shadow-sm"
        >
          <ArrowRight aria-hidden="true" className="size-3.5" />
        </Button>
      </div>
    </section>
  );
}

/** Home-only content sections. These tabs are deliberately nested inside Home, not app navigation. */
export function SignedInHomeTabs({ contentReady = true }: { contentReady?: boolean }) {
  return (
    <section aria-label="Home community sections" className="w-full max-w-none px-0 pb-10 pt-0">
      <Tabs defaultValue="for-you" className="w-full">
        <TabsList
          aria-label="Home sections"
          className="grid h-auto w-full grid-cols-4 gap-2 rounded-none border-y border-border/80 bg-card/80 px-3 py-3 text-muted-foreground shadow-sm"
        >
          {homeTabs.map(({ value, label }) => (
            <TabsTrigger
              key={value}
              value={value}
              className="min-h-10 min-w-0 w-full whitespace-nowrap rounded-xl border border-primary/40 bg-background/80 px-1 text-[11px] font-semibold transition-colors data-[state=active]:border-primary data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md data-[state=active]:ring-1 data-[state=active]:ring-primary/25 sm:px-2 sm:text-sm"
            >
              {label}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent
          value="for-you"
          className="mt-0 rounded-b-2xl border-x border-b border-border/80 bg-muted/40 p-2 shadow-inner dark:bg-background/75 sm:p-3"
        >
          <HomeContentGate ready={contentReady}>
            <EmptyCommunityPanel
              icon={Users}
              eyebrow="Community feed"
              title="Your For You feed is ready to grow"
              description="Community posts, recommendations, and shared sports updates will appear here once those community features are available. No sample accounts or posts are shown."
            />
          </HomeContentGate>
        </TabsContent>

        <TabsContent
          value="learn"
          className="mt-0 rounded-b-2xl border-x border-b border-border/80 bg-muted/40 p-2 shadow-inner dark:bg-background/75 sm:p-3"
        >
          <HomeContentGate ready={contentReady}>
            <EmptyCommunityPanel
              icon={BookOpen}
              eyebrow="Sports-health library"
              title="Learning resources will live here"
              description="This Home section is reserved for injury prevention, rehabilitation, recovery, and safe-training resources. It will use verified VITO content rather than placeholder articles."
            />
          </HomeContentGate>
        </TabsContent>

        <TabsContent
          value="updates"
          className="mt-0 rounded-b-2xl border-x border-b border-border/80 bg-muted/40 p-2 shadow-inner dark:bg-background/75 sm:p-3"
        >
          <HomeContentGate ready={contentReady}>
            <EmptyCommunityPanel
              icon={Newspaper}
              eyebrow="Community updates"
              title="Updates will appear here"
              description="Announcements and updates from athletes, coaches, schools, clubs, and other sports stakeholders will appear here once community publishing is available."
            />
          </HomeContentGate>
        </TabsContent>

        <TabsContent
          value="sports-hub"
          className="mt-0 rounded-b-2xl border-x border-b border-border/80 bg-muted/40 p-2 shadow-inner dark:bg-background/75 sm:p-3"
        >
          <HomeContentGate ready={contentReady}>
            <EmptyCommunityPanel
              icon={Trophy}
              eyebrow="Sports Hub"
              title="A space for sport and activity"
              description="This section is reserved for events, competitions, teams, clubs, academies, and other sports-community activities. No events or achievements have been invented for this frontend step."
            />
          </HomeContentGate>
        </TabsContent>
      </Tabs>
    </section>
  );
}

function HomeContentGate({ ready, children }: { ready: boolean; children: React.ReactNode }) {
  return ready ? children : <HomeStoriesLoading />;
}

function HomeStoriesLoading() {
  return (
    <div
      className="flex min-h-64 flex-col items-center justify-center gap-3 rounded-xl bg-card px-5 py-10 text-center shadow-sm"
      role="status"
      aria-live="polite"
    >
      <VitoLoadingMark size="size-12" />
      <span className="text-sm font-medium text-muted-foreground">Loading Home stories…</span>
    </div>
  );
}

function EmptyCommunityPanel({
  icon: Icon,
  eyebrow,
  title,
  description,
  children,
}: {
  icon: LucideIcon;
  eyebrow: string;
  title: string;
  description: string;
  children?: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-border/70 bg-card p-5 shadow-lg shadow-primary/5 ring-1 ring-foreground/[0.03] dark:shadow-xl dark:shadow-black/35 dark:ring-white/[0.04] sm:p-8">
      <div className="mx-auto flex max-w-2xl flex-col items-center text-center">
        <span className="grid size-14 place-items-center rounded-2xl bg-primary/10 text-primary">
          <Icon aria-hidden="true" className="size-7" />
        </span>
        <p className="mt-4 text-xs font-bold uppercase tracking-[0.15em] text-accent">{eyebrow}</p>
        <h3 className="mt-2 text-xl font-bold tracking-tight sm:text-2xl">{title}</h3>
        <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">{description}</p>
        {children}
      </div>
    </section>
  );
}

/** Fixed app navigation. Home is the sole parent of the horizontal Home tabs above. */
export function SignedInBottomNavigation() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const [composerOpen, setComposerOpen] = useState(false);
  const onHome = pathname === "/";
  const onMessages = pathname === "/messages";
  const onProfile = pathname === "/profile";

  return (
    <>
      <nav
        aria-label="Primary navigation"
        className="fixed inset-x-0 bottom-0 z-[70] border-t bg-background/95 pb-[env(safe-area-inset-bottom)] shadow-[0_-8px_28px_rgba(15,23,42,0.08)] backdrop-blur supports-[backdrop-filter]:bg-background/85 print:hidden"
      >
        <div className="mx-auto grid h-16 max-w-xl grid-cols-4 px-2 sm:h-[4.5rem] sm:px-4">
          <Link
            to="/"
            aria-current={onHome ? "page" : undefined}
            className={`flex min-w-0 flex-col items-center justify-center gap-1 rounded-xl text-[11px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${onHome ? "text-primary" : "text-muted-foreground hover:text-foreground"}`}
          >
            <Home aria-hidden="true" className={`size-5 ${onHome ? "fill-primary/10" : ""}`} />
            <span>Home</span>
          </Link>
          <button
            type="button"
            onClick={() => setComposerOpen(true)}
            aria-haspopup="dialog"
            aria-expanded={composerOpen}
            className="flex min-w-0 flex-col items-center justify-center gap-1 rounded-xl text-[11px] font-semibold text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <span className="grid size-7 place-items-center rounded-full bg-primary text-primary-foreground shadow-sm">
              <Plus aria-hidden="true" className="size-5" />
            </span>
            <span>Create</span>
          </button>
          <Link
            to="/messages"
            aria-current={onMessages ? "page" : undefined}
            className={`flex min-w-0 flex-col items-center justify-center gap-1 rounded-xl text-[11px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${onMessages ? "text-primary" : "text-muted-foreground hover:text-foreground"}`}
          >
            <MessageCircle aria-hidden="true" className="size-5" />
            <span>Messages</span>
          </Link>
          <Link
            to="/profile"
            aria-current={onProfile ? "page" : undefined}
            className={`flex min-w-0 flex-col items-center justify-center gap-1 rounded-xl text-[11px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${onProfile ? "text-primary" : "text-muted-foreground hover:text-foreground"}`}
          >
            <UserRound aria-hidden="true" className="size-5" />
            <span>My Profile</span>
          </Link>
        </div>
      </nav>

      <Dialog open={composerOpen} onOpenChange={setComposerOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus aria-hidden="true" className="size-5 text-primary" />
              Create a community post
            </DialogTitle>
            <DialogDescription>
              The post composer is prepared for the community workflow. Publishing and media uploads
              will be connected in a later backend step.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Textarea
              aria-label="Community post text"
              placeholder="Share a sports update or useful reflection…"
              rows={5}
              disabled
            />
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs leading-5 text-muted-foreground">Posting is not enabled yet.</p>
              <Button type="button" disabled>
                <Send aria-hidden="true" className="size-4" />
                Publish
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
