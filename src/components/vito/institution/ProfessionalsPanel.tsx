import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Search } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { PhotoAvatar } from "@/components/vito/Photo";
import { institutionPermissions, PROFESSIONAL_SPECIALTIES, REFERRAL_STATUS_LABEL, SHARING_SCOPES } from "@/lib/institution";
import { fmtDate, fullName, instRpc, LoadError, Loading, Panel, selectCls, StatusPill, useInstitutionAthletes } from "./shared";

type Pro = { id: string; full_name: string | null; avatar_path: string | null; headline: string | null; district: string | null; specialty: string | null };
type Referral = {
  id: string; referral_code: string; athlete_name: string; professional_name: string; reason: string | null; purpose: string | null; scopes: string[];
  priority: string | null; status: string; consent_status: string; consent_name: string | null; feedback: string | null; requested_by_name: string | null; mine: boolean; created_at: string;
};
const CONSENT_LABEL: Record<string, string> = { pending: "Consent pending", granted: "Consent given", declined: "Consent refused", revoked: "Consent withdrawn" };

export function ProfessionalsPanel({ school, perms }: { school: string; perms: ReturnType<typeof institutionPermissions> }) {
  const [q, setQ] = useState("");
  const [specialty, setSpecialty] = useState("");
  const [referTo, setReferTo] = useState<Pro | null>(null);
  const pros = useQuery({ queryKey: ["pros", q, specialty], queryFn: () => instRpc<Pro[]>("list_professionals", { _q: q, _specialty: specialty, _district: "" }) });
  const refs = useQuery({ queryKey: ["inst-referrals", school], queryFn: () => instRpc<Referral[]>("institution_referrals", { _school: school }) });
  const qc = useQueryClient();
  const reload = () => void qc.invalidateQueries({ queryKey: ["inst-referrals", school] });
  return (
    <div className="space-y-4">
      <Panel title="Find a professional">
        <div className="mb-3 flex flex-wrap gap-2">
          <div className="relative min-w-[12rem] flex-1">
            <Search className="absolute left-2 top-2.5 size-4 text-muted-foreground" />
            <Input className="pl-8" placeholder="Search by name or district" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <select className={selectCls} value={specialty} onChange={(e) => setSpecialty(e.target.value)}>
            <option value="">All specialties</option>
            {PROFESSIONAL_SPECIALTIES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        {pros.isLoading ? <Loading what="professionals" /> : pros.error ? <LoadError error={pros.error} /> : !pros.data?.length ? (
          <p className="text-sm text-muted-foreground">No registered professionals match.</p>
        ) : (
          <ul className="grid gap-2 md:grid-cols-2">
            {pros.data.map((p) => (
              <li key={p.id} className="flex items-center gap-3 rounded-xl border p-3">
                <PhotoAvatar path={p.avatar_path} name={p.full_name ?? "Professional"} className="size-10" />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{p.full_name ?? "Professional"}</p>
                  <p className="truncate text-xs text-muted-foreground">{[p.specialty, p.district].filter(Boolean).join(" · ") || p.headline}</p>
                </div>
                {perms.referAthletes && <Button size="sm" onClick={() => setReferTo(p)}>Refer</Button>}
              </li>
            ))}
          </ul>
        )}
      </Panel>
      <Panel title="Referrals">
        {refs.isLoading ? <Loading what="referrals" /> : refs.error ? <LoadError error={refs.error} /> : !refs.data?.length ? (
          <p className="text-sm text-muted-foreground">No referrals yet.</p>
        ) : (
          <ul className="space-y-3">
            {refs.data.map((r) => <ReferralRow key={r.id} r={r} perms={perms} onChange={reload} />)}
          </ul>
        )}
      </Panel>
      {referTo && <ReferDialog school={school} pro={referTo} onClose={() => { setReferTo(null); reload(); }} />}
    </div>
  );
}

function ReferralRow({ r, perms, onChange }: { r: Referral; perms: ReturnType<typeof institutionPermissions>; onChange: () => void }) {
  const [consentOpen, setConsentOpen] = useState(false);
  const open = !["completed", "cancelled"].includes(r.status);
  async function cancel() {
    if (!confirm("Cancel this referral? Shared access ends immediately.")) return;
    try { await instRpc("institution_cancel_referral", { _referral: r.id }); onChange(); } catch (e) { toast.error(e instanceof Error ? e.message : "Could not cancel"); }
  }
  return (
    <li className="rounded-xl border p-3 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-semibold">{r.athlete_name} → {r.professional_name}</p>
        <div className="flex flex-wrap gap-1">
          <StatusPill tone={r.consent_status === "granted" ? "good" : r.consent_status === "pending" ? "warn" : "bad"}>{CONSENT_LABEL[r.consent_status] ?? r.consent_status}</StatusPill>
          <StatusPill tone="info">{REFERRAL_STATUS_LABEL[r.status] ?? r.status}</StatusPill>
        </div>
      </div>
      <p className="text-xs text-muted-foreground">{r.referral_code} · {fmtDate(r.created_at)} · {r.priority ?? "routine"} · by {r.requested_by_name ?? "member"}</p>
      {r.purpose && <p className="mt-1">Purpose: {r.purpose}</p>}
      <p className="text-xs text-muted-foreground">Shares: {r.scopes.map((s) => SHARING_SCOPES.find((x) => x.value === s)?.label ?? s).join(", ")}</p>
      {r.feedback && <p className="mt-1 rounded-md bg-muted p-2">Professional feedback: {r.feedback}</p>}
      {open && (
        <div className="mt-2 flex flex-wrap gap-2">
          {perms.manageMembers && r.consent_status === "pending" && <Button size="sm" variant="outline" onClick={() => setConsentOpen(true)}>Record consent</Button>}
          {(perms.manageMembers || r.mine) && <Button size="sm" variant="ghost" onClick={() => void cancel()}>Cancel referral</Button>}
        </div>
      )}
      {consentOpen && <ConsentDialog referralId={r.id} onClose={() => { setConsentOpen(false); onChange(); }} />}
    </li>
  );
}

function ConsentDialog({ referralId, onClose }: { referralId: string; onClose: () => void }) {
  const [f, setF] = useState({ consenter: "", relationship: "guardian", method: "written", granted: "yes" });
  const [busy, setBusy] = useState(false);
  async function save() {
    setBusy(true);
    try {
      await instRpc("institution_record_consent", { _referral: referralId, _consenter: f.consenter, _relationship: f.relationship, _method: f.method, _granted: f.granted === "yes" });
      toast.success("Consent recorded");
      onClose();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Could not record consent"); } finally { setBusy(false); }
  }
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Record consent given outside the app</DialogTitle></DialogHeader>
        <div className="grid gap-3">
          <Label className="grid gap-1">Name of person giving consent<Input value={f.consenter} onChange={(e) => setF({ ...f, consenter: e.target.value })} /></Label>
          <div className="grid grid-cols-3 gap-2">
            <Label className="grid gap-1">Relationship<select className={selectCls} value={f.relationship} onChange={(e) => setF({ ...f, relationship: e.target.value })}><option value="guardian">Guardian</option><option value="parent">Parent</option><option value="athlete">Athlete</option></select></Label>
            <Label className="grid gap-1">How<select className={selectCls} value={f.method} onChange={(e) => setF({ ...f, method: e.target.value })}><option value="written">Written</option><option value="verbal">Verbal</option></select></Label>
            <Label className="grid gap-1">Answer<select className={selectCls} value={f.granted} onChange={(e) => setF({ ...f, granted: e.target.value })}><option value="yes">Agreed</option><option value="no">Refused</option></select></Label>
          </div>
          <Button onClick={save} disabled={busy}>{busy ? "Saving…" : "Save"}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ReferDialog({ school, pro, onClose }: { school: string; pro: Pro; onClose: () => void }) {
  const { data: athletes = [] } = useInstitutionAthletes(school);
  const [f, setF] = useState({ athlete: "", purpose: "", reason: "", priority: "routine" });
  const [scopes, setScopes] = useState<Set<string>>(new Set(["participation", "injury_summary"]));
  const [busy, setBusy] = useState(false);
  async function send() {
    if (!f.athlete) return void toast.error("Choose an athlete.");
    setBusy(true);
    try {
      await instRpc("institution_create_referral", { _school: school, _athlete: f.athlete, _injury: null, _professional: pro.id, _purpose: f.purpose, _reason: f.reason, _priority: f.priority, _scopes: [...scopes] });
      toast.success("Referral created. Nothing is shared until consent is given.");
      onClose();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Could not create referral"); } finally { setBusy(false); }
  }
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Refer to {pro.full_name ?? "professional"}</DialogTitle></DialogHeader>
        <div className="grid gap-3">
          <Label className="grid gap-1">Athlete
            <select className={selectCls} value={f.athlete} onChange={(e) => setF({ ...f, athlete: e.target.value })}>
              <option value="">Choose athlete</option>
              {athletes.map((a) => <option key={a.id} value={a.id}>{fullName(a)} ({a.athlete_code})</option>)}
            </select>
          </Label>
          <Label className="grid gap-1">Purpose of sharing<Input value={f.purpose} onChange={(e) => setF({ ...f, purpose: e.target.value })} placeholder="e.g. Assessment of recurring knee pain" /></Label>
          <Label className="grid gap-1">Reason / notes<Textarea value={f.reason} onChange={(e) => setF({ ...f, reason: e.target.value })} /></Label>
          <Label className="grid gap-1">Priority<select className={selectCls} value={f.priority} onChange={(e) => setF({ ...f, priority: e.target.value })}><option value="routine">Routine</option><option value="soon">Soon</option><option value="urgent">Urgent</option></select></Label>
          <fieldset className="grid gap-2">
            <legend className="text-sm font-medium">Information to share (after consent)</legend>
            {SHARING_SCOPES.map((s) => (
              <label key={s.value} className="flex items-start gap-2 text-sm">
                <input type="checkbox" className="mt-1" checked={scopes.has(s.value)} onChange={(e) => { const n = new Set(scopes); if (e.target.checked) n.add(s.value); else n.delete(s.value); setScopes(n); }} />
                <span><b>{s.label}</b><br /><span className="text-xs text-muted-foreground">{s.detail}</span></span>
              </label>
            ))}
          </fieldset>
          <p className="text-xs text-muted-foreground">The athlete's guardian is asked for consent. The professional sees nothing until consent is given.</p>
          <Button onClick={send} disabled={busy}>{busy ? "Sending…" : "Request consent and refer"}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
