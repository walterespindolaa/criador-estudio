import { useState } from "react";
import { useExternalClients, useExternalPosts, type ExternalClient, type ExternalClientInput, type ExternalPost, type ExternalPostInput } from "@/hooks/useCriaPost";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Plus, Link2, Pencil, Loader2, Users, ArrowRight, ArrowLeft, Trash2, RotateCcw } from "lucide-react";

const PLATFORMS = ["instagram", "tiktok", "youtube"];
const FORMATS = ["reels", "carrossel", "foto", "story", "video"];
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
function initial(n?: string | null) { return n ? n.trim().charAt(0).toUpperCase() : "?"; }
const STATUS: Record<string, { label: string; cls: string }> = {
  pendente: { label: "Aguardando cliente", cls: "bg-amber-100 text-amber-700" },
  ajuste_solicitado: { label: "Ajuste solicitado", cls: "bg-orange-100 text-orange-700" },
  aprovado: { label: "Aprovado", cls: "bg-green-100 text-green-700" },
};

export function CriaPostBoard() {
  const [client, setClient] = useState<ExternalClient | null>(null);
  return client ? <ClientDetail client={client} onBack={() => setClient(null)} /> : <ClientsList onOpen={setClient} />;
}

function ClientsList({ onOpen }: { onOpen: (c: ExternalClient) => void }) {
  const { clients, isLoading, pending, create, update, setActive, copyLink } = useExternalClients();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<ExternalClient | null>(null);
  const [f, setF] = useState<ExternalClientInput>({ name: "", instagram_handle: "", notes: "" });
  const [copying, setCopying] = useState<string | null>(null);

  const openNew = () => { setEditing(null); setF({ name: "", instagram_handle: "", notes: "" }); setFormOpen(true); };
  const openEdit = (c: ExternalClient) => { setEditing(c); setF({ name: c.name, instagram_handle: c.instagram_handle ?? "", notes: c.notes ?? "" }); setFormOpen(true); };
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
        <DialogContent className="max-w-md rounded-2xl">
          <DialogHeader><DialogTitle className="font-display">{editing ? "Editar cliente" : "Novo cliente"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5"><Label className="text-xs font-body">Nome *</Label><Input value={f.name} onChange={(e) => setF((p) => ({ ...p, name: e.target.value }))} className="rounded-xl" /></div>
            <div className="space-y-1.5"><Label className="text-xs font-body">@ do Instagram</Label><Input value={f.instagram_handle ?? ""} onChange={(e) => setF((p) => ({ ...p, instagram_handle: e.target.value }))} placeholder="@cliente" className="rounded-xl" /></div>
            <div className="space-y-1.5"><Label className="text-xs font-body">Notas (interno)</Label><Textarea value={f.notes ?? ""} onChange={(e) => setF((p) => ({ ...p, notes: e.target.value }))} rows={2} className="rounded-xl" /></div>
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
  const { posts, isLoading, create, update, remove } = useExternalPosts(client.id);
  const { copyLink } = useExternalClients();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<ExternalPost | null>(null);
  const [f, setF] = useState<ExternalPostInput>({ title: "", platform: "instagram", format: "reels", caption: "", hook: "" });
  const [copying, setCopying] = useState(false);

  const openNew = () => { setEditing(null); setF({ title: "", platform: "instagram", format: "reels", caption: "", hook: "" }); setFormOpen(true); };
  const openEdit = (p: ExternalPost) => { setEditing(p); setF({ title: p.title, platform: p.platform, format: p.format, caption: p.caption ?? "", hook: p.hook ?? "" }); setFormOpen(true); };
  const submit = async () => {
    if (!f.title.trim()) return;
    if (editing) await update.mutateAsync({ id: editing.id, resend: editing.approval_status === "ajuste_solicitado", ...f });
    else await create.mutateAsync(f);
    setFormOpen(false);
  };
  const doCopy = async () => { setCopying(true); await copyLink(client.id); setCopying(false); };

  return (
    <div>
      <button onClick={onBack} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground font-body mb-4"><ArrowLeft className="h-4 w-4" /> Clientes</button>
      <div className="flex items-start justify-between gap-3 mb-5">
        <div className="min-w-0">
          <h1 className="text-2xl font-display font-extrabold text-foreground tracking-tight truncate">{client.name}</h1>
          {client.instagram_handle && <p className="text-sm text-muted-foreground font-body">@{client.instagram_handle.replace(/^@/, "")}</p>}
        </div>
        <div className="flex gap-2 shrink-0">
          <Button variant="outline" onClick={doCopy} disabled={copying}>{copying ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Link2 className="h-4 w-4 mr-1.5" /> Copiar link</>}</Button>
          <Button onClick={openNew}><Plus className="h-4 w-4 mr-1.5" /> Novo post</Button>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-3">{[0, 1].map((i) => <div key={i} className="h-20 rounded-2xl bg-muted animate-pulse" />)}</div>
      ) : posts.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-10 text-center">
          <p className="text-sm font-body text-foreground font-medium">Nenhum post ainda</p>
          <p className="text-xs text-muted-foreground font-body mt-1">Crie um post e ele já entra na fila de aprovação do cliente.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {posts.map((p) => {
            const st = STATUS[p.approval_status ?? "pendente"] ?? STATUS.pendente;
            return (
              <div key={p.id} className="bg-card border border-border rounded-2xl p-4">
                <div className="flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[10px] font-body font-semibold text-muted-foreground uppercase tracking-wide">{cap(p.format)} · {cap(p.platform)}</span>
                      <span className={`text-[10px] font-body font-bold px-2 py-0.5 rounded-full ${st.cls}`}>{st.label}</span>
                    </div>
                    <p className="font-display font-bold text-foreground truncate mt-1">{p.title}</p>
                    {p.caption && <p className="text-xs text-muted-foreground font-body line-clamp-2 mt-0.5">{p.caption}</p>}
                    {p.approval_status === "ajuste_solicitado" && p.last_comment && p.last_comment_role === "cliente_externo" && (
                      <div className="mt-2 text-xs font-body text-orange-700 bg-orange-50 border border-orange-100 rounded-lg px-2.5 py-1.5">Cliente pediu: "{p.last_comment}"</div>
                    )}
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <Button variant="ghost" size="sm" onClick={() => openEdit(p)} aria-label="Editar"><Pencil className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="sm" className="text-destructive" onClick={() => remove.mutate(p.id)} aria-label="Excluir"><Trash2 className="h-4 w-4" /></Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-w-md rounded-2xl max-h-[88vh] overflow-y-auto">
          <DialogHeader><DialogTitle className="font-display">{editing ? "Editar post" : "Novo post"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5"><Label className="text-xs font-body">Título *</Label><Input value={f.title} onChange={(e) => setF((p) => ({ ...p, title: e.target.value }))} className="rounded-xl" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label className="text-xs font-body">Plataforma</Label>
                <div className="flex flex-wrap gap-1.5">{PLATFORMS.map((pl) => <button key={pl} type="button" onClick={() => setF((p) => ({ ...p, platform: pl }))} className={`px-2.5 py-1 rounded-lg text-xs font-body border ${f.platform === pl ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground"}`}>{cap(pl)}</button>)}</div>
              </div>
              <div className="space-y-1.5"><Label className="text-xs font-body">Formato</Label>
                <div className="flex flex-wrap gap-1.5">{FORMATS.map((ft) => <button key={ft} type="button" onClick={() => setF((p) => ({ ...p, format: ft }))} className={`px-2.5 py-1 rounded-lg text-xs font-body border ${f.format === ft ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground"}`}>{cap(ft)}</button>)}</div>
              </div>
            </div>
            <div className="space-y-1.5"><Label className="text-xs font-body">Legenda</Label><Textarea value={f.caption ?? ""} onChange={(e) => setF((p) => ({ ...p, caption: e.target.value }))} rows={4} className="rounded-xl" /></div>
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
