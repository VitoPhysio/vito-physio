import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCanGoBack, useRouter } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import type { KeyboardEvent, PointerEvent, Ref } from "react";
import {
  ArrowLeft,
  Ban,
  Check,
  CheckCheck,
  ChevronDown,
  Copy,
  Filter,
  LoaderCircle,
  MessageCircle,
  MessageCirclePlus,
  MoreVertical,
  Paperclip,
  Search,
  Send,
  Smile,
  UserPlus,
  UserRound,
  Video,
  Phone,
  Plus,
  Reply,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { PhotoAvatar } from "@/components/vito/Photo";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export const Route = createFileRoute("/_authenticated/messages")({
  component: MessagesPage,
});

type Profile = {
  id: string;
  full_name: string | null;
  avatar_path: string | null;
  role?: string | null;
};
type Reaction = {
  message_id: string;
  user_id: string;
  emoji: string;
};
type QuotedMessage = {
  id: string;
  sender_id: string;
  body: string;
  deleted: boolean;
};
type Message = {
  id: string;
  conversation_id: string;
  sender_id: string;
  body: string;
  created_at: string;
  reply_to_id: string | null;
  deleted_at: string | null;
  reply_to: QuotedMessage | null;
  reactions: Reaction[];
};
type Participant = {
  conversation_id: string;
  user_id: string;
  last_read_at: string | null;
};
type Conversation = {
  id: string;
  kind: "direct" | "group";
  created_at: string;
  last_message_at: string;
};
type ConversationView = Conversation & {
  participants: Participant[];
  messages: Message[];
  otherProfiles: Profile[];
  latest: Message | null;
  unread: number;
  displayName: string;
  avatarPath: string | null;
  otherUserId: string | null;
  otherRole: string | null;
  /** False until the message interactions migration is applied. */
  interactive: boolean;
};

type Filter = "all" | "unread" | "read";
type MessagingUser = {
  id: string;
  full_name: string | null;
  avatar_path: string | null;
  role: string;
};

function MessagesPage() {
  const { user } = Route.useRouteContext();
  const navigate = Route.useNavigate();
  const router = useRouter();
  const canGoBack = useCanGoBack();
  const queryClient = useQueryClient();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [newConversationOpen, setNewConversationOpen] = useState(false);
  const [userSearch, setUserSearch] = useState("");
  const [startingConversation, setStartingConversation] = useState(false);

  const conversations = useQuery({
    queryKey: ["messages", user.id],
    queryFn: () => loadConversations(user.id),
    staleTime: 5_000,
  });

  useEffect(() => {
    const channel = supabase
      .channel(`messages-inbox-${user.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "messages" }, () => {
        void queryClient.invalidateQueries({ queryKey: ["messages", user.id] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "message_reactions" }, () => {
        void queryClient.invalidateQueries({ queryKey: ["messages", user.id] });
      })
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "conversation_participants",
          filter: `user_id=eq.${user.id}`,
        },
        () => void queryClient.invalidateQueries({ queryKey: ["messages", user.id] }),
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [queryClient, user.id]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return (conversations.data ?? []).filter((conversation) => {
      const matchesFilter =
        filter === "all" ||
        (filter === "unread" ? conversation.unread > 0 : conversation.unread === 0);
      const matchesQuery =
        !needle ||
        `${conversation.displayName} ${conversation.latest?.body ?? ""}`
          .toLowerCase()
          .includes(needle);
      return matchesFilter && matchesQuery;
    });
  }, [conversations.data, filter, query]);

  const selected =
    (conversations.data ?? []).find((conversation) => conversation.id === selectedId) ?? null;
  const messagingUsers = useQuery({
    queryKey: ["messaging-users", user.id],
    queryFn: () => loadMessagingUsers(),
    enabled: newConversationOpen,
    staleTime: 60_000,
    retry: 1,
  });
  const filteredUsers = useMemo(() => {
    const needle = userSearch.trim().toLowerCase();
    return (messagingUsers.data ?? [])
      .filter((member) => {
        if (!needle) return true;
        return `${member.full_name ?? ""} ${member.role}`.toLowerCase().includes(needle);
      })
      .sort((first, second) =>
        messagingUserDisplayName(first).localeCompare(messagingUserDisplayName(second), undefined, {
          sensitivity: "base",
        }),
      );
  }, [messagingUsers.data, userSearch]);

  async function startConversation(member: MessagingUser) {
    setStartingConversation(true);
    const { data: conversationId, error } = await supabase.rpc("create_direct_conversation", {
      _other_user: member.id,
    });
    setStartingConversation(false);
    if (error || !conversationId) {
      toast.error(error?.message ?? "Unable to start this conversation.");
      return;
    }
    setNewConversationOpen(false);
    setUserSearch("");
    await queryClient.invalidateQueries({ queryKey: ["messages", user.id] });
    setSelectedId(conversationId);
  }

  async function openConversation(conversation: ConversationView) {
    setSelectedId(conversation.id);
    const { error } = await supabase.rpc("mark_conversation_read", {
      _conversation_id: conversation.id,
    });
    if (!error) void queryClient.invalidateQueries({ queryKey: ["messages", user.id] });
  }

  function closeMessages() {
    if (canGoBack) {
      router.history.back();
      return;
    }
    void navigate({ to: "/" });
  }

  return (
    <div className="fixed inset-0 z-[100] flex h-[100dvh] min-h-0 flex-col overflow-hidden bg-background text-foreground">
      {!selected && (
        <header className="flex shrink-0 items-center justify-between border-b bg-card px-4 py-3 shadow-sm sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <button
              type="button"
              onClick={closeMessages}
              aria-label="Go back to previous page"
              className="grid size-10 shrink-0 place-items-center rounded-full text-primary transition hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              <ArrowLeft className="size-5" />
            </button>
            <PhotoAvatar
              path={null}
              name="Messages"
              className="size-10 bg-primary text-primary-foreground"
            />
            <div className="min-w-0">
              <h1 className="truncate text-xl font-black tracking-tight sm:text-2xl">Messages</h1>
              <p className="hidden text-xs text-muted-foreground sm:block">
                Conversations with your VITO Physio team
              </p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2">
                  <Filter className="size-4" />
                  <span className="hidden sm:inline">{filterLabel(filter)}</span>
                  <ChevronDown className="size-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {(["all", "unread", "read"] as Filter[]).map((value) => (
                  <DropdownMenuItem key={value} onSelect={() => setFilter(value)}>
                    {filterLabel(value)}
                    {filter === value && <Check className="ml-auto size-4 text-primary" />}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>
      )}

      <div className="grid min-h-0 flex-1 md:grid-cols-[minmax(18rem,0.8fr)_minmax(0,1.5fr)]">
        <aside
          className={`${selected ? "hidden md:flex" : "flex"} min-h-0 flex-col border-r bg-muted/20`}
        >
          <div className="shrink-0 border-b p-4">
            <label className="flex items-center gap-3 rounded-xl border bg-card px-3 py-2.5 text-sm text-muted-foreground shadow-sm focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20">
              <Search className="size-4 shrink-0" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search conversations"
                aria-label="Search conversations"
                className="min-w-0 flex-1 bg-transparent outline-none placeholder:text-muted-foreground"
              />
            </label>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto">
            {conversations.isLoading ? (
              <div className="p-6 text-center text-sm text-muted-foreground">
                Loading conversations…
              </div>
            ) : conversations.error ? (
              <div className="flex flex-col items-center gap-3 p-6 text-center text-sm text-destructive">
                <p>{conversationErrorMessage(conversations.error)}</p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => void conversations.refetch()}
                >
                  Try again
                </Button>
              </div>
            ) : filtered.length ? (
              filtered.map((conversation) => (
                <ConversationRow
                  key={conversation.id}
                  conversation={conversation}
                  selected={conversation.id === selectedId}
                  onSelect={() => void openConversation(conversation)}
                  onOpenProfile={(participantId) =>
                    window.location.assign(`/members/${participantId}`)
                  }
                />
              ))
            ) : (
              <EmptyInbox hasSearch={Boolean(query || filter !== "all")} />
            )}
          </div>
        </aside>

        <main
          className={`${selected ? "flex" : "hidden md:flex"} min-h-0 min-w-0 flex-col bg-secondary/25`}
        >
          {selected ? (
            <ChatView
              conversation={selected}
              userId={user.id}
              onBack={() => setSelectedId(null)}
              onOpenProfile={(participantId) => window.location.assign(`/members/${participantId}`)}
              onSent={() => void queryClient.invalidateQueries({ queryKey: ["messages", user.id] })}
            />
          ) : (
            <div className="m-auto max-w-sm px-8 text-center text-muted-foreground">
              <MessageCircle className="mx-auto mb-4 size-14 text-primary/70" />
              <h2 className="text-lg font-bold text-foreground">Select a conversation</h2>
              <p className="mt-2 text-sm">
                Choose a conversation to view messages and send a reply.
              </p>
            </div>
          )}
        </main>
      </div>

      {!selected && (
        <Button
          type="button"
          onClick={() => setNewConversationOpen(true)}
          aria-label="Start a new conversation"
          title="Start a new conversation"
          className="fixed bottom-6 right-5 z-20 size-16 rounded-full bg-primary p-0 text-primary-foreground shadow-[0_10px_28px_rgba(80,35,168,0.32)] transition hover:scale-105 hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/30 sm:bottom-8 sm:right-8 sm:size-[4.5rem]"
        >
          <MessageCirclePlus className="size-8" strokeWidth={2.25} />
        </Button>
      )}

      {newConversationOpen && (
        <section
          aria-label="Start a new conversation"
          className="fixed inset-0 z-[130] flex h-[100dvh] min-h-0 flex-col bg-background text-foreground"
        >
          <header className="flex shrink-0 items-center gap-3 border-b bg-card px-4 py-3 shadow-sm sm:px-6">
            <button
              type="button"
              onClick={() => {
                setNewConversationOpen(false);
                setUserSearch("");
              }}
              aria-label="Close registered users"
              className="grid size-10 shrink-0 place-items-center rounded-full text-primary transition hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              <ArrowLeft className="size-5" />
            </button>
            <span className="grid size-10 shrink-0 place-items-center rounded-full bg-secondary text-primary">
              <UserPlus className="size-5" />
            </span>
            <div className="min-w-0">
              <h2 className="truncate text-xl font-black tracking-tight sm:text-2xl">
                New conversation
              </h2>
              <p className="truncate text-xs text-muted-foreground">
                Choose a registered VITO Physio user
              </p>
            </div>
          </header>

          <div className="mx-auto flex min-h-0 w-full max-w-2xl flex-1 flex-col">
            <div className="shrink-0 border-b bg-background p-4 sm:p-5">
              <label className="flex items-center gap-3 rounded-xl border bg-card px-3 py-3 text-sm text-muted-foreground shadow-sm focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20">
                <Search className="size-5 shrink-0 text-primary" />
                <input
                  autoFocus
                  value={userSearch}
                  onChange={(event) => setUserSearch(event.target.value)}
                  placeholder="Search Vito users by name"
                  aria-label="Search Vito registered users by name"
                  className="min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-muted-foreground"
                />
              </label>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto bg-muted/20">
              <div className="flex items-center justify-between border-b bg-background px-4 py-3 sm:px-5">
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-muted-foreground">
                  {userSearch.trim() ? "Search results" : "All VITO Physio users"}
                </p>
                {!messagingUsers.isLoading && !messagingUsers.error && (
                  <span className="text-xs text-muted-foreground">
                    {filteredUsers.length} users
                  </span>
                )}
              </div>

              {messagingUsers.isLoading ? (
                <div className="flex flex-col items-center justify-center gap-3 p-12 text-sm text-muted-foreground">
                  <LoaderCircle className="size-6 animate-spin text-primary" />
                  Loading registered users…
                </div>
              ) : messagingUsers.error ? (
                <div className="flex flex-col items-center gap-3 p-8 text-center text-sm text-destructive">
                  <p>{userPickerErrorMessage(messagingUsers.error)}</p>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => void messagingUsers.refetch()}
                  >
                    Try again
                  </Button>
                </div>
              ) : filteredUsers.length ? (
                <div className="divide-y">
                  {filteredUsers.map((member) => (
                    <div
                      key={member.id}
                      className="flex w-full items-center gap-3 border-b bg-card px-4 py-4 transition hover:bg-secondary sm:px-5"
                    >
                      <button
                        type="button"
                        onClick={() => window.location.assign(`/members/${member.id}`)}
                        aria-label={`Open ${messagingUserDisplayName(member)}'s profile`}
                        className="shrink-0 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                      >
                        <PhotoAvatar
                          path={member.avatar_path}
                          name={member.full_name}
                          className="size-12"
                        />
                      </button>
                      <button
                        type="button"
                        disabled={startingConversation}
                        onClick={() => void startConversation(member)}
                        className="flex min-w-0 flex-1 items-center gap-3 text-left disabled:cursor-wait disabled:opacity-60"
                      >
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-base font-semibold text-foreground">
                            {messagingUserDisplayName(member)}
                          </span>
                          <span className="mt-1 block truncate text-xs capitalize text-muted-foreground">
                            {member.role.replaceAll("_", " ")}
                          </span>
                        </span>
                        <MessageCircle className="size-5 shrink-0 text-primary" />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center gap-2 p-12 text-center text-sm text-muted-foreground">
                  <UserPlus className="size-8 text-primary/60" />
                  <p>
                    {userSearch.trim()
                      ? `No VITO users match “${userSearch}”.`
                      : "No registered VITO users found."}
                  </p>
                </div>
              )}
            </div>
          </div>
        </section>
      )}
    </div>
  );
}

function ConversationRow({
  conversation,
  selected,
  onSelect,
  onOpenProfile,
}: {
  conversation: ConversationView;
  selected: boolean;
  onSelect: () => void;
  onOpenProfile: (participantId: string) => void;
}) {
  const profileId = conversation.otherProfiles[0]?.id;
  return (
    <div
      className={`flex w-full items-center gap-3 border-b px-4 py-4 transition hover:bg-secondary/80 ${selected ? "bg-secondary" : "bg-card"}`}
    >
      {profileId ? (
        <button
          type="button"
          onClick={() => onOpenProfile(profileId)}
          aria-label={`Open ${conversation.displayName}'s profile`}
          className="shrink-0 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          <PhotoAvatar
            path={conversation.avatarPath}
            name={conversation.displayName}
            className="size-12"
          />
        </button>
      ) : (
        <PhotoAvatar
          path={conversation.avatarPath}
          name={conversation.displayName}
          className="size-12 shrink-0"
        />
      )}
      <button
        type="button"
        onClick={onSelect}
        aria-label={`Open conversation with ${conversation.displayName}`}
        className="min-w-0 flex-1 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary"
      >
        <span className="flex items-center justify-between gap-2">
          <span className="truncate font-bold">{conversation.displayName}</span>
          <span
            className={`shrink-0 text-xs ${conversation.unread ? "font-bold text-primary" : "text-muted-foreground"}`}
          >
            {formatChatTime(conversation.last_message_at)}
          </span>
        </span>
        <span className="mt-1 flex items-center gap-2">
          <span
            className={`min-w-0 flex-1 truncate text-sm ${conversation.unread ? "font-semibold text-foreground" : "text-muted-foreground"}`}
          >
            {conversation.latest?.body ?? "No messages yet"}
          </span>
          {conversation.unread > 0 && (
            <span className="grid min-w-5 place-items-center rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-bold text-primary-foreground">
              {conversation.unread > 99 ? "99+" : conversation.unread}
            </span>
          )}
        </span>
      </button>
    </div>
  );
}

function ChatView({
  conversation,
  userId,
  onBack,
  onOpenProfile,
  onSent,
}: {
  conversation: ConversationView;
  userId: string;
  onBack: () => void;
  onOpenProfile: (participantId: string) => void;
  onSent: () => void;
}) {
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [replyTo, setReplyTo] = useState<Message | null>(null);
  const [actionsFor, setActionsFor] = useState<Message | null>(null);
  const [highlightedId, setHighlightedId] = useState<string | null>(null);
  const historyRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const messageRefs = useRef(new Map<string, HTMLDivElement>());
  const profilePhotoUserId = conversation.otherProfiles[0]?.id ?? conversation.otherUserId;

  useEffect(() => {
    historyRef.current?.scrollTo({ top: historyRef.current.scrollHeight });
  }, [conversation.messages.length, conversation.id]);

  useEffect(() => {
    setReplyTo(null);
    setActionsFor(null);
  }, [conversation.id]);

  useEffect(() => {
    if (!highlightedId) return;
    const timer = window.setTimeout(() => setHighlightedId(null), 1600);
    return () => window.clearTimeout(timer);
  }, [highlightedId]);

  function senderLabel(senderId: string) {
    if (senderId === userId) return "You";
    const profile = conversation.otherProfiles.find((member) => member.id === senderId);
    return profile?.full_name || "VITO Physio member";
  }

  function startReply(message: Message) {
    if (!conversation.interactive) {
      toast.info("Replies become available once message interactions are enabled.");
      return;
    }
    if (message.deleted_at) return;
    setReplyTo(message);
    inputRef.current?.focus();
  }

  function jumpToMessage(messageId: string) {
    const target = messageRefs.current.get(messageId);
    if (!target) {
      toast.info("The original message is no longer available.");
      return;
    }
    target.scrollIntoView({ behavior: "smooth", block: "center" });
    setHighlightedId(messageId);
  }

  async function sendMessage() {
    const text = body.trim();
    if (!text || sending) return;
    setSending(true);
    const { error } = await supabase.from("messages").insert({
      conversation_id: conversation.id,
      sender_id: userId,
      body: text,
      ...(replyTo && conversation.interactive ? { reply_to_id: replyTo.id } : {}),
    });
    setSending(false);
    if (error) {
      toast.error("Your message could not be sent. Please try again.");
      return;
    }
    setBody("");
    setReplyTo(null);
    onSent();
  }

  async function toggleReaction(message: Message, emoji: string) {
    if (!conversation.interactive || message.deleted_at) return;
    const current = message.reactions.find((reaction) => reaction.user_id === userId);
    const { error } =
      current?.emoji === emoji
        ? await supabase
            .from("message_reactions")
            .delete()
            .eq("message_id", message.id)
            .eq("user_id", userId)
        : await supabase
            .from("message_reactions")
            .upsert(
              { message_id: message.id, user_id: userId, emoji },
              { onConflict: "message_id,user_id" },
            );
    if (error) {
      toast.error("Your reaction could not be saved. Please try again.");
      return;
    }
    onSent();
  }

  async function deleteForMe(message: Message) {
    const { error } = await supabase
      .from("message_hidden")
      .insert({ message_id: message.id, user_id: userId });
    if (error) {
      toast.error("The message could not be deleted. Please try again.");
      return;
    }
    if (replyTo?.id === message.id) setReplyTo(null);
    toast.success("Message deleted for you.");
    onSent();
  }

  async function deleteForEveryone(message: Message) {
    const { error } = await supabase.rpc("delete_message_for_everyone", {
      _message_id: message.id,
    });
    if (error) {
      toast.error("The message could not be deleted for everyone. Please try again.");
      return;
    }
    if (replyTo?.id === message.id) setReplyTo(null);
    toast.success("Message deleted for everyone.");
    onSent();
  }

  async function copyMessage(message: Message) {
    try {
      await navigator.clipboard.writeText(message.body);
      toast.success("Message copied.");
    } catch {
      toast.error("Unable to copy this message.");
    }
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void sendMessage();
    } else if (event.key === "Escape" && replyTo) {
      setReplyTo(null);
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="flex shrink-0 items-center gap-3 border-b bg-card px-4 py-3 shadow-sm sm:px-5">
        <button
          type="button"
          onClick={onBack}
          className="grid size-9 place-items-center rounded-full text-primary hover:bg-secondary md:hidden"
          aria-label="Back to messages"
        >
          <ArrowLeft className="size-5" />
        </button>
        {profilePhotoUserId ? (
          <button
            type="button"
            onClick={() => onOpenProfile(profilePhotoUserId)}
            aria-label={`Open ${conversation.displayName}'s profile`}
            className="shrink-0 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <PhotoAvatar
              path={conversation.avatarPath}
              name={conversation.displayName}
              className="size-11"
            />
          </button>
        ) : (
          <PhotoAvatar
            path={conversation.avatarPath}
            name={conversation.displayName}
            className="size-11 shrink-0"
          />
        )}
        <div className="min-w-0 flex-1">
          {conversation.otherUserId ? (
            <button
              type="button"
              onClick={() => onOpenProfile(conversation.otherUserId!)}
              className="block max-w-full text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              <h2 className="truncate font-bold">{conversation.displayName}</h2>
            </button>
          ) : (
            <h2 className="truncate font-bold">{conversation.displayName}</h2>
          )}
          <p className="text-xs text-muted-foreground">{roleLabel(conversation.otherRole)}</p>
        </div>
        <button
          type="button"
          disabled
          title="Voice calls are coming soon"
          aria-label="Voice calls are not available"
          className="hidden rounded-full p-2 text-muted-foreground opacity-50 sm:inline-flex"
        >
          <Phone className="size-5" />
        </button>
        <button
          type="button"
          disabled
          title="Video calls are coming soon"
          aria-label="Video calls are not available"
          className="hidden rounded-full p-2 text-muted-foreground opacity-50 sm:inline-flex"
        >
          <Video className="size-5" />
        </button>
        <button
          type="button"
          aria-label="Conversation options"
          className="rounded-full p-2 text-muted-foreground hover:bg-secondary"
        >
          <MoreVertical className="size-5" />
        </button>
      </header>

      <div
        ref={historyRef}
        className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden bg-background px-4 py-5 sm:px-8"
      >
        <div className="mx-auto flex max-w-3xl flex-col gap-3">
          {conversation.messages.length ? (
            conversation.messages.map((message, index) => {
              const mine = message.sender_id === userId;
              const previous = conversation.messages[index - 1];
              const showDate = !previous || !sameDay(previous.created_at, message.created_at);
              return (
                <div key={message.id}>
                  {showDate && (
                    <p className="mx-auto mb-3 w-fit rounded-full bg-secondary px-3 py-1 text-[11px] font-semibold text-muted-foreground">
                      {formatDate(message.created_at)}
                    </p>
                  )}
                  <MessageBubble
                    ref={(node) => {
                      if (node) messageRefs.current.set(message.id, node);
                      else messageRefs.current.delete(message.id);
                    }}
                    message={message}
                    mine={mine}
                    userId={userId}
                    canSwipe={conversation.interactive && !message.deleted_at}
                    highlighted={highlightedId === message.id}
                    quotedSender={message.reply_to ? senderLabel(message.reply_to.sender_id) : null}
                    onOpenActions={() => setActionsFor(message)}
                    onReply={() => startReply(message)}
                    onJumpTo={jumpToMessage}
                    onToggleReaction={(emoji) => void toggleReaction(message, emoji)}
                  />
                </div>
              );
            })
          ) : (
            <div className="m-auto py-20 text-center text-sm text-muted-foreground">
              Start the conversation with a message.
            </div>
          )}
        </div>
      </div>

      {replyTo && (
        <div className="flex shrink-0 items-center gap-3 border-t bg-card px-3 pt-3">
          <div className="min-w-0 flex-1 rounded-lg border-l-4 border-primary bg-secondary/60 px-3 py-2">
            <p className="text-xs font-bold text-primary">
              Replying to {senderLabel(replyTo.sender_id)}
            </p>
            <p className="truncate text-xs text-muted-foreground">{replyTo.body}</p>
          </div>
          <button
            type="button"
            onClick={() => setReplyTo(null)}
            aria-label="Cancel reply"
            className="grid size-8 shrink-0 place-items-center rounded-full text-muted-foreground hover:bg-secondary"
          >
            <X className="size-4" />
          </button>
        </div>
      )}

      <form
        className={`flex shrink-0 items-center gap-2 bg-card p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] ${replyTo ? "" : "border-t"}`}
        onSubmit={(event) => {
          event.preventDefault();
          void sendMessage();
        }}
      >
        <button
          type="button"
          disabled
          title="Attachments are coming soon"
          aria-label="Attachments are not available"
          className="hidden rounded-full p-2 text-muted-foreground opacity-50 sm:inline-flex"
        >
          <Paperclip className="size-5" />
        </button>
        <button
          type="button"
          disabled
          title="Emoji picker is coming soon"
          aria-label="Emoji picker is not available"
          className="hidden rounded-full p-2 text-muted-foreground opacity-50 sm:inline-flex"
        >
          <Smile className="size-5" />
        </button>
        <input
          ref={inputRef}
          value={body}
          onChange={(event) => setBody(event.target.value)}
          onKeyDown={handleKeyDown}
          disabled={sending}
          placeholder="Write a message…"
          aria-label="Message"
          className="min-w-0 flex-1 rounded-full border bg-background px-4 py-2.5 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
        />
        <button
          type="submit"
          disabled={sending || !body.trim()}
          aria-label="Send message"
          className="grid size-10 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Send className="size-4" />
        </button>
      </form>

      {actionsFor && (
        <MessageActionSheet
          message={actionsFor}
          mine={actionsFor.sender_id === userId}
          interactive={conversation.interactive}
          myReaction={actionsFor.reactions.find((reaction) => reaction.user_id === userId)?.emoji}
          onClose={() => setActionsFor(null)}
          onReact={(emoji) => void toggleReaction(actionsFor, emoji)}
          onReply={() => startReply(actionsFor)}
          onCopy={() => void copyMessage(actionsFor)}
          onDeleteForMe={() => void deleteForMe(actionsFor)}
          onDeleteForEveryone={() => void deleteForEveryone(actionsFor)}
        />
      )}
    </div>
  );
}

const QUICK_REACTIONS = ["👍", "❤️", "😂", "😮", "😢", "🙏"];
const MORE_REACTIONS = [
  "🔥",
  "👏",
  "🎉",
  "💪",
  "😍",
  "😊",
  "🤔",
  "😅",
  "😎",
  "🙌",
  "👌",
  "💯",
  "😡",
  "😴",
  "🤝",
  "✅",
];
const LONG_PRESS_MS = 450;
const SWIPE_REPLY_THRESHOLD = 64;
const SWIPE_MAX_OFFSET = 96;

function MessageBubble({
  ref,
  message,
  mine,
  userId,
  canSwipe,
  highlighted,
  quotedSender,
  onOpenActions,
  onReply,
  onJumpTo,
  onToggleReaction,
}: {
  ref: Ref<HTMLDivElement>;
  message: Message;
  mine: boolean;
  userId: string;
  canSwipe: boolean;
  highlighted: boolean;
  quotedSender: string | null;
  onOpenActions: () => void;
  onReply: () => void;
  onJumpTo: (messageId: string) => void;
  onToggleReaction: (emoji: string) => void;
}) {
  const [offset, setOffset] = useState(0);
  const gesture = useRef<{ x: number; y: number; swiping: boolean; offset: number } | null>(null);
  const pressTimer = useRef<number | undefined>(undefined);
  const suppressClick = useRef(false);
  const deleted = Boolean(message.deleted_at);

  useEffect(() => () => window.clearTimeout(pressTimer.current), []);

  function cancelPress() {
    window.clearTimeout(pressTimer.current);
    pressTimer.current = undefined;
  }

  function handlePointerDown(event: PointerEvent<HTMLDivElement>) {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    suppressClick.current = false;
    gesture.current = { x: event.clientX, y: event.clientY, swiping: false, offset: 0 };
    cancelPress();
    pressTimer.current = window.setTimeout(() => {
      pressTimer.current = undefined;
      gesture.current = null;
      suppressClick.current = true;
      navigator.vibrate?.(15);
      onOpenActions();
    }, LONG_PRESS_MS);
  }

  function handlePointerMove(event: PointerEvent<HTMLDivElement>) {
    const state = gesture.current;
    if (!state) return;
    const dx = event.clientX - state.x;
    const dy = event.clientY - state.y;
    if (!state.swiping) {
      if (Math.abs(dx) > 8 || Math.abs(dy) > 8) cancelPress();
      if (canSwipe && dx > 10 && Math.abs(dx) > Math.abs(dy) * 1.5) {
        state.swiping = true;
        event.currentTarget.setPointerCapture(event.pointerId);
      } else if (Math.abs(dy) > 10 || dx < -10) {
        gesture.current = null;
        return;
      }
    }
    if (state.swiping) {
      state.offset = Math.max(0, Math.min(dx, SWIPE_MAX_OFFSET));
      setOffset(state.offset);
    }
  }

  function finishGesture(commit: boolean) {
    cancelPress();
    const state = gesture.current;
    gesture.current = null;
    if (!state?.swiping) return;
    suppressClick.current = true;
    setOffset(0);
    if (commit && state.offset >= SWIPE_REPLY_THRESHOLD) {
      navigator.vibrate?.(10);
      onReply();
    }
  }

  function handleClick() {
    if (suppressClick.current) {
      suppressClick.current = false;
      return;
    }
    onOpenActions();
  }

  const reactionGroups = useMemo(() => {
    const groups = new Map<string, { count: number; mine: boolean }>();
    for (const reaction of message.reactions) {
      const group = groups.get(reaction.emoji) ?? { count: 0, mine: false };
      group.count += 1;
      group.mine ||= reaction.user_id === userId;
      groups.set(reaction.emoji, group);
    }
    return [...groups.entries()];
  }, [message.reactions, userId]);

  return (
    <div
      ref={ref}
      className={`relative flex flex-col rounded-2xl transition-colors duration-700 ${mine ? "items-end" : "items-start"} ${highlighted ? "bg-primary/15" : ""}`}
    >
      <span
        aria-hidden
        className="pointer-events-none absolute left-1 top-1/2 grid size-8 -translate-y-1/2 place-items-center rounded-full bg-secondary text-primary"
        style={{
          opacity: Math.min(offset / SWIPE_REPLY_THRESHOLD, 1),
          transform: `translateY(-50%) scale(${offset >= SWIPE_REPLY_THRESHOLD ? 1.1 : 0.8})`,
        }}
      >
        <Reply className="size-4" />
      </span>
      <div
        role="button"
        tabIndex={0}
        aria-haspopup="dialog"
        aria-label={`Message options for “${message.body.slice(0, 60)}”`}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={() => finishGesture(true)}
        onPointerCancel={() => finishGesture(false)}
        onPointerLeave={() => !gesture.current?.swiping && cancelPress()}
        onClick={handleClick}
        onContextMenu={(event) => {
          event.preventDefault();
          cancelPress();
          gesture.current = null;
          onOpenActions();
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            onOpenActions();
          }
        }}
        style={{
          transform: offset ? `translateX(${offset}px)` : undefined,
          transition: offset ? "none" : "transform 180ms ease-out",
        }}
        className={`max-w-[85%] cursor-pointer touch-pan-y select-none rounded-2xl px-4 py-2.5 shadow-sm [-webkit-touch-callout:none] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary sm:max-w-[70%] ${mine ? "rounded-br-md bg-primary text-primary-foreground" : "rounded-bl-md border bg-card"}`}
      >
        {message.reply_to && !deleted && (
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onJumpTo(message.reply_to!.id);
            }}
            className={`mb-1.5 block w-full rounded-lg border-l-4 px-2.5 py-1.5 text-left text-xs ${mine ? "border-primary-foreground/70 bg-primary-foreground/15" : "border-primary bg-secondary/70"}`}
          >
            <span
              className={`block font-bold ${mine ? "text-primary-foreground" : "text-primary"}`}
            >
              {quotedSender}
            </span>
            <span
              className={`line-clamp-2 ${mine ? "text-primary-foreground/80" : "text-muted-foreground"} ${message.reply_to.deleted ? "italic" : ""}`}
            >
              {message.reply_to.body}
            </span>
          </button>
        )}
        {deleted ? (
          <p
            className={`flex items-center gap-1.5 text-sm italic ${mine ? "text-primary-foreground/80" : "text-muted-foreground"}`}
          >
            <Ban className="size-3.5" />
            {mine ? "You deleted this message" : "This message was deleted"}
          </p>
        ) : (
          <p className="whitespace-pre-wrap text-sm leading-relaxed">{message.body}</p>
        )}
        <div
          className={`mt-1 flex items-center justify-end gap-1 text-[10px] ${mine ? "text-primary-foreground/75" : "text-muted-foreground"}`}
        >
          {formatMessageTime(message.created_at)}
          {mine && !deleted && <CheckCheck className="size-3" />}
        </div>
      </div>
      {reactionGroups.length > 0 && (
        <div
          className={`-mt-2 flex flex-wrap gap-1 px-2 ${mine ? "justify-end" : "justify-start"}`}
        >
          {reactionGroups.map(([emoji, group]) => (
            <button
              key={emoji}
              type="button"
              onClick={() => onToggleReaction(emoji)}
              aria-label={`${emoji} reaction, ${group.count}${group.mine ? ", including you. Tap to remove yours" : ". Tap to react"}`}
              className={`flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-xs shadow-sm transition hover:scale-105 ${group.mine ? "border-primary/50 bg-secondary" : "bg-card"}`}
            >
              <span>{emoji}</span>
              {group.count > 1 && (
                <span className="font-semibold text-muted-foreground">{group.count}</span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function MessageActionSheet({
  message,
  mine,
  interactive,
  myReaction,
  onClose,
  onReact,
  onReply,
  onCopy,
  onDeleteForMe,
  onDeleteForEveryone,
}: {
  message: Message;
  mine: boolean;
  interactive: boolean;
  myReaction: string | undefined;
  onClose: () => void;
  onReact: (emoji: string) => void;
  onReply: () => void;
  onCopy: () => void;
  onDeleteForMe: () => void;
  onDeleteForEveryone: () => void;
}) {
  const [step, setStep] = useState<"menu" | "delete">("menu");
  const [showMore, setShowMore] = useState(false);
  const deleted = Boolean(message.deleted_at);
  const firstActionRef = useRef<HTMLButtonElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  const openedAt = useRef(Date.now());

  useEffect(() => {
    firstActionRef.current?.focus();
    function handleKey(event: globalThis.KeyboardEvent) {
      if (event.key === "Escape") closeRef.current();
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, []);

  function run(action: () => void) {
    action();
    onClose();
  }

  const itemClass =
    "flex w-full items-center gap-3 px-5 py-3.5 text-left text-sm font-medium transition hover:bg-secondary focus-visible:bg-secondary focus-visible:outline-none";

  return (
    <div
      className="fixed inset-0 z-[150] flex items-end justify-center bg-black/45 backdrop-blur-[2px] sm:items-center"
      onClick={() => {
        // Ignore the release of the long press that opened the sheet.
        if (Date.now() - openedAt.current > 350) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Message options"
        onClick={(event) => event.stopPropagation()}
        className="w-full max-w-sm overflow-hidden rounded-t-3xl bg-card pb-[env(safe-area-inset-bottom)] shadow-2xl animate-in slide-in-from-bottom-4 fade-in sm:rounded-3xl"
      >
        <div className="mx-auto mt-2.5 h-1 w-10 rounded-full bg-muted sm:hidden" />
        <p
          className={`mx-5 mt-4 line-clamp-3 rounded-2xl px-4 py-2.5 text-sm ${mine ? "bg-primary text-primary-foreground" : "border bg-background"} ${deleted ? "italic opacity-80" : ""}`}
        >
          {deleted ? "This message was deleted" : message.body}
        </p>

        {step === "menu" ? (
          <>
            {interactive && !deleted && (
              <div className="px-4 pt-4">
                <div className="flex items-center justify-between gap-1 rounded-full border bg-background px-2 py-1.5 shadow-sm">
                  {QUICK_REACTIONS.map((emoji) => (
                    <button
                      key={emoji}
                      type="button"
                      onClick={() => run(() => onReact(emoji))}
                      aria-label={
                        myReaction === emoji ? `Remove ${emoji} reaction` : `React with ${emoji}`
                      }
                      aria-pressed={myReaction === emoji}
                      className={`grid size-10 place-items-center rounded-full text-2xl transition hover:scale-125 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${myReaction === emoji ? "bg-secondary" : ""}`}
                    >
                      {emoji}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => setShowMore((value) => !value)}
                    aria-label={showMore ? "Hide more reactions" : "Show more reactions"}
                    aria-expanded={showMore}
                    className="grid size-10 place-items-center rounded-full bg-secondary text-muted-foreground transition hover:text-primary"
                  >
                    <Plus className={`size-5 transition ${showMore ? "rotate-45" : ""}`} />
                  </button>
                </div>
                {showMore && (
                  <div className="mt-2 grid grid-cols-8 gap-1 rounded-2xl border bg-background p-2">
                    {MORE_REACTIONS.map((emoji) => (
                      <button
                        key={emoji}
                        type="button"
                        onClick={() => run(() => onReact(emoji))}
                        aria-label={
                          myReaction === emoji ? `Remove ${emoji} reaction` : `React with ${emoji}`
                        }
                        aria-pressed={myReaction === emoji}
                        className={`grid aspect-square place-items-center rounded-full text-xl transition hover:scale-125 ${myReaction === emoji ? "bg-secondary" : ""}`}
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div className="mt-3 divide-y border-t">
              {!deleted && (
                <button
                  ref={firstActionRef}
                  type="button"
                  className={itemClass}
                  onClick={() => run(onReply)}
                >
                  <Reply className="size-5 text-primary" /> Reply
                </button>
              )}
              {!deleted && (
                <button type="button" className={itemClass} onClick={() => run(onCopy)}>
                  <Copy className="size-5 text-primary" /> Copy
                </button>
              )}
              {interactive && (
                <button
                  ref={deleted ? firstActionRef : undefined}
                  type="button"
                  className={`${itemClass} text-destructive`}
                  onClick={() => setStep("delete")}
                >
                  <Trash2 className="size-5" /> Delete
                </button>
              )}
              {!interactive && (
                <p className="px-5 py-3 text-xs text-muted-foreground">
                  Reactions and deleting become available once message interactions are enabled.
                </p>
              )}
            </div>
          </>
        ) : (
          <div className="mt-3 border-t">
            <p className="px-5 pt-4 text-base font-bold">Delete message?</p>
            <p className="px-5 pt-1 text-xs text-muted-foreground">
              {mine && !deleted
                ? "Delete it just from your inbox, or remove it for everyone in this chat."
                : "This removes the message from your inbox only."}
            </p>
            <div className="mt-3 divide-y border-t">
              {mine && !deleted && (
                <button
                  type="button"
                  className={`${itemClass} text-destructive`}
                  onClick={() => run(onDeleteForEveryone)}
                >
                  <Trash2 className="size-5" /> Delete for everyone
                </button>
              )}
              <button
                type="button"
                className={`${itemClass} text-destructive`}
                onClick={() => run(onDeleteForMe)}
              >
                <Trash2 className="size-5" /> Delete for me
              </button>
              <button type="button" className={itemClass} onClick={() => setStep("menu")}>
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

async function loadMessagingUsers(): Promise<MessagingUser[]> {
  const { data, error } = await supabase.rpc("list_messaging_users", { _query: null });
  if (error) throw error;
  return data ?? [];
}

async function loadConversations(userId: string): Promise<ConversationView[]> {
  const { data: memberships, error: membershipError } = await supabase
    .from("conversation_participants")
    .select("conversation_id,user_id,last_read_at")
    .eq("user_id", userId);
  if (membershipError) throw membershipError;
  const ids = (memberships ?? []).map((row: Participant) => row.conversation_id);
  if (!ids.length) return [];

  const [
    { data: conversations, error: conversationError },
    { data: allParticipants, error: participantError },
    { messages, interactive },
  ] = await Promise.all([
    supabase
      .from("conversations")
      .select("id,kind,created_at,last_message_at")
      .in("id", ids)
      .order("last_message_at", { ascending: false }),
    supabase
      .from("conversation_participants")
      .select("conversation_id,user_id,last_read_at")
      .in("conversation_id", ids),
    loadMessageRows(ids),
  ]);
  if (conversationError || participantError) throw conversationError ?? participantError;
  const { reactions, hidden } = await loadMessageInteractions(userId, interactive);

  const participantIds = [
    ...new Set((allParticipants ?? []).map((row: Participant) => row.user_id)),
  ];
  const [{ data: directoryUsers, error: directoryError }, conversationProfiles] = await Promise.all(
    [
      supabase.rpc("list_messaging_users", { _query: null }),
      Promise.all(
        participantIds.map(async (participantId) => {
          const { data, error } = await supabase.rpc("get_messaging_member_profile", {
            _user_id: participantId,
          });
          if (error) throw error;
          return data?.[0] ?? null;
        }),
      ),
    ],
  );
  if (directoryError) throw directoryError;
  const roleMap = new Map(
    (directoryUsers ?? []).map((member) => [member.id, member.role] as const),
  );
  const profileMap = new Map<string, Profile>(
    conversationProfiles
      .filter((profile): profile is NonNullable<typeof profile> => profile !== null)
      .map((profile) => [
        profile.id,
        {
          id: profile.id,
          full_name: profile.full_name,
          avatar_path: profile.avatar_path,
          role: profile.role ?? roleMap.get(profile.id) ?? null,
        },
      ]),
  );
  const reactionMap = new Map<string, Reaction[]>();
  for (const reaction of reactions) {
    const existing = reactionMap.get(reaction.message_id) ?? [];
    existing.push(reaction);
    reactionMap.set(reaction.message_id, existing);
  }
  const rowsById = new Map(messages.map((row) => [row.id, row] as const));
  const messageMap = new Map<string, Message[]>();
  for (const row of messages) {
    if (hidden.has(row.id)) continue;
    const quoted = row.reply_to_id ? rowsById.get(row.reply_to_id) : undefined;
    const message: Message = {
      ...row,
      reply_to: quoted
        ? {
            id: quoted.id,
            sender_id: quoted.sender_id,
            body: quoted.body,
            deleted: Boolean(quoted.deleted_at),
          }
        : null,
      reactions: row.deleted_at ? [] : (reactionMap.get(row.id) ?? []),
    };
    const existing = messageMap.get(row.conversation_id) ?? [];
    existing.push(message);
    messageMap.set(row.conversation_id, existing);
  }

  return ((conversations ?? []) as Conversation[]).map((conversation) => {
    const participants = ((allParticipants ?? []) as Participant[]).filter(
      (row) => row.conversation_id === conversation.id,
    );
    const otherProfiles = participants
      .filter((row) => row.user_id !== userId)
      .map((row) => profileMap.get(row.user_id))
      .filter(Boolean) as Profile[];
    const conversationMessages = messageMap.get(conversation.id) ?? [];
    const latest = conversationMessages.at(-1) ?? null;
    const ownMembership = participants.find((row) => row.user_id === userId);
    const unread = conversationMessages.filter(
      (message) =>
        message.sender_id !== userId &&
        (!ownMembership?.last_read_at || message.created_at > ownMembership.last_read_at),
    ).length;
    return {
      ...conversation,
      participants,
      messages: conversationMessages,
      otherProfiles,
      latest,
      unread,
      displayName:
        otherProfiles.map((profile) => profile.full_name || "VITO Physio member").join(", ") ||
        "VITO Physio member",
      avatarPath: otherProfiles[0]?.avatar_path ?? null,
      otherUserId: otherProfiles.length === 1 ? (otherProfiles[0]?.id ?? null) : null,
      otherRole: otherProfiles.length === 1 ? (otherProfiles[0]?.role ?? null) : null,
      interactive,
    };
  });
}

type MessageRow = Omit<Message, "reply_to" | "reactions">;

async function loadMessageRows(
  conversationIds: string[],
): Promise<{ messages: MessageRow[]; interactive: boolean }> {
  const extended = await supabase
    .from("messages")
    .select("id,conversation_id,sender_id,body,created_at,reply_to_id,deleted_at")
    .in("conversation_id", conversationIds)
    .order("created_at", { ascending: true });
  if (!extended.error) return { messages: extended.data ?? [], interactive: true };
  if (!isMissingSchemaError(extended.error)) throw extended.error;

  // The interactions migration has not been applied yet: fall back to plain messages.
  const basic = await supabase
    .from("messages")
    .select("id,conversation_id,sender_id,body,created_at")
    .in("conversation_id", conversationIds)
    .order("created_at", { ascending: true });
  if (basic.error) throw basic.error;
  return {
    messages: (basic.data ?? []).map((row) => ({ ...row, reply_to_id: null, deleted_at: null })),
    interactive: false,
  };
}

async function loadMessageInteractions(userId: string, interactive: boolean) {
  if (!interactive) return { reactions: [] as Reaction[], hidden: new Set<string>() };
  // RLS limits both tables to messages in the signed-in user's conversations.
  const [reactions, hidden] = await Promise.all([
    supabase.from("message_reactions").select("message_id,user_id,emoji"),
    supabase.from("message_hidden").select("message_id").eq("user_id", userId),
  ]);
  if (reactions.error && !isMissingSchemaError(reactions.error)) throw reactions.error;
  if (hidden.error && !isMissingSchemaError(hidden.error)) throw hidden.error;
  return {
    reactions: (reactions.data ?? []) as Reaction[],
    hidden: new Set((hidden.data ?? []).map((row) => row.message_id)),
  };
}

function isMissingSchemaError(error: { code?: string; message?: string }) {
  return (
    ["42703", "42P01", "PGRST204", "PGRST205"].includes(error.code ?? "") ||
    /column .* does not exist|relation .* does not exist|schema cache/i.test(error.message ?? "")
  );
}

function conversationErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  if (/relation .* does not exist|schema cache|could not find|PGRST205/i.test(message)) {
    return "Messaging storage is not connected yet. Apply the messaging migration, then try again.";
  }
  return "Unable to load your conversations. Please try again.";
}

function userPickerErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  if (/function .*list_messaging_users|schema cache|PGRST202/i.test(message)) {
    return "The member directory is not connected yet. Apply the latest messaging migration, then try again.";
  }
  return "Unable to load registered users. Please try again.";
}

const ROLE_LABEL: Record<string, string> = {
  super_admin: "Super admin",
  vito_admin: "VITO admin",
  clinical_professional: "Clinical professional",
  clinical_supervisor: "Clinical supervisor",
  school_admin: "School admin",
  coach: "Coach",
  athlete: "Athlete",
  parent: "Parent / guardian",
};

function roleLabel(role: string | null | undefined) {
  if (!role) return "VITO Physio member";
  return ROLE_LABEL[role] ?? role.replaceAll("_", " ");
}

function messagingUserDisplayName(member: MessagingUser) {
  return member.full_name?.trim() || "VITO Physio member";
}

function filterLabel(filter: Filter) {
  return filter.charAt(0).toUpperCase() + filter.slice(1);
}

function formatChatTime(value: string) {
  const date = new Date(value);
  const now = new Date();
  return date.toDateString() === now.toDateString()
    ? date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    : date.toLocaleDateString([], { month: "short", day: "numeric" });
}

function formatMessageTime(value: string) {
  return new Date(value).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString([], { weekday: "long", month: "long", day: "numeric" });
}

function sameDay(left: string, right: string) {
  return new Date(left).toDateString() === new Date(right).toDateString();
}

function EmptyInbox({ hasSearch }: { hasSearch: boolean }) {
  return (
    <div className="flex h-full min-h-72 flex-col items-center justify-center px-8 text-center">
      <span className="grid size-14 place-items-center rounded-2xl bg-secondary text-primary">
        <UserRound className="size-7" />
      </span>
      <h2 className="mt-4 font-bold">
        {hasSearch ? "No matching conversations" : "No conversations yet"}
      </h2>
      <p className="mt-2 max-w-xs text-sm text-muted-foreground">
        {hasSearch
          ? "Try a different search or filter."
          : "Your messages with athletes, clinicians, coaches, and other VITO Physio members will appear here."}
      </p>
    </div>
  );
}
