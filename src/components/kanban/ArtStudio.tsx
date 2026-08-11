import { useMemo, useState } from "react";
import {
  Sparkles, Copy, Check, ChevronDown, Info, Palette, ArrowLeft, Loader2, AlertTriangle, RefreshCw,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useArtPrompt, useArtSalvo, type ArtResult } from "@/hooks/useArtPrompt";
import { confirmar } from "@/components/shared/Confirm";
import { useTier } from "@/hooks/useTier";
import type { Section } from "./drawer/ScriptEditor";

/* ═══════════════════════════════════════════════════════════════════════════
   CRIA ESTÚDIO, dentro do post

   REGRA DE OURO DESTA TELA (é o que o Walter mais temia):
   ela tem que ser DIDÁTICA sem virar uma parede de texto. O jeito de explicar
   não é encher a tela de instruções, ninguém lê. É:
     · cada botão dizer o QUE VAI ACONTECER, não o nome do recurso;
     · cada escolha mostrar a CONSEQUÊNCIA ("fica atual mas envelhece" vs
       "serve o ano inteiro"), em vez de um toggle mudo;
     · o resultado dizer DE ONDE SAIU, porque quando a arte sair errada, a
       pessoa precisa entender que o conserto é no Brandbook, e não ficar
       clicando "gerar de novo" achando que a IA é ruim.

   E NO CELULAR: uma camada só. Isto NÃO abre como uma segunda folha por cima
   do post, ele avança DENTRO do post (o post troca de conteúdo e ganha um
   "voltar"). Duas folhas empilhadas em 390px é um labirinto: o gesto de voltar
   fecha a errada e o teclado do iOS sobe por cima das duas.
   ═══════════════════════════════════════════════════════════════════════════ */

type Props = {
  titulo: string;
  formato: string;
  sections: Section[];
  roteiro?: string;
  /** O post onde os prompts ficam guardados. Sem id (post novo), não persiste. */
  postId?: string | null;
  /** Mobile: mostra o "voltar" (o Estúdio é uma página dentro do post). */
  onVoltar?: () => void;
  /** Salva os prompts no post (campo notas/roteiro fica a cargo do pai). */
  onSalvar?: (texto: string) => void;
  /** Leva pra aba Roteiro, onde a IA escreve o conteúdo das lâminas. */
  onIrParaRoteiro?: () => void;
};

export function ArtStudio({ titulo, formato, sections, roteiro, postId, onVoltar, onSalvar, onIrParaRoteiro }: Props) {
  const navigate = useNavigate();
  const { atLeast } = useTier();
  const { gerar, gerando, resultado: recemGerado, limpar, semMarca } = useArtPrompt();
  const { salvo, guardar } = useArtSalvo(postId);

  /* A escolha de "amarrar com o que está quente" SAIU daqui e foi pro Roteiro.
     Notícia muda o que o post DIZ, não a cara da imagem. E como o prompt da arte
     nasce do texto das lâminas, ele herda o assunto quente de graça: uma escolha
     só, no lugar certo, em vez de duas escolhas parecidas em abas diferentes. */

  const [aberta, setAberta] = useState<number | null>(1);
  const [copiada, setCopiada] = useState<number | null>(null);

  // O que a tela mostra: o que acabou de sair da IA, ou o que ficou guardado no
  // post. Sem isto, sair do post e voltar apagava tudo e ela pagaria outra
  // geração pra ver exatamente a mesma coisa. Crédito queimado à toa é a forma
  // mais rápida de a pessoa achar o produto caro.
  const resultado = recemGerado ?? salvo?.resultado ?? null;

  const paginasComTexto = useMemo(
    () => sections.filter((s) => (s.text ?? "").trim().length > 0),
    [sections],
  );
  const usaPaginas = paginasComTexto.length > 0;
  const nPaginas = usaPaginas ? paginasComTexto.length : 1;

  // ── A trava. Não é <Navigate>: é vitrine. A pessoa clicou porque QUERIA -
  //    essa é a melhor oportunidade de venda que existe, e um redirect a joga
  //    fora. A trava de verdade (a que importa) está na edge function.
  const liberado = atLeast("pro");

  if (!liberado) {
    return (
      <div className="px-1 py-6 text-center">
        <span className="inline-grid h-12 w-12 place-items-center rounded-2xl bg-primary/10 text-primary mx-auto mb-3">
          <Sparkles className="h-6 w-6" />
        </span>
        <h3 className="font-display text-lg font-extrabold text-foreground">
          O prompt da arte, na sua marca
        </h3>
        <p className="text-sm font-body text-muted-foreground mt-1.5 max-w-sm mx-auto leading-relaxed">
          O Cria Estúdio lê o que você escreveu no post e devolve o prompt da imagem
          já com as suas cores, a sua fonte e o seu tom. Você cola no gerador que já usa.
        </p>
        <Button variant="hero" className="mt-4" onClick={() => navigate("/app/assinar?plano=pro")}>
          Liberar no Pro, R$ 32,90
        </Button>
      </div>
    );
  }

  const disparar = async () => {
    const r = await gerar({
      titulo,
      formato,
      paginas: sections.map((s) => ({ texto: s.text ?? "" })),
      roteiro,
    });
    // Guarda NO POST, na hora. Ela não precisa lembrar de salvar nada.
    void guardar({ resultado: r, noticias: [], geradoEm: new Date().toISOString() });
    setAberta(1);
  };

  const regerar = async () => {
    const ok = await confirmar({
      titulo: "Gerar de novo?",
      descricao: "Isto consome mais 1 geração da sua cota de IA e substitui os prompts que já estão aqui.",
      acao: "Gerar de novo",
    });
    if (!ok) return;
    await disparar();
  };

  const copiar = async (p: { n: number; en: string; pt: string }) => {
    const texto = p.en?.trim() || p.pt;
    try {
      await navigator.clipboard.writeText(texto);
      setCopiada(p.n);
      setTimeout(() => setCopiada(null), 1800);
      toast.success("Prompt copiado em inglês. Cole no seu gerador.");
    } catch {
      toast.error("Não consegui copiar. Selecione o texto e copie na mão.");
    }
  };

  const salvarNoPost = (r: ArtResult) => {
    const texto = [
      "PROMPTS DA ARTE (Cria Estúdio)",
      `Estilo: ${r.estilo.descricao}`,
      "",
      ...r.paginas.map((p) => `${p.n}. ${p.titulo}\nPT: ${p.pt}\nEN: ${p.en}`),
    ].join("\n");
    onSalvar?.(texto);
    toast.success("Prompts salvos nas notas do post.");
  };

  return (
    <div className="space-y-4">

      {/* Cabeçalho, no celular ele é a barra de "voltar" (uma camada só) */}
      {onVoltar && (
        <div className="flex items-center gap-2.5 md:hidden">
          <button
            type="button"
            onClick={onVoltar}
            className="grid h-8 w-8 place-items-center rounded-xl bg-muted text-muted-foreground"
            aria-label="Voltar pro post"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div className="min-w-0">
            <p className="font-display text-sm font-extrabold text-foreground leading-tight">Cria Estúdio</p>
            <p className="text-[11px] font-body text-muted-foreground">o prompt da arte deste post</p>
          </div>
        </div>
      )}

      {/* ── O QUE ELE VAI USAR. Dizer isto ANTES é o que impede a pessoa de
             achar que o resultado saiu do nada (ou de um chute). ── */}
      <div
        data-tour="estudio-base"
        className="rounded-2xl border border-dashed border-border bg-muted/30 px-3.5 py-3 text-[13px] font-body leading-relaxed"
      >
        {usaPaginas ? (
          <>
            <b className="font-display">Vou usar o que você já escreveu.</b>{" "}
            {nPaginas === 1
              ? "Esta página tem texto, o prompt nasce dele."
              : `As ${nPaginas} páginas têm texto, cada prompt nasce da página, não de um chute em cima do título.`}
          </>
        ) : (
          <>
            <b className="font-display">O prompt vai sair só do título.</b>{" "}
            Você ainda não escreveu o conteúdo dos slides, dá pra gerar assim, mas fica raso.
            {/* A saída é UM CLIQUE daqui: sobe pro passo 1 (o conteúdo do post),
                onde ela escreve os slides. Mandar a pessoa procurar sozinha o
                recurso que resolve o problema que a gente apontou é jogar a
                culpa nela. */}
            {onIrParaRoteiro && (
              <>
                {" "}
                <button
                  type="button"
                  onClick={onIrParaRoteiro}
                  className="font-display font-bold text-primary underline underline-offset-2"
                >
                  Escrever o conteúdo primeiro ↑
                </button>{" "}
                (sobe pro passo 1, leva 10 segundos, e o prompt sai muito melhor depois).
              </>
            )}
          </>
        )}
      </div>

      {/* Brandbook vazio = prompt genérico. Avisar ANTES, não depois. */}
      {semMarca && (
        <div className="flex items-start gap-2.5 rounded-2xl border border-amber-500/30 bg-amber-500/[0.06] px-3.5 py-3">
          <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
          <div className="text-[13px] font-body leading-relaxed">
            <b className="font-display">Seu Brandbook está sem cores e fontes.</b> Sem isso o prompt
            sai bonito, mas genérico, com cara de qualquer marca.{" "}
            <button
              type="button"
              className="font-semibold text-primary underline underline-offset-2"
              onClick={() => navigate("/app/brandbook")}
            >
              Preencher agora
            </button>{" "}
            leva 2 minutos e melhora tudo que a IA escreve por você daqui pra frente.
          </div>
        </div>
      )}

      {/* ── AÇÃO. No celular ela vive presa no rodapé (zona do polegar);
             botão importante no fim de um scroll longo é botão que não existe. ── */}
      <div
        data-tour="estudio-gerar"
        className={cn(
          "flex flex-col gap-1.5",
          // No desktop volta a ser um bloco normal dentro do card: zera a margem
          // negativa e o padding da barra, senão o botao vaza pra fora da borda.
          "md:static md:mx-0 md:bg-transparent md:border-0 md:p-0",
          "sticky bottom-0 -mx-4 border-t border-border bg-background px-4 pt-3 pb-[max(12px,env(safe-area-inset-bottom))] sm:-mx-6 sm:px-6",
        )}
      >
        <Button
          variant="hero"
          size="lg"
          className="w-full md:w-auto"
          onClick={() => void (resultado ? regerar() : disparar())}
          disabled={gerando}
        >
          {gerando ? (
            <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Escrevendo os prompts…</>
          ) : resultado ? (
            <><RefreshCw className="h-4 w-4 mr-2" /> Gerar de novo</>
          ) : (
            <><Sparkles className="h-4 w-4 mr-2" /> Gerar {nPaginas > 1 ? `os ${nPaginas} prompts` : "o prompt"}</>
          )}
        </Button>
        <p className="text-center text-[11px] font-body text-muted-foreground md:text-left">
          {resultado
            ? "os prompts ficam guardados neste post, reabrir não custa nada"
            : "consome 1 geração da sua cota de IA"}
        </p>
      </div>

      {/* ── O RESULTADO ── */}
      {resultado && (
        <div className="space-y-3 pt-1">

          {/* O bloco de estilo. Ele existe porque é o que dá UNIDADE ao
              carrossel: sem ele, 5 páginas viram 5 imagens de 5 mundos. */}
          <div className="rounded-2xl border border-border bg-muted/40 px-3.5 py-3">
            <p className="flex items-center gap-1.5 text-[10.5px] font-display font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
              <Palette className="h-3.5 w-3.5" /> O estilo que se repete em todas as páginas
            </p>
            <p className="text-[13px] font-body text-foreground leading-relaxed">{resultado.estilo.descricao}</p>
            {(resultado.cores.length > 0 || resultado.fontes.length > 0) && (
              <div className="flex flex-wrap gap-1.5 mt-2.5">
                {resultado.cores.slice(0, 5).map((c) => (
                  <span key={c} className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-2 py-0.5 text-[11px] font-body font-semibold">
                    <i className="h-2.5 w-2.5 rounded-sm border border-black/10" style={{ background: c.startsWith("#") ? c : undefined }} />
                    {c}
                  </span>
                ))}
                {resultado.fontes.slice(0, 3).map((f) => (
                  <span key={f} className="rounded-full border border-border bg-card px-2 py-0.5 text-[11px] font-body font-semibold">{f}</span>
                ))}
              </div>
            )}
          </div>

          {/* Sanfona: UMA página aberta por vez. Cinco prompts abertos no
              celular são uma parede de texto que ninguém lê. */}
          <div className="space-y-2">
            {resultado.paginas.map((p) => {
              const on = aberta === p.n;
              return (
                <div key={p.n} className="rounded-2xl border border-border bg-card overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setAberta(on ? null : p.n)}
                    className="flex w-full items-center gap-2.5 px-3.5 py-2.5 text-left"
                  >
                    <span className="grid h-6 w-6 shrink-0 place-items-center rounded-lg bg-muted font-display text-[11px] font-extrabold text-muted-foreground">
                      {p.n}
                    </span>
                    <span className="flex-1 min-w-0 truncate font-display text-[13px] font-bold text-foreground">
                      {p.titulo}
                    </span>
                    <ChevronDown className={cn("h-4 w-4 shrink-0 text-muted-foreground transition-transform", on && "rotate-180")} />
                  </button>

                  {on && (
                    <div className="border-t border-border px-3.5 py-3">
                      <p className="text-[13px] font-body text-foreground leading-relaxed">{p.pt}</p>
                      {p.en && (
                        <p className="mt-2 border-t border-dashed border-border pt-2 text-[12px] font-body italic text-muted-foreground leading-relaxed">
                          EN: {p.en}
                        </p>
                      )}
                      {/* Botão de largura inteira: no celular, "copiar" tem que
                          ser um alvo do polegar, não um linkzinho de 12px. */}
                      <Button
                        variant="outline"
                        className="mt-2.5 w-full border-primary/30 bg-primary/[0.06] text-primary hover:bg-primary/10"
                        onClick={() => copiar(p)}
                      >
                        {copiada === p.n ? <><Check className="h-4 w-4 mr-2" /> Copiado</> : <><Copy className="h-4 w-4 mr-2" /> Copiar em inglês</>}
                      </Button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* ── PROCEDÊNCIA. A parte mais importante da tela.
                 Quando a arte sair errada, a pessoa precisa saber ONDE consertar. ── */}
          <div data-tour="estudio-procedencia" className="flex items-start gap-2.5 rounded-2xl border border-emerald-600/20 bg-emerald-600/[0.06] px-3.5 py-3">
            <Info className="h-4 w-4 text-emerald-700 shrink-0 mt-0.5" />
            <div className="text-[12.5px] font-body leading-relaxed">
              <b className="font-display">De onde isso saiu:</b>{" "}
              {resultado.base === "paginas" ? "do texto que você escreveu em cada página" : "do título do post"}
              {resultado.cores.length > 0 ? `, das suas cores (${resultado.cores.slice(0, 2).join(", ")})` : ""}
              {resultado.fontes.length > 0 ? ` e da sua fonte (${resultado.fontes[0]})` : ""}.
              <br />
              <span className="text-muted-foreground">
                Mostro em português pra você conferir; o botão copia em inglês, que é o que os geradores
                de imagem entendem melhor. Se a arte sair com a cara errada, o conserto é no{" "}
                <button type="button" className="font-semibold text-emerald-800 underline underline-offset-2" onClick={() => navigate("/app/brandbook")}>
                  seu Brandbook
                </button>
                {" "}, não em gerar de novo.
              </span>
            </div>
          </div>

          {onSalvar && (
            <div className="flex flex-wrap gap-2">
              <Button variant="default" className="flex-1 sm:flex-none" onClick={() => salvarNoPost(resultado)}>
                <Check className="h-4 w-4 mr-2" /> Salvar os prompts no post
              </Button>
              <Button variant="ghost" onClick={() => limpar()}>Descartar</Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default ArtStudio;
