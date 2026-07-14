import { useState } from "react";
import { Sparkles, Loader2, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { callAIContextBuilder } from "@/lib/ai/claude";
import { confirmar } from "@/components/shared/Confirm";
import { useProfile } from "@/hooks/useProfile";
import { emptySection, type Section } from "./drawer/ScriptEditor";

/* ═══════════════════════════════════════════════════════════════════════════
   ESCREVER AS LÂMINAS COM IA

   Isto existia no Cria Estúdio antigo e eu MATEI junto com a tela: a pessoa
   dava o tema e ele escrevia página por página do carrossel. Foi erro meu —
   o problema era a TELA (um destino que ninguém visitava), não o recurso.

   Agora ele vive onde as lâminas vivem: aqui, na aba Roteiro. E ele é o que
   alimenta a aba Arte: com o texto de cada página escrito, o prompt da arte
   nasce do conteúdo de verdade, e não de um chute em cima do título.

   Ele NUNCA sobrescreve calado: se já tem texto nas lâminas, pergunta antes.
   ═══════════════════════════════════════════════════════════════════════════ */

type Props = {
  titulo: string;
  formato: string;
  pilar?: string;
  sections: Section[];
  onChange: (s: Section[]) => void;
};

export function CarouselWriter({ titulo, formato, pilar, sections, onChange }: Props) {
  const { profile } = useProfile();
  const [angulo, setAngulo] = useState("");
  const [qtd, setQtd] = useState(sections.length || 5);
  const [gerando, setGerando] = useState(false);

  const temTexto = sections.some((s) => (s.text ?? "").trim().length > 0);
  const ehReels = /reels|video|vídeo/i.test(formato);
  const palavra = ehReels ? "cenas" : "páginas";

  const gerar = async () => {
    if (!titulo.trim()) {
      toast.error("Escreva o título do post primeiro — é dele que a IA parte.");
      return;
    }
    if (temTexto) {
      const ok = await confirmar({
        titulo: `Reescrever as ${palavra}?`,
        descricao: `Você já escreveu texto aqui. A IA vai substituir tudo, e isso consome 1 geração da sua cota.`,
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
          pilar, nicho: profile?.niche ?? "",
        },
      })) as { laminas?: { n: number; texto: string }[] };

      const laminas = r?.laminas ?? [];
      if (laminas.length === 0) throw new Error("A IA não devolveu nada. Tente de novo.");

      // Preserva a mídia que já estava em cada lâmina — trocar o texto não pode
      // apagar a foto que ela já anexou.
      const novas: Section[] = laminas.map((l, i) => ({
        ...(sections[i] ?? emptySection()),
        text: l.texto,
      }));
      onChange(novas);
      toast.success(`${novas.length} ${palavra} escritas. Edite o que quiser.`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      toast.error(
        /quota_exceeded/i.test(msg)
          ? "Você usou todas as gerações de IA deste mês."
          : msg && !/non-2xx/i.test(msg) ? msg : "Não consegui escrever agora. Tente de novo.",
      );
    } finally {
      setGerando(false);
    }
  };

  return (
    <div data-tour="roteiro-ia" className="rounded-2xl border border-dashed border-primary/30 bg-primary/[0.03] px-3.5 py-3">
      <div className="flex items-center gap-2 mb-2">
        <span className="grid h-7 w-7 shrink-0 place-items-center rounded-xl bg-primary/12 text-primary">
          <Wand2 className="h-3.5 w-3.5" />
        </span>
        <div className="min-w-0">
          <p className="font-display text-[13.5px] font-bold text-foreground leading-tight">
            Não sabe o que escrever em cada {ehReels ? "cena" : "página"}?
          </p>
          <p className="text-[12px] font-body text-muted-foreground leading-snug">
            A IA escreve as {palavra} a partir do título, no tom da sua marca. Você edita depois.
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-2">
        <div className="flex-1 min-w-[180px]">
          <label className="block text-[11px] font-body font-semibold text-muted-foreground mb-1">
            Algum ângulo? (opcional)
          </label>
          <input
            value={angulo}
            onChange={(e) => setAngulo(e.target.value)}
            placeholder="Ex: focar em quem está começando"
            className="w-full rounded-xl border-[1.5px] border-border bg-card px-3 py-2 text-[13px] font-body outline-none focus:border-primary focus:ring-2 focus:ring-primary/10"
          />
        </div>
        <div className="w-[86px]">
          <label className="block text-[11px] font-body font-semibold text-muted-foreground mb-1">
            {ehReels ? "Cenas" : "Páginas"}
          </label>
          <input
            type="number"
            min={2}
            max={12}
            value={qtd}
            onChange={(e) => setQtd(Math.max(2, Math.min(12, Number(e.target.value) || 5)))}
            className="w-full rounded-xl border-[1.5px] border-border bg-card px-3 py-2 text-[13px] font-body outline-none focus:border-primary focus:ring-2 focus:ring-primary/10"
          />
        </div>
        <Button onClick={() => void gerar()} disabled={gerando}>
          {gerando
            ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Escrevendo…</>
            : <><Sparkles className="h-4 w-4 mr-2" /> Escrever as {palavra}</>}
        </Button>
      </div>

      <p className="mt-2 text-[11px] font-body text-muted-foreground">
        Consome 1 geração da sua cota. A 1ª {ehReels ? "cena" : "página"} é o gancho, a última é o CTA.
      </p>
    </div>
  );
}

export default CarouselWriter;
