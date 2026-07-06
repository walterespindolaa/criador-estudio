import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  Clapperboard, Loader2, Wand2, Globe, Lock, Plus, CalendarDays, Sparkles, ChevronDown,
} from "lucide-react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { useProfile } from "@/hooks/useProfile";
import { useTier } from "@/hooks/useTier";
import { useCriaAI } from "@/contexts/CriaAIContext";
import { useStoryTrends, storyTrendsToContext, type StoryTrend } from "@/hooks/useStoryTrends";
import {
  useStorySlots, useScheduledPostsInRange, useGenerateStoryPlan,
  useUpdateStorySlot, useDeleteStorySlot, useAddStorySlot, type StorySlot,
} from "@/hooks/useStoryPlan";
import { StoryWeekView } from "@/components/stories/StoryWeekView";

const PERIODS = [
  { label: "1 dia", days: 1 },
  { label: "5 dias", days: 5 },
  { label: "7 dias", days: 7 },
  { label: "15 dias", days: 15 },
];
const PER_DAY = [1, 2, 3, 4, 5];

function localIso(d = new Date()): string {
  const t = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return t.toISOString().slice(0, 10);
}
function isoAddDays(iso: string, n: number): string {
  const d = new Date(iso + "T00:00:00");
  d.setDate(d.getDate() + n);
  return localIso(d);
}
function sundayOf(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  x.setDate(x.getDate() - x.getDay());
  return x;
}

const FORMAT_STYLE: Record<string, { bg: string; fg: string }> = {
  enquete: { bg: "#EEEDFE", fg: "#3C3489" }, caixinha: { bg: "#E1F5EE", fg: "#085041" },
  bastidor: { bg: "#FAEEDA", fg: "#854F0B" }, tutorial: { bg: "#E7F0FB", fg: "#1E4B8F" },
  "antes-depois": { bg: "#FBEAF0", fg: "#72243E" }, "dica-rapida": { bg: "#EAF7E9", fg: "#2E6B2C" },
  contagem: { bg: "#FDEEE6", fg: "#8A3B14" }, quiz: { bg: "#F0EAFB", fg: "#5B2A86" },
};
const fmtStyle = (f: string | null) => FORMAT_STYLE[(f || "").toLowerCase()] ?? { bg: "#EFEFEF", fg: "#555" };

type EditorState =
  | { mode: "closed" }
  | { mode: "edit"; slot: StorySlot }
  | { mode: "create"; date: string };

export default function CriaStories() {
  const { profile } = useProfile();
  const { isStudio, isLoading: tierLoading } = useTier();
  const { openCria } = useCriaAI();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const isAdmin = profile?.role === "admin";

  const tab: "criar" | "semana" = pathname.endsWith("/semanastories") ? "semana" : "criar";

  // Config (aba Criar)
  const [perDia, setPerDia] = useState(3);
  const [dias, setDias] = useState(7);
  const [startDate, setStartDate] = useState(localIso());
  // Semana (aba Semana)
  const [weekStart, setWeekStart] = useState<Date>(() => sundayOf(new Date()));
  const [editor, setEditor] = useState<EditorState>({ mode: "closed" });

  const weekFrom = localIso(weekStart);
  const weekTo = isoAddDays(weekFrom, 6);

  const { data: trends = [], isLoading: trendsLoading } = useStoryTrends();
  const { data: slots = [] } = useStorySlots(weekFrom, weekTo);
  const { data: posts = [] } = useScheduledPostsInRange(weekFrom, weekTo);

  const gen = useGenerateStoryPlan();
  const upd = useUpdateStorySlot();
  const del = useDeleteStorySlot();
  const add = useAddStorySlot();

  const lastUpdated = trends[0]?.created_at ? new Date(trends[0].created_at) : null;

  const gerarPlano = () => {
    gen.mutate(
      { perDia, dias, startDate, nicho: profile?.niche ?? undefined, tendencias: storyTrendsToContext(trends), replaceRange: true },
      { onSuccess: () => { setWeekStart(sundayOf(new Date(startDate + "T00:00:00"))); goTab("semana"); } },
    );
  };
  const goTab = (t: "criar" | "semana") => navigate(t === "semana" ? "/app/stories/semanastories" : "/app/stories");

  const adicionarNaSemana = (t: StoryTrend) => {
    add.mutate({ slot_date: localIso(), title: t.title, format: t.format, script: t.example ?? t.description ?? null });
  };
  const gerarNoCriaAI = (t: StoryTrend) => {
    openCria(`Quero adaptar esta tendência de STORIES pro meu nicho: "${t.title}"${t.description ? ` — ${t.description}` : ""} (formato: ${t.format}). Me dá 3 sequências de stories prontas pra gravar, com o texto que vai na tela e a interação sugerida, no meu tom.`);
  };

  // ── Guard Studio ───────────────────────────────────────────────
  if (!tierLoading && !isStudio) {
    return (
      <div className="pb-24 md:pb-0">
        <Header lastUpdated={null} />
        <div className="border border-dashed border-border rounded-2xl py-16 px-6 text-center mt-4">
          <Lock className="h-7 w-7 text-muted-foreground/40 mx-auto mb-3" strokeWidth={1.5} />
          <p className="text-sm font-body text-foreground font-medium">Cria Stories é um recurso do plano Studio</p>
          <p className="text-xs font-body text-muted-foreground mt-1 max-w-sm mx-auto">Gere um plano semanal de stories baseado no que está em alta e adaptado ao seu nicho.</p>
          <Button asChild className="mt-5"><Link to="/app/assinar">Conhecer o Studio</Link></Button>
        </div>
      </div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} className="pb-24 md:pb-0">
      <Header lastUpdated={lastUpdated} />

      {/* Abas */}
      <div className="flex gap-1 mt-4 mb-5 bg-muted/40 rounded-xl p-1 w-fit">
        <TabBtn active={tab === "criar"} onClick={() => goTab("criar")} icon={<Wand2 className="h-4 w-4" />}>Criar</TabBtn>
        <TabBtn active={tab === "semana"} onClick={() => goTab("semana")} icon={<CalendarDays className="h-4 w-4" />}>Semana</TabBtn>
      </div>

      {tab === "criar" ? (
        <>
          {/* Config + gerar */}
          <div className="bg-card border border-border rounded-2xl p-4">
            <div className="flex flex-col gap-4 md:flex-row md:items-end md:flex-wrap md:gap-6">
              <Field label="Stories por dia">
                <div className="flex gap-1">
                  {PER_DAY.map((n) => (
                    <button key={n} onClick={() => setPerDia(n)} className={cn("w-9 h-9 rounded-lg text-sm font-body border transition-colors", perDia === n ? "bg-primary text-primary-foreground border-primary" : "bg-card border-border text-muted-foreground hover:text-foreground")}>{n}</button>
                  ))}
                </div>
              </Field>
              <Field label="Período">
                <div className="flex gap-1 flex-wrap">
                  {PERIODS.map((p) => (
                    <button key={p.days} onClick={() => setDias(p.days)} className={cn("px-3 h-9 rounded-lg text-sm font-body border transition-colors", dias === p.days ? "bg-primary text-primary-foreground border-primary" : "bg-card border-border text-muted-foreground hover:text-foreground")}>{p.label}</button>
                  ))}
                </div>
              </Field>
              <Field label="Começar em">
                <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value || localIso())} className="h-9 w-[150px]" />
              </Field>
              <div className="md:ml-auto">
                <Button onClick={gerarPlano} disabled={gen.isPending} className="h-10 w-full md:w-auto">
                  {gen.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Wand2 className="h-4 w-4 mr-2" />}
                  Gerar plano
                </Button>
              </div>
            </div>
            <p className="text-xs font-body text-muted-foreground mt-3">
              Gera até {perDia * dias} stories com a IA e joga na aba <button onClick={() => goTab("semana")} className="text-primary font-medium">Semana</button> pra você organizar.
            </p>
          </div>

          {/* Banco de tendências */}
          <div className="mt-6">
            <div className="flex items-center gap-2 mb-3">
              <Globe className="h-4 w-4 text-primary" />
              <h2 className="text-sm font-display font-bold text-foreground">Stories em alta</h2>
              <span className="text-xs font-body text-muted-foreground">— puxe as que quiser pra sua semana</span>
            </div>
            {trendsLoading ? (
              <div className="py-8 text-center"><Loader2 className="h-5 w-5 text-primary mx-auto animate-spin" /></div>
            ) : trends.length === 0 ? (
              <div className="border border-dashed border-border rounded-xl py-8 px-6 text-center">
                <p className="text-sm font-body text-foreground font-medium">Banco de stories ainda não atualizado</p>
                <p className="text-xs font-body text-muted-foreground mt-1">{isAdmin ? "Gere a primeira leva pelo Painel Admin → Banco de Stories." : "Em breve a curadoria do CRIA traz as novidades aqui."}</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {trends.map((t) => {
                  const st = fmtStyle(t.format);
                  return (
                    <div key={t.id} className="bg-card border border-border rounded-xl p-4 flex flex-col">
                      <span className="text-[11px] font-body px-2 py-0.5 rounded-full self-start capitalize" style={{ background: st.bg, color: st.fg }}>{t.format}</span>
                      <p className="text-[15px] font-body font-semibold text-foreground mt-2 leading-snug">{t.title}</p>
                      {t.description && <p className="text-[13px] font-body text-muted-foreground mt-1.5 leading-relaxed">{t.description}</p>}
                      {t.example && (
                        <p className="text-[12.5px] font-body text-foreground/90 mt-2 bg-primary/[0.06] border border-primary/10 rounded-lg px-2.5 py-2 leading-relaxed">
                          <span className="font-semibold text-primary">Exemplo:</span> {t.example}
                        </p>
                      )}
                      {t.why_trending && <p className="text-[12px] font-body text-primary/80 mt-1.5">↗ {t.why_trending}</p>}
                      <div className="mt-3 pt-2.5 border-t border-border/60">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button className="text-[12px] font-medium text-primary flex items-center gap-1 hover:underline">
                              <Wand2 className="h-3.5 w-3.5" /> Usar tendência <ChevronDown className="h-3 w-3" />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="start">
                            <DropdownMenuItem onClick={() => adicionarNaSemana(t)}>
                              <Plus className="h-3.5 w-3.5 mr-2" /> Adicionar à semana
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => gerarNoCriaAI(t)}>
                              <Sparkles className="h-3.5 w-3.5 mr-2" /> Gerar ideia no Cria IA
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </>
      ) : (
        <StoryWeekView
          weekStart={weekStart}
          slots={slots}
          posts={posts}
          today={localIso()}
          onShiftWeek={(delta) => setWeekStart((w) => { const d = new Date(w); d.setDate(d.getDate() + delta); return d; })}
          onToday={() => setWeekStart(sundayOf(new Date()))}
          onReschedule={(id, dateIso) => upd.mutate({ id, patch: { slot_date: dateIso } })}
          onSlotClick={(slot) => setEditor({ mode: "edit", slot })}
          onToggleDone={(slot) => upd.mutate({ id: slot.id, patch: { status: slot.status === "feito" ? "pendente" : "feito" } })}
          onDeleteSlot={(id) => del.mutate(id)}
          onAddDay={(dateIso) => setEditor({ mode: "create", date: dateIso })}
        />
      )}

      <StorySlotDialog
        state={editor}
        onClose={() => setEditor({ mode: "closed" })}
        onSaveEdit={(id, patch) => { upd.mutate({ id, patch }); setEditor({ mode: "closed" }); }}
        onCreate={(input) => { add.mutate(input); setEditor({ mode: "closed" }); }}
      />
    </motion.div>
  );
}

function TabBtn({ active, onClick, icon, children }: { active: boolean; onClick: () => void; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <button onClick={onClick} className={cn("flex items-center gap-1.5 px-4 h-9 rounded-lg text-sm font-body font-medium transition-colors", active ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}>
      {icon}{children}
    </button>
  );
}

function Header({ lastUpdated }: { lastUpdated: Date | null }) {
  return (
    <div className="flex items-center gap-3">
      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-purple-600 flex items-center justify-center shadow-sm shrink-0">
        <Clapperboard className="h-5 w-5 text-white" strokeWidth={1.75} />
      </div>
      <div>
        <h1 className="text-2xl sm:text-3xl font-display font-extrabold text-foreground tracking-tight">Cria Stories</h1>
        <p className="text-muted-foreground font-body text-sm mt-0.5 flex items-center gap-1.5">
          {lastUpdated ? (<><Globe className="h-3.5 w-3.5 text-primary" /> Pesquisado na web · atualizado em {lastUpdated.toLocaleDateString("pt-BR")}</>) : "Plano semanal de stories, no que está em alta e no seu tom."}
        </p>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[10px] font-body font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">{label}</p>
      {children}
    </div>
  );
}

function StorySlotDialog({
  state, onClose, onSaveEdit, onCreate,
}: {
  state: EditorState;
  onClose: () => void;
  onSaveEdit: (id: string, patch: Partial<Pick<StorySlot, "title" | "script" | "format" | "slot_time">> & { notify_title?: string | null; notify_body?: string | null }) => void;
  onCreate: (input: { slot_date: string; title: string; slot_time?: string | null; script?: string | null; format?: string | null; notify_title?: string | null; notify_body?: string | null; weekdays?: number[]; weeks?: number }) => void;
}) {
  const open = state.mode !== "closed";
  const editing = state.mode === "edit" ? state.slot : null;

  const [title, setTitle] = useState("");
  const [script, setScript] = useState("");
  const [format, setFormat] = useState("");
  const [time, setTime] = useState("");
  const [notifyOn, setNotifyOn] = useState(false);
  const [notifyBody, setNotifyBody] = useState("");
  const [recurOn, setRecurOn] = useState(false);
  const [weekdays, setWeekdays] = useState<number[]>([]);
  const [weeks, setWeeks] = useState(4);
  const [seededKey, setSeededKey] = useState<string>("");

  const key = state.mode === "edit" ? `e:${state.slot.id}` : state.mode === "create" ? `c:${state.date}` : "";
  if (open && key !== seededKey) {
    setSeededKey(key);
    setTitle(editing?.title ?? "");
    setScript(editing?.script ?? "");
    setFormat(editing?.format ?? "");
    setTime(editing?.slot_time ? editing.slot_time.slice(0, 5) : "");
    setNotifyOn(!!editing?.notify_title);
    setNotifyBody(editing?.notify_body ?? "");
    setRecurOn(false);
    setWeekdays([]);
    setWeeks(4);
  }

  const WD = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
  const toggleWd = (i: number) => setWeekdays((w) => (w.includes(i) ? w.filter((x) => x !== i) : [...w, i]));

  const save = () => {
    if (!title.trim()) return;
    const slot_time = /^\d{1,2}:\d{2}$/.test(time) ? time : null;
    const notify_title = notifyOn ? (title.trim().slice(0, 160)) : null;
    const notify_body = notifyOn ? (notifyBody.trim() || null) : null;
    if (state.mode === "edit") {
      onSaveEdit(state.slot.id, { title: title.trim(), script: script.trim() || null, format: format.trim() || null, slot_time, notify_title, notify_body });
      // "Repetir esse story em mais dias" — cria cópias sem mexer no original.
      if (recurOn && weekdays.length) {
        onCreate({
          slot_date: state.slot.slot_date, title: title.trim(), script: script.trim() || null, format: format.trim() || null, slot_time,
          notify_title, notify_body, weekdays, weeks,
        });
      }
    } else if (state.mode === "create") {
      onCreate({
        slot_date: state.date, title: title.trim(), script: script.trim() || null, format: format.trim() || null, slot_time,
        notify_title, notify_body,
        weekdays: recurOn && weekdays.length ? weekdays : undefined,
        weeks: recurOn ? weeks : undefined,
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="sm:max-w-md rounded-2xl max-h-[88vh] overflow-y-auto">
        <DialogHeader><DialogTitle className="font-display">{editing ? "Editar story" : "Novo story"}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <p className="text-[11px] font-body font-semibold text-muted-foreground uppercase tracking-wider mb-1">Título</p>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex: Caixinha de perguntas sobre bastidores" />
          </div>
          <div>
            <p className="text-[11px] font-body font-semibold text-muted-foreground uppercase tracking-wider mb-1">Roteiro / ideia</p>
            <Textarea value={script} onChange={(e) => setScript(e.target.value)} rows={3} placeholder="O que gravar e o texto que vai na tela…" />
          </div>
          <div className="flex gap-3">
            <div className="flex-1">
              <p className="text-[11px] font-body font-semibold text-muted-foreground uppercase tracking-wider mb-1">Formato</p>
              <Input value={format} onChange={(e) => setFormat(e.target.value)} placeholder="enquete, bastidor…" />
            </div>
            <div className="w-28">
              <p className="text-[11px] font-body font-semibold text-muted-foreground uppercase tracking-wider mb-1">Horário</p>
              <Input type="time" value={time} onChange={(e) => setTime(e.target.value)} />
            </div>
          </div>

          {/* Notificação */}
          <div className="rounded-xl border border-border p-3">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={notifyOn} onChange={(e) => setNotifyOn(e.target.checked)} className="h-4 w-4 accent-primary" />
              <span className="text-sm font-body font-semibold text-foreground">Me lembrar no horário</span>
            </label>
            {notifyOn && (
              <div className="mt-2 space-y-2">
                {!time && <p className="text-[11px] font-body text-amber-600">Defina um horário acima pra receber o lembrete.</p>}
                <div>
                  <p className="text-[11px] font-body font-semibold text-muted-foreground uppercase tracking-wider mb-1">Texto do lembrete (opcional)</p>
                  <Textarea value={notifyBody} onChange={(e) => setNotifyBody(e.target.value)} rows={2} placeholder="Ex.: Grava a caixinha de perguntas dos bastidores!" />
                </div>
              </div>
            )}
          </div>

          {/* Recorrência: criar repetindo, ou repetir um story existente em mais dias */}
          <div className="rounded-xl border border-border p-3">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={recurOn} onChange={(e) => setRecurOn(e.target.checked)} className="h-4 w-4 accent-primary" />
                <span className="text-sm font-body font-semibold text-foreground">{editing ? "Repetir esse story em mais dias" : "Repetir toda semana"}</span>
              </label>
              {recurOn && (
                <div className="mt-2 space-y-2">
                  <p className="text-[11px] font-body text-muted-foreground">Em quais dias? ({weekdays.length}x por semana)</p>
                  <div className="flex flex-wrap gap-1.5">
                    {WD.map((d, i) => (
                      <button key={i} type="button" onClick={() => toggleWd(i)}
                        className={cn("h-8 px-2.5 rounded-lg text-xs font-body border transition-colors", weekdays.includes(i) ? "bg-primary text-primary-foreground border-primary" : "bg-card border-border text-muted-foreground")}>{d}</button>
                    ))}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-body text-muted-foreground">Por</span>
                    <Input type="number" min={1} max={12} value={weeks} onChange={(e) => setWeeks(Math.max(1, Math.min(12, Number(e.target.value) || 4)))} className="h-8 w-16" />
                    <span className="text-[11px] font-body text-muted-foreground">semanas</span>
                  </div>
                </div>
              )}
            </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={save} disabled={!title.trim()}>Salvar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
