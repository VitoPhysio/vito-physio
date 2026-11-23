import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Activity, Building2, Search, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AthletesPanel } from "@/components/vito/institution/AthletesPanel";
import { InjuriesPanel } from "@/components/vito/institution/InjuriesPanel";
import { TeamsPanel } from "@/components/vito/institution/TeamsPanel";
import { institutionPermissions, INSTITUTION_TYPE_LABEL } from "@/lib/institution";
import { useInstitutionAthletes, useTeams } from "@/components/vito/institution/shared";

type Institution = {
  id: string;
  name: string;
  school_type: string;
  location: string | null;
  district: string | null;
};

type ExplorerSection = "athletes" | "teams" | "trends";
const STAFF_PERMISSIONS = institutionPermissions("school_admin");
const SECTION_BUTTONS: { value: ExplorerSection; label: string; icon: typeof Users }[] = [
  { value: "athletes", label: "Athletes", icon: Users },
  { value: "teams", label: "Teams", icon: Building2 },
  { value: "trends", label: "Trends & surveillance", icon: Activity },
];

/** Staff-only cross-institution directory; institution RPCs enforce each operation on the server. */
export function ClinicianInstitutionWorkspace() {
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [section, setSection] = useState<ExplorerSection>("athletes");
  const institutions = useQuery({
    queryKey: ["clinician-institution-directory"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("schools")
        .select("id, name, school_type, location, district")
        .order("name")
        .limit(500);
      if (error) throw error;
      return (data ?? []) as Institution[];
    },
  });
  const filtered = useMemo(() => {
    const q = search.trim().toLocaleLowerCase();
    return (institutions.data ?? []).filter(
      (item) =>
        !q ||
        `${item.name} ${item.school_type} ${item.location ?? ""} ${item.district ?? ""}`
          .toLocaleLowerCase()
          .includes(q),
    );
  }, [institutions.data, search]);
  const active = institutions.data?.find((item) => item.id === selectedId) ?? null;

  return (
    <section className="space-y-5" aria-label="Institution and team explorer">
      <header className="space-y-1">
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-accent">
          Clinician workspace
        </p>
        <h2 className="text-xl font-bold">Browse athletes by institution and team</h2>
        <p className="max-w-3xl text-sm text-muted-foreground">
          Choose an institution to manage its athlete roster and teams, or review injury patterns
          and recovery trends for the full institution or a selected team.
        </p>
      </header>

      <div className="grid gap-5 lg:grid-cols-[minmax(15rem,0.8fr)_minmax(0,2fr)]">
        <aside className="space-y-3 rounded-2xl border bg-card p-4">
          <div>
            <h3 className="font-bold">Institutions</h3>
            <p className="text-xs text-muted-foreground">
              {institutions.data?.length ?? 0} available to VITO staff
            </p>
          </div>
          <label className="relative block">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              aria-label="Search institutions"
              className="pl-9"
              placeholder="Search name, district or location"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </label>
          {institutions.isLoading ? (
            <p className="py-4 text-sm text-muted-foreground">Loading institutions…</p>
          ) : institutions.error ? (
            <p role="alert" className="py-3 text-sm text-destructive">
              Institutions could not be loaded: {institutions.error.message}
            </p>
          ) : filtered.length === 0 ? (
            <p className="py-4 text-sm text-muted-foreground">
              {institutions.data?.length
                ? "No institutions match your search."
                : "No institutions are available."}
            </p>
          ) : (
            <ul className="max-h-[34rem] space-y-1 overflow-y-auto pr-1">
              {filtered.map((item) => {
                const selected = item.id === active?.id;
                return (
                  <li key={item.id}>
                    <button
                      type="button"
                      aria-current={selected ? "true" : undefined}
                      onClick={() => {
                        setSelectedId(item.id);
                        setSection("athletes");
                      }}
                      className={`w-full rounded-xl border px-3 py-2.5 text-left transition ${selected ? "border-primary bg-primary/5" : "border-transparent hover:border-border hover:bg-secondary/60"}`}
                    >
                      <span className="block truncate text-sm font-semibold">{item.name}</span>
                      <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                        {INSTITUTION_TYPE_LABEL[item.school_type] ?? item.school_type}
                        {item.location ? ` · ${item.location}` : ""}
                        {item.district ? ` · ${item.district}` : ""}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </aside>

        <div className="min-w-0 space-y-4">
          {!active ? (
            <div className="grid min-h-64 place-items-center rounded-2xl border border-dashed bg-card p-8 text-center">
              <div>
                <Building2 className="mx-auto size-9 text-primary" />
                <h3 className="mt-3 font-bold">Select an institution</h3>
                <p className="mt-1 max-w-md text-sm text-muted-foreground">
                  Search the directory, then open its athletes, team rosters, and trends.
                </p>
              </div>
            </div>
          ) : (
            <InstitutionDetail
              key={active.id}
              institution={active}
              section={section}
              onSectionChange={setSection}
            />
          )}
        </div>
      </div>
    </section>
  );
}

function InstitutionDetail({
  institution,
  section,
  onSectionChange,
}: {
  institution: Institution;
  section: ExplorerSection;
  onSectionChange: (section: ExplorerSection) => void;
}) {
  const [athleteId, setAthleteId] = useState<string | undefined>();
  const athletes = useInstitutionAthletes(institution.id);
  const teams = useTeams(institution.id);
  const injured = (athletes.data ?? []).filter((athlete) => athlete.active_injuries > 0).length;

  return (
    <div className="space-y-4">
      <header className="rounded-2xl border bg-card p-4 sm:p-5">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {INSTITUTION_TYPE_LABEL[institution.school_type] ?? institution.school_type}
          {institution.location ? ` · ${institution.location}` : ""}
          {institution.district ? ` · ${institution.district}` : ""}
        </p>
        <h3 className="mt-1 text-xl font-black">{institution.name}</h3>
        <div className="mt-4 grid grid-cols-3 gap-2">
          <Summary label="Athletes" value={athletes.data?.length ?? "—"} />
          <Summary label="Teams / classes" value={teams.data?.length ?? "—"} />
          <Summary label="Currently injured" value={athletes.data ? injured : "—"} />
        </div>
      </header>

      <nav aria-label={`${institution.name} sections`} className="flex flex-wrap gap-2">
        {SECTION_BUTTONS.map(({ value, label, icon: Icon }) => (
          <Button
            key={value}
            size="sm"
            variant={section === value ? "default" : "outline"}
            aria-pressed={section === value}
            onClick={() => onSectionChange(value)}
          >
            <Icon className="mr-1.5 size-4" />
            {label}
          </Button>
        ))}
      </nav>

      {section === "athletes" && (
        <AthletesPanel
          school={institution.id}
          perms={STAFF_PERMISSIONS}
          athleteId={athleteId}
          onOpen={setAthleteId}
        />
      )}
      {section === "teams" && <TeamsPanel school={institution.id} perms={STAFF_PERMISSIONS} />}
      {section === "trends" && (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">
            Filter by team, sport, date range, athlete, severity, and recovery status. Individual
            records remain governed by the existing VITO staff access controls.
          </p>
          <InjuriesPanel
            school={institution.id}
            schoolName={institution.name}
            perms={STAFF_PERMISSIONS}
            mode="surveillance"
          />
        </div>
      )}
    </div>
  );
}

function Summary({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-xl bg-secondary/60 p-3">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 text-xl font-black tabular-nums">{value}</p>
    </div>
  );
}
