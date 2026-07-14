import { useState } from "react";
import { Sparkles, Loader2, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { callAIContextBuilder } from "@/lib/ai/claude";
import { confirmar } from "@/components/shared/Confirm";
import { useCrmClient } from "@/hooks/useCrm";

/* ═══════════════════════════════════════════════════════════════════════════
   ESCREVER O CONTEÚDO DO POST DO CLIENTE

   A social mídia escreve conteúdo pra DEZ marcas, toda semana. É o trabalho
   mais repetitivo da rotina dela, e era o único lugar onde a IA do CRIA não
   ajudava, porque o gerador de lâminas só existia do lado do criador.

   A diferença que faz isto valer: ele escreve no tom do CLIENTE (o brand_core
   dele), não no tom da agência. É pra isso que serve o brandbook por PDF,
   ela sobe uma vez, e todo post daquele cliente nasce com a voz certa.

   Se o cliente não tem brandbook, ele AVISA em vez de escrever genérico. Texto
   genérico com a assinatura do cliente é pior que folha em branco: ela ia
   reescrever tudo e concluir que a IA do Cria não serve.
   ═══════════════════════════════════════════════════════════════════════════ */

type Props = {
  crmClientId: string | null;
  clienteNome: string;
  titulo: string;
  formato: string;
  /** O campo de roteiro/conteúdo do post. */
  valor: string;
  onChange: (texto: string) => void;
};

export function ClientContentWriter({ crmClientId, clienteNome, titulo, formato, valor, onChange }: Props) {
  const { data: cliente } = useCrmClient(crmClientId ?? undefined);
  const [qtd, setQtd] = useState(5);
  const [angulo, setAngulo] = useState("");
  const [gerando, setGerando] = useState(false);

  const bc = (cliente?.brand_core ?? {}) as Record<string, string>;
  const temMarca = !!(bc.toneOfVoice || bc.audience || bc.valueProp || bc.contentThemes);
  const ehReels = /reels|video|vídeo/i.test(formato);
  const palavra = ehReels ? "cenas" : "páginas";

  const gerar = async () => {
    if (!titulo.trim()) {
      toast.error("Escreva o título do post primeiro, é dele que a IA parte.");
      return;
    }
    if (valor.trim()) {
      const ok = await confirmar({
        titulo: "Reescrever o conteúdo?",
        descricao: "Já existe texto aqui. A IA vai substituir, e isso consome 1 geração da cota da sua conta.",
        acao: "Reescrever",
      });
      if (!ok) return;
    }

    setGerando(true);
    try {
      const r = (await callAIContextBuilder({
        operation: "carousel-script",
        data: {
          titulo, tema: titulo, formato, qtd, angulo,
          nicho: cliente?.segment ?? "",
          // O tom é do CLIENTE. É isto que separa "a IA escreveu" de
          // "a IA escreveu como a marca fala".
          cliente: clienteNome,
          tom: bc.toneOfVoice, publico: bc.audience,
          promessa: bc.valueProp, temas: bc.contentThemes, evitar: bc.avoid,
        },
      })) as { laminas?: { n: number; texto: string }[] };

      const laminas = r?.laminas ?? [];
      if (laminas.length === 0) throw new Error("A IA não devolveu nada. Tente de novo.");

      // O post do cliente não tem lâminas separadas (é um campo só). Então elas
      // entram numeradas — que é exatamente como o cliente lê na aprovação.
      onChange(laminas.map((l, i) => `${i + 1}. ${l.texto}`).join("\n\n"));
      toast.success(`${laminas.length} ${palavra} escritas no tom de ${clienteNome}.`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      toast.error(
        /quota_exceeded/i.test(msg) ? "A cota de IA da sua conta acabou este mês."
        : /no_access/i.test(msg) ? "Sua conta não tem cota de IA. Ative um módulo."
        : msg && !/non-2xx/i.test(msg) ? msg
        : "Não consegui escrever agora. Tente de novo.",
      );
    } finally {
      setGerando(false);
    }
  };

  return (
    <div className="rounded-2xl border border-dashed border-primary/30 bg-primary/[0.03] px-3 py-2.5 mb-2">
      <div className="flex items-center gap-2 mb-2">
        <span className="grid h-6 w-6 shrink-0 place-items-center rounded-lg bg-primary/12 text-primary">
          <Wand2 className="h-3 w-3" />
        </span>
        <p className="text-[12.5px] font-body text-foreground leading-snug">
          {temMarca ? (
            <>A IA escreve as {palavra} <b className="font-display">no tom de {clienteNome}</b>, a partir do título.</>
          ) : (
            <>
              <b className="font-display">{clienteNome} ainda não tem brandbook.</b>{" "}
              Sem tom de voz e público, o texto sai genérico, preencha a marca dele (ou suba o PDF) primeiro.
            </>
          )}
        </p>
      </div>

      {temMarca && (
        <div className="flex flex-wrap items-end gap-2">
          <div className="flex-1 min-w-[150px]">
            <input
              value={angulo}
              onChange={(e) => setAngulo(e.target.value)}
              placeholder="Algum ângulo? (opcional)"
              className="w-full rounded-lg border border-border bg-card px-2.5 py-1.5 text-[12.5px] font-body outline-none focus:border-primary"
            />
          </div>
          <input
            type="number"
            min={2}
            max={12}
            value={qtd}
            onChange={(e) => setQtd(Math.max(2, Math.min(12, Number(e.target.value) || 5)))}
            className="w-[64px] rounded-lg border border-border bg-card px-2.5 py-1.5 text-[12.5px] font-body outline-none focus:border-primary"
            title={ehReels ? "Cenas" : "Páginas"}
          />
          <Button size="sm" onClick={() => void gerar()} disabled={gerando}>
            {gerando
              ? <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> Escrevendo…</>
              : <><Sparkles className="h-3.5 w-3.5 mr-1.5" /> Escrever</>}
          </Button>
        </div>
      )}
    </div>
  );
}

export default ClientContentWriter;
