import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useActiveAccount } from "@/contexts/AccountContext";

/* NÍVEIS DE ACESSO POR MÓDULO (Walter, 19/10/2026; mockup aprovado).
   ver    = enxerga, não cria, não edita, não arrasta;
   editar = cria e edita, sobe mídia, comenta, muda coluna;
   total  = editar + apagar + mandar pro cliente aprovar + gerar link.
   A dona da conta é sempre total. O banco confere de novo (triggers
   *_guard_nivel), então isto aqui é só pra não mostrar botão que vai falhar. */
export type NivelModulo = "ver" | "editar" | "total";

export type PermissaoModulo = {
  nivel: NivelModulo | null;
  carregando: boolean;
  podeVer: boolean;
  podeEditar: boolean;
  podeTotal: boolean;
};

const PESO: Record<NivelModulo, number> = { ver: 1, editar: 2, total: 3 };

export function permissaoDoNivel(nivel: NivelModulo | null, carregando = false): PermissaoModulo {
  const p = nivel ? PESO[nivel] : 0;
  return { nivel, carregando, podeVer: p >= 1, podeEditar: p >= 2, podeTotal: p >= 3 };
}

export function usePermissaoModulo(code: string): PermissaoModulo {
  const { actingAsTeam, agencyOwnerId } = useActiveAccount();
  const q = useQuery<NivelModulo | null>({
    queryKey: ["nivel-modulo", agencyOwnerId, code],
    enabled: actingAsTeam && !!agencyOwnerId,
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await (supabase.rpc as unknown as (fn: string, a: Record<string, unknown>) => Promise<{ data: unknown; error: unknown }>)(
        "member_nivel", { _manager: agencyOwnerId, _code: code });
      if (error) throw error;
      return (data as NivelModulo | null) ?? null;
    },
  });
  // Fora do modo equipe (dona, criadora, gestora de cliente) não há nível: tudo liberado.
  if (!actingAsTeam) return permissaoDoNivel("total");
  // Carregando: trata como editar pra não piscar botões; o banco barra o que não pode.
  if (q.isLoading) return permissaoDoNivel("editar", true);
  return permissaoDoNivel(q.data ?? null);
}
