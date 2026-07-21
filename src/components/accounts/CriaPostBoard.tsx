import { useState } from "react";
import { useExternalClients, useExternalPosts, usePortalActivity, type ExternalClient, type ExternalPost, type ExternalPostInput } from "@/hooks/useCriaPost";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ArtBriefDialog } from "./ArtBriefDialog";
import { ClientContentWriter } from "./ClientContentWriter";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { CronogramaBoard } from "@/components/accounts/CronogramaBoard";
import { DragDropContext, Droppable, Draggable, type DropResult } from "@hello-pangea/dnd";
import { Plus, Link2, Pencil, Loader2, ArrowLeft, Trash2, RotateCcw, FileText, Instagram, KanbanSquare, Eye, Clock, Settings2, Palette } from "lucide-react";
import { CriaPostMedia } from "@/components/accounts/CriaPostMedia";
import { ImportKanbanDialog } from "@/components/accounts/ImportKanbanDialog";
import { ClientReportDialog } from "@/components/accounts/ClientReportDialog";
import { ExternalClientDialog } from "@/components/accounts/ExternalClientDialog";
import { useProfile } from "@/hooks/useProfile";
import { useCrmClients } from "@/hooks/useCrm";
import { useClientSocialConnection, connectInstagram } from "@/hooks/useSocialInsights";
import { ClienteInstagramCria } from "@/components/accounts/ClienteInstagramCria";
import { FORMATS_BY_PLATFORM, FORMAT_LABELS } from "@/lib/constants";

const PLATFORMS = ["instagram", "tiktok", "youtube"];
const FORMATS = ["reels", "carrossel", "foto", "story", "video"];
// CLIENT_COLORS mudou de casa (ExternalClientDialog), re-export mantém imports antigos.
export { CLIENT_COLORS } from "@/components/accounts/ExternalClientDialog";
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
function relTimeBR(iso: string): string {
  const min = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (min < 1) return "agora mesmo";
  if (min < 60) return `há ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `há ${h}h`;
  const d = Math.floor(h / 24);
  return d === 1 ? "há 1 dia" : `há ${d} dias`;
}
function daysWaiting(p: ExternalPost): number {
  const base = p.approval_updated_at ?? p.created_at;
  return Math.floor((Date.now() - new Date(base).getTime()) / 86400000);
}
const STATUS: Record<string, { label: string; cls: string }> = {
  pendente: { label: "Aguardando cliente", cls: "bg-amber-100 text-amber-700" },
  ajuste_solicitado: { label: "Ajuste solicitado", cls: "bg-orange-100 text-orange-700" },
  aprovado: { label: "Aprovado", cls: "bg-green-100 text-green-700" },
};
const APPROVAL_COLS = ["pendente", "ajuste_solicitado", "aprovado"] as const;
type ApprovalKey = (typeof APPROVAL_COLS)[number];

export function ClientDetail({ client, onBack, embedded, activeTab, onTabChange }: { client: ExternalClient; onBack?: () => void; embedded?: boolean; activeTab?: string; onTabChange?: (t: string) => void }) {
  const { posts, isLoading, create, createDraft, update, remove, moveStatus, setDate } = useExternalPosts(client.id);
  // Guarda o id do rascunho aberto: se o usuário cancelar, apagamos (não vira lixo).
  const [draftId, setDraftId] = useState<string | null>(null);
  // Kanban (padrão) ou Calendário. Preferência salva por dispositivo.
  const [view, setView] = useState<"kanban" | "calendario">(() => {
    try { return (localStorage.getItem("criapost_view") as "kanban" | "calendario") || "kanban"; } catch { return "kanban"; }
  });
  const setViewPersist = (v: "kanban" | "calendario") => {
    setView(v);
    try { localStorage.setItem("criapost_view", v); } catch { /* segue */ }
  };
  const { copyLink } = useExternalClients();
  const { profile } = useProfile();
  const { data: portalViewedAt } = usePortalActivity(client.id);
  const [confirmMove, setConfirmMove] = useState<{ id: string; status: ApprovalKey } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const handleApprovalDragEnd = (r: DropResult) => {
    if (!r.destination) return;
    const dest = r.destination.droppableId as ApprovalKey;
    const post = posts.find((p) => p.id === r.draggableId);
    if (!post || (post.approval_status ?? "pendente") === dest) return;
    // Avançar manualmente pra "Aprovado" sem o cliente: pede confirmação.
    if (dest === "aprovado") setConfirmMove({ id: r.draggableId, status: dest });
    else moveStatus.mutate({ id: r.draggableId, approval_status: dest });
  };
  const { data: crmClients = [] } = useCrmClients();
  const criaOwnerId = crmClients.find((c) => c.id === client.crm_client_id)?.cria_owner_id ?? null;
  const hasCriaAccount = !!criaOwnerId;
  const { data: igConn } = useClientSocialConnection(client.crm_client_id);
  const [formOpen, setFormOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  // Personalização do cliente (logo, cores, vínculo central): antes vivia na lista do
  // Cria Post, agora acompanha o cliente aqui dentro (embutido no ClienteHub).
  const [editOpen, setEditOpen] = useState(false);
  const [editing, setEditing] = useState<ExternalPost | null>(null);
  const [f, setF] = useState<ExternalPostInput>({ title: "", platform: "instagram", format: "reels", caption: "", hook: "", approval_mode: "fast", script: "", scheduled_date: null, scheduled_time: null });
  const [copying, setCopying] = useState(false);
  const [briefOpen, setBriefOpen] = useState(false);

  // Novo post: cria um RASCUNHO na hora. Assim o post.id já existe e a mídia pode ser
  // anexada de cara (o storage precisa do id). O rascunho não aparece pro cliente.
  const openNew = async (day?: string) => {
    setF({ title: "", platform: "instagram", format: "reels", caption: "", hook: "", approval_mode: "fast", script: "", scheduled_date: day ?? null, scheduled_time: null });
    setFormOpen(true);
    try {
      const draft = await createDraft.mutateAsync({ scheduled_date: day ?? null });
      setDraftId(draft.id);
      setEditing(draft);
    } catch { setFormOpen(false); }
  };
  const openEdit = (p: ExternalPost) => { setDraftId(null); setEditing(p); setF({ title: p.title, platform: p.platform, format: p.format, caption: p.caption ?? "", hook: p.hook ?? "", approval_mode: (p.approval_mode as "fast"|"flow"|"both") ?? "fast", script: p.script ?? "", scheduled_date: p.scheduled_date ?? null, scheduled_time: (p as { scheduled_time?: string | null }).scheduled_time ?? null }); setFormOpen(true); };

  // Cancelar um post novo apaga o rascunho (com a mídia que já subiu).
  const closeForm = async () => {
    setFormOpen(false);
    if (draftId) { await remove.mutateAsync(draftId).catch(() => { /* silencioso */ }); setDraftId(null); }
    setEditing(null);
  };

  const submit = async () => {
    if (!f.title.trim()) return;
    if (draftId) {
      // Rascunho → publica (entra na fila de aprovação do cliente).
      await update.mutateAsync({ id: draftId, publish: true, ...f });
      toast.success("Post enviado pra aprovação!");
      setDraftId(null);
    } else if (editing) {
      await update.mutateAsync({ id: editing.id, resend: editing.approval_status === "ajuste_solicitado", ...f });
    } else {
      await create.mutateAsync(f);
      toast.success("Post enviado pra aprovação!");
    }
    setFormOpen(false);
    setEditing(null);
  };
  const doCopy = async () => { setCopying(true); await copyLink(client.id); setCopying(false); };
  // Envio por PERÍODO: gera um link que só mostra os posts daquele intervalo.
  const [linkOpen, setLinkOpen] = useState(false);
  const [pStart, setPStart] = useState("");
  const [pEnd, setPEnd] = useState("");
  const doCopyPeriod = async () => {
    if (!pStart || !pEnd) { toast.error("Escolha o início e o fim do período."); return; }
    if (pEnd < pStart) { toast.error("O fim tem que ser depois do início."); return; }
    setCopying(true);
    await copyLink(client.id, { start: pStart, end: pEnd });
    setCopying(false); setLinkOpen(false);
  };
  const onChangePlatform = (pl: string) => {
    setF((prev) => {
      const allowed = FORMATS_BY_PLATFORM[pl] ?? [];
      const format = allowed.length && !allowed.includes(prev.format) ? allowed[0] : prev.format;
      return { ...prev, platform: pl, format };
    });
  };

  return (
    <div>
      {!embedded && (
        <>
          <button onClick={onBack} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground font-body mb-4"><ArrowLeft className="h-4 w-4" /> Clientes</button>
          <div className="flex items-start justify-between gap-3 mb-5">
            <div className="min-w-0">
              <h1 className="text-2xl font-display font-extrabold text-foreground tracking-tight truncate">{client.name}</h1>
              {client.instagram_handle && <p className="text-sm text-muted-foreground font-body">@{client.instagram_handle.replace(/^@/, "")}</p>}
            </div>
            <div className="flex gap-2 shrink-0">
              {/* Link de aprovação dos POSTS (diferente do link do cronograma), nome explícito pra não confundir. */}
              <Button variant="outline" onClick={() => setLinkOpen(true)} disabled={copying}>{copying ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Link2 className="h-4 w-4 sm:mr-1.5" /> <span className="hidden sm:inline">Link dos posts</span></>}</Button>
            </div>
          </div>
        </>
      )}

      <ClientReportDialog open={reportOpen} onOpenChange={setReportOpen} client={client} posts={posts} managerName={profile?.name ?? undefined} />
      <ExternalClientDialog open={editOpen} onOpenChange={setEditOpen} client={client} />
      <ImportKanbanDialog open={importOpen} onOpenChange={setImportOpen} externalClientId={client.id} criaOwnerId={criaOwnerId} existingTitles={new Set(posts.map((p) => p.title))} />

      <Tabs value={embedded ? activeTab : undefined} defaultValue={embedded ? undefined : "posts"} onValueChange={embedded ? onTabChange : undefined} className="w-full">
        {!embedded && (
        <TabsList className="bg-card border border-border rounded-2xl p-1.5 mb-5 flex flex-wrap h-auto gap-1">
          <TabsTrigger value="posts" className="rounded-xl data-[state=active]:bg-primary/10 data-[state=active]:text-primary">Posts</TabsTrigger>
          <TabsTrigger value="cronograma" className="rounded-xl data-[state=active]:bg-primary/10 data-[state=active]:text-primary">Cronograma</TabsTrigger>
          <TabsTrigger value="relatorio" className="rounded-xl data-[state=active]:bg-primary/10 data-[state=active]:text-primary">Relatório</TabsTrigger>
          <TabsTrigger value="instagram" className="rounded-xl data-[state=active]:bg-primary/10 data-[state=active]:text-primary">Instagram</TabsTrigger>
        </TabsList>
        )}

        <TabsContent value="posts">
          <div className="flex items-center justify-between gap-2 mb-3 flex-wrap">
            {/* Kanban (padrão) / Calendário, as duas visões conversam: mudar a data reflete no card. */}
            <div className="inline-flex rounded-lg border border-border overflow-hidden">
              {(["kanban", "calendario"] as const).map((v) => (
                <button key={v} onClick={() => setViewPersist(v)}
                  className={`px-3 py-1.5 text-xs font-body font-semibold transition-colors ${view === v ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}>
                  {v === "kanban" ? "Kanban" : "Calendário"}
                </button>
              ))}
            </div>
            <div className="flex gap-2 flex-wrap">
              {embedded && (
                <>
                  <Button variant="outline" onClick={() => setLinkOpen(true)} disabled={copying}>{copying ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Link2 className="h-4 w-4 sm:mr-1.5" /> <span className="hidden sm:inline">Link de aprovação</span></>}</Button>
                  {/* Só na visão SOLTA do Cria Post. Dentro da ficha do cliente
                      existe a aba Portal, que faz o mesmo com mais espaço. */}
                  {!embedded && <Button variant="outline" onClick={() => setEditOpen(true)}><Settings2 className="h-4 w-4 sm:mr-1.5" /> <span className="hidden sm:inline">Personalizar</span></Button>}
                </>
              )}
              <Button variant="outline" onClick={() => setImportOpen(true)}><KanbanSquare className="h-4 w-4 mr-1.5" /> Importar do kanban</Button>
              <Button onClick={() => openNew()}><Plus className="h-4 w-4 mr-1.5" /> Novo post</Button>
            </div>
          </div>
      {view === "calendario" ? (
        <PostsCalendar posts={posts} onOpen={openEdit} onNewAt={(d) => openNew(d)}
          onMove={(id, d) => setDate.mutate({ id, scheduled_date: d })} />
      ) : isLoading ? (
        <div className="space-y-3">{[0, 1].map((i) => <div key={i} className="h-20 rounded-2xl bg-muted animate-pulse" />)}</div>
      ) : posts.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-10 text-center">
          <p className="text-sm font-body text-foreground font-medium">Nenhum post ainda</p>
          <p className="text-xs text-muted-foreground font-body mt-1">Crie um post e ele já entra na fila de aprovação do cliente.</p>
        </div>
      ) : (
        <DragDropContext onDragEnd={handleApprovalDragEnd}>
          <div className="flex gap-3 overflow-x-auto pb-4 -mx-1 px-1 kanban-scroll">
            {APPROVAL_COLS.map((colKey) => {
              const st = STATUS[colKey];
              const colPosts = posts.filter((p) => (p.approval_status ?? "pendente") === colKey);
              return (
                <div key={colKey} className="w-[80vw] max-w-[300px] sm:w-72 shrink-0">
                  <div className="flex items-center justify-between px-2 py-2">
                    <span className={`text-[10px] font-body font-bold px-2 py-0.5 rounded-full ${st.cls}`}>{st.label}</span>
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground">{colPosts.length}</span>
                  </div>
                  <Droppable droppableId={colKey}>
                  {(dropP, dropS) => (
                  <div ref={dropP.innerRef} {...dropP.droppableProps}
                    className={`min-h-[260px] rounded-xl p-2 space-y-2 transition-colors ${dropS.isDraggingOver ? "bg-primary/5 ring-2 ring-primary/30" : "bg-muted/30"}`}>
                    {colPosts.map((p, idx) => (
                      <Draggable key={p.id} draggableId={p.id} index={idx}>
                      {(dragP, dragS) => (
                      <div ref={dragP.innerRef} {...dragP.draggableProps} {...dragP.dragHandleProps} style={dragP.draggableProps.style}
                        className={`bg-card border border-border rounded-xl p-3 cursor-grab active:cursor-grabbing hover:shadow-md transition-all ${dragS.isDragging ? "shadow-warm-lg ring-2 ring-primary/40" : ""}`}>
                        <div className="flex items-start gap-2">
                          <div className="flex-1 min-w-0">
                            <span className="text-[10px] font-body font-semibold text-muted-foreground uppercase tracking-wide">{cap(p.format)} · {cap(p.platform)}</span>
                            <p className="font-display font-bold text-sm text-foreground truncate mt-1">{p.title}</p>
                            {/* Data direto no card, sem abrir o post. Reflete no calendário na hora. */}
                            <input type="date" value={p.scheduled_date ?? ""}
                              onClick={(e) => e.stopPropagation()}
                              onChange={(e) => { e.stopPropagation(); setDate.mutate({ id: p.id, scheduled_date: e.target.value || null }); }}
                              className="mt-1 h-9 md:h-6 w-full rounded-md border border-border bg-card px-1.5 text-[11px] font-body text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary" />
                            {p.caption && <p className="text-xs text-muted-foreground font-body line-clamp-2 mt-0.5">{p.caption}</p>}
                            {p.approval_status === "ajuste_solicitado" && p.last_comment && p.last_comment_role === "cliente_externo" && (
                              <div className="mt-2 text-xs font-body text-orange-700 bg-orange-50 border border-orange-100 rounded-lg px-2.5 py-1.5">Cliente pediu: "{p.last_comment}"</div>
                            )}
                            {colKey === "pendente" && (() => {
                              const sentAt = p.approval_updated_at ?? p.created_at;
                              const seen = !!portalViewedAt && new Date(portalViewedAt) >= new Date(sentAt);
                              const wait = daysWaiting(p);
                              if (!seen && wait <= 3) return null;
                              return (
                                <div className="mt-2 space-y-1">
                                  {seen && (
                                    <p className="flex items-center gap-1 text-[10px] font-body font-semibold text-sky-700"><Eye className="h-3 w-3 shrink-0" /> Visto pelo cliente {relTimeBR(portalViewedAt!)}</p>
                                  )}
                                  {wait > 3 && (
                                    <p className="flex items-center gap-1 text-[10px] font-body font-bold text-amber-600"><Clock className="h-3 w-3 shrink-0" /> Esperando há {wait} dias</p>
                                  )}
                                </div>
                              );
                            })()}
                            <span className="inline-block mt-2 text-[9px] font-body font-bold px-1.5 py-0.5 rounded-full bg-primary/10 text-primary">{p.approval_mode === "flow" ? "Detalhada" : p.approval_mode === "both" ? "Ambas" : "Simplificada"}</span>
                          </div>
                          <div className="flex flex-col gap-1.5 md:gap-1 shrink-0">
                            <Button variant="ghost" size="sm" className="h-9 w-9 md:h-7 md:w-7 p-0" onClick={() => openEdit(p)} aria-label="Editar"><Pencil className="h-4 w-4 md:h-3.5 md:w-3.5" /></Button>
                            <Button variant="ghost" size="sm" className="h-9 w-9 md:h-7 md:w-7 p-0 text-destructive" onClick={() => setConfirmDelete(p.id)} aria-label="Excluir"><Trash2 className="h-4 w-4 md:h-3.5 md:w-3.5" /></Button>
                          </div>
                        </div>
                      </div>
                      )}
                      </Draggable>
                    ))}
                    {colPosts.length === 0 && <div className="text-center py-10 text-muted-foreground/40 text-[10px]">vazio</div>}
                    {dropP.placeholder}
                  </div>
                  )}
                  </Droppable>
                </div>
              );
            })}
          </div>
        </DragDropContext>
      )}
        </TabsContent>

        <TabsContent value="cronograma">
          <CronogramaBoard fixedClientId={client.id} />
        </TabsContent>

        <TabsContent value="relatorio">
          <div className="rounded-2xl border border-border bg-card p-6 text-center">
            <p className="text-sm font-body text-foreground font-medium mb-1">Relatório mensal do cliente</p>
            <p className="text-xs text-muted-foreground font-body mb-4">Produção, desempenho do Instagram e análise da IA, pronto pra enviar em PDF.</p>
            <Button onClick={() => setReportOpen(true)}><FileText className="h-4 w-4 mr-1.5" /> Abrir relatório</Button>
          </div>
        </TabsContent>

        <TabsContent value="instagram">
          {client.crm_client_id && hasCriaAccount && criaOwnerId ? (
            // Cliente usa o CRIA: mostra os insights reais que ele mesmo sincronizou.
            <ClienteInstagramCria criaOwnerId={criaOwnerId} clientName={client.name} />
          ) : (
          <div className="rounded-2xl border border-border bg-card p-6 space-y-3">
            {client.crm_client_id ? (
              igConn ? (
                <div className="flex items-center gap-2 text-green-700"><Instagram className="h-5 w-5" /> <span className="font-body text-sm font-medium">Conectado: @{igConn.username ?? "conta"}</span></div>
              ) : (
                <>
                  <p className="text-sm font-body text-foreground">Este cliente não usa o CRIA. Você pode conectar o Instagram dele aqui pra puxar os insights.</p>
                  <Button onClick={() => connectInstagram(client.crm_client_id)} className="gap-1.5"><Instagram className="h-4 w-4" /> Conectar Instagram</Button>
                </>
              )
            ) : (
              <p className="text-sm font-body text-muted-foreground">Vincule este cliente ao cadastro central (no botão "Editar" do cliente, na lista) pra habilitar os insights do Instagram.</p>
            )}
          </div>
          )}
        </TabsContent>
      </Tabs>

      <AlertDialog open={!!confirmMove} onOpenChange={(o) => { if (!o) setConfirmMove(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Avançar sem o cliente aprovar?</AlertDialogTitle>
            <AlertDialogDescription>
              O cliente ainda não aprovou este post pelo link. Você está movendo manualmente para <b>Aprovado</b> e assume essa decisão.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => { if (confirmMove) moveStatus.mutate({ id: confirmMove.id, approval_status: confirmMove.status }); setConfirmMove(null); }}>
              Sim, avançar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!confirmDelete} onOpenChange={(o) => { if (!o) setConfirmDelete(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir este post?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação é permanente e apaga o post do cliente. Não dá pra desfazer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => { if (confirmDelete) remove.mutate(confirmDelete); setConfirmDelete(null); }}>
              Sim, excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Link de aprovação: tudo OU um período específico */}
      <Dialog open={linkOpen} onOpenChange={setLinkOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader><DialogTitle className="font-display">Link de aprovação</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="rounded-xl border border-border p-3">
              <p className="text-sm font-body font-semibold text-foreground">Todos os posts</p>
              <p className="text-[12px] font-body text-muted-foreground mb-2">O cliente vê tudo que está na fila de aprovação.</p>
              <Button variant="outline" size="sm" onClick={async () => { await doCopy(); setLinkOpen(false); }} disabled={copying}>
                <Link2 className="h-3.5 w-3.5 mr-1.5" /> Copiar link completo
              </Button>
            </div>
            <div className="rounded-xl border border-primary/30 bg-primary/[0.04] p-3">
              <p className="text-sm font-body font-semibold text-foreground">Só um período</p>
              <p className="text-[12px] font-body text-muted-foreground mb-2">Gera um link que mostra apenas os posts agendados nesse intervalo.</p>
              <div className="flex gap-2 mb-2">
                <div className="flex-1">
                  <Label className="text-[11px] font-body text-muted-foreground">Início</Label>
                  <Input type="date" value={pStart} onChange={(e) => setPStart(e.target.value)} className="rounded-xl" />
                </div>
                <div className="flex-1">
                  <Label className="text-[11px] font-body text-muted-foreground">Fim</Label>
                  <Input type="date" value={pEnd} onChange={(e) => setPEnd(e.target.value)} className="rounded-xl" />
                </div>
              </div>
              <Button size="sm" onClick={doCopyPeriod} disabled={copying}>
                {copying ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Link2 className="h-3.5 w-3.5 mr-1.5" />} Copiar link do período
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={formOpen} onOpenChange={(o) => { if (!o) void closeForm(); }}>
        <DialogContent onOpenAutoFocus={(e) => e.preventDefault()} className="max-w-md md:max-w-5xl bg-white rounded-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader className="flex flex-row items-center justify-between gap-3 pr-8">
            <DialogTitle className="font-display">{draftId || !editing ? "Novo post" : "Editar post"}</DialogTitle>
            <div className="flex items-center gap-2 shrink-0">
              <Button variant="outline" size="sm" onClick={() => void closeForm()}>Cancelar</Button>
              <Button size="sm" onClick={submit} disabled={create.isPending || update.isPending || !f.title.trim()}>{(create.isPending || update.isPending) ? <Loader2 className="h-4 w-4 animate-spin" /> : draftId ? "Criar e enviar" : editing ? (editing.approval_status === "ajuste_solicitado" ? <><RotateCcw className="h-4 w-4 mr-1.5" /> Salvar e reenviar</> : "Salvar") : "Criar e enviar"}</Button>
            </div>
          </DialogHeader>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-[1.1fr_0.9fr] md:gap-5">

            {/* 1, Título */}
            <div className="order-1 md:col-start-1 md:row-start-1 space-y-1.5">
              <Label className="text-xs font-body">Título *</Label>
              <Input value={f.title} onChange={(e) => setF((p) => ({ ...p, title: e.target.value }))} className="rounded-xl" />
            </div>

            {/* 2, Plataforma + Formato */}
            <div className="order-2 md:col-start-1 md:row-start-2 space-y-3">
              <div>
                <label className="text-xs font-semibold mb-1.5 block">Plataforma</label>
                <div className="grid grid-cols-3 gap-2">
                  {PLATFORMS.map((pl) => (
                    <button key={pl} type="button" onClick={() => onChangePlatform(pl)}
                      className={`rounded-full border text-sm py-2 transition-colors ${f.platform === pl ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground"}`}>{cap(pl)}</button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold mb-1.5 block">Formato</label>
                <div className="flex flex-wrap gap-2 justify-center md:justify-start">
                  {(FORMATS_BY_PLATFORM[f.platform] ?? FORMATS).map((ft) => (
                    <button key={ft} type="button" onClick={() => setF((p) => ({ ...p, format: ft }))}
                      className={`rounded-full border text-xs px-3 py-1.5 transition-colors ${f.format === ft ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground"}`}>{FORMAT_LABELS[ft] ?? cap(ft)}</button>
                  ))}
                </div>
              </div>
            </div>

            {/* 3, Tipo de aprovação */}
            <div className="order-3 md:col-start-1 md:row-start-3">
              <label className="text-xs font-semibold mb-1.5 block">Tipo de aprovação</label>
              <div className="grid grid-cols-3 gap-2">
                {([["fast","Simplificada"],["flow","Detalhada"],["both","Ambas"]] as [string,string][]).map(([v,l]) => (
                  <button key={v} type="button" onClick={() => setF((p) => ({ ...p, approval_mode: v as "fast"|"flow"|"both" }))}
                    className={`rounded-full border text-xs px-2 py-2 text-center transition-colors ${f.approval_mode === v ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground"}`}>{l}</button>
                ))}
              </div>
              <p className="text-[11px] text-muted-foreground mt-2 hidden md:block">
                Simplificada = 1 clique · Detalhada = 4 etapas · Ambas = o cliente escolhe.
              </p>
            </div>

            {/* 4, Mídia (direita no desktop, posição 4 no mobile) */}
            <div className="order-4 md:col-start-2 md:row-start-1 md:row-span-5">
              <div className="flex items-center justify-between gap-2 mb-1.5">
                <label className="text-xs font-semibold">Mídia</label>
                {/* BRIEFING DE ARTE. Ela escreve isto no WhatsApp do designer, na
                    mão, dez vezes por semana — e digita a paleta do cliente de
                    cabeça toda vez. O botão mora AQUI, colado no espaço da arte,
                    que é o minuto em que ela precisa dele. */}
                <button
                  type="button"
                  onClick={() => setBriefOpen(true)}
                  className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/[0.06] px-2.5 py-1 text-[11px] font-body font-bold text-primary hover:bg-primary/10 transition-colors"
                >
                  <Palette className="h-3 w-3" /> Briefing de arte
                </button>
              </div>
              {editing?.id ? (
                <CriaPostMedia postId={editing.id} platform={f.platform} format={f.format}
                  caption={f.caption ?? undefined} handle={client.instagram_handle || client.name}
                  approved={editing.approval_status === "aprovado"} />
              ) : (
                <p className="text-xs text-muted-foreground flex items-center gap-1.5"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Preparando o post pra você anexar a mídia…</p>
              )}
            </div>

            {/* 4b, Cronograma: data + hora da publicação */}
            <div className="order-[4] md:col-start-1 md:row-start-4">
              <label className="text-xs font-semibold mb-1.5 block">Cronograma</label>
              <div className="flex gap-2">
                <div className="flex-1">
                  <Label className="text-[11px] font-body text-muted-foreground">Data de publicação</Label>
                  <Input type="date" value={f.scheduled_date ?? ""} onChange={(e) => setF((p) => ({ ...p, scheduled_date: e.target.value || null }))} className="rounded-xl" />
                </div>
                <div className="w-28">
                  <Label className="text-[11px] font-body text-muted-foreground">Horário</Label>
                  <Input type="time" value={f.scheduled_time ?? ""} onChange={(e) => setF((p) => ({ ...p, scheduled_time: e.target.value || null }))} className="rounded-xl" />
                </div>
              </div>
            </div>

            {/* 5, Legenda */}
            <div className="order-5 md:col-start-1 md:row-start-5 space-y-1.5">
              <Label className="text-xs font-body">Legenda</Label>
              <Textarea value={f.caption ?? ""} onChange={(e) => setF((p) => ({ ...p, caption: e.target.value }))} rows={4} className="rounded-xl" />
              {f.format === "story" && (f.caption ?? "").trim() !== "" && (
                <p className="text-[11px] text-muted-foreground font-body">Story não exibe legenda. Esse texto não aparece no preview.</p>
              )}
            </div>

            {/* 6, Roteiro / conteúdo */}
            {f.approval_mode !== "fast" && (
              <div className="order-6 md:col-start-1 md:row-start-5 space-y-1.5">
                <Label className="text-xs font-body">Roteiro / conteúdo (etapa "Conteúdo")</Label>
                {/* Ela escreve conteúdo pra DEZ marcas por semana. Era o trabalho
                    mais repetitivo da rotina dela, e o único lugar onde a IA do
                    CRIA não ajudava — o gerador só existia do lado do criador. */}
                <ClientContentWriter
                  crmClientId={client.crm_client_id ?? null}
                  clienteNome={client.name}
                  titulo={f.title}
                  formato={f.format}
                  valor={f.script ?? ""}
                  onChange={(texto) => setF((p) => ({ ...p, script: texto }))}
                />
                <Textarea value={f.script ?? ""} onChange={(e) => setF((p) => ({ ...p, script: e.target.value }))} rows={4} className="rounded-xl" />
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* O briefing de arte deste post, com a marca DESTE cliente. */}
      <ArtBriefDialog
        open={briefOpen}
        onOpenChange={setBriefOpen}
        crmClientId={client.crm_client_id ?? null}
        clienteNome={client.name}
        titulo={f.title}
        formato={f.format}
        legenda={f.caption ?? undefined}
        roteiro={f.script ?? undefined}
      />
    </div>
  );
}

// ── Visão CALENDÁRIO dos posts (mês). Arrastar entre dias muda scheduled_date na hora.
// Conversa com o kanban: a mesma data aparece no card e aqui.
const CAL_WD = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];
function calYmd(d: Date) { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; }
function calMonday(d: Date) { const x = new Date(d); const wd = (x.getDay() + 6) % 7; x.setDate(x.getDate() - wd); x.setHours(0, 0, 0, 0); return x; }

function PostsCalendar({ posts, onOpen, onNewAt, onMove }: {
  posts: ExternalPost[];
  onOpen: (p: ExternalPost) => void;
  onNewAt: (day: string) => void;
  onMove: (id: string, day: string) => void;
}) {
  const [anchor, setAnchor] = useState(() => new Date());

  const days = (() => {
    const first = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
    const start = calMonday(first);
    const last = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0);
    const end = calMonday(last); end.setDate(end.getDate() + 6);
    const n = Math.round((end.getTime() - start.getTime()) / 86400000) + 1;
    return Array.from({ length: n }, (_, i) => { const d = new Date(start); d.setDate(d.getDate() + i); return d; });
  })();

  const byDay = new Map<string, ExternalPost[]>();
  const semData: ExternalPost[] = [];
  for (const p of posts) {
    if (!p.scheduled_date) { semData.push(p); continue; }
    const arr = byDay.get(p.scheduled_date) ?? [];
    arr.push(p); byDay.set(p.scheduled_date, arr);
  }

  const today = calYmd(new Date());
  const onDragEnd = (r: DropResult) => {
    if (!r.destination) return;
    const day = r.destination.droppableId;
    if (day === "sem-data" || day === r.source.droppableId) return;
    onMove(r.draggableId, day);
  };

  return (
    <DragDropContext onDragEnd={onDragEnd}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-1">
          <Button variant="outline" size="sm" className="h-8 w-8 p-0" onClick={() => setAnchor((a) => { const n = new Date(a); n.setMonth(n.getMonth() - 1); return n; })}>‹</Button>
          <span className="text-sm font-display font-bold text-foreground px-2 capitalize">{anchor.toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}</span>
          <Button variant="outline" size="sm" className="h-8 w-8 p-0" onClick={() => setAnchor((a) => { const n = new Date(a); n.setMonth(n.getMonth() + 1); return n; })}>›</Button>
          <Button variant="outline" size="sm" className="h-8 px-2 text-xs ml-1" onClick={() => setAnchor(new Date())}>Hoje</Button>
        </div>
      </div>

      <div className="hidden lg:grid lg:grid-cols-7 gap-2 mb-1">
        {CAL_WD.map((w) => <p key={w} className="text-[10px] uppercase tracking-wider font-body font-semibold text-muted-foreground text-center">{w}</p>)}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
        {days.map((d) => {
          const iso = calYmd(d);
          const list = byDay.get(iso) ?? [];
          const isToday = iso === today;
          const outMonth = d.getMonth() !== anchor.getMonth();
          return (
            <Droppable droppableId={iso} key={iso}>
              {(dropP, dropS) => (
                <div ref={dropP.innerRef} {...dropP.droppableProps}
                  className={`min-h-[104px] rounded-xl border p-2 flex flex-col gap-1.5 transition-colors
                    ${isToday ? "border-primary bg-primary/5 ring-1 ring-primary/20" : "border-border bg-background"}
                    ${outMonth ? "opacity-45" : ""}
                    ${dropS.isDraggingOver ? "ring-2 ring-primary/40 border-primary/60 bg-primary/5" : ""}`}>
                  <div className="flex items-center justify-between">
                    <span className={`text-sm font-display font-bold ${isToday ? "text-primary" : "text-foreground"}`}>{d.getDate()}</span>
                    <button onClick={() => onNewAt(iso)} className="text-muted-foreground hover:text-primary" aria-label="Novo post neste dia"><Plus className="h-3.5 w-3.5" /></button>
                  </div>
                  {list.map((p, idx) => {
                    const st = STATUS[(p.approval_status ?? "pendente") as ApprovalKey];
                    return (
                      <Draggable key={p.id} draggableId={p.id} index={idx}>
                        {(dragP, dragS) => (
                          <button ref={dragP.innerRef} {...dragP.draggableProps} {...dragP.dragHandleProps}
                            type="button" onClick={() => onOpen(p)}
                            className={`rounded-lg border border-border bg-card px-1.5 py-1 text-left hover:bg-muted/40 transition-colors ${dragS.isDragging ? "shadow-lg ring-2 ring-primary/40" : ""}`}>
                            <span className={`text-[9px] font-body font-bold px-1.5 py-0.5 rounded-full ${st?.cls ?? ""}`}>{st?.label ?? "Pendente"}</span>
                            <p className="text-[11px] font-body font-semibold text-foreground leading-tight truncate mt-0.5">{p.title}</p>
                            <p className="text-[9px] font-body text-muted-foreground uppercase">{cap(p.format)}</p>
                          </button>
                        )}
                      </Draggable>
                    );
                  })}
                  {dropP.placeholder}
                </div>
              )}
            </Droppable>
          );
        })}
      </div>

      {/* Posts ainda sem data: arraste pra um dia do calendário. */}
      {semData.length > 0 && (
        <div className="mt-4 rounded-xl border border-dashed border-border p-3">
          <p className="text-[11px] font-body font-semibold text-muted-foreground uppercase tracking-wider mb-2">Sem data ({semData.length}), arraste pra um dia</p>
          <Droppable droppableId="sem-data" direction="horizontal">
            {(dropP) => (
              <div ref={dropP.innerRef} {...dropP.droppableProps} className="flex gap-2 flex-wrap">
                {semData.map((p, idx) => (
                  <Draggable key={p.id} draggableId={p.id} index={idx}>
                    {(dragP, dragS) => (
                      <button ref={dragP.innerRef} {...dragP.draggableProps} {...dragP.dragHandleProps}
                        type="button" onClick={() => onOpen(p)}
                        className={`rounded-lg border border-border bg-card px-2 py-1.5 text-left hover:bg-muted/40 transition-colors ${dragS.isDragging ? "shadow-lg ring-2 ring-primary/40" : ""}`}>
                        <p className="text-[11px] font-body font-semibold text-foreground truncate max-w-[160px]">{p.title}</p>
                        <p className="text-[9px] font-body text-muted-foreground uppercase">{cap(p.format)}</p>
                      </button>
                    )}
                  </Draggable>
                ))}
                {dropP.placeholder}
              </div>
            )}
          </Droppable>
        </div>
      )}
    </DragDropContext>
  );
}
