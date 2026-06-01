import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export type PartnerStatus = "pending" | "approved" | "rejected";

export type Partner = {
  id: string;
  user_id: string;
  full_name: string;
  cpf: string;
  phone: string;
  pix_key: string;
  instagram_handle: string | null;
  current_clients: string | null;
  time_active: string | null;
  status: PartnerStatus;
  created_at: string;
  approved_at: string | null;
  approved_by: string | null;
};

export type PartnerRequestInput = {
  full_name: string;
  cpf: string;
  phone: string;
  pix_key: string;
  instagram_handle: string;
  current_clients: string;
  time_active: string;
};

// `partners` ainda não está no types.ts gerado — cast no acesso pra não quebrar tsc.
type AnyTable = (table: string) => ReturnType<typeof supabase.from>;
const sbFrom = supabase.from as unknown as AnyTable;

export function usePartner() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const userId = user?.id;
  const queryKey = ["partner", userId] as const;

  const { data: partner = null, isLoading } = useQuery<Partner | null>({
    queryKey,
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await sbFrom("partners")
        .select("*")
        .eq("user_id", userId!)
        .maybeSingle();
      if (error) throw error;
      return (data ?? null) as Partner | null;
    },
  });

  const requestPartner = useMutation({
    mutationFn: async (input: PartnerRequestInput): Promise<Partner> => {
      if (!userId) throw new Error("Not authenticated");
      const payload = {
        user_id: userId,
        full_name: input.full_name,
        cpf: input.cpf,
        phone: input.phone,
        pix_key: input.pix_key,
        instagram_handle: input.instagram_handle || null,
        current_clients: input.current_clients,
        time_active: input.time_active,
        status: "pending",
      };
      const { data, error } = await sbFrom("partners")
        .insert(payload)
        .select()
        .single();
      if (error) throw error;
      return data as Partner;
    },
    onSuccess: () => {
      toast.success("Solicitação enviada! Você será avisada após a análise.");
      queryClient.invalidateQueries({ queryKey });
    },
    onError: () => {
      toast.error("Erro ao enviar solicitação. Tente novamente.");
    },
  });

  return {
    partner,
    isPartner: partner?.status === "approved",
    isPending: partner?.status === "pending",
    isLoading,
    requestPartner,
  };
}
