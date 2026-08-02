import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useActiveAccount } from "@/contexts/AccountContext";
import { toast } from "sonner";
import type { TagColor } from "@/hooks/useCrm";

// ============================================================
// ETIQUETAS INTERNAS DO POST (Cria Post)
//
// São etiquetas que SÓ a agência vê: "Prioridade", "Gravar externa",
// "Aguardando material do cliente", "Patrocinado"... O cliente nunca recebe
// esse dado: as RPCs públicas (list_posts_by_token, get_cronograma_by_token)
// têm lista de colunas explícita e não incluem posts.internal_tags.
//
// Escopo PRÓPRIO, separado do catálogo de etiquetas de cliente (crm_tags):
// etiqueta de cliente fala de relacionamento ("VIP", "Inadimplente");
// etiqueta de post fala de produção. Mesma mecânica e mesma paleta de cores,
// conjuntos diferentes, pra nenhum dos dois seletores virar uma lista poluída.
//
// GUARDAMOS IDs (uuid), não nomes: renomear/trocar a cor no catálogo reflete
// em todos os posts na hora. Id que não existe mais é simplesmente ignorado.
//
// TUDO AQUI É DEFENSIVO: enquanto a migration não roda, a tabela post_tags e
// a coluna posts.internal_tags não existem. Nesse caso as leituras devolvem
// vazio (nenhuma tela quebra) e as escritas avisam em vez de estourar.
// ============================================================

type AnyTable = (table: string) => ReturnType<typeof supabase.from>;
const sbFrom = supabase.from.bind(supabase) as unknown as AnyTable;

export type PostTag = { id: string; manager_id: string; name: string; color: string; created_at: string };

// A migration ainda não rodou? O Postgres devolve 42P01 (tabela) / 42703 (coluna).
// Também cai aqui a mensagem crua do PostgREST quando o schema não conhece o campo.
function faltaMigration(e: unknown): boolean {
  const err = e as { code?: string; message?: string } | null;
  const code = err?.code ?? "";
  if (code === "42P01" || code === "42703" || code === "PGRST204" || code === "PGRST205") return true;
  const msg = (err?.message ?? "").toLowerCase();
  return msg.includes("does not exist") || msg.includes("could not find");
}

const AVISO_MIGRATION = "As etiquetas internas ainda não foram liberadas no banco. Rode a migration e tente de novo.";

// ── Catálogo da agência ──
export function usePostTags() {
  const { agencyOwnerId } = useActiveAccount();
  return useQuery<PostTag[]>({
    queryKey: ["post-tags", agencyOwnerId],
    enabled: !!agencyOwnerId,
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await sbFrom("post_tags").select("*").eq("manager_id", agencyOwnerId!).order("name");
      // Sem a migration, seguimos com catálogo vazio em vez de derrubar o board.
      if (error) { if (faltaMigration(error)) return []; throw error; }
      return (data ?? []) as unknown as PostTag[];
    },
  });
}

export function useCreatePostTag() {
  const { agencyOwnerId } = useActiveAccount();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ name, color }: { name: string; color: string }) => {
      if (!agencyOwnerId) throw new Error("Sem sessão");
      const { error } = await sbFrom("post_tags").insert({ manager_id: agencyOwnerId, name: name.trim(), color } as never);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["post-tags", agencyOwnerId] }),
    onError: (e: unknown) => {
      if (faltaMigration(e)) { toast.error(AVISO_MIGRATION); return; }
      toast.error((e as Error)?.message?.includes("duplicate") ? "Já existe uma etiqueta com esse nome." : "Erro ao criar etiqueta.");
    },
  });
}

export function useUpdatePostTag() {
  const { agencyOwnerId } = useActiveAccount();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, name, color }: { id: string; name?: string; color?: string }) => {
      const patch: Record<string, string> = {};
      if (name !== undefined) patch.name = name.trim();
      if (color !== undefined) patch.color = color;
      const { error } = await sbFrom("post_tags").update(patch as never).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["post-tags", agencyOwnerId] }),
    onError: (e: unknown) => {
      if (faltaMigration(e)) { toast.error(AVISO_MIGRATION); return; }
      toast.error((e as Error)?.message?.includes("duplicate") ? "Já existe uma etiqueta com esse nome." : "Erro ao salvar etiqueta.");
    },
  });
}

export function useDeletePostTag() {
  const { agencyOwnerId } = useActiveAccount();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await sbFrom("post_tags").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["post-tags", agencyOwnerId] });
      // Os posts que usavam a etiqueta guardam um id que não existe mais; a
      // leitura ignora id desconhecido, então nenhum card quebra.
      qc.invalidateQueries({ queryKey: ["post-internal-tags"] });
    },
    onError: (e: unknown) => toast.error(faltaMigration(e) ? AVISO_MIGRATION : "Erro ao excluir etiqueta."),
  });
}

// ── Etiquetas padrão ──
// Ponto de partida pra não encarar tela em branco. São de PRODUÇÃO de post,
// diferentes das de cliente (VIP, Inadimplente...), que vivem em crm_tags.
// A ordem segue o caminho real da peça: entra pra fazer, grava, edita, volta
// pra alteração/ajuste, vai pra aprovação e sai pronta. A cor acompanha esse
// caminho (neutro no começo, quente no meio, verde no fim).
export const DEFAULT_POST_TAGS: { name: string; color: TagColor }[] = [
  { name: "A fazer", color: "slate" },
  { name: "Gravar", color: "violet" },
  { name: "Editar", color: "sky" },
  { name: "Em alteração", color: "orange" },
  { name: "Ajustar", color: "rose" },
  { name: "Aguardando aprovação", color: "amber" },
  { name: "Pronto", color: "emerald" },
];

export function useSeedDefaultPostTags() {
  const { agencyOwnerId } = useActiveAccount();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (existing: PostTag[]) => {
      if (!agencyOwnerId) throw new Error("Sem sessão");
      const have = new Set(existing.map((t) => t.name.toLowerCase()));
      const rows = DEFAULT_POST_TAGS
        .filter((t) => !have.has(t.name.toLowerCase()))
        .map((t) => ({ manager_id: agencyOwnerId, name: t.name, color: t.color }));
      if (!rows.length) return 0;
      const { error } = await sbFrom("post_tags").insert(rows as never);
      if (error) throw error;
      return rows.length;
    },
    onSuccess: (n) => {
      qc.invalidateQueries({ queryKey: ["post-tags", agencyOwnerId] });
      if (n) toast.success(`${n} etiqueta(s) padrão criada(s). Edite ou exclua à vontade.`);
      else toast.info("As etiquetas padrão já estão todas aí.");
    },
    onError: (e: unknown) => toast.error(faltaMigration(e) ? AVISO_MIGRATION : "Erro ao criar as etiquetas padrão."),
  });
}

// ── Etiquetas de cada post do cliente ──
// Query SEPARADA de propósito: se ela fosse junto do select do board
// (POST_BOARD_COLUMNS), o board inteiro quebraria enquanto a coluna não
// existisse. Aqui um erro de coluna ausente vira "nenhum post tem etiqueta".
export function usePostInternalTags(clientId: string | null) {
  const { agencyOwnerId } = useActiveAccount();
  return useQuery<Record<string, string[]>>({
    queryKey: ["post-internal-tags", clientId],
    enabled: !!agencyOwnerId && !!clientId,
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await sbFrom("posts")
        .select("id, internal_tags")
        .eq("external_client_id", clientId!)
        .not("is_draft", "is", true);
      if (error) { if (faltaMigration(error)) return {}; throw error; }
      const map: Record<string, string[]> = {};
      for (const row of (data as unknown as { id: string; internal_tags: string[] | null }[]) ?? []) {
        map[row.id] = Array.isArray(row.internal_tags) ? row.internal_tags : [];
      }
      return map;
    },
  });
}

// Grava as etiquetas de UM post. Fica fora do save principal do post de
// propósito: sem a migration, o save do post continua funcionando e só as
// etiquetas avisam que faltou rodar o SQL.
export function useSetPostInternalTags(clientId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, tags }: { id: string; tags: string[] }) => {
      const { error } = await sbFrom("posts").update({ internal_tags: tags } as never).eq("id", id);
      if (error) throw error;
    },
    onMutate: async ({ id, tags }) => {
      const key = ["post-internal-tags", clientId];
      await qc.cancelQueries({ queryKey: key });
      const prev = qc.getQueryData<Record<string, string[]>>(key);
      qc.setQueryData<Record<string, string[]>>(key, (old) => ({ ...(old ?? {}), [id]: tags }));
      return { prev, key };
    },
    onError: (e: unknown, _v, ctx) => {
      const c = ctx as { prev?: Record<string, string[]>; key?: unknown[] } | undefined;
      if (c?.prev && c.key) qc.setQueryData(c.key, c.prev);
      toast.error(faltaMigration(e) ? AVISO_MIGRATION : "Não consegui salvar as etiquetas internas.");
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ["post-internal-tags", clientId] }),
  });
}

// Bolinha sólida da etiqueta (célula do calendário, onde não cabe chip).
// TAG_COLOR_CLS é o fundo suave do chip; aqui precisa de cor cheia.
export const POST_TAG_DOT_CLS: Record<string, string> = {
  slate: "bg-slate-500",
  emerald: "bg-emerald-500",
  amber: "bg-amber-500",
  rose: "bg-rose-500",
  violet: "bg-violet-500",
  sky: "bg-sky-500",
  orange: "bg-orange-500",
  green: "bg-green-600",
};
