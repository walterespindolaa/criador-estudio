import { useEffect, useMemo, useRef, useState } from "react";
import { EmptyState } from "@/components/shared/EmptyState";
import { useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { DragDropContext, Droppable, Draggable, type DropResult } from "@hello-pangea/dnd";
import { tocar } from "@/lib/pwa";
import { cn } from "@/lib/utils";
import { CoverHeader } from "@/components/shared/CoverHeader";
import { useStatusCovers } from "@/hooks/useStatusCovers";
import { useDragScroll } from "@/hooks/useDragScroll";
import { FormatPicker } from "@/components/kanban/FormatPicker";
import { useTour } from "@/components/tour/TourProvider";
import { statusRamp } from "@/lib/statusRamp";
import { Plus, LayoutDashboard, PenLine, Video, Scissors, Calendar, CheckCircle2, X, Kanban, Pencil, Table, Search, SlidersHorizontal, ArrowLeftRight, ArrowUp, ArrowDown, ArrowUpDown } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/contexts/AuthContext";
import { useActiveAccount } from "@/contexts/AccountContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { PostEditor } from "@/components/kanban/PostEditor";
import { FORMAT_LABELS, STATUS_OPTIONS, FORMATS } from "@/lib/constants";
import { formatColorVars, FORMAT_TEXT_CLASS, FORMAT_BORDER_CLASS } from "@/lib/format-colors";
import { getStatusClasses } from "@/lib/statusColors";
import { PlatformIcon } from "@/components/shared/PlatformIcon";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfYear, endOfYear, subDays, parseISO, isWithinInterval } from "date-fns";
import { hojeBR, parseDateOnly } from "@/lib/date-br";
import { usePosts, type Post } from "@/hooks/usePosts";
// Ordem manual (arrastada) x ordem por data de publicação. Só exibição.
import { OrdemDataToggle } from "@/components/shared/OrdemDataToggle";
import { useOrdemPorData } from "@/hooks/useOrdemPorData";
import { ordenarPorData } from "@/lib/ordenar-por-data";
import { toast } from "sonner";
import { PageSkeleton } from "@/components/shared/PageSkeleton";
import { usePillars } from "@/hooks/usePillars";
import { useTasks } from "@/hooks/useTasks";

type PeriodKey = "tudo" | "hoje" | "semana" | "quinzenal" | "mes" | "ano" | "personalizado";

const PERIOD_OPTIONS: { key: PeriodKey; label: string }[] = [
  { key: "tudo", label: "Tudo" },
  { key: "hoje", label: "Hoje" },
  { key: "semana", label: "Semana" },
  { key: "quinzenal", label: "Quinzenal" },
  { key: "mes", label: "Mês" },
  { key: "ano", label: "Ano" },
  { key: "personalizado", label: "Personalizado" },
];

function getDateRange(period: PeriodKey, customRange?: { from: string; to: string }): { start: Date; end: Date } | null {
  const now = new Date();
  switch (period) {
    case "tudo": return null;
    case "hoje": return { start: new Date(now.getFullYear(), now.getMonth(), now.getDate()), end: now };
    case "semana": return { start: startOfWeek(now, { weekStartsOn: 1 }), end: endOfWeek(now, { weekStartsOn: 1 }) };
    case "quinzenal": return { start: subDays(now, 14), end: now };
    case "mes": return { start: startOfMonth(now), end: endOfMonth(now) };
    case "ano": return { start: startOfYear(now), end: endOfYear(now) };
    // Personalizado: strings YYYY-MM-DD viram meia-noite LOCAL (fuso BR), nunca UTC.
    case "personalizado": return customRange ? { start: parseDateOnly(customRange.from), end: parseDateOnly(customRange.to) } : null;
    default: return null;
  }
}

const COLUMNS = [
  { key: "ideia", label: "Ideia", icon: LayoutDashboard, bg: "bg-muted" },
  { key: "roteiro", label: "Planejamento", icon: PenLine, bg: "bg-primary/5" },
  { key: "gravando", label: "Produzindo", icon: Video, bg: "bg-secondary/10" },
  { key: "editando", label: "Pronto", icon: Scissors, bg: "bg-accent" },
  { key: "agendado", label: "Agendado", icon: Calendar, bg: "bg-primary/10" },
  { key: "publicado", label: "Publicado", icon: CheckCircle2, bg: "bg-secondary/20" },
];
const COLUMN_TOOLTIPS: Record<string, string> = {
  ideia: "Posts que você quer criar mas ainda não começou a produzir.",
  roteiro: "Escreva o roteiro, hook e legenda antes de gravar.",
  gravando: "Em processo de gravação ou criação da mídia.",
  editando: "Arquivo gravado, agora em edição ou finalização.",
  agendado: "Pronto para publicar, com data e hora definidos.",
  publicado: "Já publicado! Use o Histórico para acompanhar resultados.",
};

// Rótulo da etapa no calendário: os MESMOS nomes das colunas do board, pra o
// calendário contar a mesma história (era só cor de fundo, e ninguém decora cor).
const CAL_ETAPA: Record<string, string> = {
  ideia: "Ideia", roteiro: "Planejamento", gravando: "Produzindo",
  editando: "Pronto", agendado: "Agendado", publicado: "Publicado",
};

const Criando = () => {
  const { user } = useAuth();
  const { activeAccountId } = useActiveAccount();
  // A bolinha amarela de "aguardando aprovacao" so faz sentido pra conta que
  // TEM social midia vinculada (a validacao acontece na aba Aprovacoes, feita
  // por ela). Criador solo nunca teria quem aprovar, entao o aviso vira ruido.
  const donoDaConta = activeAccountId ?? user?.id ?? null;
  const { data: temSocialMidia = false } = useQuery({
    queryKey: ["tem-social-midia", donoDaConta],
    enabled: !!donoDaConta,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data } = await supabase
        .from("account_members")
        .select("id")
        .eq("owner_id", donoDaConta!)
        .eq("status", "active")
        .limit(1);
      return (data?.length ?? 0) > 0;
    },
  });
  const { posts, updatePost, deletePost, reorderPosts, isLoading: postsLoading } = usePosts();
  const { pillars } = usePillars();
  const { tasks } = useTasks();

  const [drawerOpen, setDrawerOpen] = useState(false);
  // Tour do editor: dispara uma única vez, na primeira vez que a pessoa abre um post
  const { startTourOnce } = useTour();
  useEffect(() => {
    if (drawerOpen) {
      const id = window.setTimeout(() => startTourOnce("post-editor"), 600);
      return () => window.clearTimeout(id);
    }
  }, [drawerOpen, startTourOnce]);
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; title: string } | null>(null);


  const { byStatus, saveCover, resetCover, isSaving } = useStatusCovers();
  // Clicar no vazio e arrastar pro lado rola o board (só mouse; no toque nada muda).
  const boardRef = useDragScroll<HTMLDivElement>();
  const boardMobileRef = useDragScroll<HTMLDivElement>();
  const ramp = statusRamp();
  const [editing, setEditing] = useState<string | null>(null);
  const [editType, setEditType] = useState<"gradient" | "solid">("gradient");
  const [editFrom, setEditFrom] = useState("#EA4918");
  const [editTo, setEditTo] = useState("#6D3FD6");
  const [editLabel, setEditLabel] = useState("");

  const openEditCover = (statusKey: string) => {
    const saved = byStatus[statusKey];
    const defFrom = ramp[statusKey].from, defTo = ramp[statusKey].to;
    setEditType(saved?.cover_type === "solid" ? "solid" : "gradient");
    setEditFrom(saved?.cover_from || defFrom);
    setEditTo(saved?.cover_to || defTo);
    setEditLabel(saved?.label || "");
    setEditing(statusKey);
  };

  const editColumn = editing ? COLUMNS.find(c => c.key === editing) : null;

  const [activeCol, setActiveCol] = useState(0);
  const [view, setView] = useState<"board" | "tabela" | "calendario">(
    () => (localStorage.getItem("criando-view") as "board" | "tabela" | "calendario") || "board"
  );
  const changeView = (v: "board" | "tabela" | "calendario") => {
    setView(v);
    localStorage.setItem("criando-view", v);
  };
  const [calMonth, setCalMonth] = useState<Date>(() => startOfMonth(new Date()));
  const [calMode, setCalMode] = useState<"mes" | "semana">("mes");
  const [calWeekStart, setCalWeekStart] = useState<Date>(() => startOfWeek(new Date(), { weekStartsOn: 0 }));
  const [calDragId, setCalDragId] = useState<string | null>(null);
  const [calDragOverKey, setCalDragOverKey] = useState<string | null>(null);
  const sx = useRef(0), sy = useRef(0), sw = useRef(false);
  const onTouchStart = (e: React.TouchEvent) => { sx.current = e.touches[0].clientX; sy.current = e.touches[0].clientY; sw.current = false; };
  const onTouchMove = (e: React.TouchEvent) => { if (Math.abs(e.touches[0].clientX - sx.current) > Math.abs(e.touches[0].clientY - sy.current) + 6) sw.current = true; };
  const onTouchEnd = (e: React.TouchEvent) => {
    if (!sw.current) return; const dx = e.changedTouches[0].clientX - sx.current;
    if (dx < -40) setActiveCol(c => Math.min(COLUMNS.length - 1, c + 1)); else if (dx > 40) setActiveCol(c => Math.max(0, c - 1));
  };

  const [searchParams, setSearchParams] = useSearchParams();
  const overview = searchParams.get("view") === "overview";
  // ABRIR UM POST VINDO DA BUSCA (Cmd+K → clica num post → /app/criando?post=ID).
  // A busca NAVEGAVA certo, mas esta tela não lia o parâmetro: a pessoa caía no
  // kanban e tinha que procurar o post na mão. Achar e não abrir é meio caminho.
  const abriuDaBusca = useRef<string | null>(null);
  useEffect(() => {
    const alvo = searchParams.get("post");
    if (!alvo || postsLoading) return;
    if (abriuDaBusca.current === alvo) return; // não reabrir se ela fechou
    const post = posts.find((p) => p.id === alvo);
    if (post) {
      abriuDaBusca.current = alvo;
      setSelectedPost(post);
      setDrawerOpen(true);
      // limpa a URL pra o post não reabrir sozinho a cada render
      const next = new URLSearchParams(searchParams);
      next.delete("post");
      setSearchParams(next, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [posts, postsLoading]);

  const goToColumn = (i: number) => {
    setActiveCol(i);
    const next = new URLSearchParams(searchParams);
    next.delete("view");
    setSearchParams(next, { replace: true });
  };

  const [period, setPeriod] = useState<PeriodKey>(() => {
    return (localStorage.getItem("criando-period") as PeriodKey) || "tudo";
  });
  // Guarda strings YYYY-MM-DD (fuso BR). Evita toISOString/new Date crus, que causam off-by-one.
  const [customRange, setCustomRange] = useState<{ from: string; to: string } | undefined>();
  const [filterPlatform, setFilterPlatform] = useState<string | null>(null);
  const [filterPillar, setFilterPillar] = useState<string | null>(null);
  const [filterWeek, setFilterWeek] = useState<number | null>(null);
  const [filterFormat, setFilterFormat] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [dateSort, setDateSort] = useState<null | "asc" | "desc">(null);

  const handlePeriodChange = (p: PeriodKey) => {
    setPeriod(p);
    localStorage.setItem("criando-period", p);
  };

  const dateRange = useMemo(() => getDateRange(period, customRange), [period, customRange]);

  const taskCounts = useMemo(() => {
    const counts = new Map<string, { count: number; done: number }>();
    tasks.forEach(t => {
      if (!t.post_id) return;
      const cur = counts.get(t.post_id) ?? { count: 0, done: 0 };
      cur.count += 1;
      if (t.status === "concluida") cur.done += 1;
      counts.set(t.post_id, cur);
    });
    return counts;
  }, [tasks]);

  const filteredPosts = useMemo(() => {
    return posts.filter(post => {
      if (filterPlatform && post.platform !== filterPlatform) return false;
      if (filterPillar && post.pillar_id !== filterPillar) return false;
      if (filterWeek != null && post.week_number !== filterWeek) return false;
      if (filterFormat && post.format !== filterFormat) return false;
      if (search.trim() && !(post.title ?? "").toLowerCase().includes(search.trim().toLowerCase())) return false;
      if (period === "personalizado") {
        // Comparação lexicográfica de strings YYYY-MM-DD: sem conversão de fuso, sem off-by-one.
        if (customRange) {
          const postDate = post.scheduled_date || post.created_at?.split("T")[0];
          if (!postDate) return false;
          if (postDate < customRange.from || postDate > customRange.to) return false;
        }
      } else if (dateRange) {
        const postDate = post.scheduled_date || post.created_at?.split("T")[0];
        if (!postDate) return period === "tudo";
        try {
          const d = parseISO(postDate);
          if (!isWithinInterval(d, { start: dateRange.start, end: dateRange.end })) return false;
        } catch { return false; }
      }
      return true;
    });
  }, [posts, filterPlatform, filterPillar, filterWeek, filterFormat, search, dateRange, period, customRange]);

  // Ordem das colunas do board: manual (arrastada, board_order) ou por data de
  // publicação. É EXIBIÇÃO: nada é regravado, então desligar devolve a ordem manual.
  // Vale pros três boards da tela (desktop, mobile overview e mobile em colunas).
  const [porData, setPorData, ordemDir, alternarOrdem] = useOrdemPorData("criando_ordem_data_v1");
  // Data do card aqui = scheduled_date, desempatada por scheduled_time.
  // Post sem data agendada vai pro fim da coluna (nos dois sentidos da direção).
  const ordenarColuna = (lista: Post[]) =>
    porData ? ordenarPorData(lista, (p) => p.scheduled_date, (p) => p.scheduled_time, ordemDir) : lista;

  const [pickerOpen, setPickerOpen] = useState(false);
  const [pendingFormat, setPendingFormat] = useState<string | null>(null);
  // Coluna de nascimento do post: o + no cabeçalho de cada coluna cria o post
  // já naquele status (pedido do Walter, 31/08: "adicionar direto no quadro
  // que eu quero"). O Novo Post geral zera e nasce em Ideia.
  const [pendingStatus, setPendingStatus] = useState<string | null>(null);

  const openNew = () => { setPendingStatus(null); setPickerOpen(true); };
  const openNewInColumn = (statusKey: string) => { setPendingStatus(statusKey); setPickerOpen(true); };
  const startFromFormat = (fmt: string) => { setPendingFormat(fmt); setPickerOpen(false); setSelectedPost(null); setDrawerOpen(true); };
  const startBlank = () => { setPendingFormat(null); setPickerOpen(false); setSelectedPost(null); setDrawerOpen(true); };
  const openEdit = (post: Post) => { setSelectedPost(post); setDrawerOpen(true); };

  const movePostStatus = async (postId: string, newStatus: string) => {
    if (!user) return;
    const updates: { status: string; published_at?: string } = { status: newStatus };
    if (newStatus === "publicado") updates.published_at = new Date().toISOString();
    // Salva PRIMEIRO. Confetti/audit só disparam depois do save confirmado
    // antes, um erro de rede deixava o card voltando sem aviso e com confetti falso.
    try {
      await updatePost.mutateAsync({ id: postId, updates });
    } catch {
      toast.error("Não foi possível mover o post. Tente de novo.");
      return;
    }
    if (newStatus === "publicado") {
      const { fireConfetti } = await import("@/lib/confetti");
      fireConfetti();
      await supabase.from("audit_log").insert({
        user_id: user.id,
        action: "post_published",
        entity_type: "post",
        entity_id: postId,
      });
    }
  };

  const reschedulePost = async (postId: string, dateKey: string) => {
    try {
      await updatePost.mutateAsync({ id: postId, updates: { scheduled_date: dateKey } });
    } catch {
      toast.error("Não foi possível reagendar. Tente de novo.");
    }
  };

  // Drag estilo Trello: reordena DENTRO da coluna e move ENTRE colunas, gravando
  // a ordem manual (board_order). Card fica onde você soltou, não vai mais pro fim.
  const handleDragEnd = async (result: DropResult) => {
    const { destination, draggableId } = result;
    if (!destination) return;
    const destStatus = destination.droppableId;
    const moved = posts.find((p) => p.id === draggableId);
    if (!moved) return;
    const changedStatus = (moved.status ?? "ideia") !== destStatus;

    // Com "Por data" ligado, a posição dentro da coluna vem da data, então gravar
    // board_order não teria efeito (o card voltaria pro lugar). Avisamos e damos o
    // atalho de volta. Mudar de COLUNA continua valendo: isso muda o status.
    if (porData) {
      if (!changedStatus) {
        toast.info("Esta coluna está ordenada por data.", {
          description: "Volte pra Ordem manual pra reposicionar os cards arrastando.",
          action: { label: "Ordem manual", onClick: () => setPorData(false) },
        });
        return;
      }
      await movePostStatus(draggableId, destStatus);
      return;
    }

    // Coluna de destino na ordem atual, sem o card arrastado; insere na posição solta.
    const col = filteredPosts.filter((p) => (p.status ?? "ideia") === destStatus && p.id !== draggableId);
    col.splice(destination.index, 0, moved);

    // Renumera board_order (0..n) e junta o que mudou num só reorder otimista.
    const changes: { id: string; board_order: number; status?: string; published_at?: string }[] = [];
    col.forEach((p, idx) => {
      const isMoved = p.id === draggableId;
      const curOrder = (p as { board_order?: number }).board_order ?? -1;
      if (!isMoved && curOrder === idx) return;
      const ch: { id: string; board_order: number; status?: string; published_at?: string } = { id: p.id, board_order: idx };
      if (isMoved && changedStatus) {
        ch.status = destStatus;
        if (destStatus === "publicado") ch.published_at = new Date().toISOString();
      }
      changes.push(ch);
    });
    // Aguarda a confirmação do save ANTES de comemorar. Se falhar, o reorder já
    // reverteu o card e avisou; não dispara confetti/audit por cima de erro.
    const ok = await reorderPosts(changes);
    if (!ok) return;

    // Publicou (e persistiu): confetti + audit, como no fluxo antigo.
    if (changedStatus && destStatus === "publicado" && user) {
      const { fireConfetti } = await import("@/lib/confetti");
      fireConfetti();
      await supabase.from("audit_log").insert({ user_id: user.id, action: "post_published", entity_type: "post", entity_id: draggableId } as never);
    }
  };

  const getPillar = (id: string | null) => pillars.find(p => p.id === id);

  const statusRank = (s: string | null) => {
    const i = COLUMNS.findIndex(c => c.key === (s ?? "ideia"));
    return i < 0 ? 99 : i;
  };

  const hasActiveFilters = filterPlatform || filterPillar || filterWeek != null || period !== "tudo" || filterFormat || search.trim();
  const activeFilterCount = (period !== "tudo" ? 1 : 0) + (filterPlatform ? 1 : 0) + (filterPillar ? 1 : 0) + (filterWeek != null ? 1 : 0) + (filterFormat ? 1 : 0);
  const sheetChip = (on: boolean) => `px-3 py-1.5 rounded-full text-xs font-body border transition-colors inline-flex items-center ${on ? "bg-primary text-primary-foreground border-primary" : "bg-card border-border text-foreground"}`;
  const activeChip = (key: string, label: string, onClear: () => void) => (
    <button key={key} type="button" onClick={onClear} className="flex-shrink-0 inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-primary/10 text-primary">
      {label} <X className="h-3 w-3" />
    </button>
  );

  if (postsLoading && posts.length === 0) {
    return (
      <div className="pb-20 md:pb-0">
        <PageSkeleton />
      </div>
    );
  }

  return (
    <div className="pb-20 md:pb-0">
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
        <div className="flex items-center justify-between mb-4 gap-3">
          <div className="flex items-center gap-3 min-w-0 md:hidden">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center shadow-sm shrink-0">
              <Kanban className="h-5 w-5 text-white" strokeWidth={1.75} />
            </div>
            <div className="min-w-0">
              <h1 className="text-2xl sm:text-3xl font-display font-extrabold text-foreground tracking-tight">Estou Criando</h1>
              <p className="text-muted-foreground font-body mt-0.5 text-sm hidden sm:block">Seu pipeline de criação. Arraste entre colunas.</p>
            </div>
          </div>
          {/* No desktop o título fica no HeroBand, então o botão é o único filho
             desta linha: ml-auto encosta ele na DIREITA (antes ficava perdido
             na esquerda, "meio aleatório" nas palavras do Walter). */}
          <Button data-tour="criando-novo" variant="hero" onClick={openNew} className="shrink-0 ml-auto shadow-warm-md"><Plus className="h-4 w-4 mr-1" /> Novo Post</Button>
        </div>

        {/* Filtros, mobile: busca + botão Filtros + chips ativos (gaveta) */}
        <div data-tour="criando-filtros-m" className="md:hidden mb-3">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
              <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar título..."
                className="h-9 w-full rounded-xl text-xs font-body bg-card pl-8" />
            </div>
            <Button type="button" variant="outline" size="sm" onClick={() => setFiltersOpen(true)} className="rounded-xl gap-1.5 shrink-0">
              <SlidersHorizontal className="h-4 w-4" /> Filtros
              {activeFilterCount > 0 && <span className="ml-0.5 text-[10px] font-bold bg-primary text-primary-foreground rounded-full px-1.5 py-0.5">{activeFilterCount}</span>}
            </Button>
          </div>
          {/* Ordem das colunas: manual (o que você arrastou) ou por data. */}
          <div className="flex items-center gap-1.5 mt-2 overflow-x-auto scrollbar-none">
            <OrdemDataToggle valor={porData} direcao={ordemDir} onChange={setPorData} onToggle={alternarOrdem} className="shrink-0" />
          </div>
          {porData && (
            <p className="text-[11px] font-body text-muted-foreground mt-1.5">Post sem data fica no fim da coluna.</p>
          )}
          {activeFilterCount > 0 && (
            <div className="flex items-center gap-1.5 mt-2 overflow-x-auto scrollbar-none">
              {period !== "tudo" && activeChip("p", PERIOD_OPTIONS.find(o => o.key === period)?.label ?? "Período", () => handlePeriodChange("tudo"))}
              {filterPlatform && activeChip("pl", filterPlatform === "instagram" ? "Instagram" : filterPlatform === "tiktok" ? "TikTok" : "YouTube", () => setFilterPlatform(null))}
              {filterPillar && activeChip("pi", pillars.find(p => p.id === filterPillar)?.name ?? "Pilar", () => setFilterPillar(null))}
              {filterWeek != null && activeChip("w", `Semana ${filterWeek}`, () => setFilterWeek(null))}
              {filterFormat && activeChip("f", FORMAT_LABELS[filterFormat] ?? filterFormat, () => setFilterFormat(null))}
            </div>
          )}
        </div>

        <Sheet open={filtersOpen} onOpenChange={setFiltersOpen}>
          <SheetContent side="bottom" className="rounded-t-2xl max-h-[85vh] overflow-y-auto">
            <SheetHeader><SheetTitle className="font-display text-left">Filtros</SheetTitle></SheetHeader>
            <div className="space-y-5 mt-4 pb-2">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-2">Período</p>
                <div className="flex flex-wrap gap-2">
                  {PERIOD_OPTIONS.map(opt => (
                    <button key={opt.key} type="button" onClick={() => handlePeriodChange(opt.key)} className={sheetChip(period === opt.key)}>{opt.label}</button>
                  ))}
                </div>
                {period === "personalizado" && (
                  <div className="flex items-center gap-2 mt-3">
                    <Input type="date" value={customRange?.from || ""}
                      onChange={e => setCustomRange(prev => ({ from: e.target.value, to: prev?.to || hojeBR() }))}
                      className="rounded-xl text-xs h-9 flex-1" />
                    <span className="text-muted-foreground text-xs">até</span>
                    <Input type="date" value={customRange?.to || ""}
                      onChange={e => setCustomRange(prev => ({ from: prev?.from || hojeBR(), to: e.target.value }))}
                      className="rounded-xl text-xs h-9 flex-1" />
                  </div>
                )}
              </div>
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-2">Rede</p>
                <div className="flex flex-wrap gap-2">
                  <button type="button" onClick={() => setFilterPlatform(null)} className={sheetChip(!filterPlatform)}>Todas</button>
                  {(["instagram", "tiktok", "youtube"] as const).map(p => (
                    <button key={p} type="button" onClick={() => setFilterPlatform(filterPlatform === p ? null : p)} className={sheetChip(filterPlatform === p)}>
                      <PlatformIcon platform={p} size="sm" /> <span className="ml-1.5">{p === "instagram" ? "Instagram" : p === "tiktok" ? "TikTok" : "YouTube"}</span>
                    </button>
                  ))}
                </div>
              </div>
              {pillars.length > 0 && (
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-2">Pilar</p>
                  <div className="flex flex-wrap gap-2">
                    <button type="button" onClick={() => setFilterPillar(null)} className={sheetChip(!filterPillar)}>Todos</button>
                    {pillars.map(p => (
                      <button key={p.id} type="button" onClick={() => setFilterPillar(filterPillar === p.id ? null : p.id)} className={sheetChip(filterPillar === p.id)}>
                        <span className="w-2 h-2 rounded-full inline-block mr-1.5" style={{ backgroundColor: p.color }} />{p.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {posts.some(p => p.week_number != null) && (
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-2">Semana</p>
                  <div className="flex flex-wrap gap-2">
                    <button type="button" onClick={() => setFilterWeek(null)} className={sheetChip(filterWeek == null)}>Todas</button>
                    {Array.from(new Set(posts.map(p => p.week_number).filter((n): n is number => n != null))).sort((a, b) => a - b).map(n => (
                      <button key={n} type="button" onClick={() => setFilterWeek(filterWeek === n ? null : n)} className={sheetChip(filterWeek === n)}>Semana {n}</button>
                    ))}
                  </div>
                </div>
              )}
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-2">Formato</p>
                <div className="flex flex-wrap gap-2">
                  <button type="button" onClick={() => setFilterFormat(null)} className={sheetChip(!filterFormat)}>Todos</button>
                  {FORMATS.map(f => (
                    <button key={f} type="button" onClick={() => setFilterFormat(filterFormat === f ? null : f)} className={sheetChip(filterFormat === f)}>{FORMAT_LABELS[f] || f}</button>
                  ))}
                </div>
              </div>
              <div className="flex gap-2 pt-1">
                <Button variant="outline" className="flex-1 rounded-xl" onClick={() => { setFilterPlatform(null); setFilterPillar(null); setFilterWeek(null); setFilterFormat(null); handlePeriodChange("tudo"); }}>Limpar</Button>
                <Button className="flex-1 rounded-xl" onClick={() => setFiltersOpen(false)}>Aplicar</Button>
              </div>
            </div>
          </SheetContent>
        </Sheet>

        <div data-tour="criando-filtros" className="hidden md:block overflow-x-auto scrollbar-none -mx-4 px-4 mb-4">
          <div className="flex items-center gap-3 min-w-max">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
              <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar título..."
                className="h-9 w-[180px] rounded-xl text-xs font-body bg-card pl-8" />
            </div>
            <div className="flex items-center gap-1 bg-card rounded-xl border border-border p-1">
              {PERIOD_OPTIONS.map(opt => (
                <button key={opt.key} onClick={() => handlePeriodChange(opt.key)}
                  className={`px-3 py-1 rounded-lg text-xs font-body transition-colors ${
                    period === opt.key ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                  }`}>
                  {opt.label}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-1">
              <button onClick={() => setFilterPlatform(null)}
                className={`px-3 py-1.5 rounded-xl text-xs font-body border transition-colors ${!filterPlatform ? "bg-primary text-primary-foreground border-primary" : "bg-card border-border"}`}>
                Todas
              </button>
              {(["instagram", "tiktok", "youtube"] as const).map(p => (
                <button key={p} onClick={() => setFilterPlatform(filterPlatform === p ? null : p)}
                  className={`px-2 py-1.5 rounded-xl border transition-colors flex items-center gap-1 ${filterPlatform === p ? "bg-primary/10 border-primary" : "bg-card border-border"}`}>
                  <PlatformIcon platform={p} size="sm" />
                </button>
              ))}
            </div>

            {/* Pilar/semana/formato num popover "Filtros" só: 3 selects lado a
               lado deixavam a linha extensa demais (pedido do Walter, 31/08). */}
            <Popover>
              <PopoverTrigger asChild>
                <button className={`inline-flex items-center gap-1.5 h-9 px-3 rounded-xl text-xs font-body border transition-colors ${filterPillar || filterWeek != null || filterFormat ? "bg-primary/10 border-primary text-primary font-semibold" : "bg-card border-border text-muted-foreground hover:text-foreground"}`}>
                  <SlidersHorizontal className="h-3.5 w-3.5" /> Filtros
                  {(filterPillar || filterWeek != null || filterFormat) && (
                    <span className="h-4 min-w-[16px] px-1 rounded-full bg-primary text-primary-foreground text-[10px] font-bold grid place-items-center">
                      {[filterPillar, filterWeek != null ? 1 : null, filterFormat].filter(Boolean).length}
                    </span>
                  )}
                </button>
              </PopoverTrigger>
              <PopoverContent align="start" className="w-64 p-3 space-y-2.5">
                {pillars.length > 0 && (
                  <Select
                    value={filterPillar ?? "all"}
                    onValueChange={(v) => setFilterPillar(v === "all" ? null : v)}
                  >
                    <SelectTrigger className="w-full h-9 rounded-xl text-xs font-body bg-card">
                      <SelectValue placeholder="Todos os pilares" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">
                        <span className="font-body">Todos os pilares</span>
                      </SelectItem>
                      {pillars.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          <span className="flex items-center gap-2 font-body">
                            <span
                              className="w-2.5 h-2.5 rounded-full shrink-0"
                              style={{ backgroundColor: p.color }}
                            />
                            {p.name}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}

                {posts.some((p) => p.week_number != null) && (
                  <Select
                    value={filterWeek == null ? "all" : String(filterWeek)}
                    onValueChange={(v) => setFilterWeek(v === "all" ? null : Number(v))}
                  >
                    <SelectTrigger className="w-full h-9 rounded-xl text-xs font-body bg-card">
                      <SelectValue placeholder="Todas as semanas" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">
                        <span className="font-body">Todas as semanas</span>
                      </SelectItem>
                      {Array.from(
                        new Set(posts.map((p) => p.week_number).filter((n): n is number => n != null))
                      )
                        .sort((a, b) => a - b)
                        .map((n) => (
                          <SelectItem key={n} value={String(n)}>
                            <span className="font-body">Semana {n}</span>
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                )}

                <Select value={filterFormat ?? "all"} onValueChange={(v) => setFilterFormat(v === "all" ? null : v)}>
                  <SelectTrigger className="w-full h-9 rounded-xl text-xs font-body bg-card">
                    <SelectValue placeholder="Todos os formatos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all"><span className="font-body">Todos os formatos</span></SelectItem>
                    {FORMATS.map((f) => (
                      <SelectItem key={f} value={f}><span className="font-body">{FORMAT_LABELS[f] || f}</span></SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </PopoverContent>
            </Popover>

            {/* Contadores no fim da linha de filtros (imagem 6): eles ocupavam
               uma linha inteira só pra três números. */}
            <div className="flex items-center gap-2 text-xs font-body text-muted-foreground whitespace-nowrap">
              <span>{filteredPosts.length} posts</span>
              <span>·</span>
              <span>{filteredPosts.filter(p => p.status === "publicado").length} publicados</span>
              <span>·</span>
              <span>{filteredPosts.filter(p => p.scheduled_date).length} agendados</span>
              {hasActiveFilters && (
                <button onClick={() => { setFilterPlatform(null); setFilterPillar(null); setFilterWeek(null); setFilterFormat(null); setSearch(""); handlePeriodChange("tudo"); }}
                  className="ml-1 text-primary hover:underline flex items-center gap-1">
                  <X className="h-3 w-3" /> Limpar
                </button>
              )}
            </div>
          </div>
        </div>

        {period === "personalizado" && (
          <div className="hidden md:flex items-center gap-2 mb-4">
            <Input type="date" value={customRange?.from || ""}
              onChange={e => setCustomRange(prev => ({ from: e.target.value, to: prev?.to || hojeBR() }))}
              className="rounded-xl text-xs h-8 w-36" />
            <span className="text-muted-foreground text-xs">até</span>
            <Input type="date" value={customRange?.to || ""}
              onChange={e => setCustomRange(prev => ({ from: prev?.from || hojeBR(), to: e.target.value }))}
              className="rounded-xl text-xs h-8 w-36" />
          </div>
        )}

        {/* No celular os contadores continuam numa linha própria (a barra de
           filtros do desktop, que agora os carrega, é hidden lá). */}
        <div className="flex md:hidden items-center gap-4 mb-4 text-xs font-body text-muted-foreground">
          <span>{filteredPosts.length} posts no período</span>
          <span>·</span>
          <span>{filteredPosts.filter(p => p.status === "publicado").length} publicados</span>
          <span>·</span>
          <span>{filteredPosts.filter(p => p.scheduled_date).length} agendados</span>
          {hasActiveFilters && (
            <button onClick={() => { setFilterPlatform(null); setFilterPillar(null); setFilterWeek(null); setFilterFormat(null); setSearch(""); handlePeriodChange("tudo"); }}
              className="ml-2 text-primary hover:underline flex items-center gap-1">
              <X className="h-3 w-3" /> Limpar filtros
            </button>
          )}
        </div>

        <div className="hidden md:flex items-center gap-3 flex-wrap mb-4">
          <div data-tour="criando-views" className="flex items-center gap-1 bg-card rounded-xl border border-border p-1 w-max">
            {([
              { key: "board", label: "Board", icon: Kanban },
              { key: "tabela", label: "Tabela", icon: Table },
              { key: "calendario", label: "Calendário", icon: Calendar },
            ] as const).map(t => (
              <button key={t.key} onClick={() => changeView(t.key)}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-xs font-body transition-colors flex items-center gap-1.5",
                  view === t.key ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                )}>
                <t.icon className="h-3.5 w-3.5" /> {t.label}
              </button>
            ))}
          </div>
          {/* Ordem das colunas. Só no board: a tabela já tem o próprio sort no
              cabeçalho e o calendário é organizado pelo dia. */}
          {view === "board" && (
            <>
              <OrdemDataToggle valor={porData} direcao={ordemDir} onChange={setPorData} onToggle={alternarOrdem} />
              {porData && (
                <span className="text-[11px] font-body text-muted-foreground">Post sem data fica no fim da coluna.</span>
              )}
            </>
          )}
        </div>

        {/* O QUADRO VAZIO. Antes ele mostrava seis colunas vazias e nada mais o
            que parece um sistema quebrado, não um começo. Um kanban sem card não
            ensina nada; um convite, sim. */}
        {posts.length === 0 && (
          <EmptyState
            icon={Kanban}
            cor="laranja"
            title="Seu quadro começa aqui"
            description="Cada post nasce como ideia e anda pelas colunas até ir pro ar: Ideia → Planejamento → Produzindo → Pronto → Agendado → Publicado. Você arrasta o card, e o CRIA cuida do resto."
            action={{ label: "Criar meu primeiro post", onClick: openNew }}
            secondary={
              <a
                href="/app/ideias"
                className="text-[13px] font-body text-muted-foreground underline underline-offset-2 hover:text-foreground"
              >
                ou puxe uma ideia que você já anotou
              </a>
            }
          />
        )}

        {posts.length > 0 && view === "board" && (
        /* onDragStart com vibração: o dedo SENTE que pegou o card. iOS ignora, Android responde. */
        <DragDropContext onDragStart={() => tocar(12)} onDragEnd={(r) => { tocar(8); void handleDragEnd(r); }}>
        {/* Clicar no vazio e arrastar pro lado rola o board (só mouse). */}
        <div ref={boardRef} data-tour="criando-board" className="hidden md:flex gap-4 overflow-x-auto pb-4 -mx-4 px-4 snap-x snap-proximity kanban-scroll">
          {COLUMNS.map(col => {
            const colPosts = ordenarColuna(filteredPosts.filter(p => p.status === col.key));
            const isPublished = col.key === "publicado";
            const isAfterIdeia = col.key === "roteiro";
            const showDividerBefore = isPublished || isAfterIdeia;
            const step = ramp[col.key];
            const savedC = byStatus[col.key];
            const cFrom = savedC?.cover_from || step.from;
            const cTo = savedC?.cover_type === "solid" ? (savedC?.cover_from || step.from) : (savedC?.cover_to || step.to);
            const cInk = savedC ? "#fff" : step.ink;
            const cSub = savedC ? "rgba(255,255,255,.78)" : step.sub;
            const cTitle = savedC?.label || col.label;
            return (
              <div key={col.key} className={`w-[85vw] max-w-[320px] sm:w-auto sm:max-w-none sm:min-w-[200px] flex-shrink-0 sm:flex-1 snap-start flex flex-col ${showDividerBefore ? "border-l-2 border-dashed border-border pl-4" : ""}`}>
                <div className="relative mb-3 group/cover">
                  <CoverHeader label="Status" title={cTitle} count={colPosts.length} from={cFrom} to={cTo} ink={cInk} sub={cSub} hint={COLUMN_TOOLTIPS[col.key]} compact />
                  {/* + SEMPRE visível: cria o post já nesta coluna. */}
                  <button onClick={() => openNewInColumn(col.key)} aria-label={`Novo post em ${cTitle}`}
                    className="absolute top-2.5 right-12 z-10 h-7 w-7 rounded-full bg-white/20 hover:bg-white/35 backdrop-blur flex items-center justify-center transition-colors">
                    <Plus className="h-4 w-4 text-white" />
                  </button>
                  <button onClick={() => openEditCover(col.key)} aria-label="Editar capa"
                    className="absolute top-2.5 right-[5.25rem] z-10 h-7 w-7 rounded-full bg-white/15 backdrop-blur flex items-center justify-center opacity-0 group-hover/cover:opacity-100 transition-opacity">
                    <Pencil className="h-3.5 w-3.5 text-white/90" />
                  </button>
                </div>
                <Droppable droppableId={col.key}>
                {(dropProvided, dropSnapshot) => (
                /* ÁREA da coluna com tinta da capa bem clara (pedido do Walter,
                   31/08): demarca o espaço de cada kanban e "segura" os cards,
                   igual ficou no Cria Post. `0F` = ~6% de opacidade no hex. */
                <div ref={dropProvided.innerRef} {...dropProvided.droppableProps}
                  style={!dropSnapshot.isDraggingOver && /^#[0-9a-fA-F]{6}$/.test(cFrom) ? { backgroundColor: `${cFrom}0F` } : undefined}
                  className={`space-y-3 flex-1 min-h-[200px] rounded-xl p-1.5 transition-all ${dropSnapshot.isDraggingOver ? "ring-2 ring-primary bg-primary/5" : "bg-muted/30"}`}>
                  {colPosts.map((post, pIdx) => {
                    const pillar = getPillar(post.pillar_id);
                    const tc = taskCounts.get(post.id);
                    const approvalStatus = (post as unknown as { approval_status?: string | null }).approval_status ?? null;
                    const showApprovalBadge = temSocialMidia && post.status === "editando" && approvalStatus !== "aprovado";
                    const allDone = tc && tc.count > 0 && tc.done === tc.count;
                    const pendingTasks = tc ? tc.count - tc.done : 0;
                                        return (
                      <Draggable key={post.id} draggableId={post.id} index={pIdx}>
                      {(dragProvided, dragSnapshot) => (
                      <div ref={dragProvided.innerRef} {...dragProvided.draggableProps} {...dragProvided.dragHandleProps} onClick={() => openEdit(post)}
                        style={{ borderLeftColor: ramp[post.status ?? "ideia"]?.line ?? "transparent", borderLeftWidth: 4, ...dragProvided.draggableProps.style }}
                        className={`criando-drag-card group relative bg-card rounded-xl p-3 shadow-warm-sm border border-border cursor-grab active:cursor-grabbing hover:shadow-warm-md transition-all duration-200 ${dragSnapshot.isDragging ? "shadow-warm-lg ring-2 ring-primary/40" : ""} ${isPublished ? "opacity-70" : ""}`}>
                        {/* Editar + excluir lado a lado (pedido do Walter, 31/08:
                            "ter um botao de editar e excluir"). O card inteiro já
                            abre a edição, mas o lápis torna a ação visível. */}
                        <div className="absolute top-2 right-2 flex items-center gap-1 opacity-100 md:opacity-0 md:group-hover:opacity-100 focus-within:opacity-100 transition-opacity z-10">
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); openEdit(post); }}
                            className="h-6 w-6 rounded-full bg-muted hover:bg-primary hover:text-primary-foreground text-muted-foreground flex items-center justify-center transition-colors"
                            aria-label="Editar post"
                          >
                            <Pencil className="h-3 w-3" />
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setDeleteTarget({ id: post.id, title: post.title });
                            }}
                            className="h-6 w-6 rounded-full bg-destructive/80 hover:bg-destructive text-white flex items-center justify-center transition-colors"
                            aria-label="Excluir post"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                        {/* 1 linha só (line-clamp-1): título em 2 linhas engordava
                            o card; o title= mostra o texto completo no hover. */}
                        <p title={post.title} className="font-body font-medium text-sm text-foreground mb-1.5 leading-snug line-clamp-1 pr-14">
                          {showApprovalBadge && (
                            <span
                              className="inline-flex items-center justify-center h-4 w-4 rounded-full bg-yellow-400 text-yellow-950 text-[10px] font-bold mr-1 align-middle"
                              title="Aguardando a aprovação da sua social mídia (aba Aprovações)"
                              aria-label="Aguardando a aprovação da sua social mídia"
                            >!</span>
                          )}
                          {post.title}
                        </p>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <PlatformIcon platform={post.platform} size="sm" />
                          <span style={formatColorVars(post.format)} className={`text-[10px] font-body font-bold uppercase tracking-wide bg-muted/60 px-1.5 py-0.5 rounded ${FORMAT_TEXT_CLASS}`}>{FORMAT_LABELS[post.format] || post.format}</span>
                          {pillar && <span className="px-1.5 py-0.5 rounded text-xs font-body text-primary-foreground" style={{ backgroundColor: pillar.color }}>{pillar.name}</span>}
                          {post.week_number != null && (
                            <span className="px-1.5 py-0.5 rounded text-xs font-body bg-muted text-muted-foreground border border-border">
                              S{post.week_number}
                            </span>
                          )}
                          {isPublished && <span className="px-1.5 py-0.5 rounded text-xs font-body bg-secondary text-secondary-foreground">Publicado</span>}
                        </div>
                        {post.scheduled_date && <p className="text-xs text-muted-foreground font-body mt-2 flex items-center gap-1"><Calendar className="h-3 w-3" /> {post.scheduled_date}{post.scheduled_time ? ` às ${post.scheduled_time}` : ""}</p>}
                        {tc && tc.count > 0 && (
                          <span className={`inline-flex items-center gap-1 mt-1.5 text-[10px] font-body font-semibold px-1.5 py-0.5 rounded ${allDone ? "bg-secondary/20 text-secondary" : "bg-muted text-muted-foreground"}`}>
                            {allDone ? "✓" : `${pendingTasks} tarefa${pendingTasks !== 1 ? "s" : ""}`}
                          </span>
                        )}
                        <div className="mt-2 md:hidden" onClick={(e) => e.stopPropagation()}>
                          <Select value={post.status ?? "ideia"} onValueChange={(val) => movePostStatus(post.id, val)}>
                            <SelectTrigger className="h-7 w-auto gap-1.5 px-3 rounded-full border-border bg-muted/40 text-xs font-body text-muted-foreground">Mover</SelectTrigger>
                            <SelectContent>{STATUS_OPTIONS.map(s => <SelectItem key={s.key} value={s.key}>{s.label}</SelectItem>)}</SelectContent>
                          </Select>
                        </div>
                      </div>
                      )}
                      </Draggable>
                    );
                  })}
                  {colPosts.length === 0 && (
                    <div className={`border-2 border-dashed rounded-xl p-6 text-center transition-colors ${dropSnapshot.isDraggingOver ? "border-primary" : "border-border"}`}>
                      <p className="text-xs text-muted-foreground font-body">Arraste pra cá</p>
                    </div>
                  )}
                  {dropProvided.placeholder}
                </div>
                )}
                </Droppable>
              </div>
            );
          })}
        </div>
        </DragDropContext>
        )}

        {posts.length > 0 && view === "tabela" && (
          <div className="hidden md:block">
            {filteredPosts.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border p-12 text-center">
                <p className="font-body text-sm text-muted-foreground">Nenhum post nos filtros atuais.</p>
              </div>
            ) : (
              <div className="rounded-2xl border border-border overflow-hidden bg-card">
                <table className="w-full text-sm font-body">
                  <thead>
                    <tr className="border-b border-border bg-muted/40 text-left text-xs text-muted-foreground">
                      <th className="px-4 py-2.5 font-medium">Título</th>
                      <th className="px-4 py-2.5 font-medium">Status</th>
                      <th className="px-4 py-2.5 font-medium">Formato</th>
                      <th className="px-4 py-2.5 font-medium">Plataforma</th>
                      <th className="px-4 py-2.5 font-medium">Pilar</th>
                      <th className="px-4 py-2.5 font-medium">
                        <button type="button" onClick={() => setDateSort((s) => (s === "asc" ? "desc" : "asc"))} className="inline-flex items-center gap-1 hover:text-foreground transition-colors">
                          Data
                          {dateSort === "asc" ? <ArrowUp className="h-3 w-3" /> : dateSort === "desc" ? <ArrowDown className="h-3 w-3" /> : <ArrowUpDown className="h-3 w-3 opacity-40" />}
                        </button>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...filteredPosts]
                      .sort((a, b) => {
                        if (dateSort) {
                          const da = a.scheduled_date ?? "", db = b.scheduled_date ?? "";
                          if (!da && !db) return 0;
                          if (!da) return 1;   // sem data sempre por último
                          if (!db) return -1;
                          return dateSort === "asc" ? da.localeCompare(db) : db.localeCompare(da);
                        }
                        return statusRank(a.status) - statusRank(b.status) ||
                          (a.scheduled_date ?? "").localeCompare(b.scheduled_date ?? "");
                      })
                      .map(post => {
                        const st = ramp[post.status ?? "ideia"];
                        const stLabel = COLUMNS.find(c => c.key === (post.status ?? "ideia"))?.label ?? (post.status ?? "-");
                        const pil = getPillar(post.pillar_id);
                        return (
                          <tr key={post.id} onClick={() => openEdit(post)}
                            className="border-b border-border last:border-0 hover:bg-muted/40 cursor-pointer transition-colors">
                            <td className="px-4 py-2.5 max-w-[340px]">
                              <span className="font-medium text-foreground line-clamp-1">{post.title}</span>
                            </td>
                            <td className="px-4 py-2.5">
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium"
                                style={{ background: st.from, color: st.ink }}>{stLabel}</span>
                            </td>
                            <td className="px-4 py-2.5 text-muted-foreground whitespace-nowrap">{FORMAT_LABELS[post.format] || post.format}</td>
                            <td className="px-4 py-2.5"><PlatformIcon platform={post.platform} size="sm" /></td>
                            <td className="px-4 py-2.5">
                              {pil ? (
                                <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                                  <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: pil.color }} />
                                  {pil.name}
                                </span>
                              ) : <span className="text-muted-foreground/50">-</span>}
                            </td>
                            <td className="px-4 py-2.5 text-muted-foreground whitespace-nowrap">
                              {post.scheduled_date ? parseISO(post.scheduled_date).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" }) : "-"}
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
        {posts.length > 0 && view === "calendario" && (
          <div className="hidden md:block">
            <div className="flex items-center gap-1 bg-card rounded-xl border border-border p-1 w-max mb-4">
              {([{ key: "mes", label: "Mês" }, { key: "semana", label: "Semana" }] as const).map(o => (
                <button key={o.key} onClick={() => setCalMode(o.key)}
                  className={cn("px-3 py-1.5 rounded-lg text-xs font-body transition-colors",
                    calMode === o.key ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")}>
                  {o.label}
                </button>
              ))}
            </div>

            {calMode === "mes" && (
            (() => {
              const monthStart = startOfMonth(calMonth);
              const monthEnd = endOfMonth(calMonth);
              const startWeekday = monthStart.getDay();
              const daysInMonth = monthEnd.getDate();
              const y = calMonth.getFullYear();
              const m = calMonth.getMonth();
              const pad = (n: number) => String(n).padStart(2, "0");
              const t = new Date();
              const todayKey = `${t.getFullYear()}-${pad(t.getMonth() + 1)}-${pad(t.getDate())}`;
              const cells: ({ day: number; key: string } | null)[] = [];
              for (let i = 0; i < startWeekday; i++) cells.push(null);
              for (let d = 1; d <= daysInMonth; d++) cells.push({ day: d, key: `${y}-${pad(m + 1)}-${pad(d)}` });
              const weekdays = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
              const noDate = filteredPosts.filter(p => !p.scheduled_date && p.status !== "publicado");
              return (
                <div className="rounded-2xl border border-border bg-card p-4">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-display font-bold text-lg capitalize">
                      {calMonth.toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}
                    </h3>
                    <div className="flex items-center gap-1">
                      <Button variant="outline" size="sm" className="h-8 w-8 p-0" onClick={() => setCalMonth(new Date(y, m - 1, 1))}>‹</Button>
                      <Button variant="outline" size="sm" className="h-8 px-3 text-xs" onClick={() => setCalMonth(startOfMonth(new Date()))}>Hoje</Button>
                      <Button variant="outline" size="sm" className="h-8 w-8 p-0" onClick={() => setCalMonth(new Date(y, m + 1, 1))}>›</Button>
                    </div>
                  </div>
                  <div className="grid grid-cols-7 gap-1.5 mb-1.5">
                    {weekdays.map(w => (
                      <div key={w} className="text-center text-[11px] font-body font-medium text-muted-foreground py-1">{w}</div>
                    ))}
                  </div>
                  <div className="grid grid-cols-7 gap-1.5">
                    {cells.map((cell, i) => {
                      if (!cell) return <div key={`e${i}`} className="min-h-[104px]" />;
                      const dayPosts = filteredPosts.filter(p => (p.scheduled_date ?? "").slice(0, 10) === cell.key);
                      const isToday = cell.key === todayKey;
                      return (
                        <div key={cell.key}
                          onDragOver={(e) => { e.preventDefault(); setCalDragOverKey(cell.key); }}
                          onDragLeave={() => setCalDragOverKey(prev => (prev === cell.key ? null : prev))}
                          onDrop={() => { if (calDragId) reschedulePost(calDragId, cell.key); setCalDragId(null); setCalDragOverKey(null); }}
                          className={cn(
                            "min-h-[104px] border rounded-lg p-1.5 bg-background flex flex-col gap-1 overflow-hidden transition-all",
                            calDragOverKey === cell.key ? "ring-2 ring-primary border-primary" : (isToday ? "border-primary" : "border-border")
                          )}>
                          <span className={cn("text-[11px] font-body font-semibold w-5 h-5 flex items-center justify-center rounded-full", isToday ? "bg-primary text-primary-foreground" : "text-muted-foreground")}>{cell.day}</span>
                          {dayPosts.slice(0, 3).map(post => (
                            /* Card com ETAPA + título + FORMATO, igual ao calendário
                               do social mídia: cor sozinha não diz o que é a peça. */
                            <button key={post.id}
                              draggable
                              onDragStart={(e) => { e.stopPropagation(); setCalDragId(post.id); }}
                              onDragEnd={() => setCalDragId(null)}
                              onClick={() => openEdit(post)}
                              style={formatColorVars(post.format)}
                              className={cn("w-full text-left rounded-lg border border-border bg-card px-1.5 py-1 shadow-sm hover:bg-muted/40 transition-colors cursor-grab active:cursor-grabbing",
                                "border-l-[3px]", FORMAT_BORDER_CLASS)}>
                              <span className={cn("inline-block rounded-full border px-1.5 py-px text-[8.5px] font-body font-bold leading-tight mb-0.5", getStatusClasses(post.status))}>
                                {CAL_ETAPA[post.status ?? ""] ?? post.status ?? "Post"}
                              </span>
                              <span className="block text-[10px] font-body font-semibold text-foreground leading-tight truncate">{post.title}</span>
                              <span className={cn("block text-[8.5px] font-body font-bold uppercase tracking-wide truncate", FORMAT_TEXT_CLASS)}>
                                {FORMAT_LABELS[post.format] ?? post.format}
                                {post.scheduled_time ? <span className="text-muted-foreground font-medium normal-case"> · {post.scheduled_time.slice(0, 5)}</span> : null}
                              </span>
                            </button>
                          ))}
                          {dayPosts.length > 3 && (
                            <span className="text-[10px] text-muted-foreground font-body px-1">+{dayPosts.length - 3}</span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  {/* Igual ao calendário da social mídia: os SEM DATA aparecem
                      como cards arrastáveis, não como uma frase. A Gabriela quer
                      VER quais são e puxar cada um pro dia certo. */}
                  {noDate.length > 0 && (
                    <div className="mt-4 rounded-xl border border-dashed border-border p-3">
                      <p className="text-[11px] font-body font-bold uppercase tracking-wide text-muted-foreground mb-2">
                        Sem data ({noDate.length}), arraste pra um dia
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {noDate.map(post => (
                          <button key={post.id}
                            draggable
                            onDragStart={(e) => { e.stopPropagation(); setCalDragId(post.id); }}
                            onDragEnd={() => setCalDragId(null)}
                            onClick={() => openEdit(post)}
                            style={formatColorVars(post.format)}
                            className={cn("text-left rounded-lg border border-border bg-card px-2 py-1.5 shadow-sm hover:bg-muted/40 transition-colors cursor-grab active:cursor-grabbing border-l-[3px] max-w-[220px]", FORMAT_BORDER_CLASS)}>
                            {/* Etapa TAMBÉM no sem-data (pedido do Walter, 31/08):
                               sem ela não dava pra saber o que já está pronto. */}
                            <span className={cn("inline-block rounded-full border px-1.5 py-px text-[8.5px] font-body font-bold leading-tight mb-0.5", getStatusClasses(post.status))}>
                              {CAL_ETAPA[post.status ?? ""] ?? post.status ?? "Post"}
                            </span>
                            <span className="block text-[11px] font-body font-semibold text-foreground leading-tight truncate">{post.title}</span>
                            <span className={cn("block text-[9px] font-body font-bold uppercase tracking-wide truncate", FORMAT_TEXT_CLASS)}>
                              {FORMAT_LABELS[post.format] ?? post.format}
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })()
            )}

            {calMode === "semana" && (
              <div>
                {(() => {
                  const pad = (n: number) => String(n).padStart(2, "0");
                  const keyOf = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
                  const todayKey = keyOf(new Date());
                  const days = Array.from({ length: 7 }, (_, i) => { const d = new Date(calWeekStart); d.setDate(d.getDate() + i); return d; });
                  const fmt = (d: Date) => d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
                  const weekdays = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
                  const shiftWeek = (delta: number) => { const d = new Date(calWeekStart); d.setDate(d.getDate() + delta); setCalWeekStart(d); };
                  return (
                    <div className="rounded-2xl border border-border bg-card p-4">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="font-display font-bold text-lg">{fmt(calWeekStart)}, {fmt(days[6])}</h3>
                        <div className="flex items-center gap-1">
                          <Button variant="outline" size="sm" className="h-8 w-8 p-0" onClick={() => shiftWeek(-7)}>‹</Button>
                          <Button variant="outline" size="sm" className="h-8 px-3 text-xs" onClick={() => setCalWeekStart(startOfWeek(new Date(), { weekStartsOn: 0 }))}>Hoje</Button>
                          <Button variant="outline" size="sm" className="h-8 w-8 p-0" onClick={() => shiftWeek(7)}>›</Button>
                        </div>
                      </div>
                      <div className="grid grid-cols-7 gap-1.5">
                        {days.map((d, i) => {
                          const key = keyOf(d);
                          const dayPosts = filteredPosts.filter(p => (p.scheduled_date ?? "").slice(0, 10) === key);
                          const isToday = key === todayKey;
                          return (
                            <div key={key}
                              onDragOver={(e) => { e.preventDefault(); setCalDragOverKey(key); }}
                              onDragLeave={() => setCalDragOverKey(prev => (prev === key ? null : prev))}
                              onDrop={() => { if (calDragId) reschedulePost(calDragId, key); setCalDragId(null); setCalDragOverKey(null); }}
                              className={cn("min-h-[320px] border rounded-lg p-1.5 bg-background flex flex-col gap-1 overflow-y-auto transition-all",
                                calDragOverKey === key ? "ring-2 ring-primary border-primary" : (isToday ? "border-primary" : "border-border"))}>
                              <div className="flex items-center justify-between px-0.5 mb-0.5">
                                <span className="text-[10px] font-body text-muted-foreground">{weekdays[i]}</span>
                                <span className={cn("text-[11px] font-body font-semibold w-5 h-5 flex items-center justify-center rounded-full", isToday ? "bg-primary text-primary-foreground" : "text-muted-foreground")}>{d.getDate()}</span>
                              </div>
                              {dayPosts.map(post => (
                                /* Mesmo card da visão de mês: etapa + título + formato. */
                                <button key={post.id} draggable
                                  onDragStart={(e) => { e.stopPropagation(); setCalDragId(post.id); }}
                                  onDragEnd={() => setCalDragId(null)}
                                  onClick={() => openEdit(post)}
                                  style={formatColorVars(post.format)}
                                  className={cn("w-full text-left rounded-lg border border-border bg-card px-1.5 py-1 shadow-sm hover:bg-muted/40 transition-colors cursor-grab active:cursor-grabbing",
                                    "border-l-[3px]", FORMAT_BORDER_CLASS)}>
                                  <span className={cn("inline-block rounded-full border px-1.5 py-px text-[8.5px] font-body font-bold leading-tight mb-0.5", getStatusClasses(post.status))}>
                                    {CAL_ETAPA[post.status ?? ""] ?? post.status ?? "Post"}
                                  </span>
                                  <span className="block text-[10px] font-body font-semibold text-foreground leading-tight truncate">{post.title}</span>
                                  <span className={cn("block text-[8.5px] font-body font-bold uppercase tracking-wide truncate", FORMAT_TEXT_CLASS)}>
                                    {FORMAT_LABELS[post.format] ?? post.format}
                                    {post.scheduled_time ? <span className="text-muted-foreground font-medium normal-case"> · {post.scheduled_time.slice(0, 5)}</span> : null}
                                  </span>
                                </button>
                              ))}
                              {dayPosts.length === 0 && <div className="text-[10px] text-muted-foreground/50 text-center py-4">-</div>}
                            </div>
                          );
                        })}
                      </div>
                      {/* Mesma faixa de SEM DATA da visão de mês. */}
                      {(() => {
                        const semData = filteredPosts.filter(p => !p.scheduled_date && p.status !== "publicado");
                        if (semData.length === 0) return null;
                        return (
                          <div className="mt-4 rounded-xl border border-dashed border-border p-3">
                            <p className="text-[11px] font-body font-bold uppercase tracking-wide text-muted-foreground mb-2">
                              Sem data ({semData.length}), arraste pra um dia
                            </p>
                            <div className="flex flex-wrap gap-2">
                              {semData.map(post => (
                                <button key={post.id}
                                  draggable
                                  onDragStart={(e) => { e.stopPropagation(); setCalDragId(post.id); }}
                                  onDragEnd={() => setCalDragId(null)}
                                  onClick={() => openEdit(post)}
                                  style={formatColorVars(post.format)}
                                  className={cn("text-left rounded-lg border border-border bg-card px-2 py-1.5 shadow-sm hover:bg-muted/40 transition-colors cursor-grab active:cursor-grabbing border-l-[3px] max-w-[220px]", FORMAT_BORDER_CLASS)}>
                                  <span className={cn("inline-block rounded-full border px-1.5 py-px text-[8.5px] font-body font-bold leading-tight mb-0.5", getStatusClasses(post.status))}>
                                    {CAL_ETAPA[post.status ?? ""] ?? post.status ?? "Post"}
                                  </span>
                                  <span className="block text-[11px] font-body font-semibold text-foreground leading-tight truncate">{post.title}</span>
                                  <span className={cn("block text-[9px] font-body font-bold uppercase tracking-wide truncate", FORMAT_TEXT_CLASS)}>
                                    {FORMAT_LABELS[post.format] ?? post.format}
                                  </span>
                                </button>
                              ))}
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  );
                })()}
              </div>
            )}
          </div>
        )}

        {overview ? (
          <div data-tour="criando-board-m" className="md:hidden">
            {/* onDragStart com vibração: o dedo SENTE que pegou o card. É o detalhe
            que separa "site num celular" de "app". iOS ignora, Android responde. */}
        <DragDropContext onDragStart={() => tocar(12)} onDragEnd={(r) => { tocar(8); void handleDragEnd(r); }}>
            <div ref={boardMobileRef} className="flex gap-2.5 overflow-x-auto -mx-4 px-4 kanban-scroll h-[calc(100svh-230px)] min-h-[340px]">
              {COLUMNS.map((col, i) => {
                const colPosts = ordenarColuna(filteredPosts.filter(p => (p.status ?? "ideia") === col.key));
                const step = ramp[col.key];
                return (
                  <div key={col.key} className="min-w-[172px] w-[172px] flex-none flex flex-col gap-2 h-full">
                    <button onClick={() => goToColumn(i)}
                      className="relative rounded-[13px] px-3 py-2.5 text-left shrink-0 shadow-warm-sm"
                      style={{ background: `linear-gradient(140deg, ${step.from}, ${step.to})` }}>
                      <span className="absolute top-2 right-2 text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                        style={{ color: step.ink, background: "rgba(255,255,255,.2)" }}>{colPosts.length}</span>
                      <span className="font-display italic font-light text-lg leading-none" style={{ color: step.ink }}>{col.label}</span>
                    </button>

                    <Droppable droppableId={col.key}>
                    {(dropProvided, dropSnapshot) => (
                    <div ref={dropProvided.innerRef} {...dropProvided.droppableProps}
                      className={`flex-1 overflow-y-auto flex flex-col gap-2 pr-0.5 kanban-scroll rounded-xl transition-colors ${dropSnapshot.isDraggingOver ? "bg-primary/5" : ""}`}>
                      {colPosts.map((post, pIdx) => {
                        const pil = getPillar(post.pillar_id);
                        return (
                          <Draggable key={post.id} draggableId={post.id} index={pIdx}>
                          {(dragProvided, dragSnapshot) => (
                          <div ref={dragProvided.innerRef} {...dragProvided.draggableProps} {...dragProvided.dragHandleProps}
                            onClick={() => openEdit(post)}
                            className={`criando-drag-card relative bg-card rounded-[10px] pl-3 pr-2.5 py-2 text-left shadow-warm-sm border border-border cursor-grab active:cursor-grabbing ${dragSnapshot.isDragging ? "shadow-warm-lg ring-2 ring-primary/40" : ""}`}
                            style={{ borderLeftColor: step.line, borderLeftWidth: 3, ...dragProvided.draggableProps.style }}>
                            <span className="block text-[11.5px] font-body font-semibold leading-tight line-clamp-2">{post.title}</span>
                            <span className="block text-[9.5px] text-muted-foreground mt-1 truncate">{FORMAT_LABELS[post.format] || post.format}{pil ? ` · ${pil.name}` : ""}</span>
                          </div>
                          )}
                          </Draggable>
                        );
                      })}
                      {colPosts.length === 0 && (
                        <div className="text-[10.5px] text-muted-foreground/60 text-center py-6 border border-dashed border-border rounded-xl">vazio</div>
                      )}
                      {dropProvided.placeholder}
                    </div>
                    )}
                    </Droppable>
                  </div>
                );
              })}
            </div>
            </DragDropContext>
          </div>
        ) : (
        <div className="md:hidden">
          <div className="overflow-hidden -mx-4 px-4">
            <div className="flex transition-transform duration-[420ms]"
                 style={{ transform: `translateX(-${activeCol * 100}%)`, transitionTimingFunction: 'cubic-bezier(.22,.61,.36,1)' }}
                 onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}>
              {COLUMNS.map(col => {
                const colPosts = ordenarColuna(filteredPosts.filter(p => p.status === col.key));
                const isPublished = col.key === "publicado";
                const saved = byStatus[col.key];
                const step = ramp[col.key];
                const from = saved?.cover_from || step.from;
                const to = saved?.cover_type === "solid" ? (saved?.cover_from || step.from) : (saved?.cover_to || step.to);
                const ink = saved ? "#fff" : step.ink;
                const sub = saved ? "rgba(255,255,255,.78)" : step.sub;
                const title = saved?.label || col.label;
                return (
                  <div key={col.key} className="min-w-full pr-1">
                    <div className="relative">
                      <CoverHeader label="Status" title={title} count={colPosts.length} from={from} to={to} ink={ink} sub={sub} hint={COLUMN_TOOLTIPS[col.key]} />
                      <button onClick={() => openEditCover(col.key)} className="absolute top-2.5 right-12 z-10 h-7 w-7 rounded-full bg-white/15 backdrop-blur flex items-center justify-center" aria-label="Editar capa">
                        <Pencil className="h-3.5 w-3.5 text-white/90" />
                      </button>
                    </div>
                    {/* Mesma tinta clara da capa que o board desktop ganhou. */}
                    <div className="flex flex-col gap-2.5 mt-3 rounded-xl p-1.5 bg-muted/30"
                      style={/^#[0-9a-fA-F]{6}$/.test(from) ? { backgroundColor: `${from}0F` } : undefined}>
                      {colPosts.map(post => {
                        const pillar = getPillar(post.pillar_id);
                        const tc = taskCounts.get(post.id);
                        const approvalStatus = (post as unknown as { approval_status?: string | null }).approval_status ?? null;
                        const showApprovalBadge = temSocialMidia && post.status === "editando" && approvalStatus !== "aprovado";
                        const allDone = tc && tc.count > 0 && tc.done === tc.count;
                        const pendingTasks = tc ? tc.count - tc.done : 0;
                                                return (
                          <motion.div key={post.id} layout onClick={() => openEdit(post)}
                            style={{ borderLeftColor: ramp[post.status ?? "ideia"]?.line ?? "transparent", borderLeftWidth: 4 }}
                            className={`group relative bg-card rounded-xl p-3 shadow-warm-sm border border-border cursor-pointer hover:shadow-warm-md transition-all duration-200 ${isPublished ? "opacity-70" : ""}`}>
                            {/* Editar + excluir lado a lado, iguais ao kanban desktop. */}
                            <div className="absolute top-2 right-2 flex items-center gap-1 z-10">
                              <button
                                type="button"
                                onClick={(e) => { e.stopPropagation(); openEdit(post); }}
                                className="h-6 w-6 rounded-full bg-muted hover:bg-primary hover:text-primary-foreground text-muted-foreground flex items-center justify-center transition-colors"
                                aria-label="Editar post"
                              >
                                <Pencil className="h-3 w-3" />
                              </button>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setDeleteTarget({ id: post.id, title: post.title });
                                }}
                                className="h-6 w-6 rounded-full bg-destructive/80 hover:bg-destructive text-white flex items-center justify-center transition-colors"
                                aria-label="Excluir post"
                              >
                                <X className="h-3 w-3" />
                              </button>
                            </div>
                            <p title={post.title} className="font-body font-medium text-sm text-foreground mb-1.5 leading-snug line-clamp-1 pr-14">
                              {showApprovalBadge && (
                                <span
                                  className="inline-flex items-center justify-center h-4 w-4 rounded-full bg-yellow-400 text-yellow-950 text-[10px] font-bold mr-1 align-middle"
                                  title="Aguardando a aprovação da sua social mídia (aba Aprovações)"
                                  aria-label="Aguardando a aprovação da sua social mídia"
                                >!</span>
                              )}
                              {post.title}
                            </p>
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <PlatformIcon platform={post.platform} size="sm" />
                              <span style={formatColorVars(post.format)} className={`text-[10px] font-body font-bold uppercase tracking-wide bg-muted/60 px-1.5 py-0.5 rounded ${FORMAT_TEXT_CLASS}`}>{FORMAT_LABELS[post.format] || post.format}</span>
                              {pillar && <span className="px-1.5 py-0.5 rounded text-xs font-body text-primary-foreground" style={{ backgroundColor: pillar.color }}>{pillar.name}</span>}
                              {post.week_number != null && (
                                <span className="px-1.5 py-0.5 rounded text-xs font-body bg-muted text-muted-foreground border border-border">
                                  S{post.week_number}
                                </span>
                              )}
                              {isPublished && <span className="px-1.5 py-0.5 rounded text-xs font-body bg-secondary text-secondary-foreground">Publicado</span>}
                            </div>
                            {post.scheduled_date && <p className="text-xs text-muted-foreground font-body mt-2 flex items-center gap-1"><Calendar className="h-3 w-3" /> {post.scheduled_date}{post.scheduled_time ? ` às ${post.scheduled_time}` : ""}</p>}
                            {tc && tc.count > 0 && (
                              <span className={`inline-flex items-center gap-1 mt-1.5 text-[10px] font-body font-semibold px-1.5 py-0.5 rounded ${allDone ? "bg-secondary/20 text-secondary" : "bg-muted text-muted-foreground"}`}>
                                {allDone ? "✓" : `${pendingTasks} tarefa${pendingTasks !== 1 ? "s" : ""}`}
                              </span>
                            )}
                            <div className="mt-2.5" onClick={(e) => e.stopPropagation()}>
                              <Select value={post.status ?? "ideia"} onValueChange={(val) => movePostStatus(post.id, val)}>
                                <SelectTrigger className="h-8 w-full gap-1.5 px-3 rounded-lg border border-primary/30 bg-primary/5 text-xs font-body font-semibold text-primary">
                                  <ArrowLeftRight className="h-3.5 w-3.5" /> Mover para…
                                </SelectTrigger>
                                <SelectContent>{STATUS_OPTIONS.map(s => <SelectItem key={s.key} value={s.key}>{s.label}</SelectItem>)}</SelectContent>
                              </Select>
                            </div>
                          </motion.div>
                        );
                      })}
                      <button onClick={openNew}
                        className="border-[1.5px] border-dashed border-border rounded-2xl py-3 text-sm font-body text-muted-foreground">
                        + Adicionar card
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          <div className="flex justify-center gap-1.5 mt-3">
            {COLUMNS.map((c, i) => (
              <button key={c.key} onClick={() => setActiveCol(i)} aria-label={c.label}
                className={cn("h-1.5 rounded-full transition-all", i === activeCol ? "w-5 bg-primary" : "w-1.5 bg-muted-foreground/25")} />
            ))}
          </div>
        </div>
        )}
      </motion.div>
      <PostEditor open={drawerOpen} onOpenChange={setDrawerOpen} post={selectedPost} pillars={pillars} userId={activeAccountId || user?.id || ""} onSaved={() => { /* invalidations */ }} initialFormat={pendingFormat ?? undefined} initialStatus={pendingStatus ?? undefined} />

      <FormatPicker open={pickerOpen} onPick={startFromFormat} onBlank={startBlank} onOpenChange={setPickerOpen} />

      <Dialog open={!!editing} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent className="sm:max-w-lg rounded-2xl">
          <DialogHeader className="text-left">
            <DialogTitle className="font-display">Editar capa{editColumn ? `, ${editColumn.label}` : ""}</DialogTitle>
          </DialogHeader>

          <div className="mt-2 space-y-4">
            <CoverHeader
              label="Status"
              title={editLabel || editColumn?.label || ""}
              from={editFrom}
              to={editType === "gradient" ? editTo : editFrom}
            />

            <div className="flex items-center gap-1 bg-muted rounded-xl p-1">
              {([["gradient", "Gradiente"], ["solid", "Cor única"]] as const).map(([t, lbl]) => (
                <button key={t} onClick={() => setEditType(t)}
                  className={cn("flex-1 py-1.5 rounded-lg text-xs font-body transition-colors", editType === t ? "bg-card text-foreground shadow-warm-sm font-semibold" : "text-muted-foreground")}>
                  {lbl}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 text-sm font-body text-muted-foreground">
                <input type="color" value={editFrom} onChange={(e) => setEditFrom(e.target.value)} className="h-9 w-12 rounded-lg border border-border bg-transparent cursor-pointer" />
                {editType === "gradient" ? "Cor inicial" : "Cor"}
              </label>
              {editType === "gradient" && (
                <label className="flex items-center gap-2 text-sm font-body text-muted-foreground">
                  <input type="color" value={editTo} onChange={(e) => setEditTo(e.target.value)} className="h-9 w-12 rounded-lg border border-border bg-transparent cursor-pointer" />
                  Cor final
                </label>
              )}
            </div>

            <Input value={editLabel} onChange={(e) => setEditLabel(e.target.value)}
              placeholder={editColumn?.label || "Nome do status"} className="rounded-xl font-body" />

            <div className="flex items-center gap-2 pt-1">
              <Button variant="outline" className="flex-1 font-body" onClick={() => { if (editing) resetCover(editing); setEditing(null); }}>
                Restaurar padrão
              </Button>
              <Button variant="hero" className="flex-1 font-body" disabled={isSaving}
                onClick={() => {
                  if (!editing) return;
                  saveCover({
                    status_key: editing,
                    cover_type: editType,
                    cover_from: editFrom,
                    cover_to: editType === "gradient" ? editTo : null,
                    label: editLabel || null,
                  });
                  setEditing(null);
                }}>
                Salvar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="font-display">Excluir post?</AlertDialogTitle>
            <AlertDialogDescription className="font-body">
              {deleteTarget ? `"${deleteTarget.title}" será removido permanentemente. Essa ação não pode ser desfeita.` : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="font-body">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90 font-body"
              onClick={() => {
                if (!deleteTarget) return;
                deletePost.mutate(deleteTarget.id, {
                  onSuccess: () => toast.success("Post excluído"),
                  onError: () => toast.error("Erro ao excluir post."),
                });
                setDeleteTarget(null);
              }}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Criando;
