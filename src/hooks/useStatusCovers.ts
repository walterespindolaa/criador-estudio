import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useActiveAccount } from "@/contexts/AccountContext";
import { toast } from "sonner";

type AnyTable = (table: string) => ReturnType<typeof supabase.from>;
const sbFrom = supabase.from.bind(supabase) as unknown as AnyTable;

export type StatusCover = {
  id: string; user_id: string; status_key: string;
  cover_type: "gradient" | "solid" | "image";
  cover_from: string | null; cover_to: string | null;
  image_url: string | null; label: string | null;
};
export type StatusCoverInput = {
  status_key: string; cover_type: "gradient" | "solid" | "image";
  cover_from?: string | null; cover_to?: string | null; label?: string | null;
};

export function useStatusCovers() {
  const { activeAccountId } = useActiveAccount();
  const qc = useQueryClient();

  const { data: covers = [] } = useQuery({
    queryKey: ["status_covers", activeAccountId],
    enabled: !!activeAccountId,
    queryFn: async () => {
      const { data, error } = await sbFrom("status_covers").select("*").eq("user_id", activeAccountId);
      if (error) throw error;
      return (data ?? []) as StatusCover[];
    },
  });

  const byStatus = Object.fromEntries(
    (covers as StatusCover[]).map((c) => [c.status_key, c])
  ) as Record<string, StatusCover>;

  const save = useMutation({
    mutationFn: async (input: StatusCoverInput) => {
      const payload = { ...input, user_id: activeAccountId };
      const { error } = await sbFrom("status_covers").upsert(payload as never, { onConflict: "user_id,status_key" });
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["status_covers", activeAccountId] }); toast.success("Capa atualizada"); },
    onError: () => toast.error("Não foi possível salvar a capa"),
  });

  const reset = useMutation({
    mutationFn: async (status_key: string) => {
      const { error } = await sbFrom("status_covers").delete().eq("user_id", activeAccountId).eq("status_key", status_key);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["status_covers", activeAccountId] }); toast.success("Capa restaurada"); },
  });

  return { byStatus, saveCover: save.mutate, resetCover: reset.mutate, isSaving: save.isPending };
}
