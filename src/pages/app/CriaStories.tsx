import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  Clapperboard, Loader2, Wand2, Globe, Sparkles, Check, Pencil, Trash2,
  Plus, Lock, CalendarClock, Instagram,
} from "lucide-react";
import { format as fmt } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { useProfile } from "@/hooks/useProfile";
import { useTier } from "@/hooks/useTier";
import { useCriaAI } from "@/contexts/CriaAIContext";
import { useStoryTrends, storyTrendsToContext, type StoryTrend } from "@/hooks/useStoryTrends";
import {
  useStorySlots, useScheduledPostsInRange, useGenerateStoryPlan,
  useUpdateStorySlot, useDeleteStorySlot, useAddStorySlot, type StorySlot,
} from "@/hooks/useStoryPlan";

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

const FORMAT_STYLE: Record<string, { bg: string; fg: string }> = {
  enquete: { bg: "#EEEDFE", fg: "#3C3489" },
  caixinha: { bg: "#E1F5EE", fg: "#085041" },
  bastidor: { bg: "#FAEEDA", fg: "#854F0B" },
  tutorial: { bg: "#E7F0FB", fg: "#1E4B8F" },
  "antes-depois": { bg: "#FBEAF0", fg: "#72243E" },
  "dica-rapida": { bg: "#EAF7E9", fg: "#2E6B2C" },
  contagem: { bg: "#FDEEE6", fg: "#8A3B14" },
  quiz: { bg: "#F0EAFB", fg: "#5B2A86" },
};
function fmtStyle(f: string | null) {
  const key = (f || "").toLowerCase();
  return FORMAT_STYLE[key] ?? { bg: "#EFEFEF", fg: "#555" };
}

type EditorState =
  | { mode: "closed" }
  | { mode: "edit"; slot: StorySlot }
  | { mode: "create"; date: string };

export default function CriaStories() {
  const { profile } = useProfile();
  const { isStudio, isLoading: tierLoading } = useTier();
  const { openCria } = useCriaAI();
  const isAdmin = profile?.role === "admin";

  const [perDia, setPerDia] = useState(3);
  const [dias, setDias] = useState(7);
  const [startDate, setStartDate] = useState(localIso());
  const [editor, setEditor] = useState<EditorState>({ mode: "closed" });

  const endDate = useMemo(() => isoAddDays(startDate, dias - 1), [startDate, dias]);

  const { data: trends = [], isLoading: trendsLoading } = useStoryTrends();
  const { data: slots = [] } = useStorySlots(startDate, endDate);
  const { data: posts = [] } = useScheduledPostsInRange(startDate, endDate);

  const gen = useGenerateStoryPlan();
  const upd = useUpdateStorySlot();
  const del = useDeleteStorySlot();
  const add = useAddStorySlot();

  const lastUpdated = trends[0]?.created_at ? new Date(trends[0].created_at) : null;

  const days = useMemo(
    () => Array.from({ length: dias }, (_, i) => isoAddDays(startDate, i)),
    [startDate, dias],
  );
  const slotsByDay = useMemo(() => {
    const m: Record<string, StorySlot[]> = {};
    for (const s of slots) (m[s.slot_date] ??= []).push(s);
    return m;
  }, [slots]);
  const postsByDay = useMemo(() => {
    const m: Record<string, typeof posts> = {};
    for (const p of posts) if (p.scheduled_date) (m[p.scheduled_date] ??= []).push(p);
    return m;
  }, [posts]);

  const doneCount = slots.filter((s) => s.status === "feito").length;

  const gerarPlano = () => {
    gen.mutate({
      perDia, dias, startDate,
      nicho: profile?.niche ?? undefined,
      tendencias: storyTrendsToContext(trends),
      replaceRange: true,
    });
  };

  const adaptar = (t: StoryTrend) => {
    openCria(
      `Quero adaptar esta tendência de STORIES pro meu nicho e personalidade: "${t.title}"${t.description ? ` — ${t.description}` : ""} (formato: ${t.format}). Me dá 3 ideias de sequência de stories prontas pra gravar, com o texto que vai na tela e uma dica de interação (enquete/caixinha), no meu tom.`,
    );
  };

  // ── Guard de Studio ────────────────────────────────────────────
  if (!tierLoading && !isStudio) {
    return (
      <div className="pb-24 md:pb-0">
        <Header lastUpdated={null} />
        <div className="border border-dashed border-border rounded-2xl py-16 px-6 text-center mt-4">
          <Lock className="h-7 w-7 text-muted-foreground/40 mx-auto mb-3" strokeWidth={1.5} />
          <p className="text-sm font-body text-foreground font-medium">Cria Stories é um recurso do plano Studio</p>
          <p className="text-xs font-body text-muted-foreground mt-1 max-w-sm mx-auto">
            Gere um plano semanal de stories baseado no que está em alta e adaptado ao seu nicho.
          </p>
          <Button asChild className="mt-5"><Link to="/app/assinar">Conhecer o Studio</Link></Button>
        </div>
      </div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} className="pb-24 md:pb-0">
      <Header lastUpdated={lastUpdated} />

      {/* Config + gerar */}
      <div className="bg-card border border-border rounded-2xl p-4 mt-4">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:flex-wrap md:gap-6">
          <Field label="Stories por dia">
            <div className="flex gap-1">
              {PER_DAY.map((n) => (
                <button key={n} onClick={() => setPerDia(n)}
                  className={`w-9 h-9 rounded-lg text-sm font-body border transition-colors ${perDia === n ? "bg-primary text-primary-foreground border-primary" : "bg-card border-border text-muted-foreground hover:text-foreground"}`}>
                  {n}
                </button>
              ))}
            </div>
          </Field>

          <Field label="Período">
            <div className="flex gap-1 flex-wrap">
              {PERIODS.map((p) => (
                <button key={p.days} onClick={() => setDias(p.days)}
                  className={`px-3 h-9 rounded-lg text-sm font-body border transition-colors ${dias === p.days ? "bg-primary text-primary-foreground border-primary" : "bg-card border-border text-muted-foreground hover:text-foreground"}`}>
                  {p.label}
                </button>
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
        {slots.length > 0 && (
          <p className="text-xs font-body text-muted-foreground mt-3">
            {slots.length} stories no período · {doneCount} feito{doneCount === 1 ? "" : "s"}.
            <span className="text-muted-foreground/70"> Gerar de novo substitui o período.</span>
          </p>
        )}
      </div>

      {/* Banco de tendências de stories */}
      <div className="mt-6">
        <div className="flex items-center gap-2 mb-3">
          <Globe className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-display font-bold text-foreground">Stories em alta</h2>
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
                  {t.why_trending && <p className="text-[12px] font-body text-primary/80 mt-1.5">↗ {t.why_trending}</p>}
                  <button onClick={() => adaptar(t)} className="text-[12px] font-medium text-primary flex items-center gap-1 hover:underline mt-3 pt-2.5 border-t border-border/60 self-start">
                    <Wand2 className="h-3.5 w-3.5" /> Adaptar pro meu nicho
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Aba semanal */}
      <div className="mt-8">
        <div className="flex items-center gap-2 mb-3">
          <CalendarClock className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-display font-bold text-foreground">Sua semana</h2>
        </div>

        {slots.length === 0 && (
          <div className="border border-dashed border-border rounded-xl py-10 px-6 text-center mb-3">
            <Sparkles className="h-6 w-6 text-muted-foreground/40 mx-auto mb-2" strokeWidth={1.5} />
            <p className="text-sm font-body text-foreground font-medium">Nenhum story planejado ainda</p>
            <p className="text-xs font-body text-muted-foreground mt-1">Clique em <strong>Gerar plano</strong> ou adicione manualmente em cada dia.</p>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {days.map((iso) => {
            const daySlots = slotsByDay[iso] ?? [];
            const dayPosts = postsByDay[iso] ?? [];
            const label = fmt(new Date(iso + "T00:00:00"), "EEE, dd/MM", { locale: ptBR });
            const isToday = iso === localIso();
            return (
              <div key={iso} className={`bg-card border rounded-xl p-3 ${isToday ? "border-primary/40" : "border-border"}`}>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[13px] font-body font-semibold text-foreground capitalize">
                    {label}{isToday && <span className="ml-1.5 text-[10px] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary">hoje</span>}
                  </p>
                  <button onClick={() => setEditor({ mode: "create", date: iso })} className="text-muted-foreground hover:text-primary" aria-label="Adicionar story">
                    <Plus className="h-4 w-4" />
                  </button>
                </div>

                {dayPosts.map((p) => (
                  <div key={p.id} className="flex items-center gap-1.5 text-[11px] font-body text-muted-foreground bg-muted/40 rounded-lg px-2 py-1 mb-1.5">
                    <Instagram className="h-3 w-3 shrink-0" />
                    <span className="truncate">Post: {p.title || "sem título"}</span>
                    {p.scheduled_time && <span className="ml-auto shrink-0">{p.scheduled_time.slice(0, 5)}</span>}
                  </div>
                ))}

                {daySlots.length === 0 && dayPosts.length === 0 && (
                  <p className="text-[12px] font-body text-muted-foreground/60 py-2">Livre.</p>
                )}

                <div className="space-y-1.5">
                  {daySlots.map((s) => {
                    const st = fmtStyle(s.format);
                    const done = s.status === "feito";
                    return (
                      <div key={s.id} className={`rounded-lg border p-2 ${done ? "border-border/50 bg-muted/30" : "border-border"}`}>
                        <div className="flex items-start gap-2">
                          <button
                            onClick={() => upd.mutate({ id: s.id, patch: { status: done ? "pendente" : "feito" } })}
                            aria-label={done ? "Marcar como pendente" : "Marcar como feito"}
                            className={`mt-0.5 h-4 w-4 rounded-full border flex items-center justify-center shrink-0 ${done ? "bg-secondary border-secondary" : "border-muted-foreground/40"}`}
                          >
                            {done && <Check className="h-2.5 w-2.5 text-white" />}
                          </button>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              {s.slot_time && <span className="text-[11px] font-body text-muted-foreground">{s.slot_time.slice(0, 5)}</span>}
                              {s.format && <span className="text-[10px] font-body px-1.5 py-0.5 rounded-full capitalize" style={{ background: st.bg, color: st.fg }}>{s.format}</span>}
                            </div>
                            <p className={`text-[13px] font-body font-medium leading-snug ${done ? "line-through text-muted-foreground" : "text-foreground"}`}>{s.title}</p>
                            {s.script && <p className="text-[12px] font-body text-muted-foreground mt-0.5 leading-relaxed line-clamp-2">{s.script}</p>}
                          </div>
                          <div className="flex flex-col gap-1 shrink-0">
                            <button onClick={() => setEditor({ mode: "edit", slot: s })} className="text-muted-foreground hover:text-primary" aria-label="Editar"><Pencil className="h-3.5 w-3.5" /></button>
                            <button onClick={() => del.mutate(s.id)} className="text-muted-foreground hover:text-destructive" aria-label="Excluir"><Trash2 className="h-3.5 w-3.5" /></button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <StorySlotDialog
        state={editor}
        onClose={() => setEditor({ mode: "closed" })}
        onSaveEdit={(id, patch) => { upd.mutate({ id, patch }); setEditor({ mode: "closed" }); }}
        onCreate={(input) => { add.mutate(input); setEditor({ mode: "closed" }); }}
      />
    </motion.div>
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
          {lastUpdated ? (
            <><Globe className="h-3.5 w-3.5 text-primary" /> Pesquisado na web · atualizado em {lastUpdated.toLocaleDateString("pt-BR")}</>
          ) : "Plano semanal de stories, no que está em alta e no seu tom."}
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
  onSaveEdit: (id: string, patch: Partial<Pick<StorySlot, "title" | "script" | "format" | "slot_time">>) => void;
  onCreate: (input: { slot_date: string; title: string; slot_time?: string | null; script?: string | null; format?: string | null }) => void;
}) {
  const open = state.mode !== "closed";
  const editing = state.mode === "edit" ? state.slot : null;

  const [title, setTitle] = useState("");
  const [script, setScript] = useState("");
  const [format, setFormat] = useState("");
  const [time, setTime] = useState("");
  const [seededKey, setSeededKey] = useState<string>("");

  // Semeia os campos quando abre (sem useEffect: chave por id/data).
  const key = state.mode === "edit" ? `e:${state.slot.id}` : state.mode === "create" ? `c:${state.date}` : "";
  if (open && key !== seededKey) {
    setSeededKey(key);
    setTitle(editing?.title ?? "");
    setScript(editing?.script ?? "");
    setFormat(editing?.format ?? "");
    setTime(editing?.slot_time ? editing.slot_time.slice(0, 5) : "");
  }

  const save = () => {
    if (!title.trim()) return;
    const slot_time = /^\d{1,2}:\d{2}$/.test(time) ? time : null;
    if (state.mode === "edit") {
      onSaveEdit(state.slot.id, { title: title.trim(), script: script.trim() || null, format: format.trim() || null, slot_time });
    } else if (state.mode === "create") {
      onCreate({ slot_date: state.date, title: title.trim(), script: script.trim() || null, format: format.trim() || null, slot_time });
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="sm:max-w-md rounded-2xl">
        <DialogHeader><DialogTitle className="font-display">{editing ? "Editar story" : "Novo story"}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <p className="text-[11px] font-body font-semibold text-muted-foreground uppercase tracking-wider mb-1">Título</p>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex: Caixinha de perguntas sobre bastidores" />
          </div>
          <div>
            <p className="text-[11px] font-body font-semibold text-muted-foreground uppercase tracking-wider mb-1">Roteiro</p>
            <Textarea value={script} onChange={(e) => setScript(e.target.value)} rows={4} placeholder="O que gravar e o texto que vai na tela…" />
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
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={save} disabled={!title.trim()}>Salvar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
