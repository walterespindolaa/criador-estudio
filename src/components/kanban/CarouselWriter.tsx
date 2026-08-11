import { useState } from "react";
import { Sparkles, Loader2, Wand2, RefreshCw, Flame } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { callAIContextBuilder } from "@/lib/ai/claude";
import { confirmar } from "@/components/shared/Confirm";
import { useProfile } from "@/hooks/useProfile";
import type { Noticia } from "@/hooks/useArtPrompt";
import { emptySection, type Section } from "./drawer/ScriptEditor";

/* ═══════════════════════════════════════════════════════════════════════════
   ESCREVER O CONTEÚDO (lâminas, gancho e CTA)

   Duas correções de rumo importantes moram aqui:

   1. "O QUE ESTÁ QUENTE" MUDOU DE ABA.
      Eu tinha posto a busca de notícias na aba ARTE. Estava errado, e o Walter
      viu antes de mim: notícia muda o que o post DIZ, não a cara da imagem.
      Ela pertence a este passo. Agora, se você amarra o post ao que está em
      alta, isso entra no TEXTO das lâminas, e a arte herda de graça (porque o
      prompt da arte nasce do texto das lâminas).

   2. A IA PREENCHE OS CAMPOS CERTOS.
      Antes ela escrevia só as lâminas e deixava Gancho e CTA vazios, mesmo
      dizendo "a 1ª página é o gancho, a última é o CTA". A pessoa tinha que
      copiar na mão de um campo pro outro. Agora ela devolve os três, e cada um
      vai pro seu lugar.
   ═══════════════════════════════════════════════════════════════════════════ */

type Props = {
  titulo: string;
  formato: string;
  pilar?: string;
  sections: Section[];
  onChange: (s: Section[]) => void;
  /** Preenche o campo Gancho do post. Só sobrescreve se estiver vazio. */
  hook?: string;
  onHook?: (v: string) => void;
  /** Preenche o campo CTA do post. Só sobrescreve se estiver vazio. */
  cta?: string;
  onCta?: (v: string) => void;
  /** Carrossel: em vez de escrever lâmina a lâmina, junta tudo (páginas + CTA)
      no campo único "Desenvolvimento" (a coluna cta). */
  unify?: boolean;
};

export function CarouselWriter({
  titulo, formato, pilar, sections, onChange, hook, onHook, cta, onCta, unify,
}: Props) {
  const { profile } = useProfile();
  const [angulo, setAngulo] = useState("");
  const [qtd, setQtd] = useState(sections.length || 5);
  const [gerando, setGerando] = useState(false);

  const [quente, setQuente] = useState(false);
  const [noticias, setNoticias] = useState<Noticia[] | null>(null);
  const [buscando, setBuscando] = useState(false);
  const [escolhidas, setEscolhidas] = useState<Set<string>>(new Set());

  // No modo unificado o "já tem texto" olha o campo Desenvolvimento (cta),
  // não as lâminas, que nesse formato nem aparecem.
  const temTexto = unify
    ? (cta ?? "").trim().length > 0
    : sections.some((s) => (s.text ?? "").trim().length > 0);
  const ehReels = /reels|video|vídeo/i.test(formato);
  const palavra = ehReels ? "cenas" : "páginas";

  const buscar = async () => {
    if (!titulo.trim()) {
      toast.error("Escreva o título primeiro, é sobre ele que eu vou pesquisar.");
      return;
    }
    setBuscando(true);
    try {
      // Buscar NÃO consome cota. Cobrar por olhar a manchete, antes de decidir,
      // era o jeito mais rápido de queimar o crédito da pessoa à toa.
      const r = (await callAIContextBuilder({
        operation: "hot-news",
        data: { tema: titulo, nicho: profile?.niche ?? "" },
      })) as { noticias?: Noticia[] };
      const achadas = r?.noticias ?? [];
      setNoticias(achadas);
      setEscolhidas(new Set(achadas.map((n) => n.titulo)));
    } catch {
      setNoticias([]);
    } finally {
      setBuscando(false);
    }
  };

  const ligarQuente = async () => {
    const novo = !quente;
    setQuente(novo);
    if (novo && !noticias) await buscar();
  };

  const gerar = async () => {
    if (!titulo.trim()) {
      toast.error("Escreva o título do post primeiro, é dele que a IA parte.");
      return;
    }
    if (temTexto) {
      const ok = await confirmar({
        titulo: `Reescrever as ${palavra}?`,
        descricao: "Você já escreveu texto aqui. A IA vai substituir tudo, e isso consome 1 geração da sua cota.",
        acao: "Reescrever",
      });
      if (!ok) return;
    }

    const usadas = (noticias ?? []).filter((n) => escolhidas.has(n.titulo));
    const contextoQuente = quente && usadas.length > 0
      ? usadas.map((n) => `${n.titulo} (${n.fonte}, ${n.quando})${n.resumo ? `: ${n.resumo}` : ""}`).join("\n")
      : undefined;

    setGerando(true);
    try {
      const r = (await callAIContextBuilder({
        operation: "carousel-script",
        data: {
          titulo, tema: titulo, formato, qtd, angulo, contextoQuente,
          pilar, nicho: profile?.niche ?? "",
        },
      })) as { hook?: string; cta?: string; laminas?: { n: number; texto: string }[] };

      const laminas = r?.laminas ?? [];
      if (laminas.length === 0) throw new Error("A IA não devolveu nada. Tente de novo.");

      if (unify) {
        // Carrossel: sem separar slide a slide. Junta as páginas e cola o CTA
        // do último no fim, tudo no campo único Desenvolvimento (coluna cta).
        // Aqui a IA sobrescreve o campo de propósito: foi o que a pessoa pediu
        // ao clicar em "Escrever", e o confirm já avisou antes.
        const corpo = laminas.map((l) => l.texto).filter(Boolean).join("\n\n");
        const textoFinal = r.cta ? `${corpo}\n\n${r.cta}` : corpo;
        onCta?.(textoFinal);
        // O gancho tem campo próprio (Capa). Não sobrescreve o que ela escreveu.
        if (r.hook && onHook && !hook?.trim()) onHook(r.hook);
        toast.success(`Desenvolvimento escrito${r.hook && !hook?.trim() ? ", com gancho e CTA" : ""}.`);
      } else {
        // Preserva a mídia que já estava em cada lâmina: trocar o texto não pode
        // apagar a foto que ela já anexou.
        const novas: Section[] = laminas.map((l, i) => ({
          ...(sections[i] ?? emptySection()),
          text: l.texto,
        }));
        onChange(novas);

        // Cada coisa no seu campo. O gancho e o CTA têm lugar próprio no post, e
        // deixá-los vazios obrigava a pessoa a copiar da lâmina 1 na mão.
        // Não sobrescreve o que ela escreveu: o trabalho dela vence o da IA.
        if (r.hook && onHook && !hook?.trim()) onHook(r.hook);
        if (r.cta && onCta && !cta?.trim()) onCta(r.cta);

        toast.success(`${novas.length} ${palavra} escritas${r.hook && !hook?.trim() ? ", com gancho e CTA" : ""}.`);
      }
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
      <div className="flex items-center gap-2 mb-2.5">
        <span className="grid h-7 w-7 shrink-0 place-items-center rounded-xl bg-primary/12 text-primary">
          <Wand2 className="h-3.5 w-3.5" />
        </span>
        <div className="min-w-0">
          <p className="font-display text-[13.5px] font-bold text-foreground leading-tight">
            Não sabe o que escrever em cada {ehReels ? "cena" : "página"}?
          </p>
          <p className="text-[12px] font-body text-muted-foreground leading-snug">
            A IA escreve as {palavra}, o gancho e o CTA, no tom da sua marca. Você edita depois.
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
      </div>

      {/* ── AMARRAR COM O QUE ESTÁ QUENTE ────────────────────────────────────
             Isto estava na aba Arte, e era o lugar errado: notícia muda o que o
             post DIZ. Aqui ela entra no texto das lâminas, e a arte herda de
             graça, porque o prompt da arte nasce desse texto. ── */}
      <button
        type="button"
        onClick={() => void ligarQuente()}
        className={cn(
          "mt-2.5 flex w-full items-center gap-2 rounded-xl border-[1.5px] px-3 py-2 text-left transition-colors",
          quente ? "border-primary bg-primary/[0.05]" : "border-border bg-card hover:border-muted-foreground/30",
        )}
      >
        <Flame className={cn("h-4 w-4 shrink-0", quente ? "text-primary" : "text-muted-foreground")} />
        <span className="min-w-0 flex-1">
          <span className="block text-[13px] font-display font-bold text-foreground">
            Amarrar com o que está quente sobre isso
          </span>
          <span className="block text-[11.5px] font-body text-muted-foreground leading-snug">
            O post cita o que está sendo falado agora. Fica atual, mas envelhece em algumas semanas.
          </span>
        </span>
        {buscando && <Loader2 className="h-4 w-4 shrink-0 animate-spin text-primary" />}
      </button>

      {quente && !buscando && (
        <div className="mt-2 rounded-xl border border-border bg-card px-3 py-2.5">
          {(noticias ?? []).length === 0 ? (
            <p className="text-[12.5px] font-body text-muted-foreground leading-snug">
              Não achei nada em alta sobre este tema nos últimos 30 dias. O post sai atemporal,
              o que não é problema nenhum.
            </p>
          ) : (
            <>
              <div className="flex items-center justify-between gap-2 mb-1.5">
                <p className="text-[10.5px] font-display font-bold uppercase tracking-wider text-muted-foreground">
                  O que vai entrar no texto
                </p>
                <button
                  type="button"
                  onClick={() => void buscar()}
                  className="inline-flex items-center gap-1 text-[11px] font-body font-bold text-primary hover:underline"
                >
                  <RefreshCw className="h-3 w-3" /> buscar outras
                </button>
              </div>
              <div className="space-y-1.5">
                {(noticias ?? []).map((n) => {
                  const on = escolhidas.has(n.titulo);
                  return (
                    <label
                      key={n.titulo}
                      className={cn(
                        "flex cursor-pointer items-start gap-2.5 rounded-lg border px-2.5 py-1.5 transition-colors",
                        on ? "border-primary/40 bg-primary/[0.04]" : "border-border bg-background",
                      )}
                    >
                      <input
                        type="checkbox"
                        checked={on}
                        onChange={() => setEscolhidas((s) => {
                          const novo = new Set(s);
                          if (novo.has(n.titulo)) novo.delete(n.titulo); else novo.add(n.titulo);
                          return novo;
                        })}
                        className="mt-0.5 h-4 w-4 shrink-0 accent-[hsl(var(--primary))]"
                      />
                      <span className="min-w-0">
                        <span className="block text-[12.5px] font-body font-semibold text-foreground leading-snug">{n.titulo}</span>
                        <span className="block text-[11px] font-body text-muted-foreground">{n.fonte} · {n.quando}</span>
                      </span>
                    </label>
                  );
                })}
              </div>
            </>
          )}
        </div>
      )}

      <Button className="mt-3 w-full" onClick={() => void gerar()} disabled={gerando}>
        {gerando
          ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Escrevendo…</>
          : <><Sparkles className="h-4 w-4 mr-2" /> Escrever as {palavra}</>}
      </Button>
      <p className="mt-1.5 text-center text-[11px] font-body text-muted-foreground">
        Consome 1 geração da sua cota. Buscar notícia é de graça.
      </p>
    </div>
  );
}

export default CarouselWriter;
