import { useMemo } from "react";
import { useActiveAccount } from "@/contexts/AccountContext";
import { useProfile } from "@/hooks/useProfile";
import { calcularSequencia, datasPublicadas, type Sequencia } from "@/lib/sequencia";

/** Sequência de semanas batendo a meta (Início e Relatórios usam a mesma conta). */
export function useSequenciaSemanal(
  posts: { status?: string | null; published_at?: string | null }[],
  meta: number | null | undefined,
  hoje: string,
): Sequencia {
  return useMemo(() => calcularSequencia(datasPublicadas(posts), meta ?? 1, hoje), [posts, meta, hoje]);
}

/**
 * Criador de conteúdo na própria conta (Walter, 27/11/2026: a sequência e o
 * "O que travou?" são só do criador). Fica de fora: social mídia (conta de
 * gestor ou dentro de um cliente), quem atua como time e o parceiro de produção.
 */
export function useEhCriadorNaPropriaConta(): boolean {
  const { profile } = useProfile();
  const { isManaging, actingAsTeam } = useActiveAccount();
  const p = profile as { account_type?: string | null; parceiro_role?: string | null } | null;
  if (!p || isManaging || actingAsTeam) return false;
  if (p.account_type === "manager") return false;
  if (p.parceiro_role) return false;
  return true;
}
