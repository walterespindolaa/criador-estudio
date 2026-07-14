import { useState } from "react";
import { toast } from "sonner";
import { callAIContextBuilder } from "@/lib/ai/claude";
import { lerPaginas, validarArquivo } from "@/lib/pdfPages";

/* ═══════════════════════════════════════════════════════════════════════════
   IMPORTAR O BRANDBOOK DE UM PDF

   O fluxo inteiro, e a ordem importa:
   1. valida (10 MB, PDF ou imagem)
   2. renderiza as páginas NO NAVEGADOR (o PDF não sobe inteiro)
   3. manda as páginas pro modelo que enxerga
   4. devolve os campos + a PÁGINA DE ONDE SAIU CADA UM
   5. NÃO SALVA NADA. Quem salva é a pessoa, depois de conferir.

   O passo 5 é o mais importante. IA gravando calada a cor errada da marca do
   cliente é pior do que o campo vazio: o erro fica invisível e sai em cinquenta
   posts antes de alguém perceber.
   ═══════════════════════════════════════════════════════════════════════════ */

/** As chaves são as mesmas de crm_clients.brand_core — o campo já existe. */
export type CampoLido = { valor: string; origem?: string };
export type LeituraBrandbook = {
  campos: Partial<Record<
    | "colorPalette" | "typography" | "toneOfVoice" | "personality" | "audience"
    | "valueProp" | "avoid" | "visualExpression" | "contentThemes" | "archetype",
    CampoLido | null
  >>;
  resumo?: string;
};

export type Etapa = "parado" | "lendo" | "pensando" | "pronto";

export function useBrandbookImport(alvo: "cliente" | "criador") {
  const [etapa, setEtapa] = useState<Etapa>("parado");
  const [progresso, setProgresso] = useState<{ lidas: number; total: number } | null>(null);
  const [leitura, setLeitura] = useState<LeituraBrandbook | null>(null);
  const [arquivo, setArquivo] = useState<File | null>(null);

  const importar = async (file: File) => {
    const invalido = validarArquivo(file);
    if (invalido) {
      toast.error(invalido.erro);
      return;
    }
    setArquivo(file);
    setEtapa("lendo");
    setProgresso(null);
    setLeitura(null);

    try {
      const paginas = await lerPaginas(file, (lidas, total) => setProgresso({ lidas, total }));
      if (paginas.length === 0) throw new Error("Não consegui abrir esse arquivo.");

      setEtapa("pensando");
      const r = (await callAIContextBuilder({
        operation: "brandbook-read",
        data: { imagens: paginas.map((p) => p.dataUrl), alvo },
      })) as LeituraBrandbook;

      const achou = Object.values(r?.campos ?? {}).some((c) => c && c.valor);
      if (!achou) {
        setEtapa("parado");
        toast.error("Li o arquivo mas não achei identidade de marca nele. Tem certeza que é o brandbook?");
        return;
      }
      setLeitura(r);
      setEtapa("pronto");
    } catch (e) {
      setEtapa("parado");
      const msg = e instanceof Error ? e.message : String(e);
      toast.error(
        /quota_exceeded/i.test(msg)
          ? "Você usou todas as gerações de IA deste mês."
          : msg && !/non-2xx/i.test(msg)
            ? msg
            : "Não consegui ler o arquivo. Tente um PDF com as páginas de paleta e tipografia.",
      );
    }
  };

  const cancelar = () => {
    setEtapa("parado");
    setLeitura(null);
    setArquivo(null);
    setProgresso(null);
  };

  return { etapa, progresso, leitura, arquivo, importar, cancelar };
}
