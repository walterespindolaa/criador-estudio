import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useActiveAccount } from "@/contexts/AccountContext";

/* ═══════════════════════════════════════════════════════════════════════════
   METAS EM 3 NÍVEIS (31/08)

   A tabela é a structured_goals de sempre; o que muda é o ESCOPO:
   · 'operacao': metas da operação da social mídia (aba Metas do Cria Gestão).
     user_id = dona da agência; mostra "criada em" e "concluída em".
   · 'cliente': metas de um cliente do Cria Post, cadastradas na estratégia.
   · 'pessoal': as metas do criador (o hook antigo useGoals continua servindo
     a tela dele; este aqui só entra pro auto-update via Instagram).
   Colunas novas fora dos tipos gerados: acesso via cast, padrão do projeto.
   ═══════════════════════════════════════════════════════════════════════════ */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sbFrom = (t: string) => (supabase as any).from(t);

export type MetaScope = "operacao" | "cliente" | "pessoal";

export type Meta = {
  id: string;
  user_id: string;
  title: string;
  category: string;
  target_value: number | null;
  current_value: number | null;
  status: string;
  start_date: string | null;
  end_date: string | null;
  observation: string | null;
  created_at: string | null;
  scope: MetaScope;
  external_client_id: string | null;
  concluida_em: string | null;
  auto_source: string | null;
};

export type MetaInput = {
  title: string;
  category: string;
  target_value: number | null;
  current_value?: number | null;
  end_date?: string | null;
  observation?: string | null;
};

/** Migration ainda não rodou: lista vazia em vez de tela quebrada. */
const faltaMigration = (e: { code?: string; message?: string } | null) =>
  !!e && /42P01|42703|PGRST204|PGRST205/.test(e.code ?? "") || /does not exist|schema cache/i.test(e?.message ?? "");

export const CATEGORIAS_META: Array<{ key: string; label: string }> = [
  { key: "geral", label: "Geral" },
  { key: "clientes", label: "Clientes" },
  { key: "receita", label: "Receita" },
  { key: "posts", label: "Entregas / posts" },
  { key: "seguidores", label: "Seguidores" },
  { key: "engajamento", label: "Engajamento" },
  { key: "vendas", label: "Vendas" },
];

const COLS = "id, user_id, title, category, target_value, current_value, status, start_date, end_date, observation, created_at, scope, external_client_id, concluida_em, auto_source";

export function useMetas(scope: MetaScope, externalClientId?: string | null) {
  const { agencyOwnerId, activeAccountId } = useActiveAccount();
  // Metas da operação e do cliente pertencem à DONA da agência (colaborador
  // enxerga pelo mesmo id); as pessoais são da conta ativa.
  const dono = scope === "pessoal" ? activeAccountId : agencyOwnerId;
  const qc = useQueryClient();
  const chave = ["metas", dono, scope, externalClientId ?? null] as const;
  const invalidar = () => void qc.invalidateQueries({ queryKey: ["metas", dono, scope] });

  const metasQ = useQuery<Meta[]>({
    queryKey: chave,
    enabled: !!dono && (scope !== "cliente" || !!externalClientId),
    queryFn: async () => {
      let q = sbFrom("structured_goals").select(COLS).eq("user_id", dono!).eq("scope", scope);
      if (scope === "cliente") q = q.eq("external_client_id", externalClientId!);
      const { data, error } = await q.order("created_at", { ascending: false });
      if (error) {
        if (faltaMigration(error)) return [];
        throw error;
      }
      return (data ?? []) as Meta[];
    },
  });

  const criar = useMutation({
    mutationFn: async (v: MetaInput) => {
      const { error } = await sbFrom("structured_goals").insert({
        user_id: dono,
        title: v.title.trim(),
        category: v.category,
        target_value: v.target_value,
        current_value: v.current_value ?? 0,
        end_date: v.end_date ?? null,
        observation: v.observation ?? null,
        status: "ativa",
        scope,
        external_client_id: scope === "cliente" ? externalClientId : null,
      } as never);
      if (error) throw error;
    },
    onSuccess: invalidar,
    onError: (e: Error) => toast.error(e.message || "Não consegui criar a meta."),
  });

  const atualizar = useMutation({
    mutationFn: async (v: { id: string; patch: Partial<MetaInput> & { current_value?: number | null } }) => {
      const { error } = await sbFrom("structured_goals").update(v.patch as never).eq("id", v.id);
      if (error) throw error;
    },
    onSuccess: invalidar,
    onError: (e: Error) => toast.error(e.message || "Não consegui salvar a meta."),
  });

  /* Concluir carimba a DATA (pedido do Walter: criada em X, concluída em Y);
     reabrir apaga o carimbo. */
  const concluir = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await sbFrom("structured_goals")
        .update({ status: "concluida", concluida_em: new Date().toISOString() } as never).eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidar,
    onError: (e: Error) => toast.error(e.message || "Não consegui concluir a meta."),
  });

  const reabrir = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await sbFrom("structured_goals")
        .update({ status: "ativa", concluida_em: null } as never).eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidar,
    onError: (e: Error) => toast.error(e.message || "Não consegui reabrir a meta."),
  });

  const excluir = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await sbFrom("structured_goals").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidar,
    onError: (e: Error) => toast.error(e.message || "Não consegui excluir a meta."),
  });

  return { metas: metasQ.data ?? [], carregando: metasQ.isLoading, criar, atualizar, concluir, reabrir, excluir };
}
