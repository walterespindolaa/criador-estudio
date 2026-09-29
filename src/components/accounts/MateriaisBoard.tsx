import { useEffect, useRef, useState, type CSSProperties } from "react";
import {
  DragDropContext, Droppable, Draggable,
  type DropResult, type DraggableProvidedDragHandleProps, type DraggableProvidedDraggableProps,
} from "@hello-pangea/dnd";
import {
  useClientMaterials, type ClientMaterial, type MaterialAttachment, type MaterialKind, type MaterialStatus,
} from "@/hooks/useClientMaterials";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { confirmar } from "@/components/shared/Confirm";
import { Plus, MoreVertical, Loader2, User, CalendarDays, Paperclip, Upload, Link2, X, FileText, ExternalLink, GripVertical, Pencil, Trash2, MessageCircle, Send } from "lucide-react";
import { useDragScroll } from "@/hooks/useDragScroll";
import { cn } from "@/lib/utils";
import { parseDateOnly } from "@/lib/date-br";
import { toast } from "sonner";
// Ordem padrão (mais recentes) x ordem por prazo. Só exibição.
import { OrdemDataToggle } from "@/components/shared/OrdemDataToggle";
import { useOrdemPorData } from "@/hooks/useOrdemPorData";
import { useExternalClients } from "@/hooks/useCriaPost";
import { ordenarPorData } from "@/lib/ordenar-por-data";
import { useSearchParams } from "react-router-dom";
import { MoneyInput } from "@/components/shared/MoneyInput";
import { brlReais } from "@/lib/money";
import { ROTULO_PAPEL, useMeusParceiros } from "@/hooks/useParceiro";
import { TIPO_MATERIAL, useDelegarMaterial } from "@/hooks/useMaterialParceiro";
import { MaterialAbertoDialog } from "@/components/parceiro/MaterialAbertoDialog";

/* Tipos que aparecem no seletor (Gabriela, 29/09/2026: "apresentação, cartão
   de visita, flyer e etc"). O tipo vai pro card do parceiro, que sabe na hora
   que tipo de peça é sem ler o briefing inteiro. */
const TIPOS_NO_SELETOR: MaterialKind[] = ["apresentacao", "cartao_visita", "flyer", "arte_avulsa", "logo", "outro"];

const ETAPA_PARCEIRO: Record<string, { txt: string; cls: string }> = {
  aguardando: { txt: "Novo", cls: "bg-orange-100 text-orange-700" },
  em_producao: { txt: "Fazendo", cls: "bg-blue-100 text-blue-700" },
  ajuste: { txt: "Em ajuste", cls: "bg-violet-100 text-violet-700" },
  entregue: { txt: "Entregue", cls: "bg-green-100 text-green-700" },
};

const COLUMNS: { key: MaterialStatus; label: string; dot: string }[] = [
  { key: "solicitado", label: "Solicitado", dot: "bg-amber-500" },
  { key: "a_fazer", label: "A fazer", dot: "bg-slate-400" },
  { key: "em_aprovacao", label: "Em aprovação", dot: "bg-blue-500" },
  { key: "ajuste", label: "Ajuste", dot: "bg-orange-500" },
  { key: "finalizado", label: "Finalizado", dot: "bg-green-500" },
];

function fmtDate(d: string | null): string | null {
  if (!d) return null;
  try {
    return parseDateOnly(d).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
  } catch { return null; }
}

type FormState = {
  title: string; description: string; due_date: string; attachments: MaterialAttachment[]; kind: MaterialKind;
  // "Enviar para": parceiro, prazo de produção e cachê (29/09/2026).
  parceiroId: string; prazo: string; cache: number | null;
};
const EMPTY: FormState = { title: "", description: "", due_date: "", attachments: [], kind: "arte_avulsa", parceiroId: "", prazo: "", cache: null };

// ARRASTE NO KANBAN DE MATERIAIS (mesmo padrão da Agenda, e pelos mesmos motivos):
//  1) disableInteractiveElementBlocking em cada <Draggable>: sem isso o dnd cancela o
//     arraste quando o toque começa em cima de qualquer coisa interativa dentro do card
//     (aqui tem link de anexo, lápis e o menu de 3 pontos).
//  2) A ALÇA é só o GRIP (⠿), nunca o card inteiro. Quando o card todo vira alça ele
//     ganha touch-action:none (regra global do index.css que casa
//     [data-rfd-drag-handle-draggable-id]) e a página para de rolar no celular em cima
//     dos cards. Com a alça no grip, o corpo do card rola nativo e o toque simples edita.
//  3) Alvo de toque do grip ampliado no mobile (p-2 -m-2 ≈ 40px) sem inflar o visual.
const dragCardStyle: CSSProperties = { WebkitUserSelect: "none", userSelect: "none", WebkitTouchCallout: "none" };

function DragGrip({ handleProps }: { handleProps?: DraggableProvidedDragHandleProps }) {
  return (
    <span {...(handleProps ?? {})} aria-label="Arrastar para outra coluna"
      onClick={(e) => e.stopPropagation()}
      className="shrink-0 grid place-items-center rounded text-muted-foreground/50 hover:text-muted-foreground cursor-grab active:cursor-grabbing touch-none p-2 -m-2 md:p-1 md:-m-1">
      <GripVertical className="h-4 w-4" />
    </span>
  );
}

export function MateriaisBoard({ clientId, clientName }: { clientId: string; clientName: string }) {
  /* O LINK SO DE PEDIDOS (Walter, 20/09/2026). O cliente ja podia pedir pelo
     link de aprovacao, mas ele vem com posts na frente. Este copia um link em
     que a unica coisa que existe e pedir e acompanhar. Mesmo token. Precisa
     que o cliente tenha portal (external_client) ligado a esta ficha.

     Subiu pra ANTES do useClientMaterials porque agora o quadro também procura
     os materiais pelo id do portal, não só pelo da ficha: ver o comentário em
     useClientMaterials. */
  const { clients: extClients, copyLink } = useExternalClients();
  const extDoCliente = (extClients as { id: string; crm_client_id: string | null }[]).find((c) => c.crm_client_id === clientId) ?? null;
  const { materials, isLoading, isError, createMaterial, updateMaterial, deleteMaterial, uploadAttachment } = useClientMaterials(clientId, extDoCliente?.id ?? null);
  const [copiando, setCopiando] = useState(false);
  const copiarLinkDePedidos = async () => {
    if (!extDoCliente) { toast.error("Este cliente ainda não tem portal. Crie o link de aprovação dele primeiro, na aba Cria Post."); return; }
    setCopiando(true);
    try { await copyLink(extDoCliente.id, null, "materiais"); } finally { setCopiando(false); }
  };
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<ClientMaterial | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [driveUrl, setDriveUrl] = useState("");
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const boardRef = useDragScroll<HTMLDivElement>();

  const openNew = () => { setEditing(null); setForm(EMPTY); setDriveUrl(""); setDialogOpen(true); };
  const openEdit = (m: ClientMaterial) => {
    setEditing(m);
    setForm({
      title: m.title, description: m.description ?? "", due_date: m.due_date ?? "", attachments: m.attachments ?? [],
      kind: (m.kind ?? "arte_avulsa") as MaterialKind,
      parceiroId: m.assignee_id ?? "", prazo: m.prazo_producao ?? "", cache: m.cache_parceiro ?? null,
    });
    setDriveUrl("");
    setDialogOpen(true);
  };

  /* PARCEIROS DA EQUIPE e o card do material (entrega + conversa). */
  const { data: parceiros = [] } = useMeusParceiros();
  const nomeDoParceiro = (id?: string | null) => parceiros.find((p) => p.member_id === id)?.nome ?? null;
  const delegar = useDelegarMaterial();
  const [materialAberto, setMaterialAberto] = useState<string | null>(null);
  // Veio do sino (?material=): abre o card e limpa a URL.
  const [params, setParams] = useSearchParams();
  useEffect(() => {
    const id = params.get("material");
    if (!id) return;
    setMaterialAberto(id);
    const limpo = new URLSearchParams(params);
    limpo.delete("material");
    setParams(limpo, { replace: true });
  }, [params, setParams]);

  /* Delega DEPOIS de salvar o material (no novo, o id só existe depois do
     insert). Só chama se algo do combinado mudou, senão cada "Salvar" do
     briefing reenviaria o aviso pro parceiro. */
  const delegarSeMudou = (id: string, antes: ClientMaterial | null) => {
    const assignee = form.parceiroId || null;
    const mudou = (antes?.assignee_id ?? null) !== assignee
      || (antes?.prazo_producao ?? "") !== (assignee ? form.prazo : "")
      || Number(antes?.cache_parceiro ?? 0) !== Number(assignee ? (form.cache ?? 0) : 0);
    if (!mudou) return;
    delegar.mutate({ id, assigneeId: assignee, prazo: form.prazo || null, cache: form.cache, nome: nomeDoParceiro(assignee) ?? undefined });
  };

  // Sobe os arquivos escolhidos pro Storage e anexa ao material (na hora, no form).
  const onPickFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (!files.length) return;
    setUploading(true);
    for (const f of files) {
      try {
        const att = await uploadAttachment(f);
        setForm((prev) => ({ ...prev, attachments: [...prev.attachments, att] }));
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Falha ao subir o arquivo.");
      }
    }
    setUploading(false);
  };

  // Anexa um link do Drive (arquivo ou pasta) sem subir nada pro Storage.
  const addDrive = () => {
    const raw = driveUrl.trim();
    if (!raw) return;
    setForm((prev) => ({ ...prev, attachments: [...prev.attachments, { kind: "drive", name: "Link do Drive", url: raw }] }));
    setDriveUrl("");
  };

  const removeAttachment = (idx: number) =>
    setForm((prev) => ({ ...prev, attachments: prev.attachments.filter((_, i) => i !== idx) }));

  const save = () => {
    const title = form.title.trim();
    if (!title) return;
    const payload = {
      title,
      description: form.description.trim() || null,
      due_date: form.due_date || null,
      attachments: form.attachments,
      kind: form.kind,
    };
    if (editing) {
      const antes = editing;
      updateMaterial.mutate({ id: editing.id, ...payload }, { onSuccess: () => { delegarSeMudou(antes.id, antes); setDialogOpen(false); } });
    } else {
      createMaterial.mutate(payload, { onSuccess: (novo) => { delegarSeMudou(novo.id, null); setDialogOpen(false); } });
    }
  };

  const move = (m: ClientMaterial, status: MaterialStatus) => {
    if (m.status === status) return;
    updateMaterial.mutate({ id: m.id, status });
  };

  const remove = async (m: ClientMaterial) => {
    if (!(await confirmar({ titulo: "Excluir este material?", descricao: m.title, acao: "Excluir", destrutivo: true }))) return;
    deleteMaterial.mutate(m.id);
  };

  // Soltar o card numa coluna = mudar o status (mesma mutation do menu de 3 pontos, que
  // já é otimista). Reordenar DENTRO da mesma coluna não é persistido: a lista é ordenada
  // por created_at e a coluna `position` da tabela nunca foi usada, então gravar ordem aqui
  // exigiria migração. Soltar na mesma coluna simplesmente não faz nada.
  const onDragEnd = (result: DropResult) => {
    const { source, destination, draggableId } = result;
    if (!destination) return;
    if (destination.droppableId === source.droppableId) return;
    const m = materials.find((x) => x.id === draggableId);
    if (!m) return;
    move(m, destination.droppableId as MaterialStatus);
  };

  const saving = createMaterial.isPending || updateMaterial.isPending;
  // Data do card neste board = PRAZO pra ficar pronto (due_date). Material sem
  // prazo vai pro fim da coluna. Não há ordem manual persistida aqui (ver o
  // comentário do onDragEnd), então o alternador não briga com arraste nenhum.
  const [porData, setPorData, ordemDir, alternarOrdem] = useOrdemPorData("materiais_ordem_data_v1");
  const byStatus = (s: MaterialStatus) => {
    const lista = materials.filter((m) => m.status === s);
    return porData ? ordenarPorData(lista, (m) => m.due_date, undefined, ordemDir) : lista;
  };
  const pedidosCliente = materials.filter((m) => m.requested_by === "cliente" && m.status === "solicitado").length;

  return (
    // data-tour="mat-quadro": alvo do passo de Materiais no tour do cockpit.
    <div data-tour="mat-quadro">
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="min-w-0">
          <p className="text-[12px] font-body text-muted-foreground leading-relaxed">
            Demandas de material fora do fluxo de posts (apresentação, flyer, arte avulsa, logo…). O que o cliente pedir pelo link cai aqui em <span className="font-semibold text-foreground">Solicitado</span> e entra na Agenda na data que ele marcou.
          </p>
          {pedidosCliente > 0 && (
            <p className="text-[12px] font-body text-amber-700 mt-1 flex items-center gap-1.5">
              <User className="h-3.5 w-3.5" /> {pedidosCliente} pedido{pedidosCliente > 1 ? "s" : ""} do cliente aguardando.
            </p>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button variant="outline" onClick={copiarLinkDePedidos} disabled={copiando} className="rounded-xl h-10"
            title="Link em que o cliente só pede material e acompanha o status">
            {copiando ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Link2 className="h-4 w-4 mr-1.5" />}
            <span className="hidden sm:inline">Link de pedidos</span><span className="sm:hidden">Link</span>
          </Button>
          <Button onClick={openNew} className="rounded-xl h-10">
            <Plus className="h-4 w-4 mr-1.5" /> Novo material
          </Button>
        </div>
      </div>

      {/* Ordem das colunas: como veio (mais recentes) ou pelo prazo. */}
      {materials.length > 1 && (
        <div className="flex flex-wrap items-center gap-1.5 mb-3">
          <OrdemDataToggle valor={porData} direcao={ordemDir} onChange={setPorData} onToggle={alternarOrdem} rotuloPadrao="Mais recentes" />
          {porData && (
            <span className="text-[11px] font-body text-muted-foreground">Sem prazo fica no fim.</span>
          )}
        </div>
      )}

      {isLoading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
      ) : isError ? (
        <p className="text-sm text-muted-foreground font-body py-10 text-center">Não consegui carregar os materiais.</p>
      ) : (
        // Mobile-first: colunas empilham; a partir de md vira kanban horizontal com scroll.
        <DragDropContext onDragEnd={onDragEnd}>
          {/* Clicar no vazio e arrastar pro lado rola o board (só mouse, e só no
              md+ onde ele vira kanban horizontal: no mobile não há o que rolar). */}
          <div ref={boardRef} className="flex flex-col gap-4 md:flex-row md:gap-3 md:overflow-x-auto md:pb-2 md:-mx-1 md:px-1">
            {COLUMNS.map((col) => {
              const items = byStatus(col.key);
              return (
                <section key={col.key} className="md:w-[260px] md:shrink-0">
                  <div className="flex items-center gap-2 mb-2.5 px-1">
                    <span className={`w-2 h-2 rounded-full ${col.dot}`} />
                    <h3 className="text-sm font-display font-bold text-foreground">{col.label}</h3>
                    <span className="text-[11px] font-body text-muted-foreground">{items.length}</span>
                  </div>
                  <Droppable droppableId={col.key}>
                    {(dropProvided, dropSnapshot) => (
                      <div ref={dropProvided.innerRef} {...dropProvided.droppableProps}
                        className={cn("space-y-2.5 min-h-[64px] rounded-2xl transition-colors p-0.5 -m-0.5",
                          dropSnapshot.isDraggingOver && "bg-primary/5 ring-2 ring-primary/30")}>
                        {items.length === 0 && !dropSnapshot.isDraggingOver && (
                          <div className="rounded-2xl border border-dashed border-border/70 py-6 text-center text-[12px] text-muted-foreground font-body">
                            Vazio
                          </div>
                        )}
                        {items.map((m, idx) => (
                          <Draggable key={m.id} draggableId={m.id} index={idx} disableInteractiveElementBlocking>
                            {(dragProvided, dragSnapshot) => (
                              <MaterialCard m={m}
                                innerRef={dragProvided.innerRef}
                                draggableProps={dragProvided.draggableProps}
                                handleProps={dragProvided.dragHandleProps ?? undefined}
                                dragging={dragSnapshot.isDragging}
                                parceiroNome={nomeDoParceiro(m.assignee_id)}
                                onAbrir={() => setMaterialAberto(m.id)}
                                onEdit={() => openEdit(m)} onRemove={() => remove(m)} onMove={(s) => move(m, s)} />
                            )}
                          </Draggable>
                        ))}
                        {dropProvided.placeholder}
                      </div>
                    )}
                  </Droppable>
                </section>
              );
            })}
          </div>
        </DragDropContext>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar material" : "Novo material"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3.5 py-1 max-h-[70vh] overflow-y-auto px-0.5">
            <div>
              <label className="text-xs font-body font-semibold text-muted-foreground">Título</label>
              <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Ex.: Flyer de aniversário" className="mt-1" autoFocus />
            </div>
            <div>
              <label className="text-xs font-body font-semibold text-muted-foreground">Tipo</label>
              <div className="mt-1 flex flex-wrap gap-1.5">
                {TIPOS_NO_SELETOR.map((k) => (
                  <button key={k} type="button" onClick={() => setForm({ ...form, kind: k })}
                    className={cn("rounded-full border px-3 py-1 text-[12px] font-body font-semibold transition-colors",
                      form.kind === k ? "bg-foreground text-background border-foreground" : "bg-card border-border text-muted-foreground hover:text-foreground")}>
                    {TIPO_MATERIAL[k]}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-xs font-body font-semibold text-muted-foreground">Briefing</label>
              <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Especificações, dimensões, instruções, referências…" rows={5} className="mt-1 resize-none" />
              <p className="text-[11px] font-body text-muted-foreground mt-1">Descreva tudo que a arte precisa: medidas, textos, cores, o que não pode faltar.</p>
            </div>
            <div>
              <label className="text-xs font-body font-semibold text-muted-foreground">Prazo / data pra ficar pronto (opcional)</label>
              <Input type="date" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} className="mt-1" />
            </div>
            <div>
              <label className="text-xs font-body font-semibold text-muted-foreground">Anexos e arquivos</label>
              <input ref={fileRef} type="file" multiple hidden onChange={onPickFiles} />
              <div className="mt-1 flex flex-wrap gap-2">
                <Button type="button" size="sm" variant="outline" disabled={uploading} onClick={() => fileRef.current?.click()}>
                  {uploading ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Upload className="h-4 w-4 mr-1.5" />} Enviar arquivo
                </Button>
              </div>
              <div className="mt-2 flex items-center gap-2">
                <Input value={driveUrl} onChange={(e) => setDriveUrl(e.target.value)} placeholder="Colar link do Drive"
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addDrive(); } }}
                  className="h-9 rounded-xl" />
                <Button type="button" size="sm" variant="outline" onClick={addDrive} disabled={!driveUrl.trim()}>
                  <Link2 className="h-4 w-4 mr-1.5" /> Colar
                </Button>
              </div>
              {form.attachments.length > 0 && (
                <ul className="mt-2 space-y-1.5">
                  {form.attachments.map((a, i) => (
                    <li key={i} className="flex items-center gap-2 rounded-xl border border-border bg-muted/30 px-2.5 py-2">
                      {a.kind === "drive"
                        ? <Link2 className="h-4 w-4 text-muted-foreground shrink-0" />
                        : <FileText className="h-4 w-4 text-muted-foreground shrink-0" />}
                      <a href={a.url} target="_blank" rel="noopener noreferrer" className="min-w-0 flex-1 text-[12px] font-body text-foreground truncate hover:text-primary hover:underline">
                        {a.name}
                      </a>
                      <button type="button" onClick={() => removeAttachment(i)} aria-label="Remover anexo"
                        className="text-muted-foreground hover:text-destructive h-8 w-8 grid place-items-center rounded-lg shrink-0">
                        <X className="h-4 w-4" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* ENVIAR PARA (Gabriela, 29/09/2026): o material vai pro parceiro
                com o mesmo circuito dos posts. Aviso, entrega, conversa e cachê
                no Caixa. Vale no material novo também: delega ao Salvar. */}
            {parceiros.length > 0 && (
              <div className="rounded-2xl border border-violet-200 bg-violet-50/50 p-3 space-y-2.5">
                <p className="text-[11px] font-bold uppercase tracking-wider text-violet-800 flex items-center gap-1.5">
                  <Send className="h-3.5 w-3.5" /> Enviar para
                </p>
                <select value={form.parceiroId} onChange={(e) => setForm({ ...form, parceiroId: e.target.value })}
                  aria-label="Parceiro" className="w-full h-9 rounded-xl border border-border bg-card px-3 text-[13px] font-body">
                  <option value="">Ninguém (a equipe faz)</option>
                  {parceiros.map((p) => (
                    <option key={p.member_id} value={p.member_id}>{p.nome} · {ROTULO_PAPEL[p.role] ?? p.role}</option>
                  ))}
                </select>
                {form.parceiroId && (
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[11px] font-body font-semibold text-muted-foreground">Prazo pro parceiro</label>
                      <Input type="date" value={form.prazo} onChange={(e) => setForm({ ...form, prazo: e.target.value })} className="mt-1 h-9 rounded-xl bg-card" />
                    </div>
                    <div>
                      <label className="text-[11px] font-body font-semibold text-muted-foreground">Cachê</label>
                      <MoneyInput value={form.cache} onChange={(v) => setForm({ ...form, cache: v })} className="mt-1 h-9 rounded-xl bg-card" />
                    </div>
                  </div>
                )}
                <p className="text-[11px] font-body text-violet-900/70 leading-snug">
                  {editing?.assignee_id && form.parceiroId && editing.assignee_id !== form.parceiroId
                    ? "Trocar de parceiro recomeça o material do zero com a pessoa nova."
                    : form.parceiroId
                      ? "O parceiro recebe o aviso ao salvar. O cachê entra no Caixa quando ele entregar."
                      : editing?.assignee_id ? "Salvar assim tira o material do parceiro." : "Escolha alguém pra delegar."}
                </p>
              </div>
            )}
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            {/* Excluir DENTRO da edição: o Walter tentou apagar por aqui e não
                tinha como (só existia no menu do card). Mesma confirmação. */}
            {editing && (
              <Button variant="ghost" disabled={saving}
                className="text-destructive hover:text-destructive sm:mr-auto"
                onClick={async () => { const alvo = editing; setDialogOpen(false); await remove(alvo); }}>
                <Trash2 className="h-4 w-4 mr-1.5" /> Excluir
              </Button>
            )}
            <Button variant="ghost" onClick={() => setDialogOpen(false)} disabled={saving}>Cancelar</Button>
            <Button onClick={save} disabled={saving || !form.title.trim()}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : editing ? "Salvar" : "Criar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <MaterialAbertoDialog materialId={materialAberto} aoFechar={() => setMaterialAberto(null)} />
    </div>
  );
}

function MaterialCard({ m, onEdit, onRemove, onMove, innerRef, draggableProps, handleProps, dragging, parceiroNome, onAbrir }: {
  m: ClientMaterial; onEdit: () => void; onRemove: () => void; onMove: (s: MaterialStatus) => void;
  parceiroNome?: string | null; onAbrir?: () => void;
  innerRef?: (el: HTMLElement | null) => void;
  draggableProps?: DraggableProvidedDraggableProps;
  handleProps?: DraggableProvidedDragHandleProps;
  dragging?: boolean;
}) {
  const due = fmtDate(m.due_date);
  const fromClient = m.requested_by === "cliente";
  const atts = m.attachments ?? [];
  return (
    // O CORPO do card abre a edição num toque só (era o que faltava: antes só pelo menu).
    // role="button" em vez de <button> pra não aninhar botão dentro de botão (lápis, menu,
    // links de anexo moram aqui dentro). Cada um deles dá stopPropagation pra não editar.
    <article ref={innerRef} {...(draggableProps ?? {})}
      role="button" tabIndex={0}
      onClick={onEdit}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onEdit(); } }}
      style={{ ...(draggableProps?.style ?? {}), ...dragCardStyle }}
      className={cn("rounded-2xl border border-border bg-card p-3 shadow-sm text-left w-full cursor-pointer hover:border-primary/50 hover:shadow-md transition-all",
        dragging && "shadow-lg ring-2 ring-primary/40")}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex items-center gap-1.5">
          <DragGrip handleProps={handleProps} />
          {atts.length > 0 && (
            <span className="inline-flex items-center gap-1 text-[10px] font-body font-bold uppercase tracking-wide text-primary bg-primary/10 rounded-md px-1.5 py-0.5">
              <Paperclip className="h-3 w-3" /> {atts.length} {atts.length > 1 ? "anexos" : "anexo"}
            </span>
          )}
        </div>
        <div className="flex items-center gap-0.5 shrink-0 -mr-1 -mt-1">
          {/* Lápis: mesmo atalho visível do kanban de produção (Cria Post). */}
          <button type="button" onClick={(e) => { e.stopPropagation(); onEdit(); }}
            className="text-muted-foreground hover:text-primary p-1.5 md:p-1 rounded-lg" aria-label="Editar material">
            <Pencil className="h-4 w-4 md:h-3.5 md:w-3.5" />
          </button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button onClick={(e) => e.stopPropagation()}
                className="text-muted-foreground hover:text-foreground p-1.5 md:p-1 rounded-lg" aria-label="Ações do material">
                <MoreVertical className="h-4 w-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44" onClick={(e) => e.stopPropagation()}>
              {COLUMNS.filter((c) => c.key !== m.status).map((c) => (
                <DropdownMenuItem key={c.key} onClick={() => onMove(c.key)}>
                  <span className={`w-2 h-2 rounded-full mr-2 ${c.dot}`} /> Mover p/ {c.label}
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={onEdit}>Editar</DropdownMenuItem>
              <DropdownMenuItem onClick={onRemove} className="text-red-600 focus:text-red-600">Excluir</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
      <h4 className="text-sm font-display font-bold text-foreground mt-1.5 leading-snug">{m.title}</h4>
      {m.description && <p className="text-[12px] font-body text-muted-foreground mt-1 line-clamp-2">{m.description}</p>}
      {atts.length > 0 && (
        <div className="mt-2 space-y-1">
          {atts.slice(0, 3).map((a, i) => (
            // stopPropagation: abrir o anexo NÃO pode abrir o editor do material.
            <a key={i} href={a.url} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}
              className="flex items-center gap-1.5 text-[11px] font-body text-muted-foreground hover:text-primary hover:underline">
              {a.kind === "drive" ? <Link2 className="h-3 w-3 shrink-0" /> : <FileText className="h-3 w-3 shrink-0" />}
              <span className="truncate">{a.name}</span>
              <ExternalLink className="h-2.5 w-2.5 shrink-0 opacity-60" />
            </a>
          ))}
          {atts.length > 3 && <p className="text-[10px] font-body text-muted-foreground">+{atts.length - 3} anexo(s)</p>}
        </div>
      )}
      <div className="flex items-center gap-2 flex-wrap mt-2.5">
        {fromClient && (
          <span className="inline-flex items-center gap-1 text-[10px] font-body font-bold text-amber-700 bg-amber-50 border border-amber-100 rounded-md px-1.5 py-0.5">
            <User className="h-3 w-3" /> Pedido do cliente
          </span>
        )}
        {due && (
          <span className="inline-flex items-center gap-1 text-[11px] font-body text-muted-foreground">
            <CalendarDays className="h-3 w-3" /> {due}
          </span>
        )}
        {m.kind && m.kind !== "arte_avulsa" && TIPO_MATERIAL[m.kind] && (
          <span className="text-[10px] font-body font-bold rounded-md px-1.5 py-0.5 bg-muted text-muted-foreground">{TIPO_MATERIAL[m.kind]}</span>
        )}
      </div>
      {/* COM O PARCEIRO: quem, em que etapa, e o atalho pra entrega e a
          conversa. Entregue e ainda não revisado ganha destaque verde. */}
      {m.assignee_id && (
        <div className={cn("mt-2.5 rounded-xl border px-2.5 py-2",
          m.producao_status === "entregue" && !["em_aprovacao", "finalizado"].includes(m.status)
            ? "border-green-300 bg-green-50" : "border-violet-200 bg-violet-50/60")}>
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="w-5 h-5 rounded-full bg-gradient-to-br from-violet-400 to-violet-700 text-white grid place-items-center text-[9px] font-bold shrink-0">
              {(parceiroNome ?? "P").charAt(0).toUpperCase()}
            </span>
            <span className="text-[11.5px] font-body font-semibold text-foreground truncate max-w-[110px]">{parceiroNome?.split(" ")[0] ?? "Parceiro"}</span>
            {m.producao_status && ETAPA_PARCEIRO[m.producao_status] && (
              <span className={cn("text-[10px] font-bold px-1.5 py-0.5 rounded-full", ETAPA_PARCEIRO[m.producao_status].cls)}>
                {ETAPA_PARCEIRO[m.producao_status].txt}
              </span>
            )}
            {m.cache_parceiro != null && Number(m.cache_parceiro) > 0
              ? <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-green-50 text-green-800 border border-green-200">{brlReais(Number(m.cache_parceiro))}</span>
              : <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-800">sem cachê</span>}
          </div>
          {onAbrir && (
            <button type="button" onClick={(e) => { e.stopPropagation(); onAbrir(); }}
              className="mt-1.5 inline-flex items-center gap-1 text-[11.5px] font-body font-bold text-violet-700 hover:underline">
              <MessageCircle className="h-3.5 w-3.5" />
              {m.producao_status === "entregue" && !["em_aprovacao", "finalizado"].includes(m.status) ? "Revisar entrega" : "Entrega e conversa"}
            </button>
          )}
        </div>
      )}
    </article>
  );
}
