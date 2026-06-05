import { useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Download, Search, Building2, Instagram, DollarSign, Trash2, ArrowRight, X, ImagePlus, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { useActiveAccount } from "@/contexts/AccountContext";
import {
  useCrmClients, useCreateCrmClient, useUpdateCrmClient, useDeleteCrmClient,
  useImportCriaClients, useCrmClientRefs, useAddCrmRef, useDeleteCrmRef, type CrmClient,
} from "@/hooks/useCrm";
import { ModuleGate } from "@/components/accounts/ModuleGate";
import { ManagerSectionTitle } from "@/components/accounts/ManagerSectionTitle";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PipelineBoard } from "@/components/accounts/crm/PipelineBoard";
import { ContractsTab } from "@/components/accounts/crm/ContractsTab";
import { cn } from "@/lib/utils";

const BRAND_FIELDS: { key: string; label: string; multiline?: boolean }[] = [
  { key: "archetype", label: "Arquétipo da marca" },
  { key: "personality", label: "Personalidade", multiline: true },
  { key: "toneOfVoice", label: "Tom de voz" },
  { key: "communicationStyle", label: "Estilo de comunicação", multiline: true },
  { key: "colorPalette", label: "Paleta de cores" },
  { key: "typography", label: "Tipografia" },
  { key: "visualExpression", label: "Expressão visual", multiline: true },
];
const brl = (v?: number | null) => `R$ ${Number(v ?? 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;
function initial(name?: string | null) { return name ? name.trim().charAt(0).toUpperCase() : "?"; }

export default function CriaCrm() {
  return <ModuleGate code="crm"><CrmInner /></ModuleGate>;
}

function CrmInner() {
  return (
    <div>
      <ManagerSectionTitle t="Cria Gestão" s="Carteira, pipeline e contratos da sua operação." />
      <Tabs defaultValue="clientes" className="w-full">
        <TabsList className="bg-card border border-border rounded-2xl p-1.5 mb-5">
          <TabsTrigger value="clientes" className="rounded-xl data-[state=active]:bg-primary/10 data-[state=active]:text-primary">Clientes</TabsTrigger>
          <TabsTrigger value="pipeline" className="rounded-xl data-[state=active]:bg-primary/10 data-[state=active]:text-primary">Pipeline</TabsTrigger>
          <TabsTrigger value="contratos" className="rounded-xl data-[state=active]:bg-primary/10 data-[state=active]:text-primary">Contratos</TabsTrigger>
        </TabsList>
        <TabsContent value="clientes"><ClientsTab /></TabsContent>
        <TabsContent value="pipeline"><PipelineBoard /></TabsContent>
        <TabsContent value="contratos"><ContractsTab /></TabsContent>
      </Tabs>
    </div>
  );
}

function ClientsTab() {
  const navigate = useNavigate();
  const { managedAccounts, setActiveAccount } = useActiveAccount();
  const { data: clients = [], isLoading } = useCrmClients();
  const importCria = useImportCriaClients();
  const createClient = useCreateCrmClient();
  const delClient = useDeleteCrmClient();

  const [search, setSearch] = useState("");
  const [segFilter, setSegFilter] = useState<string | null>(null);
  const [editing, setEditing] = useState<CrmClient | null>(null);
  const [creating, setCreating] = useState(false);

  // avatar dos clientes importados do cria
  const criaAvatar = useMemo(() => {
    const m = new Map<string, string | null>();
    managedAccounts.forEach((a) => m.set(a.owner_id, a.avatar_url));
    return m;
  }, [managedAccounts]);

  const segments = useMemo(() => Array.from(new Set(clients.map((c) => c.segment).filter(Boolean))) as string[], [clients]);
  const filtered = clients.filter((c) => {
    const q = search.trim().toLowerCase();
    const okQ = !q || c.name.toLowerCase().includes(q) || (c.instagram ?? "").toLowerCase().includes(q);
    const okS = !segFilter || c.segment === segFilter;
    return okQ && okS;
  });

  const openCria = (c: CrmClient) => { if (c.cria_owner_id) { setActiveAccount(c.cria_owner_id); navigate("/app"); } };

  return (
    <div>
      <div className="flex items-center justify-end gap-2 mb-4">
        <Button variant="outline" size="sm" onClick={() => importCria.mutate()} disabled={importCria.isPending || managedAccounts.length === 0}>
          <Download className="h-3.5 w-3.5 mr-1.5" /> Importar do cria
        </Button>
        <Button size="sm" onClick={() => setCreating(true)}><Plus className="h-3.5 w-3.5 mr-1.5" /> Novo cliente</Button>
      </div>

      <div className="flex items-center gap-2 mb-4 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="h-4 w-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
          <Input placeholder="Buscar cliente..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 rounded-xl" />
        </div>
        {segments.length > 0 && (
          <div className="flex items-center gap-1.5 flex-wrap">
            <button onClick={() => setSegFilter(null)} className={cn("px-3 py-1.5 rounded-full text-xs font-body font-bold border", !segFilter ? "bg-foreground text-background border-foreground" : "bg-card border-border text-muted-foreground")}>Todos</button>
            {segments.map((s) => (
              <button key={s} onClick={() => setSegFilter(s)} className={cn("px-3 py-1.5 rounded-full text-xs font-body font-bold border", segFilter === s ? "bg-foreground text-background border-foreground" : "bg-card border-border text-muted-foreground")}>{s}</button>
            ))}
          </div>
        )}
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">{[1, 2, 3, 4].map((i) => <div key={i} className="h-32 rounded-2xl bg-muted animate-pulse" />)}</div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-10 text-center">
          <div className="w-12 h-12 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-3"><Building2 className="h-5 w-5 text-muted-foreground" /></div>
          <p className="text-sm font-body text-foreground font-medium">Nenhum cliente ainda</p>
          <p className="text-xs text-muted-foreground font-body mt-1">Crie um cliente ou importe os que você já gerencia no cria.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {filtered.map((c) => {
            const avatar = c.cria_owner_id ? criaAvatar.get(c.cria_owner_id) : null;
            return (
              <div key={c.id} className="group rounded-2xl border border-border bg-card p-5 flex flex-col gap-3 hover:shadow-md hover:border-primary/40 transition-all cursor-pointer" onClick={() => setEditing(c)}>
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-primary via-purple-600 to-pink-500 p-[2px] shrink-0 overflow-hidden">
                    <div className="w-full h-full rounded-2xl bg-card flex items-center justify-center overflow-hidden">
                      {avatar ? <img src={avatar} alt="" className="w-full h-full object-cover" loading="lazy" /> : <span className="text-lg font-display font-extrabold text-primary">{c.logo && c.logo.length <= 2 ? c.logo : initial(c.name)}</span>}
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <p className="text-base font-display font-bold text-foreground truncate">{c.name}</p>
                      {c.cria_owner_id && <Badge variant="secondary" className="text-[9px] h-4 px-1.5 shrink-0">cria</Badge>}
                    </div>
                    {c.instagram && <p className="text-xs text-muted-foreground font-body truncate flex items-center gap-1"><Instagram className="h-3 w-3" />{c.instagram.replace(/^@/, "")}</p>}
                    {c.segment && <p className="text-[11px] text-muted-foreground font-body truncate">{c.segment}</p>}
                  </div>
                </div>
                {Number(c.monthly_value) > 0 && <div className="flex items-center gap-1 text-xs font-semibold text-primary"><DollarSign className="h-3 w-3" />{brl(c.monthly_value)}/mês</div>}
                {c.cria_owner_id && (
                  <Button variant="outline" size="sm" className="w-full" onClick={(e) => { e.stopPropagation(); openCria(c); }}>
                    Abrir no cria <ArrowRight className="h-3.5 w-3.5 ml-1" />
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* NOVO CLIENTE */}
      <CreateClientDialog
        open={creating}
        onOpenChange={setCreating}
        onCreate={async (input) => { const c = await createClient.mutateAsync(input); setCreating(false); setEditing(c); }}
        saving={createClient.isPending}
      />

      {/* EDITAR CLIENTE (cadastro + brand core + moodboard) */}
      <EditClientDialog
        client={editing}
        onClose={() => setEditing(null)}
        onDelete={async (id) => { if (confirm("Excluir este cliente?")) { await delClient.mutateAsync(id); setEditing(null); } }}
      />
    </div>
  );
}

function CreateClientDialog({ open, onOpenChange, onCreate, saving }: {
  open: boolean; onOpenChange: (o: boolean) => void;
  onCreate: (input: { name: string; instagram?: string; segment?: string; monthly_value?: number }) => void; saving: boolean;
}) {
  const [name, setName] = useState(""); const [instagram, setInstagram] = useState("");
  const [segment, setSegment] = useState(""); const [value, setValue] = useState("");
  const reset = () => { setName(""); setInstagram(""); setSegment(""); setValue(""); };
  return (
    <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) reset(); }}>
      <DialogContent className="sm:max-w-md rounded-2xl">
        <DialogHeader><DialogTitle className="font-display">Novo cliente</DialogTitle></DialogHeader>
        <div className="space-y-3 mt-2">
          <div className="space-y-1.5"><Label className="text-xs">Nome *</Label><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Café Aroma" className="rounded-xl" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label className="text-xs">Instagram</Label><Input value={instagram} onChange={(e) => setInstagram(e.target.value)} placeholder="@empresa" className="rounded-xl" /></div>
            <div className="space-y-1.5"><Label className="text-xs">Segmento</Label><Input value={segment} onChange={(e) => setSegment(e.target.value)} placeholder="Ex: Gastronomia" className="rounded-xl" /></div>
          </div>
          <div className="space-y-1.5"><Label className="text-xs">Valor mensal (R$)</Label><Input type="number" value={value} onChange={(e) => setValue(e.target.value)} placeholder="0" className="rounded-xl" /></div>
        </div>
        <div className="flex justify-end gap-2 mt-5">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button disabled={!name.trim() || saving} onClick={() => onCreate({ name: name.trim(), instagram: instagram.trim() || undefined, segment: segment.trim() || undefined, monthly_value: Number(value) || 0 })}>Criar</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function EditClientDialog({ client, onClose, onDelete }: { client: CrmClient | null; onClose: () => void; onDelete: (id: string) => void; }) {
  const update = useUpdateCrmClient();
  const { data: refs = [] } = useCrmClientRefs(client?.id ?? null);
  const addRef = useAddCrmRef(); const delRef = useDeleteCrmRef();
  const fileRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState<CrmClient | null>(client);
  // sincroniza quando troca de cliente
  if (client && (!form || form.id !== client.id)) setForm(client);

  if (!client || !form) return null;
  const isCria = !!client.cria_owner_id;
  const bc = form.brand_core ?? {};

  const save = async () => {
    await update.mutateAsync({
      id: form.id, name: form.name, instagram: form.instagram, email: form.email, phone: form.phone,
      segment: form.segment, monthly_value: form.monthly_value, contract_date: form.contract_date,
      renewal_date: form.renewal_date, notes: form.notes, brand_core: bc,
    });
    toast.success("Cliente salvo!");
    onClose();
  };
  const onPickFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; e.target.value = "";
    if (file) await addRef.mutateAsync({ crmClientId: form.id, file });
  };

  return (
    <Dialog open={!!client} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="sm:max-w-2xl max-h-[88vh] overflow-y-auto rounded-2xl">
        <DialogHeader>
          <DialogTitle className="font-display flex items-center gap-2">{form.name}{isCria && <Badge variant="secondary" className="text-[9px] h-4">cria</Badge>}</DialogTitle>
        </DialogHeader>

        <div className="space-y-5 mt-2">
          {/* Dados */}
          <section className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Dados</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="Nome"><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="rounded-xl" /></Field>
              <Field label="Segmento"><Input value={form.segment ?? ""} onChange={(e) => setForm({ ...form, segment: e.target.value })} className="rounded-xl" /></Field>
              <Field label="Instagram"><Input value={form.instagram ?? ""} onChange={(e) => setForm({ ...form, instagram: e.target.value })} className="rounded-xl" /></Field>
              <Field label="Telefone"><Input value={form.phone ?? ""} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="rounded-xl" /></Field>
              <Field label="E-mail"><Input value={form.email ?? ""} onChange={(e) => setForm({ ...form, email: e.target.value })} className="rounded-xl" /></Field>
              <Field label="Valor mensal (R$)"><Input type="number" value={form.monthly_value ?? 0} onChange={(e) => setForm({ ...form, monthly_value: Number(e.target.value) })} className="rounded-xl" /></Field>
              <Field label="Início do contrato"><Input type="date" value={form.contract_date ?? ""} onChange={(e) => setForm({ ...form, contract_date: e.target.value || null })} className="rounded-xl" /></Field>
              <Field label="Renovação"><Input type="date" value={form.renewal_date ?? ""} onChange={(e) => setForm({ ...form, renewal_date: e.target.value || null })} className="rounded-xl" /></Field>
            </div>
          </section>

          {isCria && (
            <div className="rounded-xl border border-primary/20 bg-primary/5 px-4 py-3 text-xs font-body text-foreground flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary shrink-0" /> Brandbook, ideias e conteúdo deste cliente ficam no cria. Use “Abrir no cria” no card.
            </div>
          )}

          {/* Brand core (só faz sentido editar aqui pra cliente externo) */}
          {!isCria && (
            <section className="space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Brand core</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {BRAND_FIELDS.map((f) => (
                  <Field key={f.key} label={f.label} full={f.multiline}>
                    {f.multiline
                      ? <Textarea rows={2} value={bc[f.key] ?? ""} onChange={(e) => setForm({ ...form, brand_core: { ...bc, [f.key]: e.target.value } })} className="rounded-xl text-sm" />
                      : <Input value={bc[f.key] ?? ""} onChange={(e) => setForm({ ...form, brand_core: { ...bc, [f.key]: e.target.value } })} className="rounded-xl" />}
                  </Field>
                ))}
              </div>
            </section>
          )}

          {/* Moodboard */}
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Moodboard</h3>
              <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()} disabled={addRef.isPending}><ImagePlus className="h-3.5 w-3.5 mr-1.5" /> Adicionar</Button>
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onPickFile} />
            </div>
            {refs.length === 0 ? (
              <p className="text-xs text-muted-foreground font-body">Nenhuma referência ainda.</p>
            ) : (
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                {refs.map((r) => (
                  <div key={r.id} className="relative group aspect-square rounded-xl overflow-hidden border border-border">
                    <img src={r.image_url} alt="" className="w-full h-full object-cover" loading="lazy" />
                    <button onClick={() => delRef.mutate(r)} className="absolute top-1 right-1 w-6 h-6 rounded-full bg-black/60 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"><X className="h-3.5 w-3.5" /></button>
                  </div>
                ))}
              </div>
            )}
          </section>

          <div className="space-y-1.5"><Label className="text-xs">Notas</Label><Textarea rows={2} value={form.notes ?? ""} onChange={(e) => setForm({ ...form, notes: e.target.value })} className="rounded-xl text-sm" /></div>
        </div>

        <div className="flex items-center justify-between gap-2 mt-6">
          <Button variant="ghost" className="text-destructive hover:text-destructive" onClick={() => onDelete(form.id)}><Trash2 className="h-4 w-4 mr-1.5" /> Excluir</Button>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>Fechar</Button>
            <Button onClick={save} disabled={update.isPending}>Salvar</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, children, full }: { label: string; children: React.ReactNode; full?: boolean }) {
  return <div className={cn("space-y-1.5", full && "sm:col-span-2")}><Label className="text-xs">{label}</Label>{children}</div>;
}
