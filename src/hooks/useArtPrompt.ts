import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { callAIContextBuilder } from "@/lib/ai/claude";
import { useBrandItems } from "@/hooks/useBrandItems";
import { useProfile } from "@/hooks/useProfile";

/* ═══════════════════════════════════════════════════════════════════════════
   O PROMPT DA ARTE

   O Cria Estúdio era uma TELA (rota /app/estudio, item de menu) que gerava
   imagem por IA. Três problemas: cada imagem custava dinheiro de verdade; o
   resultado saía fora da identidade da pessoa (marca é fonte, cor e
   diagramação — não é o que um gerador de imagem entrega); e ela ia refazer
   no Canva de qualquer jeito. Resultado: nem o dono do produto usava.

   Agora o Estúdio não é destino, é ferramenta: mora DENTRO do post, no minuto
   exato em que a pessoa trava (texto pronto, arte em branco), e devolve o
   PROMPT — que ela cola no gerador que já usa e já paga.

   Custa uma geração da cota de IA. Sem produto novo, sem preço novo, sem
   conta do Higgsfield.
   ═══════════════════════════════════════════════════════════════════════════ */

export type PaginaPrompt = { n: number; titulo: string; pt: string; en: string };
export type ArtResult = {
  estilo: { descricao: string; en: string };
  paginas: PaginaPrompt[];
  /** Nasceu do texto das páginas ou só do título? A pessoa PRECISA saber. */
  base: "paginas" | "titulo";
  cores: string[];
  fontes: string[];
};

export type ArtInput = {
  titulo: string;
  formato: string;
  /** Texto de cada página/lâmina. Vazio = a IA cria a partir do título. */
  paginas: { texto: string }[];
  roteiro?: string;
  contextoQuente?: string;
};

export type Noticia = { titulo: string; fonte: string; quando: string; resumo?: string };

export type ArtSalvo = { resultado: ArtResult; noticias: Noticia[]; geradoEm: string };

/* ═══════════════════════════════════════════════════════════════════════════
   OS PROMPTS FICAM NO POST

   Antes eles só existiam na memória da tela: a pessoa saía do post, voltava, e
   tinha que GERAR DE NOVO — pagando outra geração da cota pra ver exatamente a
   mesma coisa. Crédito queimado à toa é o jeito mais rápido de ela achar o
   produto caro e cancelar.

   Agora eles vivem em posts.art (jsonb). Reabrir não custa nada. Gerar de novo
   custa — e é por isso que o botão pergunta antes.
   ═══════════════════════════════════════════════════════════════════════════ */
export function useArtSalvo(postId?: string | null) {
  const qc = useQueryClient();

  const { data: salvo } = useQuery<ArtSalvo | null>({
    queryKey: ["post-art", postId],
    enabled: !!postId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("posts")
        .select("art")
        .eq("id", postId!)
        .maybeSingle();
      if (error) throw error;
      const art = (data as { art?: unknown } | null)?.art;
      return (art as ArtSalvo | null) ?? null;
    },
  });

  const escrever = useMutation({
    mutationFn: async (valor: ArtSalvo | null) => {
      if (!postId) return; // post novo ainda sem id: não há onde guardar
      const { error } = await supabase
        .from("posts")
        .update({ art: valor } as never)
        .eq("id", postId);
      if (error) throw error;
    },
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ["post-art", postId] }); },
  });

  return {
    salvo: salvo ?? null,
    guardar: (v: ArtSalvo) => escrever.mutateAsync(v),
    apagar: () => escrever.mutateAsync(null),
  };
}

const HEX = /#?[0-9a-f]{6}\b/i;

export function useArtPrompt() {
  const { brandItems: items } = useBrandItems();
  const { profile } = useProfile();

  // As cores e as fontes moram no Brandbook (brand_items). Se estiverem
  // vazias, o prompt sai genérico — e é por isso que a tela avisa a pessoa
  // ANTES de gerar, em vez de entregar um resultado morno e deixar ela achar
  // que "a IA do Cria é fraca".
  const cores = (items ?? [])
    .filter((i) => i.type === "cor")
    .map((i) => i.name.trim())
    .filter(Boolean);
  const fontes = (items ?? [])
    .filter((i) => i.type === "fonte")
    .map((i) => i.name.trim())
    .filter(Boolean);
  const tom = (items ?? []).find((i) => i.type === "tom")?.name ?? "";

  const hexes = cores.filter((c) => HEX.test(c));

  const mutation = useMutation({
    mutationFn: async (input: ArtInput): Promise<ArtResult> => {
      const comTexto = input.paginas.filter((p) => p.texto.trim().length > 0);
      const usaPaginas = comTexto.length > 0;

      const raw = await callAIContextBuilder({
        operation: "art-prompt",
        data: {
          titulo: input.titulo,
          formato: input.formato,
          paginas: input.paginas,
          roteiro: input.roteiro,
          contextoQuente: input.contextoQuente,
          cores: cores.join(", "),
          fontes: fontes.join(", "),
          tom: tom || profile?.niche || "",
        },
      });

      const r = (raw ?? {}) as { estilo?: { descricao?: string; en?: string }; paginas?: PaginaPrompt[] };
      const paginas = (r.paginas ?? []).map((p, i) => ({
        n: Number(p.n) || i + 1,
        titulo: String(p.titulo ?? `Página ${i + 1}`),
        pt: String(p.pt ?? ""),
        en: String(p.en ?? ""),
      }));
      if (paginas.length === 0) throw new Error("A IA não devolveu nenhum prompt. Tente de novo.");

      return {
        estilo: { descricao: String(r.estilo?.descricao ?? ""), en: String(r.estilo?.en ?? "") },
        paginas,
        base: usaPaginas ? "paginas" : "titulo",
        cores: hexes.length ? hexes : cores,
        fontes,
      };
    },
    onError: (e: unknown) => {
      const msg = e instanceof Error ? e.message : String(e);
      if (/upgrade_required/i.test(msg)) {
        toast.error("O Cria Estúdio está no plano Pro.");
        return;
      }
      if (/quota_exceeded/i.test(msg)) {
        toast.error("Você usou todas as gerações de IA deste mês.");
        return;
      }
      toast.error(msg && !/non-2xx/i.test(msg) ? msg : "Não consegui gerar agora. Tente de novo em instantes.");
    },
  });

  // ── O que está quente sobre ESTE tema ──────────────────────────────────
  // Antes, "amarrar com o que está quente" não buscava nada: mandava uma
  // instrução genérica e a pessoa não via notícia nenhuma. Agora ela vê as
  // manchetes, com fonte e data, e escolhe qual entra. Se a busca falhar, o
  // Estúdio continua funcionando sem isso — notícia é tempero, não o prato.
  const busca = useMutation({
    mutationFn: async (tema: string): Promise<Noticia[]> => {
      const r = (await callAIContextBuilder({
        operation: "hot-news",
        data: { tema, nicho: profile?.niche ?? "" },
      })) as { noticias?: Noticia[] };
      return r?.noticias ?? [];
    },
  });

  return {
    gerar: mutation.mutateAsync,
    gerando: mutation.isPending,
    resultado: mutation.data ?? null,
    limpar: mutation.reset,
    buscarNoticias: busca.mutateAsync,
    buscandoNoticias: busca.isPending,
    noticias: busca.data ?? null,
    /** O brandbook está vazio? Isso muda o que a tela diz antes de gerar. */
    semMarca: cores.length === 0 && fontes.length === 0,
    cores,
    fontes,
  };
}
