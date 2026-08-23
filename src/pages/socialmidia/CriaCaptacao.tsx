import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Cell, LabelList } from "recharts";
import {
  Video, ChevronLeft, ChevronRight, Copy, Check, MapPin, Building2, Loader2,
  Plus, X, CheckCircle2, Clock, Pencil, CalendarRange, MapPinned, Camera,
  Play, FileText, Download, Repeat, ListChecks, Square, CheckSquare, ChevronDown,
  Sparkles, Route, Send, Settings, Clapperboard,
  ArrowLeft, UserPlus, Trash2, Film, CalendarPlus, GripVertical, Link2, FileDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  useCaptures, useUpdateCapture, useSetCaptureShotList, useEnsureRecurringCaptures,
  useAddCapture, useCaptureToPost,
  DEFAULT_SHOT_LIST, newShotId, normalizeShotList,
  type Capture, type ShotItem, type NewRecurringRow,
} from "@/hooks/useAgenda";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useActiveAccount } from "@/contexts/AccountContext";
import { useCrmClients } from "@/hooks/useCrm";
import { confirmar } from "@/components/shared/Confirm";
import { useExternalClients, useExternalPosts } from "@/hooks/useCriaPost";
import { useCaptureCities, useDefaultShotList } from "@/hooks/useCaptureCities";
import {
  useCaptureScripts, useAddCaptureScript, useUpdateCaptureScript, useDeleteCaptureScript,
  useCaptureExtraClients, useAddCaptureExtraClient, useDeleteCaptureExtraClient,
  useSetClientCaptureShots, useScriptToPost, useReorderCaptureScripts,
  cenasDe, type CaptureScript,
} from "@/hooks/useCaptureScripts";
import { RoteiroEditor, type RoteiroFormValor } from "@/components/captacao/RoteiroEditor";
import { baixarGuiaGravacao } from "@/lib/guiaGravacaoPdf";
import { useLinkPreviews } from "@/hooks/useLinkPreviews";
import { parseRefLinks, isRefLink } from "@/lib/refLinks";
import { RoteirosDoDia } from "@/components/captacao/RoteirosDoDia";
import { BotaoEnviarAprovacao, PainelAprovacoes } from "@/components/captacao/AprovacaoRoteiros";
import { ListaReferencias } from "@/components/captacao/Referencias";
import { DragDropContext as DndRoteiros, Droppable as DropRoteiros, Draggable as DragRoteiro, type DropResult as DropRoteiroResult, type DraggableProvidedDragHandleProps } from "@hello-pangea/dnd";
import { hojeBR, parseDateOnly } from "@/lib/date-br";
import { nomeExibidoCliente } from "@/lib/cliente-nome";
import { PrompterPlayer } from "@/components/prompter/PrompterPlayer";
import { usePdfExport } from "@/hooks/usePdfExport";
import { ModuleGate } from "@/components/accounts/ModuleGate";

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
// "YYYY-MM" + dia do mês -> "YYYY-MM-DD", com clamp no último dia do mês (dia 31 em
// fevereiro cai no 28/29). Sem toISOString: a string é montada à mão pra não pular
// o dia à noite no fuso BR.
function occDate(ym: string, day: number): string {
  const [y, m] = ym.split("-").map(Number);
  const last = new Date(y, m, 0).getDate(); // m (1..12) como índice 0-based = mês seguinte; dia 0 = último dia do mês m
  const d = Math.min(Math.max(day, 1), last);
  return `${ym}-${String(d).padStart(2, "0")}`;
}

// "27/08" a partir de "YYYY-MM-DD".
function diaMes(iso: string): string {
  const d = parseDateOnly(iso);
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;
}
const WD = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];

type StatusFilter = "todas" | "pendentes" | "concluidas";

// Um roteiro dentro da folha do dia (cliente + contexto + texto).
type FolhaItem = { nome: string; cidade: string; horario: string; roteiro: string };

// Junta os roteiros de um dia/local num texto único, legível, pra copiar cru.
// Separador em hifens (nunca travessão).
function montarFolhaTexto(diaLabel: string, wd: string, local: string, items: FolhaItem[]): string {
  const header = `FOLHA DO DIA · ${diaLabel} (${wd})${local ? `\nLocal: ${local}` : ""}`;
  const blocos = items.map((it) => {
    const meta = [it.cidade, it.horario].filter(Boolean).join(" · ");
    return `${it.nome.toUpperCase()}${meta ? ` (${meta})` : ""}\n${it.roteiro}`;
  });
  return `${header}\n\n${blocos.join("\n\n-----\n\n")}`;
}

// Chave de cidade pra comparar/agrupar sem esbarrar em maiúscula/acento de digitação.
const cityKey = (s: string) => (s ?? "").trim().toLowerCase();

// Valor mais frequente de um contador (Map<valor, contagem>). Só devolve se o
// campeão apareceu 2+ vezes: com 1 aparição não é padrão, é acaso, e a regra é
// não inventar. Empate: fica o primeiro na ordem de inserção (datas mais antigas
// entram primeiro, então prevalece o hábito mais consolidado).
function modeOf<K>(counts: Map<K, number>): K | null {
  let best: K | null = null;
  let bestN = 0;
  for (const [k, n] of counts) {
    if (n > bestN) { bestN = n; best = k; }
  }
  return bestN >= 2 ? best : null;
}

// "10:00" -> "10h"; "10:30" -> "10:30". Só pra deixar a dica curta.
function horaCurta(t: string): string {
  return t.endsWith(":00") ? `${t.slice(0, 2)}h` : t;
}

// Frase do hábito do cliente ("costuma gravar dia 10 às 10h"), ou null se não há
// padrão suficiente. day/time já vêm filtrados (2+ ocorrências) de clientHabits.
function habitoLabel(day: number | null, time: string | null): string | null {
  const parts: string[] = [];
  if (day) parts.push(`dia ${day}`);
  if (time) parts.push(`às ${horaCurta(time)}`);
  if (parts.length === 0) return null;
  return `costuma gravar ${parts.join(" ")}`;
}

// Padrão de dia/horário de um cliente, derivado do histórico dele. Sem histórico
// suficiente vem null nos campos (não sugere nada).
type ClientHabit = { day: number | null; time: string | null; count: number };

// Uma sugestão "aproveita a viagem": uma cidade que já tem captação no mês e os
// clientes daquela cidade que ainda não foram captados, pra agrupar na mesma ida.
type TripCandidate = {
  id: string;
  nome: string;
  habitDay: number | null;
  habitTime: string | null;
  // Se o cliente já tem captação PENDENTE no mês em OUTRO dia (dica de transparência).
  pendingDate: string | null;
};
type TripSuggestion = {
  city: string;
  targetDate: string;   // dia da ida pra onde a ação rápida cria a captação
  allDates: string[];   // todos os dias do mês com captação nessa cidade
  location: string | null;
  candidates: TripCandidate[];
};

// Uma PASTA de cliente no Cria Captação: cliente do CRM ou avulso (fora da
// carteira). Os contadores são do mês aberto.
type PastaInfo = {
  key: string; nome: string; cidade: string | null; cor: string | null;
  crmId: string | null; extraId: string | null;
  caps: { total: number; done: number; next: string | null };
  rots: { total: number; feitos: number };
};

// Cria Captação é módulo PAGO: a página inteira fica atrás do ModuleGate
// ('cria_captacao'). Dono sem o módulo vê o convite pra ativar; colaborador
// precisa do módulo liberado (teamCode). Acessar /socialmidia/captacao direto
// pela URL cai no mesmo paywall, não numa tela quebrada. Marcar captação na
// Agenda NÃO passa por aqui: aquilo é grátis (gate 'agenda').
export default function CriaCaptacao() {
  return (
    <ModuleGate code="cria_captacao" teamCode="cria_captacao">
      <CriaCaptacaoInner />
    </ModuleGate>
  );
}

function CriaCaptacaoInner() {
  const navigate = useNavigate();
  const [month, setMonth] = useState(() => hojeBR().slice(0, 7));
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("todas");
  const [cityFilter, setCityFilter] = useState<string>(""); // "" = todas
  // Dialog de Configurações da captação (Cidades + Tomadas padrão).
  const [configOpen, setConfigOpen] = useState(false);
  // Teleprompter em tela cheia com o roteiro de uma captação (overlay z-60).
  const [prompter, setPrompter] = useState<{ title: string; text: string } | null>(null);
  // Folha do dia aberta (todos os roteiros daquele dia + local num lugar só).
  const [folha, setFolha] = useState<{ diaLabel: string; wd: string; local: string; items: FolhaItem[] } | null>(null);
  // v2: a tela tem duas visões (pastas por cliente x agenda por dia/local) e uma
  // pasta pode estar aberta (a tela vira o dossiê daquele cliente, mês a mês).
  const [aba, setAba] = useState<"clientes" | "agenda">("clientes");
  const [pasta, setPasta] = useState<string | null>(null);
  const [novoAvulsoOpen, setNovoAvulsoOpen] = useState(false);

  const { data: captures = [], isLoading } = useCaptures();
  const { data: clients = [] } = useCrmClients();
  // Marca da AGÊNCIA pro guia em PDF (mesma fonte do relatório do cliente:
  // profiles.brand_logo_url do dono do tenant). Leitura defensiva: sem logo, o
  // guia só assina com o nome.
  const { agencyOwnerId } = useActiveAccount();
  const { data: marcaAgencia } = useQuery<{ brand_logo_url: string | null; name: string | null } | null>({
    queryKey: ["captacao-marca-agencia", agencyOwnerId],
    enabled: !!agencyOwnerId,
    staleTime: 300_000,
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles")
        .select("brand_logo_url, name").eq("id", agencyOwnerId!).maybeSingle();
      if (error) return null;
      return (data as { brand_logo_url: string | null; name: string | null } | null) ?? null;
    },
  });
  const { clients: extClients } = useExternalClients();
  const captureToPost = useCaptureToPost();
  const updCapture = useUpdateCapture();
  const setShots = useSetCaptureShotList();
  const ensureRecurring = useEnsureRecurringCaptures();
  const addCapture = useAddCapture();
  const { cities, save: saveCities } = useCaptureCities();
  // Tomadas padrão configuráveis pela social mídia (fallback = DEFAULT_SHOT_LIST).
  const { shots: defaultShots, save: saveDefaultShots } = useDefaultShotList();
  // v2: biblioteca de roteiros + clientes avulsos + tomadas por cliente.
  const { data: scripts = [] } = useCaptureScripts();
  const { data: extraClients = [] } = useCaptureExtraClients();
  const addExtra = useAddCaptureExtraClient();
  const delExtra = useDeleteCaptureExtraClient();
  const setClientShots = useSetClientCaptureShots();

  const currentMonth = hojeBR().slice(0, 7);
  // Mês em que a social mídia dispensou o bloco de sugestões (dispensa por mês:
  // some no mês atual, volta a aparecer ao trocar de mês). Bloco discreto e opcional.
  const [sugDismissed, setSugDismissed] = useState<string | null>(null);

  // Captação por id (pra resolver a RAIZ de uma recorrência a partir de uma filha).
  const capturesById = useMemo(() => new Map(captures.map((c) => [c.id, c])), [captures]);

  // ── MATERIALIZA AS CAPTAÇÕES RECORRENTES (mês vigente + próximo) ──────────────
  // Ao abrir o Cria Captação, cada captação recorrente (raiz recurring=true, com dia
  // do mês válido) ganha ocorrência no mês vigente e no próximo, se ainda não tiver.
  // Anti-duplicata: o GRUPO é a raiz + as filhas (recurrence_source_id = id da raiz);
  // olhamos os meses que o grupo já cobre nas captações carregadas e uma trava de
  // sessão (materializedRef) impede recriar o mesmo (grupo, mês) na janela até o
  // refetch chegar. Nunca cria mês anterior à própria raiz nem mês passado.
  const materializedRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (isLoading) return;
    const sources = captures.filter(
      (c) => c.recurring === true && Number(c.recurrence_day) >= 1 && Number(c.recurrence_day) <= 31,
    );
    if (sources.length === 0) return;

    const curYm = hojeBR().slice(0, 7);
    const nextYm = addMonth(curYm, 1);

    // Meses já cobertos por grupo (id da raiz -> Set de "YYYY-MM").
    const monthsByGroup = new Map<string, Set<string>>();
    const addMonthToGroup = (root: string, ym: string) => {
      const set = monthsByGroup.get(root) ?? monthsByGroup.set(root, new Set()).get(root)!;
      set.add(ym);
    };
    for (const c of captures) {
      if (c.recurrence_source_id) addMonthToGroup(c.recurrence_source_id, c.capture_date.slice(0, 7));
      else if (c.recurring) addMonthToGroup(c.id, c.capture_date.slice(0, 7));
    }

    const rows: NewRecurringRow[] = [];
    for (const s of sources) {
      const day = Number(s.recurrence_day);
      const srcYm = s.capture_date.slice(0, 7);
      const have = monthsByGroup.get(s.id) ?? new Set<string>();
      for (const ym of [curYm, nextYm]) {
        if (ym < srcYm) continue;               // não cria antes de a raiz existir
        if (have.has(ym)) continue;             // grupo já cobre esse mês
        const guardKey = `${s.id}|${ym}`;
        if (materializedRef.current.has(guardKey)) continue; // trava de sessão
        materializedRef.current.add(guardKey);
        rows.push({
          manager_id: s.manager_id,
          status: "agendada",
          capture_date: occDate(ym, day),
          capture_time: s.capture_time ?? null,
          location: s.location ?? null,
          crm_client_id: s.crm_client_id ?? null,
          client_name: s.client_name ?? null,
          team: s.team ?? null,
          note: s.note ?? null,
          // A lista de tomadas da raiz vira MODELO da ocorrência (itens novos, nada feito).
          shot_list: normalizeShotList(s.shot_list).map((it) => ({ ...it, id: newShotId(), feito: false })),
          recurrence_source_id: s.id,
          recurrence_day: day,
        });
      }
    }
    if (rows.length > 0) ensureRecurring.mutate(rows);
    // ensureRecurring é estável (useMutation); depender só de captures/isLoading evita loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [captures, isLoading]);

  // Cliente do CRM por id: nome exibido (apelido do gestor > name) e cidade.
  const clientById = useMemo(() => {
    const m = new Map<string, { nome: string; city: string | null; color: string | null; logo: string | null }>();
    for (const c of clients) {
      m.set(c.id, {
        nome: nomeExibidoCliente(c),
        city: ((c as { city?: string | null }).city ?? null),
        color: c.color,
        logo: ((c as { logo?: string | null }).logo ?? null),
      });
    }
    return m;
  }, [clients]);

  // Cliente do Cria Post (external_client ATIVO) por crm_client_id. É o que permite
  // "Virar post": só quem tem Cria Post ativo tem uma área de posts pra receber.
  const extByCrmId = useMemo(() => {
    const m = new Map<string, { id: string; name: string }>();
    for (const e of extClients) {
      if (e.crm_client_id && e.active) m.set(e.crm_client_id, { id: e.id, name: e.name });
    }
    return m;
  }, [extClients]);

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

  // ── Direcionamento (dashboard): o que fazer agora ──────────────────────────
  const hojeStr = hojeBR();
  // doMes já vem ordenado por data/hora, então o primeiro pendente >= hoje é a próxima.
  const proxima = useMemo(
    () => doMes.find((c) => c.status === "agendada" && c.capture_date >= hojeStr) ?? null,
    [doMes, hojeStr]);
  const semRoteiro = useMemo(
    () => doMes.filter((c) => c.status === "agendada" && !(c.roteiro ?? "").trim()).length,
    [doMes]);
  const roteirosDoMes = useMemo(() => scripts.filter((s) => s.month === month), [scripts, month]);
  const roteirosAGravar = roteirosDoMes.filter((s) => !s.done).length;

  // ── Pastas por cliente: carteira ativa do CRM + avulsos, com contadores do mês.
  const pastas = useMemo<PastaInfo[]>(() => {
    const nomeKey = (s: string | null | undefined) => `nome:${(s ?? "").trim().toLowerCase()}`;
    const rotCount = new Map<string, { total: number; feitos: number }>();
    for (const s of roteirosDoMes) {
      const key = s.crm_client_id ? `crm:${s.crm_client_id}` : nomeKey(s.client_name);
      const e = rotCount.get(key) ?? { total: 0, feitos: 0 };
      e.total += 1; if (s.done) e.feitos += 1;
      rotCount.set(key, e);
    }
    const capCount = new Map<string, { total: number; done: number; next: string | null }>();
    for (const c of doMes) {
      const key = c.crm_client_id ? `crm:${c.crm_client_id}` : nomeKey(c.client_name);
      const e = capCount.get(key) ?? { total: 0, done: 0, next: null };
      e.total += 1; if (c.status === "concluida") e.done += 1;
      if (c.status === "agendada" && (!e.next || c.capture_date < e.next)) e.next = c.capture_date;
      capCount.set(key, e);
    }
    const out: PastaInfo[] = [];
    for (const cl of clients) {
      if (cl.active === false || cl.status === "inativo") continue;
      const key = `crm:${cl.id}`;
      out.push({
        key, nome: nomeExibidoCliente(cl), cidade: ((cl as { city?: string | null }).city ?? null),
        cor: cl.color, crmId: cl.id, extraId: null,
        caps: capCount.get(key) ?? { total: 0, done: 0, next: null },
        rots: rotCount.get(key) ?? { total: 0, feitos: 0 },
      });
    }
    for (const ex of extraClients) {
      const nk = nomeKey(ex.name);
      out.push({
        key: `extra:${ex.id}`, nome: ex.name, cidade: ex.city, cor: null, crmId: null, extraId: ex.id,
        caps: capCount.get(nk) ?? { total: 0, done: 0, next: null },
        rots: rotCount.get(nk) ?? { total: 0, feitos: 0 },
      });
    }
    // Quem tem movimento no mês vem primeiro; o resto por nome.
    return out.sort((a, b) =>
      (b.caps.total + b.rots.total) - (a.caps.total + a.rots.total)
      || a.nome.localeCompare(b.nome, "pt-BR"));
  }, [clients, extraClients, doMes, roteirosDoMes]);

  const pastaAberta = useMemo(() => pastas.find((p) => p.key === pasta) ?? null, [pastas, pasta]);
  const nomeKeyAberta = pastaAberta && !pastaAberta.crmId ? pastaAberta.nome.trim().toLowerCase() : null;
  const scriptsDaPasta = useMemo(() => {
    if (!pastaAberta) return [] as CaptureScript[];
    return roteirosDoMes.filter((s) => pastaAberta.crmId
      ? s.crm_client_id === pastaAberta.crmId
      : !s.crm_client_id && (s.client_name ?? "").trim().toLowerCase() === nomeKeyAberta);
  }, [roteirosDoMes, pastaAberta, nomeKeyAberta]);
  const capsDaPasta = useMemo(() => {
    if (!pastaAberta) return [] as Capture[];
    return doMes.filter((c) => pastaAberta.crmId
      ? c.crm_client_id === pastaAberta.crmId
      : !c.crm_client_id && (c.client_name ?? "").trim().toLowerCase() === nomeKeyAberta);
  }, [doMes, pastaAberta, nomeKeyAberta]);

  // Tomadas padrão DO CLIENTE (crm_clients.capture_shots): vence a lista geral.
  const clientShotsOf = (crmId: string | null): string[] => {
    if (!crmId) return [];
    const cl = clients.find((x) => x.id === crmId) as { capture_shots?: string[] | null } | undefined;
    return cl?.capture_shots ?? [];
  };

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

  // ── SUGESTÃO 2 (base): padrão de dia/horário por cliente ─────────────────────
  // A partir do HISTÓRICO de cada cliente (captações já concluídas ou já passadas,
  // nunca canceladas), guarda o dia do mês e o horário MAIS COMUM. "Dados
  // suficientes" = 2+ captações no histórico do cliente; e um campo (dia ou hora)
  // só vira "padrão" se o valor campeão apareceu 2+ vezes (modeOf). Sem isso, fica
  // null e não sugere nada. Memoizado nas captações: não recalcula a cada render.
  const clientHabits = useMemo(() => {
    const hoje = hojeBR();
    const acc = new Map<string, { days: Map<number, number>; times: Map<string, number>; count: number }>();
    for (const c of captures) {
      if (!c.crm_client_id || c.status === "cancelada") continue;
      // Histórico = já aconteceu (concluída) ou a data já passou. Futuro não conta.
      const passou = c.status === "concluida" || c.capture_date < hoje;
      if (!passou) continue;
      const e = acc.get(c.crm_client_id) ?? { days: new Map(), times: new Map(), count: 0 };
      e.count += 1;
      const dia = parseDateOnly(c.capture_date).getDate();
      e.days.set(dia, (e.days.get(dia) ?? 0) + 1);
      if (c.capture_time) {
        const t = c.capture_time.slice(0, 5);
        e.times.set(t, (e.times.get(t) ?? 0) + 1);
      }
      acc.set(c.crm_client_id, e);
    }
    const out = new Map<string, ClientHabit>();
    for (const [id, e] of acc) {
      if (e.count < 2) continue; // dados suficientes: 2+ captações no histórico
      out.set(id, { day: modeOf(e.days), time: modeOf(e.times), count: e.count });
    }
    return out;
  }, [captures]);

  // ── SUGESTÃO 1: "aproveita a viagem" (agrupar por cidade) ────────────────────
  // Pra cada cidade que já tem captação no mês, lista os clientes DAQUELA cidade
  // que ainda não foram captados no mês, pra agrupar tudo numa ida só. Só mês
  // vigente ou futuro (viagem passada não interessa). Tudo derivado do que já
  // existe (captações do mês + cidade do cliente no CRM), memoizado.
  const tripSuggestions = useMemo<TripSuggestion[]>(() => {
    if (month < currentMonth) return [];
    const hoje = hojeBR();

    const cityDates = new Map<string, Set<string>>();     // cidade -> dias do mês com captação
    const dayClient = new Set<string>();                  // "data|clientId" (anti-duplicata do dia)
    const concluidoMes = new Set<string>();               // clientId já captado (concluída) no mês
    const pendenteData = new Map<string, string>();       // clientId -> 1ª data pendente no mês (dica)
    const locByCityDate = new Map<string, Map<string, number>>(); // "cidade|data" -> contagem de location

    for (const c of doMes) {
      const city = capCity(c);
      if (c.crm_client_id) {
        dayClient.add(`${c.capture_date}|${c.crm_client_id}`);
        if (c.status === "concluida") concluidoMes.add(c.crm_client_id);
        else {
          const cur = pendenteData.get(c.crm_client_id);
          if (!cur || c.capture_date < cur) pendenteData.set(c.crm_client_id, c.capture_date);
        }
      }
      if (city === SEM_CIDADE) continue;
      (cityDates.get(city) ?? cityDates.set(city, new Set()).get(city)!).add(c.capture_date);
      const loc = (c.location ?? "").trim();
      if (loc) {
        const ck = `${city}|${c.capture_date}`;
        const lm = locByCityDate.get(ck) ?? locByCityDate.set(ck, new Map()).get(ck)!;
        lm.set(loc, (lm.get(loc) ?? 0) + 1);
      }
    }

    const out: TripSuggestion[] = [];
    for (const [city, dset] of cityDates) {
      const dates = Array.from(dset).sort();
      // Dia da ida: o próximo (>= hoje); se todos já passaram no mês, o último.
      const futuras = dates.filter((d) => d >= hoje);
      const targetDate = futuras.length ? futuras[0] : dates[dates.length - 1];

      // Local mais comum nesse dia/cidade (vira default da captação criada).
      let location: string | null = null;
      const lm = locByCityDate.get(`${city}|${targetDate}`);
      if (lm) {
        let bestN = 0;
        for (const [l, n] of lm) if (n > bestN) { bestN = n; location = l; }
      }

      const ck = cityKey(city);
      const candidates: TripCandidate[] = clients
        .filter((cl) => {
          if (cl.active === false || cl.status === "inativo") return false; // só carteira ativa
          if (cityKey(cl.city ?? "") !== ck) return false;                  // mesma cidade
          if (concluidoMes.has(cl.id)) return false;                        // já captado no mês
          if (dayClient.has(`${targetDate}|${cl.id}`)) return false;        // anti-dup: já tem captação nesse dia
          return true;
        })
        .map((cl) => {
          const h = clientHabits.get(cl.id);
          return {
            id: cl.id,
            nome: nomeExibidoCliente(cl),
            habitDay: h?.day ?? null,
            habitTime: h?.time ?? null,
            pendingDate: pendenteData.get(cl.id) ?? null,
          };
        })
        .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));

      if (candidates.length === 0) continue;
      out.push({ city, targetDate, allDates: dates, location, candidates });
    }
    // Cidades com mais oportunidades primeiro.
    out.sort((a, b) => b.candidates.length - a.candidates.length || a.city.localeCompare(b.city, "pt-BR"));
    return out;
    // capCity/capName dependem de clientById; incluir clientById nos deps.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doMes, clients, clientById, clientHabits, month, currentMonth]);

  const goHoje = () => setMonth(currentMonth);

  // Ação rápida da Sugestão 1: cria uma captação (status agendada) pro cliente no
  // dia da ida, já com o horário habitual dele como default (Sugestão 2) e o local
  // daquele dia. O refetch tira o cliente da lista (passa a ter captação nesse dia).
  const marcarNoDia = (input: { clientId: string; date: string; time: string | null; location: string | null }) =>
    addCapture.mutateAsync({
      capture_date: input.date,
      capture_time: input.time,
      location: input.location,
      crm_client_id: input.clientId,
      client_name: null,
    });

  const showSugestoes = month >= currentMonth && sugDismissed !== month && tripSuggestions.length > 0;

  // "Virar post": manda o roteiro/nota da captação pro Cria Post do cliente como
  // rascunho, pelo MESMO caminho do "Novo post" da Produção (useCaptureToPost). Se o
  // cliente não tem Cria Post ativo, explica em vez de quebrar (igual "Virar post" das
  // ideias). Depois de criar, leva pro kanban de posts do cliente.
  const virarPost = async (cap: Capture) => {
    if (!cap.crm_client_id) {
      toast.error("Vincule esta captação a um cliente do cadastro pra poder mandar pro Cria Post.");
      return;
    }
    const ext = extByCrmId.get(cap.crm_client_id);
    if (!ext) {
      toast.error("O Cria Post não está ativo pra este cliente. Ative na ficha dele (aba Cria Post) e volte aqui pra mandar a captação pro post.");
      return;
    }
    if (captureToPost.isPending) return;
    const nome = capName(cap);
    const dm = diaMes(cap.capture_date);
    const roteiro = (cap.roteiro ?? "").trim();
    const nota = (cap.note ?? "").trim();
    // Legenda: deixa claro que é um rascunho da captação, pra ela montar com o material
    // gravado; junta a nota livre se houver. O roteiro vai pro campo de roteiro do post.
    const caption = [`Rascunho gerado da captação de ${dm}. Monte o post com o material gravado.`, nota]
      .filter(Boolean).join("\n\n");
    try {
      await captureToPost.mutateAsync({
        captureId: cap.id,
        externalClientId: ext.id,
        title: `${nome} · captação ${dm}`,
        caption,
        script: roteiro || null,
      });
      navigate(`/socialmidia/clientes/${cap.crm_client_id}/posts`);
    } catch { /* o hook já avisa */ }
  };

  // Uma linha de captação, usada na Agenda do mês E dentro da pasta do cliente.
  const renderCaptureRow = (c: Capture, doDia?: {
    roteiros: CaptureScript[];
    acoes: {
      adicionar: () => void; editar: (s: CaptureScript) => void; excluir: (s: CaptureScript) => void;
      toggleGravado: (s: CaptureScript) => void; reordenar: (ids: string[]) => void;
      teleprompter: (s: CaptureScript) => void; salvando?: boolean;
    };
  }): ReactNode => {
    // Estado de recorrência do GRUPO: a raiz (a própria captação, ou a origem
    // apontada por recurrence_source_id) manda no recurring/dia.
    const rootId = c.recurrence_source_id ?? c.id;
    const root = capturesById.get(rootId) ?? c;
    return (
      <CaptureRow key={c.id} cap={c} nome={capName(c)} cidade={capCity(c)}
        onToggle={() => updCapture.mutate({ id: c.id, patch: { status: c.status === "concluida" ? "agendada" : "concluida" } })}
        onSaveRoteiro={(roteiro) => updCapture.mutateAsync({ id: c.id, patch: { roteiro } })}
        onTeleprompter={() => setPrompter({ title: capName(c), text: (c.roteiro ?? "").trim() })}
        shotList={normalizeShotList(c.shot_list)}
        onSaveShotList={(list) => setShots.mutate({ id: c.id, shot_list: list })}
        defaultShots={defaultShots}
        clientShots={clientShotsOf(c.crm_client_id)}
        recurring={!!root.recurring}
        recurrenceDay={root.recurrence_day ?? null}
        onSetRecurring={(on, day) => updCapture.mutateAsync({ id: rootId, patch: { recurring: on, recurrence_day: day } })}
        convertedPostId={c.converted_post_id ?? null}
        onVirarPost={() => virarPost(c)}
        onVerPost={() => navigate(`/socialmidia/clientes/${c.crm_client_id}/posts`)}
        converting={captureToPost.isPending}
        roteirosDoDia={doDia?.roteiros}
        acoesRoteiro={doDia?.acoes} />
    );
  };

  // Abre a folha do dia de um grupo (só as captações que já têm roteiro).
  const abrirFolha = (g: { date: string; local: string; caps: Capture[] }) => {
    const items: FolhaItem[] = g.caps
      .filter((c) => (c.roteiro ?? "").trim())
      .map((c) => ({
        nome: capName(c),
        cidade: capCity(c) === SEM_CIDADE ? "" : capCity(c),
        horario: c.capture_time ? c.capture_time.slice(0, 5) : "",
        roteiro: (c.roteiro ?? "").trim(),
      }));
    setFolha({
      diaLabel: diaMes(g.date),
      wd: WD[parseDateOnly(g.date).getDay()],
      local: g.local === SEM_LOCAL ? "" : g.local,
      items,
    });
  };

  return (
    <div className="space-y-5">
      {/* Cabeçalho: navegação de mês + botão Cidades */}
      <div data-tour="cap-topo" className="flex flex-wrap items-center justify-between gap-3">
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
        <Button data-tour="cap-cidades" variant="outline" size="sm" onClick={() => setConfigOpen(true)} className="rounded-xl">
          <Settings className="h-4 w-4 mr-1.5" /> Configurações
        </Button>
      </div>

      {/* PASTA ABERTA: a tela vira o dossiê do cliente (roteiros, captações,
          tomadas dele), respeitando o mês do cabeçalho. */}
      {pastaAberta && (
        <PastaCliente
          pasta={pastaAberta}
          month={month}
          logoCliente={pastaAberta.crmId ? (clientById.get(pastaAberta.crmId)?.logo ?? null) : null}
          logoAgencia={marcaAgencia?.brand_logo_url ?? null}
          elaboradoPor={marcaAgencia?.name ?? null}
          corCliente={pastaAberta.crmId ? (clientById.get(pastaAberta.crmId)?.color ?? null) : null}
          scripts={scriptsDaPasta}
          caps={capsDaPasta}
          habit={pastaAberta.crmId
            ? habitoLabel(clientHabits.get(pastaAberta.crmId)?.day ?? null, clientHabits.get(pastaAberta.crmId)?.time ?? null)
            : null}
          clientShots={clientShotsOf(pastaAberta.crmId)}
          savingClientShots={setClientShots.isPending}
          onSaveClientShots={pastaAberta.crmId
            ? (list) => setClientShots.mutateAsync({ crmClientId: pastaAberta.crmId!, shots: list })
            : null}
          ext={pastaAberta.crmId ? extByCrmId.get(pastaAberta.crmId) ?? null : null}
          onBack={() => setPasta(null)}
          onDeleteExtra={pastaAberta.extraId ? () => { delExtra.mutate(pastaAberta.extraId!); setPasta(null); } : undefined}
          onPrompter={(title, text) => setPrompter({ title, text })}
          renderCapture={renderCaptureRow}
          onSaveCapRoteiro={(id, roteiro) => updCapture.mutateAsync({ id, patch: { roteiro } })}
          addCapture={(input) => addCapture.mutateAsync(input)}
          addingCapture={addCapture.isPending}
        />
      )}

      {!pastaAberta && (<>
      {/* HERO do módulo: placar do mês + próxima gravação + pendências, num
          painel só (substitui os 3 cards soltos e o bloco de direcionamento). */}
      <div data-tour="cap-resumo" className="relative overflow-hidden rounded-3xl border border-primary/15 bg-card p-4 sm:p-5">
        <span aria-hidden className="pointer-events-none absolute -top-14 -right-14 w-44 h-44 rounded-full bg-primary/10 blur-2xl" />
        <div className="relative flex flex-col md:flex-row md:items-stretch gap-4">
          {/* Placar */}
          <div className="md:w-52 shrink-0">
            <p className="flex items-center gap-1.5 text-[11px] font-body font-bold uppercase tracking-wide text-muted-foreground">
              <Video className="h-3.5 w-3.5" /> {monthLabel(month)}
            </p>
            <p className="mt-1.5 text-4xl font-display font-extrabold text-foreground leading-none tabular-nums">
              {resumo.concluidas}<span className="text-xl text-muted-foreground/50">/{resumo.total}</span>
            </p>
            <p className="text-[11px] font-body text-muted-foreground mt-1">captações gravadas</p>
            <div className="mt-2.5 h-2 rounded-full bg-muted overflow-hidden">
              <div className="h-full rounded-full bg-[hsl(var(--cria-verde))] transition-all"
                style={{ width: `${resumo.total > 0 ? Math.round((resumo.concluidas / resumo.total) * 100) : 0}%` }} />
            </div>
          </div>
          <div className="hidden md:block w-px bg-border/60" />
          {/* Próxima gravação + pendências */}
          <div className="flex-1 min-w-0">
            {proxima ? (() => {
              const cor = (proxima.crm_client_id ? clientById.get(proxima.crm_client_id)?.color : null) || "#EA4918";
              const nome = capName(proxima);
              return (
                <button type="button"
                  onClick={() => {
                    const k = proxima.crm_client_id ? `crm:${proxima.crm_client_id}` : null;
                    if (k && pastas.some((p) => p.key === k)) setPasta(k); else setAba("agenda");
                  }}
                  className="w-full flex items-center gap-3 rounded-2xl border border-border bg-background px-3.5 py-3 text-left hover:border-primary/40 transition-colors">
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl text-white text-sm font-display font-extrabold" style={{ background: cor }}>
                    {nome.slice(0, 1).toUpperCase()}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[10px] font-body font-bold uppercase tracking-wide text-primary">Próxima gravação</span>
                    <span className="block text-sm font-display font-extrabold text-foreground truncate">{nome}</span>
                    <span className="block text-[11.5px] font-body text-muted-foreground truncate">
                      {diaMes(proxima.capture_date)} ({WD[parseDateOnly(proxima.capture_date).getDay()]})
                      {proxima.capture_time ? ` · ${proxima.capture_time.slice(0, 5)}` : ""}
                      {(proxima.location ?? "").trim() ? ` · ${(proxima.location ?? "").trim()}` : ""}
                    </span>
                  </span>
                  <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                </button>
              );
            })() : (
              <div className="rounded-2xl border border-dashed border-border px-3.5 py-3">
                <p className="text-sm font-body font-semibold text-foreground">Nenhuma gravação futura marcada</p>
                <p className="text-[11.5px] font-body text-muted-foreground mt-0.5">Abra a pasta de um cliente e use o Marcar captação.</p>
              </div>
            )}
            <div data-tour="cap-direcao" className="mt-2.5 flex flex-wrap gap-1.5">
              {semRoteiro > 0 && (
                <button type="button" onClick={() => { setAba("agenda"); setStatusFilter("pendentes"); }}
                  className="inline-flex items-center gap-1.5 rounded-full border border-[hsl(var(--cria-amarelo)/0.4)] bg-[hsl(var(--cria-amarelo)/0.12)] px-3 py-1.5 text-[11px] font-body font-bold text-[hsl(var(--cria-amarelo))] hover:brightness-95 transition-all">
                  <FileText className="h-3 w-3" /> {semRoteiro} sem roteiro
                </button>
              )}
              {roteirosAGravar > 0 && (
                <button type="button" onClick={() => setAba("clientes")}
                  className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-3 py-1.5 text-[11px] font-body font-bold text-primary hover:bg-primary/15 transition-colors">
                  <Film className="h-3 w-3" /> {roteirosAGravar} {roteirosAGravar === 1 ? "roteiro a gravar" : "roteiros a gravar"}
                </button>
              )}
              {resumo.faltam > 0 && (
                <button type="button" onClick={() => { setAba("agenda"); setStatusFilter("pendentes"); }}
                  className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted/50 px-3 py-1.5 text-[11px] font-body font-bold text-muted-foreground hover:text-foreground transition-colors">
                  <Clock className="h-3 w-3" /> {resumo.faltam} {resumo.faltam === 1 ? "pendente no mês" : "pendentes no mês"}
                </button>
              )}
              {resumo.total > 0 && resumo.faltam === 0 && (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-[hsl(var(--cria-verde)/0.35)] bg-[hsl(var(--cria-verde)/0.12)] px-3 py-1.5 text-[11px] font-body font-bold text-[hsl(var(--cria-verde))]">
                  <CheckCircle2 className="h-3 w-3" /> Mês 100% gravado
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Sugestões "aproveita a viagem": valem nas duas visões, ficam acima das abas. */}
      {showSugestoes && (
        <SugestoesViagem trips={tripSuggestions} onAdd={marcarNoDia} onDismiss={() => setSugDismissed(month)} />
      )}

      {/* Abas: pastas por cliente x agenda por dia/local. */}
      <div data-tour="cap-abas" className="inline-flex rounded-xl border border-border bg-card p-0.5">
        {([["clientes", "Clientes"], ["agenda", "Agenda do mês"]] as const).map(([k, label]) => (
          <button key={k} type="button" data-tour={k === "agenda" ? "cap-aba-agenda" : undefined}
            onClick={() => setAba(k)}
            className={cn("px-3.5 py-1.5 text-xs font-body font-semibold rounded-lg transition-colors",
              aba === k ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")}>
            {label}
          </button>
        ))}
      </div>

      {/* Visão CLIENTES: uma pastinha por cliente (carteira ativa + avulsos). */}
      {aba === "clientes" && (
        <div data-tour="cap-pastas">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {pastas.map((p) => (
              <button key={p.key} type="button" onClick={() => setPasta(p.key)}
                className="rounded-2xl border border-border bg-card p-3.5 text-left hover:border-primary/40 hover:shadow-warm-sm transition-all">
                <div className="flex items-center gap-2">
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl text-white text-xs font-display font-extrabold"
                    style={{ background: p.cor || "#EA4918" }}>
                    {p.nome.slice(0, 1).toUpperCase()}
                  </span>
                  <div className="min-w-0">
                    <p className="text-[13px] font-display font-bold text-foreground truncate">{p.nome}</p>
                    <p className="text-[10.5px] font-body text-muted-foreground truncate">{p.cidade || (p.extraId ? "avulso" : "\u00a0")}</p>
                  </div>
                </div>
                <div className="mt-2.5 flex items-center gap-2 flex-wrap text-[11px] font-body text-muted-foreground">
                  <span className="inline-flex items-center gap-1" title="Captações gravadas / marcadas no mês">
                    <Video className="h-3 w-3" /> {p.caps.done}/{p.caps.total}
                  </span>
                  <span className="inline-flex items-center gap-1" title="Roteiros salvos no mês">
                    <FileText className="h-3 w-3" /> {p.rots.total}
                  </span>
                  {p.caps.next && <span className="ml-auto font-semibold text-primary tabular-nums" title="Próxima captação">{diaMes(p.caps.next)}</span>}
                </div>
              </button>
            ))}
            {/* Cliente avulso: pasta fora da carteira (job pontual). */}
            <button type="button" onClick={() => setNovoAvulsoOpen(true)}
              className="rounded-2xl border border-dashed border-border p-3.5 text-muted-foreground hover:text-primary hover:border-primary/40 transition-colors grid place-items-center min-h-[96px]">
              <span className="inline-flex flex-col items-center gap-1 text-xs font-body font-semibold">
                <UserPlus className="h-5 w-5" /> Cliente avulso
              </span>
            </button>
          </div>
          <p className="text-[11px] font-body text-muted-foreground mt-2">
            Cada pasta guarda os roteiros e as captações do cliente, mês a mês (troque o mês nas setas lá em cima).
          </p>
        </div>
      )}

      {aba === "agenda" && (<>
      {/* CALENDÁRIO DO MÊS: a agenda era uma pilha de cards, e ninguém enxerga
          a semana numa pilha. Aqui ela bate o olho e vê os dias cheios, os
          vazios e onde dá pra encaixar mais uma gravação. */}
      <CalendarioCaptacoes month={month} caps={filtradas} clientById={clientById} />

      {/* Gráfico por cidade */}
      {porCidade.length > 0 && (
        <div data-tour="cap-grafico" className="rounded-2xl border border-border bg-card p-4 sm:p-5">
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
      <div data-tour="cap-filtros" className="flex flex-wrap items-center gap-2">
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
            <div key={`${g.date}||${g.local}`} data-tour="cap-grupo" className="rounded-2xl border border-border bg-card overflow-hidden">
              {/* Cabeçalho do grupo: dia + local */}
              <div className="flex items-center gap-2 px-4 py-2.5 border-b border-border bg-muted/30">
                <CalendarRange className="h-4 w-4 text-primary shrink-0" />
                <span className="text-sm font-display font-bold text-foreground">{diaMes(g.date)}</span>
                <span className="text-xs font-body text-muted-foreground">{WD[parseDateOnly(g.date).getDay()]}</span>
                <span className="text-muted-foreground/40">·</span>
                <span className="inline-flex items-center gap-1 text-sm font-body font-semibold text-foreground min-w-0">
                  <MapPin className="h-3.5 w-3.5 text-muted-foreground shrink-0" /><span className="truncate">{g.local}</span>
                </span>
                <div className="ml-auto flex items-center gap-2 shrink-0">
                  {g.caps.some((c) => (c.roteiro ?? "").trim()) && (
                    <Button data-tour="cap-folha" variant="outline" size="sm" onClick={() => abrirFolha(g)}
                      className="h-8 rounded-xl px-2.5 whitespace-nowrap"
                      title="Todos os roteiros desse dia num texto só, pra levar pra captação.">
                      <FileText className="h-3.5 w-3.5 sm:mr-1.5" /><span className="hidden sm:inline">Folha do dia</span>
                    </Button>
                  )}
                  <span className="text-[11px] font-body font-semibold text-muted-foreground tabular-nums">{g.caps.length}</span>
                </div>
              </div>
              <div className="divide-y divide-border">
                {g.caps.map((c) => renderCaptureRow(c))}
              </div>
            </div>
          ))}
        </div>
      )}

      </>)}
      </>)}

      {novoAvulsoOpen && (
        <NovoAvulsoDialog open onOpenChange={(o) => { if (!o) setNovoAvulsoOpen(false); }}
          salvando={addExtra.isPending}
          onSalvar={async (nome, cidade) => {
            await addExtra.mutateAsync({ name: nome, city: cidade || null });
            setNovoAvulsoOpen(false);
          }} />
      )}

      <ConfigCaptacaoDialog open={configOpen} onOpenChange={setConfigOpen}
        cities={cities} onSaveCities={(list) => saveCities.mutateAsync(list)} savingCities={saveCities.isPending}
        shots={defaultShots} onSaveShots={(list) => saveDefaultShots.mutateAsync(list)} savingShots={saveDefaultShots.isPending} />

      {folha && (
        <FolhaDoDiaDialog open onOpenChange={(o) => { if (!o) setFolha(null); }}
          diaLabel={folha.diaLabel} wd={folha.wd} local={folha.local} items={folha.items} />
      )}

      {/* Teleprompter em tela cheia: reusa o player do Cria Prompter (mesmo componente,
          sem passar pela rota gated). A social mídia grava com a câmera pro e entrega o
          celular pro cliente ler o roteiro aqui. */}
      {prompter && (
        <PrompterPlayer title={prompter.title} text={prompter.text} onExit={() => setPrompter(null)} />
      )}
    </div>
  );
}

// ── Sugestões "aproveita a viagem" (agrupar captação por cidade) ───────────────
// Bloco opcional: pra cada cidade que já tem captação no mês, mostra os clientes
// daquela cidade ainda não captados e um botão "marcar neste dia" (cria a captação
// no dia da ida, já com o horário habitual do cliente). Nada some da tela principal
// e a social mídia pode dispensar o bloco inteiro.
// ── CALENDÁRIO DO MÊS ─────────────────────────────────────────────────────────
// A agenda mostrava só cards empilhados por dia: pra saber como estava a semana,
// a pessoa tinha que rolar e somar de cabeça. A grade resolve isso em um olhar:
// dia cheio, dia livre, e a cor de cada cliente dentro do dia.
function CalendarioCaptacoes({ month, caps, clientById }: {
  month: string;
  caps: Capture[];
  clientById: Map<string, { nome: string; city?: string; color?: string | null }>;
}) {
  const base = ymToDate(month);
  const ano = base.getFullYear();
  const mes = base.getMonth();
  const primeiroDiaSemana = new Date(ano, mes, 1).getDay();
  const diasNoMes = new Date(ano, mes + 1, 0).getDate();
  const hoje = hojeBR();
  const pad = (n: number) => String(n).padStart(2, "0");

  const porDia = new Map<string, Capture[]>();
  for (const c of caps) {
    const k = c.capture_date;
    if (!porDia.has(k)) porDia.set(k, []);
    porDia.get(k)!.push(c);
  }

  const celulas: (number | null)[] = [
    ...Array.from({ length: primeiroDiaSemana }, () => null),
    ...Array.from({ length: diasNoMes }, (_, i) => i + 1),
  ];
  const semanas = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

  return (
    <div className="rounded-2xl border border-border bg-card p-3 sm:p-4">
      <div className="grid grid-cols-7 gap-1 mb-1">
        {semanas.map((d) => (
          <div key={d} className="text-center text-[10.5px] font-body font-semibold text-muted-foreground py-1">{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {celulas.map((dia, i) => {
          if (dia === null) return <div key={`v${i}`} className="min-h-[74px]" />;
          const iso = `${ano}-${pad(mes + 1)}-${pad(dia)}`;
          const doDia = porDia.get(iso) ?? [];
          const ehHoje = iso === hoje;
          return (
            <div key={iso}
              className={cn("min-h-[74px] rounded-lg border p-1 flex flex-col gap-0.5 overflow-hidden",
                ehHoje ? "border-primary bg-primary/[0.04]" : "border-border bg-background")}>
              <span className={cn("text-[10.5px] font-body font-bold w-5 h-5 grid place-items-center rounded-full shrink-0",
                ehHoje ? "bg-primary text-primary-foreground" : "text-muted-foreground")}>{dia}</span>
              {doDia.slice(0, 3).map((c) => {
                const cli = c.crm_client_id ? clientById.get(c.crm_client_id) : null;
                const nome = cli?.nome ?? c.client_name ?? "Captação";
                const cor = cli?.color || "#EA4918";
                const concluida = c.status === "concluida";
                return (
                  <span key={c.id} title={`${nome}${c.capture_time ? ` · ${c.capture_time.slice(0, 5)}` : ""}`}
                    className={cn("truncate rounded px-1 py-0.5 text-[9.5px] font-body font-semibold", concluida && "opacity-55 line-through")}
                    style={{ background: `${cor}1f`, color: cor }}>
                    {c.capture_time ? `${c.capture_time.slice(0, 5)} ` : ""}{nome}
                  </span>
                );
              })}
              {doDia.length > 3 && (
                <span className="text-[9.5px] font-body text-muted-foreground px-1">+{doDia.length - 3}</span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function SugestoesViagem({ trips, onAdd, onDismiss }: {
  trips: TripSuggestion[];
  onAdd: (input: { clientId: string; date: string; time: string | null; location: string | null }) => Promise<unknown>;
  onDismiss: () => void;
}) {
  // "cidade|clientId" da linha em gravação agora (desabilita o botão só dela).
  const [busy, setBusy] = useState<string | null>(null);

  const marcar = async (city: string, cand: TripCandidate, date: string, location: string | null) => {
    const key = `${city}|${cand.id}`;
    setBusy(key);
    try {
      await onAdd({ clientId: cand.id, date, time: cand.habitTime, location });
    } catch {
      /* o toast de erro já vem do hook de add. */
    } finally {
      setBusy(null);
    }
  };

  return (
    <div data-tour="cap-viagem" className="rounded-2xl border border-dashed border-primary/30 bg-primary/[0.03] p-4">
      <div className="flex items-start gap-2">
        <Sparkles className="h-4 w-4 text-primary shrink-0 mt-0.5" />
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-display font-bold text-foreground">Aproveita a viagem</h2>
          <p className="text-[11px] font-body text-muted-foreground mt-0.5">
            Clientes da mesma cidade que ainda não foram captados este mês. Se quiser, agrupe numa ida só.
          </p>
        </div>
        <button type="button" onClick={onDismiss}
          className="shrink-0 grid h-6 w-6 place-items-center rounded-full text-muted-foreground/60 hover:text-foreground hover:bg-muted transition-colors"
          aria-label="Dispensar sugestões">
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="mt-3 space-y-3">
        {trips.map((t) => (
          <div key={t.city} className="rounded-xl border border-border bg-card p-3">
            <p className="flex items-center gap-1.5 text-xs font-body font-semibold text-foreground">
              <Route className="h-3.5 w-3.5 text-primary shrink-0" />
              Você vai em {t.city}{" "}
              {t.allDates.length > 1
                ? <>nos dias <span className="tabular-nums">{t.allDates.map(diaMes).join(", ")}</span></>
                : <>dia <span className="tabular-nums">{diaMes(t.allDates[0])}</span></>}
            </p>
            <div className="mt-2 flex flex-col gap-1.5">
              {t.candidates.map((cand) => {
                const key = `${t.city}|${cand.id}`;
                const dica = habitoLabel(cand.habitDay, cand.habitTime);
                return (
                  <div key={cand.id} className="flex items-center gap-2">
                    <div className="min-w-0 flex-1">
                      <span className="text-[13px] font-body text-foreground break-words">{cand.nome}</span>
                      {(dica || cand.pendingDate) && (
                        <span className="block text-[10px] font-body text-muted-foreground">
                          {dica}
                          {dica && cand.pendingDate ? " · " : ""}
                          {cand.pendingDate ? `já tem pendente ${diaMes(cand.pendingDate)}` : ""}
                        </span>
                      )}
                    </div>
                    <Button size="sm" variant="outline" onClick={() => marcar(t.city, cand, t.targetDate, t.location)}
                      disabled={busy === key}
                      className="h-8 rounded-lg px-2.5 shrink-0 whitespace-nowrap"
                      title={`Marca captação pro ${cand.nome} dia ${diaMes(t.targetDate)}.`}>
                      {busy === key
                        ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        : <><Plus className="h-3.5 w-3.5 sm:mr-1.5" /><span className="hidden sm:inline">Marcar {diaMes(t.targetDate)}</span></>}
                    </Button>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Uma captação (cliente + cidade + status + roteiro + copiar) ────────────────
function CaptureRow({ cap, nome, cidade, onToggle, onSaveRoteiro, onTeleprompter, shotList, onSaveShotList, defaultShots, clientShots, recurring, recurrenceDay, onSetRecurring, convertedPostId, onVirarPost, onVerPost, converting, roteirosDoDia, acoesRoteiro }: {
  cap: Capture; nome: string; cidade: string;
  onToggle: () => void; onSaveRoteiro: (roteiro: string) => Promise<unknown>;
  onTeleprompter: () => void;
  // VÁRIOS roteiros por dia (um por vídeo). Quando a pasta do cliente passa
  // estas props, o campo único some e entra a lista com +, ordem e check.
  roteirosDoDia?: CaptureScript[];
  acoesRoteiro?: {
    adicionar: () => void;
    editar: (s: CaptureScript) => void;
    excluir: (s: CaptureScript) => void;
    toggleGravado: (s: CaptureScript) => void;
    reordenar: (ids: string[]) => void;
    teleprompter: (s: CaptureScript) => void;
    salvando?: boolean;
  };
  shotList: ShotItem[];
  onSaveShotList: (list: ShotItem[]) => void;
  // Lista padrão que a social mídia configurou (vazio = cai no fallback fixo).
  defaultShots: string[];
  // Tomadas padrão DESTE cliente (crm_clients.capture_shots): vence a geral.
  clientShots?: string[];
  recurring: boolean;
  recurrenceDay: number | null;
  onSetRecurring: (on: boolean, day: number) => Promise<unknown>;
  // "Virar post": null em convertedPostId = ainda não virou (mostra o botão);
  // preenchido = já virou (mostra o atalho pro post).
  convertedPostId: string | null;
  onVirarPost: () => void;
  onVerPost: () => void;
  converting: boolean;
}) {
  const done = cap.status === "concluida";
  const roteiro = (cap.roteiro ?? "").trim();
  const [copied, setCopied] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(roteiro);
  const [saving, setSaving] = useState(false);

  // ── Tomadas (checklist da gravação) ──────────────────────────────────────────
  const feitas = shotList.filter((s) => s.feito).length;
  const [shotsOpen, setShotsOpen] = useState(false);
  const [novaTomada, setNovaTomada] = useState("");
  const addShot = () => {
    const t = novaTomada.trim();
    if (!t) return;
    onSaveShotList([...shotList, { id: newShotId(), texto: t, feito: false }]);
    setNovaTomada("");
  };
  const toggleShot = (id: string) => onSaveShotList(shotList.map((s) => (s.id === id ? { ...s, feito: !s.feito } : s)));
  const removeShot = (id: string) => onSaveShotList(shotList.filter((s) => s.id !== id));
  // "Usar tomadas padrão": usa a lista que a social mídia configurou nas
  // Configurações da captação; se ela não configurou nada, cai na lista fixa.
  const usarPadrao = () => {
    const base = clientShots && clientShots.length > 0
      ? clientShots
      : defaultShots.length > 0 ? defaultShots : [...DEFAULT_SHOT_LIST];
    onSaveShotList(base.map((texto) => ({ id: newShotId(), texto, feito: false })));
    setShotsOpen(true);
  };

  // ── Recorrência (repetir todo mês, por dia do mês) ───────────────────────────
  const capDay = parseDateOnly(cap.capture_date).getDate();
  const clampDay = (v: number) => Math.min(31, Math.max(1, Math.round(v) || 1));
  const [dayDraft, setDayDraft] = useState<number>(() => clampDay(recurrenceDay ?? capDay));
  // Se a raiz mudar o dia (ex.: editada em outra ocorrência), reflete no input.
  useEffect(() => { if (recurrenceDay && recurrenceDay >= 1) setDayDraft(clampDay(recurrenceDay)); }, [recurrenceDay]);
  const [recBusy, setRecBusy] = useState(false);
  const toggleRecorrencia = async (on: boolean) => {
    setRecBusy(true);
    try {
      await onSetRecurring(on, clampDay(dayDraft));
      toast.success(on ? "Captação vai repetir todo mês." : "Recorrência cancelada. As já criadas ficam.");
    } catch {
      toast.error("Não consegui salvar a recorrência.");
    } finally {
      setRecBusy(false);
    }
  };
  const changeDay = (v: number) => {
    const d = clampDay(v);
    setDayDraft(d);
    if (recurring) onSetRecurring(true, d).catch(() => toast.error("Não consegui salvar o dia da recorrência."));
  };

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
            {recurring && (
              <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 text-primary px-1.5 py-0.5 text-[10px] font-body font-bold uppercase tracking-wide"
                title={`Repete todo mês, dia ${recurrenceDay ?? capDay}.`}>
                <Repeat className="h-2.5 w-2.5" /> Recorrente
              </span>
            )}
          </div>
        </div>
        {/* Status: toca pra alternar pendente <-> concluída */}
        <button type="button" data-tour="cap-status" onClick={onToggle}
          className={cn("shrink-0 inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-body font-bold transition-colors",
            done
              ? "bg-[hsl(var(--cria-verde)/0.12)] text-[hsl(var(--cria-verde))]"
              : "bg-[hsl(var(--cria-amarelo)/0.15)] text-[hsl(var(--cria-amarelo))]")}>
          {done ? <><CheckCircle2 className="h-3.5 w-3.5" /> Concluída</> : <><Clock className="h-3.5 w-3.5" /> Pendente</>}
        </button>
      </div>

      {/* ROTEIROS DA GRAVAÇÃO.
          Um dia rende vários vídeos: aqui é uma LISTA (com +, ordem, check e
          lixeira), não mais um campo de texto único. O modo antigo continua
          disponível como reserva pra telas que ainda não passam as ações. */}
      {acoesRoteiro ? (
        <RoteirosDoDia
          roteiros={roteirosDoDia ?? []}
          onAdicionar={acoesRoteiro.adicionar}
          onEditar={acoesRoteiro.editar}
          onExcluir={acoesRoteiro.excluir}
          onToggleGravado={acoesRoteiro.toggleGravado}
          onReordenar={acoesRoteiro.reordenar}
          onTeleprompter={acoesRoteiro.teleprompter}
          salvando={acoesRoteiro.salvando}
        />
      ) : (
      <>{/* Roteiro da gravação: SEMPRE visível, com título e um estado vazio claro
          que convida a escrever. Assim que há texto, aparecem "Copiar roteiro" e
          "Usar como teleprompter" (antes escondidos atrás do "tem roteiro", e por
          isso a pessoa "não achava" onde copiar/abrir o teleprompter). */}
      <div data-tour="cap-roteiro" className="mt-3 rounded-xl border border-border bg-muted/20 p-3">
        <div className="flex items-center gap-2">
          <FileText className="h-3.5 w-3.5 text-primary shrink-0" />
          <span className="text-xs font-body font-semibold text-foreground">Roteiro da gravação</span>
        </div>
        {editing ? (
          <div className="mt-2.5">
            <Textarea rows={4} value={draft} onChange={(e) => setDraft(e.target.value)} autoFocus
              placeholder="Escreva o que vai ser falado/gravado nessa captação…" className="rounded-xl text-sm" />
            <div className="flex items-center gap-2 mt-2">
              <Button size="sm" onClick={salvar} disabled={saving} className="rounded-xl">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Salvar roteiro"}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setEditing(false)} className="rounded-xl">Cancelar</Button>
            </div>
          </div>
        ) : roteiro ? (
          <div className="mt-2.5">
            <p className="text-[13px] font-body text-foreground whitespace-pre-wrap break-words">{roteiro}</p>
            <div className="flex items-center gap-2 mt-2.5 flex-wrap">
              <Button data-tour="cap-teleprompter" size="sm" onClick={onTeleprompter} className="rounded-xl h-9"
                title="Entregue o celular pro cliente ler o roteiro no teleprompter enquanto você grava na câmera.">
                <Play className="h-3.5 w-3.5 mr-1.5" /> Usar como teleprompter
              </Button>
              <Button size="sm" variant="outline" onClick={copiar} className="rounded-xl h-9">
                {copied ? <><Check className="h-3.5 w-3.5 mr-1.5" /> Copiado</> : <><Copy className="h-3.5 w-3.5 mr-1.5" /> Copiar roteiro</>}
              </Button>
              <Button size="sm" variant="ghost" onClick={abrirEdicao} className="rounded-xl h-9">
                <Pencil className="h-3.5 w-3.5 mr-1.5" /> Editar
              </Button>
            </div>
          </div>
        ) : (
          <div className="mt-2">
            <p className="text-[11.5px] font-body text-muted-foreground">
              Escreva o que vai ser falado ou gravado. Depois dá pra copiar o texto e abrir no teleprompter.
            </p>
            <Button size="sm" onClick={abrirEdicao} className="rounded-xl h-9 mt-2 w-full sm:w-auto">
              <Pencil className="h-3.5 w-3.5 mr-1.5" /> Escrever roteiro
            </Button>
          </div>
        )}
      </div></>
      )}

      {/* Tomadas: o que precisa sair dessa gravação (mini-acordeão + contador). */}
      <div data-tour="cap-tomadas" className="mt-3 rounded-xl border border-border overflow-hidden">
        <button type="button" onClick={() => setShotsOpen((o) => !o)}
          className="w-full flex items-center gap-2 px-3 py-2.5 text-left hover:bg-muted/30 transition-colors">
          <ListChecks className="h-4 w-4 text-primary shrink-0" />
          <div className="min-w-0 flex-1">
            <span className="text-xs font-body font-semibold text-foreground">Tomadas (o que precisa gravar)</span>
            <p className="text-[10.5px] font-body text-muted-foreground leading-snug">
              A lista do que tem que sair dessa gravação: reels, fotos, stories. Marque conforme grava, pra não faltar nada.
            </p>
          </div>
          {shotList.length > 0 && (
            <span className={cn("shrink-0 text-[11px] font-body font-bold tabular-nums rounded-full px-1.5 py-0.5",
              feitas === shotList.length
                ? "bg-[hsl(var(--cria-verde)/0.12)] text-[hsl(var(--cria-verde))]"
                : "bg-muted text-muted-foreground")}>
              {feitas}/{shotList.length}
            </span>
          )}
          <ChevronDown className={cn("h-4 w-4 text-muted-foreground shrink-0 transition-transform", shotsOpen && "rotate-180")} />
        </button>
        {shotsOpen && (
          <div className="px-3 pb-3 pt-0.5 space-y-1.5 border-t border-border">
            {shotList.length === 0 ? (
              <div className="pt-2 flex flex-col items-start gap-2">
                <p className="text-[11px] font-body text-muted-foreground">Nenhuma tomada ainda. Liste o que precisa sair da gravação.</p>
                <Button variant="outline" size="sm" onClick={usarPadrao} className="rounded-lg h-8">
                  <Plus className="h-3.5 w-3.5 mr-1.5" /> Usar tomadas padrão
                </Button>
              </div>
            ) : (
              shotList.map((s) => (
                <div key={s.id} className="flex items-center gap-2">
                  {/* Área de toque generosa no mobile (p-1.5 -m-1 ~ 36px). */}
                  <button type="button" onClick={() => toggleShot(s.id)}
                    className="shrink-0 p-1.5 -m-1 text-muted-foreground hover:text-foreground transition-colors"
                    aria-label={s.feito ? `Desmarcar ${s.texto}` : `Marcar ${s.texto} como feito`}>
                    {s.feito
                      ? <CheckSquare className="h-4 w-4 text-[hsl(var(--cria-verde))]" />
                      : <Square className="h-4 w-4" />}
                  </button>
                  <span className={cn("flex-1 min-w-0 text-[13px] font-body break-words",
                    s.feito ? "line-through text-muted-foreground" : "text-foreground")}>{s.texto}</span>
                  <button type="button" onClick={() => removeShot(s.id)}
                    className="shrink-0 grid h-6 w-6 place-items-center rounded-full text-muted-foreground/60 hover:text-destructive hover:bg-destructive/10 transition-colors"
                    aria-label={`Remover ${s.texto}`}>
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))
            )}
            <div className="flex gap-2 pt-1">
              <Input value={novaTomada} onChange={(e) => setNovaTomada(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addShot(); } }}
                placeholder="Ex.: 1 Reels" className="h-8 rounded-lg text-sm" />
              <Button size="sm" onClick={addShot} disabled={!novaTomada.trim()} className="h-8 rounded-lg shrink-0" aria-label="Adicionar tomada">
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Recorrência: repetir todo mês no mesmo dia (o app materializa as próximas). */}
      <div className="mt-2 flex items-center justify-between gap-2 rounded-xl border border-dashed border-border px-3 py-2">
        <div className="flex items-center gap-2 min-w-0">
          <Repeat className="h-3.5 w-3.5 text-primary shrink-0" />
          <span className="text-xs font-body text-foreground">Repetir todo mês</span>
          {recurring && (
            <span className="inline-flex items-center gap-1 text-[11px] font-body text-muted-foreground whitespace-nowrap">
              · dia
              <input type="number" min={1} max={31} value={dayDraft}
                onChange={(e) => changeDay(Number(e.target.value))}
                className="w-14 h-9 rounded-lg border border-border bg-card px-1.5 text-center text-sm font-body text-foreground outline-none focus:border-primary/50" />
            </span>
          )}
        </div>
        <Switch checked={recurring} disabled={recBusy} onCheckedChange={toggleRecorrencia} aria-label="Repetir captação todo mês" />
      </div>

      {/* Nota livre da captação (se houver), pra contexto */}
      {cap.note && cap.note.trim() && (
        <p className="mt-2 text-[11px] font-body text-muted-foreground/80 italic break-words">{cap.note}</p>
      )}

      {/* Virar post: manda o roteiro/nota desta captação pro Cria Post do cliente como
          rascunho. Já virou (convertedPostId) = vira atalho pro post, sem duplicar. */}
      <div data-tour="cap-virarpost" className="mt-3 pt-3 border-t border-border/60">
        {convertedPostId ? (
          <button type="button" onClick={onVerPost}
            className="inline-flex items-center gap-1.5 text-[11.5px] font-body font-semibold text-primary">
            <Check className="h-3.5 w-3.5" /> Virou post · ver no Cria Post
          </button>
        ) : (
          <Button size="sm" variant="outline" onClick={onVirarPost} disabled={converting}
            className="h-8 rounded-xl w-full sm:w-auto"
            title="Cria um rascunho no Cria Post deste cliente com o roteiro e a nota desta captação.">
            {converting ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Send className="h-3.5 w-3.5 mr-1.5" />}
            Virar post
          </Button>
        )}
      </div>
    </div>
  );
}

// ── Folha do dia (todos os roteiros do dia + local num texto só) ───────────────
// Copiar tudo é o principal; o PDF é bônus (reusa usePdfExport). O corpo do PDF
// usa estilo inline com hex porque o html2canvas do usePdfExport não lê CSS vars.
function FolhaDoDiaDialog({ open, onOpenChange, diaLabel, wd, local, items }: {
  open: boolean; onOpenChange: (o: boolean) => void;
  diaLabel: string; wd: string; local: string; items: FolhaItem[];
}) {
  const [copied, setCopied] = useState(false);
  const [pdfBusy, setPdfBusy] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);
  const { exportPdf } = usePdfExport();

  const texto = useMemo(() => montarFolhaTexto(diaLabel, wd, local, items), [diaLabel, wd, local, items]);

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(texto);
      setCopied(true);
      toast.success("Folha do dia copiada");
      setTimeout(() => setCopied(false), 1600);
    } catch {
      toast.error("Não consegui copiar. Copie manualmente.");
    }
  };

  const baixarPdf = async () => {
    setPdfBusy(true);
    try {
      const base = `folha-${diaLabel}-${local || "local"}`
        .toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
        .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
      await exportPdf(printRef, base || "folha-do-dia");
    } catch {
      toast.error("Não consegui gerar o PDF. Use o Copiar tudo.");
    } finally {
      setPdfBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg sm:max-h-[85vh] flex flex-col">
        <DialogHeader><DialogTitle className="font-display">Folha do dia · {diaLabel}</DialogTitle></DialogHeader>
        <p className="text-xs text-muted-foreground font-body">
          Todos os roteiros {local ? `de ${local} ` : ""}nesse dia num texto só, pra social mídia levar pra captação sem abrir cliente por cliente.
        </p>

        {items.length === 0 ? (
          <p className="text-sm font-body text-foreground py-8 text-center">Nenhuma captação com roteiro nesse dia ainda.</p>
        ) : (
          <>
            <div className="flex-1 overflow-y-auto rounded-xl border border-border bg-muted/20">
              <div ref={printRef} style={{ background: "#ffffff", color: "#1a1a2e", padding: "20px 22px", fontFamily: "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif" }}>
                <div style={{ fontSize: 16, fontWeight: 700, color: "#EA4918" }}>Folha do dia</div>
                <div style={{ fontSize: 12.5, color: "#6b7280", marginTop: 2 }}>
                  {diaLabel} ({wd}){local ? ` · ${local}` : ""}
                </div>
                <div style={{ height: 1, background: "#e5e7eb", margin: "12px 0" }} />
                {items.map((it, i) => {
                  const meta = [it.cidade, it.horario].filter(Boolean).join(" · ");
                  return (
                    <div key={i} data-pdf-block style={{ marginBottom: 16 }}>
                      <div style={{ fontSize: 13.5, fontWeight: 700, color: "#1a1a2e" }}>
                        {it.nome}{meta ? <span style={{ color: "#6b7280", fontWeight: 400 }}> · {meta}</span> : null}
                      </div>
                      <div style={{ fontSize: 12.5, color: "#1a1a2e", whiteSpace: "pre-wrap", marginTop: 4, lineHeight: 1.5 }}>{it.roteiro}</div>
                    </div>
                  );
                })}
              </div>
            </div>

            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={baixarPdf} disabled={pdfBusy} className="rounded-xl">
                {pdfBusy ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Download className="h-4 w-4 mr-1.5" />}
                Baixar PDF
              </Button>
              <Button onClick={copiar} className="rounded-xl">
                {copied ? <><Check className="h-4 w-4 mr-1.5" /> Copiado</> : <><Copy className="h-4 w-4 mr-1.5" /> Copiar tudo</>}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ── Pasta do cliente: roteiros do mês (vários), captações e tomadas dele ──────
// A pasta é o dossiê de gravação do cliente. O mês vem do cabeçalho da página
// (as setas navegam meses passados e futuros). Aqui nasce roteiro manual,
// roteiro puxado dos reels aprovados do Cria Post, e a captação marcada direto.
function PastaCliente({ pasta, month, scripts, caps, habit, clientShots, savingClientShots, onSaveClientShots, ext, onBack, onDeleteExtra, onPrompter, renderCapture, onSaveCapRoteiro, addCapture, addingCapture, logoCliente, logoAgencia, elaboradoPor, corCliente }: {
  pasta: PastaInfo;
  // Marca do guia em PDF: as MESMAS logos do relatório do cliente, pra o
  // material que chega na mão dele ter sempre a mesma cara.
  logoCliente?: string | null;
  logoAgencia?: string | null;
  elaboradoPor?: string | null;
  /** Cor da marca do cliente: a capa do guia sai na cor dele, não na do Cria. */
  corCliente?: string | null;
  month: string;
  scripts: CaptureScript[];
  caps: Capture[];
  habit: string | null;
  clientShots: string[];
  savingClientShots: boolean;
  onSaveClientShots: ((list: string[]) => Promise<unknown>) | null;
  ext: { id: string; name: string } | null;
  onBack: () => void;
  onDeleteExtra?: () => void;
  onPrompter: (title: string, text: string) => void;
  // A pasta manda pro CaptureRow os roteiros DAQUELE dia + as ações.
  renderCapture: (c: Capture, roteiros?: {
    roteiros: CaptureScript[];
    acoes: {
      adicionar: () => void; editar: (s: CaptureScript) => void; excluir: (s: CaptureScript) => void;
      toggleGravado: (s: CaptureScript) => void; reordenar: (ids: string[]) => void;
      teleprompter: (s: CaptureScript) => void; salvando?: boolean;
    };
  }) => ReactNode;
  // Salva o roteiro que vive DENTRO de uma captação (agenda_captures.roteiro).
  onSaveCapRoteiro: (id: string, roteiro: string) => Promise<unknown>;
  addCapture: (input: { capture_date: string; capture_time: string | null; location: string | null; crm_client_id: string | null; client_name: string | null }) => Promise<unknown>;
  addingCapture: boolean;
}) {
  const navigate = useNavigate();
  const addScript = useAddCaptureScript();
  const updScript = useUpdateCaptureScript();
  const delScript = useDeleteCaptureScript();
  const reorderScripts = useReorderCaptureScripts();
  const toPost = useScriptToPost();

  const [gerandoGuia, setGerandoGuia] = useState(false);
  // Ordem local (otimista) enquanto o arrasto não persiste.
  const [ordemLocal, setOrdemLocal] = useState<string[] | null>(null);

  const [editorOpen, setEditorOpen] = useState(false);
  const [editando, setEditando] = useState<CaptureScript | null>(null);
  // Dia de gravação que vai receber o roteiro novo (null = roteiro solto no mês).
  const [capturaAlvo, setCapturaAlvo] = useState<Capture | null>(null);
  // Roteiro aberto no modal (card estilo Drive clicado). Guarda só o id: o
  // conteúdo vem SEMPRE da lista fresca, pra refletir edições na hora.
  const [verId, setVerId] = useState<string | null>(null);
  // Roteiro DE CAPTAÇÃO aberto/em edição (o campo que vive dentro da captação
  // aparece na MESMA grade, como card "Captação DD/MM").
  const [verCapId, setVerCapId] = useState<string | null>(null);
  const [editandoCapId, setEditandoCapId] = useState<string | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [marcarOpen, setMarcarOpen] = useState(false);
  const [tomadasOpen, setTomadasOpen] = useState(false);

  const salvarRoteiro = async (v: RoteiroFormValor) => {
    // Roteiro que vive DENTRO de uma captação continua sendo texto corrido.
    if (editandoCapId) {
      await onSaveCapRoteiro(editandoCapId, v.content);
      setEditorOpen(false); setEditandoCapId(null);
      return;
    }
    const campos = {
      title: v.title, content: v.content, about: v.about || null,
      reference_url: v.reference_url || null, record_date: v.record_date || null,
      location: v.location || null, format: v.format || null, scenes: v.scenes,
    };
    if (editando) {
      await updScript.mutateAsync({ id: editando.id, patch: campos });
    } else {
      // Roteiro criado DENTRO de um dia herda a data e o local da captação:
      // ninguém quer redigitar o que já está marcado na agenda.
      const doDia = capturaAlvo
        ? {
            capture_id: capturaAlvo.id,
            record_date: campos.record_date || capturaAlvo.capture_date,
            location: campos.location || capturaAlvo.location || null,
            position: scripts.filter((s) => s.capture_id === capturaAlvo.id).length,
          }
        : { position: scripts.length };
      await addScript.mutateAsync({
        crm_client_id: pasta.crmId, client_name: pasta.crmId ? null : pasta.nome,
        month, ...campos, ...doDia,
      });
    }
    setEditorOpen(false); setEditando(null); setCapturaAlvo(null);
  };

  // Ordem de gravação: arrastar reordena na hora e salva a posição no banco.
  const ordenados: CaptureScript[] = (() => {
    if (!ordemLocal) return scripts;
    const byId = new Map(scripts.map((s) => [s.id, s]));
    const fora = scripts.filter((s) => !ordemLocal.includes(s.id));
    return [...ordemLocal.map((id) => byId.get(id)).filter(Boolean) as CaptureScript[], ...fora];
  })();

  const aoArrastarRoteiro = (r: DropRoteiroResult) => {
    if (!r.destination || r.destination.index === r.source.index) return;
    const ids = ordenados.map((s) => s.id);
    const [m] = ids.splice(r.source.index, 1);
    ids.splice(r.destination.index, 0, m);
    setOrdemLocal(ids);
    reorderScripts.mutate(ids, { onSettled: () => setOrdemLocal(null) });
  };

  // O guia leva a biblioteca do mês MAIS os roteiros escritos dentro das
  // captações: pra quem grava, os dois são "vídeo pra gravar". Antes só a
  // biblioteca contava, e quem só tinha o roteiro da captação via o botão
  // desligado sem entender o porquê.
  const roteirosDoGuia = (() => {
    const daCaptacao = caps
      .filter((c) => (c.roteiro ?? "").trim() && !scripts.some((s) => s.capture_id === c.id))
      .map((c) => ({
        id: `cap-${c.id}`,
        title: `Captação ${diaMes(c.capture_date)}`,
        content: (c.roteiro ?? "").trim(),
        about: c.note ?? null,
        record_date: c.capture_date,
        location: c.location ?? null,
        format: null, reference_url: null, scenes: [],
        done: c.status === "concluida",
      })) as unknown as CaptureScript[];
    const capturaDe = new Map(caps.map((c) => [c.id, c.capture_date]));
    const dia = (r: CaptureScript) => r.record_date || (r.capture_id ? capturaDe.get(r.capture_id) : null) || "9999-12-31";
    return [...ordenados, ...daCaptacao].sort((a, b) => dia(a).localeCompare(dia(b)));
  })();

  const capasGuia = useLinkPreviews(
    roteirosDoGuia.flatMap((r) => parseRefLinks(r.reference_url).filter(isRefLink)));

  const baixarGuia = async () => {
    if (roteirosDoGuia.length === 0) { toast.error("Escreva pelo menos um roteiro deste mês pra gerar o guia."); return; }
    setGerandoGuia(true);
    try {
      const slug = pasta.nome.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
      // Capas já resolvidas viram { link -> imagem } pro gerador não ter que
      // adivinhar nada nem depender do DOM.
      const capasMapa: Record<string, string | null> = {};
      for (const [k, v] of Object.entries(capasGuia)) capasMapa[k] = v?.thumb ?? null;
      await baixarGuiaGravacao({
        cliente: pasta.nome, mesLabel: monthLabel(month), roteiros: roteirosDoGuia,
        logoCliente, logoAgencia, elaboradoPor, cor: corCliente, capas: capasMapa,
      }, `guia-de-gravacao-${slug || "cliente"}-${month}`);
      toast.success("Guia de gravação baixado!");
    } catch { toast.error("Não consegui gerar o PDF agora."); }
    finally { setGerandoGuia(false); }
  };

  const virarPost = async (s: CaptureScript) => {
    if (!ext) { toast.error("O Cria Post não está ativo pra este cliente."); return; }
    try {
      await toPost.mutateAsync({ scriptId: s.id, externalClientId: ext.id, title: `${pasta.nome} · ${s.title.trim() || "roteiro"}`, script: s.content });
      if (pasta.crmId) navigate(`/socialmidia/clientes/${pasta.crmId}/posts`);
    } catch { /* o hook já avisa */ }
  };

  const gravados = scripts.filter((s) => s.done).length;

  return (
    <div className="space-y-4">
      {/* Cabeçalho da pasta */}
      <div className="rounded-2xl border border-border bg-card p-4">
        <div className="flex items-center gap-3">
          <button type="button" onClick={onBack}
            className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-border text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Voltar pras pastas">
            <ArrowLeft className="h-4 w-4" />
          </button>
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl text-white text-sm font-display font-extrabold"
            style={{ background: pasta.cor || "#EA4918" }}>
            {pasta.nome.slice(0, 1).toUpperCase()}
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="text-base font-display font-extrabold text-foreground truncate">{pasta.nome}</h2>
            <p className="text-[11px] font-body text-muted-foreground truncate">
              {[pasta.cidade, habit, pasta.extraId ? "cliente avulso" : null].filter(Boolean).join(" · ") || "Pasta de captação"}
            </p>
          </div>
          {onDeleteExtra && (
            <button type="button"
              onClick={() => { if (window.confirm(`Remover a pasta de ${pasta.nome}?`)) onDeleteExtra(); }}
              className="shrink-0 grid h-8 w-8 place-items-center rounded-lg text-muted-foreground/60 hover:text-destructive hover:bg-destructive/10 transition-colors"
              aria-label="Remover cliente avulso">
              <Trash2 className="h-4 w-4" />
            </button>
          )}
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Button size="sm" onClick={() => { setEditando(null); setEditorOpen(true); }} className="rounded-xl h-9">
            <Plus className="h-3.5 w-3.5 mr-1.5" /> Novo roteiro
          </Button>
          {ext && (
            <Button size="sm" variant="outline" onClick={() => setImportOpen(true)} className="rounded-xl h-9"
              title="Importa os roteiros dos reels aprovados no Cria Post deste cliente.">
              <Film className="h-3.5 w-3.5 mr-1.5" /> Puxar dos reels aprovados
            </Button>
          )}
          <Button size="sm" variant="outline" onClick={() => setMarcarOpen(true)} className="rounded-xl h-9">
            <CalendarPlus className="h-3.5 w-3.5 mr-1.5" /> Marcar captação
          </Button>
          {/* O GUIA: é o documento que ela leva pro dia da gravação e manda pro
              cliente. Sem ele, o módulo só guardava texto. */}
          <Button size="sm" variant="outline" onClick={() => void baixarGuia()} disabled={gerandoGuia || roteirosDoGuia.length === 0}
            className="rounded-xl h-9"
            title={roteirosDoGuia.length === 0
              ? "Escreva pelo menos um roteiro deste mês pra gerar o guia."
              : `Baixa o guia em PDF com ${roteirosDoGuia.length} ${roteirosDoGuia.length === 1 ? "vídeo" : "vídeos"}: um por página, com cenas e direção.`}>
            {gerandoGuia ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <FileDown className="h-3.5 w-3.5 mr-1.5" />}
            Guia de gravação (PDF)
          </Button>
          {/* O cliente revisa ANTES da gravação. Fora do sistema isso vira áudio
              de WhatsApp e a social mídia reescreve tudo na mão. */}
          <BotaoEnviarAprovacao month={month} crmClientId={pasta.crmId} clientName={pasta.nome} roteiros={roteirosDoGuia} />
        </div>
      </div>

      {/* Revisões do cliente: link aberto, o que voltou e o botão de confirmar. */}
      <PainelAprovacoes month={month} crmClientId={pasta.crmId} clientName={pasta.nome} />

      {/* Roteiros do mês: a biblioteca (quantos quiser) + os roteiros escritos
          DENTRO das captações do mês, tudo na MESMA grade. Antes o roteiro da
          captação ficava escondido na captação e a grade parecia vazia. */}
      {(() => {
        // Os roteiros JÁ ligados a um dia moram dentro da captação: aqui em cima
        // ficam só os soltos (pauta pronta, dia ainda não marcado).
        const soltos = ordenados.filter((s) => !s.capture_id);
        const capsComRoteiro = caps.filter((c) => (c.roteiro ?? "").trim() && !scripts.some((s) => s.capture_id === c.id));
        const totalRoteiros = soltos.length + capsComRoteiro.length;
        const noDia = scripts.filter((s) => !!s.capture_id).length;
        return (
      <div>
        <h3 className="flex items-center gap-1.5 text-sm font-display font-bold text-foreground mb-2">
          <FileText className="h-4 w-4 text-primary" /> Roteiros de {monthLabel(month).toLowerCase()}
          {scripts.length > 0 && (
            <span className="text-[11px] font-body font-semibold text-muted-foreground">({gravados}/{scripts.length} gravados)</span>
          )}
        </h3>
        {totalRoteiros === 0 ? (
          <div className="rounded-2xl border border-dashed border-border p-6 text-center">
            {/* Dizer "nenhum roteiro" com roteiros dentro das captações é
                mentira e assusta: aqui em cima só moram os que não têm dia. */}
            {noDia > 0 ? (
              <>
                <p className="text-sm font-body text-foreground font-medium">
                  {noDia === 1 ? "O roteiro deste mês está" : `Os ${noDia} roteiros deste mês estão`} dentro das captações
                </p>
                <p className="text-xs text-muted-foreground font-body mt-1 max-w-sm mx-auto">
                  Abra o dia de gravação aqui embaixo pra ver, reordenar e editar. Esta lista mostra só os roteiros que ainda não têm dia marcado.
                </p>
              </>
            ) : (
              <>
                <p className="text-sm font-body text-foreground font-medium">Nenhum roteiro neste mês</p>
                <p className="text-xs text-muted-foreground font-body mt-1 max-w-sm mx-auto">
                  Adicione quantos quiser no Novo roteiro{ext ? " ou puxe dos reels aprovados" : ""}. As setas do mês lá em cima mostram os meses anteriores e os próximos.
                </p>
              </>
            )}
          </div>
        ) : (
          /* LISTA NA ORDEM DE GRAVAÇÃO. A grade de cards não dizia o que gravar
             primeiro nem deixava reordenar: virava um monte de quadradinho
             igual. Aqui cada linha é um vídeo, numerado, arrastável, mostrando
             data, formato, quantas cenas tem e se já tem referência. */
          <div className="space-y-2">
            <DndRoteiros onDragEnd={aoArrastarRoteiro}>
              <DropRoteiros droppableId="roteiros">
                {(drop) => (
                  <div ref={drop.innerRef} {...drop.droppableProps} className="space-y-2">
                    {soltos.map((s, i) => (
                      <DragRoteiro key={s.id} draggableId={s.id} index={i}>
                        {(drag, snap) => (
                          <div ref={drag.innerRef} {...drag.draggableProps}
                            className={cn("rounded-2xl border border-border bg-card", snap.isDragging && "shadow-lg ring-2 ring-primary/40")}>
                            <RoteiroLinha script={s} indice={i} onOpen={() => setVerId(s.id)}
                              onExcluir={() => delScript.mutate(s.id, { onSuccess: () => toast.success("Roteiro excluído.") })}
                              handleProps={drag.dragHandleProps ?? undefined} />
                          </div>
                        )}
                      </DragRoteiro>
                    ))}
                    {drop.placeholder}
                  </div>
                )}
              </DropRoteiros>
            </DndRoteiros>
            {/* Roteiros que vivem dentro de uma captação do mês (não reordenam:
                a ordem deles é a data da captação). */}
            {capsComRoteiro.map((c) => (
              <div key={`cap-${c.id}`} className="rounded-2xl border border-dashed border-border bg-card">
                <RoteiroLinha
                  script={{ id: `cap-${c.id}`, title: `Captação ${diaMes(c.capture_date)}`, content: (c.roteiro ?? "").trim(),
                    done: c.status === "concluida", record_date: c.capture_date, format: null, reference_url: null, about: null, scenes: [] } as unknown as CaptureScript}
                  indice={-1} icone="video" onOpen={() => setVerCapId(c.id)} />
              </div>
            ))}
          </div>
        )}
      </div>
        );
      })()}

      {/* Captações do cliente no mês (mesma linha da Agenda do mês). */}
      <div>
        <h3 className="flex items-center gap-1.5 text-sm font-display font-bold text-foreground mb-2">
          <Video className="h-4 w-4 text-primary" /> Captações de {monthLabel(month).toLowerCase()}
        </h3>
        {caps.length === 0 ? (
          <p className="text-xs font-body text-muted-foreground rounded-2xl border border-dashed border-border p-4">
            Nenhuma captação marcada neste mês. Use o Marcar captação aqui em cima.
          </p>
        ) : (
          /* Compacto por padrão: uma linha por captação (dia, hora, status);
             expandir mostra o card completo (roteiro, tomadas, virar post). */
          <div className="rounded-2xl border border-border bg-card divide-y divide-border overflow-hidden">
            {caps.map((c) => {
              const done = c.status === "concluida";
              const temRoteiro = !!(c.roteiro ?? "").trim();
              return (
                <details key={c.id} className="group/cap">
                  <summary className="flex items-center gap-2.5 px-4 py-3 cursor-pointer list-none [&::-webkit-details-marker]:hidden hover:bg-muted/30 transition-colors">
                    <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0 transition-transform group-open/cap:rotate-90" />
                    <span className="text-sm font-display font-bold text-foreground tabular-nums shrink-0">{diaMes(c.capture_date)}</span>
                    {c.capture_time && <span className="text-[11px] font-body text-muted-foreground shrink-0">{c.capture_time.slice(0, 5)}</span>}
                    <span className={cn("min-w-0 flex-1 truncate text-[11px] font-body", temRoteiro ? "text-muted-foreground" : "text-[hsl(var(--cria-amarelo))] font-semibold")}>
                      {temRoteiro ? "roteiro pronto" : "sem roteiro"}
                    </span>
                    <span className={cn("shrink-0 inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10.5px] font-body font-bold",
                      done ? "bg-[hsl(var(--cria-verde)/0.12)] text-[hsl(var(--cria-verde))]" : "bg-[hsl(var(--cria-amarelo)/0.15)] text-[hsl(var(--cria-amarelo))]")}>
                      {done ? "Concluída" : "Pendente"}
                    </span>
                  </summary>
                  <div className="border-t border-border/60">{renderCapture(c, {
                    roteiros: scripts.filter((s) => s.capture_id === c.id),
                    acoes: {
                      adicionar: () => { setEditando(null); setCapturaAlvo(c); setEditorOpen(true); },
                      editar: (s) => { setEditando(s); setCapturaAlvo(c); setEditorOpen(true); },
                      excluir: (s) => delScript.mutate(s.id, { onSuccess: () => toast.success("Roteiro excluído.") }),
                      toggleGravado: (s) => updScript.mutate({ id: s.id, patch: { done: !s.done } }),
                      reordenar: (ids) => reorderScripts.mutate(ids),
                      teleprompter: (s) => onPrompter(s.title?.trim() || pasta.nome, s.content || ""),
                      salvando: addScript.isPending,
                    },
                  })}</div>
                </details>
              );
            })}
          </div>
        )}
      </div>

      {/* Tomadas padrão DESTE cliente (só cliente do CRM). */}
      {onSaveClientShots && (
        <div className="rounded-2xl border border-border bg-card overflow-hidden">
          <button type="button" onClick={() => setTomadasOpen((o) => !o)}
            className="w-full flex items-center gap-2 px-4 py-3 text-left hover:bg-muted/30 transition-colors">
            <Clapperboard className="h-4 w-4 text-primary shrink-0" />
            <div className="min-w-0 flex-1">
              <span className="text-sm font-display font-bold text-foreground">Tomadas padrão deste cliente</span>
              <p className="text-[10.5px] font-body text-muted-foreground">
                O combo que você sempre grava pra ele. Quando existe, o Usar tomadas padrão usa esta lista em vez da geral.
              </p>
            </div>
            {clientShots.length > 0 && (
              <span className="text-[11px] font-body font-bold text-muted-foreground tabular-nums shrink-0">{clientShots.length}</span>
            )}
            <ChevronDown className={cn("h-4 w-4 text-muted-foreground shrink-0 transition-transform", tomadasOpen && "rotate-180")} />
          </button>
          {tomadasOpen && (
            <div className="px-4 pb-4 border-t border-border">
              <ChipEditor items={clientShots} onSave={onSaveClientShots} saving={savingClientShots}
                placeholder="Ex.: 2 Reels"
                emptyText="Sem lista própria: este cliente usa as tomadas padrão gerais."
                removeLabel={(s) => `Remover ${s}`} />
            </div>
          )}
        </div>
      )}

      {editorOpen && (
        <RoteiroEditor
          open
          onOpenChange={(o) => { if (!o) { setEditorOpen(false); setEditando(null); setEditandoCapId(null); setCapturaAlvo(null); } }}
          inicial={editandoCapId
            ? ({ id: editandoCapId, title: "", content: caps.find((c) => c.id === editandoCapId)?.roteiro ?? "", scenes: [] } as unknown as CaptureScript)
            : editando}
          salvando={addScript.isPending || updScript.isPending}
          onSalvar={salvarRoteiro} />
      )}
      {importOpen && ext && (
        <ImportarReelsDialog open onOpenChange={(o) => { if (!o) setImportOpen(false); }}
          externalClientId={ext.id}
          jaImportados={new Set(scripts.map((s) => s.source_post_id).filter(Boolean) as string[])}
          onImportar={async (post) => {
            await addScript.mutateAsync({
              crm_client_id: pasta.crmId, client_name: pasta.crmId ? null : pasta.nome,
              month, title: post.title || "Reels aprovado", content: post.script ?? "",
              source: "reel", source_post_id: post.id,
              // A referência que o post já tinha vem junto: é a mesma coisa que
              // a social mídia colaria de novo aqui na mão.
              reference_url: post.reference_url ?? null,
              format: "reels",
            });
          }} />
      )}
      {verId && (() => {
        const s = scripts.find((x) => x.id === verId);
        if (!s) return null;
        return (
          <RoteiroVerDialog script={s}
            onOpenChange={(o) => { if (!o) setVerId(null); }}
            onRename={(t) => updScript.mutate({ id: s.id, patch: { title: t } })}
            onToggleDone={() => updScript.mutate({ id: s.id, patch: { done: !s.done } })}
            onEditar={() => { setEditando(s); setEditorOpen(true); }}
            onExcluir={() => { if (window.confirm("Excluir este roteiro?")) { delScript.mutate(s.id); setVerId(null); } }}
            onPrompter={() => onPrompter(pasta.nome, s.content)}
            onVirarPost={ext && !s.source_post_id ? () => virarPost(s) : null}
            onVerPost={s.source_post_id && pasta.crmId ? () => navigate(`/socialmidia/clientes/${pasta.crmId}/posts`) : null}
            converting={toPost.isPending} />
        );
      })()}
      {verCapId && (() => {
        const c = caps.find((x) => x.id === verCapId);
        if (!c) return null;
        return (
          <RoteiroVerDialog
            script={{ id: c.id, title: `Captação ${diaMes(c.capture_date)}${c.capture_time ? ` · ${c.capture_time.slice(0, 5)}` : ""}`, content: (c.roteiro ?? "").trim(), done: c.status === "concluida", source: "captacao" } as unknown as CaptureScript}
            onOpenChange={(o) => { if (!o) setVerCapId(null); }}
            onEditar={() => { setEditandoCapId(c.id); setEditorOpen(true); }}
            onPrompter={() => onPrompter(pasta.nome, (c.roteiro ?? "").trim())}
            onVirarPost={null} onVerPost={null} converting={false} />
        );
      })()}
      {marcarOpen && (
        <MarcarCaptacaoDialog open onOpenChange={(o) => { if (!o) setMarcarOpen(false); }}
          salvando={addingCapture}
          onSalvar={async (date, time) => {
            await addCapture({ capture_date: date, capture_time: time, location: null, crm_client_id: pasta.crmId, client_name: pasta.crmId ? null : pasta.nome });
            setMarcarOpen(false);
          }} />
      )}
    </div>
  );
}

// ── Card do roteiro estilo Drive: miniatura do texto + título ─────────────────
// Uma linha da ordem de gravação: número, título, e os sinais que dizem se o
// roteiro está PRONTO pra gravar (cenas, referência, data). É o que faltava:
// olhar a lista e saber o que ainda precisa de trabalho.
function RoteiroLinha({ script, indice, onOpen, onExcluir, handleProps, icone = "file" }: {
  script: CaptureScript; indice: number; onOpen: () => void;
  /** Excluir na PRÓPRIA linha: antes só existia dentro do modal e ninguém achava. */
  onExcluir?: () => void;
  handleProps?: DraggableProvidedDragHandleProps;
  icone?: "file" | "video";
}) {
  const Icone = icone === "video" ? Video : FileText;
  const cenas = cenasDe(script);
  const nCenas = cenas.length;
  const previa = (cenas[0]?.fala || script.content || "").replace(/\s+/g, " ").trim();
  return (
    <div className="flex items-start gap-2.5 p-3">
      {handleProps && (
        <span {...handleProps} className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-lg text-muted-foreground/50 hover:text-foreground cursor-grab active:cursor-grabbing" aria-label="Mudar a ordem de gravação">
          <GripVertical className="h-4 w-4" />
        </span>
      )}
      <button type="button" onClick={onOpen} className="min-w-0 flex-1 text-left">
        <div className="flex items-center gap-1.5 flex-wrap">
          {indice >= 0 && (
            <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-primary/10 text-[10px] font-display font-extrabold text-primary">{indice + 1}</span>
          )}
          <Icone className="h-3.5 w-3.5 shrink-0 text-primary" />
          <span className="text-[13px] font-display font-bold text-foreground truncate">
            {script.title?.trim() || `Roteiro ${indice + 1}`}
          </span>
          {script.done
            ? <span className="shrink-0 text-[9.5px] font-body font-bold px-1.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-700">GRAVADO</span>
            : <span className="shrink-0 text-[9.5px] font-body font-bold px-1.5 py-0.5 rounded-full bg-amber-500/15 text-amber-700">A GRAVAR</span>}
        </div>
        {previa && <p className="mt-1 text-[11.5px] font-body text-muted-foreground line-clamp-2 leading-relaxed">{previa}</p>}
        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
          {nCenas > 0 && (
            <span className="text-[10.5px] font-body font-semibold px-1.5 py-0.5 rounded-md bg-muted text-muted-foreground">
              {nCenas} {nCenas === 1 ? "cena" : "cenas"}
            </span>
          )}
          {script.format && (
            <span className="text-[10.5px] font-body font-semibold px-1.5 py-0.5 rounded-md bg-muted text-muted-foreground capitalize">{script.format}</span>
          )}
          {script.record_date && (
            <span className="text-[10.5px] font-body font-semibold px-1.5 py-0.5 rounded-md bg-muted text-muted-foreground">
              {diaMes(script.record_date)}
            </span>
          )}
          <ListaReferencias valor={script.reference_url} compacto />
        </div>
      </button>
      {onExcluir && (
        <button type="button" aria-label="Excluir roteiro" title="Excluir roteiro"
          onClick={async (e) => {
            e.stopPropagation();
            const ok = await confirmar({
              titulo: "Excluir este roteiro?",
              descricao: `"${script.title?.trim() || "Roteiro"}" some da pasta deste mês. Não dá pra desfazer.`,
              acao: "Excluir",
            });
            if (ok) onExcluir();
          }}
          className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg text-muted-foreground/50 hover:text-destructive hover:bg-destructive/5 transition-colors">
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}

function RoteiroMiniCard({ script, indice, onOpen, icone = "file" }: {
  script: Pick<CaptureScript, "title" | "content" | "done">; indice: number; onOpen: () => void;
  icone?: "file" | "video";
}) {
  const Icone = icone === "video" ? Video : FileText;
  return (
    <button type="button" onClick={onOpen}
      className="group rounded-xl border border-border bg-card overflow-hidden text-left hover:border-primary/40 hover:shadow-warm-sm transition-all">
      {/* A "miniatura": as primeiras linhas do texto em letra mínima, como no Drive. */}
      <div className="h-24 bg-background px-3 py-2.5 overflow-hidden border-b border-border/60">
        <p className="text-[10px] leading-snug text-muted-foreground/80 whitespace-pre-wrap break-words">{script.content.slice(0, 300)}</p>
      </div>
      <div className="flex items-center gap-1.5 px-2.5 py-2">
        <Icone className="h-3.5 w-3.5 text-primary shrink-0" />
        <span className="min-w-0 flex-1 truncate text-[12px] font-body font-semibold text-foreground">
          {script.title.trim() || `Roteiro ${indice + 1}`}
        </span>
        {script.done
          ? <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-[hsl(var(--cria-verde))]" />
          : <Clock className="h-3.5 w-3.5 shrink-0 text-[hsl(var(--cria-amarelo))]" />}
      </div>
    </button>
  );
}

// ── Modal do roteiro: título renomeável + texto inteiro + todas as ações ──────
function RoteiroVerDialog({ script, onOpenChange, onRename, onToggleDone, onEditar, onExcluir, onPrompter, onVirarPost, onVerPost, converting }: {
  script: CaptureScript;
  onOpenChange: (o: boolean) => void;
  // Sem onRename/onToggleDone/onExcluir (roteiro de captação): o título vira
  // texto fixo, o status é só leitura e o excluir some.
  onRename?: (titulo: string) => void;
  onToggleDone?: () => void;
  onEditar: () => void;
  onExcluir?: () => void;
  onPrompter: () => void;
  onVirarPost: (() => void) | null;
  onVerPost: (() => void) | null;
  converting: boolean;
}) {
  const [titulo, setTitulo] = useState(script.title);
  const [copied, setCopied] = useState(false);
  const texto = script.content.trim();
  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(texto);
      setCopied(true);
      toast.success("Roteiro copiado");
      setTimeout(() => setCopied(false), 1600);
    } catch { toast.error("Não consegui copiar. Copie manualmente."); }
  };
  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg sm:max-h-[85vh] flex flex-col">
        {/* Título renomeável direto aqui (salva ao sair do campo). */}
        <div className="flex items-center gap-2 pr-8">
          <FileText className="h-4 w-4 text-primary shrink-0" />
          {onRename ? (
            <Input value={titulo} onChange={(e) => setTitulo(e.target.value)}
              onBlur={() => { const t = titulo.trim(); if (t !== script.title.trim()) onRename(t); }}
              placeholder="Nome do roteiro" className="rounded-xl h-9 font-display font-bold" />
          ) : (
            <span className="min-w-0 flex-1 truncate text-sm font-display font-bold text-foreground">{script.title}</span>
          )}
          <button type="button" onClick={onToggleDone} disabled={!onToggleDone}
            className={cn("shrink-0 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-[10.5px] font-body font-bold transition-colors",
              script.done
                ? "bg-[hsl(var(--cria-verde)/0.12)] text-[hsl(var(--cria-verde))]"
                : "bg-muted text-muted-foreground",
              onToggleDone && !script.done && "hover:text-foreground")}>
            {script.done ? <><CheckCircle2 className="h-3 w-3" /> Gravado</> : <><Clock className="h-3 w-3" /> A gravar</>}
          </button>
        </div>
        {script.source === "reel" && (
          <p className="-mt-1 inline-flex items-center gap-1 text-[10.5px] font-body font-bold text-primary"><Film className="h-3 w-3" /> importado do Cria Post</p>
        )}
        <div className="flex-1 min-h-0 overflow-y-auto rounded-xl border border-border bg-muted/20 p-3.5">
          <p className="text-[13.5px] font-body text-foreground whitespace-pre-wrap break-words leading-relaxed">{texto}</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button size="sm" onClick={onPrompter} className="rounded-xl h-9"
            title="Abre este roteiro em tela cheia pro cliente ler enquanto você grava.">
            <Play className="h-3.5 w-3.5 mr-1.5" /> Teleprompter
          </Button>
          <Button size="sm" variant="outline" onClick={copiar} className="rounded-xl h-9">
            {copied ? <><Check className="h-3.5 w-3.5 mr-1.5" /> Copiado</> : <><Copy className="h-3.5 w-3.5 mr-1.5" /> Copiar</>}
          </Button>
          <Button size="sm" variant="ghost" onClick={onEditar} className="rounded-xl h-9">
            <Pencil className="h-3.5 w-3.5 mr-1.5" /> Editar
          </Button>
          {onVerPost ? (
            <button type="button" onClick={onVerPost} className="inline-flex items-center gap-1 text-[11px] font-body font-semibold text-primary">
              <Check className="h-3.5 w-3.5" /> Tem post
            </button>
          ) : onVirarPost ? (
            <Button size="sm" variant="outline" onClick={onVirarPost} disabled={converting} className="rounded-xl h-9">
              {converting ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Send className="h-3.5 w-3.5 mr-1.5" />} Virar post
            </Button>
          ) : null}
          {onExcluir && (
            <button type="button" onClick={onExcluir}
              className="ml-auto grid h-9 w-9 place-items-center rounded-lg text-muted-foreground/60 hover:text-destructive hover:bg-destructive/10 transition-colors"
              aria-label="Excluir roteiro">
              <Trash2 className="h-4 w-4" />
            </button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Novo/editar roteiro ────────────────────────────────────────────────────────// ── Novo/editar roteiro ────────────────────────────────────────────────────────
function RoteiroDialog({ open, onOpenChange, editando, semTitulo, inicialTitulo, inicialTexto, salvando, onSalvar }: {
  open: boolean; onOpenChange: (o: boolean) => void;
  editando: boolean;
  // Roteiro de captação não tem título (o card mostra a data da captação).
  semTitulo?: boolean;
  inicialTitulo: string; inicialTexto: string;
  salvando: boolean; onSalvar: (titulo: string, texto: string) => Promise<unknown>;
}) {
  const [titulo, setTitulo] = useState(inicialTitulo);
  const [texto, setTexto] = useState(inicialTexto);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader><DialogTitle className="font-display">{editando ? "Editar roteiro" : "Novo roteiro"}</DialogTitle></DialogHeader>
        {!semTitulo && (
          <Input value={titulo} onChange={(e) => setTitulo(e.target.value)}
            placeholder="Título (ex.: Reels dos bastidores)" className="rounded-xl" />
        )}
        <Textarea rows={8} value={texto} onChange={(e) => setTexto(e.target.value)} autoFocus={!editando}
          placeholder="O que vai ser falado ou gravado…" className="rounded-xl text-sm" />
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={() => onSalvar(titulo.trim(), texto.trim())} disabled={salvando || !texto.trim()}>
            {salvando ? <Loader2 className="h-4 w-4 animate-spin" /> : "Salvar roteiro"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Importar roteiros dos reels APROVADOS do Cria Post ────────────────────────
function ImportarReelsDialog({ open, onOpenChange, externalClientId, jaImportados, onImportar }: {
  open: boolean; onOpenChange: (o: boolean) => void;
  externalClientId: string;
  jaImportados: Set<string>;
  onImportar: (post: { id: string; title: string; script: string | null; reference_url: string | null }) => Promise<unknown>;
}) {
  const { posts } = useExternalPosts(externalClientId);
  const [busy, setBusy] = useState<string | null>(null);
  // Só reels com roteiro escrito e já aprovados/postados: é o material validado
  // pelo cliente, pronto pra virar pauta de gravação.
  const candidatos = useMemo(
    () => posts.filter((p) => p.format === "reels" && (p.script ?? "").trim()
      && (p.approval_status === "aprovado" || p.approval_status === "postado")),
    [posts]);
  const importar = async (p: { id: string; title: string; script: string | null; reference_url: string | null }) => {
    setBusy(p.id);
    try { await onImportar(p); toast.success("Roteiro importado pra pasta."); }
    finally { setBusy(null); }
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg sm:max-h-[85vh] overflow-y-auto">
        <DialogHeader><DialogTitle className="font-display">Puxar dos reels aprovados</DialogTitle></DialogHeader>
        <p className="text-xs text-muted-foreground font-body -mt-1">
          Os roteiros dos reels que o cliente já aprovou no Cria Post. Importar traz o texto pra pasta, pronto pro teleprompter.
        </p>
        {candidatos.length === 0 ? (
          <p className="text-sm font-body text-foreground py-6 text-center">Nenhum reels aprovado com roteiro por enquanto.</p>
        ) : (
          <div className="space-y-2">
            {candidatos.map((p) => {
              const feito = jaImportados.has(p.id);
              return (
                <div key={p.id} className="rounded-xl border border-border p-3">
                  <div className="flex items-center gap-2">
                    <p className="min-w-0 flex-1 text-[13px] font-body font-semibold text-foreground truncate">{p.title || "Reels"}</p>
                    <Button size="sm" variant={feito ? "ghost" : "outline"} disabled={feito || busy === p.id}
                      onClick={() => importar({ id: p.id, title: p.title, script: p.script, reference_url: p.reference_url ?? null })}
                      className="rounded-lg h-8 shrink-0">
                      {feito ? <><Check className="h-3.5 w-3.5 mr-1" /> Importado</>
                        : busy === p.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        : <><Download className="h-3.5 w-3.5 mr-1" /> Importar</>}
                    </Button>
                  </div>
                  <p className="mt-1 text-[11.5px] font-body text-muted-foreground line-clamp-2 whitespace-pre-wrap">{(p.script ?? "").trim()}</p>
                </div>
              );
            })}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ── Marcar captação direto da pasta (cai na Agenda também) ────────────────────
function MarcarCaptacaoDialog({ open, onOpenChange, salvando, onSalvar }: {
  open: boolean; onOpenChange: (o: boolean) => void;
  salvando: boolean; onSalvar: (date: string, time: string | null) => Promise<unknown>;
}) {
  const [data, setData] = useState(hojeBR());
  const [hora, setHora] = useState("");
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader><DialogTitle className="font-display">Marcar captação</DialogTitle></DialogHeader>
        <p className="text-xs text-muted-foreground font-body -mt-1">A captação entra aqui e na Agenda.</p>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-[11px] font-body font-semibold text-muted-foreground">Dia</label>
            <Input type="date" value={data} onChange={(e) => setData(e.target.value)} className="rounded-xl mt-1" />
          </div>
          <div>
            <label className="text-[11px] font-body font-semibold text-muted-foreground">Hora (opcional)</label>
            <Input type="time" value={hora} onChange={(e) => setHora(e.target.value)} className="rounded-xl mt-1" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={() => onSalvar(data, hora || null)} disabled={!data || salvando}>
            {salvando ? <Loader2 className="h-4 w-4 animate-spin" /> : "Marcar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Cliente avulso (pasta fora da carteira do CRM) ────────────────────────────
function NovoAvulsoDialog({ open, onOpenChange, salvando, onSalvar }: {
  open: boolean; onOpenChange: (o: boolean) => void;
  salvando: boolean; onSalvar: (nome: string, cidade: string) => Promise<unknown>;
}) {
  const [nome, setNome] = useState("");
  const [cidade, setCidade] = useState("");
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader><DialogTitle className="font-display">Cliente avulso</DialogTitle></DialogHeader>
        <p className="text-xs text-muted-foreground font-body -mt-1">
          Uma pasta de captação pra quem está fora da sua carteira (job pontual). Não entra no CRM.
        </p>
        <Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Nome do cliente" autoFocus className="rounded-xl" />
        <Input value={cidade} onChange={(e) => setCidade(e.target.value)} placeholder="Cidade (opcional)" className="rounded-xl" />
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={() => onSalvar(nome.trim(), cidade.trim())} disabled={salvando || !nome.trim()}>
            {salvando ? <Loader2 className="h-4 w-4 animate-spin" /> : "Adicionar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Configurações da captação (Cidades atendidas + Tomadas padrão) ─────────────
// Um lugar só pras duas configs da social mídia: as cidades onde ela faz captação
// (viram sugestão no cadastro do cliente + alimentam o gráfico) e a lista de
// tomadas padrão (o que o botão "Usar tomadas padrão" injeta numa captação).
function ConfigCaptacaoDialog({ open, onOpenChange, cities, onSaveCities, savingCities, shots, onSaveShots, savingShots }: {
  open: boolean; onOpenChange: (o: boolean) => void;
  cities: string[]; onSaveCities: (list: string[]) => Promise<unknown>; savingCities: boolean;
  shots: string[]; onSaveShots: (list: string[]) => Promise<unknown>; savingShots: boolean;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md sm:max-h-[85vh] overflow-y-auto">
        <DialogHeader><DialogTitle className="font-display">Configurações da captação</DialogTitle></DialogHeader>

        {/* SEÇÃO 1 · Cidades atendidas */}
        <div>
          <h3 className="flex items-center gap-1.5 text-sm font-display font-bold text-foreground">
            <MapPinned className="h-4 w-4 text-primary" /> Cidades que você atende
          </h3>
          <p className="text-xs text-muted-foreground font-body mt-1">
            As cidades onde você faz captação. Elas viram sugestão no cadastro do cliente e alimentam o gráfico por cidade.
          </p>
          <ChipEditor items={cities} onSave={onSaveCities} saving={savingCities}
            placeholder="Ex.: Balneário Camboriú"
            emptyText="Nenhuma cidade ainda. Adicione a primeira acima."
            removeLabel={(c) => `Remover ${c}`} dedupe />
        </div>

        <div className="h-px bg-border my-1" />

        {/* SEÇÃO 2 · Tomadas padrão */}
        <div>
          <h3 className="flex items-center gap-1.5 text-sm font-display font-bold text-foreground">
            <Clapperboard className="h-4 w-4 text-primary" /> Tomadas padrão
          </h3>
          <p className="text-xs text-muted-foreground font-body mt-1">
            A lista que o botão "Usar tomadas padrão" injeta numa captação. Monte o combo que você quase sempre grava (ex.: 1 Reels, 5 Fotos, 3 Stories). Sem nada aqui, o botão usa uma lista básica.
          </p>
          <ChipEditor items={shots} onSave={onSaveShots} saving={savingShots}
            placeholder="Ex.: 5 Fotos"
            emptyText="Nenhuma tomada padrão ainda. O botão usa a lista básica até você montar a sua."
            removeLabel={(s) => `Remover ${s}`} />
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Editor de chips reutilizável (add por Enter/botão, remove no X). Usado pelas
// Cidades e pelas Tomadas padrão. `dedupe` ignora repetido (case-insensitive).
function ChipEditor({ items, onSave, saving, placeholder, emptyText, removeLabel, dedupe }: {
  items: string[]; onSave: (list: string[]) => Promise<unknown>; saving: boolean;
  placeholder: string; emptyText: string; removeLabel: (v: string) => string; dedupe?: boolean;
}) {
  const [novo, setNovo] = useState("");
  const add = async () => {
    const v = novo.trim();
    if (!v) return;
    if (dedupe && items.some((x) => x.toLowerCase() === v.toLowerCase())) { setNovo(""); return; }
    await onSave([...items, v]);
    setNovo("");
  };
  const remove = (v: string) => onSave(items.filter((x) => x !== v));

  return (
    <>
      <div className="flex gap-2 mt-3">
        <Input value={novo} onChange={(e) => setNovo(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }}
          placeholder={placeholder} className="rounded-xl" />
        <Button onClick={add} disabled={saving || !novo.trim()} className="shrink-0 rounded-xl">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
        </Button>
      </div>
      <div className="flex flex-wrap gap-2 mt-3 min-h-[40px]">
        {items.length === 0 ? (
          <p className="text-xs text-muted-foreground font-body italic">{emptyText}</p>
        ) : items.map((v) => (
          <span key={v} className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 text-primary border border-primary/15 pl-3 pr-1.5 py-1 text-xs font-body font-semibold">
            {v}
            {/* 32px: é a única forma de remover a cidade/tomada, e no celular
                o alvo de 20px fazia errar o toque. */}
            <button type="button" onClick={() => remove(v)} disabled={saving}
              className="grid h-8 w-8 -mr-1 place-items-center rounded-full hover:bg-primary/15 transition-colors" aria-label={removeLabel(v)}>
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
      </div>
    </>
  );
}
