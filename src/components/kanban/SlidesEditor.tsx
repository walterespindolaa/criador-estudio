import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { ArrowDown, ArrowUp, GripVertical, Layers, Plus, X } from "lucide-react";
import { DragDropContext, Draggable, Droppable, type DraggableProvidedDragHandleProps, type DropResult } from "@hello-pangea/dnd";
import { cn } from "@/lib/utils";
import { LIMITE_SLIDES, joinSlides, parseSlides } from "@/lib/slides-carrossel";

/* EDITOR DE SLIDES DO CARROSSEL (Walter, 19/10/2026; mockup aprovado).
 * Capa e conteúdo viram uma lista numerada: 1 é a capa (campo `hook`),
 * 2..N são os slides (campo `cta`, um por parágrafo). Cada linha cresce com o
 * texto. Enter cria o próximo, Shift+Enter quebra linha dentro do slide,
 * Backspace num slide vazio apaga e volta pro anterior, setas navegam. */

type Props = {
  capa: string;
  onChangeCapa: (v: string) => void;
  /** Texto do campo `cta`: slides 2..N separados por linha em branco. */
  slides: string;
  onChangeSlides: (v: string) => void;
  /** Ação ao lado da capa (ex.: Ideias de gancho). */
  acaoCapa?: ReactNode;
  className?: string;
};

export function SlidesEditor({ capa, onChangeCapa, slides, onChangeSlides, acaoCapa, className }: Props) {
  // Lista local: guarda slide vazio enquanto a pessoa escreve (o campo salvo
  // não guarda vazio). Só ressincroniza quando o texto mudou por fora (IA,
  // troca de post), comparando com o que esta lista geraria.
  const [lista, setLista] = useState<string[]>(() => comUmVazio(parseSlides(slides)));
  useEffect(() => {
    if (joinSlides(lista) !== (slides ?? "").replace(/\r\n/g, "\n").trim()) setLista(comUmVazio(parseSlides(slides)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slides]);

  const refs = useRef<(HTMLTextAreaElement | null)[]>([]);
  const [foco, setFoco] = useState<{ i: number; pos: "inicio" | "fim" | number } | null>(null);

  useLayoutEffect(() => {
    if (!foco) return;
    const el = refs.current[foco.i];
    if (el) {
      el.focus();
      const p = foco.pos === "inicio" ? 0 : foco.pos === "fim" ? el.value.length : foco.pos;
      el.setSelectionRange(p, p);
    }
    setFoco(null);
  }, [foco]);

  const gravar = (nova: string[]) => {
    setLista(nova);
    onChangeSlides(joinSlides(nova));
  };

  // Índice "geral": 0 = capa, 1..N = lista[0..N-1].
  const valorDe = (i: number) => (i === 0 ? capa : lista[i - 1] ?? "");
  const total = 1 + lista.length;

  const mudar = (i: number, v: string) => {
    if (i === 0) { onChangeCapa(v); return; }
    const nova = [...lista];
    nova[i - 1] = v;
    gravar(nova);
  };

  const inserirDepois = (i: number, texto = "") => {
    const nova = [...lista];
    nova.splice(i, 0, texto); // depois do geral i = posição i na lista
    gravar(nova);
    setFoco({ i: i + 1, pos: "inicio" });
  };

  const remover = (i: number, focarAnterior = true) => {
    if (i === 0) return;
    const nova = lista.filter((_, k) => k !== i - 1);
    gravar(comUmVazio(nova));
    if (focarAnterior) setFoco({ i: Math.max(0, i - 1), pos: "fim" });
  };

  const mover = (i: number, dir: -1 | 1) => {
    const a = i - 1, b = a + dir;
    if (i === 0 || b < 0 || b >= lista.length) return;
    const nova = [...lista];
    [nova[a], nova[b]] = [nova[b], nova[a]];
    gravar(nova);
    setFoco({ i: i + dir, pos: "fim" });
  };

  const teclas = (i: number) => (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.nativeEvent.isComposing) return;
    const el = e.currentTarget;
    const ini = el.selectionStart, fim = el.selectionEnd;
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      // O que está depois do cursor vai pro slide novo.
      const v = valorDe(i);
      const antes = v.slice(0, ini), depois = v.slice(fim);
      inserirDepoisCom(i, depois, depois ? antes : undefined);
      return;
    }
    if (e.key === "Backspace" && i > 0 && el.value === "") {
      e.preventDefault();
      remover(i);
      return;
    }
    if (e.key === "ArrowUp" && ini === 0 && fim === 0 && i > 0) {
      e.preventDefault();
      setFoco({ i: i - 1, pos: "fim" });
      return;
    }
    if (e.key === "ArrowDown" && ini === el.value.length && i < total - 1) {
      e.preventDefault();
      setFoco({ i: i + 1, pos: "inicio" });
    }
  };

  // Enter no meio do texto: corta e manda o resto pro slide novo numa
  // gravação só (duas gravações seguidas perderiam a primeira).
  const inserirDepoisCom = (i: number, texto: string, cortado?: string) => {
    if (i === 0) {
      if (cortado !== undefined) onChangeCapa(cortado);
      inserirDepois(0, texto);
      return;
    }
    const nova = [...lista];
    if (cortado !== undefined) nova[i - 1] = cortado;
    nova.splice(i, 0, texto);
    gravar(nova);
    setFoco({ i: i + 1, pos: "inicio" });
  };

  /* ARRASTAR (Walter, 19/10/2026): slides 2..N reordenam pela alça; a capa
     fica fixa. Subir/descer continuam no celular como alternativa de toque. */
  const aoSoltar = (r: DropResult) => {
    if (!r.destination || r.destination.index === r.source.index) return;
    const nova = [...lista];
    const [item] = nova.splice(r.source.index, 1);
    nova.splice(r.destination.index, 0, item);
    gravar(nova);
  };

  const qtd = (capa.trim() ? 1 : 0) + lista.filter((s) => s.trim()).length;

  const linha = (i: number, alca?: DraggableProvidedDragHandleProps | null, arrastando = false) => {
    const ehCapa = i === 0;
    const ultimo = i === total - 1;
    return (
      <div className={cn("group grid grid-cols-[44px_1fr] border-b border-border/60 bg-background",
        arrastando && "shadow-lg ring-1 ring-primary/30 rounded-lg")}>
        <div className={cn(
          "flex flex-col items-center justify-start pt-2.5 border-r border-border/60 select-none",
          ehCapa ? "bg-primary/10 text-primary" : "bg-muted/30 text-muted-foreground",
        )}>
          <span className="font-display font-bold text-[13px] leading-none">{i + 1}</span>
          {ehCapa && <span className="text-[9px] font-body font-bold uppercase tracking-wide mt-1">capa</span>}
          {!ehCapa && alca && (
            <span {...alca} aria-label={`Arrastar o slide ${i + 1}`} title="Arrastar pra reordenar"
              className="mt-1.5 p-1 rounded cursor-grab active:cursor-grabbing text-muted-foreground/70 hover:text-foreground touch-none">
              <GripVertical className="h-3.5 w-3.5" />
            </span>
          )}
        </div>
        <div className="relative flex items-start gap-1 min-w-0">
          <LinhaAuto
            refCb={(el) => { refs.current[i] = el; }}
            value={valorDe(i)}
            onChange={(v) => mudar(i, v)}
            onKeyDown={teclas(i)}
            placeholder={ehCapa ? "O que vai aparecer na capa para parar o scroll?"
              : ultimo && total > 2 ? "CTA do último slide"
              : ultimo ? "Slide 2 (o último slide costuma ser o CTA)"
              : `Slide ${i + 1}`}
            ariaLabel={ehCapa ? "Capa (slide 1)" : `Slide ${i + 1}`}
          />
          {ehCapa ? (
            acaoCapa && <div className="shrink-0 pt-1 pr-1">{acaoCapa}</div>
          ) : (
            <div className="shrink-0 flex items-center gap-0.5 pt-1.5 pr-1.5 sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100 transition-opacity">
              <span className="contents sm:hidden">
                <BotaoIcone titulo="Subir" onClick={() => mover(i, -1)} disabled={i <= 1}><ArrowUp className="h-3.5 w-3.5" /></BotaoIcone>
                <BotaoIcone titulo="Descer" onClick={() => mover(i, 1)} disabled={i >= total - 1}><ArrowDown className="h-3.5 w-3.5" /></BotaoIcone>
              </span>
              <BotaoIcone titulo="Remover slide" onClick={() => remover(i, false)} perigo><X className="h-3.5 w-3.5" /></BotaoIcone>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className={cn("space-y-1.5", className)}>
      <div className="flex items-center gap-2">
        <Layers className="h-4 w-4" />
        <span className="font-body text-sm font-medium">Slides</span>
        <span className={cn("ml-auto text-xs font-body", qtd > LIMITE_SLIDES ? "text-amber-700 font-semibold" : "text-muted-foreground")}>
          {qtd} {qtd === 1 ? "slide" : "slides"}{qtd > LIMITE_SLIDES ? ` · o Instagram aceita até ${LIMITE_SLIDES}` : ""}
        </span>
      </div>

      <div className="rounded-xl border border-border bg-background overflow-hidden">
        {linha(0)}
        <DragDropContext onDragEnd={aoSoltar}>
          <Droppable droppableId="slides-carrossel">
            {(prov) => (
              <div ref={prov.innerRef} {...prov.droppableProps}>
                {lista.map((_, k) => (
                  <Draggable key={`slide-${k}`} draggableId={`slide-${k}`} index={k}>
                    {(d, snap) => (
                      <div ref={d.innerRef} {...d.draggableProps}>
                        {linha(k + 1, d.dragHandleProps, snap.isDragging)}
                      </div>
                    )}
                  </Draggable>
                ))}
                {prov.placeholder}
              </div>
            )}
          </Droppable>
        </DragDropContext>
        <div className="flex items-center gap-3 border-t border-dashed border-border px-3 py-2 bg-card">
          <button type="button" onClick={() => inserirDepois(total - 1)}
            className="inline-flex items-center gap-1 text-[12.5px] font-body font-bold text-primary hover:underline min-h-[32px]">
            <Plus className="h-3.5 w-3.5" /> slide
          </button>
          <span className="ml-auto text-[11px] font-body text-muted-foreground hidden sm:inline">
            Enter cria o próximo · Shift+Enter quebra a linha · arraste pela alça
          </span>
        </div>
      </div>
    </div>
  );
}

/** Garante uma linha de slide pra escrever quando não há nenhum. */
function comUmVazio(l: string[]): string[] {
  return l.length ? l : [""];
}

function LinhaAuto({ value, onChange, onKeyDown, placeholder, ariaLabel, refCb }: {
  value: string;
  onChange: (v: string) => void;
  onKeyDown: (e: KeyboardEvent<HTMLTextAreaElement>) => void;
  placeholder: string;
  ariaLabel: string;
  refCb: (el: HTMLTextAreaElement | null) => void;
}) {
  const ref = useRef<HTMLTextAreaElement | null>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "0px";
    el.style.height = `${el.scrollHeight}px`;
  }, [value]);
  return (
    <textarea
      ref={(el) => { ref.current = el; refCb(el); }}
      rows={1}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={onKeyDown}
      placeholder={placeholder}
      aria-label={ariaLabel}
      className="flex-1 min-w-0 resize-none overflow-hidden bg-transparent px-3 py-2.5 text-sm font-body leading-relaxed outline-none placeholder:text-muted-foreground/70 min-h-[42px]"
    />
  );
}

function BotaoIcone({ titulo, onClick, disabled, perigo, children }: {
  titulo: string; onClick: () => void; disabled?: boolean; perigo?: boolean; children: ReactNode;
}) {
  return (
    <button type="button" title={titulo} aria-label={titulo} onClick={onClick} disabled={disabled}
      className={cn("h-7 w-7 grid place-items-center rounded-md text-muted-foreground transition-colors disabled:opacity-30",
        perigo ? "hover:text-destructive hover:bg-destructive/10" : "hover:text-foreground hover:bg-muted")}>
      {children}
    </button>
  );
}
