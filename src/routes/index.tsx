import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import {
  ClipboardList,
  Activity,
  Bell,
  Dumbbell,
  CalendarCheck2,
  HeartPulse,
  UserRound,
  LogIn,
  LayoutDashboard,
  LogOut,
  MessageCircle,
  Menu,
  ShieldCheck,
  Search,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { WhatsAppConsultationButton } from "@/components/vito/WhatsAppConsultationButton";
import { VitoInfoPanel } from "@/components/vito/VitoInfoPanel";
import { PhotoAvatar } from "@/components/vito/Photo";
import { AppHeader } from "@/components/vito/AppHeader";
import {
  VitoBrandLockup,
  VitoLoadingOverlay,
  VitoLoadingScreen,
} from "@/components/vito/VitoBrandLockup";
import {
  SignedInBottomNavigation,
  SignedInHomeHighlights,
  SignedInHomeTabs,
} from "@/components/vito/SignedInHome";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "VITO Physio — Sports physiotherapy care" },
      {
        name: "description",
        content:
          "Injury cases, rehab and recovery tracking for schools, academies, clubs and athletes.",
      },
      { property: "og:title", content: "VITO Physio — Sports physiotherapy care" },
      {
        property: "og:description",
        content:
          "Injury cases, rehab and recovery tracking for schools, academies, clubs and athletes.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

const cycle = [
  { icon: UserRound, title: "Register", detail: "Athlete & organisation" },
  { icon: ClipboardList, title: "Open a case", detail: "Injury details" },
  { icon: Activity, title: "Assess", detail: "Clinical findings" },
  { icon: Dumbbell, title: "Rehabilitate", detail: "Plan & exercises" },
  { icon: CalendarCheck2, title: "Review", detail: "Follow-ups" },
  { icon: HeartPulse, title: "Return to sport", detail: "Recovery progress" },
];

const audience = ["Schools", "Academies", "Clubs", "Independent athletes"];

const publicSearchItems = [
  {
    label: "Consult or register",
    description: "Start a consultation or register an athlete or organisation.",
    to: "/register",
    requiresLogin: false,
  },
  {
    label: "Parent portal",
    description: "View athlete recovery information.",
    to: "/portal",
    requiresLogin: false,
  },
  {
    label: "Dashboard",
    description: "Open your VITO Physio overview.",
    to: "/dashboard",
    requiresLogin: true,
  },
  {
    label: "Case workspace",
    description: "Manage clinical cases and recovery.",
    to: "/cases",
    requiresLogin: true,
  },
  {
    label: "Notifications",
    description: "View staff alerts and consultation requests.",
    to: "/notifications",
    requiresLogin: true,
  },
];

function Index() {
  const navigate = useNavigate();
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [headerReady, setHeaderReady] = useState(false);
  const [homeStage, setHomeStage] = useState(0);
  const currentUserId = useRef<string | null>(null);
  const markHeaderReady = useCallback(() => setHeaderReady(true), []);
  const [search, setSearch] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const matches = publicSearchItems.filter((item) =>
    `${item.label} ${item.description}`.toLowerCase().includes(search.trim().toLowerCase()),
  );
  const activeUserId = currentUser?.id ?? null;

  function selectSearchItem(item: (typeof publicSearchItems)[number]) {
    setSearch("");
    setSearchOpen(false);
    if (item.requiresLogin && !currentUser) {
      toast("Please sign in to open this area.");
      navigate({ to: "/auth" });
      return;
    }
    navigate({ to: item.to as never });
  }

  useEffect(() => {
    let active = true;
    let authEventReceived = false;
    const applyUser = (nextUser: User | null) => {
      if (!active) return;
      const nextUserId = nextUser?.id ?? null;
      if (currentUserId.current !== nextUserId) {
        currentUserId.current = nextUserId;
        setHeaderReady(false);
        setHomeStage(0);
      }
      setCurrentUser(nextUser);
      setAuthReady(true);
    };

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      authEventReceived = true;
      applyUser(session?.user ?? null);
    });
    void supabase.auth
      .getSession()
      .then(({ data, error }) => {
        if (!authEventReceived) applyUser(error ? null : (data.session?.user ?? null));
      })
      .catch(() => {
        if (!authEventReceived) applyUser(null);
      });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!activeUserId || !headerReady) {
      setHomeStage(0);
      return;
    }

    setHomeStage(1);
    const carouselTimer = window.setTimeout(() => setHomeStage(2), 120);
    const tabsTimer = window.setTimeout(() => setHomeStage(3), 240);
    const feedTimer = window.setTimeout(() => setHomeStage(4), 380);
    const navigationTimer = window.setTimeout(() => setHomeStage(5), 500);
    return () => {
      window.clearTimeout(carouselTimer);
      window.clearTimeout(tabsTimer);
      window.clearTimeout(feedTimer);
      window.clearTimeout(navigationTimer);
    };
  }, [activeUserId, headerReady]);

  if (!authReady) return <VitoLoadingScreen />;

  return (
    <div
      className={`min-h-screen bg-background text-foreground ${
        currentUser ? "pb-[calc(5rem+env(safe-area-inset-bottom))]" : ""
      }`}
    >
      {currentUser ? (
        <AppHeader user={currentUser} onReady={markHeaderReady} />
      ) : (
        <header className="sticky top-0 z-50 bg-foreground text-background shadow-sm dark:bg-card dark:text-white">
          <div className="mx-auto flex h-16 max-w-6xl items-center gap-3 px-4 sm:gap-5 sm:px-5">
            <VitoInfoPanel />
            <form
              role="search"
              className="relative mx-auto min-w-0 flex-1 sm:max-w-2xl"
              onSubmit={(event) => {
                event.preventDefault();
                if (matches[0]) selectSearchItem(matches[0]);
              }}
            >
              <Search className="pointer-events-none absolute left-3 top-1/2 size-5 -translate-y-1/2 text-background/70 dark:text-white/85" />
              <input
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value);
                  setSearchOpen(true);
                }}
                onFocus={() => setSearchOpen(true)}
                onBlur={() => setTimeout(() => setSearchOpen(false), 120)}
                type="search"
                placeholder="Search VITO Physio…"
                aria-label="Search VITO Physio"
                className="h-10 w-full rounded-lg border border-background/20 bg-background/10 pl-10 pr-3 text-sm text-background placeholder:text-background/70 focus:border-background/45 focus:bg-background/15 focus:outline-none dark:border-white/25 dark:bg-white/10 dark:text-white dark:placeholder:text-white/70 dark:focus:border-white/50 dark:focus:bg-white/15"
              />
              {searchOpen && search.trim() && (
                <ul className="absolute left-0 right-0 top-full z-50 mt-2 max-h-80 overflow-auto rounded-xl border bg-popover p-1.5 text-popover-foreground shadow-lg">
                  {matches.length ? (
                    matches.map((item) => (
                      <li key={item.to}>
                        <button
                          type="button"
                          onMouseDown={(event) => event.preventDefault()}
                          onClick={() => selectSearchItem(item)}
                          className="flex w-full items-start gap-3 rounded-lg px-3 py-2 text-left text-sm hover:bg-accent/10"
                        >
                          <Search className="mt-0.5 size-4 shrink-0 text-primary" />
                          <span>
                            <span className="block font-medium">{item.label}</span>
                            <span className="block text-xs text-muted-foreground">
                              {item.description}
                              {item.requiresLogin && " · Sign in required"}
                            </span>
                          </span>
                        </button>
                      </li>
                    ))
                  ) : (
                    <li className="px-3 py-2 text-sm text-muted-foreground">
                      No VITO Physio results.
                    </li>
                  )}
                </ul>
              )}
            </form>
            <div className="ml-auto flex shrink-0 items-center gap-2 sm:gap-3">
              {!currentUser && (
                <Link
                  to="/auth"
                  aria-label="Log in"
                  title="Log in to your account"
                  className="inline-flex items-center gap-2 rounded-full bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground transition hover:brightness-105"
                >
                  <LogIn className="size-4" />
                  Log in
                </Link>
              )}
              {currentUser && (
                <Link
                  to="/dashboard"
                  aria-label="Open dashboard"
                  className="inline-flex size-10 items-center justify-center rounded-full text-background/90 hover:bg-background/10 dark:text-white dark:hover:bg-white/15"
                >
                  <LayoutDashboard className="size-5" />
                </Link>
              )}
              <DropdownMenu>
                <DropdownMenuTrigger
                  aria-label="Open menu"
                  title="Open menu"
                  className="inline-flex size-10 items-center justify-center rounded-md text-background/90 transition-colors hover:bg-background/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-background/60 dark:text-white dark:hover:bg-white/15 dark:focus-visible:ring-white/70"
                >
                  <Menu className="size-7" />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-64 rounded-xl p-2">
                  <DropdownMenuLabel>
                    {currentUser ? "Quick menu" : "Sign in required"}
                  </DropdownMenuLabel>
                  {!currentUser && (
                    <DropdownMenuItem asChild>
                      <Link to="/auth" className="cursor-pointer">
                        Sign in to open your menu
                      </Link>
                    </DropdownMenuItem>
                  )}
                  {currentUser && (
                    <DropdownMenuItem asChild>
                      <Link to="/dashboard" className="cursor-pointer">
                        Open dashboard
                      </Link>
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </header>
      )}

      <main>
        {!currentUser && (
          <section className="bg-hero-glow relative overflow-hidden">
            <div
              className={`mx-auto max-w-3xl px-5 text-center ${
                currentUser ? "pb-4 pt-5 sm:pb-5 sm:pt-7" : "pb-14 pt-16 sm:pt-24"
              }`}
            >
              <span className="inline-flex items-center gap-2 rounded-full border border-primary/15 bg-card px-4 py-1.5 text-[0.7rem] font-bold uppercase tracking-[0.18em] text-primary shadow-sm">
                <span className="size-1.5 rounded-full bg-accent" aria-hidden="true" />
                Sports physiotherapy
              </span>

              <h1
                className={`font-black leading-[1.03] tracking-tight ${
                  currentUser ? "mt-3 text-3xl sm:text-4xl" : "mt-7 text-5xl sm:text-7xl"
                }`}
              >
                <span className="bg-brand-gradient bg-clip-text text-transparent">VITO</span>{" "}
                <span className="text-foreground">Physio</span>
              </h1>

              <p
                className={`mx-auto max-w-xl leading-relaxed text-muted-foreground ${
                  currentUser ? "mt-2 text-sm sm:text-base" : "mt-6 text-lg sm:text-xl"
                }`}
              >
                From the first injury report to a confident return to sport. Connected care for
                athletes, schools, academies and clubs.
              </p>

              <div
                className={`flex flex-wrap items-center justify-center gap-2 ${
                  currentUser ? "mt-3" : "mt-6 sm:mt-9"
                }`}
              >
                <WhatsAppConsultationButton compact={Boolean(currentUser)} />
                {currentUser ? (
                  <Button
                    asChild
                    size="sm"
                    className="rounded-full bg-brand-gradient px-4 text-sm shadow-glow ring-1 ring-primary/25 transition-transform hover:-translate-y-0.5"
                  >
                    <Link to="/dashboard">
                      <LayoutDashboard className="mr-2 size-4" />
                      Workspace
                    </Link>
                  </Button>
                ) : (
                  <Button
                    asChild
                    size="lg"
                    variant="outline"
                    className="rounded-full px-7 text-base"
                  >
                    <Link to="/auth">
                      <LogIn className="mr-2 size-4" />
                      Sign in to get working
                    </Link>
                  </Button>
                )}
              </div>

              <ul
                className={`flex flex-wrap items-center justify-center gap-x-3 gap-y-2 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground ${
                  currentUser ? "mt-3" : "mt-12"
                }`}
              >
                {audience.map((name, i) => (
                  <li key={name} className="flex items-center gap-3">
                    {i > 0 && (
                      <span className="size-1 rounded-full bg-accent/60" aria-hidden="true" />
                    )}
                    {name}
                  </li>
                ))}
              </ul>
            </div>

            {!currentUser && (
              <div className="mx-auto flex max-w-3xl flex-col items-center gap-5 border-t px-5 py-10 text-center">
                <VitoBrandLockup className="justify-center" />
                <p className="max-w-md text-sm text-muted-foreground">
                  One record per athlete: injuries, assessments, rehab plans, follow-ups and
                  recovery progress, shared only with the people who need to see them.
                </p>
              </div>
            )}
          </section>
        )}

        {currentUser && homeStage >= 2 && (
          <div className="home-load-in">
            <SignedInHomeHighlights steps={cycle} />
          </div>
        )}
        {currentUser && homeStage >= 3 && (
          <div className="home-load-in">
            <SignedInHomeTabs contentReady={homeStage >= 4} />
          </div>
        )}

        {!currentUser && (
          <section className="border-t bg-card">
            <div className="mx-auto max-w-6xl px-5 py-16">
              <div className="mx-auto mb-12 max-w-2xl text-center">
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-accent">
                  The care pathway
                </p>
                <h2 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">
                  From injury to return
                </h2>
                <p className="mt-4 text-muted-foreground">
                  Every case follows the same six steps, so nothing gets lost between the first
                  report and the final clearance.
                </p>
              </div>

              <ol className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {cycle.map(({ icon: Icon, title, detail }, i) => (
                  <li
                    key={title}
                    className="group relative rounded-2xl border bg-background p-6 text-center transition duration-300 hover:-translate-y-1 hover:border-primary/40 hover:shadow-card-lift"
                  >
                    <span className="absolute right-5 top-5 text-xs font-black tracking-widest text-accent/70">
                      0{i + 1}
                    </span>
                    <div className="mx-auto grid size-14 place-items-center rounded-2xl bg-secondary text-primary transition group-hover:bg-brand-gradient group-hover:text-primary-foreground">
                      <Icon className="size-7" aria-hidden="true" />
                    </div>
                    <h3 className="mt-5 text-lg font-bold">{title}</h3>
                    <p className="mt-1.5 text-sm text-muted-foreground">{detail}</p>
                  </li>
                ))}
              </ol>
            </div>
          </section>
        )}
      </main>
      {currentUser && homeStage >= 5 && <SignedInBottomNavigation />}
      {currentUser && !headerReady && <VitoLoadingOverlay />}
    </div>
  );
}

const HOME_STAFF_ROLES = [
  "super_admin",
  "vito_admin",
  "clinical_professional",
  "clinical_supervisor",
];
const HOME_ADMIN_ROLES = ["super_admin", "vito_admin"];

function SignedInHomeHeader({ user }: { user: User }) {
  const navigate = useNavigate();
  const [profile, setProfile] = useState<{
    full_name: string | null;
    avatar_path: string | null;
    role: string;
  }>({ full_name: user.email ?? "VITO Physio member", avatar_path: null, role: "athlete" });

  useEffect(() => {
    let active = true;
    Promise.all([
      supabase.from("profiles").select("full_name, avatar_path").eq("id", user.id).maybeSingle(),
      supabase.from("user_roles").select("role").eq("user_id", user.id).limit(1),
    ]).then(([profileResult, roleResult]) => {
      if (!active) return;
      setProfile({
        full_name: profileResult.data?.full_name ?? user.email ?? "VITO Physio member",
        avatar_path: profileResult.data?.avatar_path ?? null,
        role: roleResult.data?.[0]?.role ?? "athlete",
      });
    });
    return () => {
      active = false;
    };
  }, [user.email, user.id]);

  const staff = HOME_STAFF_ROLES.includes(profile.role);
  const admin = HOME_ADMIN_ROLES.includes(profile.role);

  async function signOut() {
    await supabase.auth.signOut();
    navigate({ to: "/" });
  }

  return (
    <header className="sticky top-0 z-50 bg-primary text-primary-foreground shadow-sm">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-3 px-4 sm:gap-5 sm:px-5">
        <VitoInfoPanel triggerClassName="focus-visible:ring-primary-foreground/70" />
        <div className="ml-auto flex shrink-0 items-center gap-2 sm:gap-3">
          <button
            type="button"
            onClick={() => navigate({ to: "/dashboard" })}
            aria-label="Open home dashboard"
            title="Open home dashboard"
            className="rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-foreground/70"
          >
            <PhotoAvatar
              path={profile.avatar_path}
              name={profile.full_name}
              className="size-10 border-2 border-primary-foreground/25 text-sm"
            />
          </button>
          <DropdownMenu modal={false}>
            <DropdownMenuTrigger
              aria-label="Open signed-in menu"
              title="Open signed-in menu"
              className="inline-flex size-10 items-center justify-center rounded-md text-primary-foreground/90 transition-colors hover:bg-primary-foreground/10 hover:text-primary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-foreground/70 data-[state=open]:bg-primary-foreground/15"
            >
              <Menu className="size-7" strokeWidth={2.25} />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" sideOffset={10} className="w-64 rounded-xl p-1.5">
              <DropdownMenuLabel className="flex items-center gap-2 px-2 py-2">
                <PhotoAvatar
                  path={profile.avatar_path}
                  name={profile.full_name}
                  className="size-8"
                />
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold">{profile.full_name}</span>
                  <span className="block truncate text-xs font-normal text-muted-foreground">
                    {profile.role.replaceAll("_", " ")}
                  </span>
                </span>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild className="cursor-pointer gap-3 rounded-lg px-2 py-2">
                <Link to="/dashboard">
                  <LayoutDashboard className="size-4 text-primary" />
                  Dashboard
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild className="cursor-pointer gap-3 rounded-lg px-2 py-2">
                <Link to="/messages">
                  <MessageCircle className="size-4 text-primary" />
                  Messages
                </Link>
              </DropdownMenuItem>
              {staff && (
                <>
                  <DropdownMenuItem asChild className="cursor-pointer gap-3 rounded-lg px-2 py-2">
                    <Link to="/cases">
                      <ClipboardList className="size-4 text-primary" />
                      Case workspace
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild className="cursor-pointer gap-3 rounded-lg px-2 py-2">
                    <Link to="/notifications">
                      <Bell className="size-4 text-primary" />
                      Notifications
                    </Link>
                  </DropdownMenuItem>
                </>
              )}
              {admin && (
                <DropdownMenuItem asChild className="cursor-pointer gap-3 rounded-lg px-2 py-2">
                  <Link to="/admin">
                    <ShieldCheck className="size-4 text-primary" />
                    Accounts & approvals
                  </Link>
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onSelect={() => void signOut()}
                className="cursor-pointer gap-3 rounded-lg px-2 py-2"
              >
                <LogOut className="size-4 text-primary" />
                Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}
