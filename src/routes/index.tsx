import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { ArrowRight, ClipboardList, Activity, Dumbbell, CalendarCheck2, HeartPulse, Stethoscope, Building2, UserRound, LockKeyhole } from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import logo from "@/assets/vito-logo.png.asset.json";

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
function Index() {
  const [signedIn, setSignedIn] = useState(false);
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setSignedIn(Boolean(data.user)));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => setSignedIn(Boolean(session)));
    return () => subscription.unsubscribe();
  }, []);
  return <div className="min-h-screen bg-background text-foreground">
    <header className="border-b bg-card"><div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-5 py-4"><Link to="/" className="flex items-center gap-2"><img src={logo.url} alt="VITO Physio" className="h-10 w-10"/><span className="font-bold text-primary">VITO Physio</span></Link><Button asChild variant="outline" size="sm"><Link to={signedIn ? "/dashboard" : "/auth"}>{signedIn ? "Dashboard" : "Sign in"} <ArrowRight className="ml-2 size-4"/></Link></Button></div></header>
    <main><section className="mx-auto max-w-6xl px-5 pb-10 pt-10 sm:pt-16"><div className="max-w-3xl"><p className="mb-3 text-xs font-bold uppercase text-accent">Sports physiotherapy · VITO Physio</p><h1 className="text-4xl font-bold leading-tight sm:text-5xl">VITO Physio</h1><p className="mt-4 max-w-2xl text-lg text-muted-foreground">From the first injury report to a confident return to sport. Connected care for athletes, schools, academies and clubs.</p><div className="mt-7 flex flex-wrap gap-3"><Button asChild size="lg"><Link to="/register"><Stethoscope className="mr-2 size-4"/> Consult or register</Link></Button><Button asChild size="lg" variant="outline"><Link to="/portal"><LockKeyhole className="mr-2 size-4"/> Parent portal</Link></Button></div></div><div className="mt-10 flex items-center gap-5 border-t pt-6"><img src={logo.url} alt="VITO Physio logo" className="h-20 w-20 object-contain sm:h-24 sm:w-24"/><div><p className="font-semibold text-primary">Care that moves with you</p><p className="text-sm text-muted-foreground">For schools, academies, clubs and independent athletes.</p></div></div></section>
    <section className="border-t bg-card"><div className="mx-auto max-w-6xl px-5 py-10"><div className="mb-6 flex items-end justify-between gap-3"><div><p className="text-xs font-bold uppercase text-accent">The care pathway</p><h2 className="mt-2 text-2xl font-bold">From injury to return</h2></div><Building2 className="size-7 text-primary" aria-hidden="true"/></div><ol className="grid grid-cols-2 gap-x-5 gap-y-7 sm:grid-cols-3 lg:grid-cols-6">{cycle.map(({icon: Icon,title,detail},i) => <li key={title} className="border-t-2 border-primary pt-4"><div className="mb-4 flex items-center justify-between"><Icon className="size-6 text-primary" aria-hidden="true"/><span className="text-xs font-bold text-accent">0{i+1}</span></div><h3 className="font-semibold">{title}</h3><p className="mt-1 text-sm text-muted-foreground">{detail}</p></li>)}</ol></div></section></main>
  </div>;
}
