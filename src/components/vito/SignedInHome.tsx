import { useState } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import {
  BookOpen,
  Compass,
  Home,
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

type HomeTab = {
  value: "for-you" | "learn" | "updates" | "sports-hub";
  label: string;
  icon: LucideIcon;
};

const homeTabs: HomeTab[] = [
  { value: "for-you", label: "For You", icon: Compass },
  { value: "learn", label: "Learn", icon: BookOpen },
  { value: "updates", label: "Updates", icon: Newspaper },
  { value: "sports-hub", label: "Sports Hub", icon: Trophy },
];

/** Home-only content sections. These tabs are deliberately nested inside Home, not app navigation. */
export function SignedInHomeTabs() {
  return (
    <section
      aria-label="Home community sections"
      className="mx-auto w-full max-w-6xl px-4 pb-10 pt-7 sm:px-5 sm:pt-9"
    >
      <div className="mb-5 flex flex-col gap-2 sm:mb-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-accent">
            VITO community
          </p>
          <h2 className="mt-1 text-2xl font-black tracking-tight sm:text-3xl">Your sports space</h2>
        </div>
        <p className="max-w-xl text-sm leading-6 text-muted-foreground">
          Explore sports-health learning, community updates, and activities alongside your existing
          VITO care workspace.
        </p>
      </div>

      <Tabs defaultValue="for-you" className="w-full">
        <TabsList
          aria-label="Home sections"
          className="flex h-auto w-full justify-start gap-1 overflow-x-auto rounded-none border-b border-border bg-transparent p-0 pb-1 text-muted-foreground [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {homeTabs.map(({ value, label, icon: Icon }) => (
            <TabsTrigger
              key={value}
              value={value}
              className="min-h-11 shrink-0 gap-2 rounded-xl px-3 text-sm data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm sm:px-4"
            >
              <Icon aria-hidden="true" className="size-4" />
              {label}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="for-you" className="mt-5 sm:mt-6">
          <EmptyCommunityPanel
            icon={Users}
            eyebrow="Community feed"
            title="Your For You feed is ready to grow"
            description="Community posts, recommendations, and shared sports updates will appear here when the community publishing features are connected. No sample accounts or posts are shown."
          >
            <Button asChild variant="outline" className="mt-5">
              <Link to="/discover">
                <Compass className="size-4" />
                Browse the current directory
              </Link>
            </Button>
          </EmptyCommunityPanel>
        </TabsContent>

        <TabsContent value="learn" className="mt-5 sm:mt-6">
          <EmptyCommunityPanel
            icon={BookOpen}
            eyebrow="Sports-health library"
            title="Learning resources will live here"
            description="This Home section is reserved for injury prevention, rehabilitation, recovery, and safe-training resources. It will use verified VITO content rather than placeholder articles."
          />
        </TabsContent>

        <TabsContent value="updates" className="mt-5 sm:mt-6">
          <EmptyCommunityPanel
            icon={Newspaper}
            eyebrow="Community updates"
            title="Updates will appear here"
            description="Announcements and updates from athletes, coaches, schools, clubs, and other sports stakeholders will appear here once community publishing is available."
          />
        </TabsContent>

        <TabsContent value="sports-hub" className="mt-5 sm:mt-6">
          <EmptyCommunityPanel
            icon={Trophy}
            eyebrow="Sports Hub"
            title="A space for sport and activity"
            description="This section is reserved for events, competitions, teams, clubs, academies, and other sports-community activities. No events or achievements have been invented for this frontend step."
          />
        </TabsContent>
      </Tabs>
    </section>
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
    <section className="rounded-2xl border bg-card p-5 shadow-sm sm:p-8">
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
