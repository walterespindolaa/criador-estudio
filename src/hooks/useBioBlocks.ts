import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useActiveAccount } from "@/contexts/AccountContext";
import { useBioAlvo } from "@/contexts/BioAlvoContext";
import { toast } from "sonner";
import { metaDoBloco, type BioBloco, type DadosBloco, type EstiloBio, type TipoBloco } from "@/lib/bioBlocks";

/* ═══════════════════════════════════════════════════════════════════════════
   OS BLOCOS DA PÁGINA

   Mesmo alvo do resto do módulo (conta do criador, conta do cliente ou ficha
   do CRM) e mais uma dimensão: o ESTILO. Clássico e Site guardam montagens
   separadas, então trocar o estilo na tela não pode fazer o outro sumir.
   ═══════════════════════════════════════════════════════════════════════════ */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sbFrom = (table: string) => (supabase as any).from(table);

const tabelaFaltando = (msg: string) => /does not exist|schema cache|could not find/i.test(msg ?? "");
const AVISO_MIGRATION = "Rode a migration dos blocos (20260825000004) no Supabase pra liberar isso.";

export function useBioBlocks(estilo: EstiloBio) {
  const alvo = useBioAlvo();
  const { activeAccountId } = useActiveAccount();
  const qc = useQueryClient();

  const pageId = alvo?.tipo === "ficha" ? alvo.pageId : null;
  const userId = alvo
    ? (alvo.tipo === "conta" ? alvo.ownerId : alvo.managerId)
    : activeAccountId;

  const chave = ["bio-blocks", pageId ?? userId, estilo] as const;

  const q = useQuery<BioBloco[]>({
    queryKey: chave,
    enabled: !!(pageId || userId),
    queryFn: async () => {
      let s = sbFrom("bio_blocks").select("*").eq("estilo", estilo);
      s = pageId ? s.eq("page_id", pageId) : s.eq("user_id", userId!).is("page_id", null);
      const { data, error } = await s.order("position", { ascending: true });
      if (error) {
        if (tabelaFaltando(error.message)) return [];
        throw error;
      }
      return (data ?? []) as BioBloco[];
    },
  });

  const blocos = q.data ?? [];

  const criar = useMutation({
    mutationFn: async (tipo: TipoBloco): Promise<BioBloco> => {
      if (!userId) throw new Error("Sem sessão");
      const { data, error } = await sbFrom("bio_blocks").insert({
        user_id: userId,
        page_id: pageId,
        estilo,
        kind: tipo,
        data: metaDoBloco(tipo).padrao,
        position: blocos.length,
      }).select("*").single();
      if (error) throw error;
      return data as BioBloco;
    },
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ["bio-blocks"] }); },
    onError: (e: Error) => toast.error(tabelaFaltando(e.message) ? AVISO_MIGRATION : (e.message || "Não consegui adicionar o bloco.")),
  });

  const atualizar = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<Pick<BioBloco, "data" | "is_active" | "starts_at" | "ends_at">> }) => {
      const { data, error } = await sbFrom("bio_blocks")
        .update({ ...patch, updated_at: new Date().toISOString() })
        .eq("id", id).select("id").maybeSingle();
      if (error) throw error;
      // .select() de propósito: bloqueio de permissão volta como zero linhas
      // SEM erro, e a tela diria "salvo" sem ter salvo.
      if (!data) throw new Error("Não consegui salvar este bloco. Recarregue e tente de novo.");
    },
    // Otimista: digitar num campo não pode esperar ida e volta do servidor.
    onMutate: async ({ id, patch }) => {
      await qc.cancelQueries({ queryKey: chave });
      const antes = qc.getQueryData<BioBloco[]>(chave) ?? [];
      qc.setQueryData<BioBloco[]>(chave, antes.map((b) => (b.id === id ? { ...b, ...patch } as BioBloco : b)));
      return { antes };
    },
    onError: (e: Error, _v, ctx) => {
      const c = ctx as { antes?: BioBloco[] } | undefined;
      if (c?.antes) qc.setQueryData(chave, c.antes);
      toast.error(e.message || "Não consegui salvar.");
    },
    onSettled: () => { void qc.invalidateQueries({ queryKey: chave, refetchType: "none" }); },
  });

  const excluir = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await sbFrom("bio_blocks").delete().eq("id", id);
      if (error) throw error;
    },
    onMutate: async (id: string) => {
      await qc.cancelQueries({ queryKey: chave });
      const antes = qc.getQueryData<BioBloco[]>(chave) ?? [];
      qc.setQueryData<BioBloco[]>(chave, antes.filter((b) => b.id !== id));
      return { antes };
    },
    onError: (_e, _v, ctx) => {
      const c = ctx as { antes?: BioBloco[] } | undefined;
      if (c?.antes) qc.setQueryData(chave, c.antes);
      toast.error("Não consegui excluir o bloco.");
    },
    onSettled: () => { void qc.invalidateQueries({ queryKey: chave }); },
  });

  const duplicar = useMutation({
    mutationFn: async (id: string) => {
      const b = blocos.find((x) => x.id === id);
      if (!b || !userId) throw new Error("Bloco não encontrado");
      const copia = { ...(b.data as DadosBloco) };
      delete copia.de_bio_link;   // a marca de origem não se herda
      const { error } = await sbFrom("bio_blocks").insert({
        user_id: userId, page_id: pageId, estilo, kind: b.kind,
        data: copia, position: blocos.length, is_active: false,
        starts_at: b.starts_at, ends_at: b.ends_at,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["bio-blocks"] });
      toast.success("Copiado. A cópia nasce desligada pra você ajustar antes.");
    },
    onError: () => toast.error("Não consegui duplicar."),
  });

  /** Cria vários blocos de uma vez, no fim da página e DESLIGADOS. Desligados
   *  porque modelo vem com texto de exemplo, e ninguém quer "Escreva aqui
   *  sobre você" no ar enquanto ainda está preenchendo. */
  const aplicarModelo = useMutation({
    mutationFn: async (novos: { kind: TipoBloco; data: DadosBloco }[]) => {
      if (!userId) throw new Error("Sem sessão");
      const linhas = novos.map((b, i) => ({
        user_id: userId, page_id: pageId, estilo,
        kind: b.kind, data: b.data,
        position: blocos.length + i,
        is_active: false,
      }));
      const { error } = await sbFrom("bio_blocks").insert(linhas);
      if (error) throw error;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["bio-blocks"] });
      toast.success("Modelo aplicado. Os blocos entraram desligados: preencha e ligue um por um.");
    },
    onError: (e: Error) => toast.error(tabelaFaltando(e.message) ? AVISO_MIGRATION : "Não consegui aplicar o modelo."),
  });

  const reordenar = useMutation({
    mutationFn: async (ids: string[]) => {
      await Promise.all(ids.map((id, i) => {
        const s = sbFrom("bio_blocks").update({ position: i }).eq("id", id);
        return pageId ? s.eq("page_id", pageId) : s.eq("user_id", userId!);
      }));
    },
    onMutate: async (ids: string[]) => {
      await qc.cancelQueries({ queryKey: chave });
      const antes = qc.getQueryData<BioBloco[]>(chave) ?? [];
      const porId = new Map(antes.map((b) => [b.id, b] as const));
      qc.setQueryData<BioBloco[]>(chave, ids.map((id, i) => {
        const b = porId.get(id);
        return b ? { ...b, position: i } : null;
      }).filter((b): b is BioBloco => b !== null));
      return { antes };
    },
    onError: (_e, _v, ctx) => {
      const c = ctx as { antes?: BioBloco[] } | undefined;
      if (c?.antes) qc.setQueryData(chave, c.antes);
    },
    onSettled: () => { void qc.invalidateQueries({ queryKey: chave, refetchType: "none" }); },
  });

  return { blocos, isLoading: q.isLoading, criar, atualizar, excluir, duplicar, reordenar, aplicarModelo };
}
