import { useEffect, useState, useMemo } from "react";
import { createPortal } from "react-dom";
import { motion } from "framer-motion";
import { statusRamp } from "@/lib/statusRamp";
import {
  Lightbulb, FileText, CheckCircle2, Sparkles, Copy, Check,
  ListChecks, Pencil, Trash2, Clock, Flame, ArrowRight
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { useProfile } from "@/hooks/useProfile";
import { useActiveProfile } from "@/hooks/useActiveProfile";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { getDailyInsight } from "@/lib/ai/claude";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfYear, endOfYear, subDays, isWithinInterval, parseISO } from "date-fns";
import { sanitizeText } from "@/lib/sanitize";
import { useIdeas } from "@/hooks/useIdeas";
import { usePosts } from "@/hooks/usePosts";
import { useHabits } from "@/hooks/useHabits";
import { useTasks } from "@/hooks/useTasks";
import { usePillars } from "@/hooks/usePillars";
import { BestTimeToPost } from "@/components/insights/BestTimeToPost";
import { SmartNotificationsCard } from "@/components/notifications/SmartNotificationsCard";
import { NextBestAction } from "@/components/dashboard/NextBestAction";
import { UpcomingPosts } from "@/components/dashboard/UpcomingPosts";
import { UpcomingTasks } from "@/components/dashboard/UpcomingTasks";
import { WhoYouAre } from "@/components/dashboard/WhoYouAre";
import { PageSkeleton } from "@/components/shared/PageSkeleton";

const HOOKS_VIRAL = [
  { text: "Você sabia que [dado surpreendente]?", category: "curiosidade" },
  { text: "O erro que quase todo mundo comete sem perceber...", category: "problema" },
  { text: "3 coisas que eu faria diferente se começasse hoje", category: "storytelling" },
  { text: "Pare de [ação comum] se quiser [resultado]", category: "contraste" },
  { text: "A verdade que ninguém fala sobre [tema]", category: "polêmica" },
  { text: "Eu gastei [tempo] pra aprender isso — te conto em 60s", category: "curiosidade" },
  { text: "Se você [dor do público], esse vídeo é pra você", category: "identificação" },
  { text: "O segredo que [referência] não te conta", category: "promessa" },
  { text: "Todo mundo fala pra fazer X, mas ninguém fala que...", category: "contraste" },
  { text: "Eu perdi [algo] por não saber disso antes", category: "storytelling" },
  { text: "Você está fazendo [ação] errado. Veja porquê.", category: "problema" },
  { text: "O que [referência] faz que você não faz", category: "curiosidade" },
  { text: "Testei [método] por 30 dias. O resultado me surpreendeu.", category: "storytelling" },
  { text: "5 sinais de que você está [problema]", category: "identificação" },
  { text: "Por que [crença popular] está ERRADO", category: "polêmica" },
  { text: "Antes vs Depois de eu descobrir [solução]", category: "contraste" },
  { text: "Se eu pudesse voltar no tempo, diria isso a mim mesmo...", category: "storytelling" },
  { text: "Você NÃO precisa de [coisa cara] pra [resultado]", category: "promessa" },
  { text: "A fórmula que me ajudou a [resultado] em [tempo]", category: "promessa" },
  { text: "Me julga, mas eu faço [hábito controverso] e funciona", category: "polêmica" },
];

const getDaysOfWeek = () => {
  const today = new Date();
  const monday = new Date(today);
  monday.setDate(today.getDate() - ((today.getDay() + 6) % 7));
  const days = [];
  const dayNames = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    days.push({
      name: dayNames[i],
      date: d.toISOString().split("T")[0],
      dayNum: d.getDate(),
      isToday: d.toISOString().split("T")[0] === today.toISOString().split("T")[0],
    });
  }
  return days;
};

type PeriodKey = "tudo" | "hoje" | "semana" | "quinzenal" | "mes" | "ano" | "personalizado";

// `primary` periods are visible on mobile; the rest collapse to >= sm.
const PERIOD_OPTIONS: { key: PeriodKey; label: string; primary?: boolean }[] = [
  { key: "tudo", label: "Tudo", primary: true },
  { key: "hoje", label: "Hoje" },
  { key: "semana", label: "Semana", primary: true },
  { key: "quinzenal", label: "Quinzenal" },
  { key: "mes", label: "Mês", primary: true },
  { key: "ano", label: "Ano", primary: true },
  { key: "personalizado", label: "Personalizado" },
];

function getDateRange(period: PeriodKey, customRange?: { from: Date; to: Date }): { start: Date; end: Date } | null {
  const now = new Date();
  switch (period) {
    case "tudo": return null;
    case "hoje": return { start: new Date(now.getFullYear(), now.getMonth(), now.getDate()), end: now };
    case "semana": return { start: startOfWeek(now, { weekStartsOn: 1 }), end: endOfWeek(now, { weekStartsOn: 1 }) };
    case "quinzenal": return { start: subDays(now, 14), end: now };
    case "mes": return { start: startOfMonth(now), end: endOfMonth(now) };
    case "ano": return { start: startOfYear(now), end: endOfYear(now) };
    case "personalizado": return customRange ? { start: customRange.from, end: customRange.to } : null;
    default: return null;
  }
}

function isInRange(dateStr: string | null, range: { start: Date; end: Date } | null): boolean {
  if (!range || !dateStr) return !range;
  try {
    const d = parseISO(dateStr.split("T")[0]);
    return isWithinInterval(d, { start: range.start, end: range.end });
  } catch { return false; }
}

function DCard({ children, className, onClick }: { children: React.ReactNode; className?: string; onClick?: () => void }) {
  return (
    <div
      onClick={onClick}
      className={cn("bg-card rounded-xl p-5 shadow-[var(--shadow-warm)] border border-border", className, onClick && "cursor-pointer hover:border-primary/30 transition-all")}
    >
      {children}
    </div>
  );
}

const Dashboard = () => {
  const { user } = useAuth();
  const { profile, isLoading: profileLoading } = useProfile();
  // Saudação/avatar do header refletem a CONTA ATIVA (não a manager).
  const { profile: activeProfile } = useActiveProfile();
  const navigate = useNavigate();

  const today = useMemo(() => new Date().toISOString().split("T")[0], []);
  const weekDays = useMemo(() => getDaysOfWeek(), []);

  const { ideas, createIdea } = useIdeas({ limit: 20 });
  const { posts } = usePosts({ limit: 20 });
  const {
    habits,
    habitLogs,
    createHabit,
    updateHabit: updateHabitMutation,
    deleteHabit,
    toggleHabitLog,
  } = useHabits({ date: today, limit: 20 });
  const { tasks } = useTasks({ limit: 20 });
  const { pillars } = usePillars();

  const editorialDays = useMemo(() => ["SEG", "TER", "QUA", "QUI", "SEX", "SÁB", "DOM"], []);
  const todayIndex = useMemo(() => {
    const d = new Date().getDay();
    return d === 0 ? 6 : d - 1;
  }, []);

  const [period, setPeriod] = useState<PeriodKey>("semana");
  const [customRange, setCustomRange] = useState<{ from: Date; to: Date }>({ from: new Date(), to: new Date() });
  const [, setCustomOpen] = useState(false);

  const dateRange = useMemo(() => getDateRange(period, customRange), [period, customRange]);

  const [quickIdea, setQuickIdea] = useState("");
  const [, setAiInsight] = useState<string | null>(null);
  const [copiedHook, setCopiedHook] = useState(false);
  const [newHabitName, setNewHabitName] = useState("");
  const [editingHabitId, setEditingHabitId] = useState<string | null>(null);
  const [editingHabitName, setEditingHabitName] = useState("");

  useEffect(() => {
    if (!user || !posts.length) return;
    const publishedPosts = posts.filter(p => p.status === "publicado");
    if (publishedPosts.length < 3) return;
    const cacheKey = `daily-insight-${user.id}-${today}`;
    const cached = localStorage.getItem(cacheKey);
    if (cached) { setAiInsight(cached); return; }
    const weekPosts = posts.filter(p => p.published_at && weekDays.some(d => d.date === p.published_at?.split("T")[0]));
    const pillarCounts: Record<string, number> = {};
    publishedPosts.forEach(p => { pillarCounts[p.platform] = (pillarCounts[p.platform] || 0) + 1; });
    const topPillar = Object.entries(pillarCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || "";
    getDailyInsight({
      postsThisWeek: weekPosts.length,
      weeklyGoal: profile?.weekly_goal || 3,
      topPillar,
      lastPublished: publishedPosts[publishedPosts.length - 1]?.published_at || "",
    }, user?.id)
      .then(insight => { if (insight) { setAiInsight(insight); localStorage.setItem(cacheKey, insight); } })
      .catch(() => { /* noop */ });
  }, [posts, user, profile, today, weekDays]);

  const handleQuickCapture = async () => {
    const sanitized = sanitizeText(quickIdea);
    if (!sanitized || !user) return;
    try {
      await createIdea.mutateAsync({ title: sanitized });
      toast.success("Ideia capturada!");
      setQuickIdea("");
    } catch {
      toast.error("Erro ao salvar ideia.");
    }
  };

  const handleToggleHabit = async (habitId: string) => {
    try {
      await toggleHabitLog.mutateAsync({ habitId, date: today });
    } catch {
      toast.error("Erro ao atualizar hábito.");
    }
  };

  const addHabit = async () => {
    const sanitized = sanitizeText(newHabitName);
    if (!sanitized) return;
    try {
      await createHabit.mutateAsync({ name: sanitized });
      setNewHabitName("");
      toast.success("Hábito adicionado!");
    } catch {
      toast.error("Erro ao adicionar hábito.");
    }
  };

  const handleDeleteHabit = async (habitId: string) => {
    try {
      await deleteHabit.mutateAsync(habitId);
      toast.success("Hábito removido.");
    } catch {
      toast.error("Erro ao remover hábito.");
    }
  };

  const handleUpdateHabit = async (habitId: string) => {
    const sanitized = sanitizeText(editingHabitName);
    if (!sanitized) return;
    try {
      await updateHabitMutation.mutateAsync({ id: habitId, name: sanitized });
      setEditingHabitId(null);
      setEditingHabitName("");
    } catch {
      toast.error("Erro ao atualizar hábito.");
    }
  };

  const handleCopyHook = async () => {
    await navigator.clipboard.writeText(dailyHook.text);
    setCopiedHook(true);
    setTimeout(() => setCopiedHook(false), 2000);
  };

  const filteredPosts = useMemo(() => {
    if (!dateRange) return posts;
    return posts.filter(p => isInRange(p.scheduled_date, dateRange) || isInRange(p.published_at, dateRange));
  }, [posts, dateRange]);

  const filteredTasks = useMemo(() => {
    if (!dateRange) return tasks;
    return tasks.filter(t => isInRange(t.due_date, dateRange));
  }, [tasks, dateRange]);

  const publishedFiltered = filteredPosts.filter(p => p.status === "publicado");
  const inCreationFiltered = filteredPosts.filter(p => p.status !== "publicado");
  const scheduledFiltered = filteredPosts.filter(p => p.scheduled_date && p.status !== "publicado");
  const pendingTasks = filteredTasks.filter(t => t.status === "pendente");
  const inProgressTasks = filteredTasks.filter(t => t.status === "em_andamento");

  const habitsToday = habitLogs.filter(l => l.done).length;

  const now = new Date();
  const dayOfYear = Math.floor((now.getTime() - new Date(now.getFullYear(), 0, 0).getTime()) / 86400000);
  const dailyHook = HOOKS_VIRAL[dayOfYear % HOOKS_VIRAL.length];

  const ramp = statusRamp();
  const RAMP_ORDER = ["ideia","roteiro","gravando","editando","agendado","publicado"] as const;
  const stats = [
    { label: "Ideias", value: ideas.length, icon: Lightbulb, link: "/app/ideias" },
    { label: "Em criação", value: inCreationFiltered.length, icon: FileText, link: "/app/criando" },
    { label: "Publicados", value: publishedFiltered.length, icon: CheckCircle2, link: "/app/historico" },
    { label: "Agendados", value: scheduledFiltered.length, icon: Clock, link: "/app/criando" },
    { label: "Tarefas abertas", value: pendingTasks.length + inProgressTasks.length, icon: ListChecks, link: "/app/tarefas" },
    { label: "Hábitos hoje", value: `${habitsToday}/${habits.length}`, icon: Flame, link: "/app" },
  ].map((s, i) => ({ ...s, accent: ramp[RAMP_ORDER[i]] }));

  const [heroSlot, setHeroSlot] = useState<HTMLElement | null>(null);
  useEffect(() => { setHeroSlot(document.getElementById("cria-hero-slot")); }, []);

  const renderPeriodFilter = (onBand: boolean) =>
    PERIOD_OPTIONS.map((opt) => {
      const active = period === opt.key;
      return (
        <button
          key={opt.key}
          onClick={() => {
            setPeriod(opt.key);
            if (opt.key === "personalizado") setCustomOpen(true);
          }}
          className={cn(
            "rounded-full px-3 py-1 text-xs font-body transition-all duration-200",
            !opt.primary && "hidden sm:inline-flex",
            onBand
              ? (active
                  ? "bg-white text-foreground font-semibold shadow-sm"
                  : "text-white/75 font-medium hover:bg-white/10 hover:text-white")
              : (active
                  ? "bg-primary text-primary-foreground font-semibold"
                  : "text-muted-foreground font-medium hover:bg-muted"),
          )}
        >
          {opt.label}
        </button>
      );
    });

  if (profileLoading) {
    return (
      <div className="pb-20 md:pb-0">
        <PageSkeleton />
      </div>
    );
  }

  return (
    <div className="pb-20 md:pb-0">
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>

        <div className="flex sm:justify-end gap-3 mb-6 md:hidden">
          <div className="flex items-center gap-0.5 bg-muted/50 rounded-full p-1 flex-wrap">
            {renderPeriodFilter(false)}
          </div>
        </div>
        {heroSlot && createPortal(renderPeriodFilter(true), heroSlot)}

        <div className="mb-4">
          <NextBestAction />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

          <div className="lg:col-span-8 space-y-6">
            <div className="grid grid-cols-2 gap-3 sm:gap-4">
              {stats.map((s, i) => (
                <motion.button
                  key={i}
                  onClick={() => navigate(s.link)}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className={cn(
                    "relative overflow-hidden px-3 py-2.5 sm:px-4 sm:py-3 rounded-2xl border border-primary/10 bg-primary/[0.05]",
                    "hover:shadow-sm hover:scale-[1.02] active:scale-[0.98] transition-all duration-200",
                    "text-left w-full group cursor-pointer"
                  )}
                >
                  <div className="flex items-center gap-2.5 sm:gap-3 min-w-0 pr-5">
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center shadow-sm shrink-0" style={{ backgroundColor: s.accent.line }}>
                      <s.icon className="h-4 w-4 sm:h-4.5 sm:w-4.5 text-white" strokeWidth={1.75} />
                    </div>
                    <div className="min-w-0 flex-1 flex items-baseline gap-1.5">
                      <p className="text-xl sm:text-2xl font-display font-extrabold text-foreground tracking-tight leading-none">{s.value}</p>
                      <p className="text-[10px] sm:text-[11px] uppercase tracking-wider font-body font-semibold text-muted-foreground truncate">{s.label}</p>
                    </div>
                  </div>
                  <ArrowRight className="absolute top-1/2 -translate-y-1/2 right-3 h-4 w-4 text-muted-foreground/30 group-hover:text-foreground/50 group-hover:translate-x-0.5 transition-all" />
                </motion.button>
              ))}
            </div>

            <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
              <UpcomingPosts />
              <UpcomingTasks />
            </div>

            <section className="bg-card border border-border/30 rounded-2xl p-4 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-display font-semibold text-foreground">
                  Linha Editorial
                </h3>
                <span className="text-xs text-muted-foreground font-body">
                  baseada nos seus pilares
                </span>
              </div>

              {pillars.length > 0 ? (
                <div className="grid grid-cols-7 gap-1.5">
                  {editorialDays.map((day, index) => {
                    const pilarId = profile?.editorial_line?.[day];
                    const pilar = pilarId ? pillars.find(p => p.id === pilarId) : undefined;
                    const isToday = index === todayIndex;
                    return (
                      <div
                        key={day}
                        className={cn(
                          "flex flex-col items-center gap-1.5 rounded-xl p-2 transition-colors min-w-0",
                          isToday
                            ? "bg-primary/10 border border-primary/20"
                            : "bg-muted/20 border border-transparent"
                        )}
                      >
                        <span
                          className={cn(
                            "text-[10px] font-body font-semibold uppercase tracking-wide",
                            isToday ? "text-primary" : "text-muted-foreground"
                          )}
                        >
                          {day}
                        </span>
                        <div
                          className="w-2.5 h-2.5 rounded-full shrink-0"
                          style={{ backgroundColor: pilar?.color || "#d4d4d8" }}
                        />
                        <span
                          className={cn(
                            "text-[9px] font-body text-center leading-tight line-clamp-2 w-full break-words",
                            isToday ? "text-foreground font-medium" : "text-muted-foreground"
                          )}
                        >
                          {pilar?.name || "—"}
                        </span>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground font-body text-center py-2">
                  Cadastre seus pilares em{" "}
                  <button
                    onClick={() => navigate("/app/configuracoes")}
                    className="text-primary underline"
                  >
                    Configurações
                  </button>{" "}
                  para ver sua linha editorial.
                </p>
              )}
            </section>

            <DCard className="relative overflow-hidden bg-gradient-to-br from-primary/5 via-transparent to-primary/10 border-primary/15 group">
              <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity">
                <Sparkles className="h-24 w-24 text-primary" />
              </div>
              <h3 className="font-display font-semibold text-foreground mb-4 flex items-center gap-2">
                <Lightbulb className="h-4 w-4 text-primary" /> Captura Rápida
              </h3>
              <div className="flex flex-col sm:flex-row gap-2">
                <Input
                  placeholder="O que você está pensando?"
                  className="rounded-xl border-border bg-background/50 h-11"
                  value={quickIdea}
                  onChange={(e) => setQuickIdea(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleQuickCapture()}
                />
                <Button onClick={handleQuickCapture} variant="hero" size="lg" className="w-full sm:w-auto">Capturar</Button>
              </div>
            </DCard>

            <DCard className="bg-gradient-to-br from-amber-50 to-orange-50 border-amber-200/50 dark:from-amber-500/10 dark:to-orange-500/5 dark:border-amber-500/20">
              <h3 className="text-sm font-display font-bold text-amber-700 dark:text-amber-400 mb-2 flex items-center gap-1.5">
                <div className="w-6 h-6 rounded-lg bg-amber-500 flex items-center justify-center">
                  <Sparkles className="h-3.5 w-3.5 text-white" />
                </div>
                Gancho do Dia
              </h3>
              <p className="text-sm font-body text-foreground italic mb-4 leading-relaxed">
                "{dailyHook.text}"
              </p>
              <Button variant="outline" size="sm" onClick={handleCopyHook} className="w-full bg-white/60 dark:bg-background/40 border-amber-300/40 hover:bg-white text-amber-700 dark:text-amber-300">
                {copiedHook ? <><Check className="h-3.5 w-3.5 mr-2" /> Copiado</> : <><Copy className="h-3.5 w-3.5 mr-2" /> Copiar hook</>}
              </Button>
            </DCard>
          </div>

          <div className="lg:col-span-4 space-y-6">
            <WhoYouAre />
            <SmartNotificationsCard />
             <DCard className="border-border/20">
              <h3 className="font-display font-semibold text-foreground mb-4 flex items-center gap-2">
                <Flame className="h-4 w-4 text-primary" /> Hábitos de Criação
              </h3>
              <div className="space-y-3">
                {habits.map(h => {
                  const done = habitLogs.some(l => l.habit_id === h.id && l.done);
                  return (
                    <div key={h.id} className="flex items-center justify-between group">
                      <div className="flex items-center gap-3">
                        <Checkbox checked={done} onCheckedChange={() => handleToggleHabit(h.id)} />
                        {editingHabitId === h.id ? (
                          <Input
                            value={editingHabitName}
                            onChange={(e) => setEditingHabitName(e.target.value)}
                            onKeyDown={(e) => e.key === "Enter" && handleUpdateHabit(h.id)}
                            onBlur={() => setEditingHabitId(null)}
                            className="h-8 text-sm py-0 rounded-lg"
                            autoFocus
                          />
                        ) : (
                          <span className={cn("text-sm font-body", done && "line-through text-muted-foreground")}>{h.name}</span>
                        )}
                      </div>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => { setEditingHabitId(h.id); setEditingHabitName(h.name); }} className="p-1 hover:bg-accent rounded text-muted-foreground"><Pencil className="h-3 w-3" /></button>
                        <button onClick={() => handleDeleteHabit(h.id)} className="p-1 hover:bg-destructive/10 rounded text-destructive"><Trash2 className="h-3 w-3" /></button>
                      </div>
                    </div>
                  );
                })}
                <div className="pt-2">
                  <Input
                    placeholder="Novo hábito..."
                    className="h-9 text-xs rounded-xl"
                    value={newHabitName}
                    onChange={(e) => setNewHabitName(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && addHabit()}
                  />
                </div>
              </div>
            </DCard>

            <BestTimeToPost posts={posts} />
          </div>

        </div>
      </motion.div>
    </div>
  );
};

export default Dashboard;
