import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
  AtSign,
  Bell,
  CalendarDays,
  Check,
  CheckCheck,
  HeartPulse,
  MessagesSquare,
  Smartphone,
  ThumbsUp,
  UserPlus,
  Users,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { PhotoAvatar } from "@/components/vito/Photo";
import { enableDevicePush } from "@/lib/device-push";
import {
  registerDeviceToken,
  saveNotificationPreferences,
  type NotificationPreferences,
} from "@/lib/notification.functions";

export const Route = createFileRoute("/_authenticated/notifications")({
  head: () => ({
    meta: [
      { title: "Notifications — VITO Physio" },
      { name: "description", content: "Your VITO Physio followers, reactions, appointments and care updates." },
      { property: "og:title", content: "Notifications — VITO Physio" },
      {
        property: "og:description",
        content: "Your VITO Physio followers, reactions, appointments and care updates.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: NotificationsPage,
});

type NotificationRow = {
  id: string;
  title: string;
  body: string;
  category: string;
  actor_name: string | null;
  actor_avatar_path: string | null;
  path: string | null;
  read_at: string | null;
  created_at: string;
};

const CATEGORIES: { key: string; label: string; icon: LucideIcon }[] = [
  { key: "all", label: "All", icon: Bell },
  { key: "reactions", label: "Reactions", icon: ThumbsUp },
  { key: "comments", label: "Comments & replies", icon: MessagesSquare },
  { key: "followers", label: "Followers", icon: UserPlus },
  { key: "mentions", label: "Mentions", icon: AtSign },
  { key: "appointments", label: "Appointments", icon: CalendarDays },
  { key: "rehabilitation", label: "Injury & rehab", icon: HeartPulse },
  { key: "system", label: "Announcements", icon: Users },
];

const PREFERENCE_FIELDS: { key: keyof NotificationPreferences; label: string }[] = [
  { key: "messages_enabled", label: "Chat messages (device alerts only)" },
  { key: "message_preview_enabled", label: "Show message text in chat alerts" },
  { key: "reactions_enabled", label: "Post reactions" },
  { key: "comments_enabled", label: "Comments and replies" },
  { key: "followers_enabled", label: "New followers" },
  { key: "mentions_enabled", label: "Mentions" },
  { key: "appointments_enabled", label: "Appointments" },
  { key: "rehabilitation_enabled", label: "Rehabilitation and recovery updates" },
];

const DEFAULT_PREFERENCES: NotificationPreferences = {
  messages_enabled: true,
  reactions_enabled: true,
  comments_enabled: true,
  followers_enabled: true,
  mentions_enabled: true,
  appointments_enabled: true,
  rehabilitation_enabled: true,
  push_enabled: true,
  message_preview_enabled: true,
};

function categoryIcon(category: string): LucideIcon {
  return CATEGORIES.find((c) => c.key === category)?.icon ?? Bell;
}

function NotificationsPage() {
  const { user } = Route.useRouteContext();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const savePreferences = useServerFn(saveNotificationPreferences);
  const registerToken = useServerFn(registerDeviceToken);
  const [filter, setFilter] = useState("all");
  const [pushBusy, setPushBusy] = useState(false);

  const notificationsQuery = useQuery({
    queryKey: ["notifications", user.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("notifications")
        .select(
          "id,title,body,category,actor_name,actor_avatar_path,path,read_at,created_at",
        )
        .neq("category", "messages")
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return (data ?? []) as NotificationRow[];
    },
  });

  const preferencesQuery = useQuery({
    queryKey: ["notification-preferences", user.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("notification_preferences")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();
      if (error) throw error;
      return data ? { ...DEFAULT_PREFERENCES, ...data } : DEFAULT_PREFERENCES;
    },
  });

  useEffect(() => {
    const channel = supabase
      .channel(`notifications-${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          void queryClient.invalidateQueries({ queryKey: ["notifications", user.id] });
          void queryClient.invalidateQueries({ queryKey: ["notification-count", user.id] });
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [queryClient, user.id]);

  const notifications = notificationsQuery.data ?? [];
  const filtered = useMemo(
    () =>
      filter === "all"
        ? notifications
        : notifications.filter((notification) => notification.category === filter),
    [filter, notifications],
  );
  const unreadCount = notifications.filter((notification) => !notification.read_at).length;

  async function markRead(notification: NotificationRow) {
    if (!notification.read_at) {
      const { error } = await supabase
        .from("notifications")
        .update({ read_at: new Date().toISOString() })
        .eq("id", notification.id);
      if (error) { toast.error("Could not mark this notification as read."); return; }
      void queryClient.invalidateQueries({ queryKey: ["notifications", user.id] });
      void queryClient.invalidateQueries({ queryKey: ["notification-count", user.id] });
    }
    if (notification.path) {
      const [pathname, hash] = notification.path.split("#");
      const [path, search] = (pathname ?? "/notifications").split("?");
      const params = new URLSearchParams(search ?? "");
      await navigate({
        to: path as never,
        search: Object.fromEntries(params) as never,
        hash: hash as never,
      });
    }
  }

  async function markAllRead() {
    const { error } = await supabase.rpc("mark_all_notifications_read");
    if (error) {
      toast.error(error.message);
      return;
    }
    void queryClient.invalidateQueries({ queryKey: ["notifications", user.id] });
    void queryClient.invalidateQueries({ queryKey: ["notification-count", user.id] });
    toast.success("All notifications marked as read");
  }

  async function togglePreference(key: keyof NotificationPreferences, value: boolean) {
    const current = preferencesQuery.data ?? DEFAULT_PREFERENCES;
    const next = { ...current, [key]: value };
    queryClient.setQueryData(["notification-preferences", user.id], next);
    try {
      await savePreferences({ data: next });
    } catch (error) {
      queryClient.setQueryData(["notification-preferences", user.id], current);
      toast.error(error instanceof Error ? error.message : "Could not save preferences");
    }
  }

  async function enablePhoneNotifications() {
    setPushBusy(true);
    try {
      const result = await enableDevicePush();
      if (result.status === "registered") {
        await registerToken({ data: { token: result.token, platform: result.platform } });
        await togglePreference("push_enabled", true);
        toast.success("This device will now receive VITO Physio notifications.");
        return;
      }
      if (result.status === "open-in-new-tab") {
        toast.info("Open VITO Physio in its own browser tab to allow notifications.");
      } else if (result.status === "not-configured") {
        toast.info("Update the Firebase connection and select Include web push to enable phone notifications.");
      } else if (result.status === "unsupported") {
        toast.info("This browser does not support notifications.");
      } else {
        toast.info(
          "Notifications are blocked. Allow them in your browser's site settings, then try again.",
        );
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not enable notifications.");
    } finally {
      setPushBusy(false);
    }
  }

  const preferences = preferencesQuery.data ?? DEFAULT_PREFERENCES;

  return (
    <main className="min-h-[calc(100vh-4rem)] bg-background">
      <div className="mx-auto max-w-4xl space-y-6 px-5 py-8">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-accent">
              Notification centre
            </p>
            <h1 className="mt-2 text-3xl font-black tracking-tight">Notifications</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Followers, reactions, comments, appointments and announcements. Chats live in Messages.
            </p>
          </div>
          {unreadCount > 0 && (
            <Button variant="outline" size="sm" onClick={() => void markAllRead()}>
              <CheckCheck className="mr-1 size-4" />
              Mark all read ({unreadCount})
            </Button>
          )}
        </div>

        <section className="rounded-2xl border bg-card p-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="grid size-10 place-items-center rounded-xl bg-secondary text-primary">
                <Smartphone className="size-5" />
              </span>
              <div>
                <h2 className="font-bold">Phone notifications</h2>
                <p className="text-sm text-muted-foreground">
                  Receive alerts on this device even when VITO Physio is closed.
                </p>
              </div>
            </div>
            <Button onClick={() => void enablePhoneNotifications()} disabled={pushBusy}>
              {pushBusy ? "Setting up…" : "Enable on this device"}
            </Button>
          </div>
          <div className="mt-5 grid gap-3 border-t pt-4 sm:grid-cols-2">
            {PREFERENCE_FIELDS.map(({ key, label }) => (
              <label key={key} className="flex items-center justify-between gap-3 text-sm">
                <span>{label}</span>
                <Switch
                  checked={preferences[key]}
                  onCheckedChange={(value) => void togglePreference(key, value)}
                  aria-label={label}
                />
              </label>
            ))}
            <label className="flex items-center justify-between gap-3 text-sm font-medium">
              <span>Push notifications</span>
              <Switch
                checked={preferences.push_enabled}
                onCheckedChange={(value) => void togglePreference("push_enabled", value)}
                aria-label="Push notifications"
              />
            </label>
          </div>
        </section>

        <div className="flex flex-wrap gap-2 rounded-2xl border bg-card p-2 shadow-sm">
          {CATEGORIES.map(({ key, label }) => (
            <Button
              key={key}
              size="sm"
              variant={filter === key ? "default" : "ghost"}
              onClick={() => setFilter(key)}
            >
              {label}
            </Button>
          ))}
        </div>

        {notificationsQuery.isLoading ? (
          <p className="text-sm text-muted-foreground">Loading notifications…</p>
        ) : !filtered.length ? (
          <div className="rounded-2xl border bg-card p-8 text-center text-sm text-muted-foreground">
            You are all caught up.
          </div>
        ) : (
          <ul className="space-y-3">
            {filtered.map((notification) => {
              const Icon = categoryIcon(notification.category);
              return (
                <li key={notification.id}>
                  <button
                    type="button"
                    onClick={() => void markRead(notification)}
                    className={`flex w-full items-start gap-3 rounded-2xl border bg-card p-4 text-left shadow-sm transition hover:border-primary/40 ${
                      notification.read_at ? "opacity-75" : "border-primary/40"
                    }`}
                  >
                    {notification.actor_avatar_path || notification.actor_name ? (
                      <PhotoAvatar
                        path={notification.actor_avatar_path}
                        name={notification.actor_name}
                        className="size-10 shrink-0"
                      />
                    ) : (
                      <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-secondary text-primary">
                        <Icon className="size-5" />
                      </span>
                    )}
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center justify-between gap-2">
                        <span className="truncate font-bold">{notification.title}</span>
                        {!notification.read_at && (
                          <span className="size-2.5 shrink-0 rounded-full bg-accent" />
                        )}
                      </span>
                      <span className="mt-0.5 block text-sm text-muted-foreground">
                        {notification.actor_name
                          ? `${notification.actor_name} — ${notification.body}`
                          : notification.body}
                      </span>
                      <span className="mt-1 block text-xs text-muted-foreground">
                        {new Date(notification.created_at).toLocaleString()}
                      </span>
                    </span>
                    <Check
                      className={`mt-1 size-4 shrink-0 ${notification.read_at ? "text-primary" : "text-muted-foreground/30"}`}
                    />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </main>
  );
}
