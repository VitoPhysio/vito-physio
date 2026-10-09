import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { selectClass } from "./SimpleForm";

type Target = "person" | "athlete" | "school" | "group";

export function Inbox({ userId }: { userId: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ["inbox", userId],
    queryFn: async () => {
      const { data: msgs, error } = await supabase
        .from("communications")
        .select(
          "id, sender_id, subject, body, audience, created_at, athletes(athlete_code, first_name, surname), schools(name)",
        )
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      const ids = [...new Set((msgs ?? []).map((m) => m.sender_id))];
      const { data: names } = ids.length
        ? await supabase.rpc("get_sender_names", { _ids: ids })
        : { data: [] };
      const map = new Map((names ?? []).map((n) => [n.id, n]));
      return (msgs ?? []).map((m) => {
        const n = map.get(m.sender_id);
        return {
          ...m,
          sender: n?.is_admin ? "VITO administration (admin)" : (n?.full_name ?? "VITO clinician"),
          mine: m.sender_id === userId,
        };
      });
    },
  });

  if (isLoading) return <p className="text-sm text-muted-foreground">Loading messages…</p>;
  if (!data?.length) return <p className="text-sm text-muted-foreground">No messages yet.</p>;
  return (
    <ul className="space-y-3">
      {data.map((m) => (
        <li key={m.id} className="rounded-xl border bg-card p-4">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
            <span className="font-semibold text-primary">{m.mine ? "You (sent)" : m.sender}</span>
            <span>{new Date(m.created_at).toLocaleString()}</span>
          </div>
          {(m.audience || m.athletes || m.schools) && (
            <p className="mt-1 text-xs text-accent">
              To:{" "}
              {m.audience
                ? `All ${m.audience}`
                : m.athletes
                  ? `${m.athletes.first_name} ${m.athletes.surname} (${m.athletes.athlete_code})`
                  : m.schools?.name}
            </p>
          )}
          {m.subject && <p className="mt-2 font-semibold text-foreground">{m.subject}</p>}
          <p className="mt-1 whitespace-pre-wrap text-sm text-foreground">{m.body}</p>
        </li>
      ))}
    </ul>
  );
}

export function Compose({
  userId,
  athleteId,
  schoolId,
  defaultSubject,
  staffOnly = false,
}: {
  userId: string;
  athleteId?: string;
  schoolId?: string | null;
  defaultSubject?: string;
  staffOnly?: boolean;
}) {
  const qc = useQueryClient();
  const [target, setTarget] = useState<Target>(athleteId ? "athlete" : "person");
  const [recipient, setRecipient] = useState("");
  const [athlete, setAthlete] = useState(athleteId ?? "");
  const [school, setSchool] = useState(schoolId ?? "");
  const [audience, setAudience] = useState("everyone");
  const [subject, setSubject] = useState(defaultSubject ?? "");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);

  const { data: lists } = useQuery({
    queryKey: ["compose-lists", staffOnly],
    queryFn: async () => {
      const [p, a, s, r] = await Promise.all([
        supabase.from("profiles").select("id, full_name, email").order("full_name"),
        supabase.from("athletes").select("id, first_name, surname, athlete_code").order("surname"),
        supabase.from("schools").select("id, name, school_code").order("name"),
        staffOnly
          ? supabase.from("user_roles").select("user_id, role")
          : Promise.resolve({ data: [] as { user_id: string; role: string }[] }),
      ]);
      const staffIds = new Set(
        (r.data ?? [])
          .filter((role) =>
            ["super_admin", "vito_admin", "clinical_professional", "clinical_supervisor"].includes(
              role.role,
            ),
          )
          .map((role) => role.user_id),
      );
      return {
        people: staffOnly
          ? (p.data ?? []).filter((person) => staffIds.has(person.id))
          : (p.data ?? []),
        athletes: a.data ?? [],
        schools: s.data ?? [],
      };
    },
  });

  async function send() {
    if (!body.trim()) {
      toast.error("Write a message first.");
      return;
    }
    const row = {
      sender_id: userId,
      subject: subject.trim() || null,
      body: body.trim(),
      recipient_id: target === "person" ? recipient || null : null,
      athlete_id: target === "athlete" ? athlete || null : null,
      school_id: target === "school" ? school || null : null,
      audience: target === "group" ? audience : null,
    };
    if (!row.recipient_id && !row.athlete_id && !row.school_id && !row.audience) {
      toast.error("Choose who receives this.");
      return;
    }
    setBusy(true);
    const { error } = await supabase.from("communications").insert(row);
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Message sent");
    setBody("");
    qc.invalidateQueries({ queryKey: ["inbox"] });
  }

  const tabs: { v: Target; l: string }[] = [
    { v: "person", l: "One person" },
    { v: "athlete", l: "Athlete" },
    { v: "school", l: "School" },
    { v: "group", l: "General group" },
  ];

  return (
    <div className="space-y-3 rounded-xl border bg-card p-4">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {tabs.map((t) => (
          <Button
            key={t.v}
            type="button"
            size="sm"
            variant={target === t.v ? "default" : "outline"}
            onClick={() => setTarget(t.v)}
          >
            {t.l}
          </Button>
        ))}
      </div>
      {target === "person" && (
        <select
          className={selectClass}
          value={recipient}
          onChange={(e) => setRecipient(e.target.value)}
        >
          <option value="">Choose a user…</option>
          {lists?.people
            .filter((p) => p.id !== userId)
            .map((p) => (
              <option key={p.id} value={p.id}>
                {p.full_name ?? p.email} — {p.email}
              </option>
            ))}
        </select>
      )}
      {target === "athlete" && (
        <select
          className={selectClass}
          value={athlete}
          onChange={(e) => setAthlete(e.target.value)}
        >
          <option value="">Choose an athlete…</option>
          {lists?.athletes.map((a) => (
            <option key={a.id} value={a.id}>
              {a.first_name} {a.surname} ({a.athlete_code})
            </option>
          ))}
        </select>
      )}
      {target === "school" && (
        <select className={selectClass} value={school} onChange={(e) => setSchool(e.target.value)}>
          <option value="">Choose a school / academy / club…</option>
          {lists?.schools.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name} ({s.school_code})
            </option>
          ))}
        </select>
      )}
      {target === "group" && (
        <select
          className={selectClass}
          value={audience}
          onChange={(e) => setAudience(e.target.value)}
        >
          <option value="everyone">Everyone</option>
          <option value="clinicians">All VITO staff & clinicians</option>
          <option value="schools">All school admins & coaches</option>
          <option value="athletes">All athletes & parents</option>
        </select>
      )}
      <div className="space-y-1">
        <Label>Subject</Label>
        <Input value={subject} onChange={(e) => setSubject(e.target.value)} />
      </div>
      <div className="space-y-1">
        <Label>Message ({body.length}/4000)</Label>
        <Textarea
          rows={4}
          maxLength={4000}
          value={body}
          onChange={(e) => setBody(e.target.value)}
        />
      </div>
      <Button onClick={send} disabled={busy} className="w-full sm:w-auto">
        {busy ? "Sending…" : "Send message"}
      </Button>
    </div>
  );
}
