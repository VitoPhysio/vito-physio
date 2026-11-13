import { useEffect } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Activity, AlertTriangle, ShieldCheck, UserPlus, Users } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PhotoAvatar } from "@/components/vito/Photo";
import { VitoLoadingMark } from "@/components/vito/VitoBrandLockup";
import { WorkspaceMenus, type WorkspaceMenu } from "@/components/vito/WorkspaceMenus";
import { InstitutionForm } from "@/components/vito/institution/InstitutionForm";
import { useMyInstitutions } from "@/components/vito/institution/InstitutionEntry";
import {
  INSTITUTION_ROLE_LABEL,
  INSTITUTION_TYPE_LABEL,
  LAST_INSTITUTION_KEY,
  institutionPermissions,
  type InstitutionRole,
  type WorkspaceSection,
} from "@/lib/institution";

const MENUS: WorkspaceMenu[] = [
  { label: "Institution", items: [{ label: "Overview", value: "overview" }, { label: "Institution settings", value: "settings" }] },
  { label: "Athletes & teams", items: [{ label: "Athletes", value: "athletes" }, { label: "Teams and coaches", value: "teams" }] },
  {
    label: "Injuries",
    items: [
      { label: "Injury management", value: "injuries" },
      { label: "Injury surveillance", value: "surveillance" },
      { label: "Rehabilitation", value: "rehabilitation" },
    ],
  },
  {
    label: "Care & communication",
    items: [
      { label: "Communications", value: "communications" },
      { label: "Connect to professionals", value: "professionals" },
    ],
  },
  { label: "Reports", items: [{ label: "Reports & analytics", value: "reports" }] },
];

const UPCOMING: Partial<Record<WorkspaceSection, string>> = {
  athletes: "Athlete directory, profiles and team assignments",
  teams: "Teams, classes and coach assignments",
  injuries: "Institution injury records",
  surveillance: "Injury patterns, early warnings and prevention priorities",
  rehabilitation: "Rehabilitation progress and return to sport",
  communications: "Institution messages, announcements and reminders",
  professionals: "Referrals and consent-based sharing with professionals",
  reports: "Printable institutional, athlete and surveillance reports",
};

type Overview = {
  athletes: number;
  injured: number;
  injuries_30d: number;
  administrators: number;
  coaches: number;
  pending_requests: number;
  sports: { sport: string; count: number }[];
};

export function InstitutionWorkspace({ institutionId, section }: { institutionId: string; section: WorkspaceSection }) {
  const { data: institutions, isLoading } = useMyInstitutions();
  const navigate = useNavigate();
  const current = institutions?.find((i) => i.id === institutionId);

  useEffect(() => {
    if (current) localStorage.setItem(LAST_INSTITUTION_KEY, current.id);
  }, [current]);

  if (isLoading)
    return (
      <div className="grid min-h-[50vh] place-items-center">
        <VitoLoadingMark />
      </div>
    );

  if (!current)
    return (
      <main className="mx-auto max-w-lg space-y-4 px-4 py-16 text-center">
        <h1 className="text-xl font-bold">You don't have access to this institution</h1>
        <p className="text-sm text-muted-foreground">Choose one of your institutions or request to join.</p>
        <Button asChild>
          <Link to="/workspace">Go to my institutions</Link>
        </Button>
      </main>
    );

  const perms = institutionPermissions(current.role);
  const setSection = (value: string) =>
    void navigate({
      to: "/workspace/$institutionId",
      params: { institutionId },
      search: { section: value as WorkspaceSection },
    });

  return (
    <main className="mx-auto max-w-6xl space-y-5 px-4 py-6">
      <header className="flex flex-wrap items-center gap-3 rounded-2xl border bg-card p-4 shadow-sm">
        <PhotoAvatar path={current.logo_path} name={current.name} className="size-12" />
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-xl font-black tracking-tight">{current.name}</h1>
          <p className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
            {INSTITUTION_TYPE_LABEL[current.school_type] ?? current.school_type}
            {current.district || current.location ? ` · ${current.district || current.location}` : ""}
            <Badge>{INSTITUTION_ROLE_LABEL[current.role as InstitutionRole] ?? current.role}</Badge>
            {current.verification_status === "verified" ? (
              <Badge variant="secondary" className="gap-1">
                <ShieldCheck className="size-3" /> Verified
              </Badge>
            ) : (
              <Badge variant="outline">Verification pending</Badge>
            )}
          </p>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <span className="sr-only sm:not-sr-only sm:text-muted-foreground">Institution</span>
          <select
            aria-label="Switch institution"
            value={institutionId}
            onChange={(e) => {
              if (e.target.value === "__add") return void navigate({ to: "/workspace", search: { add: true } });
              void navigate({ to: "/workspace/$institutionId", params: { institutionId: e.target.value } });
            }}
            className="h-9 max-w-[16rem] rounded-md border border-input bg-background px-3 text-sm"
          >
            {institutions?.map((i) => (
              <option key={i.id} value={i.id}>
                {i.name}
              </option>
            ))}
            <option value="__add">+ Join or register another</option>
          </select>
        </label>
      </header>

      <WorkspaceMenus menus={MENUS} value={section} onSelect={setSection} />

      {section === "overview" && <OverviewPanel institutionId={institutionId} canReview={perms.reviewRequests} onReview={() => setSection("settings")} />}
      {section === "settings" && <SettingsPanel institution={current} perms={perms} />}
      {UPCOMING[section] && (
        <section className="rounded-2xl border border-dashed bg-card p-8 text-center">
          <h2 className="text-lg font-bold">{MENUS.flatMap((m) => m.items).find((i) => i.value === section)?.label}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{UPCOMING[section]} — coming in the next upgrade phase.</p>
        </section>
      )}
    </main>
  );
}

function Stat({ label, value, icon: Icon }: { label: string; value: number | string; icon: typeof Users }) {
  return (
    <div className="rounded-2xl border bg-card p-4 shadow-sm">
      <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
        <Icon className="size-4 text-primary" />
      </div>
      <p className="mt-2 text-3xl font-black tabular-nums">{value}</p>
    </div>
  );
}

function OverviewPanel({ institutionId, canReview, onReview }: { institutionId: string; canReview: boolean; onReview: () => void }) {
  const { data, isLoading, error } = useQuery({
    queryKey: ["institution-overview", institutionId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("institution_overview", { _school: institutionId });
      if (error) throw error;
      return data as unknown as Overview;
    },
  });
  if (isLoading) return <p className="text-sm text-muted-foreground">Loading institution figures…</p>;
  if (error || !data) return <p className="text-sm text-destructive">Could not load figures: {error?.message}</p>;
  const max = Math.max(1, ...data.sports.map((s) => s.count));
  return (
    <section className="space-y-5">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Registered athletes" value={data.athletes} icon={Users} />
        <Stat label="Currently injured" value={data.injured} icon={AlertTriangle} />
        <Stat label="New injuries (30 days)" value={data.injuries_30d} icon={Activity} />
        <Stat label="Coaches & admins" value={data.coaches + data.administrators} icon={ShieldCheck} />
      </div>
      {canReview && data.pending_requests > 0 && (
        <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-primary/40 bg-secondary p-4">
          <UserPlus className="size-5 text-primary" />
          <p className="flex-1 text-sm font-medium">
            {data.pending_requests} membership request{data.pending_requests === 1 ? "" : "s"} waiting for review
          </p>
          <Button size="sm" onClick={onReview}>Review</Button>
        </div>
      )}
      <div className="rounded-2xl border bg-card p-4">
        <h2 className="mb-3 font-bold">Athletes by sport</h2>
        {data.sports.length === 0 ? (
          <p className="text-sm text-muted-foreground">No athletes are linked to this institution yet.</p>
        ) : (
          <ul className="space-y-2">
            {data.sports.map((s) => (
              <li key={s.sport} className="grid grid-cols-[8rem_1fr_2.5rem] items-center gap-2 text-sm">
                <span className="truncate">{s.sport}</span>
                <span className="h-2 rounded-full bg-secondary">
                  <span className="block h-2 rounded-full bg-brand-gradient" style={{ width: `${(s.count / max) * 100}%` }} />
                </span>
                <span className="text-right tabular-nums">{s.count}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

type CurrentInstitution = NonNullable<ReturnType<typeof useMyInstitutions>["data"]>[number];

function SettingsPanel({ institution, perms }: { institution: CurrentInstitution; perms: ReturnType<typeof institutionPermissions> }) {
  const queryClient = useQueryClient();
  const id = institution.id;

  const profile = useQuery({
    queryKey: ["institution-profile", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("schools")
        .select("name, location, district, sports, contact_phone, contact_email, school_code")
        .eq("id", id)
        .single();
      if (error) throw error;
      return data;
    },
  });
  const members = useQuery({
    queryKey: ["institution-members", id],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("institution_members", { _school: id });
      if (error) throw error;
      return data ?? [];
    },
  });
  const requests = useQuery({
    queryKey: ["institution-requests", id],
    enabled: perms.reviewRequests,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("institution_join_requests", { _school: id });
      if (error) throw error;
      return data ?? [];
    },
  });

  const refresh = () =>
    Promise.all(
      ["institution-members", "institution-requests", "institution-overview", "institution-profile", "my-institutions"].map((k) =>
        queryClient.invalidateQueries({ queryKey: k === "my-institutions" ? [k] : [k, id] }),
      ),
    );

  async function review(requestId: string, approve: boolean) {
    const { error } = await supabase.rpc("review_join_request", { _request: requestId, _approve: approve });
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(approve ? "Member approved" : "Request declined");
    await refresh();
  }

  async function changeMember(userId: string, role: string, status: string) {
    const { error } = await supabase.rpc("set_institution_member_role", { _school: id, _user: userId, _role: role, _status: status });
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Member updated");
    await refresh();
  }

  return (
    <section className="grid gap-5 lg:grid-cols-2">
      <div className="rounded-2xl border bg-card p-4 sm:p-6 lg:col-span-2">
        <h2 className="mb-1 font-bold">Institution profile</h2>
        {profile.data && <p className="mb-4 text-xs text-muted-foreground">Institution ID: {profile.data.school_code}</p>}
        {!profile.data ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : perms.editProfile ? (
          <InstitutionForm
            mode="edit"
            submitLabel="Save profile"
            defaults={{
              name: profile.data.name,
              location: profile.data.location ?? "",
              district: profile.data.district ?? "",
              sports: profile.data.sports ?? [],
              phone: profile.data.contact_phone ?? "",
              email: profile.data.contact_email ?? "",
            }}
            onSubmit={async (v) => {
              const { error } = await supabase.rpc("update_institution_profile", {
                _school: id,
                _name: v.name,
                _location: v.location,
                _district: v.district,
                _sports: v.sports,
                _phone: v.phone,
                _email: v.email,
                // The database accepts null to keep the current logo.
                _logo_path: v.logoPath as string,
              });
              if (error) throw new Error(error.message);
              toast.success("Profile saved");
              await refresh();
            }}
          />
        ) : (
          <dl className="grid gap-2 text-sm sm:grid-cols-2">
            <div><dt className="text-muted-foreground">Location</dt><dd>{profile.data.location || "—"}</dd></div>
            <div><dt className="text-muted-foreground">District</dt><dd>{profile.data.district || "—"}</dd></div>
            <div><dt className="text-muted-foreground">Sports</dt><dd>{profile.data.sports?.join(", ") || "—"}</dd></div>
            <div><dt className="text-muted-foreground">Contact</dt><dd>{profile.data.contact_phone || profile.data.contact_email || "—"}</dd></div>
          </dl>
        )}
      </div>

      {perms.reviewRequests && (
        <div className="rounded-2xl border bg-card p-4 sm:p-6">
          <h2 className="mb-3 font-bold">Membership requests</h2>
          {requests.isLoading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : !requests.data?.length ? (
            <p className="text-sm text-muted-foreground">No pending requests.</p>
          ) : (
            <ul className="space-y-3">
              {requests.data.map((r) => (
                <li key={r.id} className="flex flex-wrap items-center gap-2 rounded-xl border p-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{r.full_name || r.email || "Unnamed account"}</p>
                    <p className="text-xs text-muted-foreground">
                      Wants to join as {INSTITUTION_ROLE_LABEL[r.role as InstitutionRole] ?? r.role}
                    </p>
                  </div>
                  <Button size="sm" onClick={() => review(r.id, true)}>Approve</Button>
                  <Button size="sm" variant="outline" onClick={() => review(r.id, false)}>Decline</Button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <div className={`rounded-2xl border bg-card p-4 sm:p-6 ${perms.reviewRequests ? "" : "lg:col-span-2"}`}>
        <h2 className="mb-3 font-bold">Administrators and coaches</h2>
        {members.isLoading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : (
          <ul className="space-y-3">
            {members.data?.map((m) => (
              <li key={m.user_id} className="flex flex-wrap items-center gap-2">
                <PhotoAvatar path={m.avatar_path} name={m.full_name} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{m.full_name || "Unnamed account"}</p>
                  {m.email && <p className="truncate text-xs text-muted-foreground">{m.email}</p>}
                </div>
                {perms.manageMembers ? (
                  <select
                    aria-label={`Role for ${m.full_name ?? "member"}`}
                    value={m.status === "suspended" ? "suspended" : m.role}
                    onChange={(e) =>
                      e.target.value === "suspended"
                        ? changeMember(m.user_id, m.role, "suspended")
                        : changeMember(m.user_id, e.target.value, "active")
                    }
                    className="h-8 rounded-md border border-input bg-background px-2 text-xs"
                  >
                    <option value="school_admin">Administrator</option>
                    <option value="coach">Coach</option>
                    <option value="suspended">Suspended</option>
                  </select>
                ) : (
                  <Badge variant="secondary">
                    {m.status === "suspended" ? "Suspended" : INSTITUTION_ROLE_LABEL[m.role as InstitutionRole] ?? m.role}
                  </Badge>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
