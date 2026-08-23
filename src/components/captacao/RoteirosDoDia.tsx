import { DragDropContext, Droppable, Draggable, type DropResult } from "@hello-pangea/dnd";
import { GripVertical, Plus, Trash2, Play, Copy, Pencil, FileText, Link2, Check, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { confirmar } from "@/components/shared/Confirm";
import { cenasDe, type CaptureScript } from "@/hooks/useCaptureScripts";

/* ═══════════════════════════════════════════════════════════════════════════
   OS ROTEIROS DE UM DIA DE GRAVAÇÃO

   O modelo antigo tinha UM campo de roteiro por captação. Quem grava cinco
   vídeos numa tarde não tinha onde colocar os outros quatro, e o texto escrito
   ali não podia ser reordenado, marcado como gravado nem excluído.

   Aqui o dia tem uma LISTA: cada vídeo é um card com número, título, cenas,
   referência e as ações que importam na hora da gravação (teleprompter,
   copiar, editar, marcar gravado, excluir). O "+" adiciona mais um, e arrastar
   define a ordem em que vão ser gravados.
   ═══════════════════════════════════════════════════════════════════════════ */

export function RoteirosDoDia({
  roteiros, onAdicionar, onEditar, onExcluir, onToggleGravado, onReordenar, onTeleprompter, salvando,
}: {
  roteiros: CaptureScript[];
  onAdicionar: () => void;
  onEditar: (s: CaptureScript) => void;
  onExcluir: (s: CaptureScript) => void;
  onToggleGravado: (s: CaptureScript) => void;
  onReordenar: (ids: string[]) => void;
  onTeleprompter: (s: CaptureScript) => void;
  salvando?: boolean;
}) {
  const arrastou = (r: DropResult) => {
    if (!r.destination || r.destination.index === r.source.index) return;
    const ids = roteiros.map((s) => s.id);
    const [m] = ids.splice(r.source.index, 1);
    ids.splice(r.destination.index, 0, m);
    onReordenar(ids);
  };

  const gravados = roteiros.filter((s) => s.done).length;

  return (
    <div data-tour="cap-roteiro" className="mt-3 rounded-xl border border-border bg-muted/20 p-3">
      <div className="flex items-center gap-2 flex-wrap">
        <FileText className="h-3.5 w-3.5 text-primary shrink-0" />
        <span className="text-xs font-body font-semibold text-foreground">
          Roteiros desta gravação {roteiros.length > 0 && <span className="text-muted-foreground">({gravados}/{roteiros.length} gravados)</span>}
        </span>
        <Button size="sm" variant="outline" onClick={onAdicionar} disabled={salvando}
          className="ml-auto rounded-xl h-8" title="Adiciona mais um vídeo pra gravar neste dia">
          {salvando ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <><Plus className="h-3.5 w-3.5 mr-1" /> Adicionar roteiro</>}
        </Button>
      </div>

      {roteiros.length === 0 ? (
        <p className="mt-2 text-[11.5px] font-body text-muted-foreground">
          Nenhum roteiro neste dia ainda. Adicione um por vídeo que vai ser gravado: cada um com cenas, direção e referência.
        </p>
      ) : (
        <DragDropContext onDragEnd={arrastou}>
          <Droppable droppableId="roteiros-do-dia">
            {(drop) => (
              <div ref={drop.innerRef} {...drop.droppableProps} className="mt-2.5 space-y-2">
                {roteiros.map((s, i) => {
                  const cenas = cenasDe(s);
                  const previa = (cenas[0]?.fala || s.content || "").replace(/\s+/g, " ").trim();
                  return (
                    <Draggable key={s.id} draggableId={s.id} index={i}>
                      {(drag, snap) => (
                        <div ref={drag.innerRef} {...drag.draggableProps}
                          className={cn("rounded-xl border border-border bg-card p-2.5", snap.isDragging && "shadow-lg ring-2 ring-primary/40")}>
                          <div className="flex items-start gap-2">
                            <span {...drag.dragHandleProps}
                              className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-lg text-muted-foreground/50 hover:text-foreground cursor-grab active:cursor-grabbing"
                              aria-label="Mudar a ordem de gravação">
                              <GripVertical className="h-4 w-4" />
                            </span>

                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-primary/10 text-[10px] font-display font-extrabold text-primary">{i + 1}</span>
                                <span className={cn("text-[13px] font-display font-bold truncate", s.done ? "text-muted-foreground line-through" : "text-foreground")}>
                                  {s.title?.trim() || `Vídeo ${i + 1}`}
                                </span>
                                {cenas.length > 0 && (
                                  <span className="shrink-0 text-[10px] font-body font-semibold px-1.5 py-0.5 rounded-md bg-muted text-muted-foreground">
                                    {cenas.length} {cenas.length === 1 ? "cena" : "cenas"}
                                  </span>
                                )}
                                {s.format && (
                                  <span className="shrink-0 text-[10px] font-body font-semibold px-1.5 py-0.5 rounded-md bg-muted text-muted-foreground capitalize">{s.format}</span>
                                )}
                                {s.reference_url && (
                                  <a href={s.reference_url} target="_blank" rel="noopener noreferrer"
                                    onClick={(e) => e.stopPropagation()}
                                    className="shrink-0 inline-flex items-center gap-1 text-[10px] font-body font-semibold px-1.5 py-0.5 rounded-md bg-primary/10 text-primary hover:underline">
                                    <Link2 className="h-2.5 w-2.5" /> referência
                                  </a>
                                )}
                              </div>
                              {previa && <p className="mt-1 text-[11.5px] font-body text-muted-foreground line-clamp-2 leading-relaxed">{previa}</p>}

                              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                                <Button size="sm" onClick={() => onTeleprompter(s)} className="rounded-lg h-8"
                                  title="Abre este roteiro no teleprompter">
                                  <Play className="h-3 w-3 mr-1" /> Teleprompter
                                </Button>
                                <Button size="sm" variant="outline" className="rounded-lg h-8"
                                  onClick={() => { void navigator.clipboard.writeText(s.content || ""); toast.success("Roteiro copiado."); }}>
                                  <Copy className="h-3 w-3 mr-1" /> Copiar
                                </Button>
                                <Button size="sm" variant="ghost" className="rounded-lg h-8" onClick={() => onEditar(s)}>
                                  <Pencil className="h-3 w-3 mr-1" /> Editar
                                </Button>
                              </div>
                            </div>

                            {/* Check de gravado + excluir: as duas ações que sumiram no
                                modelo antigo e obrigavam a caçar dentro de um modal. */}
                            <div className="flex flex-col items-center gap-1 shrink-0">
                              <button type="button" onClick={() => onToggleGravado(s)}
                                aria-label={s.done ? "Marcar como não gravado" : "Marcar como gravado"}
                                title={s.done ? "Gravado. Clique pra desmarcar." : "Marcar como gravado"}
                                className={cn("grid h-7 w-7 place-items-center rounded-lg border transition-colors",
                                  s.done ? "bg-emerald-500 border-emerald-500 text-white" : "border-border text-muted-foreground/60 hover:border-emerald-500 hover:text-emerald-600")}>
                                <Check className="h-3.5 w-3.5" strokeWidth={3} />
                              </button>
                              <button type="button" aria-label="Excluir roteiro" title="Excluir roteiro"
                                onClick={async () => {
                                  const ok = await confirmar({
                                    titulo: "Excluir este roteiro?",
                                    descricao: `"${s.title?.trim() || "Roteiro"}" sai deste dia de gravação. Não dá pra desfazer.`,
                                    acao: "Excluir",
                                  });
                                  if (ok) onExcluir(s);
                                }}
                                className="grid h-7 w-7 place-items-center rounded-lg text-muted-foreground/50 hover:text-destructive hover:bg-destructive/5 transition-colors">
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </div>
                        </div>
                      )}
                    </Draggable>
                  );
                })}
                {drop.placeholder}
              </div>
            )}
          </Droppable>
        </DragDropContext>
      )}
    </div>
  );
}
