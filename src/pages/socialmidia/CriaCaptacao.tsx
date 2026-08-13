import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Cell, LabelList } from "recharts";
import {
  Video, ChevronLeft, ChevronRight, Copy, Check, MapPin, Building2, Loader2,
  Plus, X, CheckCircle2, Clock, Pencil, CalendarRange, MapPinned, Camera,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useCaptures, useUpdateCapture, type Capture } from "@/hooks/useAgenda";
import { useCrmClients } from "@/hooks/useCrm";
import { useCaptureCities } from "@/hooks/useCaptureCities";
import { hojeBR, parseDateOnly } from "@/lib/date-br";
import { nomeExibidoCliente } from "@/lib/cliente-nome";

// Paleta de cores do app pro gráfico por cidade (as mesmas cores dos chips da
// agenda). Cicla quando há mais cidades que cores.
const CITY_COLORS = ["#0061EE", "#01A652", "#EA4918", "#FF77B9", "#4B3FA8", "#F5A623", "#14B8A6", "#BE185D"];
const SEM_CIDADE = "Sem cidade";
const SEM_LOCAL = "Sem local";

// "YYYY-MM" -> Date local do 1º dia (sem toISOString, pra não pular o mês à noite no BR).
function ymToDate(ym: string): Date {
  const [y, m] = ym.split("-").map(Number);
  return new Date(y, (m ?? 1) - 1, 1);
}
function monthLabel(ym: string): string {
  const s = ymToDate(ym).toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
  return s.charAt(0).toUpperCase() + s.slice(1);
}
function addMonth(ym: string, delta: number): string {
  const d = ymToDate(ym);
  const n = new Date(d.getFullYear(), d.getMonth() + delta, 1);
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}`;
}
// "27/08" a partir de "YYYY-MM-DD".
function diaMes(iso: string): string {
  const d = parseDateOnly(iso);
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;
}
const WD = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];

type StatusFilter = "todas" | "pendentes" | "concluidas";

export default function CriaCaptacao() {
  const navigate = useNavigate();
  const [month, setMonth] = useState(() => hojeBR().slice(0, 7));
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("todas");
  const [cityFilter, setCityFilter] = useState<string>(""); // "" = todas
  const [citiesOpen, setCitiesOpen] = useState(false);

  const { data: captures = [], isLoading } = useCaptures();
  const { data: clients = [] } = useCrmClients();
  const updCapture = useUpdateCapture();
  const { cities, save: saveCities } = useCaptureCities();

  const currentMonth = hojeBR().slice(0, 7);

  // Cliente do CRM por id: nome exibido (apelido do gestor > name) e cidade.
  const clientById = useMemo(() => {
    const m = new Map<string, { nome: string; city: string | null; color: string | null }>();
    for (const c of clients) {
      m.set(c.id, {
        nome: nomeExibidoCliente(c),
        city: ((c as { city?: string | null }).city ?? null),
        color: c.color,
      });
    }
    return m;
  }, [clients]);

  // Nome e cidade de uma captação (via crm_client_id; senão o client_name livre).
  const capName = (c: Capture) =>
    (c.crm_client_id ? clientById.get(c.crm_client_id)?.nome : null) || c.client_name || "Cliente";
  const capCity = (c: Capture): string =>
    (c.crm_client_id ? clientById.get(c.crm_client_id)?.city : null)?.trim() || SEM_CIDADE;

  // Captações do mês (exclui canceladas, que não entram no painel de gerência).
  const doMes = useMemo(() => {
    return captures
      .filter((c) => c.status !== "cancelada" && c.capture_date.slice(0, 7) === month)
      .sort((a, b) =>
        a.capture_date.localeCompare(b.capture_date)
        || (a.capture_time ?? "99:99").localeCompare(b.capture_time ?? "99:99"));
  }, [captures, month]);

  // Resumo: total, concluídas e faltam (agendadas = pendentes).
  const resumo = useMemo(() => {
    const total = doMes.length;
    const concluidas = doMes.filter((c) => c.status === "concluida").length;
    return { total, concluidas, faltam: total - concluidas };
  }, [doMes]);

  // Gráfico por cidade: conta as captações do mês por cidade (só cidades COM
  // captação aparecem; cliente sem cidade cai em "Sem cidade").
  const porCidade = useMemo(() => {
    const m = new Map<string, number>();
    for (const c of doMes) {
      const city = capCity(c);
      m.set(city, (m.get(city) ?? 0) + 1);
    }
    return Array.from(m.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doMes, clientById]);

  // Aplica os filtros (status + cidade) sobre as captações do mês.
  const filtradas = useMemo(() => {
    return doMes.filter((c) => {
      if (statusFilter === "pendentes" && c.status !== "agendada") return false;
      if (statusFilter === "concluidas" && c.status !== "concluida") return false;
      if (cityFilter && capCity(c) !== cityFilter) return false;
      return true;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doMes, statusFilter, cityFilter, clientById]);

  // Agrupamento por DIA + LOCAL: chave "data||local", ordenada por data e local.
  const grupos = useMemo(() => {
    const map = new Map<string, { date: string; local: string; caps: Capture[] }>();
    for (const c of filtradas) {
      const local = (c.location ?? "").trim() || SEM_LOCAL;
      const key = `${c.capture_date}||${local}`;
      if (!map.has(key)) map.set(key, { date: c.capture_date, local, caps: [] });
      map.get(key)!.caps.push(c);
    }
    return Array.from(map.values()).sort((a, b) =>
      a.date.localeCompare(b.date) || a.local.localeCompare(b.local));
  }, [filtradas]);

  const goHoje = () => setMonth(currentMonth);

  return (
    <div className="space-y-5">
      {/* Cabeçalho: navegação de mês + botão Cidades */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1.5">
          <button type="button" onClick={() => setMonth(addMonth(month, -1))}
            className="grid h-9 w-9 place-items-center rounded-xl border border-border text-muted-foreground hover:text-foreground transition-colors" aria-label="Mês anterior">
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="text-sm font-display font-bold text-foreground w-[150px] text-center tabular-nums">{monthLabel(month)}</span>
          <button type="button" onClick={() => setMonth(addMonth(month, 1))}
            className="grid h-9 w-9 place-items-center rounded-xl border border-border text-muted-foreground hover:text-foreground transition-colors" aria-label="Próximo mês">
            <ChevronRight className="h-4 w-4" />
          </button>
          {month !== currentMonth && (
            <Button variant="ghost" size="sm" onClick={goHoje} className="h-9 rounded-xl text-xs">Hoje</Button>
          )}
        </div>
        <Button variant="outline" size="sm" onClick={() => setCitiesOpen(true)} className="rounded-xl">
          <MapPinned className="h-4 w-4 mr-1.5" /> Cidades
        </Button>
      </div>

      {/* Resumo do mês: cards grandes */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-2xl border border-border bg-card p-4">
          <p className="flex items-center gap-1.5 text-[11px] font-body font-bold uppercase tracking-wide text-muted-foreground"><Video className="h-3.5 w-3.5" /> Captações</p>
          <p className="text-3xl font-display font-extrabold text-foreground leading-none mt-2 tabular-nums">{resumo.total}</p>
          <p className="text-[11px] font-body text-muted-foreground mt-1">no mês</p>
        </div>
        <div className="rounded-2xl border px-4 py-4" style={{ background: "hsl(var(--cria-verde) / 0.08)", borderColor: "hsl(var(--cria-verde) / 0.25)" }}>
          <p className="flex items-center gap-1.5 text-[11px] font-body font-bold uppercase tracking-wide" style={{ color: "hsl(var(--cria-verde))" }}><CheckCircle2 className="h-3.5 w-3.5" /> Concluídas</p>
          <p className="text-3xl font-display font-extrabold text-foreground leading-none mt-2 tabular-nums">{resumo.concluidas}</p>
          <p className="text-[11px] font-body text-muted-foreground mt-1">já gravadas</p>
        </div>
        <div className="rounded-2xl border px-4 py-4" style={{ background: "hsl(var(--cria-amarelo) / 0.1)", borderColor: "hsl(var(--cria-amarelo) / 0.3)" }}>
          <p className="flex items-center gap-1.5 text-[11px] font-body font-bold uppercase tracking-wide" style={{ color: "hsl(var(--cria-amarelo))" }}><Clock className="h-3.5 w-3.5" /> Faltam</p>
          <p className="text-3xl font-display font-extrabold text-foreground leading-none mt-2 tabular-nums">{resumo.faltam}</p>
          <p className="text-[11px] font-body text-muted-foreground mt-1">pendentes</p>
        </div>
      </div>

      {/* Gráfico por cidade */}
      {porCidade.length > 0 && (
        <div className="rounded-2xl border border-border bg-card p-4 sm:p-5">
          <h2 className="flex items-center gap-2 text-sm font-display font-bold text-foreground mb-3">
            <MapPin className="h-4 w-4 text-primary" /> Captações por cidade
          </h2>
          <ResponsiveContainer width="100%" height={Math.max(120, porCidade.length * 44)}>
            <BarChart data={porCidade} layout="vertical" margin={{ top: 4, right: 32, left: 8, bottom: 4 }}>
              <XAxis type="number" hide allowDecimals={false} />
              <YAxis type="category" dataKey="name" width={120} tickLine={false} axisLine={false}
                tick={{ fontSize: 12, fill: "hsl(var(--foreground))" }} />
              <Bar dataKey="value" radius={[0, 6, 6, 0]} barSize={22}>
                {porCidade.map((entry, i) => (
                  <Cell key={entry.name} fill={entry.name === SEM_CIDADE ? "hsl(var(--muted-foreground))" : CITY_COLORS[i % CITY_COLORS.length]} />
                ))}
                <LabelList dataKey="value" position="right" style={{ fontSize: 12, fontWeight: 700, fill: "hsl(var(--foreground))" }} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Filtros: status + cidade */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="inline-flex rounded-xl border border-border bg-card p-0.5">
          {([["todas", "Todas"], ["pendentes", "Pendentes"], ["concluidas", "Concluídas"]] as const).map(([k, label]) => (
            <button key={k} type="button" onClick={() => setStatusFilter(k)}
              className={cn("px-3 py-1.5 text-xs font-body font-semibold rounded-lg transition-colors",
                statusFilter === k ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")}>
              {label}
            </button>
          ))}
        </div>
        {porCidade.length > 0 && (
          <select value={cityFilter} onChange={(e) => setCityFilter(e.target.value)}
            className="h-9 rounded-xl border border-border bg-card px-3 text-xs font-body font-semibold text-foreground outline-none">
            <option value="">Todas as cidades</option>
            {porCidade.map((c) => <option key={c.name} value={c.name}>{c.name}</option>)}
          </select>
        )}
      </div>

      {/* Lista agrupada por dia + local */}
      {isLoading ? (
        <div className="h-40 rounded-2xl bg-muted animate-pulse" />
      ) : doMes.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border py-12 text-center">
          <Camera className="h-8 w-8 text-muted-foreground/50 mx-auto mb-2" />
          <p className="text-sm font-body font-semibold text-foreground">Nenhuma captação em {monthLabel(month).toLowerCase()}</p>
          <p className="text-xs text-muted-foreground font-body mt-1 max-w-xs mx-auto">As captações que você marca na Agenda aparecem aqui pra você gerenciar roteiros e ver o que falta.</p>
          <Button variant="outline" size="sm" onClick={() => navigate("/socialmidia/agenda")} className="mt-4 rounded-xl">
            <CalendarRange className="h-4 w-4 mr-1.5" /> Ir para a Agenda
          </Button>
        </div>
      ) : grupos.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border py-10 text-center">
          <p className="text-sm font-body font-medium text-foreground">Nada com esse filtro</p>
          <p className="text-xs text-muted-foreground font-body mt-1">Ajuste o status ou a cidade pra ver as captações.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {grupos.map((g) => (
            <div key={`${g.date}||${g.local}`} className="rounded-2xl border border-border bg-card overflow-hidden">
              {/* Cabeçalho do grupo: dia + local */}
              <div className="flex items-center gap-2 px-4 py-2.5 border-b border-border bg-muted/30">
                <CalendarRange className="h-4 w-4 text-primary shrink-0" />
                <span className="text-sm font-display font-bold text-foreground">{diaMes(g.date)}</span>
                <span className="text-xs font-body text-muted-foreground">{WD[parseDateOnly(g.date).getDay()]}</span>
                <span className="text-muted-foreground/40">·</span>
                <span className="inline-flex items-center gap-1 text-sm font-body font-semibold text-foreground min-w-0">
                  <MapPin className="h-3.5 w-3.5 text-muted-foreground shrink-0" /><span className="truncate">{g.local}</span>
                </span>
                <span className="ml-auto text-[11px] font-body font-semibold text-muted-foreground tabular-nums shrink-0">{g.caps.length}</span>
              </div>
              <div className="divide-y divide-border">
                {g.caps.map((c) => (
                  <CaptureRow key={c.id} cap={c} nome={capName(c)} cidade={capCity(c)}
                    onToggle={() => updCapture.mutate({ id: c.id, patch: { status: c.status === "concluida" ? "agendada" : "concluida" } })}
                    onSaveRoteiro={(roteiro) => updCapture.mutateAsync({ id: c.id, patch: { roteiro } })} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <CitiesDialog open={citiesOpen} onOpenChange={setCitiesOpen}
        cities={cities} onSave={(list) => saveCities.mutateAsync(list)} saving={saveCities.isPending} />
    </div>
  );
}

// ── Uma captação (cliente + cidade + status + roteiro + copiar) ────────────────
function CaptureRow({ cap, nome, cidade, onToggle, onSaveRoteiro }: {
  cap: Capture; nome: string; cidade: string;
  onToggle: () => void; onSaveRoteiro: (roteiro: string) => Promise<unknown>;
}) {
  const done = cap.status === "concluida";
  const roteiro = (cap.roteiro ?? "").trim();
  const [copied, setCopied] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(roteiro);
  const [saving, setSaving] = useState(false);

  const copiar = async () => {
    if (!roteiro) return;
    try {
      await navigator.clipboard.writeText(cap.roteiro ?? "");
      setCopied(true);
      toast.success("Roteiro copiado");
      setTimeout(() => setCopied(false), 1600);
    } catch {
      toast.error("Não consegui copiar. Copie manualmente.");
    }
  };

  const abrirEdicao = () => { setDraft(cap.roteiro ?? ""); setEditing(true); };
  const salvar = async () => {
    setSaving(true);
    try {
      await onSaveRoteiro(draft.trim());
      setEditing(false);
      toast.success("Roteiro salvo");
    } catch {
      toast.error("Não consegui salvar o roteiro.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-4">
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-body font-semibold text-foreground truncate">{nome}</span>
            <span className="inline-flex items-center gap-1 text-[11px] font-body text-muted-foreground">
              <Building2 className="h-3 w-3" />{cidade}
            </span>
            {cap.capture_time && <span className="inline-flex items-center gap-1 text-[11px] font-body text-muted-foreground"><Clock className="h-3 w-3" />{cap.capture_time.slice(0, 5)}</span>}
          </div>
        </div>
        {/* Status: toca pra alternar pendente <-> concluída */}
        <button type="button" onClick={onToggle}
          className={cn("shrink-0 inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-body font-bold transition-colors",
            done
              ? "bg-[hsl(var(--cria-verde)/0.12)] text-[hsl(var(--cria-verde))]"
              : "bg-[hsl(var(--cria-amarelo)/0.15)] text-[hsl(var(--cria-amarelo))]")}>
          {done ? <><CheckCircle2 className="h-3.5 w-3.5" /> Concluída</> : <><Clock className="h-3.5 w-3.5" /> Pendente</>}
        </button>
      </div>

      {/* Roteiro */}
      {editing ? (
        <div className="mt-3">
          <Textarea rows={4} value={draft} onChange={(e) => setDraft(e.target.value)} autoFocus
            placeholder="Escreva o roteiro dessa gravação…" className="rounded-xl text-sm" />
          <div className="flex items-center gap-2 mt-2">
            <Button size="sm" onClick={salvar} disabled={saving} className="rounded-xl">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Salvar roteiro"}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setEditing(false)} className="rounded-xl">Cancelar</Button>
          </div>
        </div>
      ) : roteiro ? (
        <div className="mt-3 rounded-xl border border-border bg-muted/20 p-3">
          <p className="text-[13px] font-body text-foreground whitespace-pre-wrap break-words">{roteiro}</p>
          <div className="flex items-center gap-2 mt-2.5">
            <Button size="sm" variant="outline" onClick={copiar} className="rounded-xl h-8">
              {copied ? <><Check className="h-3.5 w-3.5 mr-1.5" /> Copiado</> : <><Copy className="h-3.5 w-3.5 mr-1.5" /> Copiar roteiro</>}
            </Button>
            <Button size="sm" variant="ghost" onClick={abrirEdicao} className="rounded-xl h-8">
              <Pencil className="h-3.5 w-3.5 mr-1.5" /> Editar
            </Button>
          </div>
        </div>
      ) : (
        <button type="button" onClick={abrirEdicao}
          className="mt-3 w-full flex items-center gap-2 rounded-xl border border-dashed border-border px-3 py-2.5 text-left text-xs font-body text-muted-foreground hover:text-foreground hover:border-primary/40 transition-colors">
          <Plus className="h-3.5 w-3.5 shrink-0" /> Escrever roteiro dessa captação
        </button>
      )}

      {/* Nota livre da captação (se houver), pra contexto */}
      {cap.note && cap.note.trim() && (
        <p className="mt-2 text-[11px] font-body text-muted-foreground/80 italic break-words">{cap.note}</p>
      )}
    </div>
  );
}

// ── Configurar cidades atendidas (chips add/remove) ────────────────────────────
function CitiesDialog({ open, onOpenChange, cities, onSave, saving }: {
  open: boolean; onOpenChange: (o: boolean) => void;
  cities: string[]; onSave: (list: string[]) => Promise<unknown>; saving: boolean;
}) {
  const [novo, setNovo] = useState("");

  const add = async () => {
    const c = novo.trim();
    if (!c) return;
    if (cities.some((x) => x.toLowerCase() === c.toLowerCase())) { setNovo(""); return; }
    await onSave([...cities, c]);
    setNovo("");
  };
  const remove = (city: string) => onSave(cities.filter((c) => c !== city));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle className="font-display">Cidades que você atende</DialogTitle></DialogHeader>
        <p className="text-xs text-muted-foreground font-body">
          As cidades onde você faz captação. Elas viram opção no cadastro do cliente e alimentam o gráfico por cidade.
        </p>
        <div className="flex gap-2 mt-3">
          <Input value={novo} onChange={(e) => setNovo(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }}
            placeholder="Ex.: Balneário Camboriú" className="rounded-xl" />
          <Button onClick={add} disabled={saving || !novo.trim()} className="shrink-0 rounded-xl">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          </Button>
        </div>
        <div className="flex flex-wrap gap-2 mt-4 min-h-[40px]">
          {cities.length === 0 ? (
            <p className="text-xs text-muted-foreground font-body italic">Nenhuma cidade ainda. Adicione a primeira acima.</p>
          ) : cities.map((c) => (
            <span key={c} className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 text-primary border border-primary/15 pl-3 pr-1.5 py-1 text-xs font-body font-semibold">
              {c}
              <button type="button" onClick={() => remove(c)} disabled={saving}
                className="grid h-5 w-5 place-items-center rounded-full hover:bg-primary/15 transition-colors" aria-label={`Remover ${c}`}>
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
