import { useEffect, useRef, useState } from "react";
import { Eraser, Minus, Plus, Trash2, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { txt, type DadosBloco } from "@/lib/bioBlocks";
import {
  ESCALA_MAX, ESCALA_MIN, FONTES_ASSINATURA, QUADRO_H, QUADRO_W, lerAssinatura, tracosParaD,
  type Assinatura, type Ponto,
} from "@/lib/bioEspecialista";
import { DesenhoAssinatura, SecaoApresentacao, carregarFonteAssinatura, temaDe } from "@/components/bio/SiteEspecialista";
import { cn } from "@/lib/utils";

/* ═══════════════════════════════════════════════════════════════════════════
   EDITOR DE ASSINATURA (Walter, 21/10/2026)

   "um campo onde abre e ela assina numa folha em branco e aí a assinatura vai
   pra ali e ela pode aumentar, deixar de lado, diminuir... e se clica ela pode
   apagar e deixar sem nada."

   À esquerda a capa como vai sair, com a assinatura que se arrasta, aumenta,
   diminui e apaga. À direita a folha em branco (ou as 5 letras cursivas).
   Nada vai pro banco até "Salvar": quem rabiscou errado só fecha a janela.
   ═══════════════════════════════════════════════════════════════════════════ */

export function EditorAssinatura({ aberto, aoFechar, dados, nomePadrao, aoSalvar }: {
  aberto: boolean;
  aoFechar: () => void;
  dados: DadosBloco;
  nomePadrao: string;
  aoSalvar: (assinatura: Assinatura, nome: string) => void;
}) {
  const [a, setA] = useState<Assinatura>(() => lerAssinatura(dados.assinatura));
  const [nome, setNome] = useState(txt(dados, "nome"));
  const [tracos, setTracos] = useState<Ponto[][]>([]);
  const [selecionada, setSelecionada] = useState(false);
  const [aba, setAba] = useState<"desenho" | "fonte">("fonte");

  // Reabriu: parte do que está salvo, não do rascunho anterior.
  useEffect(() => {
    if (!aberto) return;
    setA(lerAssinatura(dados.assinatura));
    setNome(txt(dados, "nome"));
    setTracos([]);
    setSelecionada(false);
    setAba(lerAssinatura(dados.assinatura).modo === "desenho" ? "desenho" : "fonte");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aberto]);

  // Mostra as 5 fontes nos botões já com a cara de cada uma.
  useEffect(() => { if (aberto) FONTES_ASSINATURA.forEach((f) => carregarFonteAssinatura(f.familia)); }, [aberto]);

  const tema = temaDe(txt(dados, "tema"));
  const nomeVisivel = nome.trim() || nomePadrao;
  const muda = (patch: Partial<Assinatura>) => setA((v) => ({ ...v, ...patch }));
  const tam = (delta: number) => muda({ escala: Math.min(ESCALA_MAX, Math.max(ESCALA_MIN, a.escala + delta)) });

  /* ── A FOLHA ── */
  const folhaRef = useRef<HTMLDivElement>(null);
  const desenhando = useRef(false);
  const ponto = (e: React.PointerEvent): Ponto => {
    const r = folhaRef.current!.getBoundingClientRect();
    return { x: ((e.clientX - r.left) * QUADRO_W) / r.width, y: ((e.clientY - r.top) * QUADRO_H) / r.height };
  };
  const dFolha = tracosParaD(tracos);
  const usarDesenho = () => {
    if (!dFolha) return;
    muda({ modo: "desenho", d: dFolha });
    setSelecionada(true);
  };

  /* ── ARRASTAR NA CAPA ── */
  const capaRef = useRef<HTMLDivElement>(null);
  const arrasto = useRef<{ sx: number; sy: number; x0: number; y0: number; w: number; h: number } | null>(null);
  const pegar = (e: React.PointerEvent) => {
    e.stopPropagation();
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
    const r = capaRef.current!.getBoundingClientRect();
    arrasto.current = { sx: e.clientX, sy: e.clientY, x0: a.x, y0: a.y, w: r.width, h: r.height };
    setSelecionada(true);
  };
  const arrastar = (e: React.PointerEvent) => {
    const g = arrasto.current;
    if (!g) return;
    muda({
      x: Math.min(90, Math.max(0, g.x0 + ((e.clientX - g.sx) / g.w) * 100)),
      y: Math.min(92, Math.max(0, g.y0 + ((e.clientY - g.sy) / g.h) * 100)),
    });
  };
  const largar = () => { arrasto.current = null; };

  const temAlgo = a.modo === "desenho" ? !!a.d : a.modo === "fonte" ? !!nomeVisivel : false;

  return (
    <Dialog open={aberto} onOpenChange={(v) => { if (!v) aoFechar(); }}>
      <DialogContent className="max-w-[860px] w-[calc(100vw-24px)] max-h-[92dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display">Assinatura da capa</DialogTitle>
          <DialogDescription>Assine com o dedo ou o mouse, ou escolha uma letra cursiva. Na capa, arraste pra mover.</DialogDescription>
        </DialogHeader>

        <div className="grid md:grid-cols-[300px_1fr] gap-6 items-start">
          {/* A capa de verdade, com a assinatura por cima pra arrastar. */}
          <div className="mx-auto w-[300px]">
            <div ref={capaRef} className="relative rounded-2xl overflow-hidden [container-type:inline-size] touch-none"
              onPointerDown={() => setSelecionada(false)}>
              <SecaoApresentacao d={dados} nomePadrao={nomePadrao} editavel />
              {a.modo !== "nenhuma" && temAlgo && (
                <div className="absolute inset-0 pointer-events-none [container-type:inline-size]">
                  <div role="button" tabIndex={0} aria-label="Assinatura. Arraste pra mover."
                    onPointerDown={pegar} onPointerMove={arrastar} onPointerUp={largar} onPointerCancel={largar}
                    onKeyDown={(e) => {
                      const passo = 2;
                      if (e.key === "ArrowLeft") muda({ x: Math.max(0, a.x - passo) });
                      else if (e.key === "ArrowRight") muda({ x: Math.min(90, a.x + passo) });
                      else if (e.key === "ArrowUp") muda({ y: Math.max(0, a.y - passo) });
                      else if (e.key === "ArrowDown") muda({ y: Math.min(92, a.y + passo) });
                      else if (e.key === "Delete" || e.key === "Backspace") muda({ modo: "nenhuma" });
                      else return;
                      e.preventDefault();
                    }}
                    className={cn("absolute pointer-events-auto cursor-grab active:cursor-grabbing rounded-md p-1",
                      selecionada ? "outline-2 outline-dashed outline-white/80" : "hover:outline-1 hover:outline-dashed hover:outline-white/40 focus-visible:outline-2 focus-visible:outline-dashed focus-visible:outline-white/80")}
                    style={{ left: `${a.x}%`, top: `${a.y}%`, width: a.modo === "desenho" ? `${a.escala}%` : undefined }}>
                    <DesenhoAssinatura a={a} nome={nomeVisivel} cor={tema.forte} />
                  </div>
                  {selecionada && (
                    <div className="absolute pointer-events-auto flex gap-1 rounded-xl bg-white p-1 shadow-lg"
                      style={{ left: `${Math.min(a.x, 55)}%`, top: `max(6px, calc(${a.y}% - 46px))` }}
                      onPointerDown={(e) => e.stopPropagation()}>
                      <Button type="button" size="icon" variant="ghost" className="h-8 w-8" aria-label="Diminuir" onClick={() => tam(-6)}><Minus className="h-4 w-4" /></Button>
                      <Button type="button" size="icon" variant="ghost" className="h-8 w-8" aria-label="Aumentar" onClick={() => tam(6)}><Plus className="h-4 w-4" /></Button>
                      <Button type="button" size="sm" className="h-8" onClick={() => { muda({ modo: "nenhuma" }); setSelecionada(false); }}>
                        <Trash2 className="h-3.5 w-3.5 mr-1" /> Apagar
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </div>
            <p className="text-[11px] font-body text-muted-foreground mt-2 leading-snug">
              Toque na assinatura pra aparecer aumentar, diminuir e apagar. No computador, as setas do teclado também movem.
            </p>
          </div>

          <div className="space-y-4 min-w-0">
            <div className="inline-flex rounded-xl bg-muted p-1 gap-1">
              {(["desenho", "fonte"] as const).map((m) => (
                <button key={m} type="button" onClick={() => setAba(m)}
                  className={cn("h-9 px-4 rounded-lg text-sm font-body font-semibold transition-colors",
                    aba === m ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground")}>
                  {m === "desenho" ? "Desenhar à mão" : "Letra cursiva"}
                </button>
              ))}
            </div>

            {aba === "desenho" ? (
              <div className="space-y-2.5">
                <div ref={folhaRef} className="relative w-full max-w-[480px] aspect-[440/200] rounded-2xl bg-white border border-border touch-none cursor-crosshair"
                  onPointerDown={(e) => {
                    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
                    desenhando.current = true;
                    setTracos((t) => [...t, [ponto(e)]]);
                  }}
                  onPointerMove={(e) => {
                    if (!desenhando.current) return;
                    const p = ponto(e);
                    setTracos((t) => {
                      const c = t.slice();
                      c[c.length - 1] = [...c[c.length - 1], p];
                      return c;
                    });
                  }}
                  onPointerUp={() => { desenhando.current = false; }}
                  onPointerCancel={() => { desenhando.current = false; }}>
                  <svg aria-hidden viewBox={`0 0 ${QUADRO_W} ${QUADRO_H}`} className="absolute inset-0 w-full h-full">
                    <line x1="30" y1="150" x2="410" y2="150" stroke="#E5E2DA" strokeWidth="1.5" />
                    <path d={dFolha} fill="none" stroke="#1F1F1C" strokeWidth={4} strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  {!tracos.length && <span className="absolute left-[7%] top-[78%] text-xs text-muted-foreground pointer-events-none">Assine aqui</span>}
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button type="button" variant="outline" size="sm" disabled={!tracos.length} onClick={() => setTracos((t) => t.slice(0, -1))}>
                    <Undo2 className="h-3.5 w-3.5 mr-1" /> Desfazer
                  </Button>
                  <Button type="button" variant="outline" size="sm" disabled={!tracos.length} onClick={() => setTracos([])}>
                    <Eraser className="h-3.5 w-3.5 mr-1" /> Limpar
                  </Button>
                  <Button type="button" size="sm" disabled={!dFolha} onClick={usarDesenho}>Usar na capa</Button>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="space-y-1.5 max-w-[480px]">
                  <Label htmlFor="ass-nome" className="text-xs font-body">Nome que aparece</Label>
                  <Input id="ass-nome" value={nome} placeholder={nomePadrao} onChange={(e) => setNome(e.target.value)} className="rounded-xl" />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-w-[480px]">
                  {FONTES_ASSINATURA.map((f) => (
                    <button key={f.id} type="button" onClick={() => muda({ modo: "fonte", fonte: f.id })}
                      className={cn("rounded-xl border px-3 py-2 text-left transition-colors min-h-[64px]",
                        a.modo === "fonte" && a.fonte === f.id ? "border-primary bg-primary/5" : "border-border hover:border-primary/40")}>
                      <span className="block truncate text-[26px] leading-tight text-foreground" style={{ fontFamily: `'${f.familia}', cursive` }}>{nomeVisivel || "Seu nome"}</span>
                      <span className="block text-[11px] font-body text-muted-foreground">{f.nome}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="space-y-2 max-w-[480px]">
              <Label className="text-xs font-body">Tamanho</Label>
              <Slider min={ESCALA_MIN} max={ESCALA_MAX} step={1} value={[a.escala]} onValueChange={([v]) => muda({ escala: v })} aria-label="Tamanho da assinatura" />
            </div>

            {a.modo === "nenhuma" && (
              <div className="flex items-center justify-between gap-3 rounded-xl border border-border bg-muted/40 px-3 py-2.5 max-w-[480px]">
                <span className="text-sm font-body text-muted-foreground">A capa está sem assinatura.</span>
                <Button type="button" size="sm" variant="outline" onClick={() => muda({ modo: a.d ? "desenho" : "fonte" })}>Recolocar</Button>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="ghost" onClick={aoFechar}>Cancelar</Button>
              <Button type="button" onClick={() => { aoSalvar(a, nome.trim()); aoFechar(); }}>Salvar assinatura</Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
