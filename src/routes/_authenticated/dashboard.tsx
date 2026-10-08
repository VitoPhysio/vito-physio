import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { PhotoAvatar } from "@/components/vito/Photo";
import { AthletePortal } from "@/components/athlete/Portal";
import logo from "@/assets/vito-logo.png";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Home & care overview — VITO Physio" },
      {
        name: "description",
        content: "Your VITO Physio care overview, recovery and professional sports network.",
      },
      { property: "og:title", content: "Home & care overview — VITO Physio" },
      {
        property: "og:description",
        content: "Health, rehabilitation and connected care within VITO Physio.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
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

  const { data, isLoading } = useQuery({
    queryKey: ["dashboard", user.id],
    queryFn: async () => {
      const [{ data: profile }, { data: roles }] = await Promise.all([
        supabase.from("profiles").select("full_name, avatar_path").eq("id", user.id).maybeSingle(),
        supabase.from("user_roles").select("role").eq("user_id", user.id),
      ]);
      const role = roles?.[0]?.role ?? "athlete";
      const staff = STAFF.includes(role);
      const count = async (t: "athletes" | "injuries" | "referrals", f?: [string, string]) => {
        let q = supabase.from(t).select("id", { count: "exact", head: true });
        if (f) q = q.eq(f[0], f[1]);
        return (await q).count ?? 0;
      };
      const [schools, athletes, cases, openRefs, recent, partners] = await Promise.all([
        supabase
          .from("schools")
          .select("id", { count: "exact", head: true })
          .then((r) => r.count ?? 0),
        count("athletes"),
        count("injuries"),
        staff ? count("referrals", ["status", "open"]) : Promise.resolve(0),
        supabase
          .from("injuries")
          .select(
            "id, injury_code, body_region, status, created_at, athletes(first_name, surname, athlete_code, photo_path)",
          )
          .order("updated_at", { ascending: false })
          .limit(10),
        staff
          ? supabase.from("schools").select("id, name, school_code, school_type").order("name")
          : Promise.resolve({
              data: [] as { id: string; name: string; school_code: string; school_type: string }[],
            }),
      ]);
      const stats = staff
        ? [
            { label: "Schools, academies & clubs", value: schools },
            { label: "Athletes", value: athletes },
            { label: "Injury cases", value: cases },
            { label: "Open referrals", value: openRefs },
          ]
        : [
            { label: "Athletes", value: athletes },
            { label: "Injury cases", value: cases },
          ];
      return {
        avatar: profile?.avatar_path ?? null,
        name: profile?.full_name ?? user.email,
        role,
        staff,
        stats,
        recent: recent.data ?? [],
        partners: partners.data ?? [],
      };
    },
  });

  if (isLoading || !data) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <img src={logo} alt="Loading" className="h-20 w-20 animate-pulse" />
      </div>
    );
  }

  if (data.role === "athlete" || data.role === "parent") return <AthletePortal user={user} />;

  const isAdmin = data.role === "super_admin" || data.role === "vito_admin";

  return (
    <div className="min-h-screen bg-background">
      <section className="bg-brand-gradient text-primary-foreground">
        <div className="mx-auto flex max-w-5xl flex-col gap-3 px-5 py-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <PhotoAvatar
              path={data.avatar}
              name={data.name}
              className="size-12 border-2 border-card"
            />
            <div>
              <p className="text-sm opacity-80">Welcome back</p>
              <h1 className="text-xl font-bold">{data.name}</h1>
            </div>
          </div>
          <span className="self-start rounded-full bg-accent px-3 py-1 text-xs font-semibold text-accent-foreground sm:self-auto">
            {ROLE_LABEL[data.role] ?? data.role}
          </span>
        </div>
      </section>
      <main className="mx-auto max-w-5xl space-y-8 px-5 py-8">
        {data.staff && (
          <Button asChild size="lg" className="w-full sm:w-auto">
            <Link to="/cases">Go to case workspace</Link>
          </Button>
        )}
        {isAdmin && (
          <Button asChild size="lg" variant="outline" className="ml-0 w-full sm:ml-3 sm:w-auto">
            <Link to="/admin">Accounts & approvals</Link>
          </Button>
        )}
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {data.stats.map((s) => (
            <div key={s.label} className="rounded-2xl border bg-card p-5">
              <p className="text-sm text-muted-foreground">{s.label}</p>
              <p className="mt-1 text-3xl font-extrabold text-primary">{s.value}</p>
            </div>
          ))}
        </div>

        <section>
          <h2 className="mb-3 text-lg font-bold">
            {data.staff ? "Caseload & recovery monitoring" : "Injuries & recovery status"}
          </h2>
          {data.recent.length ? (
            <ul className="space-y-2">
              {data.recent.map((c) => (
                <li
                  key={c.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-xl border bg-card p-3 text-sm"
                >
                  <span className="flex items-center gap-2">
                    <PhotoAvatar
                      path={c.athletes?.photo_path}
                      name={`${c.athletes?.first_name} ${c.athletes?.surname}`}
                      className="size-7"
                    />
                    <b className="text-primary">{c.injury_code}</b> · {c.athletes?.first_name}{" "}
                    {c.athletes?.surname} · {c.body_region}
                  </span>
                  <span className="rounded-full bg-secondary px-2 py-0.5 text-xs">{c.status}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">No cases to show yet.</p>
          )}
        </section>

        {isAdmin && (
          <section className="grid gap-4 md:grid-cols-3">
            {(["school", "academy", "club"] as const).map((t) => (
              <div key={t} className="rounded-2xl border bg-card p-4">
                <h3 className="mb-2 font-bold capitalize">
                  Partner {t === "academy" ? "academies" : `${t}s`}
                </h3>
                <ul className="space-y-1 text-sm">
                  {data.partners
                    .filter((p) => p.school_type === t)
                    .map((p) => (
                      <li key={p.id}>
                        {p.name} <span className="text-xs text-primary">{p.school_code}</span>
                      </li>
                    ))}
                  {!data.partners.some((p) => p.school_type === t) && (
                    <li className="text-muted-foreground">None yet.</li>
                  )}
                </ul>
              </div>
            ))}
          </section>
        )}
      </main>
    </div>
  );
}
