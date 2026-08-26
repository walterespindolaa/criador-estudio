import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useActiveAccount } from "@/contexts/AccountContext";
import { useBioAlvo } from "@/contexts/BioAlvoContext";
import { toast } from "sonner";
import { enderecoDoTitulo } from "@/lib/bioBlocks";

/* ═══════════════════════════════════════════════════════════════════════════
   OS ITENS DO MODO SITE

   Produto/serviço e post do blog. Cada um é uma PÁGINA, com endereço próprio,
   e é isso que separa o modo Site de uma página de bio comprida: o cliente
   consegue mandar o link de um serviço só no WhatsApp.
   ═══════════════════════════════════════════════════════════════════════════ */

export type TipoItem = "produto" | "post";

export type BioItem = {
  id: string;
  user_id: string;
  page_id: string | null;
  tipo: TipoItem;
  slug: string;
  titulo: string;
  resumo: string | null;
  capa: string | null;
  preco: number | null;
  preco_texto: string | null;
  conteudo: string | null;
  galeria: string[];
  cta_texto: string | null;
  cta_url: string | null;
  publicado: boolean;
  position: number;
  publicado_em: string;
  created_at: string;
  updated_at: string;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sbFrom = (table: string) => (supabase as any).from(table);
const tabelaFaltando = (m: string) => /does not exist|schema cache|could not find/i.test(m ?? "");
const AVISO = "Rode a migration do modo Site (20260825000006) no Supabase pra liberar isso.";

export function useBioItems(tipo: TipoItem) {
  const alvo = useBioAlvo();
  const { activeAccountId } = useActiveAccount();
  const qc = useQueryClient();

  const pageId = alvo?.tipo === "ficha" ? alvo.pageId : null;
  const userId = alvo ? (alvo.tipo === "conta" ? alvo.ownerId : alvo.managerId) : activeAccountId;
  const chave = ["bio-items", pageId ?? userId, tipo] as const;

  const q = useQuery<BioItem[]>({
    queryKey: chave,
    enabled: !!(pageId || userId),
    queryFn: async () => {
      let s = sbFrom("bio_items").select("*").eq("tipo", tipo);
      s = pageId ? s.eq("page_id", pageId) : s.eq("user_id", userId!).is("page_id", null);
      // Post é cronológico (o leitor espera o mais novo em cima); produto segue
      // a ordem que a pessoa arrastou.
      const { data, error } = tipo === "post"
        ? await s.order("publicado_em", { ascending: false })
        : await s.order("position", { ascending: true });
      if (error) {
        if (tabelaFaltando(error.message)) return [];
        throw error;
      }
      return (data ?? []) as BioItem[];
    },
  });

  const itens = q.data ?? [];

  /** Endereço único dentro desta página: some-2, some-3... */
  const enderecoLivre = (titulo: string, ignorarId?: string) => {
    const base = enderecoDoTitulo(titulo) || tipo;
    const usados = new Set(itens.filter((i) => i.id !== ignorarId).map((i) => i.slug.toLowerCase()));
    if (!usados.has(base)) return base;
    let n = 2;
    while (usados.has(`${base}-${n}`)) n++;
    return `${base}-${n}`;
  };

  const criar = useMutation({
    mutationFn: async (titulo: string): Promise<BioItem> => {
      if (!userId) throw new Error("Sem sessão");
      const { data, error } = await sbFrom("bio_items").insert({
        user_id: userId, page_id: pageId, tipo,
        titulo, slug: enderecoLivre(titulo),
        position: itens.length,
        // Nasce despublicado: ninguém quer um serviço vazio no ar enquanto
        // escreve a descrição.
        publicado: false,
      }).select("*").single();
      if (error) throw error;
      return data as BioItem;
    },
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ["bio-items"] }); },
    onError: (e: Error) => toast.error(tabelaFaltando(e.message) ? AVISO : (e.message || "Não consegui criar.")),
  });

  const atualizar = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<BioItem> }) => {
      const { data, error } = await sbFrom("bio_items")
        .update({ ...patch, updated_at: new Date().toISOString() })
        .eq("id", id).select("id").maybeSingle();
      if (error) throw error;
      if (!data) throw new Error("Não consegui salvar. Recarregue e tente de novo.");
    },
    onMutate: async ({ id, patch }) => {
      await qc.cancelQueries({ queryKey: chave });
      const antes = qc.getQueryData<BioItem[]>(chave) ?? [];
      qc.setQueryData<BioItem[]>(chave, antes.map((i) => (i.id === id ? { ...i, ...patch } as BioItem : i)));
      return { antes };
    },
    onError: (e: Error, _v, ctx) => {
      const c = ctx as { antes?: BioItem[] } | undefined;
      if (c?.antes) qc.setQueryData(chave, c.antes);
      toast.error(/duplicate|unique/i.test(e.message) ? "Já existe um item com esse endereço." : e.message);
    },
    onSettled: () => { void qc.invalidateQueries({ queryKey: chave, refetchType: "none" }); },
  });

  const excluir = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await sbFrom("bio_items").delete().eq("id", id);
      if (error) throw error;
    },
    onMutate: async (id: string) => {
      await qc.cancelQueries({ queryKey: chave });
      const antes = qc.getQueryData<BioItem[]>(chave) ?? [];
      qc.setQueryData<BioItem[]>(chave, antes.filter((i) => i.id !== id));
      return { antes };
    },
    onError: (_e, _v, ctx) => {
      const c = ctx as { antes?: BioItem[] } | undefined;
      if (c?.antes) qc.setQueryData(chave, c.antes);
      toast.error("Não consegui excluir.");
    },
    onSettled: () => { void qc.invalidateQueries({ queryKey: chave }); },
  });

  const reordenar = useMutation({
    mutationFn: async (ids: string[]) => {
      await Promise.all(ids.map((id, i) => sbFrom("bio_items").update({ position: i }).eq("id", id)));
    },
    onMutate: async (ids: string[]) => {
      await qc.cancelQueries({ queryKey: chave });
      const antes = qc.getQueryData<BioItem[]>(chave) ?? [];
      const porId = new Map(antes.map((i) => [i.id, i] as const));
      qc.setQueryData<BioItem[]>(chave, ids.map((id, i) => {
        const x = porId.get(id);
        return x ? { ...x, position: i } : null;
      }).filter((x): x is BioItem => x !== null));
      return { antes };
    },
    onSettled: () => { void qc.invalidateQueries({ queryKey: chave, refetchType: "none" }); },
  });

  return { itens, isLoading: q.isLoading, criar, atualizar, excluir, reordenar, enderecoLivre };
}
