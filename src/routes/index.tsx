import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
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

function Index() {
  return (
    <div className="min-h-screen bg-background">
      <header className="mx-auto flex max-w-5xl items-center justify-between px-5 py-4">
        <div className="flex items-center gap-2">
          <img src={logo.url} alt="VITO Physio" className="h-10 w-10" />
          <span className="text-lg font-bold text-primary">VITO Physio</span>
        </div>
        <Button asChild variant="outline"><Link to="/auth">Sign in</Link></Button>
      </header>
      <main className="mx-auto flex max-w-5xl flex-col items-center gap-8 px-5 py-12 text-center md:flex-row md:text-left">
        <div className="flex-1 space-y-5">
          <p className="text-sm font-semibold uppercase tracking-widest text-accent">Sports physiotherapy</p>
          <h1 className="text-4xl font-extrabold leading-tight text-foreground md:text-5xl">
            Keep every athlete <span className="text-primary">moving forward.</span>
          </h1>
          <p className="text-muted-foreground">
            Injury cases, assessments, rehab plans and recovery tracking for schools, academies, clubs and independent athletes.
          </p>
          <div className="flex flex-col gap-3 sm:flex-row md:justify-start sm:justify-center">
            <Button asChild size="lg"><Link to="/auth">Sign in or create account</Link></Button>
          </div>
        </div>
        <img src={logo.url} alt="" className="w-64 md:w-80" />
      </main>
    </div>
  );
}
