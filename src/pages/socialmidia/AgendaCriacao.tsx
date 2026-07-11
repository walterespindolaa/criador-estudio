import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { CalendarDays, Plus, X, Video, Loader2, Clock, MapPin, Users, ListChecks } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useCrmClients, useCrmTasks, type CrmTask } from "@/hooks/useCrm";
import {
  useCreations, useAddCreation, useDeleteCreation,
  useCaptures, useAddCapture, useUpdateCapture, useDeleteCapture, useCollaboratorNames, type Capture,
} from "@/hooks/useAgenda";
import { hojeBR, parseDateOnly } from "@/lib/date-br";

const WD = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];
// Inverso de parseDateOnly: formata um Date de meia-noite LOCAL de volta para YYYY-MM-DD.
// Só usar com Dates construídos via parseDateOnly/mondayOf (aritmética de calendário).
function ymd(d: Date) { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; }
function mondayOf(d: Date) { const x = new Date(d); const wd = (x.getDay() + 6) % 7; x.setDate(x.getDate() - wd); x.setHours(0, 0, 0, 0); return x; }
const shortDate = (d: Date) => d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
const STATUS: Record<Capture["status"], { label: string; cls: string }> = {
  agendada: { label: "Agendada", cls: "bg-primary/10 text-primary" },
  concluida: { label: "Concluída", cls: "bg-secondary/15 text-secondary" },
  cancelada: { label: "Cancelada", cls: "bg-destructive/10 text-destructive" },
};

export default function AgendaCriacao() {
  const navigate = useNavigate();
  const [weekStart, setWeekStart] = useState(() => mondayOf(parseDateOnly(hojeBR())));
  // Toggle: mostrar as tarefas dos clientes (CRM) na grade, persistido por dispositivo
  const [showTasks, setShowTasks] = useState(() => {
    try { return localStorage.getItem("agenda_show_tasks") === "1"; } catch { return false; }
  });
  const toggleTasks = (v: boolean) => {
    setShowTasks(v);
    try { localStorage.setItem("agenda_show_tasks", v ? "1" : "0"); } catch { /* segue */ }
  };
  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => { const d = new Date(weekStart); d.setDate(d.getDate() + i); return d; }), [weekStart]);
  const from = ymd(days[0]); const to = ymd(days[6]);
  const today = hojeBR();

  const { data: clients = [] } = useCrmClients();
  const { data: teamNames = [] } = useCollaboratorNames();
  const { data: creations = [] } = useCreations(from, to);
  const addCreation = useAddCreation();
  const delCreation = useDeleteCreation();
  const { data: captures = [] } = useCaptures();
  const { data: crmTasks = [] } = useCrmTasks();
  const addCapture = useAddCapture();
  const updCapture = useUpdateCapture();
  const delCapture = useDeleteCapture();

  const [addDay, setAddDay] = useState<string | null>(null);
  const [capOpen, setCapOpen] = useState(false);

  const byDay = useMemo(() => {
    const m = new Map<string, typeof creations>();
    for (const c of creations) (m.get(c.day) ?? m.set(c.day, []).get(c.day)!).push(c);
    return m;
  }, [creations]);

  // Captações da semana exibida, indexadas por dia (YYYY-MM-DD), para aparecerem na grade.
  const capturesByDay = useMemo(() => {
    const m = new Map<string, Capture[]>();
    for (const c of captures) {
      if (c.status === "cancelada") continue;
      if (c.capture_date < from || c.capture_date > to) continue;
      (m.get(c.capture_date) ?? m.set(c.capture_date, []).get(c.capture_date)!).push(c);
    }
    for (const arr of m.values()) arr.sort((a, b) => (a.capture_time ?? "99:99").localeCompare(b.capture_time ?? "99:99"));
    return m;
  }, [captures, from, to]);

  const nameOf = (crmId: string | null, fallback: string | null) =>
    (crmId ? clients.find((c) => c.id === crmId)?.name : null) || fallback || "Cliente";

  // Tarefas dos clientes (CRM) com vencimento na semana exibida, por dia.
  // Concluídas ficam de fora: a grade é sobre o que ainda precisa acontecer.
  const tasksByDay = useMemo(() => {
    const m = new Map<string, CrmTask[]>();
    if (!showTasks) return m;
    const prioOrder: Record<string, number> = { urgente: 0, alta: 1, media: 2, baixa: 3 };
    for (const t of crmTasks) {
      if (!t.due_date || t.status === "concluida") continue;
      if (t.due_date < from || t.due_date > to) continue;
      (m.get(t.due_date) ?? m.set(t.due_date, []).get(t.due_date)!).push(t);
    }
    for (const arr of m.values()) arr.sort((a, b) => (prioOrder[a.priority] ?? 9) - (prioOrder[b.priority] ?? 9));
    return m;
  }, [crmTasks, from, to, showTasks]);

  const upcoming = useMemo(() => captures.filter((c) => c.status !== "cancelada" && c.capture_date >= today).slice(0, 30), [captures, today]);

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} className="pb-24 md:pb-0">
      <div className="flex items-center gap-3 mb-5">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-purple-600 grid place-items-center shadow-sm shrink-0">
          <CalendarDays className="h-5 w-5 text-white" strokeWidth={1.75} />
        </div>
        <div>
          <h1 className="text-2xl sm:text-3xl font-display font-extrabold text-foreground tracking-tight">Agenda</h1>
          <p className="text-muted-foreground font-body text-sm mt-0.5">Criação semanal e agenda de captações.</p>
        </div>
      </div>

      {/* Agenda de criação */}
      <div className="rounded-2xl border border-border bg-card p-4">
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <div className="flex items-center gap-4 flex-wrap">
            <p className="text-sm font-display font-bold text-foreground">Agenda de criação</p>
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <Switch checked={showTasks} onCheckedChange={toggleTasks} aria-label="Mostrar tarefas dos clientes" />
              <span className="text-xs font-body font-semibold text-muted-foreground">Tarefas dos clientes</span>
            </label>
          </div>
          <div className="flex items-center gap-1">
            <Button variant="outline" size="sm" className="h-8 w-8 p-0" onClick={() => setWeekStart((w) => { const n = new Date(w); n.setDate(n.getDate() - 7); return n; })}>‹</Button>
            <span className="text-xs font-body text-muted-foreground px-1">{shortDate(days[0])} – {shortDate(days[6])}</span>
            <Button variant="outline" size="sm" className="h-8 px-2 text-xs" onClick={() => setWeekStart(mondayOf(parseDateOnly(hojeBR())))}>Hoje</Button>
            <Button variant="outline" size="sm" className="h-8 w-8 p-0" onClick={() => setWeekStart((w) => { const n = new Date(w); n.setDate(n.getDate() + 7); return n; })}>›</Button>
          </div>
        </div>
        <div className="flex gap-2 overflow-x-auto pb-2 lg:grid lg:grid-cols-7 lg:overflow-visible lg:pb-0">
          {days.map((d, i) => {
            const iso = ymd(d); const list = byDay.get(iso) ?? []; const caps = capturesByDay.get(iso) ?? []; const dayTasks = tasksByDay.get(iso) ?? []; const isToday = iso === today;
            return (
              <div key={iso} className={cn("w-[170px] shrink-0 lg:w-auto min-h-[220px] lg:min-h-[280px] rounded-xl border p-2.5 flex flex-col gap-1.5", isToday ? "border-primary bg-primary/5 ring-1 ring-primary/20" : "border-border bg-background")}>
                <div className="flex items-center justify-between px-0.5">
                  <div><span className={cn("text-[11px] uppercase tracking-wider font-body font-semibold", isToday ? "text-primary" : "text-muted-foreground")}>{WD[i]}</span> <span className={cn("text-base font-display font-bold", isToday ? "text-primary" : "text-foreground")}>{d.getDate()}</span></div>
                  <button onClick={() => setAddDay(iso)} className="text-muted-foreground hover:text-primary" aria-label="Adicionar"><Plus className="h-3.5 w-3.5" /></button>
                </div>
                {caps.map((c) => (
                  <button key={c.id} type="button" title={c.location ?? undefined}
                    onClick={() => document.getElementById("captacoes-section")?.scrollIntoView({ behavior: "smooth", block: "start" })}
                    className={cn("rounded-lg border px-2 py-1.5 text-left transition-colors", c.status === "concluida" ? "border-teal-500/25 bg-teal-500/5 opacity-70" : "border-teal-500/40 bg-teal-500/10 hover:bg-teal-500/15")}>
                    <div className="flex items-center gap-1 text-teal-700 dark:text-teal-300">
                      <Video className="h-3 w-3 shrink-0" />
                      <span className="text-[10px] font-body font-bold">{c.capture_time ? c.capture_time.slice(0, 5) : "Captação"}</span>
                    </div>
                    <p className="text-[12px] font-body font-semibold text-foreground leading-tight truncate">{nameOf(c.crm_client_id, c.client_name)}</p>
                  </button>
                ))}
                {dayTasks.map((t) => (
                  <button key={t.id} type="button" title={t.description ?? undefined}
                    onClick={() => navigate("/socialmidia/criacrm/tarefas")}
                    className={cn("rounded-lg border px-2 py-1.5 text-left transition-colors",
                      t.priority === "urgente" || t.priority === "alta"
                        ? "border-amber-500/50 bg-amber-500/15 hover:bg-amber-500/20"
                        : "border-amber-500/30 bg-amber-500/5 hover:bg-amber-500/10")}>
                    <div className="flex items-center gap-1 text-amber-700 dark:text-amber-300">
                      <ListChecks className="h-3 w-3 shrink-0" />
                      <span className="text-[10px] font-body font-bold truncate">{nameOf(t.crm_client_id, null)}</span>
                    </div>
                    <p className="text-[12px] font-body font-semibold text-foreground leading-tight truncate">{t.title}</p>
                  </button>
                ))}
                {list.map((c) => (
                  <div key={c.id} className="group rounded-lg border border-border bg-card px-2 py-1.5">
                    <div className="flex items-start gap-1">
                      <p className="text-[12px] font-body font-semibold text-foreground leading-tight flex-1 min-w-0 truncate">{nameOf(c.crm_client_id, c.client_name)}</p>
                      <button onClick={() => delCreation.mutate(c.id)} className="text-muted-foreground/50 hover:text-destructive shrink-0"><X className="h-3 w-3" /></button>
                    </div>
                    {c.team && <p className="text-[10px] font-body text-muted-foreground truncate">{c.team}</p>}
                  </div>
                ))}
                {list.length === 0 && caps.length === 0 && dayTasks.length === 0 && <button onClick={() => setAddDay(iso)} className="text-[11px] font-body text-muted-foreground/60 hover:text-primary py-1">+ cliente</button>}
              </div>
            );
          })}
        </div>
      </div>

      {/* Captações */}
      <div id="captacoes-section" className="rounded-2xl border border-border bg-card p-4 mt-4 scroll-mt-20">
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-display font-bold text-foreground">Captações</p>
          <Button size="sm" className="h-8" onClick={() => setCapOpen(true)}><Plus className="h-3.5 w-3.5 mr-1" /> Nova captação</Button>
        </div>
        {upcoming.length === 0 ? (
          <p className="text-[12px] font-body text-muted-foreground py-4 text-center">Nenhuma captação agendada. Clique em "Nova captação".</p>
        ) : (
          <div className="space-y-2">
            {upcoming.map((c) => {
              const st = STATUS[c.status];
              const d = parseDateOnly(c.capture_date);
              return (
                <div key={c.id} className="flex items-center gap-3 rounded-xl border border-border p-3 flex-wrap">
                  <div className="text-center shrink-0 w-11">
                    <p className="text-lg font-display font-extrabold text-foreground leading-none">{d.getDate()}</p>
                    <p className="text-[10px] font-body uppercase text-muted-foreground">{d.toLocaleDateString("pt-BR", { month: "short" })}</p>
                  </div>
                  <div className="grid h-9 w-9 place-items-center rounded-full bg-primary/10 text-primary shrink-0"><Video className="h-4 w-4" /></div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-body font-semibold text-foreground truncate">{nameOf(c.crm_client_id, c.client_name)}</p>
                    <div className="flex items-center gap-2 flex-wrap text-[11px] font-body text-muted-foreground">
                      {c.capture_time && <span className="inline-flex items-center gap-0.5"><Clock className="h-3 w-3" />{c.capture_time.slice(0, 5)}</span>}
                      {c.location && <span className="inline-flex items-center gap-0.5"><MapPin className="h-3 w-3" />{c.location}</span>}
                      {c.team && <span className="inline-flex items-center gap-0.5"><Users className="h-3 w-3" />{c.team}</span>}
                    </div>
                  </div>
                  <select value={c.status} onChange={(e) => updCapture.mutate({ id: c.id, patch: { status: e.target.value as Capture["status"] } })}
                    className={cn("text-[11px] font-body font-semibold rounded-full px-2 py-1 border-0 outline-none cursor-pointer", st.cls)}>
                    <option value="agendada">Agendada</option>
                    <option value="concluida">Concluída</option>
                    <option value="cancelada">Cancelada</option>
                  </select>
                  <button onClick={() => delCapture.mutate(c.id)} className="text-muted-foreground/50 hover:text-destructive shrink-0"><X className="h-4 w-4" /></button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <AddCreationDialog open={!!addDay} day={addDay} clients={clients} teamNames={teamNames} onClose={() => setAddDay(null)}
        onSave={(crm, name, team) => { if (addDay) addCreation.mutate({ day: addDay, crm_client_id: crm, client_name: name, team }); setAddDay(null); }} />
      <CaptureDialog open={capOpen} clients={clients} teamNames={teamNames} onClose={() => setCapOpen(false)}
        onSave={(v) => { addCapture.mutate(v); setCapOpen(false); }} pending={addCapture.isPending} />
    </motion.div>
  );
}

type Client = { id: string; name: string };

function ClientPicker({ clients, crm, name, onCrm, onName }: { clients: Client[]; crm: string | null; name: string; onCrm: (v: string | null) => void; onName: (v: string) => void }) {
  return (
    <>
      <select value={crm ?? ""} onChange={(e) => onCrm(e.target.value || null)} className="w-full h-10 rounded-xl border border-border bg-card px-3 text-sm font-body">
        <option value="">Cliente do CRM</option>
        {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
      </select>
      {!crm && <Input value={name} onChange={(e) => onName(e.target.value)} placeholder="Ou nome livre" className="mt-2" />}
    </>
  );
}

function TeamDatalist({ names }: { names: string[] }) {
  return <datalist id="agenda-team-names">{names.map((n) => <option key={n} value={n} />)}</datalist>;
}

function AddCreationDialog({ open, day, clients, teamNames, onClose, onSave }: { open: boolean; day: string | null; clients: Client[]; teamNames: string[]; onClose: () => void; onSave: (crm: string | null, name: string | null, team: string | null) => void }) {
  const [crm, setCrm] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [team, setTeam] = useState("");
  const seed = `${open}:${day}`;
  const [seeded, setSeeded] = useState("");
  if (open && seed !== seeded) { setSeeded(seed); setCrm(null); setName(""); setTeam(""); }
  const valid = !!crm || name.trim();
  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="sm:max-w-sm rounded-2xl">
        <DialogHeader><DialogTitle className="font-display">Adicionar à criação</DialogTitle></DialogHeader>
        <div className="space-y-2">
          <ClientPicker clients={clients} crm={crm} name={name} onCrm={setCrm} onName={setName} />
          <div>
            <p className="text-[11px] font-body font-semibold text-muted-foreground uppercase tracking-wider mb-1">Equipe (opcional)</p>
            <Input value={team} onChange={(e) => setTeam(e.target.value)} placeholder="Ex.: Ana, Bruno" list="agenda-team-names" />
            <TeamDatalist names={teamNames} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={() => onSave(crm, name.trim() || null, team.trim() || null)} disabled={!valid}>Adicionar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CaptureDialog({ open, clients, teamNames, onClose, onSave, pending }: { open: boolean; clients: Client[]; teamNames: string[]; onClose: () => void; onSave: (v: { capture_date: string; capture_time?: string | null; location?: string | null; crm_client_id?: string | null; client_name?: string | null; team?: string | null }) => void; pending: boolean }) {
  const [crm, setCrm] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [loc, setLoc] = useState("");
  const [team, setTeam] = useState("");
  const [seeded, setSeeded] = useState(false);
  if (open && !seeded) { setSeeded(true); setCrm(null); setName(""); setDate(""); setTime(""); setLoc(""); setTeam(""); }
  if (!open && seeded) setSeeded(false);
  const valid = date && (!!crm || name.trim());
  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="sm:max-w-md rounded-2xl">
        <DialogHeader><DialogTitle className="font-display">Nova captação</DialogTitle></DialogHeader>
        <div className="space-y-2">
          <ClientPicker clients={clients} crm={crm} name={name} onCrm={setCrm} onName={setName} />
          <div className="flex gap-2">
            <div className="flex-1"><p className="text-[11px] font-body font-semibold text-muted-foreground uppercase mb-1">Data</p><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
            <div className="w-28"><p className="text-[11px] font-body font-semibold text-muted-foreground uppercase mb-1">Hora</p><Input type="time" value={time} onChange={(e) => setTime(e.target.value)} /></div>
          </div>
          <div><p className="text-[11px] font-body font-semibold text-muted-foreground uppercase mb-1">Local (opcional)</p><Input value={loc} onChange={(e) => setLoc(e.target.value)} placeholder="Ex.: Estúdio, coworking, local externo" /></div>
          <div><p className="text-[11px] font-body font-semibold text-muted-foreground uppercase mb-1">Equipe (opcional)</p><Input value={team} onChange={(e) => setTeam(e.target.value)} placeholder="Ex.: Ana, Bruno" list="agenda-team-names" /><TeamDatalist names={teamNames} /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={() => onSave({ capture_date: date, capture_time: time || null, location: loc.trim() || null, crm_client_id: crm, client_name: name.trim() || null, team: team.trim() || null })} disabled={!valid || pending}>
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Agendar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
