import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useBioAlvo } from "@/contexts/BioAlvoContext";
import { toast } from "sonner";

export type BioLead = {
  id: string;
  user_id: string;
  page_id?: string | null;
  name: string | null;
  email: string | null;
  phone: string | null;
  source: string;
  created_at: string;
};

// types.ts não tem bio_leads, cast (padrão usePartner/useModules).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sbFrom = (table: string) => (supabase as any).from(table);

export function useBioLeads() {
  const { user } = useAuth();
  const alvo = useBioAlvo();
  const qc = useQueryClient();

  // Página de cliente: os leads dela ficam sob o user_id da gestora, então o
  // filtro tem que ser pela PÁGINA, senão a lista misturaria os leads de todos
  // os clientes num só lugar.
  const pageId = alvo?.tipo === "ficha" ? alvo.pageId : null;
  const ownerId = alvo?.tipo === "conta" ? alvo.ownerId : user?.id;

  const query = useQuery({
    queryKey: ["bio-leads", pageId ?? ownerId],
    enabled: !!(pageId || ownerId),
    queryFn: async () => {
      let q = sbFrom("bio_leads").select("*");
      q = pageId ? q.eq("page_id", pageId) : q.eq("user_id", ownerId!).is("page_id", null);
      const { data, error } = await q.order("created_at", { ascending: false });
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
