import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import type { ReactNode } from "react";
import { DragDropContext, Droppable, Draggable, type DropResult } from "@hello-pangea/dnd";
import { GripVertical, Plus, Trash2, Loader2, Film, Video, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CampoReferencias } from "@/components/captacao/Referencias";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { cenasParaTexto, type CaptureScene, type CaptureScript } from "@/hooks/useCaptureScripts";

/* ═══════════════════════════════════════════════════════════════════════════
   O ROTEIRO DE GRAVAÇÃO

   O campo único de texto não servia: na hora de gravar, a social mídia e o
   cliente precisam saber, CENA A CENA, o que se fala e o que se FAZ (a direção
   de câmera). Era exatamente o que faltava no guia que a Gabriela monta hoje
   fora do Cria: as falas estavam lá, a direção não.

   Cada roteiro é um documento:
     · o QUE é (título, sobre o vídeo, formato)
     · QUANDO/ONDE grava (data e local)
     · a REFERÊNCIA (link do reel que serve de exemplo)
     · as CENAS, numeradas e arrastáveis, cada uma com FALA + DIREÇÃO.

   O texto corrido continua sendo gerado a partir das cenas: teleprompter,
   copiar e "virar post" seguem funcionando sem saber que cenas existem.
   ═══════════════════════════════════════════════════════════════════════════ */

export type RoteiroFormValor = {
  title: string;
  about: string;
  reference_url: string;
  record_date: string;
  location: string;
  format: string;
  scenes: CaptureScene[];
  /** Texto corrido: usado quando o roteiro é antigo (sem cenas). */
  content: string;
};


const cenaVazia = (): CaptureScene => ({ fala: "", direcao: "" });

/** Quebra um roteiro em texto corrido em cenas, respeitando "Cena N:". */
/* O @hello-pangea/dnd posiciona o item arrastado em coordenadas da JANELA.
   Dentro de um Dialog (que tem transform e overflow próprios) a conta sai
   errada e a cena "escapa" do card enquanto é arrastada. Jogar só o item
   arrastado num portal no body devolve o referencial certo. */
function NoCorpoQuandoArrasta({ arrastando, children }: { arrastando: boolean; children: ReactNode }) {
  if (!arrastando) return <>{children}</>;
  return createPortal(<>{children}</>, document.body);
}

export function textoParaCenas(texto: string): CaptureScene[] {
  const t = (texto ?? "").trim();
  if (!t) return [cenaVazia()];
  const partes = t.split(/\n(?=\s*cena\s*\d+\s*[:.-])/i);
  const cenas = partes
    .map((p) => p.replace(/^\s*cena\s*\d+\s*[:.-]\s*/i, "").trim())
    .filter(Boolean)
    .map((fala) => {
      // Direção entre colchetes ou parênteses no fim vira o campo Direção.
      const m = fala.match(/^([\s\S]*?)[\s]*[[(]([^\]()]{3,})[\])]\s*$/);
      if (m) return { fala: m[1].trim(), direcao: m[2].trim() };
      return { fala, direcao: "" };
    });
  return cenas.length ? cenas : [cenaVazia()];
}

export function RoteiroEditor({ open, onOpenChange, inicial, salvando, onSalvar, sugerirIA }: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  /** Roteiro em edição (null = novo). */
  inicial: CaptureScript | null;
  salvando: boolean;
  onSalvar: (v: RoteiroFormValor) => Promise<unknown> | void;
  /** Opcional: gera cenas com IA a partir do título/sobre. */
  sugerirIA?: (ctx: { title: string; about: string }) => Promise<CaptureScene[] | null>;
}) {
  const [v, setV] = useState<RoteiroFormValor>({
    title: "", about: "", reference_url: "", record_date: "", location: "", format: "reels", // roteiro de captação é sempre vídeo
    scenes: [cenaVazia()], content: "",
  });
  const [seed, setSeed] = useState("");
  const [gerando, setGerando] = useState(false);

  // Semeia o formulário ao abrir (ou ao trocar de roteiro).
  const chave = open ? (inicial?.id ?? "novo") : "";
  useEffect(() => {
    if (!open || chave === seed) return;
    setSeed(chave);
    const cenasDoBanco = Array.isArray(inicial?.scenes) ? (inicial!.scenes as CaptureScene[]) : [];
    setV({
      title: inicial?.title ?? "",
      about: inicial?.about ?? "",
      reference_url: inicial?.reference_url ?? "",
      record_date: inicial?.record_date ?? "",
      location: inicial?.location ?? "",
      format: inicial?.format ?? "reels",
      // Roteiro ANTIGO (só texto): quebramos em cenas pra ela já editar no
      // formato novo, sem perder nada do que estava escrito.
      scenes: cenasDoBanco.length ? cenasDoBanco : textoParaCenas(inicial?.content ?? ""),
      content: inicial?.content ?? "",
    });
  }, [open, chave, seed, inicial]);
  useEffect(() => { if (!open && seed) setSeed(""); }, [open, seed]);

  const setCena = (i: number, patch: Partial<CaptureScene>) =>
    setV((p) => ({ ...p, scenes: p.scenes.map((c, idx) => (idx === i ? { ...c, ...patch } : c)) }));
  const addCena = () => setV((p) => ({ ...p, scenes: [...p.scenes, cenaVazia()] }));
  const delCena = (i: number) =>
    setV((p) => ({ ...p, scenes: p.scenes.length > 1 ? p.scenes.filter((_, idx) => idx !== i) : [cenaVazia()] }));

  const moverCena = (r: DropResult) => {
    if (!r.destination || r.destination.index === r.source.index) return;
    setV((p) => {
      const arr = [...p.scenes];
      const [m] = arr.splice(r.source.index, 1);
      arr.splice(r.destination!.index, 0, m);
      return { ...p, scenes: arr };
    });
  };

  const gerarComIA = async () => {
    if (!sugerirIA) return;
    setGerando(true);
    try {
      const cenas = await sugerirIA({ title: v.title, about: v.about });
      if (cenas && cenas.length) setV((p) => ({ ...p, scenes: cenas }));
    } finally { setGerando(false); }
  };

  const temConteudo = v.title.trim() || v.scenes.some((c) => c.fala.trim() || c.direcao.trim());

  const salvar = async () => {
    const scenes = v.scenes.filter((c) => c.fala.trim() || c.direcao.trim());
    await onSalvar({ ...v, scenes, content: cenasParaTexto(scenes) });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display">{inicial ? "Editar roteiro" : "Novo roteiro"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* ── O QUE É ── */}
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Rotulo>Título do vídeo</Rotulo>
              <Input value={v.title} onChange={(e) => setV((p) => ({ ...p, title: e.target.value }))}
                placeholder="Ex.: Caso da paciente Maria (bio, estimulador, toxina)" className="h-10" />
            </div>
            <div className="sm:col-span-2">
              <Rotulo>Sobre o vídeo</Rotulo>
              <Textarea rows={2} value={v.about} onChange={(e) => setV((p) => ({ ...p, about: e.target.value }))}
                placeholder="A ideia em 2 linhas: o que esse vídeo mostra e por que ele existe." className="rounded-xl text-sm" />
            </div>
            <div className="sm:col-span-2">
              {/* Quase nunca é UMA referência só: uma pro corte, outra pra luz.
                  O campo aceita vários links e mostra a capa de cada um. */}
              <Rotulo>Referências (reel, tiktok, youtube)</Rotulo>
              <CampoReferencias valor={v.reference_url} onChange={(x) => setV((p) => ({ ...p, reference_url: x }))} />
            </div>
            <div>
              <Rotulo>Data da gravação</Rotulo>
              <Input type="date" value={v.record_date} onChange={(e) => setV((p) => ({ ...p, record_date: e.target.value }))} className="h-10" />
            </div>
            <div>
              <Rotulo>Local</Rotulo>
              <Input value={v.location} onChange={(e) => setV((p) => ({ ...p, location: e.target.value }))}
                placeholder="Ex.: consultório, estúdio" className="h-10" />
            </div>
          </div>

          {/* ── AS CENAS ── */}
          <div>
            <div className="flex items-center justify-between gap-2 flex-wrap mb-1.5">
              <div>
                <p className="text-sm font-display font-bold text-foreground flex items-center gap-1.5">
                  <Film className="h-4 w-4 text-primary" /> Cenas
                </p>
                <p className="text-[11.5px] font-body text-muted-foreground">
                  O que se FALA e o que se FAZ em cada cena. Arraste pra trocar a ordem.
                </p>
              </div>
              {sugerirIA && (
                <Button type="button" size="sm" variant="outline" className="rounded-xl h-9"
                  disabled={gerando || !(v.title.trim() || v.about.trim())} onClick={() => void gerarComIA()}>
                  {gerando ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5 mr-1.5" />}
                  Sugerir cenas com IA
                </Button>
              )}
            </div>

            <DragDropContext onDragEnd={moverCena}>
              <Droppable droppableId="cenas">
                {(drop) => (
                  <div ref={drop.innerRef} {...drop.droppableProps} className="space-y-2">
                    {v.scenes.map((c, i) => (
                      <Draggable key={`cena-${i}`} draggableId={`cena-${i}`} index={i}>
                        {(drag, snap) => (
                          <NoCorpoQuandoArrasta arrastando={snap.isDragging}>
                          <div ref={drag.innerRef} {...drag.draggableProps}
                            className={cn("rounded-2xl border border-border bg-card p-3", snap.isDragging && "shadow-lg ring-2 ring-primary/40")}>
                            <div className="flex items-center gap-2 mb-2">
                              <span {...drag.dragHandleProps} className="grid h-7 w-7 place-items-center rounded-lg text-muted-foreground/60 hover:text-foreground cursor-grab active:cursor-grabbing" aria-label="Mover cena">
                                <GripVertical className="h-4 w-4" />
                              </span>
                              <span className="text-[12px] font-display font-extrabold text-primary">Cena {i + 1}</span>
                              <button type="button" onClick={() => delCena(i)}
                                className="ml-auto grid h-7 w-7 place-items-center rounded-lg text-muted-foreground/50 hover:text-destructive transition-colors" aria-label="Remover cena">
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                            <Textarea rows={3} value={c.fala} onChange={(e) => setCena(i, { fala: e.target.value })}
                              placeholder="O que é falado nesta cena." className="rounded-xl text-sm" />
                            <div className="mt-2 flex items-start gap-2 rounded-xl bg-muted/40 px-2.5 py-2">
                              <Video className="h-3.5 w-3.5 shrink-0 mt-1.5 text-muted-foreground" />
                              <Textarea rows={1} value={c.direcao} onChange={(e) => setCena(i, { direcao: e.target.value })}
                                placeholder="Direção: o que fazer/filmar aqui (ex.: close no rosto, mostrar o antes e depois)"
                                className="rounded-lg text-[12.5px] bg-transparent border-none focus-visible:ring-0 min-h-0 py-1" />
                            </div>
                          </div>
                          </NoCorpoQuandoArrasta>
                        )}
                      </Draggable>
                    ))}
                    {drop.placeholder}
                  </div>
                )}
              </Droppable>
            </DragDropContext>

            {/* Antes era outline sobre fundo creme: sumia. A cena é a ação
                principal desta tela, então ela precisa se ver de longe. */}
            <button type="button" onClick={addCena}
              className="mt-2 w-full inline-flex items-center justify-center gap-1.5 rounded-xl border-2 border-dashed border-primary/50 bg-primary/[0.06] px-4 h-11 text-[13px] font-body font-bold text-primary hover:bg-primary/[0.12] hover:border-primary transition-colors">
              <Plus className="h-4 w-4" /> Adicionar cena
            </button>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={() => void salvar()} disabled={salvando || !temConteudo}>
            {salvando ? <Loader2 className="h-4 w-4 animate-spin" /> : "Salvar roteiro"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Rotulo({ children }: { children: React.ReactNode }) {
  return <p className="text-[11px] font-body font-semibold text-muted-foreground uppercase mb-1">{children}</p>;
}
