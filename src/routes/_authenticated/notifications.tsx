import { createFileRoute } from "@tanstack/react-router";
import {
  Activity,
  ArrowLeft,
  Bell,
  CalendarDays,
  Check,
  CheckCheck,
  Dumbbell,
  FileText,
  HeartPulse,
  Mail,
  MessageCircle,
  MessageSquareText,
  MoreVertical,
  Paperclip,
  Phone,
  Search,
  Send,
  Smile,
  UserRound,
  Video,
} from "lucide-react";
import { useMemo, useState } from "react";
import type { LucideIcon } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useHealth, STAGE_LABEL } from "@/components/athlete/data";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/notifications")({
  component: NotificationsPage,
});

type NotificationData = {
  contact_name?: string;
  email?: string;
  phone?: string;
  organisation_type?: string;
  message?: string;
  sender?: string;
  sender_id?: string;
  subject?: string | null;
  audience?: string | null;
  recipient?: string | null;
  is_mine?: boolean;
  injury_id?: string;
  status?: string;
  source?: string;
};

type NotificationRow = {
  id: string;
  title: string;
  body: string;
  kind: string;
  data: NotificationData;
  read_at: string | null;
  created_at: string;
};

const ROLE_COPY: Record<
  string,
  { eyebrow: string; title: string; description: string; empty: string; icon: LucideIcon }
> = {
  athlete: {
    eyebrow: "Athlete care inbox",
    title: "Your care updates",
    description: "Recovery milestones, appointments and follow-ups in one place.",
    empty: "Your recovery updates will appear here as your care team records progress.",
    icon: Activity,
  },
  parent: {
    eyebrow: "Family care inbox",
    title: "Athlete care updates",
    description: "Stay close to the appointments, recovery milestones and follow-ups that matter.",
    empty: "Care updates for the athlete linked to your account will appear here.",
    icon: HeartPulse,
  },
  school_admin: {
    eyebrow: "School updates",
    title: "School communications",
    description: "Messages and care coordination updates connected to your school account.",
    empty: "School communications will appear here when VITO sends an update.",
    icon: FileText,
  },
  coach: {
    eyebrow: "Team updates",
    title: "Team communications",
    description: "Keep up with athlete care coordination and messages shared with coaches.",
    empty: "Team communications will appear here when VITO sends an update.",
    icon: Dumbbell,
  },
};

function NotificationsPage() {
  const [filter, setFilter] = useState<"all" | "messages" | "requests">("all");
  const { data: user } = useQuery({
    queryKey: ["notifications-user"],
    queryFn: async () => (await supabase.auth.getUser()).data.user,
  });
  const { data: role = "athlete" } = useQuery({
    queryKey: ["notifications-role", user?.id],
    enabled: Boolean(user),
    queryFn: async () => {
      const { data: roles } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user!.id);
      return roles?.[0]?.role ?? "athlete";
    },
  });
  const isCareViewer = role === "athlete" || role === "parent";
  const health = useHealth(user?.id ?? "", isCareViewer);
  const copy = ROLE_COPY[role] ?? {
    eyebrow: "VITO updates",
    title: "Notifications",
    description: "Messages and updates connected to your VITO Physio account.",
    empty: "Your VITO updates will appear here.",
    icon: Bell,
  };

  const {
    data: notifications = [],
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ["notifications", user?.id],
    enabled: Boolean(user),
    queryFn: async () => {
      const [{ data, error }, { data: messages }] = await Promise.all([
        supabase
          .from("notifications")
          .select("id,title,body,kind,data,read_at,created_at")
          .order("created_at", { ascending: false })
          .limit(50),
        supabase
          .from("communications")
          .select("id,sender_id,subject,body,audience,recipient_id,created_at")
          .order("created_at", { ascending: false })
          .limit(100),
      ]);
      if (error) throw error;
      const senderIds = [
        ...new Set((messages ?? []).map((message: { sender_id: string }) => message.sender_id)),
      ];
      const { data: senders } = senderIds.length
        ? await supabase.rpc("get_sender_names", { _ids: senderIds })
        : { data: [] };
      const senderMap = new Map(
        (senders ?? []).map((sender: { id: string; full_name?: string; is_admin?: boolean }) => [
          sender.id,
          sender.is_admin ? "VITO administration (admin)" : (sender.full_name ?? "VITO clinician"),
        ]),
      );
      const communicationNotifications: NotificationRow[] = (messages ?? []).map(
        (message: {
          id: string;
          sender_id: string;
          subject?: string | null;
          body: string;
          audience?: string | null;
          recipient_id?: string | null;
          created_at: string;
        }) => ({
          id: `communication-${message.id}`,
          title: message.subject || "New communication",
          body: `${senderMap.get(message.sender_id) ?? "VITO team"} sent a communication${message.audience ? ` to ${message.audience}` : ""}.`,
          kind: "communication",
          data: {
            sender: senderMap.get(message.sender_id),
            sender_id: message.sender_id,
            subject: message.subject,
            message: message.body,
            audience: message.audience,
            recipient: message.recipient_id,
            is_mine: message.sender_id === user?.id,
          },
          read_at: null,
          created_at: message.created_at,
        }),
      );
      const notificationRows: NotificationRow[] = (data ?? []).map((notification) => ({
        ...notification,
        data:
          typeof notification.data === "object" && notification.data !== null
            ? (notification.data as NotificationData)
            : {},
      }));
      return [...notificationRows, ...communicationNotifications].sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      );
    },
  });

  const careUpdates = useMemo<NotificationRow[]>(() => {
    if (!isCareViewer || !health.data) return [];
    const h = health.data;
    const timeline = h.timeline.slice(0, 8).map((item) => ({
      id: `care-${item.id}`,
      title: item.title,
      body: "A new update has been added to your VITO care record.",
      kind: "care_update",
      data: { injury_id: item.injury_id, status: item.kind },
      read_at: null,
      created_at: item.at,
    }));
    const appointments = h.upcoming.slice(0, 5).map((appointment) => ({
      id: `appointment-${appointment.id}`,
      title: "Upcoming appointment",
      body: appointment.purpose || "You have an upcoming VITO Physio appointment.",
      kind: "appointment",
      data: { injury_id: appointment.injury_id, status: appointment.status },
      read_at: null,
      created_at: appointment.scheduled_at,
    }));
    const followUps = h.dueFollowUps.slice(0, 5).map((followUp) => ({
      id: `follow-up-${followUp.injury_id}-${followUp.date}`,
      title: followUp.source,
      body: "A follow-up review is due for your care plan.",
      kind: "follow_up",
      data: { injury_id: followUp.injury_id, source: followUp.source },
      read_at: null,
      created_at: followUp.date,
    }));
    return [...timeline, ...appointments, ...followUps].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    );
  }, [health.data, isCareViewer]);

  const messages = notifications.filter((notification) => notification.kind === "communication");
  const requests = notifications.filter((notification) => notification.kind !== "communication");
  const messageGroups = useMemo(() => {
    const groups = new Map<string, { sender: string; items: NotificationRow[] }>();
    for (const message of messages) {
      const key = message.data.sender_id ?? message.data.sender ?? "vito-team";
      const existing = groups.get(key);
      if (existing) existing.items.push(message);
      else groups.set(key, { sender: message.data.sender ?? "VITO team", items: [message] });
    }
    return [...groups.values()];
  }, [messages]);

  async function markRead(id: string) {
    await supabase.from("notifications").update({ read_at: new Date().toISOString() }).eq("id", id);
    await refetch();
  }

  const Icon = copy.icon;

  return (
    <main className="min-h-[calc(100vh-4rem)] bg-background">
      <div className="mx-auto max-w-4xl space-y-6 px-5 py-8">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-accent">
              {copy.eyebrow}
            </p>
            <h1 className="mt-2 text-3xl font-black tracking-tight">{copy.title}</h1>
            <p className="mt-2 text-sm text-muted-foreground">{copy.description}</p>
          </div>
          <Icon className="size-8 text-primary" aria-hidden="true" />
        </div>

        {isCareViewer ? (
          <>
            <CareUpdatesSection
              updates={careUpdates}
              isLoading={health.isLoading}
              empty={copy.empty}
            />
            {messageGroups.length > 0 && <ConversationSection groups={messageGroups} />}
          </>
        ) : (
          <>
            {role === "super_admin" ||
            role === "vito_admin" ||
            role === "clinical_professional" ||
            role === "clinical_supervisor" ? (
              <>
                <div className="flex flex-wrap gap-2 rounded-2xl border bg-card p-2 shadow-sm">
                  {(
                    [
                      ["all", "All updates"],
                      ["messages", "Messages"],
                      ["requests", "Consultation requests"],
                    ] as const
                  ).map(([value, label]) => (
                    <Button
                      key={value}
                      size="sm"
                      variant={filter === value ? "default" : "ghost"}
                      onClick={() => setFilter(value)}
                    >
                      {label}
                    </Button>
                  ))}
                </div>
                {isLoading ? (
                  <p className="text-sm text-muted-foreground">Loading inbox…</p>
                ) : !notifications.length ? (
                  <EmptyState text="You are all caught up." />
                ) : (
                  <div className="space-y-6">
                    {(filter === "all" || filter === "messages") && messageGroups.length > 0 && (
                      <ConversationSection groups={messageGroups} />
                    )}
                    {(filter === "all" || filter === "requests") && requests.length > 0 && (
                      <section className="space-y-3">
                        <div className="flex items-center gap-2">
                          <Bell className="size-5 text-primary" />
                          <h2 className="font-bold">Consultation requests</h2>
                          <span className="rounded-full bg-secondary px-2 py-0.5 text-xs text-muted-foreground">
                            {requests.length}
                          </span>
                        </div>
                        {requests.map((notification) => (
                          <RequestCard
                            key={notification.id}
                            notification={notification}
                            markRead={markRead}
                          />
                        ))}
                      </section>
                    )}
                  </div>
                )}
              </>
            ) : (
              <PersonalUpdatesSection
                notifications={notifications}
                messages={messageGroups}
                isLoading={isLoading}
                empty={copy.empty}
              />
            )}
          </>
        )}
      </div>
    </main>
  );
}

function CareUpdatesSection({
  updates,
  isLoading,
  empty,
}: {
  updates: NotificationRow[];
  isLoading: boolean;
  empty: string;
}) {
  return (
    <section className="space-y-3">
      <div className="flex items-center gap-2">
        <HeartPulse className="size-5 text-primary" />
        <h2 className="font-bold">Care updates</h2>
        <span className="rounded-full bg-secondary px-2 py-0.5 text-xs text-muted-foreground">
          {updates.length}
        </span>
      </div>
      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading your care updates…</p>
      ) : updates.length ? (
        updates.map((update) => <CareUpdateCard key={update.id} update={update} />)
      ) : (
        <EmptyState text={empty} />
      )}
    </section>
  );
}

function CareUpdateCard({ update }: { update: NotificationRow }) {
  const Icon =
    update.kind === "appointment" ? CalendarDays : update.kind === "follow_up" ? Check : Activity;
  return (
    <article className="rounded-2xl border border-primary/20 bg-card p-5 shadow-sm">
      <div className="flex items-start gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-secondary text-primary">
          <Icon className="size-5" />
        </span>
        <div className="min-w-0">
          <h3 className="font-bold">{update.title}</h3>
          <p className="mt-1 text-sm text-muted-foreground">{update.body}</p>
          <p className="mt-2 text-xs text-muted-foreground">
            {new Date(update.created_at).toLocaleString()}
          </p>
        </div>
      </div>
      {update.data.status && (
        <span className="mt-4 inline-flex rounded-full bg-accent/15 px-3 py-1 text-xs font-semibold text-accent-foreground">
          {STAGE_LABEL[update.data.status] ?? update.data.status}
        </span>
      )}
    </article>
  );
}

function PersonalUpdatesSection({
  notifications,
  messages,
  isLoading,
  empty,
}: {
  notifications: NotificationRow[];
  messages: { sender: string; items: NotificationRow[] }[];
  isLoading: boolean;
  empty: string;
}) {
  const updates = notifications.filter((notification) => notification.kind !== "communication");
  return (
    <div className="space-y-6">
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <Bell className="size-5 text-primary" />
          <h2 className="font-bold">Account updates</h2>
        </div>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading updates…</p>
        ) : updates.length ? (
          updates.map((notification) => (
            <article key={notification.id} className="rounded-2xl border bg-card p-5 shadow-sm">
              <h3 className="font-bold">{notification.title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{notification.body}</p>
              <p className="mt-2 text-xs text-muted-foreground">
                {new Date(notification.created_at).toLocaleString()}
              </p>
            </article>
          ))
        ) : (
          <EmptyState text={empty} />
        )}
      </section>
      {messages.length > 0 && <ConversationSection groups={messages} />}
    </div>
  );
}

function ConversationSection({
  groups,
}: {
  groups: { sender: string; items: NotificationRow[] }[];
}) {
  const [selectedSender, setSelectedSender] = useState<string | null>(null);
  const selected = groups.find((group) => group.sender === selectedSender) ?? null;
  const totalMessages = groups.reduce((count, group) => count + group.items.length, 0);

  return (
    <section className="overflow-hidden rounded-[1.75rem] border bg-card shadow-card-lift">
      <div className="flex items-center justify-between border-b px-5 py-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-accent">Your inbox</p>
          <h2 className="mt-1 text-xl font-black tracking-tight">Messages</h2>
        </div>
        <span className="rounded-full bg-secondary px-3 py-1 text-xs font-semibold text-secondary-foreground">
          {totalMessages} total
        </span>
      </div>

      <div className="grid min-h-[34rem] md:grid-cols-[minmax(16rem,0.8fr)_minmax(0,1.4fr)]">
        <div
          className={`${selected ? "hidden md:block" : "block"} border-r bg-[#fafafa] dark:bg-[#111b21]`}
        >
          <div className="border-b p-4">
            <label className="flex items-center gap-3 rounded-full bg-muted px-4 py-2.5 text-sm text-muted-foreground">
              <Search className="size-4" />
              <input
                aria-label="Search conversations"
                placeholder="Search"
                className="min-w-0 flex-1 bg-transparent outline-none placeholder:text-muted-foreground"
              />
            </label>
          </div>
          <div className="divide-y dark:divide-white/10">
            {groups.map((group, index) => {
              const latest = group.items[0];
              const unread = group.items.some((item) => !item.data.is_mine);
              return (
                <button
                  key={group.sender}
                  type="button"
                  onClick={() => setSelectedSender(group.sender)}
                  className={`flex w-full items-center gap-3 px-4 py-4 text-left transition-colors hover:bg-muted/70 ${selectedSender === group.sender ? "bg-muted" : "bg-transparent"}`}
                >
                  <AvatarBubble name={group.sender} index={index} />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center justify-between gap-2">
                      <span className="truncate font-bold">{group.sender}</span>
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {formatChatTime(latest.created_at)}
                      </span>
                    </span>
                    <span className="mt-1 block truncate text-sm text-muted-foreground">
                      {String(latest.data.message ?? "No message preview")}
                    </span>
                  </span>
                  {unread && <span className="size-2.5 shrink-0 rounded-full bg-accent" />}
                </button>
              );
            })}
          </div>
        </div>

        <div
          className={`${selected ? "block" : "hidden md:flex"} min-w-0 flex-col bg-[#0b141a] text-white`}
        >
          {selected ? (
            <ChatDetail group={selected} onBack={() => setSelectedSender(null)} />
          ) : (
            <div className="m-auto max-w-xs px-8 text-center text-white/70">
              <MessageCircle className="mx-auto mb-4 size-12 text-[#25d366]" />
              <p className="font-semibold">Select a conversation</p>
              <p className="mt-2 text-sm">Choose a message thread to read the conversation.</p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function ChatDetail({
  group,
  onBack,
}: {
  group: { sender: string; items: NotificationRow[] };
  onBack: () => void;
}) {
  return (
    <div className="flex min-h-[34rem] flex-1 flex-col bg-[radial-gradient(circle_at_20%_20%,rgba(37,211,102,0.08),transparent_28%),radial-gradient(circle_at_80%_80%,rgba(255,255,255,0.04),transparent_24%)]">
      <header className="flex items-center gap-3 border-b border-white/10 bg-[#202c33] px-4 py-3">
        <button
          type="button"
          onClick={onBack}
          className="rounded-full p-1 hover:bg-white/10 md:hidden"
          aria-label="Back to conversations"
        >
          <ArrowLeft className="size-5" />
        </button>
        <AvatarBubble name={group.sender} index={0} />
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold">{group.sender}</p>
          <p className="text-xs text-white/60">VITO Physio conversation</p>
        </div>
        <button
          type="button"
          className="rounded-full p-2 hover:bg-white/10"
          aria-label="Video call"
        >
          <Video className="size-5" />
        </button>
        <button
          type="button"
          className="rounded-full p-2 hover:bg-white/10"
          aria-label="Voice call"
        >
          <Phone className="size-5" />
        </button>
        <button
          type="button"
          className="rounded-full p-2 hover:bg-white/10"
          aria-label="More options"
        >
          <MoreVertical className="size-5" />
        </button>
      </header>

      <div className="flex-1 space-y-3 overflow-y-auto bg-[#0b141a]/95 px-4 py-5">
        <p className="mx-auto w-fit rounded-lg bg-[#182229] px-3 py-1 text-[11px] uppercase tracking-wide text-white/60">
          Today
        </p>
        {group.items
          .slice()
          .reverse()
          .map((message) => (
            <div
              key={message.id}
              className={`flex ${message.data.is_mine ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[82%] rounded-xl px-3 py-2 shadow-sm ${message.data.is_mine ? "rounded-tr-sm bg-[#005c4b]" : "rounded-tl-sm bg-[#202c33]"}`}
              >
                {message.data.subject && (
                  <p className="mb-1 text-xs font-semibold text-[#8de6be]">
                    {message.data.subject}
                  </p>
                )}
                <p className="whitespace-pre-wrap text-sm leading-relaxed text-white/95">
                  {message.data.message}
                </p>
                <div className="mt-1 flex items-center justify-end gap-1 text-[10px] text-white/55">
                  {new Date(message.created_at).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                  {message.data.is_mine && <CheckCheck className="size-3 text-[#53bdeb]" />}
                </div>
              </div>
            </div>
          ))}
      </div>

      <div className="flex items-center gap-2 bg-[#202c33] px-3 py-3">
        <button
          type="button"
          className="rounded-full p-2 text-white/70 hover:bg-white/10"
          aria-label="Add emoji"
        >
          <Smile className="size-5" />
        </button>
        <button
          type="button"
          className="rounded-full p-2 text-white/70 hover:bg-white/10"
          aria-label="Attach file"
        >
          <Paperclip className="size-5" />
        </button>
        <input
          placeholder="Type a message"
          className="min-w-0 flex-1 rounded-full bg-[#2a3942] px-4 py-2.5 text-sm text-white outline-none placeholder:text-white/55"
        />
        <button
          type="button"
          className="rounded-full bg-[#00a884] p-2.5 text-white hover:bg-[#06b995]"
          aria-label="Send message"
        >
          <Send className="size-4" />
        </button>
      </div>
    </div>
  );
}

function AvatarBubble({ name, index }: { name: string; index: number }) {
  const colors = ["bg-[#2a8c71]", "bg-[#6d5c93]", "bg-[#c57a48]", "bg-[#416d8e]"];
  const initials = name
    .split(/\\s+/)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  return (
    <span
      className={`grid size-11 shrink-0 place-items-center rounded-full text-xs font-black text-white ring-2 ring-white/10 ${colors[index % colors.length]}`}
    >
      {initials || "V"}
    </span>
  );
}

function formatChatTime(value: string) {
  return new Date(value).toLocaleDateString([], { month: "short", day: "numeric" });
}

function RequestCard({
  notification,
  markRead,
}: {
  notification: NotificationRow;
  markRead: (id: string) => void;
}) {
  const details = notification.data ?? {};
  return (
    <article
      className={`rounded-2xl border bg-card p-5 shadow-sm ${notification.read_at ? "opacity-75" : "border-primary/40"}`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-secondary text-primary">
            <UserRound className="size-5" />
          </span>
          <div className="min-w-0">
            <h2 className="font-bold">{notification.title}</h2>
            <p className="text-sm text-muted-foreground">{notification.body}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {new Date(notification.created_at).toLocaleString()}
            </p>
          </div>
        </div>
        {!notification.read_at && (
          <Button size="sm" variant="outline" onClick={() => markRead(notification.id)}>
            <Check className="mr-1 size-4" />
            Mark read
          </Button>
        )}
      </div>
      <div className="mt-4 grid gap-3 rounded-xl bg-muted/50 p-4 text-sm sm:grid-cols-2">
        <Detail icon={UserRound} label="Sender" value={details.contact_name} />
        <Detail icon={MessageSquareText} label="Contact type" value={details.organisation_type} />
        <Detail icon={Mail} label="Email" value={details.email} />
        <Detail icon={Phone} label="Phone" value={details.phone || "Not provided"} />
        <div className="sm:col-span-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Message
          </span>
          <p className="mt-1 whitespace-pre-wrap leading-relaxed">{details.message}</p>
        </div>
      </div>
    </article>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="rounded-2xl border bg-card p-8 text-center text-sm text-muted-foreground">
      {text}
    </div>
  );
}

function Detail({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value?: string }) {
  return (
    <div className="flex items-start gap-2">
      <Icon className="mt-0.5 size-4 shrink-0 text-primary" />
      <div>
        <span className="block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {label}
        </span>
        <span className="break-words font-medium">{value || "Not provided"}</span>
      </div>
    </div>
  );
}
