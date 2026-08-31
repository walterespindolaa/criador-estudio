import { useEffect, useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

/* ═══════════════════════════════════════════════════════════════════════════
   A CAMADA PESSOAL DO PARCEIRO (mockup aprovado pelo Walter)

   As etapas dentro do "Fazendo" e o checklist/notas por card são SÓ dele:
   a agência continua vendo o eixo compartilhado. É o Trello pessoal rodando
   por dentro do contrato, sem quebrar a leitura de ninguém.
   ═══════════════════════════════════════════════════════════════════════════ */

// Tabelas novas, fora dos tipos gerados; mesmo padrão dos outros hooks.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sbFrom = (t: string) => (supabase as any).from(t);

export type EtapaPessoal = { id: string; nome: string; ordem: number };
export type ChecklistItem = { t: string; done: boolean };
export type CardMeta = { post_id: string; etapa_id: string | null; checklist: ChecklistItem[]; notas: string | null };

const faltaMigration = (e: { code?: string; message?: string } | null) =>
  !!e && (/42P01|42703|PGRST204|PGRST205/.test(e.code ?? "") || /does not exist|schema cache/i.test(e?.message ?? ""));

/** Sugestão inicial por papel: o direcionamento padrão que o Walter pediu,
 *  com o dono podendo renomear, criar e apagar à vontade. */
export const ETAPAS_PADRAO: Record<string, string[]> = {
  designer: ["Referências", "Rascunho", "Arte final"],
  editor_video: ["Decupagem", "Corte", "Finalização"],
  copy: ["Pesquisa", "Rascunho", "Revisão"],
  trafego: ["Briefing", "Montagem", "Otimização"],
};

export function useEtapasPessoais(papel?: string | null) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const semeando = useRef(false);

  const query = useQuery<EtapaPessoal[]>({
    queryKey: ["parceiro-etapas", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await sbFrom("parceiro_etapas")
        .select("id, nome, ordem").eq("member_id", user!.id).order("ordem").order("created_at");
      if (error) {
        if (faltaMigration(error)) return [];
        throw error;
      }
      return (data ?? []) as EtapaPessoal[];
    },
  });

  // Primeira visita: semeia as etapas sugeridas do papel. Uma vez só (ref
  // síncrono segura o segundo render antes do refetch voltar).
  useEffect(() => {
    if (!user || query.isLoading || semeando.current) return;
    if ((query.data ?? []).length > 0) return;
    const padrao = ETAPAS_PADRAO[papel ?? ""] ?? ETAPAS_PADRAO.designer;
    semeando.current = true;
    void (async () => {
      const { error } = await sbFrom("parceiro_etapas").insert(
        padrao.map((nome, i) => ({ member_id: user.id, nome, ordem: i })) as never);
      if (!error) void qc.invalidateQueries({ queryKey: ["parceiro-etapas", user.id] });
    })();
  }, [user, papel, query.isLoading, query.data, qc]);

  const invalidar = () => void qc.invalidateQueries({ queryKey: ["parceiro-etapas", user?.id] });

  const criar = useMutation({
    mutationFn: async (nome: string) => {
      const { error } = await sbFrom("parceiro_etapas").insert({
        member_id: user!.id, nome: nome.trim(), ordem: (query.data?.length ?? 0),
      } as never);
      if (error) throw error;
    },
    onSuccess: invalidar,
    onError: (e: Error) => toast.error(e.message || "Não consegui criar a etapa."),
  });

  const renomear = useMutation({
    mutationFn: async (v: { id: string; nome: string }) => {
      const { error } = await sbFrom("parceiro_etapas").update({ nome: v.nome.trim() } as never).eq("id", v.id);
      if (error) throw error;
    },
    onSuccess: invalidar,
    onError: (e: Error) => toast.error(e.message || "Não consegui renomear."),
  });

  const excluir = useMutation({
    // etapa_id nas metas cai pra null (on delete set null): os cards voltam
    // pra primeira etapa, nada se perde.
    mutationFn: async (id: string) => {
      const { error } = await sbFrom("parceiro_etapas").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { invalidar(); void qc.invalidateQueries({ queryKey: ["parceiro-metas", user?.id] }); },
    onError: (e: Error) => toast.error(e.message || "Não consegui excluir."),
  });

  return { etapas: query.data ?? [], carregando: query.isLoading, criar, renomear, excluir };
}

/** Todas as metas de card do parceiro (uma consulta pro quadro inteiro). */
export function useMetasDosCards() {
  const { user } = useAuth();
  return useQuery<Record<string, CardMeta>>({
    queryKey: ["parceiro-metas", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await sbFrom("parceiro_card_meta")
        .select("post_id, etapa_id, checklist, notas").eq("member_id", user!.id);
      if (error) {
        if (faltaMigration(error)) return {};
        throw error;
      }
      const out: Record<string, CardMeta> = {};
      for (const m of (data ?? []) as CardMeta[]) out[m.post_id] = m;
      return out;
    },
  });
}

export function useSalvarCardMeta() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: { postId: string; etapaId?: string | null; checklist?: ChecklistItem[]; notas?: string | null }) => {
      const patch: Record<string, unknown> = { member_id: user!.id, post_id: v.postId, updated_at: new Date().toISOString() };
      if (v.etapaId !== undefined) patch.etapa_id = v.etapaId;
      if (v.checklist !== undefined) patch.checklist = v.checklist;
      if (v.notas !== undefined) patch.notas = v.notas;
      const { error } = await sbFrom("parceiro_card_meta").upsert(patch as never, { onConflict: "member_id,post_id" });
      if (error) throw error;
    },
    // Otimista no cache do quadro: mover de etapa não pode piscar.
    onMutate: async (v) => {
      const key = ["parceiro-metas", user?.id];
      await qc.cancelQueries({ queryKey: key });
      const antes = qc.getQueryData<Record<string, CardMeta>>(key);
      qc.setQueryData<Record<string, CardMeta>>(key, (old) => {
        const base = { ...(old ?? {}) };
        const atual = base[v.postId] ?? { post_id: v.postId, etapa_id: null, checklist: [], notas: null };
        base[v.postId] = {
          ...atual,
          etapa_id: v.etapaId !== undefined ? v.etapaId : atual.etapa_id,
          checklist: v.checklist !== undefined ? v.checklist : atual.checklist,
          notas: v.notas !== undefined ? v.notas : atual.notas,
        };
        return base;
      });
      return { antes };
    },
    onError: (e: Error, _v, ctx) => {
      if (ctx?.antes) qc.setQueryData(["parceiro-metas", user?.id], ctx.antes);
      toast.error(e.message || "Não consegui salvar.");
    },
    onSettled: () => void qc.invalidateQueries({ queryKey: ["parceiro-metas", user?.id] }),
  });
}
