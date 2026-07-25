import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { limparBadge } from "@/lib/pwa";
import type { Database } from "@/integrations/supabase/types";

export type Notification = Database["public"]["Tables"]["notifications"]["Row"];

export function useNotifications() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const userId = user?.id;
  const queryKey = ["notifications", userId] as const;
  const unreadKey = ["notifications-unread", userId] as const;

  const {
    data: notifications = [],
    isLoading,
    error,
  } = useQuery<Notification[]>({
    queryKey,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("notifications")
        .select("*")
        .eq("user_id", userId!)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data ?? []) as Notification[];
    },
    enabled: !!userId,
  });

  // O contador do sino NÃO pode sair da lista acima: ela é cortada em 50 itens,
  // então uma não-lida mais antiga (fora dos 50) sumia da lista mas continuava
  // no banco, e o número ficava dessincronizado da realidade. Aqui contamos as
  // não-lidas direto no banco (head/count), sem trazer linha nenhuma.
  const { data: unreadCount = 0 } = useQuery<number>({
    queryKey: unreadKey,
    queryFn: async () => {
      const { count, error } = await supabase
        .from("notifications")
        .select("*", { count: "exact", head: true })
        .eq("user_id", userId!)
        .eq("read", false);
      if (error) throw error;
      return count ?? 0;
    },
    enabled: !!userId,
  });

  // Toda alteração precisa revalidar a lista E a contagem, senão o badge fica
  // preso num valor velho.
  const invalidar = () => {
    void queryClient.invalidateQueries({ queryKey });
    void queryClient.invalidateQueries({ queryKey: unreadKey });
  };

  const markAsRead = useMutation({
    mutationFn: async (id: string): Promise<void> => {
      const { error } = await supabase
        .from("notifications")
        .update({ read: true })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidar,
  });

  const markAllAsRead = useMutation({
    mutationFn: async (): Promise<void> => {
      if (!userId) throw new Error("Not authenticated");
      const { error } = await supabase
        .from("notifications")
        .update({ read: true })
        .eq("user_id", userId)
        .eq("read", false);
      if (error) throw error;
    },
    onSuccess: () => {
      // Zerou as não-lidas: tira também a bolinha do ícone do app, senão o PWA
      // segue mostrando "1 em aberto" fantasma mesmo sem nada pra ler.
      limparBadge();
      invalidar();
    },
  });

  const deleteOne = useMutation({
    mutationFn: async (id: string): Promise<void> => {
      const { error } = await supabase.from("notifications").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidar,
  });

  const clearAll = useMutation({
    mutationFn: async (): Promise<void> => {
      if (!userId) throw new Error("Not authenticated");
      const { error } = await supabase.from("notifications").delete().eq("user_id", userId);
      if (error) throw error;
    },
    onSuccess: () => {
      limparBadge();
      invalidar();
    },
  });

  return { notifications, unreadCount, isLoading, error, markAsRead, markAllAsRead, deleteOne, clearAll };
}
