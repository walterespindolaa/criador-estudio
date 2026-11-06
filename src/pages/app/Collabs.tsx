import { useMemo, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { DragDropContext, Droppable, Draggable, type DropResult } from "@hello-pangea/dnd";
import { Plus, Pencil, Trash2, Archive, ArchiveRestore, Handshake, FileText } from "lucide-react";
import { useDragScroll } from "@/hooks/useDragScroll";
// Ordem padrão (mais recentes) x ordem por prazo da collab. Só exibição.
import { OrdemDataToggle } from "@/components/shared/OrdemDataToggle";
import { useOrdemPorData } from "@/hooks/useOrdemPorData";
import { ordenarPorData } from "@/lib/ordenar-por-data";
import {
  useCollabs, COLLAB_STATUSES, COLLAB_STATUS_LABEL,
  type CollabStatus, type CollabWithDeliverables,
} from "@/hooks/useCollabs";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { CollabDialog } from "@/components/collabs/CollabDialog";
import { CollabPainel } from "@/components/collabs/CollabPainel";
import {
  MAO, STATUS_PILULA, COR_AVISO, brl, brlCurto, dataCurta, diasAte,
  linhaDaProposta, avisoDaPasta, Clipe, Carimbo, Quadradinhos,
} from "@/components/collabs/collabsVisual";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import { hojeBR } from "@/lib/date-br";

/* COLLABS (Walter, 06/11/2026, mockup aprovado "pasta de cliente").
   Os números viram uma fileira no topo, o bloco de Lembretes sai e cada aviso
   (atrasado, faltam N em X dias, esperando pagamento) vai escrito à mão na
   própria pasta. A pasta arrasta entre as colunas do funil (muda o status) e,
   tocada, abre o contrato ao lado em vez da janela de formulário. */

const MAO_DA_COLUNA: Record<CollabStatus, string> = {
  lead: "na mesa", negociando: "em jogo", fechado: "fechado", entregue: "a receber", pago: "este mês",
};

export default function Collabs() {
  const navigate = useNavigate();
  const { collabs, isLoading, updateCollab, deleteCollab } = useCollabs();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [abertaId, setAbertaId] = useState<string | null>(null);
  const [confirmDel, setConfirmDel] = useState<CollabWithDeliverables | null>(null);

  const active = collabs.filter((c) => !c.archived);
  const archived = collabs.filter((c) => c.archived);
  const aberta = abertaId ? collabs.find((c) => c.id === abertaId) ?? null : null;

  const nowMonth = hojeBR().slice(0, 7); // fuso BR
  const fechadoMes = active
    .filter((c) => ["fechado", "entregue", "pago"].includes(c.status) && c.updated_at.slice(0, 7) === nowMonth)
    .reduce((s, c) => s + (c.value ?? 0), 0);
  /* A receber = o que já foi fechado e ainda não caiu: fechado ou entregue.
     Lead e negociando ainda não são dinheiro (Walter, 06/11/2026). */
  const aReceber = active.filter((c) => c.status === "fechado" || c.status === "entregue").reduce((s, c) => s + (c.value ?? 0), 0);
  const entregasPend = active.reduce((s, c) => s + Math.max(0, c.total - c.done), 0);
  const mesNome = new Date(nowMonth + "-15T12:00:00").toLocaleDateString("pt-BR", { month: "short" }).replace(".", "");

  const openNew = () => { setEditingId(null); setDialogOpen(true); };
  const openEdit = (c: CollabWithDeliverables) => { setEditingId(c.id); setDialogOpen(true); };
  const arquivar = (c: CollabWithDeliverables) => updateCollab.mutate({ id: c.id, archived: !c.archived });

  return (
    <div>
      {/* Cabeçalho + números numa fileira */}
      <div className="flex flex-wrap items-end justify-between gap-4 mb-4">
        <div>
          <span className="inline-block rounded-full border-[1.5px] border-foreground bg-[#FF77B9] px-2.5 py-0.5 text-[10.5px] font-body font-bold text-[#141210]">Collabs</span>
          <h1 className="mt-1.5 font-display font-extrabold text-[26px] sm:text-[30px] leading-[1.05] tracking-tight text-foreground">Suas publis,</h1>
          <p className="text-[26px] sm:text-[30px] leading-none text-[#EB4918]" style={MAO}>do lead ao Pix.</p>
        </div>
        <div className="grid grid-cols-3 sm:flex gap-2 w-full sm:w-auto">
          <Kpi rotulo={`Fechado em ${mesNome}`} curto="No mês" valor={brlCurto(fechadoMes)} bg="#00A652" claro />
          <Kpi rotulo="A receber" valor={brlCurto(aReceber)} bg="#FFCF03" />
          <Kpi rotulo="Entregas" valor={String(entregasPend)} extra="pendentes" />
          <div className="hidden sm:block"><Kpi rotulo="Ativas" valor={String(active.length)} /></div>
        </div>
      </div>

      <Tabs defaultValue="pipeline" className="w-full">
        <div className="flex flex-wrap items-center gap-2 mb-4">
          <TabsList data-tour="collabs-abas" className="bg-transparent p-0 h-auto gap-1.5">
            {[["pipeline", "Funil"], ["lista", "Lista"], ["historico", "Histórico"]].map(([v, l]) => (
              <TabsTrigger key={v} value={v}
                className="rounded-full border-[1.5px] border-border bg-card px-3.5 py-1 text-[12.5px] font-body font-bold data-[state=active]:bg-foreground data-[state=active]:text-background data-[state=active]:border-foreground data-[state=active]:shadow-none">
                {l}
              </TabsTrigger>
            ))}
          </TabsList>
          <div className="ml-auto flex items-center gap-2">
            <button type="button" onClick={() => navigate("/app/media-kit")}
              className="inline-flex items-center gap-1.5 rounded-full border-2 border-foreground bg-[#0061EE] px-3.5 py-1.5 text-[12.5px] font-body font-bold text-white shadow-[2px_3px_0_hsl(var(--foreground))]">
              <FileText className="h-3.5 w-3.5" /> Mídia Kit<span className="hidden sm:inline"> · link e PDF</span>
            </button>
            <button type="button" onClick={openNew}
              className="inline-flex items-center gap-1.5 rounded-full border-2 border-foreground bg-[#EB4918] px-3.5 py-1.5 text-[12.5px] font-body font-bold text-white shadow-[2px_3px_0_hsl(var(--foreground))]">
              <Plus className="h-3.5 w-3.5" /> <span className="sm:hidden">Nova</span><span className="hidden sm:inline">Nova collab</span>
            </button>
          </div>
        </div>

        <TabsContent value="pipeline">
          <Funil active={active} isLoading={isLoading} onOpen={(c) => setAbertaId(c.id)} onNew={openNew}
            onMover={(id, status) => updateCollab.mutate({ id, status })} />
        </TabsContent>
        <TabsContent value="lista">
          <ListView rows={active} isLoading={isLoading} onOpen={(c) => setAbertaId(c.id)} onEdit={openEdit}
            onArchive={arquivar} onDelete={setConfirmDel} />
        </TabsContent>
        <TabsContent value="historico">
          <ListView rows={archived} isLoading={isLoading} onOpen={(c) => setAbertaId(c.id)} onEdit={openEdit} historico
            onArchive={arquivar} onDelete={setConfirmDel} />
        </TabsContent>
      </Tabs>

      <CollabPainel collab={aberta} onClose={() => setAbertaId(null)} onEditar={openEdit} onArquivar={arquivar} />
      <CollabDialog open={dialogOpen} onOpenChange={setDialogOpen} collabId={editingId} />

      <AlertDialog open={!!confirmDel} onOpenChange={(o) => !o && setConfirmDel(null)}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir collab?</AlertDialogTitle>
            <AlertDialogDescription>
              {confirmDel ? `"${confirmDel.brand}" e seus entregáveis serão removidos. Essa ação não pode ser desfeita.` : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl">Cancelar</AlertDialogCancel>
            <AlertDialogAction className="rounded-xl bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => { if (confirmDel) deleteCollab.mutate(confirmDel.id); setConfirmDel(null); }}>Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function Kpi({ rotulo, curto, valor, extra, bg, claro }: { rotulo: string; curto?: string; valor: string; extra?: string; bg?: string; claro?: boolean }) {
  return (
    <div className={cn("min-w-0 rounded-2xl border-2 border-foreground px-3 py-2 shadow-[2px_3px_0_hsl(var(--foreground))]", !bg && "bg-card")}
      style={bg ? { background: bg } : undefined}>
      <p className={cn("truncate text-[9.5px] font-body font-bold uppercase tracking-wider", claro ? "text-white/90" : bg ? "text-[#141210]/70" : "text-muted-foreground")}>
        {curto ? <><span className="sm:hidden">{curto}</span><span className="hidden sm:inline">{rotulo}</span></> : rotulo}
      </p>
      <p className={cn("font-display font-extrabold text-[17px] sm:text-[21px] leading-tight tabular-nums truncate",
        claro ? "text-white" : bg ? "text-[#141210]" : "text-foreground")}>
        {valor}{extra && <span className="ml-1 text-[11px] font-body font-semibold text-muted-foreground">{extra}</span>}
      </p>
    </div>
  );
}

function Funil({ active, isLoading, onOpen, onNew, onMover }: {
  active: CollabWithDeliverables[]; isLoading: boolean;
  onOpen: (c: CollabWithDeliverables) => void; onNew: () => void;
  onMover: (id: string, status: CollabStatus) => void;
}) {
  const boardRef = useDragScroll<HTMLDivElement>();
  const [porData, setPorData, ordemDir, alternarOrdem] = useOrdemPorData("collabs_ordem_data_v1");
  const colunas = useMemo(() => COLLAB_STATUSES.map((s) => {
    const lista = active.filter((c) => c.status === s);
    const itens = porData ? ordenarPorData(lista, (c) => c.deadline, undefined, ordemDir) : lista;
    const soma = (s === "pago" ? lista.filter((c) => c.updated_at.slice(0, 7) === hojeBR().slice(0, 7)) : lista)
      .reduce((t, c) => t + (c.value ?? 0), 0);
    return { s, itens, soma };
  }), [active, porData, ordemDir]);

  if (isLoading) return <div className="text-sm text-muted-foreground py-8 text-center">Carregando…</div>;
  if (active.length === 0) return <EmptyState onNew={onNew} />;

  const soltar = (r: DropResult) => {
    if (!r.destination || r.destination.droppableId === r.source.droppableId) return;
    onMover(r.draggableId, r.destination.droppableId as CollabStatus);
  };

  return (
    <>
      {active.length > 1 && (
        <div className="flex flex-wrap items-center gap-1.5 mb-3">
          <OrdemDataToggle valor={porData} direcao={ordemDir} onChange={setPorData} onToggle={alternarOrdem} rotuloPadrao="Mais recentes" />
          {porData && <span className="text-[11px] font-body text-muted-foreground">Collab sem prazo fica no fim.</span>}
        </div>
      )}
      <DragDropContext onDragEnd={soltar}>
        {/* Clicar no vazio e arrastar pro lado rola o funil (só mouse). No celular as colunas deslizam. */}
        <div ref={boardRef} className="flex gap-3 overflow-x-auto pb-3 -mx-4 px-4 md:mx-0 md:px-0 snap-x snap-mandatory md:snap-none [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {colunas.map(({ s, itens, soma }) => (
            <Droppable droppableId={s} key={s}>
              {(prov, snap) => (
                <section ref={prov.innerRef} {...prov.droppableProps}
                  className={cn("w-[82%] sm:w-[260px] md:w-auto md:min-w-[200px] md:flex-1 shrink-0 md:shrink snap-start rounded-2xl border border-dashed border-[#D8CFB6] dark:border-border bg-[#FBF8F1] dark:bg-muted/30 p-2.5 transition-colors",
                    snap.isDraggingOver && "bg-[#F3ECDC] dark:bg-muted/60")}>
                  <div className="flex items-center gap-2 px-0.5">
                    <span className="rounded-md border-[1.5px] border-foreground px-2 py-0.5 text-[11.5px] font-body font-bold text-[#141210]" style={{ background: STATUS_PILULA[s] }}>
                      {COLLAB_STATUS_LABEL[s]}
                    </span>
                    <span className="ml-auto grid h-5 min-w-5 place-items-center rounded-full border-[1.5px] border-foreground bg-card px-1.5 text-[10.5px] font-body font-bold">{itens.length}</span>
                  </div>
                  <p className="mt-1 px-0.5 text-[17px] leading-tight text-muted-foreground" style={MAO}>
                    {soma > 0 ? `${brlCurto(soma)} ${MAO_DA_COLUNA[s]}` : " "}
                  </p>
                  <div className="mt-2 flex flex-col gap-3 min-h-[40px]">
                    {itens.map((c, i) => (
                      <Draggable draggableId={c.id} index={i} key={c.id}>
                        {(dp, ds) => (
                          <div ref={dp.innerRef} {...dp.draggableProps} {...dp.dragHandleProps}>
                            <Pasta c={c} onOpen={() => onOpen(c)} arrastando={ds.isDragging} />
                          </div>
                        )}
                      </Draggable>
                    ))}
                    {prov.placeholder}
                    {s === "lead" && (
                      <button type="button" onClick={onNew} className="rounded-xl border-[1.5px] border-dashed border-[#C9BEA2] py-2 text-[12px] font-body font-semibold text-muted-foreground hover:text-foreground">
                        + Collab
                      </button>
                    )}
                  </div>
                </section>
              )}
            </Droppable>
          ))}
        </div>
      </DragDropContext>
      <p className="mt-1 text-right text-[15px] text-muted-foreground hidden md:block" style={MAO}>arraste a pasta de uma coluna pra outra</p>
      <p className="mt-1 text-center text-[15px] text-muted-foreground md:hidden" style={MAO}>as colunas arrastam pro lado</p>
    </>
  );
}

/* A pasta: aba em cima, clipe no canto, borda preta com sombra sólida. */
function Pasta({ c, onOpen, arrastando }: { c: CollabWithDeliverables; onOpen: () => void; arrastando: boolean }) {
  const aviso = avisoDaPasta(c);
  const atrasada = aviso?.tom === "atraso";
  return (
    <button type="button" onClick={onOpen}
      className={cn("group relative block w-full pt-3 text-left", arrastando && "rotate-2")}>
      {/* aba da pasta */}
      <span aria-hidden className={cn("absolute left-3 top-0 h-4 w-16 rounded-t-lg border-2 border-b-0 border-foreground",
        atrasada ? "bg-[#FFE0D6]" : "bg-card")} />
      <span className={cn("relative block rounded-xl rounded-tl-none border-2 border-foreground bg-card px-3 pb-3 pt-2.5 transition-transform group-hover:-translate-y-0.5",
        atrasada ? "shadow-[3px_4px_0_#EB4918] outline outline-2 outline-offset-2 outline-[#EB4918]/60" : "shadow-[3px_4px_0_hsl(var(--foreground))]")}>
        <Clipe className="right-3 -top-3" />
        <span className="block pr-5 text-[9.5px] font-body font-bold uppercase tracking-wider text-muted-foreground truncate">{linhaDaProposta(c)}</span>
        <span className="mt-0.5 block font-display font-extrabold text-[15.5px] leading-tight text-foreground break-words">{c.brand}</span>
        <span className="mt-0.5 block text-[12.5px] font-body font-bold tabular-nums text-foreground">{c.value != null ? brl(c.value).replace(",00", "") : "cachê a definir"}</span>
        {(c.total > 0 || c.deadline) && (
          <span className="mt-2 flex flex-wrap items-center gap-2">
            <Quadradinhos c={c} />
            {c.deadline && c.status !== "pago" && (
              <span className={cn("rounded-full border-[1.5px] border-foreground px-1.5 text-[10.5px] font-body font-bold tabular-nums",
                diasAte(c.deadline) < 0 && c.done < c.total ? "bg-[#FFE0D6]" : "bg-card")}>{dataCurta(c.deadline)}</span>
            )}
          </span>
        )}
        {aviso && aviso.tom !== "pago" && (
          <span className={cn("mt-2 inline-block -rotate-1 rounded-md border-[1.5px] border-foreground px-2 py-0.5 text-[16px] leading-tight", COR_AVISO[aviso.tom])} style={MAO}>
            {aviso.texto}
          </span>
        )}
        {aviso?.tom === "pago" && <span className="mt-2 block"><Carimbo cor="#00A652">{aviso.texto}</Carimbo></span>}
      </span>
    </button>
  );
}

function ListView({ rows, isLoading, onOpen, onEdit, onArchive, onDelete, historico }: {
  rows: CollabWithDeliverables[]; isLoading: boolean;
  onOpen: (c: CollabWithDeliverables) => void; onEdit: (c: CollabWithDeliverables) => void;
  onArchive: (c: CollabWithDeliverables) => void;
  onDelete: (c: CollabWithDeliverables) => void; historico?: boolean;
}) {
  if (isLoading) return <div className="text-sm text-muted-foreground py-8 text-center">Carregando…</div>;
  if (rows.length === 0)
    return <div className="text-sm text-muted-foreground py-10 text-center bg-card border-2 border-dashed border-border rounded-2xl">{historico ? "Nenhuma collab arquivada ainda." : "Nenhuma collab por aqui ainda."}</div>;
  return (
    <div className="space-y-2.5">
      {rows.map((c) => {
        const aviso = avisoDaPasta(c);
        return (
          <div key={c.id} className="bg-card border-2 border-foreground rounded-2xl p-3 flex items-center gap-3 shadow-[2px_3px_0_hsl(var(--foreground))]">
            <button type="button" onClick={() => onOpen(c)} className="min-w-0 flex-1 text-left">
              <span className="flex items-center gap-2">
                <span className="text-[14.5px] font-display font-extrabold truncate">{c.brand}</span>
                <span className="shrink-0 rounded-md border border-foreground px-1.5 text-[10.5px] font-body font-bold text-[#141210]" style={{ background: STATUS_PILULA[c.status] }}>{COLLAB_STATUS_LABEL[c.status]}</span>
              </span>
              <span className="block text-xs text-muted-foreground mt-0.5 font-body">
                {brl(c.value)} · {c.total > 0 ? `${c.done}/${c.total} entregas` : "sem entregáveis"}{c.deadline ? ` · prazo ${dataCurta(c.deadline)}` : ""}
                {aviso && aviso.tom !== "pago" ? <span className="text-[#D93A12] font-semibold"> · {aviso.texto}</span> : null}
              </span>
            </button>
            <IconBt onClick={() => onEdit(c)} titulo="Editar"><Pencil className="h-4 w-4" /></IconBt>
            <IconBt onClick={() => onArchive(c)} titulo={historico ? "Restaurar" : "Arquivar"}>{historico ? <ArchiveRestore className="h-4 w-4" /> : <Archive className="h-4 w-4" />}</IconBt>
            <IconBt onClick={() => onDelete(c)} titulo="Excluir" perigo><Trash2 className="h-4 w-4" /></IconBt>
          </div>
        );
      })}
    </div>
  );
}

function IconBt({ onClick, titulo, perigo, children }: { onClick: () => void; titulo: string; perigo?: boolean; children: ReactNode }) {
  return (
    <button type="button" onClick={onClick} title={titulo} aria-label={titulo}
      className={cn("text-muted-foreground p-1.5 flex-shrink-0", perigo ? "hover:text-red-600" : "hover:text-foreground")}>{children}</button>
  );
}

function EmptyState({ onNew }: { onNew: () => void }) {
  return (
    <div className="bg-card border-2 border-foreground rounded-2xl py-12 px-6 text-center shadow-[3px_4px_0_hsl(var(--foreground))]">
      <div className="h-12 w-12 rounded-2xl bg-[#FF77B9] border-2 border-foreground text-[#141210] grid place-items-center mx-auto mb-3"><Handshake className="h-6 w-6" /></div>
      <div className="font-display font-extrabold text-foreground text-lg">Nenhuma collab ainda</div>
      <p className="text-sm text-muted-foreground mt-1 mb-4 max-w-sm mx-auto font-body">Cadastre sua primeira parceria com uma marca e acompanhe cachê, entregáveis e prazos num só lugar.</p>
      <Button onClick={onNew} className="rounded-full gap-2"><Plus className="h-4 w-4" />Nova collab</Button>
    </div>
  );
}
