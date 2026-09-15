import { toast } from "sonner";
import { callAIContextBuilder } from "@/lib/ai/claude";
import { useCrmClient } from "@/hooks/useCrm";
import { confirmar } from "@/components/shared/Confirm";
import type { CaptureScene } from "@/hooks/useCaptureScripts";

/* ═══════════════════════════════════════════════════════════════════════════
   SUGERIR CENAS COM IA (Cria Captação)

   O botão "Sugerir cenas com IA" existia no RoteiroEditor desde agosto e nunca
   apareceu na tela: ele só renderiza quando quem usa o editor passa a função
   `sugerirIA`, e nenhuma tela passava. Era botão morto no código. Este hook é
   a função que faltava.

   A REGRA QUE MAIS IMPORTA AQUI: o tom é do CLIENTE, não nosso.
   Já aconteceu no produto de a IA tratar a social mídia como se ela fosse a
   criadora e escrever na voz errada (auditoria de 04/09). O roteiro de captação
   é pior nesse aspecto: quem vai FALAR aquilo na câmera é o dono do negócio. Se
   o texto não for a voz dele, ele lê e some do vídeo. Por isso o brandbook do
   cliente (tom, público, promessa, pilares e principalmente a lista de evitar)
   vai no prompt sempre que existe.
   ═══════════════════════════════════════════════════════════════════════════ */

export function useCenasIA(crmClientId: string | null | undefined, clienteNome?: string | null) {
  const { data: cliente } = useCrmClient(crmClientId ?? undefined);

  /** Assinatura compatível com a prop `sugerirIA` do RoteiroEditor. */
  const sugerir = async (ctx: {
    title: string; about: string; formato?: string; temCenas?: boolean;
  }): Promise<CaptureScene[] | null> => {
    const titulo = ctx.title.trim();
    const sobre = ctx.about.trim();
    if (!titulo && !sobre) {
      toast.error("Escreva o título ou a ideia do vídeo antes. É daí que a IA parte.");
      return null;
    }

    /* Substituir cena escrita é destruir trabalho. Confirma, e diz o que
       custa: a geração sai da cota da conta (mesmo padrão do Cria Post). */
    if (ctx.temCenas) {
      const ok = await confirmar({
        titulo: "Reescrever as cenas?",
        descricao: "Já existe roteiro escrito aqui. A IA vai substituir, e isso consome 1 geração da cota da sua conta.",
        acao: "Reescrever",
      });
      if (!ok) return null;
    }

    const bc = (cliente?.brand_core ?? {}) as Record<string, string>;
    try {
      const r = (await callAIContextBuilder({
        operation: "capture-scenes",
        data: {
          titulo, sobre,
          formato: ctx.formato || "reels",
          qtd: 5,
          cliente: clienteNome ?? cliente?.name ?? "",
          nicho: cliente?.segment ?? "",
          // O tom é do CLIENTE. É isto que separa "a IA escreveu" de
          // "a IA escreveu do jeito que essa marca fala".
          tom: bc.toneOfVoice, publico: bc.audience,
          promessa: bc.valueProp, temas: bc.contentThemes, evitar: bc.avoid,
        },
      })) as { cenas?: { fala?: string; direcao?: string }[] } | null;

      const cenas = (r?.cenas ?? [])
        .map((c) => ({ fala: String(c?.fala ?? "").trim(), direcao: String(c?.direcao ?? "").trim() }))
        .filter((c) => c.fala || c.direcao);

      if (cenas.length === 0) {
        toast.error("A IA não devolveu cenas. Tente de novo, ou escreva mais sobre o vídeo.");
        return null;
      }
      /* Sem brandbook a IA escreve no genérico, e é melhor ela saber disso do
         que descobrir depois que o cliente não se reconheceu no texto. */
      toast.success(bc.toneOfVoice || bc.audience
        ? "Cenas escritas no tom da marca. Leia em voz alta antes de gravar."
        : "Cenas prontas. Preencha o brandbook do cliente pra IA escrever na voz dele.");
      return cenas;
    } catch (e) {
      const msg = e instanceof Error ? e.message : "";
      if (/rate|limit|429/i.test(msg)) toast.error("Você já gerou muita coisa agora. Espere um pouco e tente de novo.");
      else if (/quota|cota/i.test(msg)) toast.error("A cota de IA da sua conta acabou neste ciclo.");
      else toast.error("Não consegui gerar as cenas agora. Tente de novo.");
      return null;
    }
  };

  return { sugerir, temBrandbook: !!(cliente?.brand_core as Record<string, string> | undefined)?.toneOfVoice };
}
