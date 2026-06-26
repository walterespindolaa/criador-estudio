import { useState } from "react";
import { useExternalClients, useExternalPosts, type ExternalClient, type ExternalClientInput, type ExternalPost, type ExternalPostInput } from "@/hooks/useCriaPost";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { CronogramaBoard } from "@/components/accounts/CronogramaBoard";
import { DragDropContext, Droppable, Draggable, type DropResult } from "@hello-pangea/dnd";
import { Plus, Link2, Pencil, Loader2, Users, ArrowRight, ArrowLeft, Trash2, RotateCcw, FileText, Instagram } from "lucide-react";
import { CriaPostMedia } from "@/components/accounts/CriaPostMedia";
import { ClientReportDialog } from "@/components/accounts/ClientReportDialog";
import { useProfile } from "@/hooks/useProfile";
import { useCrmClients } from "@/hooks/useCrm";
import { useClientSocialConnection, connectInstagram } from "@/hooks/useSocialInsights";
import { FORMATS_BY_PLATFORM, FORMAT_LABELS } from "@/lib/constants";

const PLATFORMS = ["instagram", "tiktok", "youtube"];
const FORMATS = ["reels", "carrossel", "foto", "story", "video"];
export const CLIENT_COLORS = ["#8B5CF6", "#EC4899", "#F59E0B", "#10B981", "#3B82F6", "#EF4444", "#14B8A6", "#A855F7"];
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
function initial(n?: string | null) { return n ? n.trim().charAt(0).toUpperCase() : "?"; }
const STATUS: Record<string, { label: string; cls: string }> = {
  pendente: { label: "Aguardando cliente", cls: "bg-amber-100 text-amber-700" },
  ajuste_solicitado: { label: "Ajuste solicitado", cls: "bg-orange-100 text-orange-700" },
  aprovado: { label: "Aprovado", cls: "bg-green-100 text-green-700" },
};
const APPROVAL_COLS = ["pendente", "ajuste_solicitado", "aprovado"] as const;
type ApprovalKey = (typeof APPROVAL_COLS)[number];

export function CriaPostBoard() {
  const [client, setClient] = useState<ExternalClient | null>(null);
  return client ? <ClientDetail client={client} onBack={() => setClient(null)} /> : <ClientsList onOpen={setClient} />;
}

function ClientsList({ onOpen }: { onOpen: (c: ExternalClient) => void }) {
  const { clients, isLoading, pending, create, update, setActive, copyLink } = useExternalClients();
  const { data: crmClients = [] } = useCrmClients();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<ExternalClient | null>(null);
  const [f, setF] = useState<ExternalClientInput>({ name: "", instagram_handle: "", notes: "", color: CLIENT_COLORS[0], crm_client_id: null });
  const [copying, setCopying] = useState<string | null>(null);

  const openNew = () => { setEditing(null); setF({ name: "", instagram_handle: "", notes: "", color: CLIENT_COLORS[clients.length % CLIENT_COLORS.length], crm_client_id: null }); setFormOpen(true); };
  const openEdit = (c: ExternalClient) => { setEditing(c); setF({ name: c.name, instagram_handle: c.instagram_handle ?? "", notes: c.notes ?? "", color: c.color ?? CLIENT_COLORS[0], crm_client_id: c.crm_client_id ?? null }); setFormOpen(true); };
  const submit = async () => {
    if (!f.name.trim()) return;
    if (editing) await update.mutateAsync({ id: editing.id, ...f }); else await create.mutateAsync(f);
    setFormOpen(false);
  };
  const doCopy = async (id: string) => { setCopying(id); await copyLink(id); setCopying(null); };
  const activeClients = clients.filter((c) => c.active);

  return (
    <div>
      <div className="flex items-start justify-between gap-3 mb-5">
        <div><h1 className="text-2xl font-display font-extrabold text-foreground tracking-tight">Cria Post</h1>
          <p className="text-sm text-muted-foreground font-body mt-1">Clientes que não usam o Cria aprovam seus posts por um link.</p></div>
        <Button onClick={openNew} className="shrink-0"><Plus className="h-4 w-4 mr-1.5" /> Novo cliente</Button>
      </div>

      {isLoading ? (
        <div className="grid sm:grid-cols-2 gap-4">{[0, 1].map((i) => <div key={i} className="h-32 rounded-2xl bg-muted animate-pulse" />)}</div>
      ) : activeClients.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-10 text-center">
          <div className="w-12 h-12 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-3"><Users className="h-5 w-5 text-muted-foreground" /></div>
          <p className="text-sm font-body text-foreground font-medium">Nenhum cliente externo ainda</p>
          <p className="text-xs text-muted-foreground font-body mt-1">Crie um cliente, monte os posts e mande o link de aprovação.</p>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 gap-4">
          {activeClients.map((c) => (
            <div key={c.id} className="bg-card border border-border rounded-2xl p-5">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-primary via-purple-600 to-pink-500 p-[2px] shrink-0 overflow-hidden">
                  <div className="w-full h-full rounded-2xl bg-card flex items-center justify-center overflow-hidden">
                    {c.logo_url ? <img src={c.logo_url} alt="" className="w-full h-full object-cover" /> : <span className="font-display font-extrabold text-primary">{initial(c.name)}</span>}
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-display font-bold text-foreground truncate">{c.name}</p>
                  {c.instagram_handle && <p className="text-xs text-muted-foreground font-body truncate">@{c.instagram_handle.replace(/^@/, "")}</p>}
                </div>
                {(pending[c.id] ?? 0) > 0 && <span className="text-[11px] font-body font-bold text-amber-700 bg-amber-100 px-2 py-1 rounded-full shrink-0">{pending[c.id]} aguardando</span>}
              </div>
              <div className="flex items-center gap-2 mt-4">
                <Button className="flex-1" onClick={() => onOpen(c)}>Abrir posts <ArrowRight className="h-3.5 w-3.5 ml-1" /></Button>
                <Button variant="outline" onClick={() => doCopy(c.id)} disabled={copying === c.id} aria-label="Copiar link">{copying === c.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2 className="h-4 w-4" />}</Button>
                <Button variant="outline" onClick={() => openEdit(c)} aria-label="Editar"><Pencil className="h-4 w-4" /></Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent onOpenAutoFocus={(e) => e.preventDefault()} className="max-w-md rounded-2xl">
          <DialogHeader><DialogTitle className="font-display">{editing ? "Editar cliente" : "Novo cliente"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-body">Cadastro central</Label>
              <select
                value={f.crm_client_id ?? ""}
                onChange={(e) => {
                  const id = e.target.value || null;
                  const c = id ? crmClients.find((x) => x.id === id) : null;
                  setF((p) => ({
                    ...p,
                    crm_client_id: id,
                    ...(c ? { name: c.name, instagram_handle: c.instagram ?? "", notes: c.notes ?? "" } : {}),
                  }));
                }}
                className="w-full rounded-xl border border-border bg-card px-3 py-2 text-sm"
              >
                <option value="">Criar novo cliente central</option>
                {crmClients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <p className="text-[11px] text-muted-foreground font-body">Vincule a um cliente que já existe no Gestão/Caixa (puxa os dados) ou deixe "Criar novo". Assim o mesmo cliente fica em todos os módulos.</p>
            </div>
            <div className="space-y-1.5"><Label className="text-xs font-body">Nome *</Label><Input value={f.name} onChange={(e) => setF((p) => ({ ...p, name: e.target.value }))} className="rounded-xl" /></div>
            <div className="space-y-1.5"><Label className="text-xs font-body">@ do Instagram</Label><Input value={f.instagram_handle ?? ""} onChange={(e) => setF((p) => ({ ...p, instagram_handle: e.target.value }))} placeholder="@cliente" className="rounded-xl" /></div>
            <div className="space-y-1.5"><Label className="text-xs font-body">Notas (interno)</Label><Textarea value={f.notes ?? ""} onChange={(e) => setF((p) => ({ ...p, notes: e.target.value }))} rows={2} className="rounded-xl" /></div>
            <div className="space-y-1.5">
              <Label className="text-xs font-body">Cor (calendário)</Label>
              <div className="flex flex-wrap gap-2">
                {CLIENT_COLORS.map((c) => (
                  <button key={c} type="button" onClick={() => setF((p) => ({ ...p, color: c }))}
                    className={`h-7 w-7 rounded-full transition-transform ${f.color === c ? "ring-2 ring-offset-2 ring-foreground scale-110" : "hover:scale-105"}`}
                    style={{ backgroundColor: c }} aria-label={`Cor ${c}`} />
                ))}
              </div>
            </div>
          </div>
          <DialogFooter className="mt-4 sm:justify-between">
            {editing && <Button variant="ghost" className="text-destructive mr-auto" onClick={async () => { await setActive.mutateAsync({ id: editing.id, active: false }); setFormOpen(false); }}>Desativar</Button>}
            <div className="flex gap-2 ml-auto">
              <Button variant="outline" onClick={() => setFormOpen(false)}>Cancelar</Button>
              <Button onClick={submit} disabled={create.isPending || update.isPending || !f.name.trim()}>{(create.isPending || update.isPending) ? <Loader2 className="h-4 w-4 animate-spin" /> : "Salvar"}</Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ClientDetail({ client, onBack }: { client: ExternalClient; onBack: () => void }) {
  const { posts, isLoading, create, update, remove, moveStatus } = useExternalPosts(client.id);
  const { copyLink } = useExternalClients();
  const { profile } = useProfile();
  const [confirmMove, setConfirmMove] = useState<{ id: string; status: ApprovalKey } | null>(null);

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
  const hasCriaAccount = !!crmClients.find((c) => c.id === client.crm_client_id)?.cria_owner_id;
  const { data: igConn } = useClientSocialConnection(client.crm_client_id);
  const [formOpen, setFormOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [editing, setEditing] = useState<ExternalPost | null>(null);
  const [f, setF] = useState<ExternalPostInput>({ title: "", platform: "instagram", format: "reels", caption: "", hook: "", approval_mode: "fast", script: "" });
  const [copying, setCopying] = useState(false);

  const openNew = () => { setEditing(null); setF({ title: "", platform: "instagram", format: "reels", caption: "", hook: "", approval_mode: "fast", script: "" }); setFormOpen(true); };
  const openEdit = (p: ExternalPost) => { setEditing(p); setF({ title: p.title, platform: p.platform, format: p.format, caption: p.caption ?? "", hook: p.hook ?? "", approval_mode: (p.approval_mode as "fast"|"flow"|"both") ?? "fast", script: p.script ?? "" }); setFormOpen(true); };
  const submit = async () => {
    if (!f.title.trim()) return;
    if (editing) await update.mutateAsync({ id: editing.id, resend: editing.approval_status === "ajuste_solicitado", ...f });
    else await create.mutateAsync(f);
    setFormOpen(false);
  };
  const doCopy = async () => { setCopying(true); await copyLink(client.id); setCopying(false); };
  const onChangePlatform = (pl: string) => {
    setF((prev) => {
      const allowed = FORMATS_BY_PLATFORM[pl] ?? [];
      const format = allowed.length && !allowed.includes(prev.format) ? allowed[0] : prev.format;
      return { ...prev, platform: pl, format };
    });
  };

  return (
    <div>
      <button onClick={onBack} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground font-body mb-4"><ArrowLeft className="h-4 w-4" /> Clientes</button>
      <div className="flex items-start justify-between gap-3 mb-5">
        <div className="min-w-0">
          <h1 className="text-2xl font-display font-extrabold text-foreground tracking-tight truncate">{client.name}</h1>
          {client.instagram_handle && <p className="text-sm text-muted-foreground font-body">@{client.instagram_handle.replace(/^@/, "")}</p>}
        </div>
        <div className="flex gap-2 shrink-0">
          <Button variant="outline" onClick={doCopy} disabled={copying}>{copying ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Link2 className="h-4 w-4 sm:mr-1.5" /> <span className="hidden sm:inline">Copiar link</span></>}</Button>
        </div>
      </div>

      <ClientReportDialog open={reportOpen} onOpenChange={setReportOpen} client={client} posts={posts} managerName={profile?.name ?? undefined} />

      <Tabs defaultValue="posts" className="w-full">
        <TabsList className="bg-card border border-border rounded-2xl p-1.5 mb-5 flex flex-wrap h-auto gap-1">
          <TabsTrigger value="posts" className="rounded-xl data-[state=active]:bg-primary/10 data-[state=active]:text-primary">Posts</TabsTrigger>
          <TabsTrigger value="cronograma" className="rounded-xl data-[state=active]:bg-primary/10 data-[state=active]:text-primary">Cronograma</TabsTrigger>
          <TabsTrigger value="relatorio" className="rounded-xl data-[state=active]:bg-primary/10 data-[state=active]:text-primary">Relatório</TabsTrigger>
          <TabsTrigger value="instagram" className="rounded-xl data-[state=active]:bg-primary/10 data-[state=active]:text-primary">Instagram</TabsTrigger>
        </TabsList>

        <TabsContent value="posts">
          <div className="flex justify-end mb-3">
            <Button onClick={openNew}><Plus className="h-4 w-4 mr-1.5" /> Novo post</Button>
          </div>
      {isLoading ? (
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
                            {p.caption && <p className="text-xs text-muted-foreground font-body line-clamp-2 mt-0.5">{p.caption}</p>}
                            {p.approval_status === "ajuste_solicitado" && p.last_comment && p.last_comment_role === "cliente_externo" && (
                              <div className="mt-2 text-xs font-body text-orange-700 bg-orange-50 border border-orange-100 rounded-lg px-2.5 py-1.5">Cliente pediu: "{p.last_comment}"</div>
                            )}
                            <span className="inline-block mt-2 text-[9px] font-body font-bold px-1.5 py-0.5 rounded-full bg-primary/10 text-primary">{p.approval_mode === "flow" ? "Detalhada" : p.approval_mode === "both" ? "Ambas" : "Simplificada"}</span>
                          </div>
                          <div className="flex flex-col gap-1 shrink-0">
                            <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => openEdit(p)} aria-label="Editar"><Pencil className="h-3.5 w-3.5" /></Button>
                            <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive" onClick={() => remove.mutate(p.id)} aria-label="Excluir"><Trash2 className="h-3.5 w-3.5" /></Button>
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
            <p className="text-xs text-muted-foreground font-body mb-4">Produção, desempenho do Instagram e análise da IA — pronto pra enviar em PDF.</p>
            <Button onClick={() => setReportOpen(true)}><FileText className="h-4 w-4 mr-1.5" /> Abrir relatório</Button>
          </div>
        </TabsContent>

        <TabsContent value="instagram">
          <div className="rounded-2xl border border-border bg-card p-6 space-y-3">
            {client.crm_client_id && hasCriaAccount ? (
              <div className="flex items-center gap-2 text-green-700"><Instagram className="h-5 w-5" /> <span className="font-body text-sm font-medium">Os insights vêm do Instagram conectado pelo próprio cliente na conta CRIA dele.</span></div>
            ) : client.crm_client_id ? (
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

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent onOpenAutoFocus={(e) => e.preventDefault()} className="max-w-md md:max-w-4xl bg-white rounded-2xl max-h-[88vh] overflow-y-auto">
          <DialogHeader><DialogTitle className="font-display">{editing ? "Editar post" : "Novo post"}</DialogTitle></DialogHeader>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-[1.1fr_0.9fr] md:gap-5">

            {/* 1 — Título */}
            <div className="order-1 md:col-start-1 md:row-start-1 space-y-1.5">
              <Label className="text-xs font-body">Título *</Label>
              <Input value={f.title} onChange={(e) => setF((p) => ({ ...p, title: e.target.value }))} className="rounded-xl" />
            </div>

            {/* 2 — Plataforma + Formato */}
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

            {/* 3 — Tipo de aprovação */}
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

            {/* 4 — Mídia (direita no desktop, posição 4 no mobile) */}
            <div className="order-4 md:col-start-2 md:row-start-1 md:row-span-5">
              <label className="text-xs font-semibold mb-1.5 block">Mídia</label>
              {editing?.id ? (
                <CriaPostMedia postId={editing.id} platform={f.platform} format={f.format}
                  caption={f.caption ?? undefined} handle={client.instagram_handle || client.name}
                  approved={editing.approval_status === "aprovado"} />
              ) : (
                <p className="text-xs text-muted-foreground">Salve o post primeiro para anexar mídia.</p>
              )}
            </div>

            {/* 5 — Legenda */}
            <div className="order-5 md:col-start-1 md:row-start-4 space-y-1.5">
              <Label className="text-xs font-body">Legenda</Label>
              <Textarea value={f.caption ?? ""} onChange={(e) => setF((p) => ({ ...p, caption: e.target.value }))} rows={4} className="rounded-xl" />
            </div>

            {/* 6 — Roteiro / conteúdo */}
            {f.approval_mode !== "fast" && (
              <div className="order-6 md:col-start-1 md:row-start-5 space-y-1.5">
                <Label className="text-xs font-body">Roteiro / conteúdo (etapa "Conteúdo")</Label>
                <Textarea value={f.script ?? ""} onChange={(e) => setF((p) => ({ ...p, script: e.target.value }))} rows={4} className="rounded-xl" />
              </div>
            )}
          </div>
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setFormOpen(false)}>Cancelar</Button>
            <Button onClick={submit} disabled={create.isPending || update.isPending || !f.title.trim()}>{(create.isPending || update.isPending) ? <Loader2 className="h-4 w-4 animate-spin" /> : editing ? (editing.approval_status === "ajuste_solicitado" ? <><RotateCcw className="h-4 w-4 mr-1.5" /> Salvar e reenviar</> : "Salvar") : "Criar e enviar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
