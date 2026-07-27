import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { DragDropContext, Droppable, Draggable, type DropResult } from "@hello-pangea/dnd";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { CalendarDays, Plus, X, Video, Loader2, Clock, MapPin, Users, ListChecks, ExternalLink, Send, Layers, Check, Copy, HardDrive, Download, Play, FileImage, Link2, Paperclip, GripVertical, FolderOpen, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import {
  useCrmClients, useCrmTasks, useUpdateCrmTask, useCreateCrmTask, useCrmLeads,
  CRM_TASK_PRIORITIES, CRM_TASK_PRIORITY_LABELS, CRM_TASK_STATUSES,
  type CrmTask, type CrmTaskPriority, type CrmTaskStatus,
} from "@/hooks/useCrm";
import {
  useCreations, useAddCreation, useUpdateCreation, useDeleteCreation,
  useCaptures, useAddCapture, useUpdateCapture, useDeleteCapture, useCollaboratorNames,
  useDayOrders, useSaveDayOrder, type Capture, type Creation,
} from "@/hooks/useAgenda";
import { useAllExternalPosts, useExternalClients, useMoveExternalPostDate, useUpdateExternalPost, type ExternalPostWithClient } from "@/hooks/useCriaPost";
import { useCriaPostMedia, type CriaMedia } from "@/hooks/useCriaPostMedia";
import { useClientCriaAgendaPosts, type ClientCriaAgendaPost, type ClientCriaLink } from "@/hooks/useManagerClientCria";
import { isDriveMedia, isDriveUrl, isVideoMedia, getThumbnailUrl, getDriveImageFallbackUrl, downloadMediaFile, mediaDownloadName } from "@/lib/driveMedia";
import { hojeBR, parseDateOnly } from "@/lib/date-br";

// Status dos posts na agenda (mesmas cores do kanban de 5 status).
const POST_STATUS: Record<string, { label: string; cls: string }> = {
  em_producao: { label: "Produção", cls: "bg-violet-100 text-violet-700" },
  pendente: { label: "Aguardando", cls: "bg-amber-100 text-amber-700" },
  ajuste_solicitado: { label: "Ajuste", cls: "bg-orange-100 text-orange-700" },
  aprovado: { label: "Aprovado", cls: "bg-green-100 text-green-700" },
  postado: { label: "Postado", cls: "bg-slate-200 text-slate-600" },
};

// Rótulos dos estados "prontos" do kanban do cliente (Tarefa B), pro pill do card.
const CRIA_POST_STATUS: Record<string, string> = { editando: "Pronto", agendado: "Agendado", publicado: "Publicado" };
// Cor identidade dos posts do Cria do cliente na agenda (verde, distinta dos demais tipos).
const CRIA_POST_COLOR = "#059669";

const WD = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
// Inverso de parseDateOnly: formata um Date de meia-noite LOCAL de volta para YYYY-MM-DD.
function ymd(d: Date) { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; }
// Semana começa no DOMINGO (padrão iPhone/BR). Nome mantido por uso interno.
function mondayOf(d: Date) { const x = new Date(d); x.setDate(x.getDate() - x.getDay()); x.setHours(0, 0, 0, 0); return x; }
const shortDate = (d: Date) => d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
// Rótulos singulares pro select de status da tarefa (os do CRM são títulos de coluna, no plural).
const TASK_STATUS_LABELS: Record<CrmTaskStatus, string> = {
  pendente: "Pendente", em_andamento: "Em andamento", concluida: "Concluída",
};
// droppableId da faixa fixa "Sem data (em produção)". Arrastar um post daqui pra um
// dia agenda (seta a data); arrastar um post de um dia pra cá tira a data (volta pra cá).
const NO_DATE = "no-date";

const STATUS: Record<Capture["status"], { label: string; cls: string }> = {
  agendada: { label: "Agendada", cls: "bg-primary/10 text-primary" },
  concluida: { label: "Concluída", cls: "bg-secondary/15 text-secondary" },
  cancelada: { label: "Cancelada", cls: "bg-destructive/10 text-destructive" },
};

// Cor padrão da tarefa de cliente quando o cliente não tem cor definida no cadastro.
const TASK_CLIENT_DEFAULT_COLOR = "#01A652"; // verde
// HH:MM a partir de "HH:MM:SS" (ou null).
const hhmm = (s: string | null | undefined) => (s ? s.slice(0, 5) : null);

// Item unificado do dia, pra ordenar TODOS os tipos juntos por horário e manter os
// index do @hello-pangea/dnd contíguos com a ordem renderizada.
type DayItem =
  | { kind: "cap"; time: string | null; cap: Capture }
  | { kind: "task"; time: string | null; task: CrmTask }
  | { kind: "cria"; time: string | null; cria: Creation }
  | { kind: "post"; time: string | null; post: ExternalPostWithClient };

// Chave estável de um item do dia (mesma string do draggableId): "<kind>:<id>". É por ela
// que a ordem manual do dia é persistida e reaplicada (ver buildDayItems + handleDragEnd).
function dayItemKey(item: DayItem): string {
  switch (item.kind) {
    case "cap": return `cap:${item.cap.id}`;
    case "task": return `task:${item.task.id}`;
    case "cria": return `cria:${item.cria.id}`;
    case "post": return `post:${item.post.id}`;
  }
}

// Monta a lista do dia ordenada. Quando há ORDEM MANUAL persistida pro dia (order = array
// de chaves "<kind>:<id>"), ela SOBREPÕE a ordem por horário: os itens presentes na ordem
// vêm primeiro na posição salva; itens novos (ainda sem posição) caem no fim, aí sim por
// horário. Sem ordem manual, mantém o comportamento antigo: itens SEM horário primeiro
// (topo), depois os COM horário em ordem crescente. Fontes de hora: captação=capture_time,
// post=scheduled_time, tarefa=due_time, criação=sem horário.
function buildDayItems(caps: Capture[], tasks: CrmTask[], cris: Creation[], posts: ExternalPostWithClient[], order?: string[]): DayItem[] {
  const items: DayItem[] = [
    ...caps.map((c) => ({ kind: "cap" as const, time: hhmm(c.capture_time), cap: c })),
    ...tasks.map((t) => ({ kind: "task" as const, time: hhmm(t.due_time), task: t })),
    ...cris.map((c) => ({ kind: "cria" as const, time: null, cria: c })),
    ...posts.map((p) => ({ kind: "post" as const, time: hhmm((p as { scheduled_time?: string | null }).scheduled_time), post: p })),
  ];
  if (order && order.length) {
    const idx = new Map(order.map((k, i) => [k, i]));
    // Posição manual manda; empate (item novo sem posição) cai pro horário.
    items.sort((a, b) => {
      const ai = idx.get(dayItemKey(a)) ?? Infinity;
      const bi = idx.get(dayItemKey(b)) ?? Infinity;
      if (ai !== bi) return ai - bi;
      return (a.time ?? "").localeCompare(b.time ?? "");
    });
    return items;
  }
  // "" (sem hora) ordena antes de qualquer "HH:MM"; timed em ordem crescente.
  items.sort((a, b) => (a.time ?? "").localeCompare(b.time ?? ""));
  return items;
}

// CAUSA RAIZ do "não arrasta no celular" (e o punho tampouco resolvia):
// o @hello-pangea/dnd ABORTA o início do drag quando o elemento DRAGGABLE (o nó com
// draggableProps) é interativo. A checagem interna isEventInInteractiveElement caminha
// do alvo tocado ATÉ o nó draggable; se achar uma tag interativa no caminho, cancela o
// drag (tryStart retorna null, nenhum lock é criado). Como os cards da agenda eram
// <button>, a checagem SEMPRE achava o próprio <button> e matava o arraste, no toque e
// no mouse. O touch-action era pista falsa: o gesto nem chegava a começar.
//
// Correção robusta (vale mês e semana):
//  1) disableInteractiveElementBlocking em cada <Draggable> desliga essa checagem.
//  2) dragHandleProps vai no CARD INTEIRO (não num punho minúsculo): no celular não há
//     hover pra revelar o punho, então o alvo de arraste passa a ser o card todo.
//  3) touch-action:none no card (dragTouchStyle + a regra global do index.css que casa
//     [data-rfd-drag-handle-draggable-id], atributo que o dragHandleProps injeta no card)
//     garante que o long-press de 120ms do dnd não seja roubado pelo scroll horizontal
//     da semana nem pela rolagem vertical da página.
// O grip vira só pista visual (decorativo); quem arrasta é o card inteiro.
const dragTouchStyle: CSSProperties = { touchAction: "none", WebkitUserSelect: "none", userSelect: "none", WebkitTouchCallout: "none" };
function DragGrip({ className }: { className?: string }) {
  return (
    <span aria-hidden="true"
      className={cn("shrink-0 grid place-items-center h-5 w-4 -ml-0.5 rounded text-muted-foreground/50", className)}>
      <GripVertical className="h-3.5 w-3.5" />
    </span>
  );
}

export default function AgendaCriacao() {
  const navigate = useNavigate();
  const [weekStart, setWeekStart] = useState(() => mondayOf(parseDateOnly(hojeBR())));
  // Visão: semana (padrão) ou mês. O mês usa a MESMA grade arrastável.
  const [view, setView] = useState<"semana" | "mes">(() => {
    try { return (localStorage.getItem("agenda_view") as "semana" | "mes") || "semana"; } catch { return "semana"; }
  });
  const setViewPersist = (v: "semana" | "mes") => {
    setView(v);
    try { localStorage.setItem("agenda_view", v); } catch { /* segue */ }
  };
  // Filtros por tipo de item na grade (criação, tarefa, captação, post, cria do cliente), persistidos.
  const [filters, setFilters] = useState<{ criacao: boolean; tarefa: boolean; capta: boolean; post: boolean; criapost: boolean }>(() => {
    try {
      const s = JSON.parse(localStorage.getItem("agenda_filters") || "{}");
      return { criacao: s.criacao ?? true, tarefa: s.tarefa ?? true, capta: s.capta ?? true, post: s.post ?? true, criapost: s.criapost ?? true };
    } catch { return { criacao: true, tarefa: true, capta: true, post: true, criapost: true }; }
  });
  const toggleFilter = (k: "criacao" | "tarefa" | "capta" | "post" | "criapost") =>
    setFilters((f) => { const nf = { ...f, [k]: !f[k] }; try { localStorage.setItem("agenda_filters", JSON.stringify(nf)); } catch { /* segue */ } return nf; });
  // Multi-seleção de clientes para os posts (vazio = todos).
  const [postClients, setPostClients] = useState<Set<string>>(new Set());
  const togglePostClient = (id: string | null) => setPostClients((prev) => {
    if (id === null) return new Set();
    const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n;
  });
  // Faixa "Posts de:" (chips de cliente) minimizável, persistida. Com muitos
  // clientes ela ocupa a tela toda, então dá pra recolher.
  const [postChipsOpen, setPostChipsOpen] = useState<boolean>(() => {
    try { const v = localStorage.getItem("agenda_postchips_open"); return v === null ? false : v === "1"; } catch { return false; }
  });
  const togglePostChips = () => setPostChipsOpen((v) => { const n = !v; try { localStorage.setItem("agenda_postchips_open", n ? "1" : "0"); } catch { /* segue */ } return n; });
  // Faixa "Em produção" (Tarefa 1): recolhível, começa RECOLHIDA por padrão ("0"), pra não
  // dominar o topo. Estado aberto/recolhido persistido em localStorage.
  const [producaoOpen, setProducaoOpen] = useState<boolean>(() => {
    try { const v = localStorage.getItem("agenda_producao_open"); return v === null ? false : v === "1"; } catch { return false; }
  });
  const toggleProducao = () => setProducaoOpen((v) => { const n = !v; try { localStorage.setItem("agenda_producao_open", n ? "1" : "0"); } catch { /* segue */ } return n; });
  // Painel "ver todos" de um dia cheio.
  const [dayModal, setDayModal] = useState<string | null>(null);
  // Semana = 7 dias a partir da segunda. Mês = grade completa (segunda a domingo) cobrindo o mês do anchor.
  const days = useMemo(() => {
    if (view === "semana") {
      return Array.from({ length: 7 }, (_, i) => { const d = new Date(weekStart); d.setDate(d.getDate() + i); return d; });
    }
    const first = new Date(weekStart.getFullYear(), weekStart.getMonth(), 1);
    const gridStart = mondayOf(first);
    const last = new Date(weekStart.getFullYear(), weekStart.getMonth() + 1, 0);
    const gridEnd = mondayOf(last); gridEnd.setDate(gridEnd.getDate() + 6);
    const n = Math.round((gridEnd.getTime() - gridStart.getTime()) / 86400000) + 1;
    return Array.from({ length: n }, (_, i) => { const d = new Date(gridStart); d.setDate(d.getDate() + i); return d; });
  }, [weekStart, view]);
  // A grade usa layout de GRADE (não o scroll horizontal da semana) no mês.
  const gridLayout = view === "mes";
  const from = ymd(days[0]); const to = ymd(days[days.length - 1]);
  const today = hojeBR();
  const curMonth = weekStart.getMonth();

  const { data: clients = [] } = useCrmClients();
  const { data: leads = [] } = useCrmLeads();
  const createTask = useCreateCrmTask();
  const { data: teamNames = [] } = useCollaboratorNames();
  const { data: creations = [] } = useCreations(from, to);
  const addCreation = useAddCreation();
  const delCreation = useDeleteCreation();
  const { data: captures = [] } = useCaptures();
  const { data: crmTasks = [] } = useCrmTasks();
  const addCapture = useAddCapture();
  const updCapture = useUpdateCapture();
  const delCapture = useDeleteCapture();
  const updCreation = useUpdateCreation();
  const updTask = useUpdateCrmTask();
  const { data: allPosts = [] } = useAllExternalPosts();
  const { clients: extClients } = useExternalClients();
  const movePost = useMoveExternalPostDate();
  const qc = useQueryClient();
  // Ordem manual por dia (reordenar dentro do dia): mapa day -> array de chaves "<kind>:<id>".
  const { data: dayOrders = {} } = useDayOrders(from, to);
  const saveDayOrder = useSaveDayOrder();

  // external_client_id -> dados do cliente (nome, cor, crm_client_id pra abrir a ficha).
  const extById = useMemo(() => {
    const m = new Map<string, { name: string; color: string | null; crm_client_id: string | null }>();
    extClients.forEach((e) => m.set(e.id, { name: e.name, color: e.color ?? null, crm_client_id: e.crm_client_id ?? null }));
    return m;
  }, [extClients]);

  // Filtro de cliente vale pra TODOS os tipos da agenda. Só os posts guardam
  // external_client_id; tarefas/captações/criações guardam crm_client_id (e às vezes
  // nome livre). Então, dos externos selecionados, derivamos os crm_client_id e os nomes
  // correspondentes pra casar com os demais tipos.
  const selectedCrmIds = useMemo(() => {
    const s = new Set<string>();
    for (const id of postClients) { const crm = extById.get(id)?.crm_client_id; if (crm) s.add(crm); }
    return s;
  }, [postClients, extById]);
  const selectedNames = useMemo(() => {
    const s = new Set<string>();
    for (const id of postClients) { const nm = extById.get(id)?.name; if (nm) s.add(nm.trim().toLowerCase()); }
    return s;
  }, [postClients, extById]);
  // Casa um item (por crm_client_id e/ou nome livre) com os clientes selecionados.
  // Sem seleção = passa tudo. Com seleção, item sem cliente correspondente some.
  const clientMatches = (crmId: string | null | undefined, name: string | null | undefined) => {
    if (postClients.size === 0) return true;
    if (crmId && selectedCrmIds.has(crmId)) return true;
    if (name && selectedNames.has(name.trim().toLowerCase())) return true;
    return false;
  };

  const [addDay, setAddDay] = useState<string | null>(null);
  const [addKind, setAddKind] = useState<"criacao" | "tarefa" | "captacao">("criacao");
  const [capOpen, setCapOpen] = useState(false);
  const [editCap, setEditCap] = useState<Capture | null>(null);
  const [editTask, setEditTask] = useState<CrmTask | null>(null);
  const [editCreation, setEditCreation] = useState<Creation | null>(null);
  const [editPost, setEditPost] = useState<ExternalPostWithClient | null>(null);
  const updateExtPost = useUpdateExternalPost();

  // Arrastar item pra outro dia: atualização otimista no cache + persistência conforme o tipo.
  const handleDragEnd = (result: DropResult) => {
    const { source, destination, draggableId } = result;
    if (!destination) return;
    // REORDENAR dentro do MESMO dia: antes o drop caía aqui e retornava sem fazer nada, e
    // como a lista é ordenada por horário o card "voltava" pro lugar. Agora gravamos uma
    // ORDEM MANUAL persistida por dia (agenda_day_order) que sobrepõe a ordem por horário.
    if (destination.droppableId === source.droppableId) {
      // A faixa "Sem data (em produção)" só agrupa; não tem ordenação manual.
      if (source.droppableId === NO_DATE) return;
      if (destination.index === source.index) return;
      const iso = source.droppableId;
      // Recalcula a MESMA lista renderizada do dia (com a ordem atual aplicada) e move a chave.
      const keys = buildDayItems(
        capturesByDay.get(iso) ?? [], tasksByDay.get(iso) ?? [], byDay.get(iso) ?? [], postsByDay.get(iso) ?? [],
        dayOrders[iso],
      ).map(dayItemKey);
      if (source.index >= keys.length) return;
      const [moved] = keys.splice(source.index, 1);
      keys.splice(destination.index, 0, moved);
      // Otimista: grava a nova ordem no cache já pra o card ficar onde foi solto.
      qc.setQueriesData<Record<string, string[]>>({ queryKey: ["agenda-day-order"] }, (old) => ({ ...(old ?? {}), [iso]: keys }));
      saveDayOrder.mutate({ day: iso, order: keys });
      return;
    }
    const day = destination.droppableId; // droppableId = YYYY-MM-DD do dia (ou NO_DATE)
    const sep = draggableId.indexOf(":");
    const kind = draggableId.slice(0, sep);
    const id = draggableId.slice(sep + 1);
    // Soltar na faixa "Sem data": só faz sentido pra POST (tira a data). Os outros tipos
    // exigem data, então ignoramos o drop aqui em vez de gravar uma data inválida.
    if (day === NO_DATE) {
      if (kind !== "post") return;
      qc.setQueriesData<ExternalPostWithClient[]>({ queryKey: ["external-posts-all"] }, (old) => old?.map((p) => (p.id === id ? { ...p, scheduled_date: null } : p)));
      movePost.mutate({ id, scheduled_date: null }, { onSuccess: () => toast.success("Post voltou para Sem data"), onError: () => toast.error("Não consegui mover. Tente de novo.") });
      return;
    }
    const dest = parseDateOnly(day);
    const ok = () => toast.success(`Movido para ${WD[dest.getDay()].toUpperCase()} ${dest.getDate()}`);
    const fail = () => toast.error("Não consegui mover. Tente de novo.");
    if (kind === "cap") {
      qc.setQueriesData<Capture[]>({ queryKey: ["agenda-captures"] }, (old) => old?.map((c) => (c.id === id ? { ...c, capture_date: day } : c)));
      updCapture.mutate({ id, patch: { capture_date: day } }, { onSuccess: ok, onError: fail, onSettled: () => qc.invalidateQueries({ queryKey: ["agenda-captures"] }) });
    } else if (kind === "task") {
      qc.setQueriesData<CrmTask[]>({ queryKey: ["crm-tasks"] }, (old) => old?.map((t) => (t.id === id ? { ...t, due_date: day } : t)));
      // O hook useUpdateCrmTask já mostra toast de erro; aqui só o sucesso e o invalidate.
      updTask.mutate({ id, due_date: day }, { onSuccess: ok, onSettled: () => qc.invalidateQueries({ queryKey: ["crm-tasks"] }) });
    } else if (kind === "cria") {
      qc.setQueriesData<Creation[]>({ queryKey: ["agenda-creations"] }, (old) => old?.map((c) => (c.id === id ? { ...c, day } : c)));
      updCreation.mutate({ id, patch: { day } }, { onSuccess: ok, onError: fail, onSettled: () => qc.invalidateQueries({ queryKey: ["agenda-creations"] }) });
    } else if (kind === "post") {
      // Arrastar um post reprograma a data no Cria Post (reflete no kanban/calendário do cliente).
      qc.setQueriesData<ExternalPostWithClient[]>({ queryKey: ["external-posts-all"] }, (old) => old?.map((p) => (p.id === id ? { ...p, scheduled_date: day } : p)));
      movePost.mutate({ id, scheduled_date: day }, { onSuccess: ok, onError: fail });
    }
  };
  // Clicar num post abre o popup editável AQUI na agenda (sem navegar pro cliente).
  const openPost = (p: ExternalPostWithClient) => setEditPost(p);

  const byDay = useMemo(() => {
    const m = new Map<string, typeof creations>();
    if (!filters.criacao) return m;
    for (const c of creations) {
      if (!clientMatches(c.crm_client_id, c.client_name)) continue;
      (m.get(c.day) ?? m.set(c.day, []).get(c.day)!).push(c);
    }
    return m;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [creations, filters.criacao, postClients, selectedCrmIds, selectedNames]);

  // Posts (Cria Post) com data no período, por dia. Multi-cliente aplicado aqui.
  const postsByDay = useMemo(() => {
    const m = new Map<string, ExternalPostWithClient[]>();
    if (!filters.post) return m;
    for (const p of allPosts) {
      if (!p.scheduled_date || p.scheduled_date < from || p.scheduled_date > to) continue;
      // DECISÃO: posts "Em produção" NÃO aparecem nas células de dia; ficam só na faixa
      // do topo (approval_status nulo conta como em_producao, o padrão da criação).
      if ((p.approval_status ?? "em_producao") === "em_producao") continue;
      if (postClients.size > 0 && !postClients.has(p.external_client_id)) continue;
      (m.get(p.scheduled_date) ?? m.set(p.scheduled_date, []).get(p.scheduled_date)!).push(p);
    }
    return m;
  }, [allPosts, from, to, filters.post, postClients]);

  // TAREFA B — Posts do Cria do CLIENTE (o kanban pessoal dele), já "prontos" em diante
  // e com data. A social mídia vê pra se organizar, sem precisar entrar no Cria de cada um.
  // Vínculo: só os clientes do CRM que têm conta Cria (cria_owner_id). Uma query só pra
  // todos (RLS is_account_member filtra o que o gestor pode ver).
  const criaLinks = useMemo<ClientCriaLink[]>(() =>
    clients
      .filter((c) => !!c.cria_owner_id)
      .map((c) => ({ criaOwnerId: c.cria_owner_id!, crmClientId: c.id, name: c.name, color: c.color })),
    [clients]);
  const { data: clientCriaPosts = [] } = useClientCriaAgendaPosts(criaLinks, from, to);
  // Posts do Cria do cliente por dia (aplicando o mesmo filtro de cliente da agenda).
  const criaPostsByDay = useMemo(() => {
    const m = new Map<string, ClientCriaAgendaPost[]>();
    if (!filters.criapost) return m;
    for (const p of clientCriaPosts) {
      if (!p.scheduled_date || p.scheduled_date < from || p.scheduled_date > to) continue;
      if (!clientMatches(p.crm_client_id, p.client_name)) continue;
      (m.get(p.scheduled_date) ?? m.set(p.scheduled_date, []).get(p.scheduled_date)!).push(p);
    }
    for (const arr of m.values()) arr.sort((a, b) => (a.scheduled_time ?? "99:99").localeCompare(b.scheduled_time ?? "99:99"));
    return m;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientCriaPosts, from, to, filters.criapost, postClients, selectedCrmIds, selectedNames]);

  // Faixa fixa do topo "Em produção": NUNCA some, independente do período/semana/mês.
  // Inclui TODOS os posts em produção (com OU sem data) mais qualquer post sem data
  // (qualquer status). Assim nenhum post em produção some ao sair da célula do dia, e os
  // posts sem data seguem sempre visíveis. Arrastar daqui pra um dia agenda (seta a data);
  // o arraste NÃO altera o status (post em produção arrastado continua em produção).
  const producaoPosts = useMemo(() => {
    if (!filters.post) return [] as ExternalPostWithClient[];
    return allPosts.filter((p) =>
      ((p.approval_status ?? "em_producao") === "em_producao" || !p.scheduled_date)
      && (postClients.size === 0 || postClients.has(p.external_client_id)));
  }, [allPosts, filters.post, postClients]);

  // Rolagem horizontal da semana no mobile: abre ancorado na coluna de HOJE.
  const weekScrollRef = useRef<HTMLDivElement | null>(null);
  const todayColRef = useRef<HTMLDivElement | null>(null);
  const todayVisible = days.some((d) => ymd(d) === today);
  useEffect(() => {
    if (view !== "semana") return;
    const cont = weekScrollRef.current;
    if (!cont) return;
    // No desktop a grade não rola (lg:grid), então mexer no scrollLeft é inócuo lá.
    const col = todayColRef.current;
    // Só ancora em HOJE quando a semana exibida realmente contém hoje (senão o ref
    // pode estar defasado); do contrário, volta pro começo da semana.
    if (col && todayVisible) cont.scrollTo({ left: Math.max(0, col.offsetLeft - cont.offsetLeft - 8), behavior: "auto" });
    else cont.scrollTo({ left: 0, behavior: "auto" });
    // Reexecuta ao trocar de semana/visão (ex.: botão "Hoje").
  }, [view, weekStart, todayVisible]);

  // Captações da semana exibida, indexadas por dia (YYYY-MM-DD), para aparecerem na grade.
  const capturesByDay = useMemo(() => {
    const m = new Map<string, Capture[]>();
    if (!filters.capta) return m;
    for (const c of captures) {
      if (c.status === "cancelada") continue;
      if (c.capture_date < from || c.capture_date > to) continue;
      if (!clientMatches(c.crm_client_id, c.client_name)) continue;
      (m.get(c.capture_date) ?? m.set(c.capture_date, []).get(c.capture_date)!).push(c);
    }
    for (const arr of m.values()) arr.sort((a, b) => (a.capture_time ?? "99:99").localeCompare(b.capture_time ?? "99:99"));
    return m;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [captures, from, to, filters.capta, postClients, selectedCrmIds, selectedNames]);

  const nameOf = (crmId: string | null, fallback: string | null) =>
    (crmId ? clients.find((c) => c.id === crmId)?.name : null) || fallback || "Cliente";
  const leadName = (leadId: string | null) => (leadId ? leads.find((l) => l.id === leadId)?.name ?? null : null);

  // Tarefas dos clientes (CRM) com vencimento na semana exibida, por dia.
  // Concluídas ficam de fora: a grade é sobre o que ainda precisa acontecer.
  const tasksByDay = useMemo(() => {
    const m = new Map<string, CrmTask[]>();
    if (!filters.tarefa) return m;
    const prioOrder: Record<string, number> = { urgente: 0, alta: 1, media: 2, baixa: 3 };
    for (const t of crmTasks) {
      // Concluídas continuam aparecendo (riscadas), pra a social mídia ver o que fechou no dia.
      if (!t.due_date) continue;
      if (t.due_date < from || t.due_date > to) continue;
      // Filtro de cliente: tarefa casa pelo crm_client_id. Tarefa de lead (ou sem cliente)
      // some quando há cliente(s) específico(s) selecionado(s).
      if (!clientMatches(t.crm_client_id, null)) continue;
      (m.get(t.due_date) ?? m.set(t.due_date, []).get(t.due_date)!).push(t);
    }
    for (const arr of m.values()) arr.sort((a, b) => (prioOrder[a.priority] ?? 9) - (prioOrder[b.priority] ?? 9));
    return m;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [crmTasks, from, to, filters.tarefa, postClients, selectedCrmIds, selectedNames]);

  // Próximas captações: inclui as ATRASADAS (capture_date < hoje e ainda não concluídas),
  // que antes sumiam por causa do filtro capture_date >= hoje. Atrasadas vêm PRIMEIRO
  // (ordenadas por data/hora), seguidas das futuras. Fuso BR via hojeBR() (today).
  const upcoming = useMemo(() => {
    const notCancel = captures.filter((c) => c.status !== "cancelada");
    const overdue = notCancel
      .filter((c) => c.status !== "concluida" && c.capture_date < today)
      .sort((a, b) => a.capture_date.localeCompare(b.capture_date) || (a.capture_time ?? "99:99").localeCompare(b.capture_time ?? "99:99"));
    const future = notCancel.filter((c) => c.capture_date >= today);
    return [...overdue, ...future].slice(0, 30);
  }, [captures, today]);
  // Próximas tarefas (item 3): pendentes/em andamento. Inclui as ATRASADAS (due_date < hoje
  // e não concluídas), que antes sumiam pelo filtro due_date >= hoje. Atrasadas PRIMEIRO
  // (ordem por data/hora), depois as próximas. Fuso BR via hojeBR() (today).
  const upcomingTasks = useMemo(() => {
    const pend = crmTasks.filter((t) => t.status !== "concluida" && !!t.due_date);
    const byDate = (a: CrmTask, b: CrmTask) => (a.due_date ?? "").localeCompare(b.due_date ?? "") || (a.due_time ?? "99:99").localeCompare(b.due_time ?? "99:99");
    const overdue = pend.filter((t) => t.due_date! < today).sort(byDate);
    const future = pend.filter((t) => t.due_date! >= today).sort(byDate);
    return [...overdue, ...future].slice(0, 30);
  }, [crmTasks, today]);

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} className="pb-24 md:pb-0">
      <div className="flex items-center gap-3 mb-5">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-pink-400 grid place-items-center shadow-sm shrink-0">
          <CalendarDays className="h-5 w-5 text-white" strokeWidth={1.75} />
        </div>
        <div>
          <h1 className="text-2xl sm:text-3xl font-display font-extrabold text-foreground tracking-tight">Agenda</h1>
          <p className="text-muted-foreground font-body text-sm mt-0.5">Criação semanal e agenda de captações.</p>
        </div>
      </div>

      {/* Agenda de criação */}
      <div data-tour="ag-quadro" className="rounded-2xl border border-border bg-card p-4">
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <div className="flex items-center gap-3 flex-wrap">
            <p className="text-sm font-display font-bold text-foreground">Agenda de criação</p>
            <div className="flex items-center gap-1.5 flex-wrap">
              {([["criacao", "Criações", "#4B3FA8"], ["tarefa", "Tarefas", "#0061EE"], ["capta", "Captações", "#FF77B9"], ["post", "Posts", "#EA4918"], ["criapost", "Cria do cliente", CRIA_POST_COLOR]] as const).map(([k, label, color]) => (
                <button key={k} type="button" onClick={() => toggleFilter(k)}
                  className={cn("flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-body font-semibold transition-colors",
                    filters[k] ? "text-white border-transparent" : "bg-card border-border text-muted-foreground hover:text-foreground")}
                  style={filters[k] ? { background: color } : undefined}>
                  <span className="h-2 w-2 rounded-full" style={{ background: filters[k] ? "#fff" : color }} />{label}
                </button>
              ))}
            </div>
          </div>
          <div data-tour="ag-navegacao" className="flex items-center gap-2 flex-wrap">
            {/* Semana (padrão) / Mês */}
            <div className="inline-flex rounded-lg border border-border overflow-hidden">
              {(["semana", "mes"] as const).map((v) => (
                <button key={v} onClick={() => setViewPersist(v)}
                  className={cn("px-2.5 py-1 text-xs font-body font-semibold transition-colors",
                    view === v ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")}>
                  {v === "semana" ? "Semana" : "Mês"}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-1">
              <Button variant="outline" size="sm" className="h-8 w-8 p-0"
                onClick={() => setWeekStart((w) => { const n = new Date(w); view === "mes" ? n.setMonth(n.getMonth() - 1) : n.setDate(n.getDate() - 7); return n; })}>‹</Button>
              <span className="text-xs font-body text-muted-foreground px-1">
                {view === "mes"
                  ? weekStart.toLocaleDateString("pt-BR", { month: "long", year: "numeric" })
                  : `${shortDate(days[0])}, ${shortDate(days[6])}`}
              </span>
              <Button variant="outline" size="sm" className="h-8 px-2 text-xs" onClick={() => setWeekStart(mondayOf(parseDateOnly(hojeBR())))}>Hoje</Button>
              <Button variant="outline" size="sm" className="h-8 w-8 p-0"
                onClick={() => setWeekStart((w) => { const n = new Date(w); view === "mes" ? n.setMonth(n.getMonth() + 1) : n.setDate(n.getDate() + 7); return n; })}>›</Button>
            </div>
          </div>
        </div>
        {extClients.length > 0 && (
          <div className="mb-3 rounded-xl border border-dashed border-border bg-background/60 px-3 py-2">
            <button type="button" onClick={togglePostChips} className="flex items-center gap-2 w-full text-left">
              <span className="inline-flex items-center gap-1 text-[10px] font-body font-bold uppercase tracking-wider text-muted-foreground"><Users className="h-3.5 w-3.5" /> Filtrar por cliente</span>
              <span className="text-[10px] font-body font-semibold text-muted-foreground">
                {postClients.size === 0 ? `Todos (${extClients.length})` : `${postClients.size} selecionado(s)`}
              </span>
              <span className={cn("ml-auto text-muted-foreground transition-transform", postChipsOpen && "rotate-180")}>▾</span>
            </button>
            {postChipsOpen && (
              <div className="flex items-center gap-2 flex-wrap mt-2">
                <button type="button" onClick={() => togglePostClient(null)} className={cn("inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-body font-semibold transition-colors", postClients.size === 0 ? "bg-foreground text-background border-foreground" : "bg-card border-border text-muted-foreground hover:text-foreground")}>
                  <span className={cn("grid h-3.5 w-3.5 place-items-center rounded-full", postClients.size === 0 ? "bg-background/25" : "bg-muted")}><Users className="h-2.5 w-2.5" /></span>Todos
                </button>
                {extClients.map((e) => (
                  <button key={e.id} type="button" onClick={() => togglePostClient(e.id)} className={cn("flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-body font-semibold transition-colors", postClients.has(e.id) ? "border-foreground text-foreground bg-muted/40" : "bg-card border-border text-muted-foreground hover:text-foreground")}>
                    <span className="grid h-3.5 w-3.5 place-items-center rounded-full text-white text-[7px] font-bold" style={{ background: e.color || "#EA4918" }}>{e.name.trim().charAt(0).toUpperCase()}</span>{e.name}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
        <DragDropContext onDragEnd={handleDragEnd}>
          {/* Faixa fixa "Em produção": sempre visível, independente do período. Reúne todos
              os posts em produção (com ou sem data) + posts sem data. Arrastar um post daqui
              pra um dia agenda; arrastar de volta pra cá tira a data. */}
          {filters.post && producaoPosts.length > 0 && (
            <div className="mb-3 rounded-xl border border-dashed border-orange-500/40 bg-orange-500/[0.04] transition-colors">
              {/* Cabeçalho recolhível (Tarefa 1): recolhido mostra só título + contagem + setinha. */}
              <button type="button" onClick={toggleProducao} aria-expanded={producaoOpen}
                className="flex items-center gap-1.5 w-full text-left px-2.5 py-2">
                <Layers className="h-3.5 w-3.5 text-orange-600" />
                <span className="text-[10px] font-body font-bold uppercase tracking-wider text-muted-foreground">Em produção</span>
                <span className="text-[9px] font-body text-muted-foreground/70 hidden sm:inline">(com ou sem data)</span>
                <span className="text-[10px] font-body font-semibold text-muted-foreground">{producaoPosts.length}</span>
                {producaoOpen && <span className="text-[9px] font-body text-muted-foreground/70 hidden sm:inline">arraste pra um dia pra agendar</span>}
                <ChevronDown className={cn("ml-auto h-4 w-4 shrink-0 text-muted-foreground transition-transform", producaoOpen && "rotate-180")} />
              </button>
              {producaoOpen && (
                <Droppable droppableId={NO_DATE} direction="horizontal">
                  {(dp, ds) => (
                    <div ref={dp.innerRef} {...dp.droppableProps}
                      className={cn("px-2.5 pb-2.5 rounded-b-xl transition-colors", ds.isDraggingOver && "bg-primary/5 ring-2 ring-primary/40")}>
                      <div className="flex gap-2 overflow-x-auto pb-1">
                    {producaoPosts.map((p, idx) => {
                      const cli = extById.get(p.external_client_id);
                      const st = POST_STATUS[p.approval_status ?? "em_producao"];
                      return (
                        <Draggable key={`post:${p.id}`} draggableId={`post:${p.id}`} index={idx} disableInteractiveElementBlocking>
                          {(dragProvided, dragSnapshot) => (
                            <button ref={dragProvided.innerRef} {...dragProvided.draggableProps} {...dragProvided.dragHandleProps}
                              type="button" title={p.title ?? undefined} onClick={() => openPost(p)}
                              style={{ ...dragProvided.draggableProps.style, ...dragTouchStyle }}
                              className={cn("rounded-lg border border-orange-500/40 bg-card hover:bg-orange-500/10 px-2 py-1.5 text-left transition-colors w-[180px] shrink-0 overflow-hidden cursor-grab active:cursor-grabbing",
                                dragSnapshot.isDragging && "shadow-lg ring-2 ring-primary/40")}>
                              <div className="flex items-center gap-1 text-orange-700 dark:text-orange-300">
                                <DragGrip className="text-orange-700/40 dark:text-orange-300/40" />
                                <Send className="h-3 w-3 shrink-0" />
                                <span className="text-[10px] font-body font-bold truncate flex-1">{cli?.name ?? "Post"}</span>
                                {p.drive_folder_url && <FolderOpen className="h-3 w-3 shrink-0 text-primary opacity-80" aria-label="Tem pasta no Drive" />}
                                {st && <span className={cn("shrink-0 text-[8.5px] font-bold px-1.5 py-0.5 rounded-full", st.cls)}>{st.label}</span>}
                              </div>
                              <p className="text-[12px] font-body font-semibold leading-tight truncate text-foreground">{p.title || "Post"}</p>
                            </button>
                          )}
                        </Draggable>
                      );
                    })}
                    {dp.placeholder}
                      </div>
                    </div>
                  )}
                </Droppable>
              )}
            </div>
          )}
          {view === "mes" && (
            <div className="hidden lg:grid lg:grid-cols-7 gap-2 mb-1">
              {WD.map((w) => <p key={w} className="text-[10px] uppercase tracking-wider font-body font-semibold text-muted-foreground text-center">{w}</p>)}
            </div>
          )}
          <div ref={weekScrollRef} className={cn(
            gridLayout
              ? "grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2"
              // Mobile: colunas espaçosas (~85vw, uma por vez com peek da próxima) e
              // scroll-snap suave; no lg vira grade de 7 sem scroll.
              : "flex gap-3 overflow-x-auto pb-2 snap-x snap-mandatory scroll-smooth lg:grid lg:grid-cols-7 lg:gap-2 lg:overflow-visible lg:pb-0",
          )}>
            {days.map((d, i) => {
              const iso = ymd(d); const list = byDay.get(iso) ?? []; const caps = capturesByDay.get(iso) ?? []; const dayTasks = tasksByDay.get(iso) ?? []; const dayPosts = postsByDay.get(iso) ?? []; const criaDay = criaPostsByDay.get(iso) ?? []; const totalDay = caps.length + dayTasks.length + list.length + dayPosts.length + criaDay.length; const isToday = iso === today;
              // Lista única do dia, ordenada por horário (sem hora primeiro). Os index dos
              // Draggable saem daqui (0..n-1 contíguos), casando com a ordem renderizada pro dnd.
              const dayItems = buildDayItems(caps, dayTasks, list, dayPosts, dayOrders[iso]);
              const outOfMonth = view === "mes" && d.getMonth() !== curMonth;
              // No mês mostramos o dia da semana real do dia (WD[getDay]); na semana idem.
              const showWeekday = view === "semana";
              return (
                <Droppable droppableId={iso} key={iso}>
                  {(dropProvided, dropSnapshot) => (
                    <div ref={(el) => { dropProvided.innerRef(el); if (view === "semana" && isToday) todayColRef.current = el; }} {...dropProvided.droppableProps}
                      className={cn("rounded-xl border p-2.5 flex flex-col gap-1.5 transition-shadow",
                        gridLayout ? "min-h-[110px]" : "w-[85vw] max-w-[380px] shrink-0 snap-start lg:w-auto lg:max-w-none lg:snap-align-none min-h-[240px] lg:min-h-[280px]",
                        isToday ? "border-primary bg-primary/5 ring-1 ring-primary/20" : "border-border bg-background",
                        outOfMonth && "opacity-45",
                        dropSnapshot.isDraggingOver && "ring-2 ring-primary/40 border-primary/60 bg-primary/5")}>
                      <div className="flex items-center justify-between px-0.5">
                        <div>
                          {showWeekday && <span className={cn("text-[11px] uppercase tracking-wider font-body font-semibold", isToday ? "text-primary" : "text-muted-foreground")}>{WD[d.getDay()]}</span>}{" "}
                          <span className={cn("text-base font-display font-bold", isToday ? "text-primary" : "text-foreground")}>{d.getDate()}</span>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          {totalDay > 4 && <button onClick={() => setDayModal(iso)} className="text-[10px] font-body font-bold text-primary hover:underline" aria-label="Ver todos do dia">Ver todos ({totalDay})</button>}
                          <button onClick={() => { setAddKind("criacao"); setAddDay(iso); }} className="text-muted-foreground hover:text-primary" aria-label="Adicionar"><Plus className="h-3.5 w-3.5" /></button>
                        </div>
                      </div>
                      {/* Um único map na ordem já ordenada por horário: os index viram 0..n-1
                          contíguos (bate com a ordem renderizada, o dnd não quebra). */}
                      {dayItems.map((item, idx) => {
                        if (item.kind === "cap") {
                          const c = item.cap;
                          return (
                            <Draggable key={`cap:${c.id}`} draggableId={`cap:${c.id}`} index={idx} disableInteractiveElementBlocking>
                              {(dragProvided, dragSnapshot) => (
                                <button ref={dragProvided.innerRef} {...dragProvided.draggableProps} {...dragProvided.dragHandleProps}
                                  type="button" title={c.location ?? undefined}
                                  onClick={() => setEditCap(c)}
                                  style={{ ...dragProvided.draggableProps.style, ...dragTouchStyle }}
                                  className={cn("rounded-lg border px-2 py-1.5 text-left transition-colors cursor-grab active:cursor-grabbing",
                                    c.status === "concluida" ? "border-teal-500/25 bg-teal-500/5 opacity-70" : "border-teal-500/40 bg-teal-500/10 hover:bg-teal-500/15",
                                    dragSnapshot.isDragging && "shadow-lg ring-2 ring-primary/40")}>
                                  <div className="flex items-center gap-1 text-teal-700 dark:text-teal-300">
                                    <DragGrip className="text-teal-700/40 dark:text-teal-300/40" />
                                    <Video className="h-3 w-3 shrink-0" />
                                    <span className="text-[10px] font-body font-bold flex-1">{c.capture_time ? c.capture_time.slice(0, 5) : ""}</span>
                                    {/* Etiqueta fixa "Captação": mesmo padrão de pill das etiquetas de status dos posts (posição à direita/estilo). */}
                                    <span className="shrink-0 text-[8.5px] font-bold px-1.5 py-0.5 rounded-full bg-teal-500/15 text-teal-700 dark:text-teal-300">Captação</span>
                                  </div>
                                  <p className="text-[12px] font-body font-semibold text-foreground leading-tight truncate">{nameOf(c.crm_client_id, c.client_name)}</p>
                                </button>
                              )}
                            </Draggable>
                          );
                        }
                        if (item.kind === "task") {
                          const t = item.task;
                          // Tarefa de LEAD é azul. Tarefa de CLIENTE usa a COR DO CLIENTE (cadastro); sem cor -> verde.
                          const isLead = !!t.crm_lead_id;
                          const client = t.crm_client_id ? clients.find((c) => c.id === t.crm_client_id) : null;
                          const clientColor = client?.color || TASK_CLIENT_DEFAULT_COLOR;
                          const who = isLead ? (leadName(t.crm_lead_id) ?? "Lead") : nameOf(t.crm_client_id, null);
                          return (
                            <Draggable key={`task:${t.id}`} draggableId={`task:${t.id}`} index={idx} disableInteractiveElementBlocking>
                              {(dragProvided, dragSnapshot) => {
                                const done = t.status === "concluida";
                                return (
                                  <button ref={dragProvided.innerRef} {...dragProvided.draggableProps} {...dragProvided.dragHandleProps}
                                    type="button" title={t.description ?? undefined}
                                    onClick={() => setEditTask(t)}
                                    className={cn("rounded-lg border px-2 py-1.5 text-left transition-colors cursor-grab active:cursor-grabbing",
                                      isLead ? "border-sky-500/45 bg-sky-500/10 hover:bg-sky-500/15" : "hover:brightness-95",
                                      done && "opacity-60",
                                      dragSnapshot.isDragging && "shadow-lg ring-2 ring-primary/40")}
                                    // Cliente: acento na cor do cliente (borda esquerda + fundo bem suave). Texto fica no foreground pra não perder contraste.
                                    // Merge com draggableProps.style: sem isso o style explícito venceria o do spread e o transform do drag sumiria.
                                    style={{ ...dragProvided.draggableProps.style, ...(!isLead ? { borderColor: `${clientColor}59`, borderLeftColor: clientColor, borderLeftWidth: 3, background: `${clientColor}12` } : {}), ...dragTouchStyle }}>
                                    <div className={cn("flex items-center gap-1", isLead && "text-sky-700 dark:text-sky-300")}>
                                      <DragGrip />
                                      {isLead
                                        ? <ListChecks className="h-3 w-3 shrink-0" />
                                        : <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: clientColor }} />}
                                      <span className={cn("text-[10px] font-body font-bold truncate flex-1", !isLead && "text-foreground")}>
                                        {item.time && <span className="tabular-nums">{item.time} · </span>}
                                        {isLead ? `Lead · ${who}` : who}
                                      </span>
                                      {/* Check pra marcar concluída (risca a tarefa). Span pra não aninhar button.
                                          No mobile o alvo de toque é ampliado com padding + margem negativa (~40px),
                                          sem mudar o tamanho visível do box nem empurrar o layout do card. */}
                                      <span role="button" tabIndex={0} aria-label={done ? "Reabrir tarefa" : "Concluir tarefa"}
                                        onClick={(e) => { e.stopPropagation(); updTask.mutate({ id: t.id, status: done ? "pendente" : "concluida" }); }}
                                        className="grid shrink-0 place-items-center cursor-pointer p-2 -m-2 md:p-0 md:m-0">
                                        <span className={cn("grid h-6 w-6 md:h-4 md:w-4 place-items-center rounded border transition-colors",
                                          done ? "bg-emerald-500 border-emerald-500 text-white" : "border-current/50 hover:border-emerald-500 hover:text-emerald-600")}>
                                          {done && <Check className="h-3 w-3" strokeWidth={3} />}
                                        </span>
                                      </span>
                                    </div>
                                    <p className={cn("text-[12px] font-body font-semibold leading-tight truncate", done ? "line-through text-muted-foreground" : "text-foreground")}>{t.title}</p>
                                  </button>
                                );
                              }}
                            </Draggable>
                          );
                        }
                        if (item.kind === "cria") {
                          const c = item.cria;
                          return (
                            <Draggable key={`cria:${c.id}`} draggableId={`cria:${c.id}`} index={idx} disableInteractiveElementBlocking>
                              {(dragProvided, dragSnapshot) => (
                                <div ref={dragProvided.innerRef} {...dragProvided.draggableProps} {...dragProvided.dragHandleProps}
                                  role="button" tabIndex={0}
                                  onClick={() => setEditCreation(c)}
                                  onKeyDown={(e) => { if (e.key === "Enter") setEditCreation(c); }}
                                  style={{ ...dragProvided.draggableProps.style, ...dragTouchStyle }}
                                  className={cn("group rounded-lg border border-border bg-card px-2 py-1.5 cursor-grab active:cursor-grabbing hover:bg-muted/40 transition-colors",
                                    dragSnapshot.isDragging && "shadow-lg ring-2 ring-primary/40")}>
                                  <div className="flex items-start gap-1">
                                    <DragGrip className="mt-px" />
                                    <p className="text-[12px] font-body font-semibold text-foreground leading-tight flex-1 min-w-0 truncate">{nameOf(c.crm_client_id, c.client_name)}</p>
                                    <button onClick={(e) => { e.stopPropagation(); delCreation.mutate(c.id); }} className="text-muted-foreground/50 hover:text-destructive shrink-0" aria-label="Remover"><X className="h-3 w-3" /></button>
                                  </div>
                                  {c.team && <p className="text-[10px] font-body text-muted-foreground truncate">{c.team}</p>}
                                </div>
                              )}
                            </Draggable>
                          );
                        }
                        // post
                        const p = item.post;
                        const cli = extById.get(p.external_client_id);
                        const posted = p.approval_status === "postado";
                        const st = POST_STATUS[p.approval_status ?? "em_producao"];
                        return (
                          <Draggable key={`post:${p.id}`} draggableId={`post:${p.id}`} index={idx} disableInteractiveElementBlocking>
                            {(dragProvided, dragSnapshot) => {
                              return (
                              <button ref={dragProvided.innerRef} {...dragProvided.draggableProps} {...dragProvided.dragHandleProps}
                                type="button" title={p.title ?? undefined} onClick={() => openPost(p)}
                                style={{ ...dragProvided.draggableProps.style, ...dragTouchStyle }}
                                className={cn("rounded-lg border border-orange-500/40 bg-orange-500/10 hover:bg-orange-500/15 px-2 py-1.5 text-left transition-colors w-full overflow-hidden cursor-grab active:cursor-grabbing",
                                  posted && "opacity-60",
                                  dragSnapshot.isDragging && "shadow-lg ring-2 ring-primary/40")}>
                                <div className="flex items-center gap-1 text-orange-700 dark:text-orange-300">
                                  <DragGrip className="text-orange-700/40 dark:text-orange-300/40" />
                                  <Send className="h-3 w-3 shrink-0" />
                                  <span className="text-[10px] font-body font-bold truncate flex-1">{item.time && <span className="tabular-nums">{item.time} · </span>}{cli?.name ?? "Post"}</span>
                                  {/* Indicador discreto: post tem link do Drive no campo Ideia/Referência. */}
                                  {isDriveUrl(p.reference_url) && <HardDrive className="h-3 w-3 shrink-0 opacity-70" aria-label="Tem Drive" />}
                                  {/* E indicador da PASTA do Drive (campo distinto drive_folder_url). */}
                                  {p.drive_folder_url && <FolderOpen className="h-3 w-3 shrink-0 text-primary opacity-80" aria-label="Tem pasta no Drive" />}
                                  {st && <span className={cn("shrink-0 text-[8.5px] font-bold px-1.5 py-0.5 rounded-full", st.cls)}>{st.label}</span>}
                                  {/* Check: marca o post como POSTADO (vai pra coluna Postado do kanban). */}
                                  <span role="button" tabIndex={0} aria-label={posted ? "Reabrir post" : "Marcar como postado"}
                                    onClick={(e) => { e.stopPropagation(); updateExtPost.mutate({ id: p.id, patch: { approval_status: posted ? "aprovado" : "postado", approval_updated_at: new Date().toISOString() } }); }}
                                    className={cn("grid h-6 w-6 md:h-4 md:w-4 shrink-0 place-items-center rounded border cursor-pointer transition-colors",
                                      posted ? "bg-emerald-500 border-emerald-500 text-white" : "border-orange-500/50 hover:border-emerald-500 hover:text-emerald-600")}>
                                    {posted && <Check className="h-3 w-3" strokeWidth={3} />}
                                  </span>
                                </div>
                                <p className={cn("text-[12px] font-body font-semibold leading-tight truncate", posted ? "line-through text-muted-foreground" : "text-foreground")}>{p.title || "Post"}</p>
                              </button>
                              );
                            }}
                          </Draggable>
                        );
                      })}
                      {dropProvided.placeholder}
                      {/* TAREFA B — posts do Cria do cliente (prontos+data). Só LEITURA aqui
                          (não arrastáveis, ficam FORA do índice do dnd pra não quebrar o
                          arrastar). Visualmente distintos: verde tracejado + ícone. Clicar
                          abre o Kanban do cliente na ficha dele. */}
                      {criaDay.map((p) => (
                        <button key={`cria:${p.id}`} type="button" title={p.title ?? undefined}
                          onClick={() => { if (p.crm_client_id) navigate(`/socialmidia/clientes/${p.crm_client_id}/kanban-cliente`); }}
                          className="rounded-lg border border-dashed px-2 py-1.5 text-left w-full overflow-hidden transition-colors hover:brightness-95"
                          style={{ borderColor: `${(p.client_color || CRIA_POST_COLOR)}80`, background: `${(p.client_color || CRIA_POST_COLOR)}0F` }}>
                          <div className="flex items-center gap-1" style={{ color: CRIA_POST_COLOR }}>
                            <Layers className="h-3 w-3 shrink-0" />
                            <span className="text-[10px] font-body font-bold truncate flex-1 text-foreground/80">
                              {p.scheduled_time && <span className="tabular-nums">{p.scheduled_time.slice(0, 5)} · </span>}{p.client_name ?? "Cliente"}
                            </span>
                            <span className="shrink-0 text-[8px] font-bold px-1.5 py-0.5 rounded-full text-white" style={{ background: CRIA_POST_COLOR }}>
                              {CRIA_POST_STATUS[p.status ?? ""] ?? "Cria"}
                            </span>
                          </div>
                          <p className="text-[12px] font-body font-semibold leading-tight truncate text-foreground">{p.title || "Post"}</p>
                        </button>
                      ))}
                      {totalDay === 0 && criaDay.length === 0 && <button onClick={() => { setAddKind("criacao"); setAddDay(iso); }} className="text-[11px] font-body text-muted-foreground/60 hover:text-primary py-1">+ cliente</button>}
                    </div>
                  )}
                </Droppable>
              );
            })}
          </div>
        </DragDropContext>
      </div>

      {/* Próximas captações e tarefas: DUAS listas separadas e rotuladas, cada uma com
          estado vazio claro, pra ninguém confundir o que a seção mostra. */}
      <div id="captacoes-section" data-tour="ag-captacoes" className="rounded-2xl border border-border bg-card p-4 mt-4 scroll-mt-20">
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <p className="text-sm font-display font-bold text-foreground">Próximas captações e tarefas</p>
          <div className="flex items-center gap-2 flex-wrap">
            <Button size="sm" variant="outline" className="h-8" onClick={() => { setAddKind("tarefa"); setAddDay(new Date().toLocaleDateString("sv-SE")); }}><Plus className="h-3.5 w-3.5 mr-1" /> Nova tarefa</Button>
            <Button size="sm" className="h-8" onClick={() => setCapOpen(true)}><Plus className="h-3.5 w-3.5 mr-1" /> Nova captação</Button>
          </div>
        </div>

        {/* Próximas captações */}
        <div className="flex items-center gap-1.5 mb-2">
          <Video className="h-3.5 w-3.5 text-primary" />
          <p className="text-[11px] font-body font-bold uppercase tracking-wider text-muted-foreground">Próximas captações</p>
          {upcoming.length > 0 && <span className="text-[10px] font-body font-semibold text-muted-foreground">{upcoming.length}</span>}
        </div>
        {upcoming.length === 0 ? (
          <p className="text-[12px] font-body text-muted-foreground py-3 text-center rounded-xl border border-dashed border-border">Nenhuma captação agendada. Clique em "Nova captação".</p>
        ) : (
          <div className="space-y-2">
            {upcoming.map((c) => {
              const st = STATUS[c.status];
              const d = parseDateOnly(c.capture_date);
              // Atrasada: data já passou e não foi concluída/cancelada. Destaque vermelho.
              const overdue = c.status !== "concluida" && c.capture_date < today;
              return (
                <div key={c.id} className={cn("flex items-center gap-3 rounded-xl border p-3 flex-wrap", overdue ? "border-red-300 bg-red-50/50 dark:bg-red-500/5" : "border-border")}>
                  <div className="text-center shrink-0 w-11">
                    <p className={cn("text-lg font-display font-extrabold leading-none", overdue ? "text-red-600" : "text-foreground")}>{d.getDate()}</p>
                    <p className="text-[10px] font-body uppercase text-muted-foreground">{d.toLocaleDateString("pt-BR", { month: "short" })}</p>
                  </div>
                  <div className={cn("grid h-9 w-9 place-items-center rounded-full shrink-0", overdue ? "bg-red-100 text-red-600" : "bg-primary/10 text-primary")}><Video className="h-4 w-4" /></div>
                  <button type="button" onClick={() => setEditCap(c)} className="min-w-0 flex-1 text-left">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {overdue && <span className="text-[10px] font-body font-bold rounded-full px-2 py-0.5 bg-red-100 text-red-700 shrink-0">Atrasada</span>}
                      <p className="text-sm font-body font-semibold text-foreground truncate">{nameOf(c.crm_client_id, c.client_name)}</p>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap text-[11px] font-body text-muted-foreground">
                      {c.capture_time && <span className="inline-flex items-center gap-0.5"><Clock className="h-3 w-3" />{c.capture_time.slice(0, 5)}</span>}
                      {c.location && <span className="inline-flex items-center gap-0.5"><MapPin className="h-3 w-3" />{c.location}</span>}
                      {c.team && <span className="inline-flex items-center gap-0.5"><Users className="h-3 w-3" />{c.team}</span>}
                    </div>
                    {c.note && <p className="text-[11px] font-body text-muted-foreground/80 mt-0.5 truncate italic">{c.note}</p>}
                  </button>
                  <select value={c.status} onChange={(e) => updCapture.mutate({ id: c.id, patch: { status: e.target.value as Capture["status"] } })}
                    className={cn("text-[11px] font-body font-semibold rounded-full px-2 py-1 border-0 outline-none cursor-pointer", st.cls)}>
                    <option value="agendada">Agendada</option>
                    <option value="concluida">Concluída</option>
                    <option value="cancelada">Cancelada</option>
                  </select>
                  <button onClick={() => delCapture.mutate(c.id)} className="-m-1 grid h-10 w-10 shrink-0 place-items-center rounded-lg text-muted-foreground/50 hover:text-destructive hover:bg-destructive/5 transition-colors md:h-8 md:w-8" aria-label="Remover captação"><X className="h-4 w-4" /></button>
                </div>
              );
            })}
          </div>
        )}

        {/* Próximas tarefas */}
        <div className="flex items-center gap-1.5 mt-5 mb-2">
          <ListChecks className="h-3.5 w-3.5 text-sky-600" />
          <p className="text-[11px] font-body font-bold uppercase tracking-wider text-muted-foreground">Próximas tarefas</p>
          {upcomingTasks.length > 0 && <span className="text-[10px] font-body font-semibold text-muted-foreground">{upcomingTasks.length}</span>}
        </div>
        {upcomingTasks.length === 0 ? (
          <p className="text-[12px] font-body text-muted-foreground py-3 text-center rounded-xl border border-dashed border-border">Nenhuma tarefa pendente. Clique em "Nova tarefa".</p>
        ) : (
          <div className="space-y-2">
            {upcomingTasks.map((t) => {
              const d = parseDateOnly(t.due_date!);
              const isLead = !!t.crm_lead_id;
              const clientColor = isLead ? "#0061EE" : ((t.crm_client_id ? clients.find((c) => c.id === t.crm_client_id)?.color : null) || TASK_CLIENT_DEFAULT_COLOR);
              const who = isLead ? (leadName(t.crm_lead_id) ?? "Lead") : nameOf(t.crm_client_id, null);
              // Atrasada: venceu antes de hoje e não está concluída. Destaque vermelho.
              const overdue = t.due_date! < today;
              return (
                <div key={t.id} className={cn("flex items-center gap-3 rounded-xl border p-3 flex-wrap", overdue ? "border-red-300 bg-red-50/50 dark:bg-red-500/5" : "border-border")}>
                  <div className="text-center shrink-0 w-11">
                    <p className={cn("text-lg font-display font-extrabold leading-none", overdue ? "text-red-600" : "text-foreground")}>{d.getDate()}</p>
                    <p className="text-[10px] font-body uppercase text-muted-foreground">{d.toLocaleDateString("pt-BR", { month: "short" })}</p>
                  </div>
                  <span className="grid h-9 w-9 place-items-center rounded-full shrink-0" style={{ background: `${clientColor}1f`, color: clientColor }}><ListChecks className="h-4 w-4" /></span>
                  <button type="button" onClick={() => setEditTask(t)} className="min-w-0 flex-1 text-left">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {overdue && <span className="text-[10px] font-body font-bold rounded-full px-2 py-0.5 bg-red-100 text-red-700 shrink-0">Atrasada</span>}
                      <p className="text-sm font-body font-semibold text-foreground truncate">{t.title}</p>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap text-[11px] font-body text-muted-foreground">
                      <span className="truncate">{isLead ? `Lead · ${who}` : who}</span>
                      {t.due_time && <span className="inline-flex items-center gap-0.5"><Clock className="h-3 w-3" />{t.due_time.slice(0, 5)}</span>}
                    </div>
                  </button>
                  <span className="text-[11px] font-body font-semibold rounded-full px-2 py-1 shrink-0" style={{ background: `${clientColor}1f`, color: clientColor }}>{CRM_TASK_PRIORITY_LABELS[t.priority]}</span>
                  <span role="button" tabIndex={0} aria-label="Concluir tarefa"
                    onClick={() => updTask.mutate({ id: t.id, status: "concluida" })}
                    className="grid h-10 w-10 shrink-0 place-items-center rounded-lg border border-border cursor-pointer hover:border-emerald-500 hover:text-emerald-600 transition-colors md:h-8 md:w-8"><Check className="h-4 w-4" /></span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* "+" do dia: escolhe o TIPO (criação / tarefa / captação) antes de preencher. */}
      <AddAnyDialog open={!!addDay} day={addDay} clients={clients} teamNames={teamNames} initialKind={addKind}
        onClose={() => setAddDay(null)}
        onCreation={(crm, name, team, note, day) => { addCreation.mutate({ day, crm_client_id: crm, client_name: name, team, note }); setAddDay(null); }}
        onTask={(v) => { createTask.mutate(v, { onSuccess: () => toast.success("Tarefa criada.") }); setAddDay(null); }}
        onCapture={(v) => { addCapture.mutate(v); setAddDay(null); }} />

      {/* Edição de uma criação existente */}
      <AddCreationDialog open={!!editCreation} day={null} initial={editCreation} clients={clients} teamNames={teamNames}
        onClose={() => setEditCreation(null)}
        onSave={(crm, name, team, note) => {
          if (editCreation) {
            updCreation.mutate({ id: editCreation.id, patch: { crm_client_id: crm, client_name: name, team, note } },
              { onSuccess: () => toast.success("Criação atualizada."), onError: () => toast.error("Não consegui salvar.") });
          }
          setEditCreation(null);
        }} />
      <CaptureDialog open={capOpen || !!editCap} initial={editCap} clients={clients} teamNames={teamNames}
        onClose={() => { setCapOpen(false); setEditCap(null); }}
        onSave={(v) => {
          if (editCap) {
            updCapture.mutate({ id: editCap.id, patch: v },
              { onSuccess: () => toast.success("Captação atualizada."), onError: () => toast.error("Não consegui salvar.") });
          } else {
            addCapture.mutate(v);
          }
          setCapOpen(false); setEditCap(null);
        }} pending={addCapture.isPending || updCapture.isPending} />
      <TaskDialog task={editTask} clients={clients}
        onClose={() => setEditTask(null)}
        onOpenCrm={() => { setEditTask(null); navigate("/socialmidia/criacrm/tarefas"); }}
        onSave={(patch) => {
          if (editTask) {
            updTask.mutate({ id: editTask.id, ...patch }, { onSuccess: () => toast.success("Tarefa atualizada.") });
          }
          setEditTask(null);
        }} />

      <PostEditDialog post={editPost} clientName={editPost ? (extById.get(editPost.external_client_id)?.name ?? null) : null}
        onClose={() => setEditPost(null)} saving={updateExtPost.isPending}
        onSave={(patch) => { if (editPost) updateExtPost.mutate({ id: editPost.id, patch }, { onSuccess: () => { toast.success("Post atualizado."); setEditPost(null); } }); }}
        onOpenClient={() => { if (editPost) { const crm = extById.get(editPost.external_client_id)?.crm_client_id; setEditPost(null); navigate(crm ? `/socialmidia/clientes/${crm}/posts` : "/socialmidia/criapost/aprovacoes"); } }} />

      {/* Painel "Ver todos" de um dia cheio: lista tudo, cada item clicável pra editar. */}
      {dayModal && (() => {
        const iso = dayModal;
        const caps = capturesByDay.get(iso) ?? []; const tks = tasksByDay.get(iso) ?? [];
        const cri = byDay.get(iso) ?? []; const pts = postsByDay.get(iso) ?? [];
        // Posts do Cria do cliente (5o tipo): entram no modal e na contagem, iguais à célula.
        const criaCli = criaPostsByDay.get(iso) ?? [];
        // Mesma ordenação da grade (ordem manual do dia quando houver; senão por horário).
        const items = buildDayItems(caps, tks, cri, pts, dayOrders[iso]);
        const d = parseDateOnly(iso);
        const rowCls = "w-full flex items-center gap-2.5 rounded-xl border border-border p-2.5 text-left hover:border-primary/50 hover:bg-primary/5 transition-colors";
        const dot = (c: string) => <span className="h-2 w-2 rounded-full shrink-0" style={{ background: c }} />;
        return (
          <Dialog open onOpenChange={(o) => { if (!o) setDayModal(null); }}>
            <DialogContent className="sm:max-w-md rounded-2xl max-h-[80vh] overflow-y-auto">
              <DialogHeader><DialogTitle className="font-display capitalize">{d.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" })}</DialogTitle></DialogHeader>
              <p className="text-[12px] font-body text-muted-foreground -mt-2">{items.length + criaCli.length} item(ns) · clique pra editar</p>
              <div className="space-y-1.5 mt-1">
                {items.map((item) => {
                  if (item.kind === "cria") { const c = item.cria; return <button key={`c${c.id}`} onClick={() => { setDayModal(null); setEditCreation(c); }} className={rowCls}>{dot("#4B3FA8")}<span className="text-[13px] font-body font-semibold text-foreground truncate">{nameOf(c.crm_client_id, c.client_name)}</span><span className="ml-auto text-[10px] text-muted-foreground">Criação</span></button>; }
                  if (item.kind === "task") { const t = item.task; const isLead = !!t.crm_lead_id; const dotColor = isLead ? "#0061EE" : ((t.crm_client_id ? clients.find((x) => x.id === t.crm_client_id)?.color : null) || TASK_CLIENT_DEFAULT_COLOR); return <button key={`t${t.id}`} onClick={() => { setDayModal(null); setEditTask(t); }} className={rowCls}>{dot(dotColor)}<span className="text-[13px] font-body font-semibold text-foreground truncate">{item.time ? `${item.time} · ` : ""}{t.title}</span><span className="ml-auto text-[10px] text-muted-foreground">Tarefa</span></button>; }
                  if (item.kind === "cap") { const c = item.cap; return <button key={`p${c.id}`} onClick={() => { setDayModal(null); setEditCap(c); }} className={rowCls}>{dot("#FF77B9")}<span className="text-[13px] font-body font-semibold text-foreground truncate">{nameOf(c.crm_client_id, c.client_name)}{c.capture_time ? ` · ${c.capture_time.slice(0, 5)}` : ""}</span><span className="ml-auto text-[10px] text-muted-foreground">Captação</span></button>; }
                  const p = item.post; const st = POST_STATUS[p.approval_status ?? "em_producao"]; return <button key={`o${p.id}`} onClick={() => { setDayModal(null); openPost(p); }} className={rowCls}>{dot("#EA4918")}<span className="text-[13px] font-body font-semibold text-foreground truncate">{item.time ? `${item.time} · ` : ""}{p.title || "Post"}</span>{st && <span className={cn("ml-auto shrink-0 text-[9px] font-bold px-1.5 py-0.5 rounded-full", st.cls)}>{st.label}</span>}</button>;
                })}
                {/* Cria do cliente: 5o tipo, só leitura. Clicar abre o kanban do cliente. */}
                {criaCli.map((p) => (
                  <button key={`cc${p.id}`} onClick={() => { setDayModal(null); if (p.crm_client_id) navigate(`/socialmidia/clientes/${p.crm_client_id}/kanban-cliente`); }} className={rowCls}>
                    {dot(CRIA_POST_COLOR)}
                    <span className="text-[13px] font-body font-semibold text-foreground truncate">{p.scheduled_time ? `${p.scheduled_time.slice(0, 5)} · ` : ""}{p.title || "Post"}</span>
                    <span className="ml-auto shrink-0 text-[9px] font-bold px-1.5 py-0.5 rounded-full text-white" style={{ background: CRIA_POST_COLOR }}>{CRIA_POST_STATUS[p.status ?? ""] ?? "Cria"}</span>
                  </button>
                ))}
              </div>
            </DialogContent>
          </Dialog>
        );
      })()}
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

function AddCreationDialog({ open, day, initial, clients, teamNames, onClose, onSave }: { open: boolean; day: string | null; initial?: Creation | null; clients: Client[]; teamNames: string[]; onClose: () => void; onSave: (crm: string | null, name: string | null, team: string | null, note: string | null) => void }) {
  const [crm, setCrm] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [team, setTeam] = useState("");
  const [note, setNote] = useState("");
  const seed = open ? `${day ?? ""}:${initial?.id ?? "new"}` : "";
  const [seeded, setSeeded] = useState("");
  if (open && seed !== seeded) { setSeeded(seed); setCrm(initial?.crm_client_id ?? null); setName(initial?.client_name ?? ""); setTeam(initial?.team ?? ""); setNote(initial?.note ?? ""); }
  if (!open && seeded) setSeeded("");
  const valid = !!crm || name.trim();
  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader><DialogTitle className="font-display">{initial ? "Editar criação" : "Adicionar à criação"}</DialogTitle></DialogHeader>
        <div className="space-y-2">
          <ClientPicker clients={clients} crm={crm} name={name} onCrm={setCrm} onName={setName} />
          <div>
            <p className="text-[11px] font-body font-semibold text-muted-foreground uppercase tracking-wider mb-1">Equipe (opcional)</p>
            <Input value={team} onChange={(e) => setTeam(e.target.value)} placeholder="Ex.: Ana, Bruno" list="agenda-team-names" />
            <TeamDatalist names={teamNames} />
          </div>
          <div>
            <p className="text-[11px] font-body font-semibold text-muted-foreground uppercase tracking-wider mb-1">Notas (opcional)</p>
            <Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ex.: gravar 3 reels, levar tripé…" className="rounded-xl text-sm" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={() => onSave(crm, name.trim() || null, team.trim() || null, note.trim() || null)} disabled={!valid}>{initial ? "Salvar" : "Adicionar"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// "+" do dia: primeiro escolhe O QUE é (criação / tarefa / captação), depois preenche.
function AddAnyDialog({ open, day, clients, teamNames, onClose, onCreation, onTask, onCapture, initialKind = "criacao" }: {
  open: boolean; day: string | null; clients: Client[]; teamNames: string[]; onClose: () => void;
  initialKind?: "criacao" | "tarefa" | "captacao";
  onCreation: (crm: string | null, name: string | null, team: string | null, note: string | null, day: string) => void;
  onTask: (v: { title: string; description: string | null; crm_client_id: string | null; priority: CrmTaskPriority; status: CrmTaskStatus; due_date: string; due_time: string | null }) => void;
  onCapture: (v: { capture_date: string; capture_time?: string | null; location?: string | null; crm_client_id?: string | null; client_name?: string | null; team?: string | null; note?: string | null }) => void;
}) {
  const [kind, setKind] = useState<"criacao" | "tarefa" | "captacao">("criacao");
  const [crm, setCrm] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [team, setTeam] = useState("");
  const [note, setNote] = useState("");
  const [title, setTitle] = useState("");
  const [prio, setPrio] = useState<CrmTaskPriority>("media");
  const [time, setTime] = useState("");
  const [loc, setLoc] = useState("");
  const [date, setDate] = useState(""); // data do item (padrao o dia clicado, mas editavel)
  const [seeded, setSeeded] = useState("");

  if (open && day && seeded !== day) {
    setSeeded(day);
    setKind(initialKind); setCrm(null); setName(""); setTeam(""); setNote(""); setTitle(""); setPrio("media"); setTime(""); setLoc(""); setDate(day);
  }
  if (!open && seeded) setSeeded("");

  const hasClient = !!crm || !!name.trim();
  const valid = (kind === "tarefa" ? !!title.trim() : hasClient) && !!date;

  const submit = () => {
    const d = date || day;
    if (!d) return;
    if (kind === "criacao") onCreation(crm, name.trim() || null, team.trim() || null, note.trim() || null, d);
    else if (kind === "tarefa") onTask({ title: title.trim(), description: note.trim() || null, crm_client_id: crm, priority: prio, status: "pendente", due_date: d, due_time: time || null });
    else onCapture({ capture_date: d, capture_time: time || null, location: loc.trim() || null, crm_client_id: crm, client_name: name.trim() || null, team: team.trim() || null, note: note.trim() || null });
  };

  const KINDS = [
    { k: "criacao", label: "Criação" },
    { k: "tarefa", label: "Tarefa" },
    { k: "captacao", label: "Captação" },
  ] as const;

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader><DialogTitle className="font-display">Adicionar no dia</DialogTitle></DialogHeader>
        <div className="space-y-3">
          {/* Tipo */}
          <div className="grid grid-cols-3 gap-2">
            {KINDS.map(({ k, label }) => (
              <button key={k} type="button" onClick={() => setKind(k)}
                className={cn("rounded-xl border py-2 text-sm font-body font-semibold transition-colors",
                  kind === k ? "border-primary bg-primary/[0.06] text-primary" : "border-border text-muted-foreground hover:border-primary/40")}>
                {label}
              </button>
            ))}
          </div>

          {kind === "tarefa" && (
            <div>
              <p className="text-[11px] font-body font-semibold text-muted-foreground uppercase mb-1">Tarefa *</p>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="O que precisa ser feito" />
            </div>
          )}

          {/* Data do item (padrao o dia clicado, mas da pra mudar aqui). */}
          <div>
            <p className="text-[11px] font-body font-semibold text-muted-foreground uppercase mb-1">Data</p>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>

          <ClientPicker clients={clients} crm={crm} name={name} onCrm={setCrm} onName={setName} />

          {kind === "captacao" && (
            // Hora e Local lado a lado; abaixo de ~390px empilha pra nenhum espremer o outro.
            // O valor da hora alinha à esquerda / não corta pela regra global do index.css.
            <div className="flex gap-2 max-[390px]:flex-col">
              <div className="w-[120px] shrink-0 min-w-0 max-[390px]:w-full"><p className="text-[11px] font-body font-semibold text-muted-foreground uppercase mb-1">Hora</p><Input type="time" value={time} onChange={(e) => setTime(e.target.value)} className="w-full h-10" /></div>
              <div className="flex-1 min-w-0"><p className="text-[11px] font-body font-semibold text-muted-foreground uppercase mb-1">Local (opcional)</p><Input value={loc} onChange={(e) => setLoc(e.target.value)} placeholder="Ex.: Estúdio" className="h-10" /></div>
            </div>
          )}

          {kind === "tarefa" && (
            <div className="grid grid-cols-2 gap-2 max-[390px]:grid-cols-1">
              <div className="min-w-0">
                <p className="text-[11px] font-body font-semibold text-muted-foreground uppercase mb-1">Prioridade</p>
                <select value={prio} onChange={(e) => setPrio(e.target.value as CrmTaskPriority)} className="w-full h-10 rounded-xl border border-border bg-card px-3 text-sm font-body">
                  {CRM_TASK_PRIORITIES.map((p) => <option key={p} value={p}>{CRM_TASK_PRIORITY_LABELS[p]}</option>)}
                </select>
              </div>
              <div className="min-w-0">
                <p className="text-[11px] font-body font-semibold text-muted-foreground uppercase mb-1">Horário</p>
                <Input type="time" value={time} onChange={(e) => setTime(e.target.value)} className="w-full h-10" />
              </div>
            </div>
          )}

          {kind !== "tarefa" && (
            <div>
              <p className="text-[11px] font-body font-semibold text-muted-foreground uppercase mb-1">Equipe (opcional)</p>
              <Input value={team} onChange={(e) => setTeam(e.target.value)} placeholder="Ex.: Ana, Bruno" list="agenda-team-names" />
              <TeamDatalist names={teamNames} />
            </div>
          )}

          <div>
            <p className="text-[11px] font-body font-semibold text-muted-foreground uppercase mb-1">Notas (opcional)</p>
            <Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ex.: captação mês de julho, captação de anúncio…" className="rounded-xl text-sm" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={submit} disabled={!valid}>Adicionar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CaptureDialog({ open, initial, clients, teamNames, onClose, onSave, pending }: { open: boolean; initial?: Capture | null; clients: Client[]; teamNames: string[]; onClose: () => void; onSave: (v: { capture_date: string; capture_time?: string | null; location?: string | null; crm_client_id?: string | null; client_name?: string | null; team?: string | null; note?: string | null; status?: Capture["status"] }) => void; pending: boolean }) {
  const [crm, setCrm] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [loc, setLoc] = useState("");
  const [team, setTeam] = useState("");
  const [note, setNote] = useState("");
  const [status, setStatus] = useState<Capture["status"]>("agendada");
  const seed = open ? (initial?.id ?? "new") : "";
  const [seeded, setSeeded] = useState("");
  if (open && seed !== seeded) {
    setSeeded(seed);
    setCrm(initial?.crm_client_id ?? null); setName(initial?.client_name ?? "");
    setDate(initial?.capture_date ?? ""); setTime(initial?.capture_time ? initial.capture_time.slice(0, 5) : "");
    setLoc(initial?.location ?? ""); setTeam(initial?.team ?? ""); setNote(initial?.note ?? ""); setStatus(initial?.status ?? "agendada");
  }
  if (!open && seeded) setSeeded("");
  const valid = date && (!!crm || name.trim());
  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader><DialogTitle className="font-display">{initial ? "Editar captação" : "Nova captação"}</DialogTitle></DialogHeader>
        <div className="space-y-2">
          <ClientPicker clients={clients} crm={crm} name={name} onCrm={setCrm} onName={setName} />
          {/* Data/Hora: lado a lado; abaixo de ~390px empilham pra o valor nunca espremer. */}
          <div className="grid grid-cols-2 gap-2 max-[390px]:grid-cols-1">
            <div className="min-w-0"><p className="text-[11px] font-body font-semibold text-muted-foreground uppercase mb-1">Data</p><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-full h-10" /></div>
            <div className="min-w-0"><p className="text-[11px] font-body font-semibold text-muted-foreground uppercase mb-1">Hora</p><Input type="time" value={time} onChange={(e) => setTime(e.target.value)} className="w-full h-10" /></div>
          </div>
          <div><p className="text-[11px] font-body font-semibold text-muted-foreground uppercase mb-1">Local (opcional)</p><Input value={loc} onChange={(e) => setLoc(e.target.value)} placeholder="Ex.: Estúdio, coworking, local externo" /></div>
          <div><p className="text-[11px] font-body font-semibold text-muted-foreground uppercase mb-1">Equipe (opcional)</p><Input value={team} onChange={(e) => setTeam(e.target.value)} placeholder="Ex.: Ana, Bruno" list="agenda-team-names" /><TeamDatalist names={teamNames} /></div>
          <div>
            <p className="text-[11px] font-body font-semibold text-muted-foreground uppercase mb-1">Notas (opcional)</p>
            <Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ex.: captação mês de julho, captação de anúncio…" className="rounded-xl text-sm" />
          </div>
          {initial && (
            <div>
              <p className="text-[11px] font-body font-semibold text-muted-foreground uppercase mb-1">Status</p>
              <select value={status} onChange={(e) => setStatus(e.target.value as Capture["status"])} className="w-full h-10 rounded-xl border border-border bg-card px-3 text-sm font-body">
                <option value="agendada">Agendada</option>
                <option value="concluida">Concluída</option>
                <option value="cancelada">Cancelada</option>
              </select>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={() => onSave({ capture_date: date, capture_time: time || null, location: loc.trim() || null, crm_client_id: crm, client_name: name.trim() || null, team: team.trim() || null, note: note.trim() || null, ...(initial ? { status } : {}) })} disabled={!valid || pending}>
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : initial ? "Salvar" : "Agendar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Edição rápida da tarefa do CRM direto da grade, sem sair da Agenda.
function TaskDialog({ task, clients, onClose, onOpenCrm, onSave }: {
  task: CrmTask | null;
  clients: Client[];
  onClose: () => void;
  onOpenCrm: () => void;
  onSave: (patch: { title: string; description: string | null; priority: CrmTaskPriority; status: CrmTaskStatus; due_date: string | null; due_time: string | null }) => void;
}) {
  const open = !!task;
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [prio, setPrio] = useState<CrmTaskPriority>("media");
  const [status, setStatus] = useState<CrmTaskStatus>("pendente");
  const [due, setDue] = useState("");
  const [dueTime, setDueTime] = useState("");
  const [seeded, setSeeded] = useState("");
  if (open && task && seeded !== task.id) {
    setSeeded(task.id);
    setTitle(task.title); setDesc(task.description ?? "");
    setPrio(task.priority); setStatus(task.status); setDue(task.due_date ?? ""); setDueTime(task.due_time ? task.due_time.slice(0, 5) : "");
  }
  if (!open && seeded) setSeeded("");
  const clientName = task?.crm_client_id ? clients.find((c) => c.id === task.crm_client_id)?.name : null;
  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader><DialogTitle className="font-display">Editar tarefa</DialogTitle></DialogHeader>
        <div className="space-y-2">
          {clientName && <p className="text-[11px] font-body text-muted-foreground">Cliente: <span className="font-semibold text-foreground">{clientName}</span></p>}
          <div><p className="text-[11px] font-body font-semibold text-muted-foreground uppercase mb-1">Título</p><Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="O que precisa ser feito" /></div>
          <div><p className="text-[11px] font-body font-semibold text-muted-foreground uppercase mb-1">Descrição (opcional)</p><Textarea rows={3} value={desc} onChange={(e) => setDesc(e.target.value)} className="rounded-xl text-sm" placeholder="Detalhes, contexto..." /></div>
          <div className="flex gap-2">
            <div className="flex-1">
              <p className="text-[11px] font-body font-semibold text-muted-foreground uppercase mb-1">Prioridade</p>
              <select value={prio} onChange={(e) => setPrio(e.target.value as CrmTaskPriority)} className="w-full h-10 rounded-xl border border-border bg-card px-3 text-sm font-body">
                {CRM_TASK_PRIORITIES.map((p) => <option key={p} value={p}>{CRM_TASK_PRIORITY_LABELS[p]}</option>)}
              </select>
            </div>
            <div className="flex-1">
              <p className="text-[11px] font-body font-semibold text-muted-foreground uppercase mb-1">Status</p>
              <select value={status} onChange={(e) => setStatus(e.target.value as CrmTaskStatus)} className="w-full h-10 rounded-xl border border-border bg-card px-3 text-sm font-body">
                {CRM_TASK_STATUSES.map((s) => <option key={s} value={s}>{TASK_STATUS_LABELS[s]}</option>)}
              </select>
            </div>
          </div>
          {/* Vencimento/Horário: empilham abaixo de ~390px pra não cortar o valor. */}
          <div className="grid grid-cols-2 gap-2 max-[390px]:grid-cols-1">
            <div className="min-w-0"><p className="text-[11px] font-body font-semibold text-muted-foreground uppercase mb-1">Vencimento</p><Input type="date" value={due} onChange={(e) => setDue(e.target.value)} className="w-full h-10" /></div>
            <div className="min-w-0"><p className="text-[11px] font-body font-semibold text-muted-foreground uppercase mb-1">Horário</p><Input type="time" value={dueTime} onChange={(e) => setDueTime(e.target.value)} className="w-full h-10" /></div>
          </div>
          <button type="button" onClick={onOpenCrm} className="inline-flex items-center gap-1 text-[11px] font-body text-muted-foreground hover:text-primary transition-colors">
            <ExternalLink className="h-3 w-3" /> Abrir no CRM
          </button>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={() => onSave({ title: title.trim(), description: desc.trim() || null, priority: prio, status, due_date: due || null, due_time: dueTime || null })} disabled={!title.trim()}>Salvar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Copia a legenda inteira pro clipboard PRESERVANDO a formatação (quebras/parágrafos
// exatamente como estão no textarea). Usa a Clipboard API e cai num fallback com
// textarea + execCommand quando o navegador não expõe o clipboard (http, iOS antigo...).
async function copiarLegenda(texto: string) {
  const valor = texto ?? "";
  if (!valor.trim()) { toast.error("Não há legenda pra copiar."); return; }
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(valor);
    } else {
      const ta = document.createElement("textarea");
      ta.value = valor;
      ta.style.position = "fixed";
      ta.style.top = "-9999px";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.focus(); ta.select();
      const ok = document.execCommand("copy");
      ta.remove();
      if (!ok) throw new Error("clipboard indisponível");
    }
    toast.success("Legenda copiada");
  } catch {
    toast.error("Não consegui copiar a legenda. Copie manualmente.");
  }
}

// Miniatura de um anexo do post (read-only) pra grade "Mídia e anexos" do popup da agenda.
// Drive: view_url é página, então usa o thumbnail exibível (com fallback pro lh3).
// Vídeo: mostra o frame/ícone de play por cima.
function AgendaMediaThumb({ m }: { m: CriaMedia }) {
  const video = isVideoMedia(m);
  const src = getThumbnailUrl(m, 480) || "";
  const onImgError = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget;
    const fb = getDriveImageFallbackUrl(m, 800);
    if (fb && !img.dataset.fb) { img.dataset.fb = "1"; img.src = fb; return; }
    img.style.display = "none";
  };
  return (
    <div className="relative w-full h-full bg-muted">
      {src
        ? <img src={src} alt="" draggable={false} loading="lazy" className="w-full h-full object-cover select-none" onError={onImgError} />
        : <div className="w-full h-full flex items-center justify-center text-muted-foreground"><FileImage className="h-5 w-5" /></div>}
      {video && <span className="absolute inset-0 flex items-center justify-center pointer-events-none"><Play className="h-6 w-6 text-white [filter:drop-shadow(0_1px_2px_rgba(0,0,0,.7))]" /></span>}
    </div>
  );
}

// Edição rápida do POST direto da agenda, sem navegar pro cliente. Cobre o essencial
// (título, data, horário, status, legenda). Mídia/roteiro cheios ficam no botão do cliente.
function PostEditDialog({ post, clientName, onClose, onSave, onOpenClient, saving }: {
  post: ExternalPostWithClient | null;
  clientName: string | null;
  onClose: () => void;
  onSave: (patch: Record<string, unknown>) => void;
  onOpenClient: () => void;
  saving: boolean;
}) {
  const open = !!post;
  const [title, setTitle] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [caption, setCaption] = useState("");
  const [status, setStatus] = useState<string>("em_producao");
  const [seeded, setSeeded] = useState("");
  // Mídias do post só carregam quando o popup está aberto (postId null = query desabilitada).
  // Como só existe 1 PostEditDialog por vez, a query fica naturalmente escopada ao post aberto.
  const { list: media } = useCriaPostMedia(post?.id ?? null);
  const attachments = media.data ?? [];
  // Download por anexo (util compartilhado): storage baixa o blob, Drive vai pro link
  // de download, vídeo abre o player em nova aba.
  const [dlId, setDlId] = useState<string | null>(null);
  const onDownloadOne = async (m: CriaMedia, index: number) => {
    setDlId(m.id);
    try {
      const kind = await downloadMediaFile(m, mediaDownloadName(post?.title ?? undefined, index, m));
      if (kind === "video") toast.info("Vídeo aberto em nova aba pra você salvar de lá.");
      else if (kind === "opened") toast.info("Abri a imagem, é só segurar pra salvar.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não consegui baixar.");
    } finally {
      setDlId(null);
    }
  };
  // Link do Drive pra atalho "Abrir no Drive": prioriza o campo Ideia/Referência quando
  // for link do Drive; senão pega a view_url do primeiro anexo do Drive do post.
  const driveUrl = (() => {
    if (isDriveUrl(post?.reference_url)) return post!.reference_url;
    const att = attachments.find((m) => isDriveMedia(m) && !!m.view_url);
    return att?.view_url ?? null;
  })();
  const refUrl = post?.reference_url?.trim() || null;
  if (open && post && seeded !== post.id) {
    setSeeded(post.id);
    setTitle(post.title ?? "");
    setDate(post.scheduled_date ?? "");
    setTime(((post as { scheduled_time?: string | null }).scheduled_time ?? "")?.slice(0, 5) ?? "");
    setCaption(post.caption ?? "");
    setStatus(post.approval_status ?? "em_producao");
  }
  if (!open && seeded) setSeeded("");
  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="sm:max-w-lg rounded-2xl">
        <DialogHeader><DialogTitle className="font-display">Editar post{clientName ? ` · ${clientName}` : ""}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div><p className="text-[11px] font-body font-semibold text-muted-foreground uppercase mb-1">Título</p><Input value={title} onChange={(e) => setTitle(e.target.value)} className="rounded-xl" /></div>
          {/* Data e Horário lado a lado. grid-cols-2 (minmax(0,1fr)) trava cada coluna em
              50% e impede o input nativo de "time" de transbordar no mobile. Alinhamento
              à esquerda e valor não-cortado vêm da regra global de input[type=date/time]
              no index.css (bug do iOS que centralizava/cortava). Altura h-10 igual aos
              demais campos, largura total; abaixo de ~390px o grid empilha sozinho. */}
          <div className="grid grid-cols-2 gap-2 max-[390px]:grid-cols-1">
            <div className="min-w-0"><p className="text-[11px] font-body font-semibold text-muted-foreground uppercase mb-1">Data</p><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-full h-10 rounded-lg px-3" /></div>
            <div className="min-w-0"><p className="text-[11px] font-body font-semibold text-muted-foreground uppercase mb-1">Horário</p><Input type="time" value={time} onChange={(e) => setTime(e.target.value)} className="w-full h-10 rounded-lg px-3" /></div>
          </div>
          <div>
            <p className="text-[11px] font-body font-semibold text-muted-foreground uppercase mb-1">Status</p>
            <select value={status} onChange={(e) => setStatus(e.target.value)} className="w-full h-10 rounded-xl border border-border bg-card px-3 text-sm font-body">
              {Object.entries(POST_STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
          </div>
          <div>
            <div className="flex items-center justify-between gap-2 mb-1">
              <p className="text-[11px] font-body font-semibold text-muted-foreground uppercase">Legenda</p>
              <button type="button" onClick={() => copiarLegenda(caption)} disabled={!caption.trim()}
                className="inline-flex items-center gap-1 h-9 px-2.5 rounded-lg text-[11px] font-body font-semibold text-muted-foreground hover:text-primary hover:bg-primary/[0.06] disabled:opacity-40 disabled:pointer-events-none transition-colors">
                <Copy className="h-3.5 w-3.5" /> Copiar legenda
              </button>
            </div>
            <Textarea rows={4} value={caption} onChange={(e) => setCaption(e.target.value)} className="rounded-xl text-sm" />
          </div>
          {/* Mídia e anexos (read-only): VER e PEGAR a mídia aqui, igual ao Trello, sem
              precisar abrir o cliente. Grade de miniaturas + baixar por anexo + Drive +
              link de referência. Upload/reordenar seguem só no editor completo do cliente. */}
          <div className="rounded-2xl border border-border bg-muted/30 p-3 space-y-2.5">
            <div className="flex items-center gap-1.5">
              <Paperclip className="h-3.5 w-3.5 text-muted-foreground" />
              <p className="text-[11px] font-body font-bold uppercase tracking-wide text-muted-foreground">Mídia e anexos</p>
            </div>

            {attachments.length === 0
              ? <p className="text-[12px] font-body text-muted-foreground">Sem mídia anexada.</p>
              : (
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                  {attachments.map((m, i) => {
                    const drive = isDriveMedia(m);
                    return (
                      <div key={m.id} className="relative rounded-xl overflow-hidden border border-border bg-muted aspect-square">
                        {/* Clicar na miniatura abre a imagem cheia / página do Drive em nova aba. */}
                        <button type="button" onClick={() => { if (m.view_url) window.open(m.view_url, "_blank", "noopener,noreferrer"); }}
                          className="absolute inset-0" aria-label="Abrir mídia">
                          <AgendaMediaThumb m={m} />
                        </button>
                        {/* Barra de ações por anexo (alvos de toque >=36px). */}
                        <div className="absolute inset-x-0 bottom-0 flex items-center justify-end gap-1 bg-gradient-to-t from-black/70 to-transparent p-1">
                          {drive && m.view_url && (
                            <a href={m.view_url} target="_blank" rel="noopener noreferrer" title="Abrir no Drive"
                              onClick={(e) => e.stopPropagation()}
                              className="inline-flex items-center justify-center h-9 w-9 rounded-lg bg-black/40 text-white hover:bg-black/60 transition-colors">
                              <HardDrive className="h-4 w-4" />
                            </a>
                          )}
                          <button type="button" onClick={(e) => { e.stopPropagation(); onDownloadOne(m, i); }} disabled={dlId === m.id} title="Baixar este anexo"
                            className="inline-flex items-center justify-center h-9 w-9 rounded-lg bg-black/40 text-white hover:bg-black/60 disabled:opacity-50 transition-colors">
                            {dlId === m.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

            {/* Link de referência / ideia (pode ser Drive ou qualquer link). */}
            {refUrl && (
              <a href={refUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2.5 group pt-0.5">
                <span className="shrink-0 grid h-9 w-9 place-items-center rounded-lg border border-border bg-card text-muted-foreground">
                  {isDriveUrl(refUrl) ? <HardDrive className="h-4 w-4 text-primary" /> : <Link2 className="h-4 w-4" />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[12px] font-body font-semibold text-primary group-hover:underline truncate">
                    {isDriveUrl(refUrl) ? "Abrir referência no Drive" : "Abrir referência"}
                  </span>
                  <span className="block text-[10px] font-body text-muted-foreground truncate">{refUrl}</span>
                </span>
                <span className="inline-flex items-center justify-center h-9 w-9 rounded-lg border border-border text-muted-foreground group-hover:text-primary transition-colors"><ExternalLink className="h-4 w-4" /></span>
              </a>
            )}

            {/* Atalho direto pro Drive do post quando não há reference_url do Drive mas há anexo do Drive. */}
            {driveUrl && !(refUrl && isDriveUrl(refUrl)) && (
              <button type="button" onClick={() => window.open(driveUrl, "_blank", "noopener,noreferrer")}
                className="inline-flex items-center gap-1.5 self-start rounded-lg border border-border px-2.5 py-1.5 text-[12px] font-body font-semibold text-foreground hover:border-primary/50 hover:bg-primary/[0.06] transition-colors">
                <HardDrive className="h-3.5 w-3.5 text-primary" /> Abrir no Drive
              </button>
            )}

            {/* Item 5: PASTA do Drive do post (campo drive_folder_url, distinto da referência).
                Abre o link direto em nova aba. */}
            {post?.drive_folder_url && (
              <button type="button" onClick={() => { const u = post?.drive_folder_url; if (u) window.open(u, "_blank", "noopener,noreferrer"); }}
                className="inline-flex items-center gap-1.5 self-start rounded-lg border border-primary/40 px-2.5 py-1.5 text-[12px] font-body font-semibold text-primary hover:bg-primary/[0.06] transition-colors">
                <FolderOpen className="h-3.5 w-3.5" /> Abrir pasta no Drive
              </button>
            )}
          </div>

          <button type="button" onClick={onOpenClient} className="inline-flex items-center gap-1 text-[11px] font-body text-muted-foreground hover:text-primary transition-colors">
            <ExternalLink className="h-3 w-3" /> Abrir no cliente pra editar mídia e roteiro
          </button>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={() => onSave({ title: title.trim() || "Post", scheduled_date: date || null, scheduled_time: time || null, caption: caption.trim() || null, approval_status: status, approval_updated_at: new Date().toISOString() })} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
