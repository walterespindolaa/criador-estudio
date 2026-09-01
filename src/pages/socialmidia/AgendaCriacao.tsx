import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { DragDropContext, Droppable, Draggable, type DropResult, type DraggableProvidedDragHandleProps } from "@hello-pangea/dnd";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { CalendarDays, Plus, X, Video, Loader2, Clock, MapPin, Users, ListChecks, ExternalLink, Send, Layers, Check, Copy, HardDrive, Download, Play, FileImage, Link2, Paperclip, GripVertical, FolderOpen, ChevronDown, Trash2, Cake, PartyPopper, Rows3, BarChart3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import {
  useCrmClients, useCrmTasks, useUpdateCrmTask, useCreateCrmTask, useDeleteCrmTask, useCrmLeads,
  CRM_TASK_PRIORITIES, CRM_TASK_PRIORITY_LABELS, CRM_TASK_STATUSES,
  type CrmTask, type CrmTaskPriority, type CrmTaskStatus,
} from "@/hooks/useCrm";
import { useDatasComemorativasDosClientes } from "@/hooks/useCronograma";
import { resolverDataComemorativa } from "@/lib/datasComemorativas";
import {
  useCreations, useAddCreation, useUpdateCreation, useDeleteCreation,
  useCaptures, useAddCapture, useUpdateCapture, useDeleteCapture, useCollaboratorNames,
  useDayOrders, useSaveDayOrder, useItemPeriods, useSaveItemPeriod,
  type Capture, type Creation, type ItemPeriods,
} from "@/hooks/useAgenda";
import { useAllExternalPosts, useExternalClients, useMoveExternalPostDate, useUpdateExternalPost, type ExternalPostWithClient, type ExternalClient } from "@/hooks/useCriaPost";
import { useCriaPostMedia, type CriaMedia } from "@/hooks/useCriaPostMedia";
import { useClientCriaAgendaPosts, useCriaClientProfiles, useManagerPublishClientPost, type ClientCriaAgendaPost, type ClientCriaLink } from "@/hooks/useManagerClientCria";
import { useManagerMaterialsWithDue, useUpdateAgendaMaterial, type AgendaMaterial } from "@/hooks/useClientMaterials";
// Relatório de produtividade da OPERAÇÃO (semana/mês): quantos posts, captações,
// tarefas... É daqui da Agenda que a produção é tocada, então o botão mora aqui.
import { RelatorioProdutividadeDialog } from "@/components/accounts/RelatorioProdutividadeDialog";
import { isDriveMedia, isDriveUrl, isVideoMedia, getThumbnailUrl, getDriveImageFallbackUrl, downloadMediaFile, mediaDownloadName } from "@/lib/driveMedia";
import { hojeBR, parseDateOnly } from "@/lib/date-br";
import { clienteInativo } from "@/lib/cliente-status";
// Data comemorativa cadastrada UMA vez aqui na agenda e espalhada pros clientes
// escolhidos. Antes ela só nascia dentro do cronograma de um cliente por vez.
import { useAgendaDatas, type AgendaData } from "@/hooks/useAgendaDatas";
import { confirmar } from "@/components/shared/Confirm";
import { nomeExibidoCliente } from "@/lib/cliente-nome";
import { useDragScroll } from "@/hooks/useDragScroll";
import { parseRefLinks, refLinkHref } from "@/lib/refLinks";
// Faixas do dia (manhã/tarde/noite). AS JANELAS DE HORÁRIO MORAM SÓ LÁ.
import { FAIXAS, FAIXA_LABEL, FAIXA_HINT, faixaDoItem, type Faixa } from "@/lib/periodos-agenda";
// Regra de cor compartilhada com a aba Tarefas do Cria Gestão (era daqui, virou util).
import { corDoItem, corDaTarefa as corDaTarefaCompartilhada } from "@/lib/cores-agenda";

// Status dos posts na agenda (mesmas cores do kanban de 5 status).
const POST_STATUS: Record<string, { label: string; cls: string }> = {
  em_producao: { label: "Produção", cls: "bg-violet-100 text-violet-700" },
  pendente: { label: "Aguardando", cls: "bg-amber-100 text-amber-700" },
  ajuste_solicitado: { label: "Ajuste", cls: "bg-orange-100 text-orange-700" },
  aprovado: { label: "Aprovado", cls: "bg-green-100 text-green-700" },
  postado: { label: "Postado", cls: "bg-slate-200 text-slate-600" },
};

// Rótulos dos estados do kanban do cliente (Tarefa B), pro pill do card. Cobre
// todas as colunas do Criando.tsx porque a Agenda agora mostra qualquer post do
// cliente COM data, inclusive os que ainda estão em coluna anterior a "Pronto".
const CRIA_POST_STATUS: Record<string, string> = { ideia: "Ideia", roteiro: "Planejamento", gravando: "Produzindo", editando: "Pronto", agendado: "Agendado", publicado: "Publicado" };
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

// Cores padrão de cada tipo, usadas só quando nem o item nem o dono dele têm cor.
// As cores padrão de tarefa (cliente/lead) e a função corDoItem moravam aqui;
// agora vêm de @/lib/cores-agenda, pra a aba Tarefas usar exatamente a mesma regra.
const CAPTURE_DEFAULT_COLOR = "#14B8A6";     // teal, captação
// Post: laranja. Só entra quando o cliente dono não tem cor cadastrada.
const POST_DEFAULT_COLOR = "#EA4918";
// Material (6º tipo): dourado/mostarda. Escolhido por não colidir com nenhuma das cores
// já usadas nos chips (roxo #4B3FA8, azul #0061EE, rosa #FF77B9, laranja #EA4918, verde #059669).
const MATERIAL_DEFAULT_COLOR = "#CA8A04";
// Aniversário (7º tipo, só LEMBRETE): magenta escuro. Distinto do rosa claro da captação
// (#FF77B9) e das outras cinco cores de chip. O card usa a cor do CLIENTE quando ela existe;
// esta aqui é só o padrão de quem não tem cor cadastrada.
const BIRTHDAY_DEFAULT_COLOR = "#BE185D";
// Roxo do sistema: precisava ser distinguível do rosa do aniversário, que é o
// outro lembrete que divide o topo do dia.
const COMEMORATIVA_COLOR = "#7C5CFC";

// Paleta oferecida na hora de cadastrar uma data. As quatro primeiras são as
// cores de TIPO que a grade já usa (comemorativa, aniversário, material, Cria do
// cliente), então a bolinha escolhida aqui já é uma cor que a pessoa reconhece de
// olhar a agenda; as três últimas vêm da paleta de tarefa, pra quem quiser separar
// uma campanha das demais. O roxo vem pré-selecionado por ser a cor que a agenda
// usa hoje pras datas comemorativas.
const DATA_COLORS = [COMEMORATIVA_COLOR, BIRTHDAY_DEFAULT_COLOR, MATERIAL_DEFAULT_COLOR, CRIA_POST_COLOR, "#0061EE", "#EA4918", "#01A652"];

/** Um cliente que tem esta data no cronograma dele. */
type ClienteDaData = { id: string; nome: string; crmId: string | null; aprovada: boolean };
/** Uma data comemorativa do dia, com todos os clientes que a pediram. */
type ComemorativaDoDia = {
  chave: string; label: string; mesTodo: boolean; clientes: ClienteDaData[];
  /** Cor escolhida por ela quando a data foi cadastrada aqui na agenda. */
  cor?: string | null;
  /** Existe quando a data nasceu aqui: é o que permite clicar e editar. */
  agendaDataId?: string;
};

/* Agrupa "Dia do Café", "dia do cafe" e "Dia do café " como a mesma data. Cada
   cliente tem o cronograma dele e digita do jeito dele; sem normalizar, a mesma
   data viraria três chips por diferença de acento ou de maiúscula. */
const chaveDaData = (label: string) =>
  label.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ");
// Paleta de cores pra tarefa (útil pra tarefa sem cliente ganhar destaque próprio).
const TASK_COLORS = ["#0061EE", "#01A652", "#EA4918", "#FF77B9", "#4B3FA8", "#F5A623", "#111827"];
// HH:MM a partir de "HH:MM:SS" (ou null).
const hhmm = (s: string | null | undefined) => (s ? s.slice(0, 5) : null);

// Item unificado do dia, pra ordenar TODOS os tipos juntos por horário e manter os
// index do @hello-pangea/dnd contíguos com a ordem renderizada.
type DayItem =
  | { kind: "cap"; time: string | null; cap: Capture }
  | { kind: "task"; time: string | null; task: CrmTask }
  | { kind: "cria"; time: string | null; cria: Creation }
  | { kind: "post"; time: string | null; post: ExternalPostWithClient }
  // 6º tipo: material com prazo (due_date). Não tem horário, então entra junto com as
  // criações no topo do dia (ordenação por "" antes de qualquer HH:MM).
  | { kind: "mat"; time: string | null; mat: AgendaMaterial };

// Chave estável de um item do dia (mesma string do draggableId): "<kind>:<id>". É por ela
// que a ordem manual do dia é persistida e reaplicada (ver buildDayItems + handleDragEnd).
function dayItemKey(item: DayItem): string {
  switch (item.kind) {
    case "cap": return `cap:${item.cap.id}`;
    case "task": return `task:${item.task.id}`;
    case "cria": return `cria:${item.cria.id}`;
    case "post": return `post:${item.post.id}`;
    case "mat": return `mat:${item.mat.id}`;
  }
}

// Monta a lista do dia ordenada. Quando há ORDEM MANUAL persistida pro dia (order = array
// de chaves "<kind>:<id>"), ela SOBREPÕE a ordem por horário: os itens presentes na ordem
// vêm primeiro na posição salva; itens novos (ainda sem posição) caem no fim, aí sim por
// horário. Sem ordem manual, mantém o comportamento antigo: itens SEM horário primeiro
// (topo), depois os COM horário em ordem crescente. Fontes de hora: captação=capture_time,
// post=scheduled_time, tarefa=due_time, criação=sem horário.
function buildDayItems(caps: Capture[], tasks: CrmTask[], cris: Creation[], posts: ExternalPostWithClient[], mats: AgendaMaterial[], order?: string[]): DayItem[] {
  const items: DayItem[] = [
    ...caps.map((c) => ({ kind: "cap" as const, time: hhmm(c.capture_time), cap: c })),
    ...tasks.map((t) => ({ kind: "task" as const, time: hhmm(t.due_time), task: t })),
    ...cris.map((c) => ({ kind: "cria" as const, time: hhmm(c.event_time ?? null), cria: c })),
    ...posts.map((p) => ({ kind: "post" as const, time: hhmm((p as { scheduled_time?: string | null }).scheduled_time), post: p })),
    ...mats.map((m) => ({ kind: "mat" as const, time: null, mat: m })),
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

// Distribui os itens JÁ ORDENADOS do dia nas quatro faixas da coluna (sem período,
// manhã, tarde, noite). Precedência da faixa: período gravado > derivado do horário >
// "sem" (ver faixaDoItem). Dentro da faixa:
//  - com ORDEM MANUAL do dia, ela manda (o Array.prototype.sort é estável, então a
//    ordem que veio do buildDayItems é preservada);
//  - sem ordem manual, quem tem horário vem primeiro em ordem crescente e quem não
//    tem hora vai depois (é o inverso do topo do dia da versão sem faixas, e é o
//    que o pedido descreve: dentro do período, o horário só desempata).
function splitFaixas(items: DayItem[], periods: ItemPeriods, ordemManual: boolean): Record<Faixa, DayItem[]> {
  const out: Record<Faixa, DayItem[]> = { sem: [], manha: [], tarde: [], noite: [] };
  for (const it of items) out[faixaDoItem(periods[dayItemKey(it)], it.time)].push(it);
  if (!ordemManual) {
    for (const f of FAIXAS) out[f].sort((a, b) => (a.time ?? "99:99").localeCompare(b.time ?? "99:99"));
  }
  return out;
}

// droppableId da grade: "YYYY-MM-DD|faixa" na semana (um Droppable por faixa),
// "YYYY-MM-DD" no mês (um Droppable por dia, sem faixas) e NO_DATE na faixa fixa
// "Em produção". Decodifica os três casos.
function parseDrop(id: string): { iso: string; faixa: Faixa | null } {
  const i = id.indexOf("|");
  if (i < 0) return { iso: id, faixa: null };
  return { iso: id.slice(0, i), faixa: id.slice(i + 1) as Faixa };
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
// REVISÃO (mobile): antes o card INTEIRO era a alça com touch-action:none. Isso travava
// a rolagem: sobre qualquer card a página não rolava nativamente, então o toque só "andava"
// depois que o long-press do dnd disparava (a sensação de travar e destravar do nada).
// Agora quem arrasta é SÓ o grip (o data-rfd-drag-handle mora nele, então a regra global
// [data-rfd-drag-handle-draggable-id]{touch-action:none} vale só pro grip). O CORPO do card
// volta a rolar nativo (sem touch-action), o tap edita, e o arraste começa pegando o grip.
// disableInteractiveElementBlocking segue ligado, então o grip dentro do <button> funciona.
const dragCardStyle: CSSProperties = { WebkitUserSelect: "none", userSelect: "none", WebkitTouchCallout: "none" };
/**
 * Campo de HORA com botão de limpar.
 * O input de hora do navegador não tem "Limpar" (o de data tem), então quem
 * colocava um horário sem querer ficava preso com ele: dava pra trocar, não
 * dava pra deixar em branco. O botão só aparece quando há valor.
 */
function HoraInput({ label, value, onChange, className }: {
  label: string; value: string; onChange: (v: string) => void; className?: string;
}) {
  return (
    <div className={cn("min-w-0", className)}>
      <div className="flex items-baseline justify-between gap-2 mb-1">
        <p className="text-[11px] font-body font-semibold text-muted-foreground uppercase">{label}</p>
        {value && (
          <button type="button" onClick={() => onChange("")}
            className="text-[11px] font-body text-muted-foreground hover:text-destructive transition-colors">
            Limpar
          </button>
        )}
      </div>
      <Input type="time" value={value} onChange={(e) => onChange(e.target.value)} className="w-full h-10" />
    </div>
  );
}

function DragGrip({ className, handleProps }: { className?: string; handleProps?: DraggableProvidedDragHandleProps }) {
  // Alvo de toque generoso no mobile (p-2 -m-2 ~ 40px) sem inflar o visual do grip.
  return (
    <span {...(handleProps ?? {})} aria-label="Arrastar para reordenar"
      onClick={(e) => e.stopPropagation()}
      className={cn("shrink-0 grid place-items-center rounded text-muted-foreground/50 cursor-grab active:cursor-grabbing touch-none p-2 -m-2 md:p-0 md:m-0 -ml-1 md:-ml-0.5", className)}>
      <GripVertical className="h-4 w-4 md:h-3.5 md:w-3.5" />
    </span>
  );
}

export default function AgendaCriacao() {
  const navigate = useNavigate();
  const [weekStart, setWeekStart] = useState(() => parseDateOnly(hojeBR()));
  // Visão: semana (padrão) ou mês. O mês usa a MESMA grade arrastável.
  const [view, setView] = useState<"semana" | "mes">(() => {
    try { return (localStorage.getItem("agenda_view") as "semana" | "mes") || "semana"; } catch { return "semana"; }
  });
  const setViewPersist = (v: "semana" | "mes") => {
    setView(v);
    try { localStorage.setItem("agenda_view", v); } catch { /* segue */ }
  };
  // Filtros por tipo de item na grade (criação, tarefa, captação, post, cria do cliente,
  // material, aniversário), persistidos.
  const [filters, setFilters] = useState<{ criacao: boolean; tarefa: boolean; capta: boolean; post: boolean; criapost: boolean; material: boolean; aniversario: boolean; comemorativa: boolean }>(() => {
    try {
      const s = JSON.parse(localStorage.getItem("agenda_filters") || "{}");
      return { criacao: s.criacao ?? true, tarefa: s.tarefa ?? true, capta: s.capta ?? true, post: s.post ?? true, criapost: s.criapost ?? true, material: s.material ?? true, aniversario: s.aniversario ?? true, comemorativa: s.comemorativa ?? true };
    } catch { return { criacao: true, tarefa: true, capta: true, post: true, criapost: true, material: true, aniversario: true, comemorativa: true }; }
  });
  const toggleFilter = (k: "criacao" | "tarefa" | "capta" | "post" | "criapost" | "material" | "aniversario" | "comemorativa") =>
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
  /* A data comemorativa aberta, quando ela tem mais de um cliente. Guarda o dia
     junto pra o título do diálogo poder dizer a data por extenso. */
  const [dataModal, setDataModal] = useState<{ iso: string; data: ComemorativaDoDia } | null>(null);
  // Relatório de produtividade (semana/mês) da operação.
  const [relatorioOpen, setRelatorioOpen] = useState(false);
  // "Períodos": ALTERNADOR ÚNICO da divisão do dia em faixas (manhã / tarde / noite).
  //
  //  DESLIGADO (padrão) = a agenda de sempre: a coluna do dia é uma LISTA PLANA, sem
  //  nenhum cabeçalho de faixa, com UM Droppable por dia e a ordem de sempre (a ordem
  //  manual do dia quando existe, senão por horário).
  //  LIGADO = o dia vira as três faixas + o topo "sem período" (um Droppable cada), e
  //  arrastar um card entre faixas GRAVA o período dele.
  //
  // O período já gravado NÃO se perde com o alternador desligado: ele continua em
  // agenda_item_period e volta a valer assim que a pessoa liga de novo. Desligado, a
  // grade simplesmente não lê esse campo.
  //
  // Preferência do APARELHO (localStorage), não do usuário no banco: é jeito de ler a
  // grade, muda por tela. A chave é NOVA porque o significado mudou; a antiga
  // (agenda_show_times, que só escondia o HH:MM) é apagada na primeira carga, senão
  // quem a tinha salva abriria num estado que não pediu.
  const [porPeriodo, setPorPeriodo] = useState<boolean>(() => {
    try {
      localStorage.removeItem("agenda_show_times");
      return localStorage.getItem("agenda_periodos") === "1";
    } catch { return false; }
  });
  const togglePorPeriodo = (v: boolean) => {
    setPorPeriodo(v);
    try { localStorage.setItem("agenda_periodos", v ? "1" : "0"); } catch { /* segue */ }
  };
  // Trava o alternador ENQUANTO um card está sendo arrastado. Alternar troca a
  // QUANTIDADE de Droppable de cada dia (1 contra 4), e o @hello-pangea/dnd mede todos
  // os Droppable no início do gesto (getInitialPublish): mudar isso no meio do arraste
  // derrubaria o arraste. Fora do arraste a troca é livre.
  const [arrastando, setArrastando] = useState(false);
  // Semana = 7 dias a partir da segunda. Mês = grade completa (segunda a domingo) cobrindo o mês do anchor.
  const days = useMemo(() => {
    if (view === "semana") {
      const dom = mondayOf(weekStart);
      return Array.from({ length: 7 }, (_, i) => { const d = new Date(dom); d.setDate(d.getDate() + i); return d; });
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
  const { data: datasComemorativas = [] } = useDatasComemorativasDosClientes();
  // Datas cadastradas AQUI na agenda (uma data, vários clientes). Não se confundem
  // com datasComemorativas acima, que são as que já vivem no cronograma de cada um.
  const { datas: agendaDatas, criar: criarData, atualizar: atualizarData, excluir: excluirData } = useAgendaDatas();
  /* A LISTA DE BAIXO mostra as PRÓXIMAS, não o histórico.
     Data que repete todo ano nunca "passa": quando o dia chega e vai embora,
     ela rola pro ano seguinte. Evento pontual (uma feira, um lançamento) some
     depois que acontece, senão a lista vira um cemitério de coisas que já
     foram e a próxima data de verdade fica soterrada embaixo. */
  const datasProximas = useMemo(() => {
    const hoje = parseDateOnly(hojeBR());
    const y = hoje.getFullYear();
    return agendaDatas
      .map((d) => {
        const [ay, am, ad] = d.dia.split("-").map(Number);
        if (!ay || !am || !ad) return null;
        let quando = new Date(y, am - 1, ad);
        if (d.repete_anual) { if (quando < hoje) quando = new Date(y + 1, am - 1, ad); }
        else { quando = new Date(ay, am - 1, ad); if (quando < hoje) return null; }
        return { d, quando };
      })
      .filter((x): x is { d: AgendaData; quando: Date } => x !== null)
      .sort((a, b) => a.quando.getTime() - b.quando.getTime());
  }, [agendaDatas]);
  const { data: crmTasks = [] } = useCrmTasks();
  const addCapture = useAddCapture();
  const updCapture = useUpdateCapture();
  const delCapture = useDeleteCapture();
  const updCreation = useUpdateCreation();
  const updTask = useUpdateCrmTask();
  const delTask = useDeleteCrmTask();
  const { data: allPosts = [] } = useAllExternalPosts();
  const { clients: extClients } = useExternalClients();
  const movePost = useMoveExternalPostDate();
  // Materiais COM PRAZO de todos os clientes do gestor (6º tipo da grade).
  const { materials: allMaterials } = useManagerMaterialsWithDue();
  const updMaterial = useUpdateAgendaMaterial();
  const qc = useQueryClient();
  // Ordem manual por dia (reordenar dentro do dia): mapa day -> array de chaves "<kind>:<id>".
  const { data: dayOrders = {} } = useDayOrders(from, to);
  const saveDayOrder = useSaveDayOrder();
  // Período (manhã/tarde/noite) gravado por item, chave "<kind>:<id>". Sem a migration
  // rodada o hook devolve {} e tudo cai no período derivado do horário.
  const { data: itemPeriods = {} } = useItemPeriods();
  const saveItemPeriod = useSaveItemPeriod();

  // Nome AO VIVO da conta Cria (mesmo padrao da lista de Clientes e do cockpit): quando o
  // external esta vinculado a um cliente do CRM que usa o Cria (cria_owner_id), pega o nome
  // atual do profile via manager_clients_cria_profiles, em vez da copia estagnada em
  // external_clients.name. Cliente sem Cria mantem o nome normal do external.
  const { data: criaProfiles } = useCriaClientProfiles();
  const crmById = useMemo(() => new Map(clients.map((c) => [c.id, c])), [clients]);

  // external_client_id -> dados do cliente (nome, cor, crm_client_id pra abrir a ficha).
  //
  // COR: vem SEMPRE do cadastro central (crm_clients.color) quando existe vínculo. Era
  // aqui a divergência que a pessoa via na agenda: tarefa, captação e material pegavam a
  // cor do CRM e o card do POST pegava external_clients.color, uma coluna diferente. Ela
  // escolhia a cor na ficha e o post continuava com a cor antiga. Agora o banco espelha
  // uma coluna na outra (gatilho) e a leitura ainda prefere o CRM, então mesmo vínculo
  // antigo que não tenha propagado aparece certo.
  const extById = useMemo(() => {
    const m = new Map<string, { name: string; color: string | null; crm_client_id: string | null }>();
    extClients.forEach((e) => {
      const corCentral = e.crm_client_id ? (crmById.get(e.crm_client_id)?.color ?? null) : null;
      m.set(e.id, { name: e.name, color: corCentral ?? e.color ?? null, crm_client_id: e.crm_client_id ?? null });
    });
    return m;
  }, [extClients, crmById]);
  const extLiveName = (e: ExternalClient) => {
    const crm = e.crm_client_id ? crmById.get(e.crm_client_id) : null;
    const live = crm?.cria_owner_id ? criaProfiles?.[crm.cria_owner_id]?.name?.trim() : null;
    // Vinculado ao CRM: apelido do gestor > nome ao vivo do Cria > name do CRM.
    // Sem vínculo, cai no nome do próprio external.
    if (crm) return nomeExibidoCliente(crm, live);
    return e.name;
  };
  // Nome exibido de um cliente do CRM na agenda (mesma regra do cockpit/lista):
  // apelido do gestor > nome ao vivo do Cria > name do CRM.
  const crmClientName = (c: { id: string; name: string; display_name?: string | null; cria_owner_id: string | null }) => {
    const live = c.cria_owner_id ? criaProfiles?.[c.cria_owner_id]?.name?.trim() : null;
    return nomeExibidoCliente(c, live);
  };

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
  const [addKind, setAddKind] = useState<"criacao" | "tarefa" | "captacao">("tarefa");
  const [capOpen, setCapOpen] = useState(false);
  const [editCap, setEditCap] = useState<Capture | null>(null);
  const [editTask, setEditTask] = useState<CrmTask | null>(null);
  const [editCreation, setEditCreation] = useState<Creation | null>(null);
  const [editPost, setEditPost] = useState<ExternalPostWithClient | null>(null);
  /* Diálogo da data da agenda. Um estado só pros dois usos: "nova" abre em branco,
     uma AgendaData abre preenchida pra editar. Com dois estados separados dava pra
     abrir os dois ao mesmo tempo e um sobrescrevia o outro. */
  const [dataDialog, setDataDialog] = useState<AgendaData | "nova" | null>(null);
  const updateExtPost = useUpdateExternalPost();
  // Card do post do Cria DO CLIENTE aberto num diálogo (antes o clique jogava
  // direto pro kanban do cliente, sem contexto nenhum).
  const [criaCard, setCriaCard] = useState<ClientCriaAgendaPost | null>(null);
  const publicarCliente = useManagerPublishClientPost();

  // Itens do dia já ordenados (mesma lista que a grade renderiza).
  const itensDoDia = (iso: string) => buildDayItems(
    capturesByDay.get(iso) ?? [], tasksByDay.get(iso) ?? [], byDay.get(iso) ?? [], postsByDay.get(iso) ?? [],
    materialsByDay.get(iso) ?? [], dayOrders[iso],
  );
  // Grava (ou limpa) o PERÍODO de um item, de forma otimista. Soltar na faixa "sem
  // período" limpa: o item volta a ser posicionado pelo horário (ou pro topo do dia).
  const aplicaPeriodo = (key: string, faixa: Faixa) => {
    const novo = faixa === "sem" ? null : faixa;
    if ((itemPeriods[key] ?? null) === novo) return;
    qc.setQueriesData<ItemPeriods>({ queryKey: ["agenda-item-period"] }, (old) => {
      const n = { ...(old ?? {}) };
      if (novo) n[key] = novo; else delete n[key];
      return n;
    });
    saveItemPeriod.mutate({ itemKey: key, period: novo });
  };
  // Persiste a ordem manual do dia a partir das chaves já distribuídas nas faixas.
  const gravaOrdem = (iso: string, keys: string[]) => {
    qc.setQueriesData<Record<string, string[]>>({ queryKey: ["agenda-day-order"] }, (old) => ({ ...(old ?? {}), [iso]: keys }));
    saveDayOrder.mutate({ day: iso, order: keys });
  };

  // Arrastar item pra outro dia: atualização otimista no cache + persistência conforme o tipo.
  const handleDragEnd = (result: DropResult) => {
    // Libera o alternador de períodos assim que o gesto acaba (inclusive drop cancelado).
    setArrastando(false);
    const { source, destination, draggableId } = result;
    if (!destination) return;
    const src = parseDrop(source.droppableId);
    const dst = parseDrop(destination.droppableId);
    // MESMO DIA: pode ser reordenar dentro da faixa OU trocar de faixa (define o período).
    // Antes o drop no mesmo dia caía aqui e retornava sem fazer nada, e como a lista era
    // ordenada por horário o card "voltava" pro lugar. Desde então gravamos uma ORDEM
    // MANUAL persistida por dia (agenda_day_order) que sobrepõe a ordem por horário.
    if (src.iso === dst.iso) {
      // A faixa "Sem data (em produção)" só agrupa; não tem ordenação manual nem período.
      if (src.iso === NO_DATE) return;
      const iso = src.iso;
      // Mês: um Droppable por dia (sem faixas). Lista plana, comportamento de sempre.
      if (src.faixa === null || dst.faixa === null) {
        if (destination.index === source.index) return;
        const keys = itensDoDia(iso).map(dayItemKey);
        if (source.index >= keys.length) return;
        const [moved] = keys.splice(source.index, 1);
        keys.splice(destination.index, 0, moved);
        gravaOrdem(iso, keys);
        return;
      }
      if (src.faixa === dst.faixa && destination.index === source.index) return;
      // Semana com faixas: recalcula as chaves faixa a faixa, tira a chave da faixa de
      // origem e insere na de destino na posição solta. O array salvo é a concatenação
      // na ORDEM DE RENDERIZAÇÃO (sem período, manhã, tarde, noite), então os índices do
      // dnd continuam contíguos com o que aparece na tela e a ordem manual não quebra.
      const bandas = splitFaixas(itensDoDia(iso), itemPeriods, !!dayOrders[iso]);
      const keys: Record<Faixa, string[]> = {
        sem: bandas.sem.map(dayItemKey), manha: bandas.manha.map(dayItemKey),
        tarde: bandas.tarde.map(dayItemKey), noite: bandas.noite.map(dayItemKey),
      };
      const at = keys[src.faixa].indexOf(draggableId);
      if (at >= 0) keys[src.faixa].splice(at, 1);
      keys[dst.faixa].splice(Math.min(destination.index, keys[dst.faixa].length), 0, draggableId);
      gravaOrdem(iso, FAIXAS.flatMap((f) => keys[f]));
      if (src.faixa !== dst.faixa) {
        aplicaPeriodo(draggableId, dst.faixa);
        toast.success(dst.faixa === "sem" ? "Período removido" : `Movido para ${FAIXA_LABEL[dst.faixa].toLowerCase()}`);
      }
      return;
    }
    const day = dst.iso; // dia de destino (ou NO_DATE)
    // Arrastar entre DIAS continua mudando a data. Se a faixa de destino for explícita,
    // o período vai junto (soltei na noite de quinta = quinta à noite).
    if (day !== NO_DATE && dst.faixa) aplicaPeriodo(draggableId, dst.faixa);
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
    } else if (kind === "mat") {
      // Arrastar um material muda o PRAZO (due_date) dele, e isso reflete no kanban de
      // Materiais do cliente. Mesma lógica de tarefa/captação; o hook já é otimista.
      updMaterial.mutate({ id, patch: { due_date: day } }, { onSuccess: ok });
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
      // Post COM data marcada cai no dia certo, INCLUSIVE "Em produção" (ex.: convertido do
      // cronograma). Quem marcou a data quer ver o post naquele dia. Só os posts SEM data
      // ficam exclusivamente na faixa "Em produção" do topo (ver producaoPosts).
      if (postClients.size > 0 && !postClients.has(p.external_client_id)) continue;
      (m.get(p.scheduled_date) ?? m.set(p.scheduled_date, []).get(p.scheduled_date)!).push(p);
    }
    return m;
  }, [allPosts, from, to, filters.post, postClients]);

  // TAREFA B Posts do Cria do CLIENTE (o kanban pessoal dele), já "prontos" em diante
  // e com data. A social mídia vê pra se organizar, sem precisar entrar no Cria de cada um.
  // Vínculo: só os clientes do CRM que têm conta Cria (cria_owner_id). Uma query só pra
  // todos (RLS is_account_member filtra o que o gestor pode ver).
  const criaLinks = useMemo<ClientCriaLink[]>(() =>
    clients
      .filter((c) => !!c.cria_owner_id)
      .map((c) => ({ criaOwnerId: c.cria_owner_id!, crmClientId: c.id, name: crmClientName(c), color: c.color })),
    // crmClientName só lê criaProfiles pra resolver o nome exibido (label); o
    // vínculo (owner/crm/cor) que alimenta a query depende mesmo é de `clients`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
  // Agrupa os posts SEM data (em produção ou não): sem dia, não teriam onde aparecer na
  // grade. Post COM data (inclusive em produção, ex.: convertido do cronograma) já cai no
  // dia certo, então sai da faixa pra não duplicar. Arrastar daqui pra um dia agenda (seta
  // a data); o arraste NÃO altera o status (post em produção arrastado continua em produção).
  const producaoPosts = useMemo(() => {
    if (!filters.post) return [] as ExternalPostWithClient[];
    return allPosts.filter((p) =>
      !p.scheduled_date
      && (postClients.size === 0 || postClients.has(p.external_client_id)));
  }, [allPosts, filters.post, postClients]);

  // Rolagem horizontal da semana no mobile: abre ancorado na coluna de HOJE.
  // A coluna é achada por data-dia (não por ref) de propósito: com "Períodos" ligado a
  // coluna é uma <div> comum e desligado ela é o nó do Droppable, cujo innerRef não pode
  // ser embrulhado num ref inline sem religar a cada render. O atributo vale nos dois.
  const weekScrollRef = useRef<HTMLDivElement | null>(null);
  // Clicar no vazio da grade e arrastar pro lado rola a semana/o mês (só mouse;
  // no toque nada muda, o dedo continua rolando nativo).
  const arrastaGrade = useDragScroll<HTMLDivElement>();
  // useCallback estável: sem isso o ref inline religaria os listeners a cada render.
  const gradeRef = useCallback((el: HTMLDivElement | null) => {
    weekScrollRef.current = el;
    arrastaGrade(el);
  }, [arrastaGrade]);
  const producaoRef = useDragScroll<HTMLDivElement>();
  const todayVisible = days.some((d) => ymd(d) === today);
  useEffect(() => {
    if (view !== "semana") return;
    const cont = weekScrollRef.current;
    if (!cont) return;
    // No desktop a grade não rola (lg:grid), então mexer no scrollLeft é inócuo lá.
    const col = cont.querySelector<HTMLElement>(`[data-dia="${today}"]`);
    // Só ancora em HOJE quando a semana exibida realmente contém hoje (senão o nó
    // pode estar defasado); do contrário, volta pro começo da semana.
    if (col && todayVisible) cont.scrollTo({ left: Math.max(0, col.offsetLeft - cont.offsetLeft - 8), behavior: "auto" });
    else cont.scrollTo({ left: 0, behavior: "auto" });
    // Reexecuta ao trocar de semana/visão (ex.: botão "Hoje").
  }, [view, weekStart, todayVisible, today]);

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
  // Cor de qualquer TAREFA: a dela, senão a do lead ou do cliente, senão o padrão.
  // A regra em si vive em @/lib/cores-agenda (mesma usada na aba Tarefas do Cria Gestão).
  const corDaTarefa = (t: CrmTask) => corDaTarefaCompartilhada(t, clients, leads);

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

  // MATERIAIS com prazo no período, por dia (due_date). Material FINALIZADO continua
  // aparecendo, RISCADO, exatamente como a agenda já trata tarefa concluída e captação
  // concluída: quem olha o dia quer ver o que fechou naquele dia, não um buraco. Quem
  // não quer ver nada de material desliga o chip "Materiais".
  const materialsByDay = useMemo(() => {
    const m = new Map<string, AgendaMaterial[]>();
    if (!filters.material) return m;
    for (const mat of allMaterials) {
      if (!mat.due_date) continue;
      if (mat.due_date < from || mat.due_date > to) continue;
      if (!clientMatches(mat.crm_client_id, null)) continue;
      (m.get(mat.due_date) ?? m.set(mat.due_date, []).get(mat.due_date)!).push(mat);
    }
    // Finalizados por último dentro do dia; o resto pela ordem que veio (due_date/created).
    for (const arr of m.values()) arr.sort((a, b) => Number(a.status === "finalizado") - Number(b.status === "finalizado"));
    return m;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allMaterials, from, to, filters.material, postClients, selectedCrmIds, selectedNames]);

  // ── ANIVERSÁRIO DO CLIENTE (7º tipo: LEMBRETE, não trabalho) ──────────────────
  // O cadastro guarda dia e mês (crm_clients.birthday grava o ano 2000 só pra caber
  // numa coluna date). O lembrete portanto RECORRE todo ano.
  //
  // Como resolvemos a recorrência: em vez de projetar "aniversário deste ano" e depois
  // tratar virada de ano, varremos os DIAS QUE A GRADE JÁ ESTÁ MOSTRANDO e comparamos
  // só "MM-DD". Cada dia da grade já carrega o ano dele, então a semana que atravessa
  // 31/12 e 01/01 funciona sozinha, sem caso especial.
  //
  // 29 DE FEVEREIRO: em ano não bissexto o lembrete cai em 28/02, senão o aniversário
  // sumiria três anos seguidos. Em ano bissexto cai no 29 mesmo, e o 28 não repete.
  const birthdaysByDay = useMemo(() => {
    const m = new Map<string, { clientId: string; nome: string; cor: string | null }[]>();
    if (!filters.aniversario) return m;
    // clienteInativo: encerramento agendado pro futuro ainda conta como ativo.
    const comAniversario = clients.filter((c) => !!c.birthday && !clienteInativo(c));
    if (comAniversario.length === 0) return m;
    for (const d of days) {
      const iso = ymd(d);
      const mmdd = iso.slice(5);                                   // "MM-DD" do dia da grade
      // Ano bissexto: 29/02 existe de verdade (senão o Date rola pra 01/03).
      const bissexto = new Date(d.getFullYear(), 1, 29).getDate() === 29;
      for (const c of comAniversario) {
        const alvo = (c.birthday ?? "").slice(5);
        const casa = alvo === mmdd || (alvo === "02-29" && mmdd === "02-28" && !bissexto);
        if (!casa) continue;
        if (!clientMatches(c.id, c.name)) continue;
        (m.get(iso) ?? m.set(iso, []).get(iso)!).push({ clientId: c.id, nome: crmClientName(c), cor: c.color });
      }
    }
    return m;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clients, days, filters.aniversario, postClients, selectedCrmIds, selectedNames]);

  /* DATAS COMEMORATIVAS DOS CLIENTES.
     A informação já existia dentro do cronograma: a social mídia monta a lista,
     manda o link, e o cliente marca quais quer trabalhar. Só que ela morria lá.
     Pra lembrar que 8 de setembro é Dia Mundial da Fisioterapia, era preciso
     abrir o cronograma daquele cliente, justo no mês em que ela já está olhando
     a agenda inteira.

     Mesma varredura do aniversário: comparo "DD/MM" com o dia da grade, sem
     ano. Data comemorativa se repete todo ano, e guardar o ano faria ela sumir
     na virada de janeiro. */
  const comemorativasByDay = useMemo(() => {
    const m = new Map<string, ComemorativaDoDia[]>();
    if (!filters.comemorativa || datasComemorativas.length === 0) return m;

    for (const d of days) {
      const iso = ymd(d);
      const ano = d.getFullYear(); const mesGrade = d.getMonth(); const diaGrade = d.getDate();
      /* AGRUPADO POR DATA, não por cliente. Dia Mundial da Fisioterapia com três
         clientes de fisio na carteira empilhava três chips iguais no mesmo dia,
         e a agenda virava uma parede de repetição. É UMA data, com N clientes
         que precisam dela: o chip é um só e diz quantos são. */
      const porData = new Map<string, ComemorativaDoDia>();
      for (const dt of datasComemorativas) {
        /* O ano vem do dia da grade, não de hoje: a Páscoa de 2026 cai em 5 de
           abril e a de 2027 em 28 de março, e quem está olhando dezembro já vê
           o ano seguinte na mesma tela. */
        const quando = resolverDataComemorativa(dt.label, dt.dia, ano);
        let mesTodo = false;
        if (quando.tipo === "dia") {
          if (quando.mes !== mesGrade || quando.dia !== diaGrade) continue;
        } else if (quando.tipo === "mes") {
          // Campanha de mês inteiro (Outubro Rosa, Novembro Azul): não é um dia,
          // então ancora no dia 1, que é quando ela precisa começar a produzir.
          if (quando.mes !== mesGrade || diaGrade !== 1) continue;
          mesTodo = true;
        } else continue;

        if (!clientMatches(dt.crmClientId ?? "", dt.clienteNome)) continue;

        const chave = chaveDaData(dt.label);
        const atual = porData.get(chave);
        const cliente = { id: dt.id, nome: dt.clienteNome, crmId: dt.crmClientId, aprovada: dt.aprovada };
        if (atual) atual.clientes.push(cliente);
        else porData.set(chave, { chave, label: dt.label, mesTodo, cor: null, clientes: [cliente] });
      }
      /* AS DATAS CADASTRADAS AQUI NA AGENDA entram no mesmo mapa das que vieram
         do cronograma. Duas origens, um chip só: pra quem está olhando o dia,
         "Dia Mundial da Fisioterapia" é uma coisa, não duas, mesmo que uma
         parte tenha nascido no cronograma de um cliente e a outra tenha sido
         cadastrada por ela aqui. */
      for (const ad of agendaDatas) {
        const [ay, am, ad2] = ad.dia.split("-").map(Number);
        if (!ay || !am || !ad2) continue;
        // repete_anual desligado é evento pontual: só acontece naquele ano.
        if (!ad.repete_anual && ay !== ano) continue;
        if (am - 1 !== mesGrade || ad2 !== diaGrade) continue;

        /* Data sem nenhum cliente marcado ainda é lembrete legítimo: ela pode
           cadastrar hoje e escolher os clientes depois. Some sozinha do filtro
           por cliente, que é o comportamento certo. */
        const doDia = ad.clientes.filter((c) => clientMatches(c.crmClientId, c.nome));
        if (ad.clientes.length > 0 && doDia.length === 0) continue;

        const chave = chaveDaData(ad.label);
        const atual = porData.get(chave);
        const novos = doDia.map((c) => ({ id: `${ad.id}:${c.crmClientId}`, nome: c.nome, crmId: c.crmClientId, aprovada: c.aprovada }));
        if (atual) {
          // Mesmo cliente vindo das duas origens conta uma vez só.
          const jaTem = new Set(atual.clientes.map((c) => c.crmId));
          for (const n of novos) if (!n.crmId || !jaTem.has(n.crmId)) atual.clientes.push(n);
          if (!atual.cor) atual.cor = ad.cor;
          atual.agendaDataId = ad.id;
        } else {
          porData.set(chave, { chave, label: ad.label, mesTodo: false, cor: ad.cor, agendaDataId: ad.id, clientes: novos });
        }
      }

      if (porData.size === 0) continue;

      const lista = [...porData.values()];
      for (const item of lista) {
        // Quem já aprovou aparece primeiro: é o compromisso que existe de verdade.
        item.clientes.sort((a, b) => Number(b.aprovada) - Number(a.aprovada) || a.nome.localeCompare(b.nome, "pt-BR"));
      }
      // Data com mais gente esperando sobe: é a que rende mais trabalho no dia.
      lista.sort((a, b) => b.clientes.filter((c) => c.aprovada).length - a.clientes.filter((c) => c.aprovada).length
        || b.clientes.length - a.clientes.length);
      m.set(iso, lista);
    }
    return m;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [datasComemorativas, agendaDatas, days, filters.comemorativa, postClients, selectedCrmIds, selectedNames]);

  // Cor do material: a do cliente dono; sem cor, o dourado padrão do tipo. Mesmo helper
  // corDoItem da captação (material não tem cor própria).
  const corDoMaterial = (mat: AgendaMaterial) => corDoItem(
    null,
    mat.crm_client_id ? clients.find((c) => c.id === mat.crm_client_id)?.color : null,
    MATERIAL_DEFAULT_COLOR,
  );
  // Cor do POST: a do cliente dono (a MESMA escolhida na ficha, ver extById); sem cor,
  // o laranja padrão do tipo. Mesma regra da captação e do material, pra o dia inteiro
  // ficar legível pela cor do cliente.
  const corDoPost = (p: ExternalPostWithClient) =>
    corDoItem(null, extById.get(p.external_client_id)?.color, POST_DEFAULT_COLOR);
  // Clicar no material leva pro cockpit do cliente na aba Materiais (rota real do ClienteHub).
  const openMaterial = (mat: AgendaMaterial) => {
    if (!mat.crm_client_id) { toast.error("Este material não está vinculado a um cliente do CRM."); return; }
    navigate(`/socialmidia/clientes/${mat.crm_client_id}/materiais`);
  };

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

  /* Quem pode ser marcado numa data. Cliente encerrado fica de fora: mandar "Dia
     Mundial da Fisioterapia" pro cronograma de quem já saiu da carteira é ruído
     puro. clienteInativo respeita encerramento agendado pro futuro, então contrato
     ainda vigente continua aparecendo aqui. */
  const clientesParaData = useMemo(
    () => clients
      .filter((c) => !clienteInativo(c))
      .map((c) => ({ id: c.id, nome: crmClientName(c) }))
      .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR")),
    // crmClientName só resolve o rótulo; quem alimenta a lista é `clients`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [clients, criaProfiles]);

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} className="pb-24 md:pb-0">
      <div className="flex items-center gap-3 mb-5">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-pink-400 grid place-items-center shadow-sm shrink-0">
          <CalendarDays className="h-5 w-5 text-white" strokeWidth={1.75} />
        </div>
        <div>
          <h1 className="text-2xl sm:text-3xl font-display font-extrabold text-foreground tracking-tight">Agenda</h1>
          <p className="text-muted-foreground font-body text-sm mt-0.5">Reuniões, tarefas e agenda de captações da semana.</p>
        </div>
      </div>

      {/* Agenda de criação */}
      <div data-tour="ag-quadro" className="rounded-2xl border border-border bg-card p-4">
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <div className="flex items-center gap-3 flex-wrap">
            <p className="text-sm font-display font-bold text-foreground">Agenda de criação</p>
            {/* data-tour="ag-filtros": alvo do passo "Filtrar por tipo" do tour da Agenda. */}
            <div data-tour="ag-filtros" className="flex items-center gap-1.5 flex-wrap">
              {([["criacao", "Reuniões", "#4B3FA8"], ["tarefa", "Tarefas", "#0061EE"], ["capta", "Captações", "#FF77B9"], ["post", "Posts", "#EA4918"], ["criapost", "Cria do cliente", CRIA_POST_COLOR], ["material", "Materiais", MATERIAL_DEFAULT_COLOR], ["aniversario", "Aniversários", BIRTHDAY_DEFAULT_COLOR], ["comemorativa", "Datas comemorativas", COMEMORATIVA_COLOR]] as const).map(([k, label, color]) => (
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
            {/* Relatório de produtividade: quanto a operação produziu na semana/no mês.
                data-tour="ag-relatorio": alvo do passo "Quanto você produziu" do tour. */}
            <Button data-tour="ag-relatorio" variant="outline" size="sm" className="h-8 px-2.5 text-xs gap-1.5" onClick={() => setRelatorioOpen(true)}>
              <BarChart3 className="h-3.5 w-3.5" /> Relatório
            </Button>
            {/* Alternador ÚNICO da divisão do dia em faixas. Desligado (padrão), o dia é
                a lista plana de sempre. Ligado, vira manhã / tarde / noite e arrastar
                entre faixas grava o período. Fica travado durante um arraste (ver
                "arrastando"). Só faz sentido na SEMANA: o mês nunca tem faixas. */}
            <div data-tour="ag-periodos"
              className={cn("inline-flex items-center gap-1.5 rounded-lg border border-border px-2 py-1 transition-opacity",
                view === "mes" && "opacity-50")}
              title={view === "mes" ? "A visão Mês não usa faixas de período" : "Divide o dia em manhã, tarde e noite"}>
              <Rows3 className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-[11px] font-body font-semibold text-muted-foreground">Períodos</span>
              <Switch checked={porPeriodo} onCheckedChange={togglePorPeriodo} disabled={arrastando || view === "mes"}
                aria-label="Dividir o dia em manhã, tarde e noite" className="scale-[0.8] origin-right" />
            </div>
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
              <Button variant="outline" size="sm" className="h-8 px-2 text-xs" onClick={() => setWeekStart(parseDateOnly(hojeBR()))}>Hoje</Button>
              <Button variant="outline" size="sm" className="h-8 w-8 p-0"
                onClick={() => setWeekStart((w) => { const n = new Date(w); view === "mes" ? n.setMonth(n.getMonth() + 1) : n.setDate(n.getDate() + 7); return n; })}>›</Button>
            </div>
          </div>
        </div>
        {extClients.length > 0 && (
          // data-tour="ag-cliente-filtro": alvo do passo "Só um cliente na tela" do
          // tour (condicional: a faixa só existe quando há cliente com Cria Post).
          <div data-tour="ag-cliente-filtro" className="mb-3 rounded-xl border border-dashed border-border bg-background/60 px-3 py-2">
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
                {extClients.map((e) => {
                  const nm = extLiveName(e);
                  return (
                  <button key={e.id} type="button" onClick={() => togglePostClient(e.id)} className={cn("flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-body font-semibold transition-colors", postClients.has(e.id) ? "border-foreground text-foreground bg-muted/40" : "bg-card border-border text-muted-foreground hover:text-foreground")}>
                    <span className="grid h-3.5 w-3.5 place-items-center rounded-full text-white text-[7px] font-bold" style={{ background: extById.get(e.id)?.color || POST_DEFAULT_COLOR }}>{nm.trim().charAt(0).toUpperCase()}</span>{nm}
                  </button>
                  );
                })}
              </div>
            )}
          </div>
        )}
        <DragDropContext onDragStart={() => setArrastando(true)} onDragEnd={handleDragEnd}>
          {/* Faixa fixa "Em produção": sempre visível, independente do período. Reúne todos
              os posts em produção (com ou sem data) + posts sem data. Arrastar um post daqui
              pra um dia agenda; arrastar de volta pra cá tira a data. */}
          {filters.post && producaoPosts.length > 0 && (
            // data-tour="ag-producao": alvo do passo "Em produção, sem data" do tour.
            <div data-tour="ag-producao" className="mb-3 rounded-xl border border-dashed border-orange-500/40 bg-orange-500/[0.04] transition-colors">
              {/* Cabeçalho recolhível (Tarefa 1): recolhido mostra só título + contagem + setinha. */}
              <button type="button" onClick={toggleProducao} aria-expanded={producaoOpen}
                className="flex items-center gap-1.5 w-full text-left px-2.5 py-2">
                <Layers className="h-3.5 w-3.5 text-orange-600" />
                <span className="text-[10px] font-body font-bold uppercase tracking-wider text-muted-foreground">Em produção</span>
                <span className="text-[9px] font-body text-muted-foreground/70 hidden sm:inline">(sem data)</span>
                <span className="text-[10px] font-body font-semibold text-muted-foreground">{producaoPosts.length}</span>
                {producaoOpen && <span className="text-[9px] font-body text-muted-foreground/70 hidden sm:inline">arraste pra um dia pra agendar</span>}
                <ChevronDown className={cn("ml-auto h-4 w-4 shrink-0 text-muted-foreground transition-transform", producaoOpen && "rotate-180")} />
              </button>
              {producaoOpen && (
                <Droppable droppableId={NO_DATE} direction="horizontal">
                  {(dp, ds) => (
                    <div ref={dp.innerRef} {...dp.droppableProps}
                      className={cn("px-2.5 pb-2.5 rounded-b-xl transition-colors", ds.isDraggingOver && "bg-primary/5 ring-2 ring-primary/40")}>
                      <div ref={producaoRef} className="flex gap-2 overflow-x-auto pb-1">
                    {producaoPosts.map((p, idx) => {
                      const cli = extById.get(p.external_client_id);
                      const st = POST_STATUS[p.approval_status ?? "em_producao"];
                      const cor = corDoPost(p);
                      return (
                        <Draggable key={`post:${p.id}`} draggableId={`post:${p.id}`} index={idx} disableInteractiveElementBlocking>
                          {(dragProvided, dragSnapshot) => (
                            <button ref={dragProvided.innerRef} {...dragProvided.draggableProps}
                              type="button" title={p.title ?? undefined} onClick={() => openPost(p)}
                              style={{ ...dragProvided.draggableProps.style, ...dragCardStyle, borderColor: `${cor}66` }}
                              className={cn("rounded-lg border bg-card px-2 py-1.5 text-left transition-colors w-[180px] shrink-0 overflow-hidden hover:brightness-95",
                                dragSnapshot.isDragging && "shadow-lg ring-2 ring-primary/40")}>
                              <div className="flex items-center gap-1" style={{ color: cor }}>
                                <DragGrip className="opacity-40" handleProps={dragProvided.dragHandleProps ?? undefined} />
                                <Send className="h-3 w-3 shrink-0" />
                                <span className="text-[10px] font-body font-bold truncate flex-1 min-w-0">{cli?.name ?? "Post"}</span>
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
          <div ref={gradeRef} className={cn(
            gridLayout
              ? "grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2"
              // Mobile: colunas espaçosas (~85vw, uma por vez com peek da próxima) e
              // scroll-snap suave; no lg vira grade de 7 sem scroll.
              : "flex gap-3 overflow-x-auto pb-2 snap-x snap-mandatory scroll-smooth lg:grid lg:grid-cols-7 lg:gap-2 lg:overflow-visible lg:pb-0",
          )}>
            {days.map((d, i) => {
              const iso = ymd(d); const list = byDay.get(iso) ?? []; const caps = capturesByDay.get(iso) ?? []; const dayTasks = tasksByDay.get(iso) ?? []; const dayPosts = postsByDay.get(iso) ?? []; const criaDay = criaPostsByDay.get(iso) ?? []; const dayMats = materialsByDay.get(iso) ?? [];
              // Aniversário NÃO entra no totalDay: é lembrete, não trabalho do dia. Se
              // entrasse, um dia com dois aniversários e nada pra fazer diria "Ver todos (2)".
              const dayBirthdays = birthdaysByDay.get(iso) ?? [];
              // Idem: lembrete, não trabalho do dia. Fora do totalDay.
              const dayComemorativas = comemorativasByDay.get(iso) ?? [];
              const totalDay = caps.length + dayTasks.length + list.length + dayPosts.length + criaDay.length + dayMats.length; const isToday = iso === today;
              // Lista única do dia, ordenada por horário (sem hora primeiro). Os index dos
              // Draggable saem daqui (0..n-1 contíguos), casando com a ordem renderizada pro dnd.
              const dayItems = buildDayItems(caps, dayTasks, list, dayPosts, dayMats, dayOrders[iso]);
              const outOfMonth = view === "mes" && d.getMonth() !== curMonth;
              // No mês mostramos o dia da semana real do dia (WD[getDay]); na semana idem.
              const showWeekday = view === "semana";
              // Classe da coluna do dia (a mesma na semana e no mês; só o tamanho muda).
              const colCls = cn("rounded-xl border p-2.5 flex flex-col gap-1.5 transition-shadow",
                gridLayout ? "min-h-[110px]" : "w-[85vw] max-w-[380px] shrink-0 snap-start lg:w-auto lg:max-w-none lg:snap-align-none min-h-[240px] lg:min-h-[280px]",
                isToday ? "border-primary bg-primary/5 ring-1 ring-primary/20" : "border-border bg-background",
                outOfMonth && "opacity-45");
              // Cabeçalho do dia (número, "Ver todos", "+"), igual nas duas visões.
              const cabecalho = (
                <div className="flex items-center justify-between px-0.5">
                  <div>
                    {showWeekday && <span className={cn("text-[11px] uppercase tracking-wider font-body font-semibold", isToday ? "text-primary" : "text-muted-foreground")}>{WD[d.getDay()]}</span>}{" "}
                    <span className={cn("text-base font-display font-bold", isToday ? "text-primary" : "text-foreground")}>{d.getDate()}</span>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {totalDay > 4 && <button onClick={() => setDayModal(iso)} className="text-[10px] font-body font-bold text-primary hover:underline" aria-label="Ver todos do dia">Ver todos ({totalDay})</button>}
                    <button onClick={() => { setAddKind("tarefa"); setAddDay(iso); }} className="text-muted-foreground hover:text-primary" aria-label="Adicionar"><Plus className="h-3.5 w-3.5" /></button>
                  </div>
                </div>
              );
              const vazio = totalDay === 0 && criaDay.length === 0 && dayBirthdays.length === 0
                ? <button onClick={() => { setAddKind("criacao"); setAddDay(iso); }} className="text-[11px] font-body text-muted-foreground/60 hover:text-primary py-1">+ cliente</button>
                : null;
              // Renderiza UM card arrastável. O índice é a posição DENTRO do Droppable em
              // que o card está (na semana, dentro da faixa; no mês, dentro do dia): sempre
              // 0..n-1 contíguos com a ordem renderizada, que é o que o dnd exige.
              const renderItem = (item: DayItem, idx: number) => {
                if (item.kind === "cap") {
                  const c = item.cap;
                  // Captação também herda a cor do cliente cadastrado; o teal
                  // vira só o padrão de quem não tem cor definida.
                  const capColor = corDoItem(
                    null,
                    c.crm_client_id ? clients.find((x) => x.id === c.crm_client_id)?.color : null,
                    CAPTURE_DEFAULT_COLOR,
                  );
                  return (
                    <Draggable key={`cap:${c.id}`} draggableId={`cap:${c.id}`} index={idx} disableInteractiveElementBlocking>
                      {(dragProvided, dragSnapshot) => {
                        const done = c.status === "concluida";
                        return (
                        <button ref={dragProvided.innerRef} {...dragProvided.draggableProps}
                          type="button" title={c.location ?? undefined}
                          onClick={() => setEditCap(c)}
                          style={{ ...dragProvided.draggableProps.style, borderColor: `${capColor}59`, borderLeftColor: capColor, borderLeftWidth: 3, background: `${capColor}${done ? "0A" : "12"}`, ...dragCardStyle }}
                          className={cn("rounded-lg border px-2 py-1.5 text-left transition-colors overflow-hidden hover:brightness-95",
                            done && "opacity-70",
                            dragSnapshot.isDragging && "shadow-lg ring-2 ring-primary/40")}>
                          <div className="flex items-center gap-1 min-w-0" style={{ color: capColor }}>
                            <DragGrip className="text-teal-700/40 dark:text-teal-300/40" handleProps={dragProvided.dragHandleProps ?? undefined} />
                            <Video className="h-3 w-3 shrink-0" />
                            {/* O HH:MM aparece SEMPRE (nos dois modos do alternador). A faixa
                                agrupa; o horário é o detalhe em que a pessoa age. Sem horário,
                                o span vira espaçador. */}
                            <span className="text-[10px] font-body font-bold flex-1 min-w-0 truncate">{item.time ?? ""}</span>
                            {/* Etiqueta fixa "Captação": mesmo padrão de pill das etiquetas de status dos posts (posição à direita/estilo). */}
                            <span className="shrink-0 text-[8.5px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: `${capColor}26`, color: capColor }}>Captação</span>
                            {/* Check pra concluir a captação: mesmo padrão do check da tarefa (círculo/quadrado
                                que alterna concluída <-> agendada). Span pra não aninhar button; stopPropagation
                                pra não abrir o editor. Alvo de toque ampliado no mobile (~40px) sem mexer no layout. */}
                            <span role="button" tabIndex={0} aria-label={done ? "Reabrir captação" : "Concluir captação"}
                              onClick={(e) => { e.stopPropagation(); updCapture.mutate({ id: c.id, patch: { status: done ? "agendada" : "concluida" } }); }}
                              className="grid shrink-0 place-items-center cursor-pointer p-2 -my-2 -ml-2 md:p-0 md:m-0">
                              <span className={cn("grid h-6 w-6 md:h-4 md:w-4 place-items-center rounded border transition-colors",
                                done ? "bg-emerald-500 border-emerald-500 text-white" : "border-current/50 hover:border-emerald-500 hover:text-emerald-600")}>
                                {done && <Check className="h-3 w-3" strokeWidth={3} />}
                              </span>
                            </span>
                          </div>
                          <p className={cn("text-[12px] font-body font-semibold leading-tight truncate", done ? "line-through text-muted-foreground" : "text-foreground")}>{nameOf(c.crm_client_id, c.client_name)}</p>
                        </button>
                        );
                      }}
                    </Draggable>
                  );
                }
                if (item.kind === "task") {
                  const t = item.task;
                  // Cor vem do helper corDaTarefa: a da própria tarefa, senão a do lead
                  // ou do cliente, senão o padrão do tipo. Lead se distingue pelo ícone.
                  const isLead = !!t.crm_lead_id;
                  const client = t.crm_client_id ? clients.find((c) => c.id === t.crm_client_id) : null;
                  const clientColor = corDaTarefa(t);
                  const who = isLead ? (leadName(t.crm_lead_id) ?? "Lead") : nameOf(t.crm_client_id, null);
                  return (
                    <Draggable key={`task:${t.id}`} draggableId={`task:${t.id}`} index={idx} disableInteractiveElementBlocking>
                      {(dragProvided, dragSnapshot) => {
                        const done = t.status === "concluida";
                        return (
                          <button ref={dragProvided.innerRef} {...dragProvided.draggableProps}
                            type="button" title={t.description ?? undefined}
                            onClick={() => setEditTask(t)}
                            className={cn("rounded-lg border px-2 py-1.5 text-left transition-colors overflow-hidden",
                              "hover:brightness-95",
                              done && "opacity-60",
                              dragSnapshot.isDragging && "shadow-lg ring-2 ring-primary/40")}
                            // Cliente: acento na cor do cliente (borda esquerda + fundo bem suave). Texto fica no foreground pra não perder contraste.
                            // Merge com draggableProps.style: sem isso o style explícito venceria o do spread e o transform do drag sumiria.
                            style={{ ...dragProvided.draggableProps.style, borderColor: `${clientColor}59`, borderLeftColor: clientColor, borderLeftWidth: 3, background: `${clientColor}12`, ...dragCardStyle }}>
                            <div className="flex items-center gap-1 min-w-0">
                              <DragGrip handleProps={dragProvided.dragHandleProps ?? undefined} />
                              {isLead
                                ? <ListChecks className="h-3 w-3 shrink-0" style={{ color: clientColor }} />
                                : <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: clientColor }} />}
                              <span className="text-[10px] font-body font-bold truncate flex-1 min-w-0 text-foreground">
                                {item.time && <span className="tabular-nums">{item.time} · </span>}
                                {isLead ? `Lead · ${who}` : who}
                              </span>
                              {/* Check pra marcar concluída (risca a tarefa). Span pra não aninhar button.
                                  No mobile o alvo de toque é ampliado com padding + margem negativa (~40px),
                                  sem mudar o tamanho visível do box nem empurrar o layout do card. */}
                              <span role="button" tabIndex={0} aria-label={done ? "Reabrir tarefa" : "Concluir tarefa"}
                                onClick={(e) => { e.stopPropagation(); updTask.mutate({ id: t.id, status: done ? "pendente" : "concluida" }); }}
                                className="grid shrink-0 place-items-center cursor-pointer p-2 -my-2 -ml-2 md:p-0 md:m-0">
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
                  // Reunião herda a cor do cliente cadastrado (fundo segue branco);
                  // o lilás é só o padrão de quem não tem cor definida.
                  const criaColor = corDoItem(
                    null,
                    c.crm_client_id ? clients.find((x) => x.id === c.crm_client_id)?.color : null,
                    "#4B3FA8",
                  );
                  return (
                    <Draggable key={`cria:${c.id}`} draggableId={`cria:${c.id}`} index={idx} disableInteractiveElementBlocking>
                      {(dragProvided, dragSnapshot) => (
                        <div ref={dragProvided.innerRef} {...dragProvided.draggableProps}
                          role="button" tabIndex={0}
                          onClick={() => setEditCreation(c)}
                          onKeyDown={(e) => { if (e.key === "Enter") setEditCreation(c); }}
                          style={{ ...dragProvided.draggableProps.style, ...dragCardStyle, borderLeftColor: criaColor }}
                          className={cn("group rounded-lg border border-l-2 border-border bg-card px-2 py-1.5 hover:bg-muted/40 transition-colors",
                            c.done && "opacity-60",
                            dragSnapshot.isDragging && "shadow-lg ring-2 ring-primary/40")}>
                          <div className="flex items-start gap-1 min-w-0">
                            <DragGrip className="mt-px" handleProps={dragProvided.dragHandleProps ?? undefined} />
                            <div className="flex-1 min-w-0">
                              <p className="text-[9px] font-body font-bold uppercase tracking-wider" style={{ color: criaColor }}>Reunião{item.time ? ` · ${item.time}` : ""}</p>
                              <p className={cn("text-[12px] font-body font-semibold leading-tight truncate", c.done ? "line-through text-muted-foreground" : "text-foreground")}>{c.title?.trim() || nameOf(c.crm_client_id, c.client_name)}</p>
                              {c.title?.trim() && <p className="text-[10px] font-body text-muted-foreground truncate">{nameOf(c.crm_client_id, c.client_name)}</p>}
                            </div>
                            {/* Check da reunião: mesmo padrão do check de tarefa/captação. */}
                            <span role="button" tabIndex={0} aria-label={c.done ? "Reabrir reunião" : "Concluir reunião"}
                              onClick={(e) => { e.stopPropagation(); updCreation.mutate({ id: c.id, patch: { done: !c.done } }); }}
                              className="grid shrink-0 place-items-center cursor-pointer p-2 -my-2 -ml-1 md:p-0 md:m-0">
                              <span className={cn("grid h-6 w-6 md:h-4 md:w-4 place-items-center rounded border transition-colors",
                                c.done ? "bg-emerald-500 border-emerald-500 text-white" : "border-current/50 hover:border-emerald-500 hover:text-emerald-600")}>
                                {c.done && <Check className="h-3 w-3" strokeWidth={3} />}
                              </span>
                            </span>
                            <button onClick={(e) => { e.stopPropagation(); delCreation.mutate(c.id); }} className="text-muted-foreground/50 hover:text-destructive shrink-0" aria-label="Remover"><X className="h-3 w-3" /></button>
                          </div>
                          {c.team && <p className="text-[10px] font-body text-muted-foreground truncate">{c.team}</p>}
                        </div>
                      )}
                    </Draggable>
                  );
                }
                if (item.kind === "mat") {
                  const mat = item.mat;
                  const matColor = corDoMaterial(mat);
                  const done = mat.status === "finalizado";
                  return (
                    <Draggable key={`mat:${mat.id}`} draggableId={`mat:${mat.id}`} index={idx} disableInteractiveElementBlocking>
                      {(dragProvided, dragSnapshot) => (
                        <button ref={dragProvided.innerRef} {...dragProvided.draggableProps}
                          type="button" title={mat.description ?? undefined}
                          onClick={() => openMaterial(mat)}
                          style={{ ...dragProvided.draggableProps.style, borderColor: `${matColor}59`, borderLeftColor: matColor, borderLeftWidth: 3, background: `${matColor}${done ? "0A" : "12"}`, ...dragCardStyle }}
                          className={cn("rounded-lg border px-2 py-1.5 text-left transition-colors overflow-hidden hover:brightness-95",
                            done && "opacity-70",
                            dragSnapshot.isDragging && "shadow-lg ring-2 ring-primary/40")}>
                          <div className="flex items-center gap-1 min-w-0" style={{ color: matColor }}>
                            <DragGrip handleProps={dragProvided.dragHandleProps ?? undefined} />
                            <Paperclip className="h-3 w-3 shrink-0" />
                            <span className="text-[10px] font-body font-bold truncate flex-1 min-w-0 text-foreground">{nameOf(mat.crm_client_id, null)}</span>
                            {/* Etiqueta fixa "Material", mesmo padrão de pill dos outros tipos. */}
                            <span className="shrink-0 text-[8.5px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: `${matColor}26`, color: matColor }}>Material</span>
                            {/* Check pra finalizar o material sem sair da agenda (igual tarefa/captação). */}
                            <span role="button" tabIndex={0} aria-label={done ? "Reabrir material" : "Finalizar material"}
                              onClick={(e) => { e.stopPropagation(); updMaterial.mutate({ id: mat.id, patch: { status: done ? "a_fazer" : "finalizado" } }); }}
                              className="grid shrink-0 place-items-center cursor-pointer p-2 -my-2 -ml-2 md:p-0 md:m-0">
                              <span className={cn("grid h-6 w-6 md:h-4 md:w-4 place-items-center rounded border transition-colors",
                                done ? "bg-emerald-500 border-emerald-500 text-white" : "border-current/50 hover:border-emerald-500 hover:text-emerald-600")}>
                                {done && <Check className="h-3 w-3" strokeWidth={3} />}
                              </span>
                            </span>
                          </div>
                          <p className={cn("text-[12px] font-body font-semibold leading-tight truncate", done ? "line-through text-muted-foreground" : "text-foreground")}>{mat.title}</p>
                        </button>
                      )}
                    </Draggable>
                  );
                }
                // post
                const p = item.post;
                const cli = extById.get(p.external_client_id);
                const posted = p.approval_status === "postado";
                const st = POST_STATUS[p.approval_status ?? "em_producao"];
                const cor = corDoPost(p);
                return (
                  <Draggable key={`post:${p.id}`} draggableId={`post:${p.id}`} index={idx} disableInteractiveElementBlocking>
                    {(dragProvided, dragSnapshot) => {
                      return (
                      <button ref={dragProvided.innerRef} {...dragProvided.draggableProps}
                        type="button" title={p.title ?? undefined} onClick={() => openPost(p)}
                        style={{ ...dragProvided.draggableProps.style, ...dragCardStyle, borderColor: `${cor}66`, background: `${cor}14` }}
                        className={cn("rounded-lg border px-2 py-1.5 text-left transition-colors w-full overflow-hidden hover:brightness-95",
                          posted && "opacity-60",
                          dragSnapshot.isDragging && "shadow-lg ring-2 ring-primary/40")}>
                        <div className="flex items-center gap-1 min-w-0" style={{ color: cor }}>
                          <DragGrip className="opacity-40" handleProps={dragProvided.dragHandleProps ?? undefined} />
                          <Send className="h-3 w-3 shrink-0" />
                          <span className="text-[10px] font-body font-bold truncate flex-1 min-w-0">{item.time && <span className="tabular-nums">{item.time} · </span>}{cli?.name ?? "Post"}</span>
                          {/* Indicador discreto: post tem link do Drive no campo Ideia/Referência
                              (o campo aceita vários links, basta um ser do Drive). */}
                          {parseRefLinks(p.reference_url).some((u) => isDriveUrl(u)) && <HardDrive className="h-3 w-3 shrink-0 opacity-70" aria-label="Tem Drive" />}
                          {/* E indicador da PASTA do Drive (campo distinto drive_folder_url). */}
                          {p.drive_folder_url && <FolderOpen className="h-3 w-3 shrink-0 text-primary opacity-80" aria-label="Tem pasta no Drive" />}
                          {st && <span className={cn("shrink-0 text-[8.5px] font-bold px-1.5 py-0.5 rounded-full", st.cls)}>{st.label}</span>}
                          {/* Check: marca o post como POSTADO (vai pra coluna Postado do kanban). */}
                          <span role="button" tabIndex={0} aria-label={posted ? "Reabrir post" : "Marcar como postado"}
                            onClick={(e) => { e.stopPropagation(); updateExtPost.mutate({ id: p.id, patch: { approval_status: posted ? "aprovado" : "postado", approval_updated_at: new Date().toISOString() } }); }}
                            style={posted ? undefined : { borderColor: `${cor}80` }}
                            className={cn("grid h-6 w-6 md:h-4 md:w-4 shrink-0 place-items-center rounded border cursor-pointer transition-colors",
                              posted ? "bg-emerald-500 border-emerald-500 text-white" : "hover:border-emerald-500 hover:text-emerald-600")}>
                            {posted && <Check className="h-3 w-3" strokeWidth={3} />}
                          </span>
                        </div>
                        <p className={cn("text-[12px] font-body font-semibold leading-tight truncate", posted ? "line-through text-muted-foreground" : "text-foreground")}>{p.title || "Post"}</p>
                      </button>
                      );
                    }}
                  </Draggable>
                );
              };
              // TAREFA B: posts do Cria do cliente (prontos+data). Só LEITURA aqui (não
              // arrastáveis, ficam FORA do índice do dnd pra não quebrar o arrastar).
              // Visualmente distintos: verde tracejado + ícone. Clicar abre o Kanban do
              // cliente na ficha dele. Como não são arrastáveis, não têm período próprio:
              // entram na faixa DERIVADA do horário deles.
              const renderCriaCard = (p: ClientCriaAgendaPost) => {
                const publicado = p.status === "publicado";
                return (
                <button key={`cria:${p.id}`} type="button" title={p.title ?? undefined}
                  onClick={() => setCriaCard(p)}
                  className={cn("rounded-lg border border-dashed px-2 py-1.5 text-left w-full overflow-hidden transition-colors hover:brightness-95", publicado && "opacity-60")}
                  style={{ borderColor: `${(p.client_color || CRIA_POST_COLOR)}80`, background: `${(p.client_color || CRIA_POST_COLOR)}0F` }}>
                  <div className="flex items-center gap-1" style={{ color: CRIA_POST_COLOR }}>
                    <Layers className="h-3 w-3 shrink-0" />
                    <span className="text-[10px] font-body font-bold truncate flex-1 text-foreground/80">
                      {p.scheduled_time && <span className="tabular-nums">{p.scheduled_time.slice(0, 5)} · </span>}{p.client_name ?? "Cliente"}
                    </span>
                    <span className="shrink-0 text-[8px] font-bold px-1.5 py-0.5 rounded-full text-white" style={{ background: CRIA_POST_COLOR }}>
                      {CRIA_POST_STATUS[p.status ?? ""] ?? "Cria"}
                    </span>
                    {/* Check: marca o post DO CLIENTE como publicado (via RPC com
                        validação de vínculo; o post é da conta do cliente). */}
                    <span role="button" tabIndex={0} aria-label={publicado ? "Reabrir post" : "Marcar como publicado"}
                      onClick={(e) => {
                        e.stopPropagation();
                        publicarCliente.mutate({ postId: p.id, publicado: !publicado }, {
                          onError: () => toast.error("Não consegui marcar. Rode o SQL da função manager_publish_client_post se ainda não rodou."),
                        });
                      }}
                      className={cn("grid h-6 w-6 md:h-4 md:w-4 shrink-0 place-items-center rounded border cursor-pointer transition-colors",
                        publicado ? "bg-emerald-500 border-emerald-500 text-white" : "border-border hover:border-emerald-500 hover:text-emerald-600")}>
                      {publicado && <Check className="h-3 w-3" strokeWidth={3} />}
                    </span>
                  </div>
                  <p className={cn("text-[12px] font-body font-semibold leading-tight truncate", publicado ? "line-through text-muted-foreground" : "text-foreground")}>{p.title || "Post"}</p>
                </button>
                );
              };
              // ANIVERSARIO: 7o tipo, LEMBRETE puro. Não é arrastável (fica fora do índice
              // do dnd, como os posts do Cria do cliente), não tem check de concluído e não
              // conta como trabalho do dia. Como é lembrete e não trabalho, não pertence a
              // período nenhum: fica sempre no topo do dia. Visual próprio: borda pontilhada,
              // bolo e a etiqueta "Lembrete", na COR DO CLIENTE. Clicar abre a ficha dele.
              /* DATA COMEMORATIVA: mesmo desenho do aniversário (lembrete, borda
                 pontilhada, fora do arrasto e fora da contagem do dia), com duas
                 diferenças que importam pra decidir o que fazer:

                 · a APROVADA pelo cliente vem preenchida, é compromisso;
                 · a que ainda está só proposta vem apagada, com "a confirmar".

                 Mostrar as duas é de propósito. Se aparecesse só a aprovada, a
                 pessoa ligava o filtro no começo do mês, não via nada (o cliente
                 ainda não abriu o link) e concluía que estava quebrado. */
              const renderComemorativa = (c: ComemorativaDoDia) => {
                const aprovados = c.clientes.filter((x) => x.aprovada).length;
                const total = c.clientes.length;
                // A cor que ela escolheu ao cadastrar; sem cor, o roxo do tipo.
                const cor = c.cor || COMEMORATIVA_COLOR;
                /* Data que ELA cadastrou não fica apagada nem diz "a confirmar".
                   Ela criou, ela sabe que quer: quem precisa confirmar alguma
                   coisa é o cliente, e isso é outro assunto. O "a confirmar"
                   existe pra data que veio do cronograma e ninguém marcou. */
                const minhaData = !!c.agendaDataId;
                /* Um cliente só: vai direto pro cronograma dele, que é o que a
                   pessoa quer fazer em seguida. Mais de um: abre a lista, porque
                   a pergunta passa a ser OUTRA ("pra quais clientes eu preciso
                   produzir isso?") e mandar pra um deles escolheria por ela.

                   Data cadastrada por ela na agenda foge da regra: ali o gesto
                   natural é editar, porque foi ela quem criou. */
                const daAgenda = !!c.agendaDataId;
                const irDireto = !daAgenda && total === 1 && c.clientes[0].crmId;
                return (
                  <button key={`com:${c.chave}`} type="button"
                    title={[
                      c.label,
                      c.mesTodo ? "campanha do mês inteiro" : null,
                      total === 1 ? c.clientes[0].nome : `${total} clientes, ${aprovados} já aprovaram`,
                    ].filter(Boolean).join(" · ")}
                    onClick={() => {
                      const minha = c.agendaDataId ? agendaDatas.find((x) => x.id === c.agendaDataId) : null;
                      if (minha) setDataDialog(minha);
                      else if (irDireto) navigate(`/socialmidia/clientes/${c.clientes[0].crmId}/cronograma`);
                      else setDataModal({ iso, data: c });
                    }}
                    className={cn(
                      "rounded-lg px-2 py-1.5 text-left w-full overflow-hidden transition-colors hover:brightness-95",
                      // Borda cheia quando é dela (é compromisso), pontilhada
                      // quando veio do cronograma e ainda é proposta.
                      minhaData ? "border" : "border border-dashed",
                      !minhaData && aprovados === 0 && "opacity-60",
                    )}
                    style={{ borderColor: `${cor}80`, background: `${cor}0F` }}>
                    <div className="flex items-center gap-1 min-w-0" style={{ color: cor }}>
                      <PartyPopper className="h-3 w-3 shrink-0" />
                      <span className="text-[10px] font-body font-bold truncate flex-1 min-w-0 text-foreground/80">
                        {total === 1 ? c.clientes[0].nome : `${total} clientes`}
                      </span>
                      <span className="shrink-0 text-[8.5px] font-bold px-1.5 py-0.5 rounded-full"
                        style={{ background: `${cor}26`, color: cor }}>
                        {c.mesTodo ? "Mês todo"
                          : minhaData ? (total === 0 ? "Data" : aprovados === total ? "Data" : `${aprovados}/${total}`)
                          : aprovados === 0 ? "A confirmar"
                          : aprovados === total ? "Data" : `${aprovados} de ${total}`}
                      </span>
                    </div>
                    <p className="text-[12px] font-body font-semibold leading-tight truncate text-foreground">{c.label}</p>
                  </button>
                );
              };

              const renderAniv = (b: { clientId: string; nome: string; cor: string | null }) => {
                const cor = b.cor || BIRTHDAY_DEFAULT_COLOR;
                return (
                  <button key={`aniv:${b.clientId}`} type="button" title={`Aniversário de ${b.nome}`}
                    onClick={() => navigate(`/socialmidia/clientes/${b.clientId}/visao-geral`)}
                    className="rounded-lg border border-dashed px-2 py-1.5 text-left w-full overflow-hidden transition-colors hover:brightness-95"
                    style={{ borderColor: `${cor}80`, background: `${cor}0F` }}>
                    <div className="flex items-center gap-1 min-w-0" style={{ color: cor }}>
                      <Cake className="h-3 w-3 shrink-0" />
                      <span className="text-[10px] font-body font-bold truncate flex-1 min-w-0 text-foreground/80">Aniversário</span>
                      <span className="shrink-0 text-[8.5px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: `${cor}26`, color: cor }}>Lembrete</span>
                    </div>
                    <p className="text-[12px] font-body font-semibold leading-tight truncate text-foreground">{b.nome}</p>
                  </button>
                );
              };
              // LISTA PLANA: UM Droppable por dia (droppableId = "YYYY-MM-DD", sem "|"), com
              // os índices 0..n-1 saindo direto do dayItems, contíguos com a ordem renderizada.
              // É o caminho usado:
              //  - SEMPRE no MÊS: a célula tem ~110px de altura, três cabeçalhos de faixa
              //    comeriam a célula inteira, e o mês serve pra saber ONDE as coisas estão,
              //    não pra desenhar o fluxo do dia;
              //  - e na SEMANA com o alternador "Períodos" DESLIGADO (o padrão), que é
              //    exatamente a agenda de antes das faixas.
              if (gridLayout || !porPeriodo) {
                return (
                  <Droppable droppableId={iso} key={iso}>
                    {(dropProvided, dropSnapshot) => (
                      // data-dia: âncora da rolagem "abrir em HOJE" (ver o useEffect). O ref
                      // fica só com o Droppable, sem wrapper inline, pra não religar a cada render.
                      <div ref={dropProvided.innerRef} data-dia={iso} {...dropProvided.droppableProps}
                        className={cn(colCls, dropSnapshot.isDraggingOver && "ring-2 ring-primary/40 border-primary/60 bg-primary/5")}>
                        {cabecalho}
                        {/* A DATA VEM ANTES DE TUDO no dia. Ela não é uma tarefa
                            entre outras: é a moldura do dia, o motivo de metade
                            do que está embaixo existir. No fim da lista ela
                            aparecia depois de dez posts e a pessoa só descobria
                            que era Dia do Nutricionista rolando até embaixo. */}
                        {dayComemorativas.map(renderComemorativa)}
                        {dayBirthdays.map(renderAniv)}
                        {dayItems.map(renderItem)}
                        {dropProvided.placeholder}
                        {criaDay.map(renderCriaCard)}
                        {vazio}
                      </div>
                    )}
                  </Droppable>
                );
              }
              // SEMANA COM "PERÍODOS" LIGADO: três faixas (manhã / tarde / noite) + o topo
              // "sem período", cada uma com seu próprio Droppable ("YYYY-MM-DD|faixa").
              // Índices continuam contíguos DENTRO de cada faixa.
              const bandas = splitFaixas(dayItems, itemPeriods, !!dayOrders[iso]);
              const criaPorFaixa: Record<Faixa, ClientCriaAgendaPost[]> = { sem: [], manha: [], tarde: [], noite: [] };
              for (const p of criaDay) criaPorFaixa[faixaDoItem(null, p.scheduled_time)].push(p);
              return (
                <div key={iso} data-dia={iso} className={colCls}>
                  {cabecalho}
                  {/* MOBILE / faixa vazia: a faixa NÃO some quando está vazia, ela COLAPSA
                      pro rótulo (uma linha de ~14px) com uma área de solta curta embaixo.
                      Não é preciosismo visual: o @hello-pangea/dnd mede TODOS os Droppable
                      no início do arraste (getInitialPublish), então faixa que só aparecesse
                      durante o arraste não seria alvo válido e o card não teria onde cair.
                      Colapsada, a faixa custa pouco (é exatamente a "linha separando manhã,
                      tarde e noite" que o pedido descreve) e continua recebendo o card. */}
                  {FAIXAS.map((f) => {
                    const its = bandas[f];
                    const cris = criaPorFaixa[f];
                    // Aniversário é lembrete: mora no topo, junto do "sem período".
                    const anivs = f === "sem" ? dayBirthdays : [];
                    const vaziaFaixa = its.length === 0 && cris.length === 0 && anivs.length === 0;
                    return (
                      <Droppable droppableId={`${iso}|${f}`} key={f}>
                        {(dp, ds) => (
                          <div ref={dp.innerRef} {...dp.droppableProps}
                            className={cn("flex flex-col gap-1.5 rounded-lg transition-colors",
                              // O topo "sem período" não tem rótulo (é só o começo da coluna):
                              // vazio, fica um respiro curto que ainda aceita o card de volta.
                              vaziaFaixa && (f === "sem" ? "min-h-[20px]" : "min-h-[30px]"),
                              // Realce por ring/fundo (não por borda): borda mudaria o tamanho
                              // da caixa no meio do arraste, e o dnd já mediu essa caixa.
                              ds.isDraggingOver && "ring-2 ring-primary/40 bg-primary/5")}>
                            {f !== "sem" && (
                              <div className="flex items-center gap-1.5 pt-0.5">
                                <span className={cn("text-[9px] font-body font-bold uppercase tracking-wider shrink-0", vaziaFaixa ? "text-muted-foreground/40" : "text-muted-foreground/80")}>{FAIXA_LABEL[f]}</span>
                                <span className="h-px flex-1 bg-border" />
                                {/* A janela de horário da faixa ("até 12:00") só no desktop:
                                    na coluna estreita do mobile ela vira ruído. */}
                                <span className="hidden lg:inline text-[8px] font-body text-muted-foreground/50 shrink-0">{FAIXA_HINT[f]}</span>
                              </div>
                            )}
                            {/* Mesma regra da coluna sem períodos: a data abre o
                                dia, na primeira faixa. */}
                            {f === "sem" && dayComemorativas.map(renderComemorativa)}
                            {f === "sem" && anivs.map(renderAniv)}
                            {its.map(renderItem)}
                            {dp.placeholder}
                            {cris.map(renderCriaCard)}
                            {f !== "sem" && anivs.map(renderAniv)}
                          </div>
                        )}
                      </Droppable>
                    );
                  })}
                  {vazio}
                </div>
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
            {/* Os três com a MESMA altura: 44px no toque, h-8 no desktop. Entrou um
                terceiro botão na linha, e um alvo maior que os vizinhos ficaria torto
                (além de 32px ser alvo curto pra dedo, que é como esta tela é usada). */}
            <Button size="sm" variant="outline" className="h-11 md:h-8" onClick={() => { setAddKind("tarefa"); setAddDay(new Date().toLocaleDateString("sv-SE")); }}><Plus className="h-3.5 w-3.5 mr-1" /> Nova tarefa</Button>
            <Button size="sm" variant="outline" className="h-11 md:h-8" onClick={() => setDataDialog("nova")}><PartyPopper className="h-3.5 w-3.5 mr-1" /> Nova data</Button>
            <Button size="sm" className="h-11 md:h-8" onClick={() => setCapOpen(true)}><Plus className="h-3.5 w-3.5 mr-1" /> Nova captação</Button>
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

        {/* DATAS COMEMORATIVAS cadastradas aqui na agenda.
            Mora nesta seção porque é daqui que ela cadastra: a lista é o lugar de
            conferir se a data já existe e de reabrir pra corrigir, sem precisar
            caçar o dia certo na grade (data de setembro em fevereiro é longe). */}
        <div className="flex items-center gap-1.5 mt-5 mb-2">
          <PartyPopper className="h-3.5 w-3.5" style={{ color: COMEMORATIVA_COLOR }} />
          <p className="text-[11px] font-body font-bold uppercase tracking-wider text-muted-foreground">Datas comemorativas</p>
          {datasProximas.length > 0 && <span className="text-[10px] font-body font-semibold text-muted-foreground">{datasProximas.length}</span>}
        </div>
        {datasProximas.length === 0 ? (
          <p className="text-[12px] font-body text-muted-foreground py-3 text-center rounded-xl border border-dashed border-border">
            Nenhuma data cadastrada. Clique em "Nova data" pra criar a primeira e marcar de quais clientes ela é assunto.
          </p>
        ) : (
          <div className="space-y-2">
            {datasProximas.map(({ d, quando: dt }) => {
              const aprovados = d.clientes.filter((c) => c.aprovada).length;
              // Sem cor escolhida, a linha usa o roxo que a grade já dá pras comemorativas.
              const cor = d.cor || COMEMORATIVA_COLOR;
              return (
                <button key={d.id} type="button" onClick={() => setDataDialog(d)}
                  className="w-full min-h-[44px] flex items-center gap-3 rounded-xl border border-border p-3 text-left flex-wrap hover:border-primary/40 transition-colors">
                  <span className="h-3.5 w-3.5 rounded-full shrink-0" style={{ background: cor }} />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-body font-semibold text-foreground truncate">{d.label}</p>
                    <div className="flex items-center gap-2 flex-wrap text-[11px] font-body text-muted-foreground">
                      {/* Repete todo ano: o ano some do rótulo, porque ele não quer dizer
                          nada ali. Evento pontual mostra o ano, que é o que o diferencia. */}
                      <span>{dt.toLocaleDateString("pt-BR", d.repete_anual ? { day: "2-digit", month: "long" } : { day: "2-digit", month: "long", year: "numeric" })}</span>
                      <span>{d.repete_anual ? "Todo ano" : "Só uma vez"}</span>
                    </div>
                    {d.nota && <p className="text-[11px] font-body text-muted-foreground/80 mt-0.5 truncate italic">{d.nota}</p>}
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0 flex-wrap">
                    <span className="text-[11px] font-body font-semibold rounded-full px-2 py-1" style={{ background: `${cor}1f`, color: cor }}>
                      {d.clientes.length === 0 ? "Sem cliente" : d.clientes.length === 1 ? "1 cliente" : `${d.clientes.length} clientes`}
                    </span>
                    {/* "Aprovou" = o cliente marcou a data no link do cronograma dele.
                        Zero aprovações não é erro: é o normal enquanto ninguém abriu o link. */}
                    <span className={cn("text-[11px] font-body font-semibold rounded-full px-2 py-1", aprovados > 0 ? "bg-green-100 text-green-700" : "bg-muted text-muted-foreground")}>
                      {aprovados === 0 ? "Ninguém aprovou" : aprovados === 1 ? "1 aprovou" : `${aprovados} aprovaram`}
                    </span>
                  </div>
                </button>
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
              const clientColor = corDaTarefa(t);
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
        onCreation={(crm, name, team, note, time, title, day) => { addCreation.mutate({ day, crm_client_id: crm, client_name: name, team, note, event_time: time, title }); setAddDay(null); }}
        onTask={(v) => { createTask.mutate(v, { onSuccess: () => toast.success("Tarefa criada.") }); setAddDay(null); }}
        onCapture={(v) => { addCapture.mutate(v); setAddDay(null); }} />

      {/* Edição de uma criação existente */}
      <AddCreationDialog open={!!editCreation} day={null} initial={editCreation} clients={clients} teamNames={teamNames}
        onClose={() => setEditCreation(null)}
        onSave={(crm, name, team, note, time, title, dia) => {
          if (editCreation) {
            updCreation.mutate({ id: editCreation.id, patch: { crm_client_id: crm, client_name: name, team, note, event_time: time, title, ...(dia ? { day: dia } : {}) } },
              { onSuccess: () => toast.success("Reunião atualizada."), onError: () => toast.error("Não consegui salvar.") });
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
        }} pending={addCapture.isPending || updCapture.isPending}
        onDelete={() => {
          if (!editCap) return;
          delCapture.mutate(editCap.id, {
            onSuccess: () => toast.success("Captação excluída."),
            onError: () => toast.error("Não consegui excluir."),
          });
          setCapOpen(false); setEditCap(null);
        }} />
      {/* Data comemorativa da agenda. O MESMO diálogo cria e edita: os campos são os
          mesmos, e ter duas telas quase iguais é como elas desandam com o tempo. */}
      <AgendaDataDialog
        open={!!dataDialog}
        initial={dataDialog === "nova" ? null : dataDialog}
        clientes={clientesParaData}
        pending={criarData.isPending || atualizarData.isPending}
        onClose={() => setDataDialog(null)}
        onSave={(v) => {
          if (dataDialog && dataDialog !== "nova") atualizarData.mutate({ id: dataDialog.id, ...v });
          else criarData.mutate(v);
          setDataDialog(null);
        }}
        onDelete={async () => {
          if (!dataDialog || dataDialog === "nova") return;
          // Confirmação de verdade (e não dois toques) porque aqui a exclusão mexe com
          // o que o cliente já viu: vale gastar uma tela explicando o que fica pra trás.
          const ok = await confirmar({
            titulo: `Excluir "${dataDialog.label}"?`,
            descricao: "A data sai da sua agenda. O que já entrou no cronograma dos clientes continua lá, porque eles podem ter planejado em cima dela.",
            acao: "Excluir",
          });
          if (!ok) return;
          excluirData.mutate(dataDialog.id);
          setDataDialog(null);
        }}
      />
      {/* Post do Cria DO CLIENTE: detalhes + marcar publicado + atalho pro kanban. */}
      <Dialog open={!!criaCard} onOpenChange={(o) => { if (!o) setCriaCard(null); }}>
        <DialogContent className="sm:max-w-md">
          {criaCard && (
            <>
              <DialogHeader>
                <DialogTitle className="font-display">{criaCard.title || "Post do cliente"}</DialogTitle>
              </DialogHeader>
              <div className="space-y-1.5 text-sm font-body text-foreground">
                <p><span className="text-muted-foreground">Cliente:</span> {criaCard.client_name ?? "-"}</p>
                <p><span className="text-muted-foreground">Quando:</span> {criaCard.scheduled_date ? new Date(criaCard.scheduled_date + "T00:00:00").toLocaleDateString("pt-BR") : "-"}{criaCard.scheduled_time ? ` às ${criaCard.scheduled_time.slice(0, 5)}` : ""}</p>
                <p><span className="text-muted-foreground">Etapa:</span> {CRIA_POST_STATUS[criaCard.status ?? ""] ?? criaCard.status ?? "-"}{criaCard.format ? ` · ${criaCard.format}` : ""}</p>

                {/* LEGENDA e MATERIAL: é o que ela realmente precisa na hora de
                    publicar. Sem isso o card era só um lembrete e obrigava a
                    abrir o kanban do cliente pra copiar o texto. */}
                {criaCard.caption?.trim() && (
                  <div className="rounded-xl border border-border bg-muted/25 p-2.5 mt-1">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span className="text-[10px] font-body font-bold uppercase tracking-wide text-muted-foreground">Legenda</span>
                      <button type="button"
                        onClick={() => { void navigator.clipboard.writeText(criaCard.caption ?? ""); toast.success("Legenda copiada!"); }}
                        className="inline-flex items-center gap-1 text-[11px] font-display font-bold text-primary hover:underline">
                        <Copy className="h-3 w-3" /> copiar
                      </button>
                    </div>
                    <p className="max-h-40 overflow-y-auto whitespace-pre-wrap text-[12.5px] font-body leading-relaxed text-foreground">{criaCard.caption}</p>
                  </div>
                )}

                {(() => {
                  // O material pode estar na pasta do Drive (campo próprio) ou
                  // nos links de referência do post. Mostra os dois caminhos.
                  const links: string[] = [];
                  if (criaCard.drive_folder_url) links.push(criaCard.drive_folder_url);
                  for (const l of parseRefLinks(criaCard.reference_url)) if (!links.includes(l)) links.push(l);
                  if (links.length === 0) return null;
                  return (
                    <div className="flex flex-wrap gap-1.5 pt-0.5">
                      {links.map((l, i) => (
                        <a key={`${l}-${i}`} href={l} target="_blank" rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-2.5 py-1.5 text-[11.5px] font-display font-bold text-foreground transition-colors hover:border-primary hover:text-primary">
                          {isDriveUrl(l) ? <HardDrive className="h-3.5 w-3.5" /> : <Link2 className="h-3.5 w-3.5" />}
                          {isDriveUrl(l) ? (i === 0 && criaCard.drive_folder_url === l ? "Pasta do Drive" : "Arquivo no Drive") : "Link do material"}
                        </a>
                      ))}
                    </div>
                  );
                })()}

                <p className="text-[11.5px] text-muted-foreground pt-1">Este post vive no Cria do próprio cliente. Você pode marcar como publicado daqui ou abrir o kanban dele pra ver tudo.</p>
              </div>
              <DialogFooter className="sm:justify-between gap-2">
                <Button
                  type="button"
                  variant={criaCard.status === "publicado" ? "outline" : "default"}
                  disabled={publicarCliente.isPending}
                  onClick={() => {
                    const alvo = criaCard.status !== "publicado";
                    publicarCliente.mutate({ postId: criaCard.id, publicado: alvo }, {
                      onSuccess: () => { toast.success(alvo ? "Marcado como publicado!" : "Post reaberto."); setCriaCard(null); },
                      onError: () => toast.error("Não consegui marcar. Confere se o SQL da manager_publish_client_post foi rodado."),
                    });
                  }}
                >
                  {publicarCliente.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4 mr-1" />}
                  {criaCard.status === "publicado" ? "Reabrir (não publicado)" : "Marcar como publicado"}
                </Button>
                <Button type="button" variant="outline" onClick={() => { const cid = criaCard.crm_client_id; setCriaCard(null); if (cid) navigate(`/socialmidia/clientes/${cid}/kanban-cliente`); }}>
                  Abrir o kanban do cliente
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      <TaskDialog task={editTask} clients={clients}
        onClose={() => setEditTask(null)}
        onOpenCrm={() => { setEditTask(null); navigate("/socialmidia/criacrm/tarefas"); }}
        onSave={(patch) => {
          if (editTask) {
            updTask.mutate({ id: editTask.id, ...patch }, { onSuccess: () => toast.success("Tarefa atualizada.") });
          }
          setEditTask(null);
        }}
        onDelete={() => {
          // Exclusao independe de ter cliente vinculado (delete por id, RLS por manager_id).
          if (editTask) delTask.mutate(editTask.id, { onSuccess: () => toast.success("Tarefa excluída.") });
          setEditTask(null);
        }} />

      <PostEditDialog post={editPost} clientName={editPost ? (extById.get(editPost.external_client_id)?.name ?? null) : null}
        onClose={() => setEditPost(null)} saving={updateExtPost.isPending}
        onSave={(patch) => { if (editPost) updateExtPost.mutate({ id: editPost.id, patch }, { onSuccess: () => { toast.success("Post atualizado."); setEditPost(null); } }); }}
        onOpenClient={() => { if (editPost) { const crm = extById.get(editPost.external_client_id)?.crm_client_id; setEditPost(null); navigate(crm ? `/socialmidia/clientes/${crm}/posts` : "/socialmidia/criapost/aprovacoes"); } }} />

      {/* Painel "Ver todos" de um dia cheio: lista tudo, cada item clicável pra editar. */}
      {/* ── A DATA COMEMORATIVA COM VÁRIOS CLIENTES ──
          A pergunta que a pessoa faz ao ver "Dia Mundial da Fisioterapia" na
          agenda não é "que data é essa", é "PRA QUEM eu preciso produzir isso".
          Este diálogo responde exatamente isso: a lista de clientes, quem já
          aprovou, e um caminho direto pro cronograma de cada um. */}
      {dataModal && (
        <Dialog open onOpenChange={(o) => { if (!o) setDataModal(null); }}>
          <DialogContent className="sm:max-w-md rounded-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="font-display flex items-center gap-2">
                <PartyPopper className="h-4 w-4 shrink-0" style={{ color: COMEMORATIVA_COLOR }} />
                {dataModal.data.label}
              </DialogTitle>
            </DialogHeader>
            <p className="text-[12px] font-body text-muted-foreground -mt-2 capitalize">
              {parseDateOnly(dataModal.iso).toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" })}
              {" · "}
              <span className="normal-case">
                {dataModal.data.clientes.filter((c) => c.aprovada).length} de {dataModal.data.clientes.length} já aprovaram
              </span>
            </p>
            <div className="space-y-1.5 mt-1">
              {dataModal.data.clientes.map((c) => (
                <button key={c.id}
                  onClick={() => { setDataModal(null); if (c.crmId) navigate(`/socialmidia/clientes/${c.crmId}/cronograma`); }}
                  disabled={!c.crmId}
                  className={cn(
                    "w-full flex items-center gap-2.5 rounded-xl border border-border p-2.5 text-left transition-colors",
                    c.crmId ? "hover:border-primary/50 hover:bg-primary/5" : "opacity-70 cursor-default",
                  )}>
                  <span className="h-2 w-2 rounded-full shrink-0"
                    style={{ background: c.aprovada ? COMEMORATIVA_COLOR : "transparent", border: `1.5px solid ${COMEMORATIVA_COLOR}` }} />
                  <span className="text-[13px] font-body font-semibold text-foreground truncate flex-1 min-w-0">{c.nome}</span>
                  <span className={cn("shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full",
                    c.aprovada ? "bg-emerald-100 text-emerald-700" : "bg-muted text-muted-foreground")}>
                    {c.aprovada ? "Aprovou" : "Sem resposta"}
                  </span>
                </button>
              ))}
            </div>
            <p className="text-[11px] font-body text-muted-foreground mt-2 leading-relaxed">
              Clique num cliente pra abrir o cronograma dele. Quem está sem resposta ainda não marcou esta data no
              link que você mandou.
            </p>
          </DialogContent>
        </Dialog>
      )}

      {dayModal && (() => {
        const iso = dayModal;
        const caps = capturesByDay.get(iso) ?? []; const tks = tasksByDay.get(iso) ?? [];
        const cri = byDay.get(iso) ?? []; const pts = postsByDay.get(iso) ?? [];
        // Posts do Cria do cliente (5o tipo): entram no modal e na contagem, iguais à célula.
        const criaCli = criaPostsByDay.get(iso) ?? [];
        // Materiais com prazo no dia (6o tipo).
        const mats = materialsByDay.get(iso) ?? [];
        // Aniversários do dia (7o tipo, so leitura).
        const anivs = birthdaysByDay.get(iso) ?? [];
        // Mesma ordenação da grade (ordem manual do dia quando houver; senão por horário).
        const items = buildDayItems(caps, tks, cri, pts, mats, dayOrders[iso]);
        const d = parseDateOnly(iso);
        const rowCls = "w-full flex items-center gap-2.5 rounded-xl border border-border p-2.5 text-left hover:border-primary/50 hover:bg-primary/5 transition-colors";
        const dot = (c: string) => <span className="h-2 w-2 rounded-full shrink-0" style={{ background: c }} />;
        // O modal segue o MESMO alternador da grade: com "Períodos" ligado ele agrupa em
        // faixas (aqui sobra altura, então mostra as três com folga); desligado é a lista
        // plana de sempre. Só leitura: reordenar/definir período continua sendo na grade,
        // arrastando.
        const bandasModal = splitFaixas(items, itemPeriods, !!dayOrders[iso]);
        const criaModal: Record<Faixa, ClientCriaAgendaPost[]> = { sem: [], manha: [], tarde: [], noite: [] };
        for (const p of criaCli) criaModal[faixaDoItem(null, p.scheduled_time)].push(p);
        const linhaItem = (item: DayItem) => {
          if (item.kind === "cria") { const c = item.cria; const cor = corDoItem(null, c.crm_client_id ? clients.find((x) => x.id === c.crm_client_id)?.color : null, "#4B3FA8"); return <button key={`c${c.id}`} onClick={() => { setDayModal(null); setEditCreation(c); }} className={rowCls}>{dot(cor)}<span className="text-[13px] font-body font-semibold text-foreground truncate">{c.title?.trim() || nameOf(c.crm_client_id, c.client_name)}</span><span className="ml-auto text-[10px] text-muted-foreground">{c.event_time ? `${c.event_time.slice(0, 5)} · ` : ""}Reunião</span></button>; }
          if (item.kind === "task") { const t = item.task; const dotColor = corDaTarefa(t); return <button key={`t${t.id}`} onClick={() => { setDayModal(null); setEditTask(t); }} className={rowCls}>{dot(dotColor)}<span className="text-[13px] font-body font-semibold text-foreground truncate">{item.time ? `${item.time} · ` : ""}{t.title}</span><span className="ml-auto text-[10px] text-muted-foreground">Tarefa</span></button>; }
          if (item.kind === "mat") { const mt = item.mat; const done = mt.status === "finalizado"; return <button key={`m${mt.id}`} onClick={() => { setDayModal(null); openMaterial(mt); }} className={rowCls}>{dot(corDoMaterial(mt))}<span className={cn("text-[13px] font-body font-semibold truncate", done ? "line-through text-muted-foreground" : "text-foreground")}>{mt.title}</span><span className="ml-auto text-[10px] text-muted-foreground shrink-0">Material</span></button>; }
          if (item.kind === "cap") { const c = item.cap; return <button key={`p${c.id}`} onClick={() => { setDayModal(null); setEditCap(c); }} className={rowCls}>{dot("#FF77B9")}<span className="text-[13px] font-body font-semibold text-foreground truncate">{nameOf(c.crm_client_id, c.client_name)}{item.time ? ` · ${item.time}` : ""}</span><span className="ml-auto text-[10px] text-muted-foreground">Captação</span></button>; }
          const p = item.post; const st = POST_STATUS[p.approval_status ?? "em_producao"]; return <button key={`o${p.id}`} onClick={() => { setDayModal(null); openPost(p); }} className={rowCls}>{dot(corDoPost(p))}<span className="text-[13px] font-body font-semibold text-foreground truncate">{item.time ? `${item.time} · ` : ""}{p.title || "Post"}</span>{st && <span className={cn("ml-auto shrink-0 text-[9px] font-bold px-1.5 py-0.5 rounded-full", st.cls)}>{st.label}</span>}</button>;
        };
        // Linhas só leitura (Cria do cliente e aniversário), usadas nos dois modos do modal.
        const linhaCria = (p: ClientCriaAgendaPost) => (
          <button key={`cc${p.id}`} onClick={() => { setDayModal(null); setCriaCard(p); }} className={rowCls}>
            {dot(CRIA_POST_COLOR)}
            <span className="text-[13px] font-body font-semibold text-foreground truncate">{p.scheduled_time ? `${p.scheduled_time.slice(0, 5)} · ` : ""}{p.title || "Post"}</span>
            <span className="ml-auto shrink-0 text-[9px] font-bold px-1.5 py-0.5 rounded-full text-white" style={{ background: CRIA_POST_COLOR }}>{CRIA_POST_STATUS[p.status ?? ""] ?? "Cria"}</span>
          </button>
        );
        const comem = comemorativasByDay.get(iso) ?? [];
        const linhaComem = (c: ComemorativaDoDia) => {
          const aprovados = c.clientes.filter((x) => x.aprovada).length;
          const total = c.clientes.length;
          return (
            <button key={`cm${c.chave}`}
              onClick={() => {
                if (total === 1 && c.clientes[0].crmId) { setDayModal(null); navigate(`/socialmidia/clientes/${c.clientes[0].crmId}/cronograma`); }
                else { setDayModal(null); setDataModal({ iso, data: c }); }
              }}
              className={cn(rowCls, !c.agendaDataId && aprovados === 0 && "opacity-70")}>
              {dot(c.cor || COMEMORATIVA_COLOR)}
              <span className="text-[13px] font-body font-semibold text-foreground truncate">{c.label}</span>
              <span className="text-[11px] text-muted-foreground truncate">
                {total === 1 ? c.clientes[0].nome : `${total} clientes`}
              </span>
              <span className="ml-auto shrink-0 text-[10px] text-muted-foreground">
                {c.mesTodo ? "Mês todo"
                  : c.agendaDataId ? (total === 0 || aprovados === total ? "Data" : `${aprovados}/${total}`)
                  : aprovados === 0 ? "A confirmar"
                  : aprovados === total ? "Data" : `${aprovados} de ${total}`}
              </span>
            </button>
          );
        };
        const linhaAniv = (b: { clientId: string; nome: string; cor: string | null }) => (
          <button key={`an${b.clientId}`} onClick={() => { setDayModal(null); navigate(`/socialmidia/clientes/${b.clientId}/visao-geral`); }} className={rowCls}>
            {dot(b.cor || BIRTHDAY_DEFAULT_COLOR)}
            <span className="text-[13px] font-body font-semibold text-foreground truncate">Aniversário de {b.nome}</span>
            <span className="ml-auto shrink-0 text-[10px] text-muted-foreground">Lembrete</span>
          </button>
        );
        return (
          <Dialog open onOpenChange={(o) => { if (!o) setDayModal(null); }}>
            <DialogContent className="sm:max-w-md rounded-2xl max-h-[80vh] overflow-y-auto">
              <DialogHeader><DialogTitle className="font-display capitalize">{d.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" })}</DialogTitle></DialogHeader>
              <p className="text-[12px] font-body text-muted-foreground -mt-2">{items.length + criaCli.length + anivs.length + comem.length} item(ns) · clique pra editar</p>
              <div className="space-y-1.5 mt-1">
                {porPeriodo ? FAIXAS.map((f) => {
                  const its = bandasModal[f];
                  const cris = criaModal[f];
                  // Aniversário é lembrete: entra no topo, junto do "sem período".
                  const ans = f === "sem" ? anivs : [];
                  if (its.length === 0 && cris.length === 0 && ans.length === 0) return null;
                  return (
                    <div key={f} className="space-y-1.5">
                      {f !== "sem" && (
                        <div className="flex items-center gap-2 pt-1.5">
                          <span className="text-[10px] font-body font-bold uppercase tracking-wider text-muted-foreground shrink-0">{FAIXA_LABEL[f]}</span>
                          <span className="h-px flex-1 bg-border" />
                        </div>
                      )}
                      {its.map(linhaItem)}
                      {/* Cria do cliente: 5o tipo, só leitura. Clicar abre o kanban do cliente. */}
                      {cris.map(linhaCria)}
                      {/* Aniversário: 7o tipo, lembrete. Clicar abre a ficha do cliente. */}
                      {ans.map(linhaAniv)}
                    </div>
                  );
                }) : (
                  // "Períodos" desligado: lista plana, na mesma ordem da coluna do dia.
                  <>
                    {items.map(linhaItem)}
                    {criaCli.map(linhaCria)}
                    {comem.map(linhaComem)}
                    {anivs.map(linhaAniv)}
                  </>
                )}
              </div>
            </DialogContent>
          </Dialog>
        );
      })()}

      {/* Relatório de produtividade da operação (semana/mês). */}
      <RelatorioProdutividadeDialog open={relatorioOpen} onOpenChange={setRelatorioOpen} />
    </motion.div>
  );
}

type Client = { id: string; name: string; display_name?: string | null };

function ClientPicker({ clients, crm, name, onCrm, onName }: { clients: Client[]; crm: string | null; name: string; onCrm: (v: string | null) => void; onName: (v: string) => void }) {
  return (
    <>
      <select value={crm ?? ""} onChange={(e) => onCrm(e.target.value || null)} className="w-full h-10 rounded-xl border border-border bg-card px-3 text-sm font-body">
        <option value="">Cliente do CRM</option>
        {clients.map((c) => <option key={c.id} value={c.id}>{nomeExibidoCliente(c)}</option>)}
      </select>
      {!crm && <Input value={name} onChange={(e) => onName(e.target.value)} placeholder="Ou nome livre" className="mt-2" />}
    </>
  );
}

function TeamDatalist({ names }: { names: string[] }) {
  return <datalist id="agenda-team-names">{names.map((n) => <option key={n} value={n} />)}</datalist>;
}

function AddCreationDialog({ open, day, initial, clients, teamNames, onClose, onSave }: { open: boolean; day: string | null; initial?: Creation | null; clients: Client[]; teamNames: string[]; onClose: () => void; onSave: (crm: string | null, name: string | null, team: string | null, note: string | null, time: string | null, title: string | null, dia: string | null) => void }) {
  const [crm, setCrm] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [team, setTeam] = useState("");
  const [note, setNote] = useState("");
  const [time, setTime] = useState("");
  const [titulo, setTitulo] = useState("");
  /* Faltava a DATA. Editando uma reunião dava pra trocar a hora, o cliente, o
     título e a nota, mas não o dia: pra remarcar, a pessoa precisava apagar e
     criar de novo, perdendo a nota. O dia já vinha no `initial`, só não tinha
     campo. */
  const [dia, setDia] = useState("");
  const seed = open ? `${day ?? ""}:${initial?.id ?? "new"}` : "";
  const [seeded, setSeeded] = useState("");
  if (open && seed !== seeded) { setSeeded(seed); setCrm(initial?.crm_client_id ?? null); setName(initial?.client_name ?? ""); setTeam(initial?.team ?? ""); setNote(initial?.note ?? ""); setTime(initial?.event_time ? initial.event_time.slice(0, 5) : ""); setTitulo(initial?.title ?? ""); setDia(initial?.day ?? day ?? ""); }
  if (!open && seeded) setSeeded("");
  const valid = !!crm || name.trim();
  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader><DialogTitle className="font-display">{initial ? "Editar reunião" : "Nova reunião"}</DialogTitle></DialogHeader>
        <div className="space-y-2">
          <ClientPicker clients={clients} crm={crm} name={name} onCrm={setCrm} onName={setName} />
          <div>
            <p className="text-[11px] font-body font-semibold text-muted-foreground uppercase tracking-wider mb-1">Título (opcional)</p>
            <Input value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Ex.: Alinhamento mensal" />
          </div>
          <div className="flex gap-2 flex-wrap items-end">
            <div>
              <p className="text-[11px] font-body font-semibold text-muted-foreground uppercase tracking-wider mb-1">Dia</p>
              <Input type="date" value={dia} onChange={(e) => setDia(e.target.value)} className="w-[165px]" />
            </div>
            <HoraInput label="Hora (opcional)" value={time} onChange={setTime} className="w-[140px]" />
          </div>
          <div>
            <p className="text-[11px] font-body font-semibold text-muted-foreground uppercase tracking-wider mb-1">Equipe (opcional)</p>
            <Input value={team} onChange={(e) => setTeam(e.target.value)} placeholder="Ex.: Ana, Bruno" list="agenda-team-names" />
            <TeamDatalist names={teamNames} />
          </div>
          <div>
            <p className="text-[11px] font-body font-semibold text-muted-foreground uppercase tracking-wider mb-1">Notas (opcional)</p>
            <Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ex.: pauta do alinhamento, assuntos do mês…" className="rounded-xl text-sm" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={() => onSave(crm, name.trim() || null, team.trim() || null, note.trim() || null, time || null, titulo.trim() || null, dia || null)} disabled={!valid}>{initial ? "Salvar" : "Adicionar"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// "+" do dia: primeiro escolhe O QUE é (criação / tarefa / captação), depois preenche.
function AddAnyDialog({ open, day, clients, teamNames, onClose, onCreation, onTask, onCapture, initialKind = "tarefa" }: {
  open: boolean; day: string | null; clients: Client[]; teamNames: string[]; onClose: () => void;
  initialKind?: "tarefa" | "captacao" | "criacao";
  onCreation: (crm: string | null, name: string | null, team: string | null, note: string | null, time: string | null, title: string | null, day: string) => void;
  onTask: (v: { title: string; description: string | null; crm_client_id: string | null; priority: CrmTaskPriority; status: CrmTaskStatus; due_date: string; due_time: string | null; color: string | null }) => void;
  onCapture: (v: { capture_date: string; capture_time?: string | null; location?: string | null; crm_client_id?: string | null; client_name?: string | null; team?: string | null; note?: string | null; duration_hours?: number | null }) => void;
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
  const [dur, setDur] = useState<number | null>(null); // duracao da captacao (horas)
  const [date, setDate] = useState(""); // data do item (padrao o dia clicado, mas editavel)
  const [taskCol, setTaskCol] = useState<string | null>(null); // cor opcional da tarefa
  const [seeded, setSeeded] = useState("");

  if (open && day && seeded !== day) {
    setSeeded(day);
    setKind(initialKind); setCrm(null); setName(""); setTeam(""); setNote(""); setTitle(""); setPrio("media"); setTime(""); setLoc(""); setDur(null); setDate(day); setTaskCol(null);
  }
  if (!open && seeded) setSeeded("");

  const hasClient = !!crm || !!name.trim();
  const valid = (kind === "tarefa" ? !!title.trim() : hasClient) && !!date;

  const submit = () => {
    const d = date || day;
    if (!d) return;
    if (kind === "criacao") onCreation(crm, name.trim() || null, team.trim() || null, note.trim() || null, time || null, title.trim() || null, d);
    else if (kind === "tarefa") onTask({ title: title.trim(), description: note.trim() || null, crm_client_id: crm, priority: prio, status: "pendente", due_date: d, due_time: time || null, color: taskCol });
    else onCapture({ capture_date: d, capture_time: time || null, location: loc.trim() || null, crm_client_id: crm, client_name: name.trim() || null, team: team.trim() || null, note: note.trim() || null, duration_hours: dur });
  };

  // Ordem das abas: Tarefa primeiro (aba default), depois Captação e Criação.
  const KINDS = [
    { k: "tarefa", label: "Tarefa" },
    { k: "captacao", label: "Captação" },
    { k: "criacao", label: "Reunião" },
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
            <>
              <div>
                <p className="text-[11px] font-body font-semibold text-muted-foreground uppercase mb-1">Tarefa *</p>
                <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="O que precisa ser feito" />
              </div>
              <div>
                <p className="text-[11px] font-body font-semibold text-muted-foreground uppercase mb-1">Cor</p>
                <div className="flex flex-wrap items-center gap-1.5">
                  <button type="button" onClick={() => setTaskCol(null)}
                    className={cn("h-7 w-7 rounded-full border grid place-items-center text-muted-foreground transition-colors", !taskCol ? "border-foreground" : "border-border hover:border-foreground/40")}
                    aria-label="Sem cor" title="Sem cor"><X className="h-3.5 w-3.5" /></button>
                  {TASK_COLORS.map((hex) => (
                    <button key={hex} type="button" onClick={() => setTaskCol(hex)}
                      className={cn("h-7 w-7 rounded-full border-2 transition-transform", taskCol === hex ? "border-foreground scale-110" : "border-transparent hover:scale-105")}
                      style={{ background: hex }} aria-label={`Cor ${hex}`} title={hex} />
                  ))}
                </div>
              </div>
            </>
          )}

          {/* Data do item (padrao o dia clicado, mas da pra mudar aqui). */}
          <div>
            <p className="text-[11px] font-body font-semibold text-muted-foreground uppercase mb-1">Data</p>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>

          <ClientPicker clients={clients} crm={crm} name={name} onCrm={setCrm} onName={setName} />

          {kind === "criacao" && (
            <>
              <div>
                <p className="text-[11px] font-body font-semibold text-muted-foreground uppercase mb-1">Título (opcional)</p>
                <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex.: Alinhamento mensal" />
              </div>
              <HoraInput label="Hora (opcional)" value={time} onChange={setTime} className="w-[140px]" />
            </>
          )}

          {kind === "captacao" && (
            // Hora e Local lado a lado; abaixo de ~390px empilha pra nenhum espremer o outro.
            // O valor da hora alinha à esquerda / não corta pela regra global do index.css.
            <div className="flex gap-2 max-[390px]:flex-col">
              <HoraInput label="Hora" value={time} onChange={setTime} className="w-[120px] shrink-0 max-[390px]:w-full" />
              <div className="flex-1 min-w-0"><p className="text-[11px] font-body font-semibold text-muted-foreground uppercase mb-1">Local (opcional)</p><Input value={loc} onChange={(e) => setLoc(e.target.value)} placeholder="Ex.: Estúdio" className="h-10" /></div>
            </div>
          )}

          {kind === "captacao" && (
          <div>
            <p className="text-[11px] font-body font-semibold text-muted-foreground uppercase mb-1">Duração (opcional)</p>
            <div className="flex flex-wrap gap-1.5">
              {[1, 2, 3, 4, 5].map((h) => (
                <button key={h} type="button" onClick={() => setDur(dur === h ? null : h)}
                  className={cn("h-8 px-3 rounded-full border text-xs font-body font-semibold transition-colors",
                    dur === h ? "border-primary bg-primary/[0.08] text-primary" : "border-border text-muted-foreground hover:border-primary/40")}>
                  {h >= 5 ? "+5h" : `${h}h`}
                </button>
              ))}
            </div>
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
                <HoraInput label="Hora" value={time} onChange={setTime} />
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

function CaptureDialog({ open, initial, clients, teamNames, onClose, onSave, pending, onDelete }: { open: boolean; initial?: Capture | null; clients: Client[]; teamNames: string[]; onClose: () => void; onSave: (v: { capture_date: string; capture_time?: string | null; location?: string | null; crm_client_id?: string | null; client_name?: string | null; team?: string | null; note?: string | null; status?: Capture["status"]; duration_hours?: number | null }) => void; pending: boolean; onDelete?: () => void }) {
  // Excluir em dois toques (arma e confirma), igual à tarefa: agendou errado,
  // apaga dali mesmo em vez de caçar o X na lista de próximas captações.
  const [confirmDel, setConfirmDel] = useState(false);
  const [crm, setCrm] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [loc, setLoc] = useState("");
  const [dur, setDur] = useState<number | null>(null);
  const [team, setTeam] = useState("");
  const [note, setNote] = useState("");
  const [status, setStatus] = useState<Capture["status"]>("agendada");
  const seed = open ? (initial?.id ?? "new") : "";
  const [seeded, setSeeded] = useState("");
  if (open && seed !== seeded) {
    setSeeded(seed);
    setCrm(initial?.crm_client_id ?? null); setName(initial?.client_name ?? "");
    setDate(initial?.capture_date ?? ""); setTime(initial?.capture_time ? initial.capture_time.slice(0, 5) : "");
    setLoc(initial?.location ?? ""); setDur(initial?.duration_hours ?? null); setTeam(initial?.team ?? ""); setNote(initial?.note ?? ""); setStatus(initial?.status ?? "agendada");
    setConfirmDel(false);
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
            <HoraInput label="Hora" value={time} onChange={setTime} />
          </div>
          <div><p className="text-[11px] font-body font-semibold text-muted-foreground uppercase mb-1">Local (opcional)</p><Input value={loc} onChange={(e) => setLoc(e.target.value)} placeholder="Ex.: Estúdio, coworking, local externo" /></div>
          <div>
            <p className="text-[11px] font-body font-semibold text-muted-foreground uppercase mb-1">Duração (opcional)</p>
            <div className="flex flex-wrap gap-1.5">
              {[1, 2, 3, 4, 5].map((h) => (
                <button key={h} type="button" onClick={() => setDur(dur === h ? null : h)}
                  className={cn("h-8 px-3 rounded-full border text-xs font-body font-semibold transition-colors",
                    dur === h ? "border-primary bg-primary/[0.08] text-primary" : "border-border text-muted-foreground hover:border-primary/40")}>
                  {h >= 5 ? "+5h" : `${h}h`}
                </button>
              ))}
            </div>
          </div>
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
        <DialogFooter className="sm:justify-between gap-2">
          {initial && onDelete ? (
            <Button
              type="button"
              variant="ghost"
              className={cn("gap-1.5", confirmDel ? "text-destructive-foreground bg-destructive hover:bg-destructive/90" : "text-destructive hover:text-destructive")}
              onClick={() => { if (confirmDel) onDelete(); else setConfirmDel(true); }}
            >
              <Trash2 className="h-4 w-4" /> {confirmDel ? "Confirmar exclusão" : "Excluir"}
            </Button>
          ) : <span />}
          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={onClose}>Cancelar</Button>
            <Button onClick={() => onSave({ capture_date: date, capture_time: time || null, location: loc.trim() || null, crm_client_id: crm, client_name: name.trim() || null, team: team.trim() || null, note: note.trim() || null, duration_hours: dur, ...(initial ? { status } : {}) })} disabled={!valid || pending}>
              {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : initial ? "Salvar" : "Agendar"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ────────────────────────────────────────────────────────────────────────────
   DATA COMEMORATIVA DA AGENDA (cria e edita)

   O formulário em si é banal: nome, dia, cor, nota. O que faz este diálogo
   existir é a lista de CLIENTES. "Dia Mundial da Fisioterapia" não é assunto de
   um cliente, é assunto de todos os fisioterapeutas da carteira, e até aqui a
   única porta de entrada era o cronograma de UM cliente por vez: ela repetia a
   mesma data cliente a cliente e quem ela esquecia perdia a data.
   ──────────────────────────────────────────────────────────────────────────── */
function AgendaDataDialog({ open, initial, clientes, onClose, onSave, onDelete, pending }: {
  open: boolean;
  initial?: AgendaData | null;
  /** Clientes ativos do CRM, com o nome exibido já resolvido pelo pai. */
  clientes: { id: string; nome: string }[];
  onClose: () => void;
  onSave: (v: { label: string; dia: string; repete_anual: boolean; no_cronograma: boolean; cor: string | null; nota: string | null; clientes: string[] }) => void;
  onDelete: () => void;
  pending: boolean;
}) {
  const [label, setLabel] = useState("");
  const [dia, setDia] = useState("");
  const [repete, setRepete] = useState(true);
  const [noCronograma, setNoCronograma] = useState(true);
  const [cor, setCor] = useState<string>(DATA_COLORS[0]);
  const [nota, setNota] = useState("");
  const [marcados, setMarcados] = useState<Set<string>>(new Set());
  const [busca, setBusca] = useState("");
  // Mesma "semeadura" dos outros diálogos daqui: só repovoa quando MUDA o que está
  // aberto. Repovoar a cada render apagaria o que a pessoa acabou de digitar.
  const seed = open ? (initial?.id ?? "nova") : "";
  const [seeded, setSeeded] = useState("");
  if (open && seed !== seeded) {
    setSeeded(seed);
    setLabel(initial?.label ?? "");
    setDia(initial?.dia ?? "");
    setRepete(initial?.repete_anual ?? true);
    setNoCronograma(initial?.no_cronograma ?? true);
    setCor(initial?.cor || DATA_COLORS[0]);
    setNota(initial?.nota ?? "");
    setMarcados(new Set((initial?.clientes ?? []).map((c) => c.crmClientId)));
    setBusca("");
  }
  if (!open && seeded) setSeeded("");

  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return q ? clientes.filter((c) => c.nome.toLowerCase().includes(q)) : clientes;
  }, [clientes, busca]);
  /* "Marcar todos" age só no que está VISÍVEL. Com a busca preenchida, ele vira o
     atalho de marcar um segmento inteiro de uma vez (digita "fisio", marca todos),
     que é exatamente o trabalho que este diálogo veio resolver. */
  const todosMarcados = filtrados.length > 0 && filtrados.every((c) => marcados.has(c.id));
  const alternarTodos = () => setMarcados((prev) => {
    const n = new Set(prev);
    for (const c of filtrados) { if (todosMarcados) n.delete(c.id); else n.add(c.id); }
    return n;
  });
  const alternarCliente = (id: string) => setMarcados((prev) => {
    const n = new Set(prev);
    if (n.has(id)) n.delete(id); else n.add(id);
    return n;
  });

  const valido = !!label.trim() && !!dia;
  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle className="font-display">{initial ? "Editar data" : "Nova data"}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <p className="text-[11px] font-body font-semibold text-muted-foreground uppercase mb-1">Nome da data</p>
            <Input value={label} onChange={(e) => setLabel(e.target.value)} className="h-11" placeholder="Ex.: Dia Mundial da Fisioterapia" />
          </div>
          <div>
            <p className="text-[11px] font-body font-semibold text-muted-foreground uppercase mb-1">Dia</p>
            <Input type="date" value={dia} onChange={(e) => setDia(e.target.value)} className="w-full h-11" />
          </div>

          {/* Repetir todo ano: é o campo que separa data comemorativa de evento, e
              ninguém adivinha isso pelo nome do interruptor, então a linha explica. */}
          <div className="flex items-start justify-between gap-3 rounded-xl border border-border p-3">
            <div className="min-w-0">
              <p className="text-sm font-body font-semibold text-foreground">Repetir todo ano</p>
              <p className="text-[11px] font-body text-muted-foreground mt-0.5 leading-relaxed">
                Ligado: data comemorativa de verdade, volta no mesmo dia todo ano. Desligado: evento pontual, acontece uma vez e não volta.
              </p>
            </div>
            <Switch checked={repete} onCheckedChange={setRepete} className="mt-0.5 shrink-0" />
          </div>

          {/* Cor: bolinha de 28px dentro de um botão de 44px. O alvo de toque é o
              botão inteiro, então dá pra acertar no celular sem inflar o visual. */}
          <div>
            <p className="text-[11px] font-body font-semibold text-muted-foreground uppercase mb-1">Cor</p>
            <div className="flex flex-wrap items-center gap-1">
              {DATA_COLORS.map((hex) => (
                <button key={hex} type="button" onClick={() => setCor(hex)} aria-label={`Cor ${hex}`} title={hex}
                  className="grid h-11 w-11 place-items-center rounded-full">
                  <span className={cn("h-7 w-7 rounded-full border-2 transition-transform", cor === hex ? "border-foreground scale-110" : "border-transparent hover:scale-105")}
                    style={{ background: hex }} />
                </button>
              ))}
            </div>
          </div>

          {/* MANDAR PRO CLIENTE OU NÃO.
              Nem toda data é pergunta pro cliente. "Dia do Cliente" é lembrete
              dela pra preparar alguma coisa; "Dia Mundial da Fisioterapia" é
              pauta que ele decide se quer. Sem esta chave, tudo ia parar no link
              do cliente e ele recebia pergunta que não era dele. */}
          <label className="flex items-start gap-2.5 rounded-xl border border-border p-3 cursor-pointer">
            <Switch checked={noCronograma} onCheckedChange={setNoCronograma} className="mt-0.5 shrink-0" />
            <span className="min-w-0">
              <span className="block text-[13px] font-body font-semibold text-foreground">Mandar pro cronograma dos clientes</span>
              <span className="block text-[11.5px] font-body text-muted-foreground leading-relaxed mt-0.5">
                {noCronograma
                  ? "A data entra no cronograma de quem você marcar, e o cliente decide no link se quer trabalhar ela."
                  : "Fica só na sua agenda. O cliente não vê e não precisa aprovar nada."}
              </span>
            </span>
          </label>

          {/* Clientes: o coração do diálogo. */}
          <div>
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <p className="text-[11px] font-body font-semibold text-muted-foreground uppercase">
                Clientes{marcados.size > 0 ? ` · ${marcados.size === 1 ? "1 marcado" : `${marcados.size} marcados`}` : ""}
              </p>
              <button type="button" onClick={alternarTodos} disabled={filtrados.length === 0}
                className="min-h-[44px] -mr-2 px-2 text-[11px] font-body font-semibold text-primary hover:underline disabled:opacity-40">
                {todosMarcados ? "Desmarcar todos" : "Marcar todos"}
              </button>
            </div>
            {/* Busca só quando a carteira é grande: com poucos clientes ela é um campo
                a mais pra ignorar. Acima disso, rolar a lista atrás de um nome cansa. */}
            {clientes.length > 8 && (
              <Input value={busca} onChange={(e) => setBusca(e.target.value)} className="h-11 mb-1.5" placeholder="Buscar cliente pelo nome" />
            )}
            <div className="rounded-xl border border-border divide-y divide-border max-h-56 overflow-y-auto">
              {filtrados.length === 0 ? (
                <p className="text-[12px] font-body text-muted-foreground text-center py-4">
                  {clientes.length === 0 ? "Nenhum cliente ativo na carteira." : "Nenhum cliente com esse nome."}
                </p>
              ) : filtrados.map((c) => {
                const on = marcados.has(c.id);
                return (
                  <button key={c.id} type="button" onClick={() => alternarCliente(c.id)}
                    className="w-full min-h-[44px] flex items-center gap-2.5 px-3 py-2 text-left hover:bg-muted/40 transition-colors">
                    <span className={cn("grid h-5 w-5 shrink-0 place-items-center rounded-md border-2 transition-colors",
                      on ? "border-primary bg-primary text-primary-foreground" : "border-border")}>
                      {on && <Check className="h-3.5 w-3.5" strokeWidth={3} />}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-sm font-body text-foreground">{c.nome}</span>
                  </button>
                );
              })}
            </div>
            {/* Aviso honesto: a função do banco procura o cronograma vivo de cada
                cliente (o mais recente que não foi arquivado) e pula quem não tem
                nenhum, de propósito, pra não criar cronograma fantasma. Sem este
                aviso a pessoa marca dez clientes e não entende por que só sete
                receberam a data. */}
            <p className="text-[11px] font-body text-muted-foreground mt-1.5 leading-relaxed">
              A data entra no cronograma vivo de cada cliente marcado, pra ele aprovar no link. Quem não tem cronograma aberto fica de fora: nenhum cronograma novo é criado só pra abrigar a data.
            </p>
          </div>

          <div>
            <p className="text-[11px] font-body font-semibold text-muted-foreground uppercase mb-1">Nota (opcional)</p>
            <Textarea rows={2} value={nota} onChange={(e) => setNota(e.target.value)} className="rounded-xl text-sm"
              placeholder="Ex.: puxar depoimento de paciente, gravar antes do feriado" />
          </div>
        </div>
        <DialogFooter className="sm:justify-between gap-2">
          {initial ? (
            <Button type="button" variant="ghost" onClick={onDelete}
              className="h-11 gap-1.5 text-destructive hover:text-destructive hover:bg-destructive/10">
              <Trash2 className="h-4 w-4" /> Excluir
            </Button>
          ) : <span />}
          <div className="flex gap-2 justify-end">
            <Button variant="outline" className="h-11" onClick={onClose}>Cancelar</Button>
            <Button className="h-11" disabled={!valido || pending}
              onClick={() => onSave({ label: label.trim(), dia, repete_anual: repete, no_cronograma: noCronograma, cor, nota: nota.trim() || null, clientes: [...marcados] })}>
              {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : initial ? "Salvar" : "Criar data"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Edição rápida da tarefa do CRM direto da grade, sem sair da Agenda.
function TaskDialog({ task, clients, onClose, onOpenCrm, onSave, onDelete }: {
  task: CrmTask | null;
  clients: Client[];
  onClose: () => void;
  onOpenCrm: () => void;
  onSave: (patch: { title: string; description: string | null; priority: CrmTaskPriority; status: CrmTaskStatus; due_date: string | null; due_time: string | null; crm_client_id: string | null; color: string | null }) => void;
  onDelete: () => void;
}) {
  const open = !!task;
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [prio, setPrio] = useState<CrmTaskPriority>("media");
  const [status, setStatus] = useState<CrmTaskStatus>("pendente");
  const [due, setDue] = useState("");
  const [dueTime, setDueTime] = useState("");
  // Cliente vinculado, editavel aqui: permite vincular/trocar/desvincular mesmo em tarefa
  // criada sem cliente. Guarda em crm_client_id.
  const [clientId, setClientId] = useState<string | null>(null);
  // Cor opcional da tarefa (destaque próprio, principalmente pra tarefa sem cliente).
  const [color, setColor] = useState<string | null>(null);
  // Confirmacao leve do excluir (dois toques): primeiro clique arma, segundo confirma.
  const [confirmDel, setConfirmDel] = useState(false);
  const [seeded, setSeeded] = useState("");
  if (open && task && seeded !== task.id) {
    setSeeded(task.id);
    setTitle(task.title); setDesc(task.description ?? "");
    setPrio(task.priority); setStatus(task.status); setDue(task.due_date ?? ""); setDueTime(task.due_time ? task.due_time.slice(0, 5) : "");
    setClientId(task.crm_client_id ?? null); setColor(task.color ?? null); setConfirmDel(false);
  }
  if (!open && seeded) setSeeded("");
  // Tarefa de LEAD nao troca de cliente por aqui (o vinculo dela e com o lead).
  const isLead = !!task?.crm_lead_id;
  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader><DialogTitle className="font-display">Editar tarefa</DialogTitle></DialogHeader>
        <div className="space-y-2">
          {/* Cliente vinculado: seletor que permite vincular/trocar/desvincular, inclusive
              em tarefa criada sem cliente. Tarefa de lead nao muda cliente por aqui. */}
          {isLead
            ? <p className="text-[11px] font-body text-muted-foreground">Tarefa vinculada a um lead.</p>
            : (
              <div>
                <p className="text-[11px] font-body font-semibold text-muted-foreground uppercase mb-1">Cliente</p>
                <select value={clientId ?? ""} onChange={(e) => setClientId(e.target.value || null)} className="w-full h-10 rounded-xl border border-border bg-card px-3 text-sm font-body">
                  <option value="">Sem cliente</option>
                  {clients.map((c) => <option key={c.id} value={c.id}>{nomeExibidoCliente(c)}</option>)}
                </select>
              </div>
            )}
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
            <HoraInput label="Horário" value={dueTime} onChange={setDueTime} />
          </div>
          {/* Cor da tarefa: destaque próprio na agenda. Vence sobre a cor do cliente
              quando escolhida; principalmente útil pra tarefa sem cliente. */}
          <div>
            <p className="text-[11px] font-body font-semibold text-muted-foreground uppercase mb-1">Cor</p>
            <div className="flex flex-wrap items-center gap-1.5">
              <button type="button" onClick={() => setColor(null)}
                className={cn("h-7 w-7 rounded-full border grid place-items-center text-muted-foreground transition-colors", !color ? "border-foreground" : "border-border hover:border-foreground/40")}
                aria-label="Sem cor" title="Sem cor"><X className="h-3.5 w-3.5" /></button>
              {TASK_COLORS.map((hex) => (
                <button key={hex} type="button" onClick={() => setColor(hex)}
                  className={cn("h-7 w-7 rounded-full border-2 transition-transform", color === hex ? "border-foreground scale-110" : "border-transparent hover:scale-105")}
                  style={{ background: hex }} aria-label={`Cor ${hex}`} title={hex} />
              ))}
            </div>
          </div>
          <button type="button" onClick={onOpenCrm} className="inline-flex items-center gap-1 text-[11px] font-body text-muted-foreground hover:text-primary transition-colors">
            <ExternalLink className="h-3 w-3" /> Abrir no CRM
          </button>
        </div>
        <DialogFooter className="sm:justify-between gap-2">
          {/* Excluir com confirmacao leve (dois toques). Funciona pra tarefa sem cliente:
              o delete e por id, nao depende de crm_client_id. */}
          <Button variant="ghost"
            onClick={() => { if (confirmDel) onDelete(); else setConfirmDel(true); }}
            className="text-destructive hover:text-destructive hover:bg-destructive/10 sm:mr-auto">
            <Trash2 className="h-4 w-4 mr-1" /> {confirmDel ? "Confirmar exclusão" : "Excluir"}
          </Button>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={onClose}>Cancelar</Button>
            <Button onClick={() => onSave({ title: title.trim(), description: desc.trim() || null, priority: prio, status, due_date: due || null, due_time: dueTime || null, crm_client_id: isLead ? (task?.crm_client_id ?? null) : clientId, color })} disabled={!title.trim()}>Salvar</Button>
          </div>
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
  // O campo Ideia/Referência aceita VÁRIOS links (um por linha).
  const refLinks = parseRefLinks(post?.reference_url);
  // Link do Drive pra atalho "Abrir no Drive": prioriza o campo Ideia/Referência quando
  // algum link for do Drive; senão pega a view_url do primeiro anexo do Drive do post.
  const refDriveUrl = refLinks.find((u) => isDriveUrl(u)) ?? null;
  const driveUrl = (() => {
    if (refDriveUrl) return refDriveUrl;
    const att = attachments.find((m) => isDriveMedia(m) && !!m.view_url);
    return att?.view_url ?? null;
  })();
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
            <HoraInput label="Horário" value={time} onChange={setTime} />
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

            {/* Links de referência / ideia (podem ser do Drive ou qualquer link). */}
            {refLinks.map((url, i) => (
              <a key={`ref-${i}`} href={refLinkHref(url)} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2.5 group pt-0.5">
                <span className="shrink-0 grid h-9 w-9 place-items-center rounded-lg border border-border bg-card text-muted-foreground">
                  {isDriveUrl(url) ? <HardDrive className="h-4 w-4 text-primary" /> : <Link2 className="h-4 w-4" />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[12px] font-body font-semibold text-primary group-hover:underline truncate">
                    {isDriveUrl(url) ? "Abrir referência no Drive" : "Abrir referência"}{refLinks.length > 1 ? ` ${i + 1}` : ""}
                  </span>
                  <span className="block text-[10px] font-body text-muted-foreground truncate">{url}</span>
                </span>
                <span className="inline-flex items-center justify-center h-9 w-9 rounded-lg border border-border text-muted-foreground group-hover:text-primary transition-colors"><ExternalLink className="h-4 w-4" /></span>
              </a>
            ))}

            {/* Atalho direto pro Drive do post quando não há reference_url do Drive mas há anexo do Drive. */}
            {driveUrl && !refDriveUrl && (
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
