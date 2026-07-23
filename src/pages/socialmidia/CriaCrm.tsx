import { useMemo, useState } from "react";
import { useNavigate, useLocation, Navigate } from "react-router-dom";
import { Plus, Download, Search, Building2, Instagram, DollarSign, ArrowRight, SlidersHorizontal, X } from "lucide-react";
import { useActiveAccount } from "@/contexts/AccountContext";
import {
  useCrmClients, useCreateCrmClient, useImportCriaClients, useCrmTags,
  CLIENT_STATUS_META, TAG_COLOR_CLS, type CrmClient, type ClientStatus,
} from "@/hooks/useCrm";
import { ModuleGate } from "@/components/accounts/ModuleGate";
import { ModuleHero, type SubTab } from "@/components/brand/ModuleHero";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { PipelineBoard } from "@/components/accounts/crm/PipelineBoard";
import { ContractsTab } from "@/components/accounts/crm/ContractsTab";
import { TasksTab } from "@/components/accounts/crm/TasksTab";
import { CrmCalendarTab } from "@/components/accounts/crm/CrmCalendarTab";
import { cn } from "@/lib/utils";

import { formatBRL } from "@/lib/money";
import { MoneyInput } from "@/components/shared/MoneyInput";
const brl = (v?: number | null) => formatBRL(v, { zeroAsDash: false });
function initial(name?: string | null) { return name ? name.trim().charAt(0).toUpperCase() : "?"; }
const splitSeg = (s?: string | null) => (s ?? "").split(/[,;]+/).map((x) => x.trim()).filter(Boolean);
// "Inativo" cobre o status novo do CRM e a flag booleana antiga.
const isInactive = (c: CrmClient) => c.status === "inativo" || c.active === false;
// Filtro de situação da lista: por padrão só ativos. Persistido por gestora.
type StatusFilter = "ativos" | "todos" | "inativos";
const STATUS_FILTER_KEY = "criacrm:clientes:statusFilter";
const STATUS_FILTER_OPTS: [StatusFilter, string][] = [["ativos", "Ativos"], ["todos", "Todos"], ["inativos", "Inativos"]];

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

  // Cada aba já é uma rota, então o submenu do ModuleHero funciona direto,
  // com a cor do módulo (Gestão = rosa) e as formas orgânicas atrás.
  const base = "/socialmidia/criacrm";
  const tabs: SubTab[] = [
    { to: `${base}/clientes`, label: "Clientes" },
    { to: `${base}/tarefas`, label: "Tarefas" },
    { to: `${base}/calendario`, label: "Calendário" },
    { to: `${base}/pipeline`, label: "Pipeline" },
    { to: `${base}/contratos`, label: "Contratos" },
  ];

  return (
    <div>
      <ModuleHero
        title="Cria Gestão"
        subtitle="Carteira, tarefas, calendário, pipeline e contratos da sua operação."
        color="rosa"
        tabs={tabs}
      />
      {tab === "clientes" && <ClientsTab />}
      {tab === "tarefas" && <TasksTab />}
      {tab === "calendario" && <CrmCalendarTab />}
      {tab === "pipeline" && <PipelineBoard />}
      {tab === "contratos" && <ContractsTab />}
    </div>
  );
}

function ClientsTab() {
  const navigate = useNavigate();
  const { managedAccounts, setActiveAccount } = useActiveAccount();
  const { data: clients = [], isLoading } = useCrmClients();
  const { data: tagCatalog = [] } = useCrmTags();
  const tagColor = (name: string) => tagCatalog.find((t) => t.name === name)?.color ?? "slate";
  const importCria = useImportCriaClients();
  const createClient = useCreateCrmClient();

  const [search, setSearch] = useState("");
  const [segFilter, setSegFilter] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [segOpen, setSegOpen] = useState(false);
  // Situação: começa em "Ativos" (ou o que a gestora escolheu da última vez).
  const [statusFilter, setStatusFilter] = useState<StatusFilter>(() => {
    const saved = typeof localStorage !== "undefined" ? localStorage.getItem(STATUS_FILTER_KEY) : null;
    return saved === "todos" || saved === "inativos" || saved === "ativos" ? saved : "ativos";
  });
  const setStatusFilterPersist = (s: StatusFilter) => {
    setStatusFilter(s);
    try { localStorage.setItem(STATUS_FILTER_KEY, s); } catch { /* ignore */ }
  };

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
    // Situação: quando há busca por texto, não escondemos inativos (a busca acha todos).
    let okStatus = true;
    if (!q) {
      if (statusFilter === "ativos") okStatus = !isInactive(c);
      else if (statusFilter === "inativos") okStatus = isInactive(c);
    }
    return okQ && okS && okStatus;
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
        {/* SITUAÇÃO — por padrão só ativos. "Todos" e "Inativos" ampliam. */}
        <div className="flex items-center gap-1 rounded-full border border-border bg-muted/40 p-1 shrink-0">
          {STATUS_FILTER_OPTS.map(([k, l]) => (
            <button key={k} type="button" onClick={() => setStatusFilterPersist(k)}
              className={cn("px-3 py-1.5 rounded-full text-xs font-body font-bold transition-colors", statusFilter === k ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground")}>
              {l}
            </button>
          ))}
        </div>
        {/* NICHO — popover ancorado no botão, no lugar do drawer que colava embaixo. */}
        {segments.length > 0 && (
          <Popover open={segOpen} onOpenChange={setSegOpen}>
            <PopoverTrigger asChild>
              <Button type="button" variant="outline" className="rounded-xl gap-1.5 shrink-0">
                <SlidersHorizontal className="h-4 w-4" /> Filtro
                {segFilter && <span className="ml-0.5 text-[10px] font-bold bg-primary text-primary-foreground rounded-full px-1.5 py-0.5">1</span>}
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-72 p-3">
              <p className="text-[11px] font-body font-semibold text-muted-foreground uppercase tracking-wider mb-2">Filtrar por nicho</p>
              <div className="flex flex-wrap gap-2 max-h-64 overflow-y-auto">
                <button type="button" onClick={() => { setSegFilter(null); setSegOpen(false); }} className={cn("px-3 py-1.5 rounded-full text-xs font-body font-bold border", !segFilter ? "bg-foreground text-background border-foreground" : "bg-card border-border text-muted-foreground")}>Todos</button>
                {segments.map((s) => (
                  <button key={s} type="button" onClick={() => { setSegFilter(s); setSegOpen(false); }} className={cn("px-3 py-1.5 rounded-full text-xs font-body font-bold border", segFilter === s ? "bg-foreground text-background border-foreground" : "bg-card border-border text-muted-foreground")}>{s}</button>
                ))}
              </div>
            </PopoverContent>
          </Popover>
        )}
      </div>
      {segFilter && (
        <div className="flex items-center gap-1.5 mb-4">
          <button type="button" onClick={() => setSegFilter(null)} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-primary/10 text-primary">{segFilter} <X className="h-3 w-3" /></button>
        </div>
      )}

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
              // O card era uma pilha: foto+nome, depois status solto numa linha, depois
              // o valor solto em outra. No mobile virava um bloco alto e sem hierarquia.
              // Agora o valor sobe pra linha do nome (é a informação que decide), e o
              // status/etiquetas ficam numa tira só, embaixo.
              <div key={c.id} className="group rounded-2xl border border-border bg-card p-4 flex flex-col gap-3 hover:shadow-md hover:border-primary/40 transition-all cursor-pointer" onClick={() => navigate(`/socialmidia/criacrm/${c.id}`)}>
                <div className="flex items-start gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-primary via-purple-600 to-pink-500 p-[2px] shrink-0 overflow-hidden">
                    <div className="w-full h-full rounded-2xl bg-card flex items-center justify-center overflow-hidden">
                      {avatar ? <img src={avatar} alt="" className="w-full h-full object-cover" loading="lazy" /> : <span className="text-lg font-display font-extrabold text-primary">{c.logo && c.logo.length <= 2 ? c.logo : initial(c.name)}</span>}
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start gap-2">
                      <p className="text-base font-display font-bold text-foreground leading-snug min-w-0 flex-1">{c.name}</p>
                      {Number(c.monthly_value) > 0 && (
                        <span className="text-sm font-display font-extrabold text-primary shrink-0 whitespace-nowrap">{brl(c.monthly_value)}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                      {c.instagram && <span className="text-xs text-muted-foreground font-body inline-flex items-center gap-1 min-w-0"><Instagram className="h-3 w-3 shrink-0" /><span className="truncate">{c.instagram.replace(/^@/, "")}</span></span>}
                      {c.cria_owner_id && <Badge variant="secondary" className="text-[9px] h-4 px-1.5 shrink-0">cria</Badge>}
                    </div>
                    {c.segment && <p className="text-[11px] text-muted-foreground font-body mt-0.5 line-clamp-1">{c.segment}</p>}
                  </div>
                </div>

                {/* Status fixo + etiquetas personalizadas, visíveis já na lista. */}
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className={cn("text-[10px] font-semibold px-2 py-0.5 rounded-full border", CLIENT_STATUS_META[(c.status ?? "ativo") as ClientStatus]?.cls)}>
                    {CLIENT_STATUS_META[(c.status ?? "ativo") as ClientStatus]?.label ?? "Ativo"}
                  </span>
                  {(c.tags ?? []).map((t) => (
                    <span key={t} className={cn("text-[10px] font-semibold px-2 py-0.5 rounded-full border", TAG_COLOR_CLS[tagColor(t)] ?? TAG_COLOR_CLS.slate)}>{t}</span>
                  ))}
                  {Number(c.monthly_value) > 0 && <span className="text-[10px] font-body text-muted-foreground ml-auto">por mês</span>}
                </div>
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
  const [segment, setSegment] = useState(""); const [value, setValue] = useState<number | null>(null);
  const reset = () => { setName(""); setInstagram(""); setSegment(""); setValue(null); };
  return (
    <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) reset(); }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader><DialogTitle className="font-display">Novo cliente</DialogTitle></DialogHeader>
        <div className="space-y-3 mt-2">
          <div className="space-y-1.5"><Label className="text-xs">Nome *</Label><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Café Aroma" className="rounded-xl" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label className="text-xs">Instagram</Label><Input value={instagram} onChange={(e) => setInstagram(e.target.value)} placeholder="@empresa" className="rounded-xl" /></div>
            <div className="space-y-1.5"><Label className="text-xs">Segmento</Label><Input value={segment} onChange={(e) => setSegment(e.target.value)} placeholder="Ex: Gastronomia" className="rounded-xl" /></div>
          </div>
          <div className="space-y-1.5"><Label className="text-xs">Valor mensal</Label><MoneyInput value={value} onChange={setValue} /></div>
        </div>
        <div className="flex justify-end gap-2 mt-5">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button disabled={!name.trim() || saving} onClick={() => onCreate({ name: name.trim(), instagram: instagram.trim() || undefined, segment: segment.trim() || undefined, monthly_value: value ?? 0 })}>Criar</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
