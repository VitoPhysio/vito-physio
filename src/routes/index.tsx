import { createFileRoute, Link } from "@tanstack/react-router";
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
} from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import logo from "@/assets/vito-logo.png";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "VITO Physio — Sports physiotherapy care" },
      { name: "description", content: "Injury cases, rehab and recovery tracking for schools, academies, clubs and athletes." },
      { property: "og:title", content: "VITO Physio — Sports physiotherapy care" },
      { property: "og:description", content: "Injury cases, rehab and recovery tracking for schools, academies, clubs and athletes." },
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

function Index() {
  const [signedIn, setSignedIn] = useState(false);
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setSignedIn(Boolean(data.user)));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => setSignedIn(Boolean(session)));
    return () => subscription.unsubscribe();
  }, []);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-50 border-b border-border bg-card">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-5 py-3.5">
          <Link to="/" className="flex min-w-0 items-center gap-2.5">
            <img src={logo} alt="VITO Physio" className="h-10 w-10 shrink-0 object-contain" />
            <span className="truncate text-lg font-extrabold tracking-tight">
              <span className="text-primary">VITO</span> <span className="text-accent">Physio</span>
            </span>
          </Link>
          <Button
            asChild
            size="sm"
            className="bg-brand-gradient shrink-0 gap-2 rounded-full px-5 font-semibold text-primary-foreground shadow-glow ring-1 ring-primary/25 transition-transform hover:-translate-y-0.5"
          >
            <Link to={signedIn ? "/dashboard" : "/auth"}>
              {signedIn ? <LayoutDashboard className="size-4" /> : <LogIn className="size-4" />}
              {signedIn ? "Dashboard" : "Sign in"}
              <ArrowRight className="size-4" />
            </Link>
          </Button>
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
              From the first injury report to a confident return to sport. Connected care for athletes,
              schools, academies and clubs.
            </p>

            <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
              <Button asChild size="lg" className="bg-brand-gradient rounded-full px-7 text-base shadow-glow ring-1 ring-primary/25 transition-transform hover:-translate-y-0.5">
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
                  {i > 0 && <span className="size-1 rounded-full bg-accent/60" aria-hidden="true" />}
                  {name}
                </li>
              ))}
            </ul>
          </div>

          <div className="mx-auto flex max-w-3xl flex-col items-center gap-3 border-t px-5 py-10 text-center">
            <img src={logo} alt="VITO Physio logo" className="h-24 w-24 object-contain sm:h-28 sm:w-28" />
            <p className="text-base font-bold text-primary">Care that moves with you</p>
            <p className="max-w-md text-sm text-muted-foreground">
              One record per athlete: injuries, assessments, rehab plans, follow-ups and recovery progress,
              shared only with the people who need to see them.
            </p>
          </div>
        </section>

        <section className="border-t bg-card">
          <div className="mx-auto max-w-6xl px-5 py-16">
            <div className="mx-auto mb-12 max-w-2xl text-center">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-accent">The care pathway</p>
              <h2 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">From injury to return</h2>
              <p className="mt-4 text-muted-foreground">
                Every case follows the same six steps, so nothing gets lost between the first report and the
                final clearance.
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
