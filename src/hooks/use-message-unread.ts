import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const messageUnreadKey = (userId: string) => ["message-unread-count", userId] as const;

/**
 * Unread chat messages for the Messages icon. Fully separate from the notification bell:
 * driven by messages + conversation_participants.last_read_at, never by `notifications`.
 */
export function useMessageUnreadCount(userId: string | undefined) {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: messageUnreadKey(userId ?? ""),
    enabled: Boolean(userId),
    queryFn: async () => {
      const { data, error } = await supabase.rpc("message_unread_count");
      if (error) return 0;
      return data ?? 0;
    },
    refetchInterval: 60000,
  });

  useEffect(() => {
    if (!userId) return;
    const refresh = () => void queryClient.invalidateQueries({ queryKey: messageUnreadKey(userId) });
    const channel = supabase
      .channel(`message-unread-${userId}-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, refresh)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "messages" }, refresh)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "conversation_participants", filter: `user_id=eq.${userId}` },
        refresh,
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "message_hidden", filter: `user_id=eq.${userId}` },
        refresh,
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [queryClient, userId]);

  return query.data ?? 0;
}
