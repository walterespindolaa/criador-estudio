import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export type BioLead = {
  id: string;
  user_id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  source: string;
  created_at: string;
};

// types.ts não tem bio_leads — cast (padrão usePartner/useModules).
type AnyTable = (table: string) => ReturnType<typeof supabase.from>;
const sbFrom = supabase.from.bind(supabase) as unknown as AnyTable;

export function useBioLeads() {
  const { user } = useAuth();
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ["bio-leads", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await sbFrom("bio_leads")
        .select("*")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as BioLead[];
    },
  });

  const deleteLead = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await sbFrom("bio_leads").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["bio-leads"] });
      toast.success("Lead removido.");
    },
    onError: () => toast.error("Erro ao remover lead."),
  });

  return { leads: query.data ?? [], isLoading: query.isLoading, deleteLead };
}
