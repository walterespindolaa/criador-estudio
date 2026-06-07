import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export type ModuleStatus = "active" | "past_due" | "canceled" | "none";

export type ModuleCatalogItem = {
  code: string;
  name: string;
  description: string | null;
  price_cents: number;
  active: boolean;
  sort_order: number;
  coming_soon: boolean;
};

export type ModuleWithStatus = ModuleCatalogItem & {
  status: ModuleStatus;
  current_period_end: string | null;
};

export type ContractCompany = {
  personType?: "pj" | "pf";
  legalName?: string;
  document?: string;       // CNPJ (pj) ou CPF (pf)
  address?: string;
  cep?: string;
  city?: string;
  uf?: string;
  repName?: string;
  repNationality?: string;
  repProfession?: string;
  repRg?: string;
  repCpf?: string;
};

export type ManagerProfile = {
  id: string;
  user_id: string;
  full_name: string | null;
  business_name: string | null;
  tax_id: string | null;
  whatsapp: string | null;
  billing_email: string | null;
  instagram_handle: string | null;
  niche: string | null;
  client_range: string | null;
  contract_company?: ContractCompany | null;
};

export type ManagerProfileInput = Omit<ManagerProfile, "id" | "user_id">;

// types.ts ainda não tem essas tabelas — cast (igual usePartner/useApprovals).
type AnyTable = (table: string) => ReturnType<typeof supabase.from>;
const sbFrom = supabase.from.bind(supabase) as unknown as AnyTable;

export function useModules() {
  const { user } = useAuth();
  const { data, isLoading } = useQuery<ModuleWithStatus[]>({
    queryKey: ["modules", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const [catRes, entRes] = await Promise.all([
        sbFrom("modules").select("*").eq("active", true).order("sort_order"),
        sbFrom("module_entitlements")
          .select("module_code, status, current_period_end")
          .eq("manager_id", user!.id),
      ]);
      if (catRes.error) throw catRes.error;
      if (entRes.error) throw entRes.error;
      const cat = (catRes.data ?? []) as unknown as ModuleCatalogItem[];
      const ent = (entRes.data ?? []) as unknown as {
        module_code: string; status: string; current_period_end: string | null;
      }[];
      const entMap = new Map(ent.map((e) => [e.module_code, e]));
      return cat.map((m) => {
        const e = entMap.get(m.code);
        const status: ModuleStatus = e
          ? (e.status === "active" || e.status === "past_due" ? (e.status as ModuleStatus) : "none")
          : "none";
        return { ...m, status, current_period_end: e?.current_period_end ?? null };
      });
    },
  });
  return { modules: data ?? [], isLoading };
}

export function useManagerProfile() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const queryKey = ["manager-profile", user?.id] as const;

  const { data: profile, isLoading } = useQuery<ManagerProfile | null>({
    queryKey,
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await sbFrom("manager_profiles").select("*").eq("user_id", user!.id).maybeSingle();
      if (error) throw error;
      return (data as unknown as ManagerProfile) ?? null;
    },
  });

  const save = useMutation({
    mutationFn: async (input: ManagerProfileInput) => {
      if (!user?.id) throw new Error("Sem sessão");
      const payload = { ...input, user_id: user.id, updated_at: new Date().toISOString() };
      const { error } = await sbFrom("manager_profiles").upsert(payload as never, { onConflict: "user_id" });
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
    onError: () => toast.error("Erro ao salvar cadastro."),
  });

  return { profile: profile ?? null, isLoading, save, hasProfile: !!profile };
}

export function useModuleCheckout() {
  return useMutation({
    mutationFn: async (moduleCode: string) => {
      const { data, error } = await supabase.functions.invoke("create-module-checkout", {
        body: { module_code: moduleCode },
      });
      if (error) throw error;
      const url = (data as { url?: string } | null)?.url;
      if (!url) throw new Error("checkout sem URL");
      window.location.href = url;
    },
    onError: () => toast.error("Não foi possível iniciar o checkout. Tente novamente."),
  });
}
