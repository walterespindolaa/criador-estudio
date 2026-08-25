import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useActiveAccount } from "@/contexts/AccountContext";
import { toast } from "sonner";

/* ═══════════════════════════════════════════════════════════════════════════
   AS PÁGINAS DE LINK NA BIO DOS CLIENTES

   Uma por ficha do CRM. A página nasce vazia e SEM endereço: só existe de
   verdade depois que a gestora escolhe o nome e salva. Enquanto isso ela é um
   rascunho que ninguém consegue abrir.
   ═══════════════════════════════════════════════════════════════════════════ */

export type BioPage = {
  id: string;
  manager_id: string;
  crm_client_id: string;
  slug: string | null;
  settings: Record<string, unknown>;
  views: number;
  created_at: string;
  updated_at: string;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sbFrom = (table: string) => (supabase as any).from(table);

const tabelaFaltando = (msg: string) => /does not exist|schema cache|could not find/i.test(msg ?? "");

/** Todas as páginas da agência (pra listagem do Cria Gestão). */
export function useBioPages() {
  const { agencyOwnerId } = useActiveAccount();
  return useQuery<BioPage[]>({
    queryKey: ["bio-pages", agencyOwnerId],
    enabled: !!agencyOwnerId,
    queryFn: async () => {
      const { data, error } = await sbFrom("bio_pages")
        .select("*").eq("manager_id", agencyOwnerId).order("created_at", { ascending: false });
      if (error) {
        if (tabelaFaltando(error.message)) return [];
        throw error;
      }
      return (data ?? []) as BioPage[];
    },
  });
}

/** A página de UM cliente (null enquanto ela não existir). */
export function useBioPage(crmClientId?: string | null) {
  const { agencyOwnerId } = useActiveAccount();
  return useQuery<BioPage | null>({
    queryKey: ["bio-page", agencyOwnerId, crmClientId ?? ""],
    enabled: !!agencyOwnerId && !!crmClientId,
    queryFn: async () => {
      const { data, error } = await sbFrom("bio_pages")
        .select("*").eq("crm_client_id", crmClientId).maybeSingle();
      if (error) {
        if (tabelaFaltando(error.message)) return null;
        throw error;
      }
      return (data as BioPage) ?? null;
    },
  });
}

export function useCreateBioPage() {
  const { agencyOwnerId } = useActiveAccount();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (crmClientId: string): Promise<BioPage> => {
      if (!agencyOwnerId) throw new Error("Sem sessão");
      const { data, error } = await sbFrom("bio_pages")
        .insert({ manager_id: agencyOwnerId, crm_client_id: crmClientId })
        .select("*").single();

      // Já existe uma página pra este cliente (o índice único garante isso).
      // Clicar de novo é sinal de que a tela não atualizou, e não de que a
      // pessoa quer duas páginas. Devolve a que existe em vez de dar erro.
      if (error && /duplicate key|unique constraint|23505/i.test(error.message ?? "")) {
        const existente = await sbFrom("bio_pages").select("*").eq("crm_client_id", crmClientId).maybeSingle();
        if (existente.data) return existente.data as BioPage;
      }
      if (error) throw error;
      return data as BioPage;
    },
    // Prefixo, não a chave inteira: a chave é ["bio-page", agencyOwnerId, id],
    // e invalidar ["bio-page", id] não casava com nada. Resultado: a página
    // nascia no banco e a tela continuava oferecendo "Criar a página".
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["bio-page"] });
      void qc.invalidateQueries({ queryKey: ["bio-pages"] });
    },
    onError: (e: Error) => {
      const msg = e?.message ?? "";
      console.error("[bio_pages] falha ao criar:", e);
      toast.error(
        tabelaFaltando(msg)
          ? "Rode a migration do link na bio (20260825000003) no Supabase pra liberar isso."
          : /row-level security|permission denied/i.test(msg)
            ? "Sem permissão pra criar a página deste cliente. Rode a migration mais recente e tente de novo."
            : msg || "Não consegui criar a página agora.",
        { duration: 8000 });
    },
  });
}

/** Endereço e visitas das bios que moram na CONTA do cliente (quem tem Cria). */
export function useBiosDasContas() {
  const { agencyOwnerId } = useActiveAccount();
  return useQuery<Record<string, { slug: string | null; views: number }>>({
    queryKey: ["bios-das-contas", agencyOwnerId],
    enabled: !!agencyOwnerId,
    staleTime: 60_000,
    queryFn: async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any).rpc("manager_clients_bio");
      if (error) {
        if (tabelaFaltando(error.message)) return {};
        throw error;
      }
      const m: Record<string, { slug: string | null; views: number }> = {};
      for (const r of (data ?? []) as { cria_owner_id: string; bio_slug: string | null; bio_views: number | null }[]) {
        m[r.cria_owner_id] = { slug: r.bio_slug, views: Number(r.bio_views ?? 0) };
      }
      return m;
    },
  });
}

/** Quantos leads cada página já capturou (pra listagem). */
export function useBioPageLeadCounts() {
  const { agencyOwnerId } = useActiveAccount();
  return useQuery<Record<string, number>>({
    queryKey: ["bio-page-leads-count", agencyOwnerId],
    enabled: !!agencyOwnerId,
    queryFn: async () => {
      const { data, error } = await sbFrom("bio_leads")
        .select("page_id").eq("user_id", agencyOwnerId).not("page_id", "is", null);
      if (error) {
        if (tabelaFaltando(error.message)) return {};
        throw error;
      }
      const contagem: Record<string, number> = {};
      for (const r of (data ?? []) as { page_id: string }[]) {
        contagem[r.page_id] = (contagem[r.page_id] ?? 0) + 1;
      }
      return contagem;
    },
  });
}
