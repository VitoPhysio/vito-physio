import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import {
  ArrowRight,
  ClipboardList,
  Activity,
  Dumbbell,
  CalendarCheck2,
  HeartPulse,
  Stethoscope,
  UserRound,
  LockKeyhole,
  LogIn,
  LayoutDashboard,
  Menu,
  Search,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import logo from "@/assets/vito-logo.png";
import { WhatsAppConsultationButton } from "@/components/vito/WhatsAppConsultationButton";
import { VitoInfoPanel } from "@/components/vito/VitoInfoPanel";

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
  {
    label: "Athlete profile",
    description: "View and update your athlete profile.",
    to: "/profile",
    requiresLogin: true,
  },
];

function Index() {
  const navigate = useNavigate();
  const [signedIn, setSignedIn] = useState(false);
  const [search, setSearch] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const matches = publicSearchItems.filter((item) =>
    `${item.label} ${item.description}`.toLowerCase().includes(search.trim().toLowerCase()),
  );

  function selectSearchItem(item: (typeof publicSearchItems)[number]) {
    setSearch("");
    setSearchOpen(false);
    if (item.requiresLogin && !signedIn) {
      toast("Please sign in to open this area.");
      navigate({ to: "/auth" });
      return;
    }
    navigate({ to: item.to as never });
  }

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setSignedIn(Boolean(data.user)));
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => setSignedIn(Boolean(session)));
    return () => subscription.unsubscribe();
  }, []);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-50 bg-foreground text-background shadow-sm">
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
            <Search className="pointer-events-none absolute left-3 top-1/2 size-5 -translate-y-1/2 text-background/60" />
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
              className="h-10 w-full rounded-lg border border-background/10 bg-background/10 pl-10 pr-3 text-sm text-background placeholder:text-background/60 focus:border-background/30 focus:bg-background/15 focus:outline-none"
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
            {!signedIn && (
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
            {signedIn && (
              <Link
                to="/dashboard"
                aria-label="Open dashboard"
                className="inline-flex size-10 items-center justify-center rounded-full text-background/85 hover:bg-background/10"
              >
                <LayoutDashboard className="size-5" />
              </Link>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger
                aria-label="Open menu"
                title="Open menu"
                className="inline-flex size-10 items-center justify-center rounded-md text-background/80 transition-colors hover:bg-background/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-background/60"
              >
                <Menu className="size-7" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-64 rounded-xl p-2">
                <DropdownMenuLabel>
                  {signedIn ? "Quick menu" : "Sign in required"}
                </DropdownMenuLabel>
                {!signedIn && (
                  <DropdownMenuItem asChild>
                    <Link to="/auth" className="cursor-pointer">
                      Sign in to open your menu
                    </Link>
                  </DropdownMenuItem>
                )}
                {signedIn && (
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

      <main>
        <section className="bg-hero-glow relative overflow-hidden">
          <div className="mx-auto max-w-3xl px-5 pb-14 pt-16 text-center sm:pt-24">
            <span className="inline-flex items-center gap-2 rounded-full border border-primary/15 bg-card px-4 py-1.5 text-[0.7rem] font-bold uppercase tracking-[0.18em] text-primary shadow-sm">
              <span className="size-1.5 rounded-full bg-accent" aria-hidden="true" />
              Sports physiotherapy
            </span>

            <h1 className="mt-7 text-5xl font-black leading-[1.03] tracking-tight sm:text-7xl">
              <span className="bg-brand-gradient bg-clip-text text-transparent">VITO</span>{" "}
              <span className="text-foreground">Physio</span>
            </h1>

            <p className="mx-auto mt-6 max-w-xl text-lg leading-relaxed text-muted-foreground sm:text-xl">
              From the first injury report to a confident return to sport. Connected care for
              athletes, schools, academies and clubs.
            </p>

            <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
              <WhatsAppConsultationButton />
              <Button
                asChild
                size="lg"
                className="bg-brand-gradient rounded-full px-7 text-base shadow-glow ring-1 ring-primary/25 transition-transform hover:-translate-y-0.5"
              >
                <Link to="/register">
                  <Stethoscope className="mr-2 size-4" />
                  Consult or register
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="rounded-full px-7 text-base">
                <Link to="/portal">
                  <LockKeyhole className="mr-2 size-4" />
                  Parent portal
                </Link>
              </Button>
            </div>

            <ul className="mt-12 flex flex-wrap items-center justify-center gap-x-3 gap-y-2 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
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

          <div className="mx-auto flex max-w-3xl flex-col items-center gap-3 border-t px-5 py-10 text-center">
            <img
              src={logo}
              alt="VITO Physio logo"
              className="h-24 w-24 object-contain sm:h-28 sm:w-28"
            />
            <p className="text-base font-bold text-primary">Care that moves with you</p>
            <p className="max-w-md text-sm text-muted-foreground">
              One record per athlete: injuries, assessments, rehab plans, follow-ups and recovery
              progress, shared only with the people who need to see them.
            </p>
          </div>
        </section>

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
                Every case follows the same six steps, so nothing gets lost between the first report
                and the final clearance.
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
      </main>
    </div>
  );
}
