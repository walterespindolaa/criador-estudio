import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
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

  return {
    gerar: mutation.mutateAsync,
    gerando: mutation.isPending,
    resultado: mutation.data ?? null,
    limpar: mutation.reset,
    /** O brandbook está vazio? Isso muda o que a tela diz antes de gerar. */
    semMarca: cores.length === 0 && fontes.length === 0,
    cores,
    fontes,
  };
}
