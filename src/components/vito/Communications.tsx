import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { selectClass } from "./SimpleForm";

import { Link } from "@tanstack/react-router";
import { workspaceSenderName } from "@/lib/workspace-messaging";

type Target = "person" | "athlete" | "school" | "group";

export function Inbox({ userId }: { userId: string }) {
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: ["messages", userId, "workspace-summary"],
    queryFn: async () => {
      const { data: memberships, error: membershipError } = await supabase
        .from("conversation_participants").select("conversation_id,last_read_at").eq("user_id", userId);
      if (membershipError) throw membershipError;
      const ids = (memberships ?? []).map((m) => m.conversation_id);
      if (!ids.length) return [];
      const { data: threads, error: threadError } = await supabase.from("conversations")
        .select("id,last_message_at").eq("kind", "workspace").in("id", ids)
        .order("last_message_at", { ascending: false }).limit(10);
      if (threadError) throw threadError;
      if (!threads?.length) return [];
      const summaries = await Promise.all(threads.map(async (thread) => {
        const [messageResult, participantResult] = await Promise.all([
          supabase.from("messages").select("sender_id,body,created_at,deleted_at").eq("conversation_id", thread.id).order("created_at", { ascending: false }).limit(1).maybeSingle(),
          supabase.from("conversation_participants").select("user_id").eq("conversation_id", thread.id).neq("user_id", userId),
        ]);
        if (messageResult.error) throw messageResult.error;
        if (participantResult.error) throw participantResult.error;
        return { ...thread, message: messageResult.data, others: (participantResult.data ?? []).map((x) => x.user_id) };
      }));
      const people = [...new Set(summaries.flatMap((s) => [...s.others, ...(s.message ? [s.message.sender_id] : [])]))];
      const { data: names, error: nameError } = await supabase.rpc("get_sender_names", { _ids: people });
      if (nameError) throw nameError;
      const map = new Map((names ?? []).map((n) => [n.id, n]));
      return summaries.map((s) => {
        const sender = s.message ? map.get(s.message.sender_id) : undefined;
        const lastRead = memberships?.find((m) => m.conversation_id === s.id)?.last_read_at;
        return {
          ...s,
          name: s.others.map((id) => { const n = map.get(id); return workspaceSenderName(n?.full_name, n?.is_admin ?? false); }).join(", ") || "Workspace conversation",
          sender: s.message?.sender_id === userId ? "You" : workspaceSenderName(sender?.full_name, sender?.is_admin ?? false),
          unread: Boolean(s.message && s.message.sender_id !== userId && (!lastRead || s.message.created_at > lastRead)),
        };
      });
    },
    staleTime: 5000,
  });
  useEffect(() => {
    const channel = supabase.channel(`workspace-summary-${userId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "messages" }, () => {
        void qc.invalidateQueries({ queryKey: ["messages", userId] });
      }).subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [userId, qc]);
  if (query.isLoading) return <p className="text-sm text-muted-foreground">Loading workspace messages…</p>;
  if (query.error) return <div role="alert"><p className="text-sm text-destructive">Workspace messages could not be loaded.</p><Button size="sm" variant="outline" onClick={() => void query.refetch()}>Retry</Button></div>;
  if (!query.data?.length) return <p className="text-sm text-muted-foreground">No workspace conversations yet.</p>;
  return <ul className="divide-y">
    {query.data.map((thread) => <li key={thread.id} className="flex min-w-0 flex-wrap items-center gap-3 py-3">
      <div className="min-w-0 flex-1">
        <p className="break-words text-sm font-semibold">{thread.name}{thread.unread && <span className="ml-2 text-xs text-primary">New</span>}</p>
        <p className="truncate text-sm text-muted-foreground">{thread.message ? `${thread.sender}: ${thread.message.deleted_at ? "Message deleted" : thread.message.body}` : "No messages yet"}</p>
        <p className="text-xs text-muted-foreground">{new Date(thread.last_message_at).toLocaleString()}</p>
      </div>
      <Button asChild size="sm" variant="outline"><Link to="/messages" search={{ conversation: thread.id, box: "workspace" }}>Open & reply</Link></Button>
    </li>)}
  </ul>;
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
    toast.success("Message sent — replies will arrive in your Workspace inbox");
    setBody("");
    qc.invalidateQueries({ queryKey: ["messages", userId] });
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
        <Label>Message ({body.length}/3700)</Label>
        <Textarea
          rows={4}
          maxLength={3700}
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
