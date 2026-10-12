import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { aindaNaoExisteNoBanco } from "@/hooks/useParceiro";

/* ═══════════════════════════════════════════════════════════════════════════
   HISTÓRICO DA CRIA IA (Walter, 12/10/2026)

   Antes a conversa vivia só no estado da tela e sumia ao fechar o painel.
   Agora cada conversa é uma linha em `cria_ia_conversas` (migration
   20261012000001), da pessoa logada. O painel lista as 10 mais recentes.
   A tabela não está no types.ts travado: tudo pelo cast sbFrom, como no resto.
   Se a migration ainda não rodou, o histórico fica vazio e a conversa segue
   funcionando, só não é guardada.
   ═══════════════════════════════════════════════════════════════════════════ */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sbFrom = (t: string) => (supabase as any).from(t);

export type IdeiaCria = { titulo: string; descricao?: string; texto_tela?: string; formato?: string };

export type MensagemCria = {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: number;
  /** Ideias que a IA devolveu estruturadas: viram cartões com ações. */
  ideias?: IdeiaCria[];
  /** Próximos passos sugeridos pela IA: viram botões embaixo da resposta. */
  sugestoes?: string[];
};

export type ConversaCria = {
  id: string;
  titulo: string;
  mensagens: MensagemCria[];
  updated_at: string;
};

export function useCriaConversas(ativo: boolean) {
  const { user } = useAuth();
  return useQuery<ConversaCria[]>({
    queryKey: ["cria-ia-conversas", user?.id],
    enabled: !!user && ativo,
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await sbFrom("cria_ia_conversas")
        .select("id, titulo, mensagens, updated_at")
        .order("updated_at", { ascending: false })
        .limit(10);
      if (error) {
        if (aindaNaoExisteNoBanco(error.message)) return [];
        throw error;
      }
      return (data ?? []) as ConversaCria[];
    },
  });
}

/** Grava a conversa inteira. Sem id, cria a linha e devolve o id novo. Falha
 *  aqui nunca atrapalha a conversa: só não entra no histórico. */
export function useSalvarConversa() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (v: { id: string | null; titulo: string; mensagens: MensagemCria[] }): Promise<string | null> => {
      const linha = { titulo: v.titulo.slice(0, 80) || "Conversa", mensagens: v.mensagens, updated_at: new Date().toISOString() };
      if (v.id) {
        const { error } = await sbFrom("cria_ia_conversas").update(linha).eq("id", v.id);
        if (error) throw error;
        return v.id;
      }
      const { data, error } = await sbFrom("cria_ia_conversas").insert(linha).select("id").single();
      if (error) throw error;
      return (data as { id: string }).id;
    },
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ["cria-ia-conversas", user?.id] }); },
    onError: (e: Error) => {
      if (!aindaNaoExisteNoBanco(e.message)) console.warn("Cria IA: não salvou a conversa", e);
    },
  });
}

/** "Hoje", "Ontem" ou dd/mm, no fuso do Brasil. */
export function quandoFoi(iso: string): string {
  const fmt = (d: Date) => d.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit" });
  const dia = fmt(new Date(iso));
  const agora = new Date();
  if (dia === fmt(agora)) return "Hoje";
  if (dia === fmt(new Date(agora.getTime() - 86_400_000))) return "Ontem";
  return dia;
}
