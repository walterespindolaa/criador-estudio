import { useMemo, useState } from "react";
import { useNavigate, useLocation, Navigate } from "react-router-dom";
import { Plus, Download, Search, Building2, Instagram, DollarSign, ArrowRight, SlidersHorizontal, X } from "lucide-react";
import { useActiveAccount } from "@/contexts/AccountContext";
import {
  useCrmClients, useCreateCrmClient, useImportCriaClients, type CrmClient,
} from "@/hooks/useCrm";
import { ModuleGate } from "@/components/accounts/ModuleGate";
import { ManagerSectionTitle } from "@/components/accounts/ManagerSectionTitle";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { PipelineBoard } from "@/components/accounts/crm/PipelineBoard";
import { ContractsTab } from "@/components/accounts/crm/ContractsTab";
import { TasksTab } from "@/components/accounts/crm/TasksTab";
import { CrmCalendarTab } from "@/components/accounts/crm/CrmCalendarTab";
import { cn } from "@/lib/utils";

const brl = (v?: number | null) => `R$ ${Number(v ?? 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;
function initial(name?: string | null) { return name ? name.trim().charAt(0).toUpperCase() : "?"; }
const splitSeg = (s?: string | null) => (s ?? "").split(/[,;]+/).map((x) => x.trim()).filter(Boolean);

export default function CriaCrm() {
  return <ModuleGate code="crm"><CrmInner /></ModuleGate>;
}

const CRM_TABS = ["clientes", "tarefas", "calendario", "pipeline", "contratos"] as const;
type CrmTab = typeof CRM_TABS[number];

function CrmInner() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const seg = pathname.split("/").filter(Boolean).pop() || "";
  if (seg === "criacrm") return <Navigate to="/socialmidia/criacrm/clientes" replace />;
  const tab: CrmTab = (CRM_TABS as readonly string[]).includes(seg) ? (seg as CrmTab) : "clientes";

  return (
    <div>
      <ManagerSectionTitle t="Cria Gestão" s="Carteira, tarefas, calendário, pipeline e contratos da sua operação." />
      <Tabs value={tab} onValueChange={(v) => navigate(`/socialmidia/criacrm/${v}`)} className="w-full">
        <TabsList className="bg-card border border-border rounded-2xl p-1.5 mb-5 flex w-full justify-start overflow-x-auto scrollbar-none">
          <TabsTrigger value="clientes" className="shrink-0 rounded-xl data-[state=active]:bg-primary/10 data-[state=active]:text-primary">Clientes</TabsTrigger>
          <TabsTrigger value="tarefas" className="shrink-0 rounded-xl data-[state=active]:bg-primary/10 data-[state=active]:text-primary">Tarefas</TabsTrigger>
          <TabsTrigger value="calendario" className="shrink-0 rounded-xl data-[state=active]:bg-primary/10 data-[state=active]:text-primary">Calendário</TabsTrigger>
          <TabsTrigger value="pipeline" className="shrink-0 rounded-xl data-[state=active]:bg-primary/10 data-[state=active]:text-primary">Pipeline</TabsTrigger>
          <TabsTrigger value="contratos" className="shrink-0 rounded-xl data-[state=active]:bg-primary/10 data-[state=active]:text-primary">Contratos</TabsTrigger>
        </TabsList>
        <TabsContent value="clientes"><ClientsTab /></TabsContent>
        <TabsContent value="tarefas"><TasksTab /></TabsContent>
        <TabsContent value="calendario"><CrmCalendarTab /></TabsContent>
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

  const [search, setSearch] = useState("");
  const [segFilter, setSegFilter] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [segOpen, setSegOpen] = useState(false);

  // avatar dos clientes importados do cria
  const criaAvatar = useMemo(() => {
    const m = new Map<string, string | null>();
    managedAccounts.forEach((a) => m.set(a.owner_id, a.avatar_url));
    return m;
  }, [managedAccounts]);

  const segments = useMemo(() => Array.from(new Set(clients.flatMap((c) => splitSeg(c.segment)))).sort(), [clients]);
  const filtered = clients.filter((c) => {
    const q = search.trim().toLowerCase();
    const okQ = !q || c.name.toLowerCase().includes(q) || (c.instagram ?? "").toLowerCase().includes(q);
    const okS = !segFilter || splitSeg(c.segment).includes(segFilter);
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

      <div className="flex items-center gap-2 mb-4">
        <div className="relative flex-1 min-w-0">
          <Search className="h-4 w-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
          <Input placeholder="Buscar cliente..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 rounded-xl" />
        </div>
        {segments.length > 0 && (
          <Button type="button" variant="outline" onClick={() => setSegOpen(true)} className="rounded-xl gap-1.5 shrink-0">
            <SlidersHorizontal className="h-4 w-4" /> Filtro
            {segFilter && <span className="ml-0.5 text-[10px] font-bold bg-primary text-primary-foreground rounded-full px-1.5 py-0.5">1</span>}
          </Button>
        )}
      </div>
      {segFilter && (
        <div className="flex items-center gap-1.5 mb-4">
          <button type="button" onClick={() => setSegFilter(null)} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-primary/10 text-primary">{segFilter} <X className="h-3 w-3" /></button>
        </div>
      )}

      <Sheet open={segOpen} onOpenChange={setSegOpen}>
        <SheetContent side="bottom" className="rounded-t-2xl max-h-[80vh] overflow-y-auto">
          <SheetHeader><SheetTitle className="font-display text-left">Filtrar por nicho</SheetTitle></SheetHeader>
          <div className="flex flex-wrap gap-2 mt-4 pb-2">
            <button type="button" onClick={() => { setSegFilter(null); setSegOpen(false); }} className={cn("px-3 py-1.5 rounded-full text-xs font-body font-bold border", !segFilter ? "bg-foreground text-background border-foreground" : "bg-card border-border text-muted-foreground")}>Todos</button>
            {segments.map((s) => (
              <button key={s} type="button" onClick={() => { setSegFilter(s); setSegOpen(false); }} className={cn("px-3 py-1.5 rounded-full text-xs font-body font-bold border", segFilter === s ? "bg-foreground text-background border-foreground" : "bg-card border-border text-muted-foreground")}>{s}</button>
            ))}
          </div>
        </SheetContent>
      </Sheet>

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
              <div key={c.id} className="group rounded-2xl border border-border bg-card p-5 flex flex-col gap-3 hover:shadow-md hover:border-primary/40 transition-all cursor-pointer" onClick={() => navigate(`/socialmidia/criacrm/${c.id}`)}>
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
        onCreate={async (input) => { const c = await createClient.mutateAsync(input); setCreating(false); navigate(`/socialmidia/criacrm/${c.id}`); }}
        saving={createClient.isPending}
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
