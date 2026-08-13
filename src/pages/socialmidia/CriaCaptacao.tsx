import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Cell, LabelList } from "recharts";
import {
  Video, ChevronLeft, ChevronRight, Copy, Check, MapPin, Building2, Loader2,
  Plus, X, CheckCircle2, Clock, Pencil, CalendarRange, MapPinned, Camera,
  Play, FileText, Download, Repeat, ListChecks, Square, CheckSquare, ChevronDown,
  Sparkles, Route, Send,
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
import { useCrmClients } from "@/hooks/useCrm";
import { useExternalClients } from "@/hooks/useCriaPost";
import { useCaptureCities } from "@/hooks/useCaptureCities";
import { hojeBR, parseDateOnly } from "@/lib/date-br";
import { nomeExibidoCliente } from "@/lib/cliente-nome";
import { PrompterPlayer } from "@/components/prompter/PrompterPlayer";
import { usePdfExport } from "@/hooks/usePdfExport";

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

export default function CriaCaptacao() {
  const navigate = useNavigate();
  const [month, setMonth] = useState(() => hojeBR().slice(0, 7));
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("todas");
  const [cityFilter, setCityFilter] = useState<string>(""); // "" = todas
  const [citiesOpen, setCitiesOpen] = useState(false);
  // Teleprompter em tela cheia com o roteiro de uma captação (overlay z-60).
  const [prompter, setPrompter] = useState<{ title: string; text: string } | null>(null);
  // Folha do dia aberta (todos os roteiros daquele dia + local num lugar só).
  const [folha, setFolha] = useState<{ diaLabel: string; wd: string; local: string; items: FolhaItem[] } | null>(null);

  const { data: captures = [], isLoading } = useCaptures();
  const { data: clients = [] } = useCrmClients();
  const { clients: extClients } = useExternalClients();
  const captureToPost = useCaptureToPost();
  const updCapture = useUpdateCapture();
  const setShots = useSetCaptureShotList();
  const ensureRecurring = useEnsureRecurringCaptures();
  const addCapture = useAddCapture();
  const { cities, save: saveCities } = useCaptureCities();

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

      {/* Sugestões "aproveita a viagem": bloco discreto e dispensável, só aparece
          quando há oportunidade de agrupar clientes da mesma cidade numa ida só. */}
      {showSugestoes && (
        <SugestoesViagem trips={tripSuggestions} onAdd={marcarNoDia} onDismiss={() => setSugDismissed(month)} />
      )}

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
                <div className="ml-auto flex items-center gap-2 shrink-0">
                  {g.caps.some((c) => (c.roteiro ?? "").trim()) && (
                    <Button variant="outline" size="sm" onClick={() => abrirFolha(g)}
                      className="h-8 rounded-xl px-2.5 whitespace-nowrap"
                      title="Todos os roteiros desse dia num texto só, pra levar pra captação.">
                      <FileText className="h-3.5 w-3.5 sm:mr-1.5" /><span className="hidden sm:inline">Folha do dia</span>
                    </Button>
                  )}
                  <span className="text-[11px] font-body font-semibold text-muted-foreground tabular-nums">{g.caps.length}</span>
                </div>
              </div>
              <div className="divide-y divide-border">
                {g.caps.map((c) => {
                  // Estado de recorrência do GRUPO: a raiz (a própria captação, ou a
                  // origem apontada por recurrence_source_id) manda no recurring/dia.
                  const rootId = c.recurrence_source_id ?? c.id;
                  const root = capturesById.get(rootId) ?? c;
                  return (
                    <CaptureRow key={c.id} cap={c} nome={capName(c)} cidade={capCity(c)}
                      onToggle={() => updCapture.mutate({ id: c.id, patch: { status: c.status === "concluida" ? "agendada" : "concluida" } })}
                      onSaveRoteiro={(roteiro) => updCapture.mutateAsync({ id: c.id, patch: { roteiro } })}
                      onTeleprompter={() => setPrompter({ title: capName(c), text: (c.roteiro ?? "").trim() })}
                      shotList={normalizeShotList(c.shot_list)}
                      onSaveShotList={(list) => setShots.mutate({ id: c.id, shot_list: list })}
                      recurring={!!root.recurring}
                      recurrenceDay={root.recurrence_day ?? null}
                      onSetRecurring={(on, day) => updCapture.mutateAsync({ id: rootId, patch: { recurring: on, recurrence_day: day } })}
                      convertedPostId={c.converted_post_id ?? null}
                      onVirarPost={() => virarPost(c)}
                      onVerPost={() => navigate(`/socialmidia/clientes/${c.crm_client_id}/posts`)}
                      converting={captureToPost.isPending} />
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      <CitiesDialog open={citiesOpen} onOpenChange={setCitiesOpen}
        cities={cities} onSave={(list) => saveCities.mutateAsync(list)} saving={saveCities.isPending} />

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
    <div className="rounded-2xl border border-dashed border-primary/30 bg-primary/[0.03] p-4">
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
function CaptureRow({ cap, nome, cidade, onToggle, onSaveRoteiro, onTeleprompter, shotList, onSaveShotList, recurring, recurrenceDay, onSetRecurring, convertedPostId, onVirarPost, onVerPost, converting }: {
  cap: Capture; nome: string; cidade: string;
  onToggle: () => void; onSaveRoteiro: (roteiro: string) => Promise<unknown>;
  onTeleprompter: () => void;
  shotList: ShotItem[];
  onSaveShotList: (list: ShotItem[]) => void;
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
  const usarPadrao = () => {
    onSaveShotList(DEFAULT_SHOT_LIST.map((texto) => ({ id: newShotId(), texto, feito: false })));
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
          <div className="flex items-center gap-2 mt-2.5 flex-wrap">
            <Button size="sm" onClick={onTeleprompter} className="rounded-xl h-8"
              title="Entregue o celular pro cliente ler o roteiro no teleprompter enquanto você grava na câmera.">
              <Play className="h-3.5 w-3.5 mr-1.5" /> Usar como teleprompter
            </Button>
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

      {/* Tomadas: o que precisa sair dessa gravação (mini-acordeão + contador). */}
      <div className="mt-3 rounded-xl border border-border overflow-hidden">
        <button type="button" onClick={() => setShotsOpen((o) => !o)}
          className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-muted/30 transition-colors">
          <ListChecks className="h-3.5 w-3.5 text-primary shrink-0" />
          <span className="text-xs font-body font-semibold text-foreground">Tomadas</span>
          {shotList.length > 0 && (
            <span className={cn("text-[11px] font-body font-bold tabular-nums rounded-full px-1.5 py-0.5",
              feitas === shotList.length
                ? "bg-[hsl(var(--cria-verde)/0.12)] text-[hsl(var(--cria-verde))]"
                : "bg-muted text-muted-foreground")}>
              {feitas}/{shotList.length}
            </span>
          )}
          <ChevronDown className={cn("h-4 w-4 text-muted-foreground ml-auto transition-transform", shotsOpen && "rotate-180")} />
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
                className="w-12 h-7 rounded-lg border border-border bg-card px-1.5 text-center text-xs font-body text-foreground outline-none focus:border-primary/50" />
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
      <div className="mt-3 pt-3 border-t border-border/60">
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
      <DialogContent className="sm:max-w-lg max-h-[85vh] flex flex-col">
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
