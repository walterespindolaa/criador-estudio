import { useEffect, useMemo, useRef, useState } from "react";
import DOMPurify from "dompurify";
import { ArrowLeft, Bold, Check, ChevronDown, Heading, List, Loader2, Settings2, Sparkles, Square } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { useIdeaGeracoes, type GeracaoDaFolha } from "@/hooks/useIdeaGeracoes";

/* ═══════════════════════════════════════════════════════════════════════════
   IDEIAS EM BLOCO DE NOTAS (Walter, 06/11/2026; mockup aprovado)

   Cada ideia é uma folha. Dentro dela a pessoa anota por tópico, grifa e marca
   checklist; o Cria salva sozinho. Ao lado (embaixo no celular) ela tira
   carrossel, reels, story... a partir do que está escrito, e o que a Cria IA
   devolveu fica guardado na própria folha. Escreveu mais depois de gerar? A
   folha avisa que mudou e dá pra gerar de novo com o contexto novo.

   SEGURANÇA: a folha guarda HTML (é o único jeito de ter grifo e tópico de
   verdade). Ele passa pelo DOMPurify com lista curta de tags na hora de
   salvar E na hora de mostrar, e o único estilo que sobrevive é a cor de fundo
   do grifo. Nada disso vai pra página pública.
   ═══════════════════════════════════════════════════════════════════════════ */

const TAGS = ["b", "strong", "i", "em", "u", "ul", "ol", "li", "h4", "p", "div", "br", "span", "mark"];
let ganchoInstalado = false;
function instalarGancho() {
  if (ganchoInstalado) return;
  ganchoInstalado = true;
  DOMPurify.addHook("uponSanitizeAttribute", (_no, dado) => {
    if (dado.attrName !== "style") return;
    const cor = /background(?:-color)?\s*:\s*([^;]+)/i.exec(dado.attrValue)?.[1]?.trim() ?? "";
    // Só cor de grifo: rgb(...) ou #hex. Qualquer outra coisa some.
    dado.attrValue = /^(rgb\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*\)|#[0-9a-f]{3,8})$/i.test(cor) ? `background-color: ${cor}` : "";
    if (!dado.attrValue) dado.keepAttr = false;
  });
}

function limpar(html: string): string {
  instalarGancho();
  return DOMPurify.sanitize(html, { ALLOWED_TAGS: TAGS, ALLOWED_ATTR: ["style"] });
}

const escapar = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const ehHtml = (s: string) => /<\/?(ul|li|h4|b|strong|p|div|br|span|mark|i|em|u)\b/i.test(s);

/** Anotação antiga (texto puro) vira parágrafos; a nova já é HTML e só é limpa. */
export function htmlDaFolha(notes: string | null | undefined): string {
  const n = notes ?? "";
  if (!n.trim()) return "<ul><li><br></li></ul>";
  if (ehHtml(n)) return limpar(n);
  return n.split(/\n/).map((l) => (l.trim() ? `<div>${escapar(l)}</div>` : "<div><br></div>")).join("");
}

/** Texto puro da folha (pra busca, pra IA e pra virar post). */
export function textoDaFolha(notes: string | null | undefined): string {
  const n = notes ?? "";
  if (!ehHtml(n)) return n.trim();
  const doc = new DOMParser().parseFromString(limpar(n), "text/html");
  doc.querySelectorAll("li").forEach((li) => li.prepend("• "));
  doc.querySelectorAll("li,div,p,h4,br").forEach((el) => el.append("\n"));
  return (doc.body.textContent ?? "").replace(/\n{3,}/g, "\n\n").trim();
}

/** Trechos grifados: pesam mais na geração. */
export function grifosDaFolha(notes: string | null | undefined): string[] {
  const n = notes ?? "";
  if (!ehHtml(n)) return [];
  const doc = new DOMParser().parseFromString(limpar(n), "text/html");
  return [...doc.querySelectorAll("span[style],mark")].map((e) => (e.textContent ?? "").trim()).filter(Boolean);
}

const GRIFOS = [
  { cor: "#FFE36B", nome: "amarelo" },
  { cor: "#FFC2DE", nome: "rosa" },
  { cor: "#BDEFCF", nome: "verde" },
  { cor: "#C9DAFF", nome: "azul" },
];

type Formato = { value: string; label: string };
type Sugestao = { titulo: string; formato: string; angulo: string; objetivo: string; gancho?: string; estrutura?: string[]; cta?: string; porque?: string };

function quando(iso: string) {
  const min = Math.round((Date.now() - new Date(iso).getTime()) / 60_000);
  if (min < 1) return "agora";
  if (min < 60) return `há ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `há ${h} h`;
  const d = Math.round(h / 24);
  return d === 1 ? "ontem" : `há ${d} dias`;
}

const COR_FORMATO: Record<string, string> = { carrossel: "#EA4918", reels: "#0061EE", story: "#FF77B9", estatico: "#00A652", youtube: "#C4302B" };

export function FolhaDaIdeia({
  aberta, onFechar, idea, donoId, pilar, formatos, restantes,
  onSalvar, onDetalhes, gerar, virarPost, guardarComoIdeia,
}: {
  aberta: boolean;
  onFechar: () => void;
  idea: { id: string; title: string; notes: string | null };
  /** Dono da conta (ideas.user_id). */
  donoId: string;
  pilar?: { nome: string; cor?: string | null } | null;
  formatos: Formato[];
  /** Gerações da Cria IA que ainda sobram no mês (null = sem limite visível). */
  restantes: number | null;
  onSalvar: (dados: { title?: string; notes?: string }) => Promise<void>;
  onDetalhes: () => void;
  /** Gera sugestões a partir do texto da folha. */
  gerar: (formato: string, contexto: { titulo: string; texto: string; grifos: string[] }) => Promise<Sugestao[]>;
  virarPost: (s: Sugestao, formato: string) => Promise<void>;
  guardarComoIdeia: (titulo: string) => Promise<void>;
}) {
  const editorRef = useRef<HTMLDivElement>(null);
  const tituloRef = useRef<HTMLTextAreaElement>(null);
  const ajustarTitulo = () => { const t = tituloRef.current; if (t) { t.style.height = "auto"; t.style.height = `${t.scrollHeight}px`; } };
  const [titulo, setTitulo] = useState(idea.title);
  const [html, setHtml] = useState(() => htmlDaFolha(idea.notes));
  const [salvando, setSalvando] = useState<"" | "salvando" | "salvo">("");
  const [formato, setFormato] = useState(formatos.find((f) => f.value === "carrossel")?.value ?? formatos[0]?.value ?? "carrossel");
  const [gerando, setGerando] = useState(false);
  const [aberto, setAberto] = useState<string | null>(null);
  const [verDescartadas, setVerDescartadas] = useState(false);
  const { geracoes, guardar, marcar } = useIdeaGeracoes(aberta ? idea.id : null);
  const timer = useRef<ReturnType<typeof setTimeout>>();

  // Ao abrir outra folha, recarrega o conteúdo do editor (ele não é controlado pelo React).
  useEffect(() => {
    if (!aberta) return;
    const h = htmlDaFolha(idea.notes);
    setTitulo(idea.title); setHtml(h); setSalvando("");
    requestAnimationFrame(() => { if (editorRef.current) editorRef.current.innerHTML = h; ajustarTitulo(); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aberta, idea.id]);

  const agendarSalvar = (dados: { title?: string; notes?: string }) => {
    setSalvando("salvando");
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      try { await onSalvar(dados); setSalvando("salvo"); } catch { setSalvando(""); }
    }, 900);
  };
  const aoDigitar = () => {
    const h = limpar(editorRef.current?.innerHTML ?? "");
    setHtml(h);
    agendarSalvar({ notes: h, title: titulo });
  };
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const cmd = (c: string, v?: string) => {
    editorRef.current?.focus();
    document.execCommand("styleWithCSS", false, "true");
    document.execCommand(c, false, v);
    aoDigitar();
  };
  const titulo4 = () => {
    const bloco = document.queryCommandValue("formatBlock").toLowerCase();
    cmd("formatBlock", bloco === "h4" ? "div" : "h4");
  };

  const texto = useMemo(() => textoDaFolha(html), [html]);
  const grifos = useMemo(() => grifosDaFolha(html), [html]);
  const visiveis = geracoes.filter((g) => verDescartadas || g.status !== "descartada");
  const descartadas = geracoes.filter((g) => g.status === "descartada").length;
  const ultima = geracoes[0];
  const mudou = !!ultima && (ultima.base_texto ?? "") !== texto && texto.length > 0;
  const linhasNovas = mudou
    ? Math.max(1, texto.split("\n").filter((l) => l.trim() && !(ultima.base_texto ?? "").includes(l.trim())).length)
    : 0;

  const gerarAgora = async () => {
    if (gerando) return;
    if (!texto && !titulo.trim()) return;
    setGerando(true);
    try {
      const sugestoes = await gerar(formato, { titulo, texto, grifos });
      if (sugestoes.length) {
        await guardar.mutateAsync(sugestoes.slice(0, 3).map((s) => ({
          user_id: donoId, formato, sugestao: s as unknown as Record<string, unknown>, base_texto: texto,
        })));
      }
    } finally { setGerando(false); }
  };

  const virar = async (g: GeracaoDaFolha) => {
    await virarPost(g.sugestao as unknown as Sugestao, g.formato);
    marcar.mutate({ id: g.id, status: "virou_post" });
  };

  const fechar = () => {
    // Salva na hora o que estiver pendente antes de fechar.
    if (timer.current) { clearTimeout(timer.current); void onSalvar({ notes: limpar(editorRef.current?.innerHTML ?? html), title: titulo }); }
    onFechar();
  };

  const btn = "h-8 min-w-8 px-2 grid place-items-center rounded-lg border border-border bg-background text-foreground/80 hover:border-primary/40 text-xs font-body font-bold";

  return (
    <Dialog open={aberta} onOpenChange={(o) => { if (!o) fechar(); }}>
      <DialogContent className="max-w-6xl w-[100vw] sm:w-[96vw] h-[100dvh] sm:h-[92vh] p-0 gap-0 rounded-none sm:rounded-3xl overflow-hidden flex flex-col bg-background">
        <DialogTitle className="sr-only">{titulo || "Folha"}</DialogTitle>
        <div className="flex items-center gap-2 pl-4 pr-12 sm:px-6 sm:pr-14 py-3 border-b border-border shrink-0">
          <button type="button" onClick={fechar} className="inline-flex items-center gap-1 text-sm font-body font-semibold text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" /> Todas as folhas
          </button>
          <span className="ml-auto text-[11.5px] font-body text-muted-foreground">
            {salvando === "salvando" ? "salvando…" : salvando === "salvo" ? "salvo" : ""}
          </span>
          <button type="button" onClick={onDetalhes} className="inline-flex items-center gap-1 rounded-full border border-border px-3 h-8 text-xs font-body font-semibold text-muted-foreground hover:text-foreground">
            <Settings2 className="h-3.5 w-3.5" /> Pilar e pasta
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          <div className="grid lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)] gap-5 p-4 sm:p-6 items-start">
            {/* A FOLHA */}
            <div className="relative rounded-[22px] border-2 border-foreground shadow-[0_4px_0_hsl(var(--foreground))] bg-[#FFFCF3] dark:bg-card pl-12 sm:pl-14 pr-4 sm:pr-6 pt-4 pb-8 min-h-[460px]"
              style={{ backgroundImage: "linear-gradient(90deg, transparent 34px, #F3B7B0 34px 36px, transparent 36px), repeating-linear-gradient(transparent 0 31px, rgba(201,182,150,.35) 31px 32px)", backgroundPosition: "0 0, 0 104px" }}>
              <div className="sticky top-0 z-10 -ml-6 sm:-ml-8 mb-3 flex flex-wrap items-center gap-1.5 rounded-xl bg-card/95 backdrop-blur p-1.5 w-fit max-w-full border border-border">
                <button type="button" className={btn} title="Negrito" onMouseDown={(e) => e.preventDefault()} onClick={() => cmd("bold")}><Bold className="h-3.5 w-3.5" /></button>
                <button type="button" className={btn} title="Tópico" onMouseDown={(e) => e.preventDefault()} onClick={() => cmd("insertUnorderedList")}><List className="h-3.5 w-3.5" /></button>
                <button type="button" className={btn} title="Título" onMouseDown={(e) => e.preventDefault()} onClick={titulo4}><Heading className="h-3.5 w-3.5" /></button>
                <button type="button" className={btn} title="Checklist" onMouseDown={(e) => e.preventDefault()} onClick={() => cmd("insertText", "☐ ")}><Square className="h-3.5 w-3.5" /></button>
                <span className="w-px h-5 bg-border mx-0.5" />
                {GRIFOS.map((g) => (
                  <button key={g.cor} type="button" title={`Grifar de ${g.nome}`} aria-label={`Grifar de ${g.nome}`}
                    onMouseDown={(e) => e.preventDefault()} onClick={() => cmd("hiliteColor", g.cor)}
                    className="h-6 w-6 rounded-full border border-black/10" style={{ background: g.cor }} />
                ))}
                <button type="button" className={cn(btn, "font-semibold")} title="Tirar o grifo" onMouseDown={(e) => e.preventDefault()} onClick={() => cmd("hiliteColor", "transparent")}>sem grifo</button>
              </div>
              {/* Título quebra linha (input cortava título longo no celular). */}
              <textarea ref={tituloRef} rows={1} value={titulo}
                onChange={(e) => { setTitulo(e.target.value.replace(/\n/g, " ")); agendarSalvar({ title: e.target.value.replace(/\n/g, " "), notes: html }); ajustarTitulo(); }}
                placeholder="Título da ideia"
                className="w-full resize-none overflow-hidden bg-transparent outline-none font-display font-extrabold !text-[24px] sm:!text-[28px] !leading-[1.15] text-foreground" />
              {pilar && (
                <span className="inline-block mt-1 rounded-full border px-2.5 py-0.5 text-[11px] font-body font-bold" style={{ borderColor: pilar.cor ?? undefined }}>{pilar.nome}</span>
              )}
              <div ref={editorRef} contentEditable suppressContentEditableWarning onInput={aoDigitar}
                data-placeholder="Escreva por tópicos. Grife o que mais importa."
                className="folha-editor mt-3 min-h-[320px] outline-none text-[15.5px] leading-8 font-body text-foreground [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_h4]:font-display [&_h4]:font-bold [&_h4]:text-[17px] [&_span[style]]:rounded-[3px] [&_span[style]]:px-0.5" />
            </div>

            {/* TIRAR IDEIAS + O QUE JÁ SAIU */}
            <div className="space-y-4 lg:sticky lg:top-0">
              <div className="rounded-[22px] border-2 border-foreground shadow-[0_4px_0_hsl(var(--foreground))] bg-card p-4">
                <p className="font-display font-extrabold text-lg leading-tight">Tirar ideias desta folha</p>
                <p className="text-[12.5px] font-body text-muted-foreground mt-1 leading-snug">
                  A Cria IA lê a folha inteira e o seu brandbook. O que você grifou pesa mais.
                </p>
                <div className="flex flex-wrap gap-1.5 mt-3">
                  {formatos.map((f) => (
                    <button key={f.value} type="button" onClick={() => setFormato(f.value)}
                      className={cn("rounded-full border px-3 py-1.5 text-xs font-body font-bold transition-colors",
                        formato === f.value ? "bg-foreground text-background border-foreground" : "border-border bg-background text-muted-foreground")}>{f.label}</button>
                  ))}
                </div>
                {mudou && (
                  <p className="mt-3 rounded-xl bg-amber-50 text-amber-900 text-[12px] font-body font-semibold px-3 py-2">
                    A folha mudou desde a última vez ({linhasNovas} {linhasNovas === 1 ? "linha nova" : "linhas novas"}). Gere de novo pra aproveitar.
                  </p>
                )}
                <button type="button" onClick={() => void gerarAgora()} disabled={gerando || (!texto && !titulo.trim()) || restantes === 0}
                  className="mt-3 w-full h-11 rounded-full bg-primary text-primary-foreground font-body font-extrabold text-sm border-2 border-foreground shadow-[0_3px_0_hsl(var(--foreground))] hover:-translate-y-0.5 transition-transform disabled:opacity-60 disabled:hover:translate-y-0 inline-flex items-center justify-center gap-2">
                  {gerando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                  {gerando ? "Lendo a folha…" : "Gerar 3 ideias desta folha"}
                </button>
                {restantes !== null && (
                  <p className="text-[11px] font-body text-muted-foreground text-center mt-2">
                    {restantes === 0 ? "As gerações da Cria IA deste mês acabaram." : `${restantes} ${restantes === 1 ? "geração restante" : "gerações restantes"} este mês`}
                  </p>
                )}
              </div>

              <div className="rounded-[22px] border border-border bg-card p-4">
                <p className="font-display font-extrabold text-lg leading-tight">
                  Já saiu desta folha {visiveis.length > 0 && <span className="text-sm font-body font-semibold text-muted-foreground">· {visiveis.length}</span>}
                </p>
                {visiveis.length === 0 ? (
                  <p className="text-[13px] font-body text-muted-foreground mt-2">Nada ainda. Escreva na folha e toque em gerar.</p>
                ) : (
                  <div className="space-y-2.5 mt-3">
                    {visiveis.map((g) => {
                      const s = g.sugestao as unknown as Sugestao;
                      const ab = aberto === g.id;
                      const rotulo = formatos.find((f) => f.value === g.formato)?.label ?? g.formato;
                      return (
                        <div key={g.id} className={cn("rounded-2xl border border-border bg-background p-3", g.status === "descartada" && "opacity-50")}>
                          <div className="flex items-center gap-1.5 text-[10.5px] font-body font-extrabold uppercase tracking-wide text-muted-foreground">
                            <span className="rounded-full px-2 py-0.5 text-white" style={{ background: COR_FORMATO[g.formato] ?? "#555" }}>{rotulo}</span>
                            {quando(g.created_at)}
                            {g.status === "virou_post" && <span className="ml-auto inline-flex items-center gap-1 text-green-700 normal-case tracking-normal"><Check className="h-3 w-3" /> virou post</span>}
                            {g.status === "guardada" && <span className="ml-auto text-blue-700 normal-case tracking-normal">no banco de ideias</span>}
                          </div>
                          <button type="button" onClick={() => setAberto(ab ? null : g.id)} className="w-full text-left mt-1.5">
                            <p className="font-body font-bold text-[14.5px] leading-snug flex items-start gap-1">
                              <span className="flex-1">{s.titulo}</span>
                              <ChevronDown className={cn("h-4 w-4 shrink-0 mt-0.5 text-muted-foreground transition-transform", ab && "rotate-180")} />
                            </p>
                            <p className="text-[12.5px] font-body text-muted-foreground mt-1 leading-snug">{s.gancho || s.angulo}</p>
                          </button>
                          {ab && (
                            <div className="mt-2 space-y-1.5 text-[12.5px] font-body text-foreground/85">
                              {s.estrutura?.length ? <ul className="list-disc pl-4 space-y-0.5">{s.estrutura.map((e, i) => <li key={i}>{e}</li>)}</ul> : null}
                              {s.cta && <p><b>CTA:</b> {s.cta}</p>}
                              {s.porque && <p className="text-muted-foreground"><b>Por que funciona:</b> {s.porque}</p>}
                            </div>
                          )}
                          {g.status !== "descartada" && g.status !== "virou_post" && (
                            <div className="flex flex-wrap gap-1.5 mt-2.5">
                              <button type="button" onClick={() => void virar(g)} className="rounded-full bg-primary text-primary-foreground px-3 py-1 text-xs font-body font-bold">Virar post</button>
                              {g.status !== "guardada" && (
                                <button type="button" onClick={() => void guardarComoIdeia(s.titulo).then(() => marcar.mutate({ id: g.id, status: "guardada" }))}
                                  className="rounded-full border border-border px-3 py-1 text-xs font-body font-bold">Guardar no banco</button>
                              )}
                              <button type="button" onClick={() => marcar.mutate({ id: g.id, status: "descartada" })} className="rounded-full border border-border px-3 py-1 text-xs font-body font-bold text-muted-foreground">Descartar</button>
                            </div>
                          )}
                          {g.status === "descartada" && (
                            <button type="button" onClick={() => marcar.mutate({ id: g.id, status: "nova" })} className="mt-2 text-xs font-body font-bold text-muted-foreground underline">Trazer de volta</button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
                {descartadas > 0 && (
                  <button type="button" onClick={() => setVerDescartadas((v) => !v)} className="mt-3 text-xs font-body font-semibold text-muted-foreground underline">
                    {verDescartadas ? "Esconder descartadas" : `Ver ${descartadas} ${descartadas === 1 ? "descartada" : "descartadas"}`}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** O cartão da folha na lista de Ideias. */
export function FolhaCard({ titulo, notes, pilar, pasta, geradas, selecionada, selecionando, onAbrir, onSelecionar, inclinacao }: {
  titulo: string;
  notes: string | null;
  pilar?: { nome: string; cor?: string | null } | null;
  pasta?: string | null;
  geradas: number;
  selecionada: boolean;
  selecionando: boolean;
  onAbrir: () => void;
  onSelecionar: () => void;
  inclinacao: number;
}) {
  const resumo = useMemo(() => textoDaFolha(notes).replace(/\s+/g, " ").slice(0, 220), [notes]);
  const grifo = useMemo(() => grifosDaFolha(notes)[0], [notes]);
  return (
    <div role="button" tabIndex={0} onClick={onAbrir} onKeyDown={(e) => { if (e.key === "Enter") onAbrir(); }}
      style={{ transform: `rotate(${inclinacao}deg)`, backgroundImage: "repeating-linear-gradient(transparent 0 25px, rgba(201,182,150,.35) 25px 26px)", backgroundPosition: "0 52px" }}
      className={cn("group relative cursor-pointer rounded-[18px] border-2 border-foreground bg-[#FFFCF3] dark:bg-card shadow-[0_4px_0_hsl(var(--foreground))] px-4 pt-7 pb-10 min-h-[200px] transition-transform hover:!rotate-0 hover:-translate-y-0.5",
        selecionada && "ring-4 ring-primary/40")}>
      <span aria-hidden className="absolute left-3 right-3 top-2.5 h-0 border-t-2 border-dashed border-foreground/15" />
      <button type="button" aria-label="Selecionar ideia" onClick={(e) => { e.stopPropagation(); onSelecionar(); }}
        className={cn("absolute top-2 left-2 z-10 h-6 w-6 rounded-full grid place-items-center border-2 transition-opacity",
          selecionada ? "bg-primary border-primary text-primary-foreground" : "bg-card border-muted-foreground/50",
          !selecionando && !selecionada && "opacity-0 group-hover:opacity-100 [@media(hover:none)]:opacity-60")}>
        {selecionada && <Check className="h-3.5 w-3.5" />}
      </button>
      {pilar && (
        <span className="absolute -top-2.5 right-4 rounded-lg border-2 border-foreground px-2 py-0.5 text-[10px] font-body font-extrabold uppercase tracking-wide text-foreground"
          style={{ background: pilar.cor ?? "#eee" }}>{pilar.nome}</span>
      )}
      <p className="font-display font-extrabold text-[17px] leading-tight">{titulo}</p>
      {grifo ? (
        <p className="mt-2 text-[13px] font-body leading-[26px] line-clamp-3">
          <span className="rounded-[3px] px-0.5 bg-[#FFE36B]">{grifo}</span>
        </p>
      ) : resumo ? (
        <p className="mt-2 text-[13px] font-body leading-[26px] text-foreground/75 line-clamp-3">{resumo}</p>
      ) : (
        <p className="mt-2 text-[13px] font-body leading-[26px] text-muted-foreground/70">Folha em branco</p>
      )}
      <div className="absolute left-4 right-4 bottom-3 flex items-center gap-2 text-[11px] font-body font-bold text-muted-foreground">
        <span className="truncate">{pasta ?? ""}</span>
        {geradas > 0 && <span className="ml-auto shrink-0 rounded-full bg-primary/10 text-primary px-2 py-0.5">{geradas} {geradas === 1 ? "ideia gerada" : "ideias geradas"}</span>}
      </div>
    </div>
  );
}
