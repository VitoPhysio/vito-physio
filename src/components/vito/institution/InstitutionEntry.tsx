import { useEffect, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Building2, Plus, Search, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PhotoAvatar } from "@/components/vito/Photo";
import { VitoLoadingMark } from "@/components/vito/VitoBrandLockup";
import { InstitutionForm } from "@/components/vito/institution/InstitutionForm";
import {
  INSTITUTION_ROLE_LABEL,
  INSTITUTION_TYPE_LABEL,
  LAST_INSTITUTION_KEY,
  orderByLastOpened,
  type InstitutionRole,
} from "@/lib/institution";

export function useMyInstitutions() {
  return useQuery({
    queryKey: ["my-institutions"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("my_institutions");
      if (error) throw error;
      return data ?? [];
    },
  });
}

function VerificationBadge({ status }: { status: string }) {
  if (status === "verified")
    return (
      <Badge variant="secondary" className="gap-1">
        <ShieldCheck className="size-3" /> Verified
      </Badge>
    );
  return <Badge variant="outline">Verification pending</Badge>;
}

/** Workspace entry: choose an institution, or join / register one. */
export function InstitutionEntry({ addMode }: { addMode: boolean }) {
  const { data: institutions, isLoading, error } = useMyInstitutions();
  const navigate = useNavigate();

  function open(id: string) {
    localStorage.setItem(LAST_INSTITUTION_KEY, id);
    void navigate({ to: "/workspace/$institutionId", params: { institutionId: id } });
  }

  if (isLoading)
    return (
      <div className="grid min-h-[50vh] place-items-center">
        <VitoLoadingMark />
      </div>
    );
  if (error) return <p className="p-6 text-destructive">Could not load your institutions: {error.message}</p>;

  const list = orderByLastOpened(institutions ?? [], typeof window === "undefined" ? null : localStorage.getItem(LAST_INSTITUTION_KEY));
  const showChooser = list.length > 0 && !addMode;

  return (
    <main className="mx-auto max-w-4xl space-y-6 px-4 py-8">
      <header className="space-y-1">
        <p className="text-xs font-bold uppercase tracking-[0.12em] text-accent">Institutional workspace</p>
        <h1 className="text-2xl font-black tracking-tight sm:text-3xl">
          {showChooser ? "Choose an institution" : "Connect to your institution"}
        </h1>
        <p className="text-sm text-muted-foreground">
          {showChooser
            ? "Open the school, club or academy you want to manage. You can switch at any time."
            : "Join an existing school, club or academy, or register a new one."}
        </p>
      </header>

      {showChooser ? (
        <>
          <ul className="grid gap-3 sm:grid-cols-2">
            {list.map((inst) => (
              <li key={inst.id}>
                <button
                  type="button"
                  onClick={() => open(inst.id)}
                  className="flex w-full items-center gap-3 rounded-2xl border bg-card p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-primary/50"
                >
                  <PhotoAvatar path={inst.logo_path} name={inst.name} className="size-12" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-bold">{inst.name}</span>
                    <span className="block text-xs text-muted-foreground">
                      {INSTITUTION_TYPE_LABEL[inst.school_type] ?? inst.school_type}
                      {inst.district || inst.location ? ` · ${inst.district || inst.location}` : ""}
                    </span>
                    <span className="mt-1 flex flex-wrap gap-1">
                      <Badge>{INSTITUTION_ROLE_LABEL[inst.role as InstitutionRole] ?? inst.role}</Badge>
                      <VerificationBadge status={inst.verification_status} />
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
          <Button asChild variant="outline">
            <Link to="/workspace" search={{ add: true }}>
              <Plus className="mr-2 size-4" /> Join or register another institution
            </Link>
          </Button>
        </>
      ) : (
        <JoinOrRegister onRegistered={open} canGoBack={list.length > 0} />
      )}
    </main>
  );
}

function JoinOrRegister({ onRegistered, canGoBack }: { onRegistered: (id: string) => void; canGoBack: boolean }) {
  const queryClient = useQueryClient();
  return (
    <div className="space-y-4">
      {canGoBack && (
        <Button asChild variant="ghost" size="sm">
          <Link to="/workspace">← Back to my institutions</Link>
        </Button>
      )}
      <Tabs defaultValue="join">
        <TabsList>
          <TabsTrigger value="join">
            <Search className="mr-2 size-4" /> Join existing
          </TabsTrigger>
          <TabsTrigger value="register">
            <Building2 className="mr-2 size-4" /> Register new
          </TabsTrigger>
        </TabsList>
        <TabsContent value="join" className="pt-4">
          <JoinInstitution />
        </TabsContent>
        <TabsContent value="register" className="rounded-2xl border bg-card p-4 sm:p-6">
          <p className="mb-4 text-sm text-muted-foreground">
            You become the administrator of the institution you register. VITO verifies new institutions.
          </p>
          <InstitutionForm
            mode="register"
            submitLabel="Register institution"
            onSubmit={async (v) => {
              const { data, error } = await supabase.rpc("register_institution", {
                _name: v.name,
                _type: v.type,
                _location: v.location,
                _district: v.district,
                _sports: v.sports,
                _phone: v.phone,
                _email: v.email,
                _notes: v.notes,
                // The database accepts null to keep the current logo.
                _logo_path: v.logoPath as string,
              });
              if (error) throw new Error(error.message);
              await queryClient.invalidateQueries({ queryKey: ["my-institutions"] });
              toast.success("Institution registered");
              onRegistered(data as string);
            }}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function JoinInstitution() {
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const [role, setRole] = useState<InstitutionRole>("coach");
  const queryClient = useQueryClient();

  useEffect(() => {
    const t = setTimeout(() => setDebounced(query), 300);
    return () => clearTimeout(t);
  }, [query]);

  const { data, isLoading, error } = useQuery({
    queryKey: ["search-institutions", debounced],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("search_institutions", { _q: debounced });
      if (error) throw error;
      return data ?? [];
    },
  });

  async function request(id: string) {
    const { error } = await supabase.rpc("request_institution_membership", { _school: id, _role: role });
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Request sent. The institution administrator will review it.");
    await queryClient.invalidateQueries({ queryKey: ["search-institutions"] });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row">
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search schools, clubs and academies by name or district"
          aria-label="Search institutions"
        />
        <select
          value={role}
          onChange={(e) => setRole(e.target.value as InstitutionRole)}
          aria-label="Join as"
          className="h-9 rounded-md border border-input bg-background px-3 text-sm"
        >
          <option value="coach">Join as coach</option>
          <option value="school_admin">Join as administrator</option>
        </select>
      </div>
      {isLoading && <p className="text-sm text-muted-foreground">Searching…</p>}
      {error && <p className="text-sm text-destructive">{error.message}</p>}
      {data && data.length === 0 && (
        <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
          No institution found. You can register it instead.
        </p>
      )}
      <ul className="grid gap-3">
        {data?.map((inst) => (
          <li key={inst.id} className="flex flex-wrap items-center gap-3 rounded-2xl border bg-card p-4">
            <PhotoAvatar path={inst.logo_path} name={inst.name} className="size-11" />
            <div className="min-w-0 flex-1">
              <p className="truncate font-bold">{inst.name}</p>
              <p className="text-xs text-muted-foreground">
                {INSTITUTION_TYPE_LABEL[inst.school_type] ?? inst.school_type}
                {inst.district || inst.location ? ` · ${inst.district || inst.location}` : ""}
                {inst.admin_name ? ` · Administrator: ${inst.admin_name}` : " · No administrator yet"}
              </p>
            </div>
            {inst.is_member ? (
              <Badge>Member</Badge>
            ) : inst.my_request_status === "pending" ? (
              <Badge variant="outline">Request pending</Badge>
            ) : (
              <Button size="sm" onClick={() => request(inst.id)}>
                {inst.my_request_status === "rejected" ? "Request again" : "Request to join"}
              </Button>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
