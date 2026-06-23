import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

type AnyTable = (table: string) => ReturnType<typeof supabase.from>;
const sbFrom = supabase.from.bind(supabase) as unknown as AnyTable;

export type Feedback = {
  id: string;
  user_id: string | null;
  type: "bug" | "ideia" | "outro";
  message: string;
  status: "novo" | "visto" | "resolvido";
  url: string | null;
  created_at: string;
};

// Usuário envia feedback.
export function useSendFeedback() {
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (input: { type: string; message: string }) => {
      if (!user) throw new Error("Sem sessão");
      const { error } = await sbFrom("feedbacks").insert({
        user_id: user.id,
        type: input.type,
        message: input.message,
        url: typeof window !== "undefined" ? window.location.href : null,
      } as never);
      if (error) throw error;
    },
    onSuccess: () => toast.success("Feedback enviado. Obrigado!"),
    onError: () => toast.error("Não foi possível enviar o feedback."),
  });
}

// Admin lê e atualiza status.
export function useFeedbacksAdmin() {
  const qc = useQueryClient();
  const list = useQuery<Feedback[]>({
    queryKey: ["feedbacks-admin"],
    queryFn: async () => {
      const { data, error } = await sbFrom("feedbacks").select("*").order("created_at", { ascending: false }).limit(300);
      if (error) throw error;
      return (data ?? []) as unknown as Feedback[];
    },
  });
  const setStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await sbFrom("feedbacks").update({ status } as never).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["feedbacks-admin"] }),
    onError: () => toast.error("Erro ao atualizar."),
  });
  return { feedbacks: list.data ?? [], isLoading: list.isLoading, setStatus };
}
