import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import logo from "@/assets/vito-logo.png.asset.json";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — VITO Physio" }] }),
  component: Dashboard,
});

const ROLE_LABEL: Record<string, string> = {
  super_admin: "Super admin",
  vito_admin: "VITO admin",
  clinical_professional: "Clinician",
  clinical_supervisor: "Clinical supervisor",
  school_admin: "School admin",
  coach: "Coach",
  athlete: "Athlete",
  parent: "Parent / guardian",
};
const STAFF = ["super_admin", "vito_admin", "clinical_professional", "clinical_supervisor"];

function Dashboard() {
  const { user } = Route.useRouteContext();
  const navigate = useNavigate();

  const { data, isLoading } = useQuery({
    queryKey: ["dashboard", user.id],
    queryFn: async () => {
      const [{ data: profile }, { data: roles }] = await Promise.all([
        supabase.from("profiles").select("full_name").eq("id", user.id).maybeSingle(),
        supabase.from("user_roles").select("role").eq("user_id", user.id),
      ]);
      const role = roles?.[0]?.role ?? "athlete";
      let stats: { label: string; value: number }[] = [];
      if (STAFF.includes(role)) {
        const count = async (t: "schools" | "athletes" | "injuries") =>
          (await supabase.from(t).select("id", { count: "exact", head: true })).count ?? 0;
        const [s, a, i] = await Promise.all([count("schools"), count("athletes"), count("injuries")]);
        stats = [
          { label: "Schools & clubs", value: s },
          { label: "Athletes", value: a },
          { label: "Injury cases", value: i },
        ];
      }
      return { name: profile?.full_name ?? user.email, role, stats };
    },
  });

  async function signOut() {
    await supabase.auth.signOut();
    navigate({ to: "/" });
  }

  if (isLoading || !data) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <img src={logo.url} alt="Loading" className="h-20 w-20 animate-pulse" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-brand-gradient text-primary-foreground">
        <div className="mx-auto flex max-w-5xl flex-col gap-3 px-5 py-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <img src={logo.url} alt="VITO Physio" className="h-12 w-12 rounded-xl bg-card p-1" />
            <div>
              <p className="text-sm opacity-80">Welcome back</p>
              <h1 className="text-xl font-bold">{data.name}</h1>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-accent px-3 py-1 text-xs font-semibold text-accent-foreground">
              {ROLE_LABEL[data.role] ?? data.role}
            </span>
            <Button variant="secondary" size="sm" onClick={signOut}>Sign out</Button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-5 py-8">
        {data.stats.length > 0 ? (
          <div className="grid gap-4 sm:grid-cols-3">
            {data.stats.map((s) => (
              <div key={s.label} className="rounded-2xl border bg-card p-5">
                <p className="text-sm text-muted-foreground">{s.label}</p>
                <p className="mt-1 text-3xl font-extrabold text-primary">{s.value}</p>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border bg-card p-6">
            <h2 className="font-semibold text-foreground">Your records</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Your injury cases, rehab plan and messages from your clinician will appear here.
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
