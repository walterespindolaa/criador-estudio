import { useMemo, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  addDays, addMonths, format, isSameDay, isSameMonth,
  startOfMonth, startOfWeek, subMonths,
  endOfWeek, endOfMonth, startOfYear, endOfYear, subDays,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import { ChevronLeft, ChevronRight, CalendarDays, Clock, ChevronDown, Users, Loader2, Handshake, AlertTriangle, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useActiveAccount } from "@/contexts/AccountContext";
import { useExternalClients, invalidatePostsEverywhere } from "@/hooks/useCriaPost";
import { useMeusParceiros } from "@/hooks/useParceiro";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { CLIENT_COLORS } from "@/components/accounts/CriaPostBoard";
import { toast } from "sonner";

// Estados de aprovação (mesmos rótulos do Cria Post) pro popup editável do post.
const STATUS_OPTS: { key: string; label: string }[] = [
  { key: "em_producao", label: "Em produção" },
  { key: "pendente", label: "Aguardando cliente" },
  { key: "ajuste_solicitado", label: "Ajuste solicitado" },
  { key: "aprovado", label: "Aprovado" },
  { key: "postado", label: "Postado" },
];

// Lê um flag salvo em localStorage ("1"/"0"); usa o padrão quando não há nada.
function readFlag(key: string, fallback: boolean): boolean {
  try { const v = localStorage.getItem(key); return v === null ? fallback : v === "1"; }
  catch { return fallback; }
}
function writeFlag(key: string, val: boolean) {
  try { localStorage.setItem(key, val ? "1" : "0"); } catch { /* segue */ }
}

const sbFrom = supabase.from.bind(supabase) as unknown as (t: string) => ReturnType<typeof supabase.from>;
const WEEKDAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

// Filtro por período (mesmo padrão do Dashboard/Criando): restringe quais posts
// aparecem no calendário geral. "Tudo" = mostra tudo (comportamento antigo).
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
// Devolve o intervalo (Date) de cada período; null = sem limite ("Tudo").
function getDateRange(period: PeriodKey): { start: Date; end: Date } | null {
  const now = new Date();
  switch (period) {
    case "tudo": return null;
    case "hoje": return { start: new Date(now.getFullYear(), now.getMonth(), now.getDate()), end: new Date(now.getFullYear(), now.getMonth(), now.getDate()) };
    case "semana": return { start: startOfWeek(now, { weekStartsOn: 0 }), end: endOfWeek(now, { weekStartsOn: 0 }) };
    case "quinzenal": return { start: subDays(now, 14), end: now };
    case "mes": return { start: startOfMonth(now), end: endOfMonth(now) };
    case "ano": return { start: startOfYear(now), end: endOfYear(now) };
    default: return null;
  }
}

type CalPost = {
  id: string; title: string; format: string; platform: string;
  external_client_id: string; scheduled_date: string | null; scheduled_time: string | null;
  approval_status: string | null; caption: string | null;
  /* Produção externa (parceiro). Vêm sempre, mas só entram na grade no modo
     "Com parceiros". */
  assignee_id: string | null; prazo_producao: string | null;
  producao_status: "aguardando" | "em_producao" | "entregue" | "ajuste" | null;
};

/* ═══════════════════════════════════════════════════════════════════════════
   O MODO "COM PARCEIROS" DO CALENDÁRIO (Walter, 20/09/2026)

   O calendário mostrava só a data de POSTAGEM. Só que entre a social mídia e
   a postagem existe outra data: o prazo em que o designer ou o filmmaker
   devolve a peça. Sem ela na grade, a pessoa só descobre que a entrega cai
   depois da postagem quando o cliente cobra.

   Ligado, o calendário passa a mostrar só os posts que estão com parceiro,
   em DOIS marcos por post:
     · a ENTREGA, no dia do prazo combinado, com a inicial de quem faz;
     · a POSTAGEM, no dia agendado, com aviso quando o prazo cai no mesmo
       dia ou depois dela (não sobra tempo pra revisar e aprovar).
   Dá pra filtrar por um parceiro só, pra ver a semana de uma pessoa.
   ═══════════════════════════════════════════════════════════════════════════ */
type CalItem = { kind: "postagem" | "entrega"; post: CalPost };

/** Postagem em risco: entrega combinada no mesmo dia ou depois da postagem,
 *  ou sem prazo nenhum combinado. */
function emRisco(p: CalPost): boolean {
  if (!p.scheduled_date) return false;
  if (p.producao_status === "entregue") return false;
  if (!p.prazo_producao) return true;
  return p.prazo_producao >= p.scheduled_date;
}

const dkey = (d: Date) => format(d, "yyyy-MM-dd");

export function ManagerCalendar({ somenteParceiros = false, compacto = false }: {
  /** Aba "Com parceiros": o modo parceiros vem ligado e sem o botao de desligar. */
  somenteParceiros?: boolean;
  /** Sem o titulo "Calendario" (a tela em volta ja tem o dela). */
  compacto?: boolean;
} = {}) {
  const { user } = useAuth();
  const { agencyOwnerId } = useActiveAccount();
  const qc = useQueryClient();
  const { clients } = useExternalClients();
  const [cursor, setCursor] = useState(() => new Date());
  const [view, setView] = useState<"mes" | "semana">("mes");
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  // "A agendar" começa MINIMIZADA por padrão (ocupava espaço à toa). Persiste por dispositivo.
  const [aAgendarOpen, setAAgendarOpen] = useState(() => readFlag("cal_aagendar_open", false));
  // Legenda de clientes (chips coloridos): colapsável. Com muitos clientes (>8) começa oculta.
  const [chipsOpen, setChipsOpen] = useState(() => readFlag("cal_chips_open", clients.length <= 8));
  // Post aberto no popup editável (clicar num card do calendário geral).
  const [editPost, setEditPost] = useState<CalPost | null>(null);
  // Dia aberto no mobile: como cada célula fica minúscula no celular, tocar no dia
  // abre a lista dos itens dele num Dialog (cada item abre o popup de edição).
  const [dayModal, setDayModal] = useState<string | null>(null);
  // Filtro por período (Tudo/Hoje/Semana/Quinzenal/Mês/Ano/Personalizado).
  const [period, setPeriod] = useState<PeriodKey>("tudo");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  // Modo "Com parceiros": só posts delegados, com entrega e postagem na grade.
  // `quemFiltro` vazio = todos os parceiros.
  const { data: parceiros = [] } = useMeusParceiros();
  const [soParceirosLivre, setSoParceiros] = useState(() => readFlag("cal_so_parceiros", false));
  const soParceiros = somenteParceiros || soParceirosLivre;
  const [quemFiltro, setQuemFiltro] = useState<string>("");
  /* Post cujo chip de ENTREGA está sob o mouse agora. Enquanto ele existe, a
     postagem daquele mesmo post acende no dia dela. Null = ninguém. */
  const [espiando, setEspiando] = useState<string | null>(null);
  const toggleSoParceiros = () => setSoParceiros((v) => { const n = !v; writeFlag("cal_so_parceiros", n); return n; });
  const nomeParceiro = useMemo(() => {
    const m: Record<string, string> = {};
    for (const pc of parceiros) m[pc.member_id] = pc.nome;
    return m;
  }, [parceiros]);
  // Guarda se houve arraste de verdade: evita que o clique disparado logo após um
  // drop abra o popup de edição (drag e clique coexistem no mesmo card).
  const draggingRef = useRef(false);
  const toggleAAgendar = () => setAAgendarOpen((v) => { const n = !v; writeFlag("cal_aagendar_open", n); return n; });
  const toggleChips = () => setChipsOpen((v) => { const n = !v; writeFlag("cal_chips_open", n); return n; });

  // Intervalo do período em texto (yyyy-MM-dd) pra comparar direto com scheduled_date.
  const periodRange = useMemo(() => {
    if (period === "personalizado") {
      if (!customFrom || !customTo) return null;
      return customFrom <= customTo ? { start: customFrom, end: customTo } : { start: customTo, end: customFrom };
    }
    const r = getDateRange(period);
    return r ? { start: format(r.start, "yyyy-MM-dd"), end: format(r.end, "yyyy-MM-dd") } : null;
  }, [period, customFrom, customTo]);

  // Ao escolher um período pronto, leva o calendário pro mês desse intervalo
  // (senão a grade poderia ficar num mês sem nenhum post do filtro).
  const handlePeriod = (key: PeriodKey) => {
    setPeriod(key);
    if (key !== "tudo" && key !== "personalizado") {
      const r = getDateRange(key);
      if (r) setCursor(r.start);
    }
  };

  const colorOf = useMemo(() => {
    const map: Record<string, string> = {};
    clients.forEach((c, i) => { map[c.id] = c.color || CLIENT_COLORS[i % CLIENT_COLORS.length]; });
    return map;
  }, [clients]);
  const nameOf = useMemo(() => {
    const map: Record<string, string> = {};
    clients.forEach((c) => { map[c.id] = c.name; });
    return map;
  }, [clients]);

  const { data: posts = [] } = useQuery({
    queryKey: ["manager-calendar", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await sbFrom("posts")
        .select("id, title, format, platform, external_client_id, scheduled_date, scheduled_time, approval_status, caption, assignee_id, prazo_producao, producao_status")
        .eq("user_id", user!.id)
        .not("external_client_id", "is", null);
      if (error) throw error;
      return (data as CalPost[]) ?? [];
    },
  });

  const reschedule = useMutation({
    mutationFn: async ({ id, date, time }: { id: string; date: string | null; time?: string | null }) => {
      const patch: Record<string, unknown> = { scheduled_date: date };
      if (time !== undefined) patch.scheduled_time = time;
      const { error } = await sbFrom("posts").update(patch).eq("id", id);
      if (error) throw error;
    },
    // Update OTIMISTA: o card muda de dia na hora, sem voltar e pular depois do refetch.
    onMutate: async ({ id, date, time }: { id: string; date: string | null; time?: string | null }) => {
      await qc.cancelQueries({ queryKey: ["manager-calendar", user?.id] });
      const prev = qc.getQueryData<CalPost[]>(["manager-calendar", user?.id]);
      qc.setQueryData<CalPost[]>(["manager-calendar", user?.id], (old) =>
        Array.isArray(old) ? old.map((p) => (p.id === id ? { ...p, scheduled_date: date, ...(time !== undefined ? { scheduled_time: time } : {}) } : p)) : old);
      return { prev };
    },
    onError: (_e: unknown, _v, ctx) => {
      const c = ctx as { prev?: CalPost[] } | undefined;
      if (c?.prev) qc.setQueryData(["manager-calendar", user?.id], c.prev);
      toast.error("Erro ao atualizar.");
    },
    // Propaga o remarcar pro kanban, agenda, aprovacoes, home e o proprio calendario.
    // O card ja esta no dia certo pelo update otimista, o refetch so confirma.
    onSettled: () => invalidatePostsEverywhere(qc, agencyOwnerId),
  });

  // Salva os campos editáveis do post pelo popup (título, data, horário, status, legenda).
  // Reflete no calendário geral e no Cria Post do cliente (invalida as duas queries).
  const savePost = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Record<string, unknown> }) => {
      const { error } = await sbFrom("posts").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Post atualizado!");
      invalidatePostsEverywhere(qc, agencyOwnerId);
      setEditPost(null);
    },
    onError: () => toast.error("Não consegui salvar o post."),
  });

  const visible = (p: CalPost) => {
    if (hidden.has(p.external_client_id)) return false;
    if (soParceiros && !p.assignee_id) return false;
    if (soParceiros && quemFiltro && p.assignee_id !== quemFiltro) return false;
    return true;
  };
  const dentroDoPeriodo = (d: string) => !periodRange || (d >= periodRange.start && d <= periodRange.end);
  const byDay = useMemo(() => {
    const map: Record<string, CalItem[]> = {};
    for (const p of posts) {
      if (!visible(p)) continue;
      // Fora do período escolhido? Não entra na grade.
      if (p.scheduled_date && dentroDoPeriodo(p.scheduled_date)) (map[p.scheduled_date] ??= []).push({ kind: "postagem", post: p });
      // No modo parceiros a ENTREGA vira um marco próprio, no dia do prazo.
      if (soParceiros && p.prazo_producao && dentroDoPeriodo(p.prazo_producao)) (map[p.prazo_producao] ??= []).push({ kind: "entrega", post: p });
    }
    // Entrega antes da postagem no mesmo dia, que é a ordem em que acontece.
    for (const k of Object.keys(map)) map[k].sort((a, b) => (a.kind === b.kind ? 0 : a.kind === "entrega" ? -1 : 1));
    return map;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [posts, hidden, periodRange, soParceiros, quemFiltro]);
  /* SÓ UM CHIP POR POST NO MODO PARCEIROS (Walter, 21/09/2026: "não precisa
     aparecer os dois, vai gerar muita confusão"). Entrega e postagem são o
     MESMO post em dois dias, e ver os dois na grade dava a impressão de dois
     trabalhos. Agora manda a ENTREGA, que é o que a social mídia cobra; a
     postagem só acende enquanto o mouse está em cima da entrega, pra ela ver
     de relance quanto tempo sobra entre uma coisa e outra, e apaga ao sair.
     Post sem prazo combinado não tem entrega na grade: esse continua
     aparecendo como postagem, senão sumiria do calendário. */
  const comEntrega = useMemo(() => {
    const s = new Set<string>();
    for (const lista of Object.values(byDay)) {
      for (const it of lista) if (it.kind === "entrega") s.add(it.post.id);
    }
    return s;
  }, [byDay]);
  const naGrade = (lista: CalItem[]) =>
    !soParceiros ? lista
      : lista.filter((it) => it.kind === "entrega" || !comEntrega.has(it.post.id) || espiando === it.post.id);

  const unscheduled = posts.filter((p) => !p.scheduled_date && visible(p));
  const emRiscoLista = useMemo(() => soParceiros ? posts.filter((p) => visible(p) && emRisco(p)) : [],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [posts, hidden, soParceiros, quemFiltro]);

  // Mês: 6 semanas a partir do domingo da semana do dia 1. Semana: 7 dias.
  const gridStart = view === "mes"
    ? startOfWeek(startOfMonth(cursor), { weekStartsOn: 0 })
    : startOfWeek(cursor, { weekStartsOn: 0 });
  const cellCount = view === "mes" ? 42 : 7;
  const days = Array.from({ length: cellCount }, (_, i) => addDays(gridStart, i));

  const goPrev = () => setCursor((c) => (view === "mes" ? subMonths(c, 1) : addDays(c, -7)));
  const goNext = () => setCursor((c) => (view === "mes" ? addMonths(c, 1) : addDays(c, 7)));
  const headerLabel = view === "mes"
    ? format(cursor, "MMMM 'de' yyyy", { locale: ptBR })
    : `${format(gridStart, "d MMM", { locale: ptBR })}, ${format(addDays(gridStart, 6), "d MMM", { locale: ptBR })}`;

  const onDrop = (date: string | null) => (e: React.DragEvent) => {
    e.preventDefault();
    const id = e.dataTransfer.getData("text/plain");
    if (id) reschedule.mutate({ id, date });
  };
  const allowDrop = (e: React.DragEvent) => e.preventDefault();

  const toggleClient = (id: string) =>
    setHidden((prev) => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  // Card do post: arrastável entre os dias e clicável pra abrir o popup editável.
  // O drag nativo não dispara "click" depois de um arraste real, então dá pra ter os dois.
  const chip = (p: CalPost, revelado = false) => {
    const color = colorOf[p.external_client_id] ?? "#EA4918";
    return (
      <div
        key={p.id}
        draggable
        onDragStart={(e) => { draggingRef.current = false; e.dataTransfer.setData("text/plain", p.id); e.dataTransfer.effectAllowed = "move"; }}
        onDrag={() => { draggingRef.current = true; }}
        // Limpa a flag no tick seguinte: o clique fantasma que alguns navegadores
        // disparam logo após o drop já foi ignorado (o ref ainda está true nele).
        onDragEnd={() => { window.setTimeout(() => { draggingRef.current = false; }, 0); }}
        onClick={() => { if (draggingRef.current) return; setEditPost(p); }}
        className={`cursor-grab active:cursor-grabbing rounded-md px-1.5 py-1 mb-1 text-[10px] leading-tight truncate ${
          revelado ? "ring-2 ring-violet-400 ring-offset-1" : ""}`}
        style={{ backgroundColor: `${color}1a`, borderLeft: `3px solid ${color}` }}
        title={`${nameOf[p.external_client_id] ?? ""} · ${p.title}${soParceiros && emRisco(p) ? " · entrega combinada no dia da postagem ou depois" : ""}`}
      >
        {/* NO MODO PARCEIROS O CARD DIZ O QUE E (Walter, 20/09/2026: "quando
            aparece 2 posts nao fica claro"). Entrega e postagem do MESMO post
            caem em dias diferentes, e sem rotulo pareciam dois posts. Aqui a
            primeira linha diz "Postagem · cliente" e a de entrega diz "Entrega
            · quem"; o titulo vem embaixo, nos dois. */}
        {soParceiros && (
          <span className="block text-[9px] font-bold uppercase tracking-wider opacity-80 truncate">
            {emRisco(p) && <AlertTriangle className="inline h-2.5 w-2.5 mr-0.5 text-red-600 -mt-0.5" />}
            Postagem · {nameOf[p.external_client_id] ?? ""}
          </span>
        )}
        {p.scheduled_time && <span className="font-semibold mr-1">{p.scheduled_time.slice(0, 5)}</span>}
        {p.title}
      </div>
    );
  };

  /* Marco de ENTREGA: não arrasta (arrastar aqui mudaria a data da postagem,
     que é outra coisa). Clica e abre o post. Violeta é a cor do parceiro no
     resto do app; vermelho quando o prazo passou e não entregou; verde quando
     já entregou. */
  const chipEntrega = (p: CalPost) => {
    const hoje = dkey(new Date());
    const entregue = p.producao_status === "entregue";
    const atrasada = !entregue && !!p.prazo_producao && p.prazo_producao < hoje;
    const quem = p.assignee_id ? (nomeParceiro[p.assignee_id] ?? "Parceiro") : "Parceiro";
    return (
      <button
        key={`e-${p.id}`}
        type="button"
        onClick={() => setEditPost(p)}
        /* Passar o mouse aqui acende a postagem deste post no dia dela.
           onFocus/onBlur repetem o gesto pra quem navega pelo teclado. */
        onMouseEnter={() => setEspiando(p.id)}
        onMouseLeave={() => setEspiando((atual) => (atual === p.id ? null : atual))}
        onFocus={() => setEspiando(p.id)}
        onBlur={() => setEspiando((atual) => (atual === p.id ? null : atual))}
        className={`w-full text-left rounded-md px-1.5 py-1 mb-1 text-[10px] leading-tight truncate border border-dashed ${
          entregue ? "bg-green-50 border-green-300 text-green-800"
          : atrasada ? "bg-red-50 border-red-300 text-red-800"
          : "bg-violet-50 border-violet-300 text-violet-900"}`}
        title={`Entrega de ${quem} · ${nameOf[p.external_client_id] ?? ""} · ${p.title}${
          p.scheduled_date ? ` · posta em ${p.scheduled_date.slice(8, 10)}/${p.scheduled_date.slice(5, 7)}` : ""}`}
      >
        <span className="block text-[9px] font-bold uppercase tracking-wider truncate">
          <span className={`inline-grid place-items-center w-3.5 h-3.5 rounded-full text-white text-[8px] font-bold mr-1 -mt-0.5 ${
            entregue ? "bg-green-600" : atrasada ? "bg-red-600" : "bg-violet-600"}`}>
            {entregue ? <Check className="h-2.5 w-2.5" /> : quem.charAt(0).toUpperCase()}
          </span>
          {entregue ? "Entregue" : atrasada ? "Entrega atrasada" : "Entrega"} · {quem.split(" ")[0]}
        </span>
        <span className="block truncate">{p.title}</span>
      </button>
    );
  };
  const renderItem = (it: CalItem) =>
    it.kind === "entrega" ? chipEntrega(it.post) : chip(it.post, soParceiros && espiando === it.post.id);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        {compacto ? <span /> : <h1 className="text-2xl font-display font-extrabold text-foreground tracking-tight">Calendário</h1>}
        <div className="flex items-center gap-1.5 flex-wrap">
          <div className="flex rounded-lg border border-border overflow-hidden mr-1">
            <button type="button" onClick={() => setView("mes")}
              className={`px-3 py-1.5 text-xs font-body transition-colors ${view === "mes" ? "bg-primary text-primary-foreground" : "bg-card text-muted-foreground hover:text-foreground"}`}>Mês</button>
            <button type="button" onClick={() => setView("semana")}
              className={`px-3 py-1.5 text-xs font-body transition-colors ${view === "semana" ? "bg-primary text-primary-foreground" : "bg-card text-muted-foreground hover:text-foreground"}`}>Semana</button>
          </div>
          <Button variant="outline" size="sm" onClick={goPrev} aria-label="Anterior"><ChevronLeft className="h-4 w-4" /></Button>
          <span className="text-sm font-display font-semibold text-foreground min-w-[140px] text-center capitalize">
            {headerLabel}
          </span>
          <Button variant="outline" size="sm" onClick={goNext} aria-label="Próximo"><ChevronRight className="h-4 w-4" /></Button>
          <Button variant="outline" size="sm" onClick={() => setCursor(new Date())}>Hoje</Button>
        </div>
      </div>

      {/* Filtro por cliente (cor): legenda colapsável pra não poluir com muitos clientes. */}
      {clients.length > 0 && (
        <div className="space-y-1.5">
          <button type="button" onClick={toggleChips}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-body font-semibold border border-border text-muted-foreground hover:text-foreground transition-colors">
            <Users className="h-3.5 w-3.5" /> Clientes ({clients.length})
            <ChevronDown className={`h-3.5 w-3.5 transition-transform ${chipsOpen ? "rotate-180" : ""}`} />
          </button>
          {chipsOpen && (
            <div className="flex flex-wrap gap-1.5">
              {clients.map((c) => {
                const color = colorOf[c.id];
                const off = hidden.has(c.id);
                return (
                  <button key={c.id} type="button" onClick={() => toggleClient(c.id)}
                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-body border transition-colors ${off ? "opacity-40 border-border" : "border-border"}`}>
                    <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color }} />
                    {c.name}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Filtro por período: restringe os posts exibidos na grade (mesmo padrão do Dashboard). */}
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="inline-flex items-center gap-1.5 text-[11px] uppercase tracking-wider font-display font-semibold text-muted-foreground mr-0.5">
          <CalendarDays className="h-3.5 w-3.5" /> Período
        </span>
        {PERIOD_OPTIONS.map((opt) => {
          const on = period === opt.key;
          return (
            <button key={opt.key} type="button" onClick={() => handlePeriod(opt.key)}
              className={`px-2.5 py-1 rounded-full text-xs font-body border transition-colors ${on ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:text-foreground"}`}>
              {opt.label}
            </button>
          );
        })}
        {period === "personalizado" && (
          <div className="flex items-center gap-1.5">
            <Input type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} className="h-8 w-[9.5rem] rounded-lg text-xs" />
            <span className="text-xs text-muted-foreground font-body">até</span>
            <Input type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)} className="h-8 w-[9.5rem] rounded-lg text-xs" />
          </div>
        )}
      </div>

      {/* Com parceiros: só o que está delegado, com entrega e postagem na grade. */}
      {parceiros.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          {!somenteParceiros && (
            <button type="button" onClick={toggleSoParceiros}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-body font-semibold border transition-colors ${
                soParceiros ? "bg-violet-600 text-white border-violet-600" : "border-border text-muted-foreground hover:text-foreground"}`}>
              <Handshake className="h-3.5 w-3.5" /> Com parceiros
            </button>
          )}
          {soParceiros && (
            <>
              <button type="button" onClick={() => setQuemFiltro("")}
                className={`px-2.5 py-1 rounded-full text-xs font-body border transition-colors ${!quemFiltro ? "bg-violet-100 text-violet-900 border-violet-300" : "border-border text-muted-foreground hover:text-foreground"}`}>
                Todos
              </button>
              {parceiros.map((pc) => (
                <button key={pc.member_id} type="button" onClick={() => setQuemFiltro(pc.member_id)}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-body border transition-colors ${
                    quemFiltro === pc.member_id ? "bg-violet-100 text-violet-900 border-violet-300" : "border-border text-muted-foreground hover:text-foreground"}`}>
                  <span className="inline-grid place-items-center w-4 h-4 rounded-full bg-violet-600 text-white text-[9px] font-bold">{pc.nome.charAt(0).toUpperCase()}</span>
                  {pc.nome.split(" ")[0]}
                </button>
              ))}
              <span className="text-[11px] font-body text-muted-foreground ml-1">
                cada post aparece uma vez, no dia da entrega. Passe o mouse em cima pra ver o dia em que ele vai ao ar.
              </span>
            </>
          )}
        </div>
      )}

      {/* Postagens em risco: a entrega combinada cai no dia da postagem ou
          depois, ou nem tem prazo. É o cruzamento que o Walter pediu, em
          lista, porque na grade a pessoa teria que comparar dois dias de cabeça. */}
      {soParceiros && emRiscoLista.length > 0 && (
        <div className="rounded-xl border border-red-200 bg-red-50/60 p-3">
          <p className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider font-display font-semibold text-red-800 mb-1.5">
            <AlertTriangle className="h-3.5 w-3.5" /> Postagem em risco ({emRiscoLista.length})
          </p>
          <div className="space-y-1">
            {emRiscoLista.map((p) => (
              <button key={p.id} type="button" onClick={() => setEditPost(p)}
                className="w-full text-left flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-red-100/60 transition-colors">
                <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: colorOf[p.external_client_id] ?? "#EA4918" }} />
                <span className="text-[12px] font-body font-semibold text-foreground truncate flex-1">{p.title}</span>
                <span className="text-[11px] font-body text-red-800 shrink-0">
                  {p.prazo_producao
                    ? `entrega ${p.prazo_producao.slice(8, 10)}/${p.prazo_producao.slice(5, 7)} · posta ${p.scheduled_date!.slice(8, 10)}/${p.scheduled_date!.slice(5, 7)}`
                    : `sem prazo combinado · posta ${p.scheduled_date!.slice(8, 10)}/${p.scheduled_date!.slice(5, 7)}`}
                  {p.assignee_id && nomeParceiro[p.assignee_id] ? ` · ${nomeParceiro[p.assignee_id].split(" ")[0]}` : ""}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* A agendar: minimizada por padrão. O container inteiro continua sendo a zona de
          drop pra desagendar (arrastar um post pra cá), mesmo colapsada. */}
      <div
        onDrop={onDrop(null)} onDragOver={allowDrop}
        className="rounded-xl border border-dashed border-border bg-card/50 p-3"
      >
        <button type="button" onClick={toggleAAgendar}
          className="w-full flex items-center gap-1.5 text-[11px] uppercase tracking-wider font-display font-semibold text-muted-foreground hover:text-foreground transition-colors">
          <CalendarDays className="h-3.5 w-3.5" /> A agendar ({unscheduled.length})
          <ChevronDown className={`h-3.5 w-3.5 ml-auto transition-transform ${aAgendarOpen ? "rotate-180" : ""}`} />
        </button>
        {aAgendarOpen && (
          unscheduled.length === 0 ? (
            <p className="text-xs text-muted-foreground font-body mt-2">Tudo agendado. Arraste um post pra cá pra desagendar.</p>
          ) : (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {unscheduled.map((p) => (
                <div key={p.id} className="min-w-[120px] max-w-[200px]">{chip(p)}</div>
              ))}
            </div>
          )
        )}
      </div>

      {/* Grade do mês */}
      <div className="rounded-xl border border-border overflow-hidden bg-card">
        <div className="grid grid-cols-7 bg-muted/40 border-b border-border">
          {WEEKDAYS.map((w) => (
            <div key={w} className="text-[11px] font-body font-semibold text-muted-foreground text-center py-2">{w}</div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {days.map((d) => {
            const dim = view === "mes" && !isSameMonth(d, cursor);
            const today = isSameDay(d, new Date());
            const list = naGrade(byDay[dkey(d)] ?? []);
            return (
              <div key={d.toISOString()}
                onDrop={onDrop(dkey(d))} onDragOver={allowDrop}
                className={`${view === "semana" ? "min-h-[110px] md:min-h-[240px]" : "min-h-[58px] md:min-h-[92px]"} border-b border-r border-border p-1 md:p-1.5 ${dim ? "bg-muted/20" : ""}`}
              >
                <div className={`text-xs md:text-[11px] font-body mb-0.5 md:mb-1 ${today ? "font-bold text-primary" : dim ? "text-muted-foreground/50" : "text-foreground"}`}>
                  {format(d, "d")}
                </div>
                {/* Desktop (md+): cards com texto e drag-and-drop, exatamente como antes. */}
                <div className="hidden md:block">{list.map(renderItem)}</div>
                {/* Mobile: indicador compacto (pontos por item + total). Tocar abre a lista do dia. */}
                {list.length > 0 && (
                  <button type="button" onClick={() => setDayModal(dkey(d))}
                    className="md:hidden w-full min-h-[28px] flex flex-wrap content-start items-center gap-0.5 rounded-md px-0.5 py-0.5 hover:bg-muted/40 transition-colors"
                    aria-label={`Ver ${list.length} item(ns) do dia ${format(d, "d")}`}>
                    {list.slice(0, 4).map((it) => (
                      <span key={`${it.kind}-${it.post.id}`}
                        className={`h-1.5 w-1.5 rounded-full ${it.kind === "entrega" ? "ring-1 ring-violet-500 bg-transparent" : ""}`}
                        style={it.kind === "entrega" ? undefined : { backgroundColor: colorOf[it.post.external_client_id] ?? "#EA4918" }} />
                    ))}
                    <span className="ml-auto text-[10px] font-body font-bold text-muted-foreground">{list.length}</span>
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <p className="text-[11px] text-muted-foreground font-body flex items-center gap-1.5">
        <Clock className="h-3 w-3" /> Arraste os posts entre os dias pra remarcar. Clique num post pra editar.
      </p>

      {/* Mobile: lista dos itens do dia tocado. Cada item abre o popup de edição. */}
      {dayModal && (() => {
        const items = byDay[dayModal] ?? [];
        const d = new Date(`${dayModal}T00:00:00`);
        return (
          <Dialog open onOpenChange={(o) => { if (!o) setDayModal(null); }}>
            <DialogContent className="sm:max-w-md rounded-2xl max-h-[80vh] overflow-y-auto">
              <DialogHeader><DialogTitle className="font-display capitalize">{format(d, "EEEE, d 'de' MMMM", { locale: ptBR })}</DialogTitle></DialogHeader>
              <p className="text-[12px] font-body text-muted-foreground -mt-2">{items.length} post(s) · toque pra editar</p>
              <div className="space-y-1.5 mt-1">
                {items.map(({ kind, post: p }) => (
                  <button key={`${kind}-${p.id}`} onClick={() => { setDayModal(null); setEditPost(p); }}
                    className={`w-full flex items-center gap-2.5 rounded-xl border p-3 text-left hover:border-primary/50 hover:bg-primary/5 transition-colors ${kind === "entrega" ? "border-dashed border-violet-300 bg-violet-50/50" : "border-border"}`}>
                    <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: colorOf[p.external_client_id] ?? "#EA4918" }} />
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] font-body font-semibold text-foreground truncate">
                        {kind === "entrega" ? `Entrega de ${p.assignee_id ? (nomeParceiro[p.assignee_id] ?? "parceiro").split(" ")[0] : "parceiro"}: ` : ""}{p.title}
                      </p>
                      <p className="text-[11px] font-body text-muted-foreground truncate">{nameOf[p.external_client_id] ?? ""}{kind === "postagem" && p.scheduled_time ? ` · ${p.scheduled_time.slice(0, 5)}` : ""}</p>
                    </div>
                  </button>
                ))}
              </div>
            </DialogContent>
          </Dialog>
        );
      })()}

      {/* Popup editável do post, sem sair pro cliente: título, data, horário, status e legenda. */}
      <PostEditPopup
        post={editPost}
        clientName={editPost ? (nameOf[editPost.external_client_id] ?? null) : null}
        saving={savePost.isPending}
        onClose={() => setEditPost(null)}
        onSave={(patch) => { if (editPost) savePost.mutate({ id: editPost.id, patch }); }}
      />
    </div>
  );
}

// Edição rápida do post pelo calendário geral do gestor. Cobre o essencial (título,
// data, horário, status, legenda); mídia/roteiro cheios ficam dentro do cliente.
function PostEditPopup({ post, clientName, onClose, onSave, saving }: {
  post: CalPost | null;
  clientName: string | null;
  onClose: () => void;
  onSave: (patch: Record<string, unknown>) => void;
  saving: boolean;
}) {
  const open = !!post;
  const [title, setTitle] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [caption, setCaption] = useState("");
  const [status, setStatus] = useState("em_producao");
  const [seeded, setSeeded] = useState("");
  // Semeia os campos ao abrir um post novo (sem useEffect: roda no render quando o id muda).
  if (open && post && seeded !== post.id) {
    setSeeded(post.id);
    setTitle(post.title ?? "");
    setDate(post.scheduled_date ?? "");
    setTime(post.scheduled_time?.slice(0, 5) ?? "");
    setCaption(post.caption ?? "");
    setStatus(post.approval_status ?? "em_producao");
  }
  if (!open && seeded) setSeeded("");

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="sm:max-w-lg rounded-2xl">
        <DialogHeader><DialogTitle className="font-display">Editar post{clientName ? ` · ${clientName}` : ""}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <Label className="text-[11px] font-body font-semibold text-muted-foreground uppercase">Título</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} className="rounded-xl mt-1" />
          </div>
          <div className="flex gap-2">
            <div className="flex-1">
              <Label className="text-[11px] font-body font-semibold text-muted-foreground uppercase">Data</Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="rounded-xl mt-1" />
            </div>
            <div className="w-28">
              <Label className="text-[11px] font-body font-semibold text-muted-foreground uppercase">Horário</Label>
              <Input type="time" value={time} onChange={(e) => setTime(e.target.value)} className="rounded-xl mt-1" />
            </div>
          </div>
          <div>
            <Label className="text-[11px] font-body font-semibold text-muted-foreground uppercase">Status</Label>
            <select value={status} onChange={(e) => setStatus(e.target.value)} className="w-full h-10 rounded-xl border border-border bg-card px-3 text-sm font-body mt-1">
              {STATUS_OPTS.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
            </select>
          </div>
          <div>
            <Label className="text-[11px] font-body font-semibold text-muted-foreground uppercase">Legenda</Label>
            <Textarea rows={4} value={caption} onChange={(e) => setCaption(e.target.value)} className="rounded-xl text-sm mt-1" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button
            onClick={() => onSave({
              title: title.trim() || "Post",
              scheduled_date: date || null,
              scheduled_time: time || null,
              caption: caption.trim() || null,
              approval_status: status,
              approval_updated_at: new Date().toISOString(),
            })}
            disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
