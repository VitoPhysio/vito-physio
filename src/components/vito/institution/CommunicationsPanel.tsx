import { useMemo, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { MessageCircle, Send } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PhotoAvatar } from "@/components/vito/Photo";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { institutionPermissions, MESSAGE_KIND_LABEL } from "@/lib/institution";
import { fullName, instRpc, LoadError, Loading, Panel, selectCls, useInstitutionAthletes, useTeams } from "./shared";

type Contact = { user_id: string; full_name: string | null; avatar_path: string | null; relation: string; detail: string | null };

const RELATION_LABEL: Record<string, string> = {
  administrator: "Institution administrator",
  coach: "Coach",
  athlete: "Athlete",
  guardian: "Guardian",
  vito_admin: "VITO administration",
  clinician: "VITO clinician",
};
const RELATION_ORDER = ["vito_admin", "clinician", "administrator", "coach", "athlete", "guardian"];

type Batch = { batch_id: string; kind: string; subject: string | null; body: string; target: string; recipients: number; sender_name: string | null; mine: boolean; created_at: string };

export function CommunicationsPanel({ school, perms }: { school: string; perms: ReturnType<typeof institutionPermissions> }) {
  const qc = useQueryClient();
  const history = useQuery({ queryKey: ["inst-comms", school], queryFn: () => instRpc<Batch[]>("institution_communications", { _school: school }) });
  const { data: teams = [] } = useTeams(school);
  const { data: athletes = [] } = useInstitutionAthletes(school);
  const [f, setF] = useState({ target: perms.messageEveryone ? "all" : "team", team: "", athlete: "", kind: "message", subject: "", body: "" });
  const [busy, setBusy] = useState(false);
  async function send() {
    if (f.target === "team" && !f.team) return void toast.error("Choose a team.");
    if (f.target === "athlete" && !f.athlete) return void toast.error("Choose an athlete.");
    if (!f.body.trim()) return void toast.error("Write a message.");
    setBusy(true);
    try {
      const res = await instRpc<{ recipients: number; notified: number }>("institution_send_message", {
        _school: school, _target: f.target, _team: f.target === "team" ? f.team : null, _athlete: f.target === "athlete" ? f.athlete : null,
        _kind: f.kind, _subject: f.subject, _body: f.body,
      });
      toast.success(`Sent to ${res.recipients} athlete${res.recipients === 1 ? "" : "s"}${res.notified ? ` · ${res.notified} phone alerts` : ""}`);
      setF({ ...f, subject: "", body: "" });
      void qc.invalidateQueries({ queryKey: ["inst-comms", school] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not send");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="space-y-4">
    <ContactsPanel school={school} />
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
      <Panel title="New message">
        <div className="grid gap-3">
          <div className="grid grid-cols-2 gap-3">
            <Label className="grid gap-1">To
              <select className={selectCls} value={f.target} onChange={(e) => setF({ ...f, target: e.target.value })}>
                {perms.messageEveryone && <option value="all">All athletes</option>}
                <option value="team">A team</option>
                <option value="athlete">One athlete</option>
              </select>
            </Label>
            <Label className="grid gap-1">Type
              <select className={selectCls} value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value })}>
                {Object.entries(MESSAGE_KIND_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </Label>
          </div>
          {f.target === "team" && (
            <Label className="grid gap-1">Team
              <select className={selectCls} value={f.team} onChange={(e) => setF({ ...f, team: e.target.value })}>
                <option value="">Choose team</option>
                {teams.map((t) => <option key={t.id} value={t.id}>{t.name} ({t.athlete_ids.length})</option>)}
              </select>
            </Label>
          )}
          {f.target === "athlete" && (
            <Label className="grid gap-1">Athlete
              <select className={selectCls} value={f.athlete} onChange={(e) => setF({ ...f, athlete: e.target.value })}>
                <option value="">Choose athlete</option>
                {athletes.map((a) => <option key={a.id} value={a.id}>{fullName(a)}</option>)}
              </select>
            </Label>
          )}
          <Label className="grid gap-1">Subject (optional)<Input maxLength={200} value={f.subject} onChange={(e) => setF({ ...f, subject: e.target.value })} /></Label>
          <Label className="grid gap-1">Message<Textarea rows={5} maxLength={3700} value={f.body} onChange={(e) => setF({ ...f, body: e.target.value })} /></Label>
          <Button onClick={send} disabled={busy}><Send className="size-4" /> {busy ? "Sending…" : "Send"}</Button>
          <p className="text-xs text-muted-foreground">
            Athletes with their own account and their guardians receive this in Messages and can reply to you there.{" "}
            <Link to="/messages" className="font-semibold text-primary underline-offset-2 hover:underline">Open Messages</Link>
          </p>
        </div>
      </Panel>
      <Panel title={perms.messageEveryone ? "Sent messages" : "Messages you sent"}>
        {history.isLoading ? <Loading what="messages" /> : history.error ? <LoadError error={history.error} /> : !history.data?.length ? (
          <p className="text-sm text-muted-foreground">No messages sent yet.</p>
        ) : (
          <ul className="space-y-3">
            {history.data.map((m) => (
              <li key={m.batch_id} className="rounded-xl border p-3 text-sm">
                <p className="text-xs text-muted-foreground">{MESSAGE_KIND_LABEL[m.kind] ?? "Message"} · to {m.target} ({m.recipients}) · {m.sender_name ?? "Member"} · {new Date(m.created_at).toLocaleString()}</p>
                {m.subject && <p className="font-semibold">{m.subject}</p>}
                <p className="whitespace-pre-wrap">{m.body}</p>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
    </div>
  );
}

function ContactsPanel({ school }: { school: string }) {
  const navigate = useNavigate();
  const contacts = useQuery({ queryKey: ["inst-contacts", school], queryFn: () => instRpc<Contact[]>("institution_contacts", { _school: school }) });
  const [q, setQ] = useState("");
  const [relation, setRelation] = useState("all");
  const [opening, setOpening] = useState<string | null>(null);
  const list = useMemo(() => {
    const term = q.trim().toLowerCase();
    return (contacts.data ?? [])
      .filter((c) => relation === "all" || c.relation === relation)
      .filter((c) => !term || `${c.full_name ?? ""} ${c.detail ?? ""}`.toLowerCase().includes(term))
      .sort((a, b) => RELATION_ORDER.indexOf(a.relation) - RELATION_ORDER.indexOf(b.relation) || (a.full_name ?? "").localeCompare(b.full_name ?? ""));
  }, [contacts.data, q, relation]);

  async function openChat(userId: string) {
    setOpening(userId);
    const { data, error } = await supabase.rpc("create_direct_conversation", { _other_user: userId });
    setOpening(null);
    if (error || !data) return void toast.error(error?.message ?? "Could not open the chat");
    void navigate({ to: "/messages", search: { conversation: data } });
  }

  return (
    <Panel title="Chat directly" action={<Link to="/messages" className="text-sm font-semibold text-primary">Open Messages</Link>}>
      <p className="mb-3 text-sm text-muted-foreground">
        Start a private two-way chat with VITO administration, clinicians, your colleagues, athletes or guardians. Replies arrive in Messages.
      </p>
      <div className="mb-3 flex flex-wrap gap-2">
        <Input className="h-9 max-w-xs" placeholder="Search people" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search people" />
        <select aria-label="Filter people" className={selectCls} value={relation} onChange={(e) => setRelation(e.target.value)}>
          <option value="all">Everyone</option>
          {RELATION_ORDER.map((r) => <option key={r} value={r}>{RELATION_LABEL[r]}</option>)}
        </select>
      </div>
      {contacts.isLoading ? <Loading what="people" /> : contacts.error ? <LoadError error={contacts.error} /> : !list.length ? (
        <p className="text-sm text-muted-foreground">No one matches.</p>
      ) : (
        <ul className="grid max-h-80 gap-2 overflow-y-auto sm:grid-cols-2">
          {list.map((c) => (
            <li key={c.user_id} className="flex min-w-0 items-center gap-3 rounded-xl border p-2">
              <PhotoAvatar path={c.avatar_path} name={c.full_name ?? "Member"} className="size-9" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{c.full_name ?? "Member"}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {RELATION_LABEL[c.relation] ?? c.relation}{c.detail ? (c.relation === "guardian" ? ` of ${c.detail}` : "") : ""}
                </p>
              </div>
              <Button size="sm" variant="outline" disabled={opening === c.user_id} onClick={() => void openChat(c.user_id)} aria-label={`Chat with ${c.full_name ?? "member"}`}>
                <MessageCircle className="size-4" /> Chat
              </Button>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}
