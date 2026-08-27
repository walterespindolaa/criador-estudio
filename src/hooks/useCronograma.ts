import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

// types.ts travado, tabelas novas via cast (padrão useModules/useFinance).
type AnyTable = (table: string) => ReturnType<typeof supabase.from>;
const sbFrom = supabase.from.bind(supabase) as unknown as AnyTable;

export type CronogramaStatus = "rascunho" | "enviado" | "aprovado" | "arquivado";
export type ItemStatus = "pendente" | "aprovado" | "recusado" | "ajuste";
export const CRONOGRAMA_TYPES = ["Reels", "Carrossel", "Feed", "Stories", "Carrossel/Stories", "Feed/Stories"] as const;

export type Cronograma = {
  id: string;
  manager_id: string;
  title: string;
  client_label: string | null;
  client_handle: string | null;
  external_client_id: string | null;
  crm_client_id: string | null;
  cria_owner_id: string | null;
  status: CronogramaStatus;
  token: string;
  created_at: string;
};

export type CronogramaData = {
  id: string;
  cronograma_id: string;
  label: string;
  day_label: string | null;
  sort_order: number;
  selected: boolean;
};

export type CronogramaItem = {
  id: string;
  cronograma_id: string;
  sort_order: number;
  title: string | null;   // nome do post (separado da copy); coluna nova, ver SQL
  copy: string | null;
  description: string | null;
  date: string | null;
  type: string | null;
  ref_url: string | null;
  approval_status: ItemStatus;
  client_comment: string | null;
  converted_post_id: string | null;
};

export function useCronogramas() {
  const { user } = useAuth();
  const qc = useQueryClient();

  const list = useQuery<Cronograma[]>({
    queryKey: ["cronogramas", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await sbFrom("cronogramas")
        .select("*").eq("manager_id", user!.id).order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as Cronograma[];
    },
  });

  const create = useMutation({
    mutationFn: async (input: { title: string; client_label?: string | null; client_handle?: string | null; external_client_id?: string | null; crm_client_id?: string | null; cria_owner_id?: string | null }) => {
      if (!user?.id) throw new Error("Sem sessão");
      const { data, error } = await sbFrom("cronogramas")
        .insert({ ...input, manager_id: user.id } as never).select("*").single();
      if (error) throw error;
      return data as unknown as Cronograma;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["cronogramas"] }),
    onError: (e: unknown) => toast.error((e as Error)?.message ?? "Erro ao criar cronograma."),
  });

  const update = useMutation({
    mutationFn: async ({ id, ...patch }: { id: string } & Partial<Cronograma>) => {
      const { error } = await sbFrom("cronogramas").update(patch as never).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["cronogramas"] }),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => { const { error } = await sbFrom("cronogramas").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["cronogramas"] }); toast.success("Cronograma excluído."); },
    onError: () => toast.error("Erro ao excluir."),
  });

  return { cronogramas: list.data ?? [], isLoading: list.isLoading, create, update, remove };
}

/* ═══════════════════════════════════════════════════════════════════════════
   AS DATAS COMEMORATIVAS DE TODOS OS CLIENTES, DE UMA VEZ

   Elas já existiam: a social mídia monta a lista no cronograma, o cliente abre
   o link e marca quais quer trabalhar. O problema é que a informação morria
   lá dentro. Pra saber que dia 8 de setembro é Dia Mundial da Fisioterapia, ela
   precisava abrir o cronograma daquele cliente, num mês em que ela já está
   olhando a agenda inteira.

   Este hook puxa as datas de TODOS os cronogramas de uma vez, com o nome do
   cliente junto, pra a agenda conseguir mostrar tudo no lugar onde o trabalho
   já acontece.
   ═══════════════════════════════════════════════════════════════════════════ */
export type DataComemorativaAgenda = {
  id: string;
  label: string;
  /** O rótulo do dia como está salvo: "08/03", mas também "data móvel",
   *  "2º domingo" ou vazio. Quem traduz isso pra um dia do calendário é o
   *  `resolverDataComemorativa`, porque a resposta depende do ANO. */
  dia: string;
  /** O cliente marcou no link que quer trabalhar esta data. */
  aprovada: boolean;
  clienteNome: string;
  crmClientId: string | null;
  externalClientId: string | null;
  cronogramaId: string;
};

export function useDatasComemorativasDosClientes() {
  const { user } = useAuth();

  return useQuery<DataComemorativaAgenda[]>({
    queryKey: ["cronograma-datas-todas", user?.id],
    enabled: !!user?.id,
    // O cliente marca no link público, fora daqui: revalidar ao voltar pra aba
    // é o que faz a marcação dele aparecer sem precisar recarregar a página.
    staleTime: 30_000,
    refetchOnWindowFocus: true,
    queryFn: async () => {
      const { data, error } = await sbFrom("cronograma_datas")
        .select("id, label, day_label, selected, cronograma_id, cronogramas!inner(id, manager_id, title, client_label, crm_client_id, external_client_id, status)")
        .eq("cronogramas.manager_id", user!.id);
      if (error) throw error;

      type Linha = {
        id: string; label: string; day_label: string | null; selected: boolean; cronograma_id: string;
        cronogramas?: { title?: string | null; client_label?: string | null; crm_client_id?: string | null; external_client_id?: string | null; status?: string | null };
      };

      return ((data ?? []) as unknown as Linha[])
        // Cronograma arquivado é histórico: as datas dele não voltam pra agenda.
        .filter((r) => r.cronogramas?.status !== "arquivado")
        /* Data sem dia NÃO é descartada aqui. O catálogo conhece o dia de
           quase tudo que foi escolhido na lista anual, então quem sabe resolver
           é o calendário, não esta consulta. Descartar aqui fazia sumir em
           silêncio justamente as datas móveis (Páscoa, Carnaval, Dia das Mães),
           que são as que mais rendem conteúdo. */
        .map((r) => ({
          id: r.id,
          label: r.label,
          dia: (r.day_label ?? "").trim(),
          aprovada: !!r.selected,
          clienteNome: (r.cronogramas?.client_label ?? "").trim() || (r.cronogramas?.title ?? "").trim(),
          crmClientId: r.cronogramas?.crm_client_id ?? null,
          externalClientId: r.cronogramas?.external_client_id ?? null,
          cronogramaId: r.cronograma_id,
        }));
    },
  });
}

export function useCronogramaItems(cronogramaId: string | null) {
  const qc = useQueryClient();

  const list = useQuery<CronogramaItem[]>({
    queryKey: ["cronograma-items", cronogramaId],
    enabled: !!cronogramaId,
    // O cliente aprova numa sessão pública; sem isto o gestor ficava com o
    // "pendente" cacheado. Revalida ao abrir/focar pra refletir a aprovação.
    staleTime: 0,
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
    queryFn: async () => {
      const { data, error } = await sbFrom("cronograma_items")
        .select("*").eq("cronograma_id", cronogramaId!).order("sort_order", { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as CronogramaItem[];
    },
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["cronograma-items", cronogramaId] });

  const addItem = useMutation({
    mutationFn: async (input: Partial<CronogramaItem>) => {
      const { error } = await sbFrom("cronograma_items")
        .insert({ cronograma_id: cronogramaId, sort_order: (list.data?.length ?? 0), ...input } as never);
      if (error) throw error;
    },
    onSuccess: invalidate,
    onError: () => toast.error("Erro ao adicionar item."),
  });

  const updateItem = useMutation({
    mutationFn: async ({ id, ...patch }: { id: string } & Partial<CronogramaItem>) => {
      const { error } = await sbFrom("cronograma_items").update(patch as never).eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
    onError: () => toast.error("Erro ao salvar item."),
  });

  const deleteItem = useMutation({
    mutationFn: async (id: string) => { const { error } = await sbFrom("cronograma_items").delete().eq("id", id); if (error) throw error; },
    onSuccess: invalidate,
    onError: () => toast.error("Erro ao excluir item."),
  });

  // Reordenar os itens (#4 virar #1). Grava o sort_order novo de todos e reflete na hora.
  const reorder = useMutation({
    mutationFn: async (ordered: CronogramaItem[]) => {
      await Promise.all(
        ordered.map((it, i) => sbFrom("cronograma_items").update({ sort_order: i } as never).eq("id", it.id)),
      );
    },
    onMutate: async (ordered: CronogramaItem[]) => {
      await qc.cancelQueries({ queryKey: ["cronograma-items", cronogramaId] });
      const prev = qc.getQueryData<CronogramaItem[]>(["cronograma-items", cronogramaId]);
      qc.setQueryData(["cronograma-items", cronogramaId], ordered.map((it, i) => ({ ...it, sort_order: i })));
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      const c = ctx as { prev?: CronogramaItem[] } | undefined;
      if (c?.prev) qc.setQueryData(["cronograma-items", cronogramaId], c.prev);
      toast.error("Não consegui reordenar.");
    },
    onSettled: invalidate,
  });

  return { items: list.data ?? [], isLoading: list.isLoading, addItem, updateItem, deleteItem, reorder };
}

export function useCronogramaDatas(cronogramaId: string | null) {
  const qc = useQueryClient();

  const list = useQuery<CronogramaData[]>({
    queryKey: ["cronograma-datas", cronogramaId],
    enabled: !!cronogramaId,
    // Idem: o cliente marca as datas no link; revalida pra o gestor ver.
    staleTime: 0,
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
    queryFn: async () => {
      const { data, error } = await sbFrom("cronograma_datas")
        .select("*").eq("cronograma_id", cronogramaId!).order("sort_order", { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as CronogramaData[];
    },
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["cronograma-datas", cronogramaId] });

  const addData = useMutation({
    mutationFn: async (input: { label: string; day_label?: string | null }) => {
      const { error } = await sbFrom("cronograma_datas")
        .insert({ cronograma_id: cronogramaId, sort_order: (list.data?.length ?? 0), ...input } as never);
      if (error) throw error;
    },
    onSuccess: invalidate,
    onError: () => toast.error("Erro ao adicionar data."),
  });

  const addManyDatas = useMutation({
    mutationFn: async (rows: { label: string; day_label?: string | null }[]) => {
      const base = list.data?.length ?? 0;
      const { error } = await sbFrom("cronograma_datas")
        .insert(rows.map((r, i) => ({ cronograma_id: cronogramaId, sort_order: base + i, ...r })) as never);
      if (error) throw error;
    },
    onSuccess: invalidate,
    onError: () => toast.error("Erro ao adicionar datas."),
  });

  const updateData = useMutation({
    mutationFn: async ({ id, ...patch }: { id: string } & Partial<CronogramaData>) => {
      const { error } = await sbFrom("cronograma_datas").update(patch as never).eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
    onError: () => toast.error("Erro ao salvar data."),
  });

  const deleteData = useMutation({
    mutationFn: async (id: string) => { const { error } = await sbFrom("cronograma_datas").delete().eq("id", id); if (error) throw error; },
    onSuccess: invalidate,
    onError: () => toast.error("Erro ao excluir data."),
  });

  // Reordenar as datas (arrastar). Grava sort_order de todas e reflete na hora.
  const reorder = useMutation({
    mutationFn: async (ordered: CronogramaData[]) => {
      await Promise.all(
        ordered.map((d, i) => sbFrom("cronograma_datas").update({ sort_order: i } as never).eq("id", d.id)),
      );
    },
    onMutate: async (ordered: CronogramaData[]) => {
      await qc.cancelQueries({ queryKey: ["cronograma-datas", cronogramaId] });
      const prev = qc.getQueryData<CronogramaData[]>(["cronograma-datas", cronogramaId]);
      qc.setQueryData(["cronograma-datas", cronogramaId], ordered.map((d, i) => ({ ...d, sort_order: i })));
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      const c = ctx as { prev?: CronogramaData[] } | undefined;
      if (c?.prev) qc.setQueryData(["cronograma-datas", cronogramaId], c.prev);
      toast.error("Não consegui reordenar.");
    },
    onSettled: invalidate,
  });

  return { datas: list.data ?? [], isLoading: list.isLoading, addData, addManyDatas, updateData, deleteData, reorder };
}
