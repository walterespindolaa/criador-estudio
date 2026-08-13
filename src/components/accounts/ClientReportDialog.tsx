import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, Download, Sparkles, Link2, Mail, MessageCircle } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { usePdfExport } from "@/hooks/usePdfExport";
import { useAuth } from "@/contexts/AuthContext";
import { useActiveAccount } from "@/contexts/AccountContext";
import { clientReportInsight } from "@/lib/ai/claude";
import { useCrmClients } from "@/hooks/useCrm";
import { parseDateOnly, toISODateBR } from "@/lib/date-br";
import { FORMAT_LABELS, normalizarFormato } from "@/lib/constants";
import type { ExternalClient, ExternalPost } from "@/hooks/useCriaPost";
import { AssinaturaCria } from "@/components/publico/AssinaturaCria";
import {
  computeCrossAnalysis, crossHeadlines, computeAudienceBreakdown, computeStoriesSummary,
  fmtNum, type CrossItem, type AudienceLike, type StoryLike,
} from "@/components/insights/insightsUtils";

const sbRpcR = supabase.rpc.bind(supabase) as unknown as (fn: string, args?: Record<string, unknown>) => Promise<{ data: unknown; error: unknown }>;
// Acesso "solto" a tabelas que ou já existem em types.ts (agenda_captures) ou
// ainda não foram regeneradas nos tipos (client_report_notes, tabela nova). Mesmo
// padrão de src/hooks/useAgenda.ts.
type AnyTable = (table: string) => ReturnType<typeof supabase.from>;
const sbFrom = supabase.from.bind(supabase) as unknown as AnyTable;

// Uma captação (gravação) do cliente, resumida pro relatório.
type CaptureRow = {
  id: string; capture_date: string; capture_time: string | null;
  status: string | null; location: string | null; converted_post_id: string | null;
  // Nota/briefing que a social mídia deixou na captação (agenda). É o que a
  // Gabriela pediu pra aparecer no relatório ("Vídeos ADS Yasmin" etc).
  note: string | null; team: string | null;
};
type IgMediaRow = {
  caption: string | null; media_type: string | null; permalink: string | null;
  thumbnail_url: string | null; posted_at: string | null; metrics: Record<string, number> | null;
  // Vínculo com a peça que a agência produziu no Cria Post (external_post), quando houver.
  post_id?: string | null;
  linked_title?: string | null; linked_format?: string | null; linked_hook?: string | null;
};
// Série diária da conta (seguidores/alcance). A RPC só devolve `daily` depois da
// migration nova (ver entrega); antes disso vem undefined e a seção some sozinha.
type IgDailyRow = { date: string; followers: number | null; reach: number | null };
// Retorno da RPC get_client_ig_report (mídias + demografia + stories do cliente).
type IgReport = { media: IgMediaRow[]; audience: AudienceLike[]; stories: StoryLike[]; daily: IgDailyRow[] };
const MEDIA_PT: Record<string, string> = { IMAGE: "Imagem", VIDEO: "Vídeo", REELS: "Reels", CAROUSEL_ALBUM: "Carrossel" };
const engOf = (m: Record<string, number> | null) =>
  m ? (Number(m.likes) || 0) + (Number(m.comments) || 0) + (Number(m.saved) || 0) + (Number(m.shares) || 0) : 0;

const MONTHS = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];
const cap = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

// ── Status do fluxo (as MESMAS cinco colunas do kanban do Cria Post) ──
// O relatório antigo só contava aprovado/pendente/ajuste_solicitado, então post
// "postado" e "em produção" sumiam da conta e o cliente via 14 posts com tudo
// zerado. A lista abaixo é a fonte única e tem que espelhar APPROVAL_COLS.
const STATUS_KEYS = ["postado", "aprovado", "pendente", "ajuste_solicitado", "em_producao"] as const;
type StatusKey = (typeof STATUS_KEYS)[number];
const STATUS_LABEL: Record<StatusKey, string> = {
  postado: "Publicados",
  aprovado: "Aprovados",
  pendente: "Aguardando você",
  ajuste_solicitado: "Em ajuste",
  em_producao: "Em produção",
};
const statusOf = (p: ExternalPost): StatusKey =>
  (STATUS_KEYS as readonly string[]).includes(p.approval_status ?? "")
    ? (p.approval_status as StatusKey)
    : "pendente";

const DAY_MS = 86400000;

// Dia (YYYY-MM-DD, fuso BR) em que o post foi publicado. Só existe pra quem já
// está em "postado": a data planejada é o dia que foi ao ar; sem ela, caímos no
// instante em que a peça foi movida pra postado.
function publishedDayOf(p: ExternalPost): string | null {
  if (statusOf(p) !== "postado") return null;
  if (p.scheduled_date) return p.scheduled_date;
  if (p.approval_updated_at) return toISODateBR(new Date(p.approval_updated_at));
  return p.created_at ? toISODateBR(new Date(p.created_at)) : null;
}

type PeriodStats = {
  posts: ExternalPost[];
  publishedPosts: ExternalPost[];
  total: number;
  published: number;
  byStatus: Record<StatusKey, number>;
  byFormat: Record<string, number>;
  byPlatform: Record<string, number>;
  publishedDays: Set<string>;
  // Média de dias entre criar a peça e o cliente aprovar. Só dá pra medir o
  // ciclo inteiro: não existe histórico de transições no banco (ver entrega).
  cycleDays: number | null;
  cycleSample: number;
};

// Um post "pertence" ao período pela data em que ele acontece no FEED do cliente:
// a data de PUBLICAÇÃO (se já foi ao ar) ou, na falta dela, a data de AGENDAMENTO.
// NÃO usamos mais created_at: peça criada em junho e publicada em julho é conteúdo
// de julho; peça criada em julho mas agendada pra agosto é conteúdo de agosto.
// Antes o created_at entrava no filtro, e por isso o relatório de julho mostrava
// peça de agosto (e o "publicados" contava peça de fora do mês) (o bug que o
// cliente recebeu. Agora TODO número do relatório reflete só o período selecionado.
function buildStats(all: ExternalPost[], since: Date, until: Date): PeriodStats {
  const sinceDay = toISODateBR(since);
  // `until` é exclusivo; comparação de string precisa do último dia incluído.
  const untilDay = toISODateBR(new Date(until.getTime() - 1));
  const dayIn = (s: string | null) => !!s && s >= sinceDay && s <= untilDay;
  // Data que define o mês do post: publicação (se postado) ou agendamento.
  const refDayOf = (p: ExternalPost): string | null => publishedDayOf(p) ?? p.scheduled_date;

  const posts = all.filter((p) => dayIn(refDayOf(p)));

  const byStatus = Object.fromEntries(STATUS_KEYS.map((k) => [k, 0])) as Record<StatusKey, number>;
  const byFormat: Record<string, number> = {};
  const byPlatform: Record<string, number> = {};
  const publishedDays = new Set<string>();
  const publishedPosts: ExternalPost[] = [];
  let cycleSum = 0;
  let cycleSample = 0;

  for (const p of posts) {
    byStatus[statusOf(p)] += 1;
    // Agrupa pelo formato CANÔNICO: "Reels"/"reels"/variações contam no mesmo
    // balde, senão o "POR FORMATO" listava o mesmo formato repetido.
    const fmtKey = normalizarFormato(p.format) || "outro";
    byFormat[fmtKey] = (byFormat[fmtKey] ?? 0) + 1;
    byPlatform[p.platform] = (byPlatform[p.platform] ?? 0) + 1;
    const day = publishedDayOf(p);
    if (dayIn(day)) { publishedDays.add(day!); publishedPosts.push(p); }
    if (statusOf(p) === "aprovado" && p.approval_updated_at && p.created_at) {
      const d = (new Date(p.approval_updated_at).getTime() - new Date(p.created_at).getTime()) / DAY_MS;
      if (d >= 0 && d < 180) { cycleSum += d; cycleSample += 1; }
    }
  }

  return {
    posts, publishedPosts,
    total: posts.length,
    published: publishedPosts.length,
    byStatus, byFormat, byPlatform, publishedDays,
    cycleDays: cycleSample > 0 ? cycleSum / cycleSample : null,
    cycleSample,
  };
}

// Título legível de uma mídia do IG: prefere o nome da peça que a agência
// produziu; sem vínculo, usa o começo da legenda.
const mediaTitle = (r: IgMediaRow) =>
  r.linked_title
  || (r.caption ? r.caption.replace(/\s+/g, " ").trim().slice(0, 70) : "")
  || MEDIA_PT[r.media_type ?? ""]
  || "Publicação";

// Somatório de desempenho de um conjunto de mídias do IG. Extraído pra fora do
// componente porque agora roda duas vezes: período atual e período anterior.
function perfOf(rows: IgMediaRow[]) {
  const sum = (k: string) => rows.reduce((a, r) => a + (Number(r.metrics?.[k]) || 0), 0);
  const views = rows.reduce((a, r) => a + (Number(r.metrics?.views ?? r.metrics?.plays) || 0), 0);
  const reach = sum("reach");
  const interactions = sum("total_interactions") || (sum("likes") + sum("comments") + sum("saved") + sum("shares"));
  return {
    has: rows.length > 0,
    posts: rows.length,
    reach, likes: sum("likes"), comments: sum("comments"), saved: sum("saved"), views, interactions,
    // Taxa de engajamento sobre alcance. Sem alcance não inventamos nada.
    engRate: reach > 0 ? (interactions / reach) * 100 : null,
    days: new Set(rows.filter((r) => r.posted_at).map((r) => toISODateBR(new Date(r.posted_at!)))).size,
  };
}

// ── Comparação com o período anterior ──
// `prev = null` significa "não dá pra comparar" e vira "primeiro período" na tela.
type Delta = { dir: "up" | "down" | "flat"; pct: number | null; prev: number; diff: number } | null;
function deltaOf(cur: number, prev: number | null): Delta {
  if (prev === null) return null;
  const diff = Math.round((cur - prev) * 10) / 10;
  const dir = diff > 0 ? "up" : diff < 0 ? "down" : "flat";
  // Divisão por zero: sair de 0 pra qualquer coisa não tem percentual honesto.
  const pct = prev === 0 ? null : Math.round((diff / prev) * 100);
  return { dir, pct, prev, diff };
}

export type ReportPeriod = { key: string; label: string; since: Date; until: Date };

// Período equivalente imediatamente anterior. Mês fechado vira o mês anterior
// inteiro (julho contra junho); janela solta ("últimos 30 dias") vira a janela
// de mesma duração logo antes.
function previousOf(p: ReportPeriod): { since: Date; until: Date; label: string } {
  const s = p.since, u = p.until;
  const isFullMonth =
    s.getDate() === 1 && u.getDate() === 1 &&
    (u.getFullYear() * 12 + u.getMonth()) - (s.getFullYear() * 12 + s.getMonth()) === 1;
  if (isFullMonth) {
    const prev = new Date(s.getFullYear(), s.getMonth() - 1, 1);
    return { since: prev, until: s, label: `${MONTHS[prev.getMonth()]} de ${prev.getFullYear()}` };
  }
  const span = u.getTime() - s.getTime();
  const days = Math.max(1, Math.round(span / DAY_MS));
  return { since: new Date(s.getTime() - span), until: s, label: `os ${days} dias anteriores` };
}

function startOfDay(d: Date): Date {
  const out = new Date(d);
  out.setHours(0, 0, 0, 0);
  return out;
}

// Presets rápidos + últimos meses fechados. `until` é sempre exclusivo.
function buildPeriods(): ReportPeriod[] {
  const now = new Date();
  const tomorrow = startOfDay(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const d7 = startOfDay(now);
  d7.setDate(d7.getDate() - 6);
  const d30 = startOfDay(now);
  d30.setDate(d30.getDate() - 29);
  const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const out: ReportPeriod[] = [
    { key: "7d", label: "Últimos 7 dias", since: d7, until: tomorrow },
    { key: "30d", label: "Últimos 30 dias", since: d30, until: tomorrow },
    { key: "mes-passado", label: `${MONTHS[lastMonth.getMonth()]} de ${lastMonth.getFullYear()}`, since: lastMonth, until: thisMonth },
    { key: "este-mes", label: `Este mês (${MONTHS[thisMonth.getMonth()]})`, since: thisMonth, until: nextMonth },
  ];
  for (let i = 2; i <= 6; i++) {
    const m = new Date(now.getFullYear(), now.getMonth() - i, 1);
    out.push({
      key: `${m.getFullYear()}-${String(m.getMonth() + 1).padStart(2, "0")}`,
      label: `${MONTHS[m.getMonth()]} de ${m.getFullYear()}`,
      since: m,
      until: new Date(m.getFullYear(), m.getMonth() + 1, 1),
    });
  }
  return out;
}

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  client: ExternalClient;
  posts: ExternalPost[];
  managerName?: string;
  // Preset vindo do "Relatório rápido" ("7d" | "30d" | "mes-passado" | "este-mes" | "custom").
  initialPeriodKey?: string;
  // Período personalizado (YYYY-MM-DD, de/até inclusivos). Quando ambos vêm preenchidos,
  // vira uma opção "Período" no seletor, usada em vez dos presets.
  customSince?: string;
  customUntil?: string;
};

// Cores fixas (hex), html2canvas não lê variáveis CSS em oklch.
const C = {
  ink: "#1a1a2e", sub: "#6b7280", line: "#e5e7eb", soft: "#f3f4f6",
  brand: "#EA4918", green: "#16a34a", amber: "#d97706", orange: "#ea580c",
  // Paleta oficial do Cria (mesma da LP) pra capa e acentos, no tom "apresentação".
  creme: "#F6F2E8", cremeCard: "#FBF9F2",
  laranja: "#EA4918", verde: "#01A652", azul: "#0061EE",
  rosa: "#FF77B9", amarelo: "#FFCF03", lilas: "#7C90F0",
};

export function ClientReportDialog({ open, onOpenChange, client, posts, managerName, initialPeriodKey, customSince, customUntil }: Props) {
  const { exportPdf, exportPdfBlob } = usePdfExport();
  const { user } = useAuth();
  const { agencyOwnerId } = useActiveAccount();
  const { data: crmClients = [] } = useCrmClients();
  const linked = useMemo(
    () => (client.crm_client_id ? crmClients.find((c) => c.id === client.crm_client_id) ?? null : null),
    [crmClients, client.crm_client_id],
  );

  // Marca da SOCIAL MÍDIA (agência) pro cabeçalho branded: a logo dela vive em
  // profiles.brand_logo_url do dono do tenant (funciona pra colaborador também,
  // via agencyOwnerId). Leitura defensiva: sem logo, o cabeçalho só não a mostra.
  const { data: agencyBrand } = useQuery<{ brand_logo_url: string | null } | null>({
    queryKey: ["report-agency-brand", agencyOwnerId],
    enabled: open && !!agencyOwnerId,
    queryFn: async () => {
      const { data, error } = await sbFrom("profiles")
        .select("brand_logo_url").eq("id", agencyOwnerId!).maybeSingle();
      if (error) throw error;
      return (data as { brand_logo_url: string | null } | null) ?? null;
    },
  });
  const agencyLogo = agencyBrand?.brand_logo_url ?? null;
  const reportRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<HTMLDivElement>(null);
  // Período custom (de/até) do "Relatório rápido" entra como uma opção a mais no seletor.
  // parseDateOnly evita o off-by-one de fuso; `until` é exclusivo (por isso +1 dia no fim).
  const customPeriod = useMemo<ReportPeriod | null>(() => {
    if (!customSince || !customUntil || customSince > customUntil) return null;
    const since = parseDateOnly(customSince);
    const until = parseDateOnly(customUntil);
    until.setDate(until.getDate() + 1);
    const fmtBR = (s: string) => parseDateOnly(s).toLocaleDateString("pt-BR");
    return { key: "custom", label: `${fmtBR(customSince)} a ${fmtBR(customUntil)}`, since, until };
  }, [customSince, customUntil]);
  const periods = useMemo(
    () => (customPeriod ? [customPeriod, ...buildPeriods()] : buildPeriods()),
    [customPeriod],
  );
  const [periodKey, setPeriodKey] = useState(initialPeriodKey ?? "este-mes");
  const [downloading, setDownloading] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [sharing, setSharing] = useState<"link" | "wa" | "mail" | null>(null);
  // Recado da social mídia: texto livre que ela escreve antes de mandar e que sai
  // no INÍCIO do relatório. Persistido por cliente+período quando dá (ver abaixo).
  const [notes, setNotes] = useState("");
  const [notesSaving, setNotesSaving] = useState(false);
  // Prints das métricas do Instagram que a social mídia sobe (a Gabriela cola o
  // print do app do IG e ele entra numa seção do relatório). Guardamos o caminho
  // no Storage e a URL assinada pra renderizar no preview e no PDF.
  const [metricShots, setMetricShots] = useState<{ path: string; url: string }[]>([]);
  const [uploadingShot, setUploadingShot] = useState(false);
  const shotInputRef = useRef<HTMLInputElement>(null);
  // Barra de formatação da análise: só faz sentido quando há texto (ou o campo
  // está em foco). Antes ficava sempre visível pedindo negrito sem texto pra usar.
  const [analiseTemTexto, setAnaliseTemTexto] = useState(false);
  const [analiseFocada, setAnaliseFocada] = useState(false);

  const period = useMemo(
    () => periods.find((p) => p.key === periodKey) ?? periods.find((p) => p.key === "este-mes") ?? periods[0],
    [periods, periodKey],
  );

  // Intervalo do período em dia de calendário BR (para filtrar captações e chavear
  // as notas). `until` é exclusivo, então o último dia incluído é until - 1.
  const dayRange = useMemo(() => ({
    since: toISODateBR(period.since),
    until: toISODateBR(new Date(period.until.getTime() - 1)),
  }), [period]);

  // Captações (gravações) do cliente NO PERÍODO. Fecha o relatório com o que foi a
  // campo no mês. Chaveado pelo crm_client_id (mesmo cliente central) e filtrado
  // por capture_date, então nunca traz captação de outro mês. Leitura defensiva:
  // sem cliente central vinculado, a seção mostra estado vazio honesto.
  const { data: captures = [] } = useQuery<CaptureRow[]>({
    queryKey: ["report-captures", agencyOwnerId, client.crm_client_id, dayRange.since, dayRange.until],
    enabled: open && !!agencyOwnerId && !!client.crm_client_id,
    queryFn: async () => {
      const { data, error } = await sbFrom("agenda_captures")
        .select("id, capture_date, capture_time, status, location, converted_post_id, note, team")
        .eq("manager_id", agencyOwnerId!)
        .eq("crm_client_id", client.crm_client_id!)
        .gte("capture_date", dayRange.since)
        .lte("capture_date", dayRange.until)
        .order("capture_date", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as CaptureRow[];
    },
  });

  const captureSummary = useMemo(() => {
    const total = captures.length;
    const valid = captures.filter((c) => c.status !== "cancelada");
    return {
      total,
      done: captures.filter((c) => c.status === "concluida").length,
      cancelled: captures.filter((c) => c.status === "cancelada").length,
      withPost: captures.filter((c) => c.converted_post_id).length,
      // capture_date já vem desc: a primeira não cancelada é a última do mês.
      last: valid[0]?.capture_date ?? captures[0]?.capture_date ?? null,
    };
  }, [captures]);

  // Lista das captações do período em ordem cronológica, pro relatório mostrar
  // cada gravação com a nota/briefing que a social mídia deixou (a Gabriela quer
  // ver "Vídeos ADS Yasmin" e afins no PDF, não só o número).
  const captureList = useMemo(
    () => [...captures].sort((a, b) => a.capture_date.localeCompare(b.capture_date)),
    [captures],
  );

  // Chave ESTÁVEL do período pra persistir a nota: o intervalo de datas em si, não
  // o rótulo relativo ("este mês" viraria outro mês no mês seguinte).
  const notesKey = useMemo(() => `${dayRange.since}_${dayRange.until}`, [dayRange]);
  const canPersistNotes = !!agencyOwnerId && !!client.crm_client_id;

  // Carrega a nota salva pra este cliente+período. Se a tabela ainda não existir
  // (migration não rodou), a query falha e a nota fica só na sessão.
  const { data: savedNote, isFetched: notesFetched } = useQuery<{ body: string; shots: { path: string; url: string }[] }>({
    queryKey: ["report-notes", agencyOwnerId, client.crm_client_id, notesKey],
    enabled: open && canPersistNotes,
    queryFn: async () => {
      const { data, error } = await sbFrom("client_report_notes")
        .select("body, metrics_images")
        .eq("manager_id", agencyOwnerId!)
        .eq("crm_client_id", client.crm_client_id!)
        .eq("period_key", notesKey)
        .maybeSingle();
      if (error) throw error;
      const row = data as { body: string | null; metrics_images: string[] | null } | null;
      const paths = row?.metrics_images ?? [];
      // Assina cada caminho do Storage pra renderizar (bucket privado).
      const shots: { path: string; url: string }[] = [];
      for (const p of paths) {
        const { data: s } = await supabase.storage.from("relatorios").createSignedUrl(p, 60 * 60 * 24 * 30);
        if (s?.signedUrl) shots.push({ path: p, url: s.signedUrl });
      }
      return { body: row?.body ?? "", shots };
    },
  });
  // Espelha a nota e os prints carregados ao abrir/trocar de período/cliente.
  useEffect(() => {
    if (notesFetched) { setNotes(savedNote?.body ?? ""); setMetricShots(savedNote?.shots ?? []); }
  }, [notesFetched, savedNote, notesKey]);

  const saveNotes = async () => {
    if (!canPersistNotes) return;
    setNotesSaving(true);
    try {
      const { error } = await sbFrom("client_report_notes").upsert({
        manager_id: agencyOwnerId, crm_client_id: client.crm_client_id,
        period_key: notesKey, body: notes, updated_at: new Date().toISOString(),
      } as never, { onConflict: "manager_id,crm_client_id,period_key" });
      if (error) throw error;
    } catch (e) {
      console.error("Salvar recado do relatório falhou", e);
    } finally {
      setNotesSaving(false);
    }
  };

  // Persiste a lista de caminhos dos prints no mesmo registro da nota (coluna
  // metrics_images). Upsert só com esses campos: não mexe no `body`.
  const persistMetricPaths = async (paths: string[]) => {
    if (!canPersistNotes) return;
    const { error } = await sbFrom("client_report_notes").upsert({
      manager_id: agencyOwnerId, crm_client_id: client.crm_client_id,
      period_key: notesKey, metrics_images: paths, updated_at: new Date().toISOString(),
    } as never, { onConflict: "manager_id,crm_client_id,period_key" });
    if (error) console.error("Salvar prints do relatório falhou", error);
  };

  const onPickShots = async (files: FileList | null) => {
    if (!files || files.length === 0 || !user) return;
    setUploadingShot(true);
    try {
      const added: { path: string; url: string }[] = [];
      for (const file of Array.from(files)) {
        if (!file.type.startsWith("image/")) continue;
        const ext = (file.name.split(".").pop() || "png").toLowerCase().replace(/[^a-z0-9]/g, "") || "png";
        const cli = client.crm_client_id ?? "sem-cliente";
        const path = `${user.id}/metricas/${cli}/${notesKey}/${Date.now()}-${Math.random().toString(36).slice(2, 7)}.${ext}`;
        const { error } = await supabase.storage.from("relatorios").upload(path, file, { upsert: true, contentType: file.type });
        if (error) { toast.error("Não consegui subir o print. Tente de novo."); continue; }
        const { data: s } = await supabase.storage.from("relatorios").createSignedUrl(path, 60 * 60 * 24 * 30);
        if (s?.signedUrl) added.push({ path, url: s.signedUrl });
      }
      if (added.length) {
        const next = [...metricShots, ...added];
        setMetricShots(next);
        await persistMetricPaths(next.map((x) => x.path));
      }
    } finally {
      setUploadingShot(false);
      if (shotInputRef.current) shotInputRef.current.value = "";
    }
  };

  const removeShot = async (path: string) => {
    const next = metricShots.filter((x) => x.path !== path);
    setMetricShots(next);
    await persistMetricPaths(next.map((x) => x.path));
    supabase.storage.from("relatorios").remove([path]).catch(() => { /* best effort */ });
  };

  // Relatório rápido: reabre já no preset escolhido pela gestora.
  useEffect(() => { if (open && initialPeriodKey) setPeriodKey(initialPeriodKey); }, [open, initialPeriodKey]);

  // Limpa a análise, o recado e o link publicado ao trocar de período (não valem
  // pra outro recorte). Pra cliente com persistência, o recado salvo é recarregado
  // logo em seguida pelo efeito da query de notas.
  useEffect(() => {
    if (editorRef.current) editorRef.current.innerHTML = "";
    setNotes("");
    setMetricShots([]);
    setAnaliseTemTexto(false);
    setShareUrl(null);
  }, [periodKey]);

  const [active, setActive] = useState<Record<string, boolean>>({});

  const escapeHtml = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  const updateActive = () => {
    setAnaliseTemTexto(!!editorRef.current?.textContent?.trim());
    try {
      setActive({
        bold: document.queryCommandState("bold"),
        italic: document.queryCommandState("italic"),
        insertUnorderedList: document.queryCommandState("insertUnorderedList"),
        insertOrderedList: document.queryCommandState("insertOrderedList"),
      });
    } catch { /* noop */ }
  };

  const exec = (cmd: string) => {
    editorRef.current?.focus();
    document.execCommand(cmd, false);
    updateActive();
  };

  const prevPeriod = useMemo(() => previousOf(period), [period]);
  const stats = useMemo(() => buildStats(posts, period.since, period.until), [posts, period]);
  const prevStats = useMemo(() => buildStats(posts, prevPeriod.since, prevPeriod.until), [posts, prevPeriod]);

  // Só faz sentido comparar se existia operação antes do período. Sem isso, o
  // relatório mostraria "-100%" de um mês que nem existiu.
  const hasPriorHistory = useMemo(
    () => posts.some((p) => p.created_at && new Date(p.created_at) < period.since),
    [posts, period.since],
  );

  // Posts do período em ordem de acontecimento (publicado > agendado > criado).
  const monthPosts = useMemo(() => {
    const keyOf = (p: ExternalPost) => publishedDayOf(p) ?? p.scheduled_date ?? (p.created_at ? toISODateBR(new Date(p.created_at)) : "");
    return [...stats.posts].sort((a, b) => keyOf(a).localeCompare(keyOf(b)));
  }, [stats.posts]);

  // O que ficou parado esperando o cliente. É a foto de AGORA, então só entra em
  // relatório de período corrente: num relatório de junho não faz sentido cobrar
  // uma peça que travou em agosto.
  const periodIsCurrent = period.until.getTime() > Date.now();
  const stuck = useMemo(() => {
    if (!periodIsCurrent) return [];
    const now = Date.now();
    return posts
      .filter((p) => {
        const s = statusOf(p);
        return s === "pendente" || s === "ajuste_solicitado";
      })
      .map((p) => {
        const ref = p.approval_updated_at ?? p.created_at;
        return { p, days: ref ? Math.floor((now - new Date(ref).getTime()) / DAY_MS) : 0 };
      })
      .filter((x) => x.days >= 7)
      .sort((a, b) => b.days - a.days);
  }, [posts, periodIsCurrent]);

  const monthLabel = period.label;

  // Título da capa. Mês fechado vira "Agosto de 2026"; janela solta ("últimos 30
  // dias", período custom) mantém o rótulo do próprio recorte.
  const coverPeriodo = useMemo(() => {
    const s = period.since, u = period.until;
    const isFullMonth =
      s.getDate() === 1 && u.getDate() === 1 &&
      (u.getFullYear() * 12 + u.getMonth()) - (s.getFullYear() * 12 + s.getMonth()) === 1;
    return isFullMonth ? `${MONTHS[s.getMonth()]} de ${s.getFullYear()}` : period.label;
  }, [period]);
  const elaboradoPor = managerName?.trim() || "sua social mídia";

  // Métricas reais do Instagram do PRÓPRIO CLIENTE.
  // Há DOIS caminhos, e o relatório antes só usava um deles (por isso não puxava
  // as métricas de cliente que usa o Cria):
  //  1) Cliente que USA O CRIA (tem conta própria, cria_owner_id): os dados vivem
  //     na conta dele e são lidos por manager_client_instagram(client_owner_id),
  //     a MESMA fonte da aba Instagram do cockpit, que funciona. É snapshot total,
  //     então filtramos por período aqui no cliente.
  //  2) Cliente que só aprova por link (sem conta Cria): get_client_ig_report por
  //     crm_client_id, já filtrado por período no servidor.
  const criaOwnerId = linked?.cria_owner_id ?? null;
  const monthRange = useMemo(() => ({
    since: period.since.toISOString(),
    until: period.until.toISOString(),
  }), [period]);

  // Caminho 1: snapshot do IG do cliente que usa o Cria.
  type CriaIgRaw = {
    media?: IgMediaRow[]; audience?: AudienceLike[]; stories?: StoryLike[];
    daily?: IgDailyRow[];
  };
  const { data: criaIgRaw } = useQuery<CriaIgRaw>({
    queryKey: ["report-ig-cria", criaOwnerId],
    enabled: open && !!criaOwnerId,
    queryFn: async () => {
      const { data, error } = await sbRpcR("manager_client_instagram", { client_owner_id: criaOwnerId });
      if (error) throw error;
      const d = (data as (CriaIgRaw & { connected?: boolean }) | null) ?? {};
      return { media: d.media ?? [], audience: d.audience ?? [], stories: d.stories ?? [], daily: d.daily ?? [] };
    },
  });

  // Caminho 2: RPC por crm_client_id (só quando NÃO é cliente Cria).
  const { data: igReportRpc } = useQuery<IgReport>({
    queryKey: ["report-ig-data", client.crm_client_id, period.key],
    enabled: open && !!client.crm_client_id && !criaOwnerId,
    queryFn: async () => {
      const { data, error } = await sbRpcR("get_client_ig_report", {
        _crm_client_id: client.crm_client_id,
        _since: monthRange.since,
        _until: monthRange.until,
      });
      if (error) throw error;
      const d = (data as Partial<IgReport> | null) ?? {};
      return { media: d.media ?? [], audience: d.audience ?? [], stories: d.stories ?? [], daily: d.daily ?? [] };
    },
  });
  const { data: prevIgRpc } = useQuery<IgMediaRow[]>({
    queryKey: ["report-ig-prev", client.crm_client_id, prevPeriod.since.toISOString(), prevPeriod.until.toISOString()],
    enabled: open && !!client.crm_client_id && !criaOwnerId,
    queryFn: async () => {
      const { data, error } = await sbRpcR("get_client_ig_report", {
        _crm_client_id: client.crm_client_id,
        _since: prevPeriod.since.toISOString(),
        _until: prevPeriod.until.toISOString(),
      });
      if (error) throw error;
      return ((data as Partial<IgReport> | null)?.media) ?? [];
    },
  });

  // Filtra por período (posted_at dentro de [since, until); `until` exclusivo).
  const inRange = (iso: string | null | undefined, since: Date, until: Date) => {
    if (!iso) return false;
    const t = new Date(iso).getTime();
    return t >= since.getTime() && t < until.getTime();
  };

  // Bundle final do IG: caminho Cria (filtrado por período) ou RPC.
  const igReport = useMemo<IgReport>(() => {
    if (criaOwnerId && criaIgRaw) {
      const sinceDay = toISODateBR(period.since);
      const untilDay = toISODateBR(new Date(period.until.getTime() - 1));
      return {
        media: (criaIgRaw.media ?? []).filter((m) => inRange(m.posted_at, period.since, period.until)),
        stories: (criaIgRaw.stories ?? []).filter((s) => inRange((s as { posted_at?: string | null }).posted_at, period.since, period.until)),
        // Demografia é snapshot (não tem série por dia), então vai inteira.
        audience: criaIgRaw.audience ?? [],
        daily: (criaIgRaw.daily ?? []).filter((d) => d.date >= sinceDay && d.date <= untilDay),
      };
    }
    return igReportRpc ?? { media: [], audience: [], stories: [], daily: [] };
  }, [criaOwnerId, criaIgRaw, igReportRpc, period]);

  const igMedia = useMemo<IgMediaRow[]>(() => igReport?.media ?? [], [igReport]);
  const prevIgMedia = useMemo<IgMediaRow[]>(() => {
    if (criaOwnerId && criaIgRaw) {
      return (criaIgRaw.media ?? []).filter((m) => inRange(m.posted_at, prevPeriod.since, prevPeriod.until));
    }
    return prevIgRpc ?? [];
  }, [criaOwnerId, criaIgRaw, prevIgRpc, prevPeriod]);
  const audience = useMemo(() => computeAudienceBreakdown(igReport?.audience), [igReport]);
  const stories = useMemo(() => computeStoriesSummary(igReport?.stories), [igReport]);
  const perf = useMemo(() => perfOf(igMedia), [igMedia]);
  const prevPerf = useMemo(() => perfOf(prevIgMedia), [prevIgMedia]);

  // Ranking por engajamento (desempate por alcance) + melhor horário (hora do top post).
  const ranking = useMemo(
    () => [...igMedia].sort((a, b) =>
      (engOf(b.metrics) - engOf(a.metrics)) || ((Number(b.metrics?.reach) || 0) - (Number(a.metrics?.reach) || 0))
    ).slice(0, 5),
    [igMedia],
  );
  const bestHour = useMemo(() => {
    const top = ranking[0];
    if (!top?.posted_at) return null;
    const d = new Date(top.posted_at);
    return `${String(d.getHours()).padStart(2, "0")}h`;
  }, [ranking]);
  const dtFmt = (s: string | null) =>
    s ? new Date(s).toLocaleString("pt-BR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : "";

  // Cruzamentos pro cliente entender o direcionamento: formato, dia e horário que
  // mais renderam (pilar/hook não vêm nessa RPC, então saem naturalmente).
  const cross = useMemo(() => {
    const items: CrossItem[] = igMedia.map((r) => ({
      media_type: r.media_type,
      posted_at: r.posted_at,
      reach: Number(r.metrics?.reach) || 0,
      interactions: engOf(r.metrics),
      pillar: null,
      hook: null,
    }));
    return computeCrossAnalysis(items);
  }, [igMedia]);
  const crossHl = useMemo(() => crossHeadlines(cross), [cross]);

  // Destaque de Reels por tempo médio assistido (retenção).
  const topReels = useMemo(() =>
    igMedia
      .filter((r) => r.media_type === "REELS" || r.media_type === "VIDEO")
      .map((r) => ({ r, watch: Number(r.metrics?.ig_reels_avg_watch_time) || 0, views: Number(r.metrics?.views ?? r.metrics?.plays) || 0 }))
      .filter((x) => x.watch > 0 || x.views > 0)
      .sort((a, b) => b.watch - a.watch || b.views - a.views)
      .slice(0, 3),
  [igMedia]);
  const fmtWatch = (ms: number) => {
    if (ms <= 0) return "-";
    const sec = ms / 1000;
    if (sec < 60) return `${sec.toFixed(1).replace(".", ",")}s`;
    return `${Math.floor(sec / 60)}m ${String(Math.round(sec % 60)).padStart(2, "0")}s`;
  };

  // Peças que a agência PRODUZIU e vinculou (social_insights.post_id -> external_post):
  // o que fizemos no Cria Post × o resultado real da publicação no IG do cliente.
  const pieces = useMemo(() =>
    igMedia
      .filter((r) => r.post_id && (r.linked_title || r.linked_format))
      .map((r) => ({
        title: r.linked_title || "Post",
        format: r.linked_format || null,
        hook: r.linked_hook || null,
        thumbnail_url: r.thumbnail_url,
        posted_at: r.posted_at,
        reach: Number(r.metrics?.reach) || 0,
        saved: Number(r.metrics?.saved) || 0,
        interactions: engOf(r.metrics),
      }))
      .sort((a, b) => b.reach - a.reach),
  [igMedia]);

  // Camada 2: alcance médio real por FORMATO da peça produzida (Reels/Carrossel/Foto
  // que a agência fez). external_post tem format e hook, mas NÃO tem pilar.
  const byProducedFormat = useMemo(() => {
    const acc: Record<string, { soma: number; n: number }> = {};
    pieces.forEach((p) => {
      // Formato canônico: agrupa "Reels"/"reels"/variações no mesmo balde.
      const f = normalizarFormato(p.format) || "outro";
      acc[f] = acc[f] ?? { soma: 0, n: 0 };
      acc[f].soma += p.reach; acc[f].n += 1;
    });
    return Object.entries(acc)
      .map(([f, v]) => ({ f, avg: Math.round(v.soma / v.n), n: v.n }))
      .sort((a, b) => b.avg - a.avg);
  }, [pieces]);

  const byProducedHook = useMemo(() => {
    const acc: Record<string, { soma: number; n: number }> = {};
    pieces.filter((p) => p.hook).forEach((p) => {
      const h = p.hook!.slice(0, 44);
      acc[h] = acc[h] ?? { soma: 0, n: 0 };
      acc[h].soma += p.reach; acc[h].n += 1;
    });
    return Object.entries(acc)
      .map(([h, v]) => ({ h, avg: Math.round(v.soma / v.n), n: v.n }))
      .sort((a, b) => b.avg - a.avg);
  }, [pieces]);

  // ── Camada de leitura: destaque, formato campeão, consistência, seguidores ──

  // Melhor e pior do período por alcance. O "pior" só entra com amostra que
  // justifique a comparação, senão vira julgamento de um post solto.
  const highlight = useMemo(() => {
    const withReach = igMedia.filter((r) => (Number(r.metrics?.reach) || 0) > 0);
    if (withReach.length === 0) return null;
    const sorted = [...withReach].sort((a, b) => (Number(b.metrics?.reach) || 0) - (Number(a.metrics?.reach) || 0));
    const best = sorted[0];
    const worst = sorted.length >= 4 ? sorted[sorted.length - 1] : null;
    const avg = Math.round(withReach.reduce((a, r) => a + (Number(r.metrics?.reach) || 0), 0) / withReach.length);
    return {
      best: {
        title: mediaTitle(best), reach: Number(best.metrics?.reach) || 0,
        saved: Number(best.metrics?.saved) || 0, interactions: engOf(best.metrics),
        type: MEDIA_PT[best.media_type ?? ""] ?? best.media_type ?? "Publicação",
        posted_at: best.posted_at, thumbnail_url: best.thumbnail_url,
        // Quanto o campeão rendeu acima da média do período.
        vsAvg: avg > 0 ? Math.round((((Number(best.metrics?.reach) || 0) / avg) - 1) * 100) : null,
      },
      worst: worst ? {
        title: mediaTitle(worst), reach: Number(worst.metrics?.reach) || 0,
        type: MEDIA_PT[worst.media_type ?? ""] ?? worst.media_type ?? "Publicação",
      } : null,
      avg,
    };
  }, [igMedia]);

  // Formato campeão por alcance médio. Exige 2+ publicações no formato pra não
  // eleger um vencedor por acaso.
  const bestFormat = useMemo(() => {
    const list = cross.byFormat.filter((r) => r.count >= 2);
    const pool = list.length >= 2 ? list : cross.byFormat;
    if (pool.length < 2) return null;
    const ord = [...pool].sort((a, b) => b.avgReach - a.avgReach);
    const top = ord[0], bottom = ord[ord.length - 1];
    if (top.avgReach <= 0) return null;
    return {
      label: top.label, avg: top.avgReach, count: top.count,
      vs: bottom.label, vsAvg: bottom.avgReach,
      lift: bottom.avgReach > 0 ? Math.round(((top.avgReach / bottom.avgReach) - 1) * 100) : null,
    };
  }, [cross.byFormat]);

  // Seguidores no período: primeiro e último ponto da série diária dentro do
  // recorte. Só aparece quando a RPC devolve `daily` e há pontos suficientes.
  const followers = useMemo(() => {
    const rows = (igReport?.daily ?? []).filter((d) => d.date && d.followers != null);
    if (rows.length < 2) return null;
    const sorted = [...rows].sort((a, b) => a.date.localeCompare(b.date));
    const first = sorted[0], last = sorted[sorted.length - 1];
    const spanDays = Math.round((parseDateOnly(last.date).getTime() - parseDateOnly(first.date).getTime()) / DAY_MS);
    if (spanDays < 5) return null;
    return { start: first.followers ?? 0, end: last.followers ?? 0, delta: (last.followers ?? 0) - (first.followers ?? 0), spanDays };
  }, [igReport?.daily]);

  // Comparações da produção (só existem quando havia operação antes do período).
  const prodDelta = useMemo(() => {
    const prevOr = (n: number) => (hasPriorHistory ? n : null);
    return {
      published: deltaOf(stats.published, prevOr(prevStats.published)),
      total: deltaOf(stats.total, prevOr(prevStats.total)),
      approved: deltaOf(stats.byStatus.aprovado, prevOr(prevStats.byStatus.aprovado)),
      adjustments: deltaOf(stats.byStatus.ajuste_solicitado, prevOr(prevStats.byStatus.ajuste_solicitado)),
      cycle: stats.cycleDays !== null && prevStats.cycleDays !== null && hasPriorHistory
        ? deltaOf(Math.round(stats.cycleDays * 10) / 10, Math.round(prevStats.cycleDays * 10) / 10)
        : null,
    };
  }, [stats, prevStats, hasPriorHistory]);

  // Comparações do Instagram (só quando o período anterior tem mídia coletada).
  const igDelta = useMemo(() => {
    const p = prevPerf.has ? prevPerf : null;
    return {
      has: !!p,
      reach: deltaOf(perf.reach, p ? p.reach : null),
      views: deltaOf(perf.views, p ? p.views : null),
      interactions: deltaOf(perf.interactions, p ? p.interactions : null),
      posts: deltaOf(perf.posts, p ? p.posts : null),
      engRate: perf.engRate !== null && p?.engRate != null
        ? deltaOf(Math.round(perf.engRate * 10) / 10, Math.round(p.engRate * 10) / 10)
        : null,
    };
  }, [perf, prevPerf]);

  const download = async () => {
    setDownloading(true);
    try {
      if (canPersistNotes) await saveNotes();
      await exportPdf(reportRef, `relatorio-${client.name}-${period.key}`.replace(/\s+/g, "-").toLowerCase());
    } finally {
      setDownloading(false);
    }
  };

  // ── Compartilhamento: publica o PDF no Storage e vira um link público ──
  const shareText = (url: string) =>
    `Olá! O relatório de ${period.label} de ${client.name} está pronto: ${url}`;

  const ensureShareLink = async (): Promise<string | null> => {
    if (shareUrl) return shareUrl;
    if (!user) { toast.error("Sessão expirada, entre de novo pra compartilhar."); return null; }
    if (canPersistNotes) await saveNotes();
    const blob = await exportPdfBlob(reportRef);
    if (!blob) { toast.error("Não consegui gerar o PDF do relatório."); return null; }
    const slug = client.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "cliente";
    const path = `${user.id}/relatorio-${slug}-${period.key}-${Date.now()}.pdf`;
    // Bucket PRIVADO + link assinado com validade de 30 dias. URL pública em
    // bucket aberto deixava relatório financeiro de cliente acessível a quem
    // chutasse o caminho; link assinado expira e não é adivinhável.
    const { error } = await supabase.storage.from("relatorios")
      .upload(path, blob, { upsert: true, contentType: "application/pdf" });
    if (!error) {
      const { data, error: signErr } = await supabase.storage.from("relatorios")
        .createSignedUrl(path, 60 * 60 * 24 * 30);
      if (!signErr && data?.signedUrl) {
        setShareUrl(data.signedUrl);
        return data.signedUrl;
      }
    }
    toast.error("Não consegui publicar o link. Baixe o PDF e envie manualmente.");
    return null;
  };

  const copyShareLink = async () => {
    if (sharing) return;
    setSharing("link");
    try {
      const url = await ensureShareLink();
      if (!url) return;
      try { await navigator.clipboard.writeText(url); toast.success("Link do relatório copiado!"); }
      catch { toast.message(url); }
    } finally { setSharing(null); }
  };

  // Telefone da ficha do cliente (cadastro central), normalizado pro wa.me.
  const waPhone = useMemo(() => {
    const digits = (linked?.phone ?? "").replace(/\D/g, "");
    if (!digits) return null;
    return digits.length <= 11 ? `55${digits}` : digits;
  }, [linked?.phone]);

  const sendWhatsApp = async () => {
    if (sharing) return;
    setSharing("wa");
    // Abre a aba ainda no clique; depois do await o navegador bloquearia o popup.
    const win = window.open("about:blank", "_blank");
    try {
      const url = await ensureShareLink();
      if (!url) { win?.close(); return; }
      const wa = `https://wa.me/${waPhone ?? ""}?text=${encodeURIComponent(shareText(url))}`;
      if (win) win.location.href = wa;
      else window.open(wa, "_blank");
    } finally { setSharing(null); }
  };

  const sendEmail = async () => {
    if (sharing) return;
    setSharing("mail");
    try {
      const url = await ensureShareLink();
      if (!url) return;
      const subject = encodeURIComponent(`Relatório de ${period.label} - ${client.name}`);
      const body = encodeURIComponent(shareText(url));
      window.location.href = `mailto:${linked?.email ?? ""}?subject=${subject}&body=${body}`;
    } finally { setSharing(null); }
  };

  const genAI = async () => {
    if (aiLoading) return;
    setAiLoading(true);
    try {
      const fmt = Object.entries(stats.byFormat).map(([f, v]) => `${FORMAT_LABELS[f] ?? f}: ${v}`).join(", ") || "-";
      const plat = Object.entries(stats.byPlatform).map(([p, v]) => `${cap(p)}: ${v}`).join(", ") || "-";
      const persona = linked?.persona
        ? Object.entries(linked.persona).filter(([, v]) => v).map(([k, v]) => `${k}: ${v}`).join("; ").slice(0, 400)
        : undefined;
      // Destaques: top 3 por engajamento, com formato, horário e números, pra IA comentar.
      const igDestaques = ranking
        .slice(0, 3)
        .map((r) => `${MEDIA_PT[r.media_type ?? ""] ?? r.media_type ?? "post"} (${dtFmt(r.posted_at)}): ${Number(r.metrics?.reach) || 0} alcance, ${engOf(r.metrics)} interações`)
        .join("; ");
      // Comparação em texto: só mandamos o que dá pra afirmar. Sem período
      // anterior, dizemos isso em vez de deixar a IA supor evolução.
      const cmp = (nome: string, cur: number, d: Delta, suf = "") => {
        if (!d) return `${nome}: ${cur}${suf} (primeiro período com dado, sem comparação)`;
        const sinal = d.dir === "up" ? "+" : d.dir === "down" ? "-" : "=";
        const abs = Math.abs(cur - d.prev);
        return `${nome}: ${cur}${suf} contra ${d.prev}${suf} (${sinal}${abs}${suf}${d.pct !== null ? `, ${d.pct > 0 ? "+" : ""}${d.pct}%` : ""})`;
      };
      const comparativo = [
        cmp("Publicados", stats.published, prodDelta.published),
        cmp("Ajustes pedidos", stats.byStatus.ajuste_solicitado, prodDelta.adjustments),
        igDelta.has ? cmp("Alcance", perf.reach, igDelta.reach) : null,
        igDelta.has ? cmp("Interações", perf.interactions, igDelta.interactions) : null,
        perf.engRate !== null
          ? cmp("Taxa de engajamento", Math.round(perf.engRate * 10) / 10, igDelta.engRate, "%")
          : null,
      ].filter(Boolean).join(" | ");

      const aiCall = clientReportInsight({
        cliente: client.name, mes: monthLabel, total: stats.total,
        formatos: fmt, plataformas: plat,
        publicados: stats.published,
        aprovados: stats.byStatus.aprovado, aguardando: stats.byStatus.pendente,
        ajustes: stats.byStatus.ajuste_solicitado, emProducao: stats.byStatus.em_producao,
        titulos: monthPosts.map((p) => p.title).slice(0, 20).join("; "),
        segmento: linked?.segment ?? undefined,
        servicos: linked?.services?.length ? linked.services.join(", ") : undefined,
        persona,
        igPosts: perf.posts, igReach: perf.reach, igViews: perf.views, igLikes: perf.likes,
        igComments: perf.comments, igInteractions: perf.interactions, igDestaques: igDestaques || undefined,
        igSalvos: perf.saved,
        taxaEngajamento: perf.engRate !== null ? Math.round(perf.engRate * 100) / 100 : undefined,
        periodoAnterior: prevPeriod.label,
        comparativo: comparativo || undefined,
        destaque: highlight
          ? `"${highlight.best.title}" (${highlight.best.type}): ${highlight.best.reach} de alcance, ${highlight.best.interactions} interações, ${highlight.best.saved} salvamentos${highlight.best.vsAvg !== null ? `, ${highlight.best.vsAvg > 0 ? "+" : ""}${highlight.best.vsAvg}% contra a média do período (${highlight.avg})` : ""}`
          : undefined,
        piorDesempenho: highlight?.worst
          ? `"${highlight.worst.title}" (${highlight.worst.type}): ${highlight.worst.reach} de alcance`
          : undefined,
        formatoCampeao: bestFormat
          ? `${bestFormat.label}, ${bestFormat.avg} de alcance médio em ${bestFormat.count} publicação(ões)${bestFormat.lift !== null ? `, ${bestFormat.lift > 0 ? "+" : ""}${bestFormat.lift}% acima de ${bestFormat.vs}` : ""}`
          : undefined,
        seguidores: followers
          ? `${followers.delta > 0 ? "+" : ""}${followers.delta} seguidores em ${followers.spanDays} dias (de ${followers.start} para ${followers.end})`
          : undefined,
        tempoAprovacao: stats.cycleDays !== null
          ? `${stats.cycleDays.toFixed(1).replace(".", ",")} dias em média da criação da peça até a aprovação do cliente (${stats.cycleSample} peça(s) aprovada(s) no período)`
          : undefined,
        pendencias: stuck.length
          ? `${stuck.length} peça(s) parada(s) há 7 dias ou mais esperando o cliente. A mais antiga: "${stuck[0].p.title}", ${stuck[0].days} dias.`
          : undefined,
        stories: stories.hasData
          ? `${stories.count} stories, ${stories.reach} de alcance, ${stories.replies} respostas`
          : undefined,
      }, user?.id);
      // Timeout: se a IA não responder em 25s, cai no resumo automático em vez de
      // deixar o botão girando pra sempre (era o "cliquei e não gerou nada").
      const res = await Promise.race([
        aiCall,
        new Promise<never>((_, rej) => setTimeout(() => rej(new Error("tempo esgotado")), 25000)),
      ]);
      if (!res || typeof res.resumo !== "string") throw new Error("formato inesperado");
      const recs = (res.recomendacoes ?? []).map((r) => `<li>${escapeHtml(r)}</li>`).join("");
      const html =
        `<p><strong>Resumo.</strong> ${escapeHtml(res.resumo)}</p>` +
        (recs ? `<p><strong>Recomendações</strong></p><ul>${recs}</ul>` : "");
      if (editorRef.current) editorRef.current.innerHTML = html;
      setAnaliseTemTexto(true);
      // A análise fica no meio do preview (longe do botão), então rola até ela e
      // avisa, senão parece que "não gerou nada".
      editorRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      toast.success("Análise gerada. Veja em “Análise do período”.");
    } catch (e) {
      console.error("Report AI failed", e);
      const msg = e instanceof Error ? e.message : "";
      // Fallback: resumo automático com os números reais, pra não travar o
      // relatório. Segue a mesma hierarquia da tela: publicado vem primeiro.
      const fmtList = Object.entries(stats.byFormat).map(([f, v]) => `${FORMAT_LABELS[f] ?? f} (${v})`).join(", ");
      const cmpTxt = prodDelta.published
        ? `, contra ${prodDelta.published.prev} no período anterior`
        : " (primeiro período com dado)";
      const linhas = [
        `<p><strong>Resumo.</strong> Foram publicados ${stats.published} post(s) em ${escapeHtml(monthLabel)}${escapeHtml(cmpTxt)}. ` +
        `No total, ${stats.total} peça(s) passaram pelo fluxo${fmtList ? `: ${escapeHtml(fmtList)}` : ""}.</p>`,
      ];
      if (highlight) {
        linhas.push(`<p>Destaque do período: “${escapeHtml(highlight.best.title)}”, com ${highlight.best.reach.toLocaleString("pt-BR")} de alcance.</p>`);
      }
      const recs: string[] = [];
      if (bestFormat) recs.push(`Ampliar ${bestFormat.label}, que teve o melhor alcance médio do período.`);
      if (stuck.length) recs.push(`Destravar as ${stuck.length} peça(s) paradas há mais de 7 dias aguardando aprovação.`);
      if (recs.length === 0) recs.push("Manter a constância de publicações no próximo período.");
      linhas.push(`<p><strong>Recomendações</strong></p><ul>${recs.map((r) => `<li>${escapeHtml(r)}</li>`).join("")}</ul>`);
      if (editorRef.current) editorRef.current.innerHTML = linhas.join("");
      setAnaliseTemTexto(true);
      editorRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      toast.message(
        msg && !/non-2xx/i.test(msg) ? `IA indisponível (${msg}). Gerei um resumo automático, você pode editar.` : "IA indisponível agora. Gerei um resumo automático, você pode editar.",
      );
    } finally {
      setAiLoading(false);
    }
  };

  const nb = (n: number) => n.toLocaleString("pt-BR");

  // Linha de variação embaixo do número: seta + percentual + valor anterior.
  // `invert` serve pros indicadores em que subir é ruim (ajustes, dias parados).
  const deltaLine = (d: Delta, unit = "", invert = false) => {
    if (!d) return <div style={{ fontSize: 10.5, color: C.sub, marginTop: 5 }}>primeiro período</div>;
    if (d.dir === "flat") {
      return <div style={{ fontSize: 10.5, color: C.sub, marginTop: 5 }}>igual ao período anterior ({nb(d.prev)}{unit})</div>;
    }
    const up = d.dir === "up";
    const good = invert ? !up : up;
    const abs = Math.abs(d.diff);
    const absTxt = Number.isInteger(abs) ? nb(abs) : abs.toFixed(1).replace(".", ",");
    return (
      <div style={{ fontSize: 10.5, marginTop: 5, color: good ? C.green : C.orange, fontWeight: 600 }}>
        {up ? "▲" : "▼"} {d.pct !== null ? `${Math.abs(d.pct)}%` : `${absTxt}${unit}`}
        <span style={{ color: C.sub, fontWeight: 400 }}>
          {d.pct !== null ? ` (${up ? "+" : "-"}${absTxt}${unit})` : ""} vs {nb(d.prev)}{unit}
        </span>
      </div>
    );
  };

  const statCard = (label: string, value: string | number, color = C.ink, d?: Delta, unit = "", invert = false) => (
    <div key={label} style={{ flex: 1, minWidth: 118, border: `1px solid ${C.line}`, borderRadius: 12, padding: "14px 16px" }}>
      <div style={{ fontSize: 26, fontWeight: 800, color, lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: 11, color: C.sub, marginTop: 6, textTransform: "uppercase", letterSpacing: 0.5 }}>{label}</div>
      {d !== undefined && deltaLine(d, unit, invert)}
    </div>
  );

  // Título de seção no estilo "apresentação": um traço colorido curto + o rótulo.
  // Dá ritmo visual sem pesar, e cada seção pode ter a sua cor da paleta Cria.
  const sectionTitle = (t: string, cor: string = C.laranja) => (
    <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 12 }}>
      <span style={{ width: 22, height: 5, borderRadius: 99, background: cor, flexShrink: 0 }} />
      <span style={{ fontSize: 12.5, fontWeight: 800, textTransform: "uppercase", letterSpacing: 0.6, color: C.ink }}>{t}</span>
    </div>
  );

  // Barra de alcance médio (cruzamentos) com o valor absoluto e a contagem.
  const crossRow = (label: string, avgReach: number, count: number, max: number) => (
    <div key={label} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
      <div style={{ width: 96, fontSize: 12, color: C.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{label}</div>
      <div style={{ flex: 1, height: 8, background: C.soft, borderRadius: 99, overflow: "hidden" }}>
        <div style={{ width: `${max > 0 ? Math.max(4, (avgReach / max) * 100) : 0}%`, height: "100%", background: C.brand }} />
      </div>
      <div style={{ width: 88, textAlign: "right", fontSize: 12, color: C.ink }}>
        <b>{fmtNum(avgReach)}</b> <span style={{ color: C.sub }}>· {count}</span>
      </div>
    </div>
  );

  const breakdownRow = (label: string, value: number, total: number) => (
    <div key={label} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
      <div style={{ width: 90, fontSize: 12, color: C.ink }}>{label}</div>
      <div style={{ flex: 1, height: 8, background: C.soft, borderRadius: 99, overflow: "hidden" }}>
        <div style={{ width: `${total ? (value / total) * 100 : 0}%`, height: "100%", background: C.brand }} />
      </div>
      <div style={{ width: 28, textAlign: "right", fontSize: 12, fontWeight: 700, color: C.ink }}>{value}</div>
    </div>
  );

  // Barra de demografia (audiência): rótulo + barra proporcional ao percentual.
  const audienceBar = (label: string, pct: number) => (
    <div key={label} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
      <div style={{ width: 100, fontSize: 12, color: C.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{label}</div>
      <div style={{ flex: 1, height: 8, background: C.soft, borderRadius: 99, overflow: "hidden" }}>
        <div style={{ width: `${pct > 0 ? Math.max(4, pct) : 0}%`, height: "100%", background: C.brand }} />
      </div>
      <div style={{ width: 44, textAlign: "right", fontSize: 12, fontWeight: 700, color: C.ink }}>{Math.round(pct)}%</div>
    </div>
  );

  const audienceCol = (title: string, items: { label: string; pct: number }[]) => (
    <div style={{ flex: 1, minWidth: 220 }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: C.ink, marginBottom: 8 }}>{title}</div>
      {items.map((it) => audienceBar(it.label, it.pct))}
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl rounded-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display">Relatório do cliente</DialogTitle>
        </DialogHeader>

        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-body text-muted-foreground">Período:</span>
          {periods.map((m) => (
            <button
              key={m.key}
              type="button"
              onClick={() => setPeriodKey(m.key)}
              className={`px-3 py-1.5 rounded-full text-xs font-body border transition-colors ${
                periodKey === m.key
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-card border-border text-muted-foreground hover:text-foreground"
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>

        <p className="mt-2 text-[11px] font-body text-muted-foreground">
          {linked
            ? "✨ A análise da IA vai usar a persona e o segmento do cadastro central deste cliente."
            : "Dica: vincule este cliente ao cadastro central (no cadastro do Cria Post) pra uma análise mais rica."}
        </p>

        {/* Recado da social mídia: texto livre que abre o relatório pro cliente.
            Persistido por cliente+período quando há cadastro central vinculado. */}
        <div className="mt-3">
          <div className="flex items-center justify-between">
            <label htmlFor="report-notes" className="text-xs font-body font-semibold text-foreground">
              Recado da social mídia <span className="font-normal text-muted-foreground">(aparece no início do relatório)</span>
            </label>
            {notesSaving && <span className="text-[11px] font-body text-muted-foreground">salvando…</span>}
          </div>
          <textarea
            id="report-notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            onBlur={() => { if (canPersistNotes) saveNotes(); }}
            placeholder="Ex.: um resumo do mês, os próximos passos, um recado pro cliente."
            rows={3}
            className="mt-1 w-full rounded-xl border border-border bg-card p-3 text-sm font-body text-foreground outline-none focus:border-primary resize-y"
          />
          <p className="text-[11px] font-body text-muted-foreground mt-1">
            {canPersistNotes
              ? "Salvo automaticamente por cliente e período."
              : "Vincule o cliente ao cadastro central pra guardar o recado entre sessões. Por ora ele sai só neste PDF."}
          </p>
        </div>

        {/* Prints das métricas do Instagram: sobe a imagem e ela entra no relatório */}
        <div className="mt-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-body font-semibold text-foreground">
              Métricas do Instagram <span className="font-normal text-muted-foreground">(suba o print do app, entra no relatório)</span>
            </span>
            {uploadingShot && <span className="text-[11px] font-body text-muted-foreground">enviando…</span>}
          </div>
          <input
            ref={shotInputRef}
            type="file"
            accept="image/*"
            multiple
            onChange={(e) => onPickShots(e.target.files)}
            className="hidden"
          />
          <div className="mt-1 flex flex-wrap items-center gap-2">
            {metricShots.map((s) => (
              <div key={s.path} className="relative h-16 w-16 overflow-hidden rounded-lg border border-border bg-muted">
                <img src={s.url} alt="Print das métricas" className="h-full w-full object-cover" />
                <button
                  type="button"
                  onClick={() => removeShot(s.path)}
                  title="Remover print"
                  className="absolute right-0.5 top-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-black/60 text-white text-xs leading-none"
                >
                  ×
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={() => shotInputRef.current?.click()}
              disabled={uploadingShot}
              className="flex h-16 w-16 flex-col items-center justify-center gap-0.5 rounded-lg border border-dashed border-border text-muted-foreground hover:border-primary hover:text-foreground disabled:opacity-50"
            >
              {uploadingShot ? <Loader2 className="h-4 w-4 animate-spin" /> : <span className="text-lg leading-none">+</span>}
              <span className="text-[10px]">print</span>
            </button>
          </div>
          <p className="text-[11px] font-body text-muted-foreground mt-1">
            {canPersistNotes
              ? "Ótimo pra cliente sem o Instagram conectado. Salvo por cliente e período."
              : "Vincule o cliente ao cadastro central pra guardar os prints entre sessões. Por ora saem só neste PDF."}
          </p>
        </div>

        {/* Barra de formatação (fora do que vira PDF) */}
        <style>{`.report-editor:empty:before{content:attr(data-placeholder);color:#9ca3af;}
.report-editor ul{list-style:disc;padding-left:22px;margin:6px 0;} .report-editor ol{list-style:decimal;padding-left:22px;margin:6px 0;} .report-editor li{margin-bottom:4px;} .report-editor p{margin:0 0 8px;}`}</style>
        {(analiseTemTexto || analiseFocada) && (
          <div className="mt-3 flex items-center gap-1">
            <span className="text-xs font-body text-muted-foreground mr-1">Formatar análise:</span>
            {([
              ["Negrito", "bold", "B", "font-bold"],
              ["Itálico", "italic", "I", "italic"],
              ["Lista com marcadores", "insertUnorderedList", "•", ""],
              ["Lista numerada", "insertOrderedList", "1.", ""],
            ] as [string, string, string, string][]).map(([label, cmd, icon, cls]) => (
              <button
                key={cmd}
                type="button"
                title={label}
                aria-pressed={!!active[cmd]}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => exec(cmd)}
                className={`h-8 w-8 rounded-lg border text-sm transition-colors ${cls} ${
                  active[cmd]
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-card text-foreground border-border hover:bg-accent"
                }`}
              >
                {icon}
              </button>
            ))}
          </div>
        )}

        {/* Preview = o próprio elemento exportado */}
        <div className="mt-3 border border-border rounded-xl overflow-hidden bg-white">
          <div ref={reportRef} style={{ width: "100%", background: "#ffffff", padding: 32, fontFamily: "Inter, system-ui, sans-serif", color: C.ink }}>
            {/* ───────────────── CAPA (ocupa a primeira página inteira) ─────────────────
                Estilo apresentação Cria: creme + formas orgânicas da paleta, logo do
                cliente redonda no centro, título "Relatório de Entregas", o mês, a
                marca da agência e o "elaborado por". */}
            <div data-pdf-block style={{
              position: "relative", overflow: "hidden",
              margin: "-32px -32px 0", padding: "50px 46px",
              background: C.creme, aspectRatio: "210 / 286",
              display: "flex", flexDirection: "column",
            }}>
              {/* formas orgânicas nos cantos (como a capa do Cria) */}
              <span style={{ position: "absolute", top: -92, right: -66, width: 250, height: 250, borderRadius: "50%", background: C.rosa }} />
              <span style={{ position: "absolute", bottom: -116, left: -92, width: 250, height: 250, borderRadius: "50%", background: C.amarelo }} />
              <span style={{ position: "absolute", top: "36%", left: 24, width: 58, height: 58, borderRadius: "50%", background: C.azul }} />
              <span style={{ position: "absolute", bottom: "24%", right: 50, width: 42, height: 42, borderRadius: "50%", background: C.verde }} />

              {/* topo: marca da agência + selo do tipo de relatório */}
              <div style={{ position: "relative", zIndex: 1, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                {agencyLogo
                  ? <img src={agencyLogo} alt={managerName ? `Logo ${managerName}` : "Logo da agência"} crossOrigin="anonymous" style={{ maxHeight: 42, maxWidth: 190, objectFit: "contain", display: "block" }} />
                  : <div style={{ fontSize: 15, fontWeight: 800, color: C.ink }}>{elaboradoPor}</div>}
                <span style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: 1, textTransform: "uppercase", color: "#fff", background: C.laranja, padding: "7px 15px", borderRadius: 999, whiteSpace: "nowrap" }}>
                  Relatório de Entregas
                </span>
              </div>

              {/* centro: logo redonda do cliente + nome + mês */}
              <div style={{ position: "relative", zIndex: 1, flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center" }}>
                <div style={{ width: 134, height: 134, borderRadius: "50%", background: "#fff", border: "5px solid #fff", boxShadow: "0 10px 34px -14px rgba(0,0,0,.35)", overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 20 }}>
                  {client.logo_url
                    ? <img src={client.logo_url} alt="" crossOrigin="anonymous" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    : <span style={{ fontWeight: 800, fontSize: 54, color: C.laranja }}>{client.name.charAt(0).toUpperCase()}</span>}
                </div>
                <div style={{ fontSize: 30, fontWeight: 800, color: C.ink, lineHeight: 1.12 }}>{client.name}</div>
                {client.instagram_handle && (
                  <div style={{ fontSize: 15, color: C.sub, marginTop: 2 }}>@{client.instagram_handle.replace(/^@/, "")}</div>
                )}
                <div style={{ marginTop: 18, fontSize: 20, fontWeight: 800, color: C.laranja }}>Relatório de Entregas · {coverPeriodo}</div>
              </div>

              {/* rodapé da capa: elaborado por + data + assinatura discreta do Cria */}
              <div style={{ position: "relative", zIndex: 1, display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 12 }}>
                <div style={{ fontSize: 12, color: C.sub, lineHeight: 1.6 }}>
                  <div>Elaborado por <b style={{ color: C.ink }}>{elaboradoPor}</b></div>
                  <div>Gerado em {new Date().toLocaleDateString("pt-BR")}</div>
                </div>
                <AssinaturaCria variante="rodape" tom="claro" altura={22} style={{ width: "auto" }} />
              </div>
            </div>
            {/* força o conteúdo a começar numa página nova (a capa é só dela) */}
            <div data-pdf-break style={{ height: 1 }} />

            {/* Cabeçalho corrido das páginas de conteúdo */}
            <div data-pdf-block style={{ display: "flex", alignItems: "center", gap: 12, paddingBottom: 14, borderBottom: `2px solid ${C.laranja}` }}>
              <div style={{ width: 44, height: 44, borderRadius: "50%", background: C.soft, display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", flexShrink: 0 }}>
                {client.logo_url
                  ? <img src={client.logo_url} alt="" crossOrigin="anonymous" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  : <span style={{ fontWeight: 800, fontSize: 19, color: C.laranja }}>{client.name.charAt(0).toUpperCase()}</span>}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 17, fontWeight: 800, color: C.ink }}>{client.name}</div>
                <div style={{ fontSize: 12, color: C.sub }}>Relatório de Entregas · {coverPeriodo}</div>
              </div>
              {agencyLogo && (
                <img src={agencyLogo} alt="" crossOrigin="anonymous" style={{ maxHeight: 26, maxWidth: 130, objectFit: "contain", display: "block", flexShrink: 0 }} />
              )}
            </div>

            {/* Recado da social mídia: abre o relatório com a leitura humana do mês.
                Só aparece quando há texto (o cliente não vê um bloco vazio). */}
            {notes.trim() && (
              <div data-pdf-block style={{ marginTop: 18, padding: "14px 16px", border: `1px solid ${C.line}`, borderLeft: `3px solid ${C.brand}`, borderRadius: 12, background: C.soft }}>
                <div style={{ fontSize: 10.5, color: C.sub, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 }}>
                  {managerName ? `Recado de ${managerName}` : "Recado da social mídia"}
                </div>
                <div style={{ fontSize: 13, color: C.ink, lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{notes.trim()}</div>
              </div>
            )}

            {/* Período totalmente vazio: estado honesto em vez de uma parede de zeros */}
            {stats.total === 0 && !perf.has ? (
              <div data-pdf-block style={{ marginTop: 20, padding: "22px 20px", border: `1px dashed ${C.line}`, borderRadius: 12, background: C.soft, textAlign: "center" }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: C.ink }}>Nenhuma atividade registrada em {monthLabel}</div>
                <div style={{ fontSize: 12, color: C.sub, marginTop: 6, lineHeight: 1.5 }}>
                  Não houve peça produzida, aprovada ou publicada neste período.
                  {hasPriorHistory ? ` No período anterior (${prevPeriod.label}) foram ${prevStats.published} publicação(ões).` : " Este é o primeiro período acompanhado."}
                </div>
              </div>
            ) : (
            <>
            {/* Entrega: o número que prova o trabalho vem primeiro e grande */}
            <div data-pdf-block style={{ marginTop: 20 }}>
              <div style={{ display: "flex", gap: 12, alignItems: "stretch" }}>
                <div style={{ flex: 1, border: `1px solid ${C.green}`, borderRadius: 12, padding: "16px 18px", background: "#f0fdf4" }}>
                  <div style={{ fontSize: 38, fontWeight: 800, color: C.green, lineHeight: 1 }}>{nb(stats.published)}</div>
                  <div style={{ fontSize: 11, color: C.sub, marginTop: 6, textTransform: "uppercase", letterSpacing: 0.5 }}>
                    {stats.published === 1 ? "Post publicado no período" : "Posts publicados no período"}
                  </div>
                </div>
              </div>

              {/* Funil completo: as cinco etapas do fluxo, nenhuma escondida */}
              <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
                {STATUS_KEYS.map((k) => {
                  const color = k === "postado" ? C.green : k === "aprovado" ? C.green
                    : k === "pendente" ? C.amber : k === "ajuste_solicitado" ? C.orange : C.sub;
                  return (
                    <div key={k} style={{ flex: 1, minWidth: 96, border: `1px solid ${C.line}`, borderRadius: 10, padding: "10px 12px" }}>
                      <div style={{ fontSize: 19, fontWeight: 800, color, lineHeight: 1 }}>{stats.byStatus[k]}</div>
                      <div style={{ fontSize: 10, color: C.sub, marginTop: 5, textTransform: "uppercase", letterSpacing: 0.4 }}>{STATUS_LABEL[k]}</div>
                    </div>
                  );
                })}
              </div>
              <div style={{ fontSize: 10.5, color: C.sub, marginTop: 8, lineHeight: 1.5 }}>
                O funil mostra em que etapa cada peça do período está hoje.
              </div>
            </div>

            {/* Breakdown */}
            <div data-pdf-block style={{ display: "flex", gap: 24, marginTop: 24 }}>
              <div style={{ flex: 1 }}>
                {sectionTitle("Por formato", C.azul)}
                {Object.keys(stats.byFormat).length === 0
                  ? <div style={{ fontSize: 12, color: C.sub }}>Sem posts no período.</div>
                  : Object.entries(stats.byFormat).sort((a, b) => b[1] - a[1]).map(([f, v]) => breakdownRow(FORMAT_LABELS[f] ?? cap(f), v, stats.total))}
              </div>
              <div style={{ flex: 1 }}>
                {sectionTitle("Por plataforma", C.lilas)}
                {Object.keys(stats.byPlatform).length === 0
                  ? <div style={{ fontSize: 12, color: C.sub }}>Sem posts no período.</div>
                  : Object.entries(stats.byPlatform).sort((a, b) => b[1] - a[1]).map(([p, v]) => breakdownRow(cap(p), v, stats.total))}
              </div>
            </div>

            {/* Leitura do período: destaque, formato campeão e fluxo de aprovação */}
            {(highlight || bestFormat || stats.cycleDays !== null || stuck.length > 0) && (
              <div data-pdf-block style={{ marginTop: 24 }}>
                {sectionTitle("O que o período mostrou", C.verde)}
                <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                  {highlight && (
                    <div style={{ flex: 2, minWidth: 260, border: `1px solid ${C.line}`, borderRadius: 12, padding: "14px 16px", display: "flex", gap: 12, alignItems: "center" }}>
                      <div style={{ width: 52, height: 52, borderRadius: 10, background: C.soft, overflow: "hidden", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                        {highlight.best.thumbnail_url
                          ? <img src={highlight.best.thumbnail_url} alt="" crossOrigin="anonymous" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                          : <span style={{ fontSize: 9, color: C.sub }}>{highlight.best.type}</span>}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 10.5, color: C.sub, textTransform: "uppercase", letterSpacing: 0.5 }}>Destaque do período</div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: C.ink, marginTop: 3 }}>{highlight.best.title}</div>
                        <div style={{ fontSize: 11.5, color: C.sub, marginTop: 3 }}>
                          {nb(highlight.best.reach)} de alcance · {nb(highlight.best.saved)} salvamentos
                          {highlight.best.vsAvg !== null && highlight.best.vsAvg > 0
                            ? <span style={{ color: C.green, fontWeight: 600 }}> · {highlight.best.vsAvg}% acima da média</span>
                            : null}
                        </div>
                      </div>
                    </div>
                  )}
                  {bestFormat && (
                    <div style={{ flex: 1, minWidth: 200, border: `1px solid ${C.line}`, borderRadius: 12, padding: "14px 16px" }}>
                      <div style={{ fontSize: 10.5, color: C.sub, textTransform: "uppercase", letterSpacing: 0.5 }}>Formato que mais rendeu</div>
                      <div style={{ fontSize: 17, fontWeight: 800, color: C.ink, marginTop: 4 }}>{bestFormat.label}</div>
                      <div style={{ fontSize: 11.5, color: C.sub, marginTop: 3 }}>
                        {nb(bestFormat.avg)} de alcance médio em {bestFormat.count} publicação{bestFormat.count === 1 ? "" : "ões"}
                        {bestFormat.lift !== null && bestFormat.lift > 0 ? `, ${bestFormat.lift}% acima de ${bestFormat.vs}` : ""}.
                      </div>
                    </div>
                  )}
                </div>

                {(stats.cycleDays !== null || stuck.length > 0 || highlight?.worst) && (
                  <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 12 }}>
                    {stats.cycleDays !== null && (
                      <div style={{ flex: 1, minWidth: 200, border: `1px solid ${C.line}`, borderRadius: 12, padding: "14px 16px" }}>
                        <div style={{ fontSize: 10.5, color: C.sub, textTransform: "uppercase", letterSpacing: 0.5 }}>Tempo até a aprovação</div>
                        <div style={{ fontSize: 22, fontWeight: 800, color: C.ink, marginTop: 4 }}>
                          {stats.cycleDays.toFixed(1).replace(".", ",")} <span style={{ fontSize: 13, fontWeight: 600 }}>dias</span>
                        </div>
                        <div style={{ fontSize: 11, color: C.sub, marginTop: 3 }}>
                          Média da criação da peça até a aprovação, em {stats.cycleSample} peça{stats.cycleSample === 1 ? "" : "s"} aprovada{stats.cycleSample === 1 ? "" : "s"} no período.
                        </div>
                      </div>
                    )}
                    {stuck.length > 0 && (
                      <div style={{ flex: 1, minWidth: 220, border: `1px solid ${C.amber}`, borderRadius: 12, padding: "14px 16px", background: "#fffbeb" }}>
                        <div style={{ fontSize: 10.5, color: C.sub, textTransform: "uppercase", letterSpacing: 0.5 }}>Aguardando sua resposta</div>
                        <div style={{ fontSize: 22, fontWeight: 800, color: C.amber, marginTop: 4 }}>
                          {stuck.length} <span style={{ fontSize: 13, fontWeight: 600, color: C.ink }}>peça{stuck.length === 1 ? "" : "s"} há 7 dias ou mais</span>
                        </div>
                        <div style={{ fontSize: 11, color: C.sub, marginTop: 5, lineHeight: 1.5 }}>
                          {stuck.slice(0, 3).map((s) => `${s.p.title} (${s.days} dias)`).join(" · ")}
                          {stuck.length > 3 ? ` e mais ${stuck.length - 3}.` : "."}
                        </div>
                      </div>
                    )}
                    {highlight?.worst && (
                      <div style={{ flex: 1, minWidth: 200, border: `1px solid ${C.line}`, borderRadius: 12, padding: "14px 16px" }}>
                        <div style={{ fontSize: 10.5, color: C.sub, textTransform: "uppercase", letterSpacing: 0.5 }}>Menor alcance do período</div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: C.ink, marginTop: 4 }}>{highlight.worst.title}</div>
                        <div style={{ fontSize: 11.5, color: C.sub, marginTop: 3 }}>
                          {nb(highlight.worst.reach)} de alcance, contra {nb(highlight.avg)} de média. Serve de referência do que evitar repetir.
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
            </>
            )}

            {/* Lista de posts do período (produzidos, agendados ou publicados) */}
            {monthPosts.length > 0 && (
              <div data-pdf-block style={{ marginTop: 24 }}>
                {sectionTitle(`Peças do período (${monthPosts.length})`, C.verde)}
                <div style={{ border: `1px solid ${C.line}`, borderRadius: 12, overflow: "hidden" }}>
                  {monthPosts.map((p, i) => {
                    const k = statusOf(p);
                    const color = k === "postado" ? C.green : k === "aprovado" ? C.green
                      : k === "pendente" ? C.amber : k === "ajuste_solicitado" ? C.orange : C.sub;
                    const label = k === "postado" ? "Publicado" : k === "aprovado" ? "Aprovado"
                      : k === "pendente" ? "Aguardando" : k === "ajuste_solicitado" ? "Em ajuste" : "Em produção";
                    const dia = publishedDayOf(p) ?? p.scheduled_date;
                    return (
                      <div key={p.id} data-pdf-block style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", borderTop: i === 0 ? "none" : `1px solid ${C.line}` }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 600, color: C.ink }}>{p.title}</div>
                          <div style={{ fontSize: 11, color: C.sub }}>
                            {FORMAT_LABELS[p.format] ?? cap(p.format)} · {cap(p.platform)}
                            {dia ? ` · ${parseDateOnly(dia).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}` : ""}
                          </div>
                        </div>
                        <div style={{ fontSize: 11, fontWeight: 700, color, whiteSpace: "nowrap" }}>{label}</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Análise do mês, editável (Word-like) */}
            <div data-pdf-block style={{ marginTop: 24 }}>
              {sectionTitle("Análise do período")}
              <div
                ref={editorRef}
                contentEditable
                suppressContentEditableWarning
                onInput={updateActive}
                onKeyUp={updateActive}
                onMouseUp={updateActive}
                onFocus={() => { setAnaliseFocada(true); updateActive(); }}
                onBlur={() => setAnaliseFocada(false)}
                data-placeholder="Escreva a análise ou clique em “Gerar análise (IA)”. Você pode formatar com a barra acima."
                className="report-editor"
                style={{ fontSize: 13, color: C.ink, lineHeight: 1.6, outline: "none", minHeight: 48 }}
              />
            </div>

            {/* Desempenho, números reais do Instagram quando os posts estão vinculados */}
            {perf.has ? (
              <div style={{ marginTop: 24 }}>
                <div data-pdf-block>
                  {sectionTitle(`Desempenho no Instagram (${perf.posts} post${perf.posts === 1 ? "" : "s"})`)}
                  <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                    {statCard("Alcance", nb(perf.reach), C.ink, igDelta.has ? igDelta.reach : undefined)}
                    {statCard("Visualizações", nb(perf.views), C.ink, igDelta.has ? igDelta.views : undefined)}
                    {statCard("Interações", nb(perf.interactions), C.ink, igDelta.has ? igDelta.interactions : undefined)}
                    {statCard("Salvamentos", nb(perf.saved))}
                    {perf.engRate !== null && statCard(
                      "Taxa de engajamento",
                      `${perf.engRate.toFixed(1).replace(".", ",")}%`,
                      perf.engRate >= 3 ? C.green : C.ink,
                      igDelta.engRate ?? undefined,
                      "%",
                    )}
                  </div>
                  <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 12 }}>
                    {statCard("Curtidas", nb(perf.likes))}
                    {statCard("Comentários", nb(perf.comments))}
                    {followers && (
                      <div key="seguidores" style={{ flex: 1, minWidth: 118, border: `1px solid ${C.line}`, borderRadius: 12, padding: "14px 16px" }}>
                        <div style={{ fontSize: 26, fontWeight: 800, lineHeight: 1, color: followers.delta >= 0 ? C.green : C.orange }}>
                          {followers.delta >= 0 ? "+" : ""}{nb(followers.delta)}
                        </div>
                        <div style={{ fontSize: 11, color: C.sub, marginTop: 6, textTransform: "uppercase", letterSpacing: 0.5 }}>Seguidores no período</div>
                        <div style={{ fontSize: 10.5, color: C.sub, marginTop: 5 }}>de {nb(followers.start)} para {nb(followers.end)}</div>
                      </div>
                    )}
                  </div>
                  {!igDelta.has && (
                    <div style={{ fontSize: 10.5, color: C.sub, marginTop: 8 }}>
                      Não há medição do Instagram em {prevPeriod.label}, então este é o primeiro período com comparação possível.
                    </div>
                  )}
                </div>

                {ranking.length > 0 && (
                  <div data-pdf-block style={{ marginTop: 18 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: C.ink, marginBottom: 8 }}>
                      Ranking de posts{bestHour ? ` · top post publicado às ${bestHour}` : ""}
                    </div>
                    <div style={{ border: `1px solid ${C.line}`, borderRadius: 12, overflow: "hidden" }}>
                      {ranking.map((r, i) => {
                        const views = Number(r.metrics?.views ?? r.metrics?.plays) || 0;
                        return (
                          <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", borderTop: i === 0 ? "none" : `1px solid ${C.line}` }}>
                            <div style={{ width: 20, fontSize: 13, fontWeight: 800, color: C.brand, textAlign: "center" }}>{i + 1}</div>
                            <div style={{ width: 44, height: 44, borderRadius: 8, background: C.soft, overflow: "hidden", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                              {r.thumbnail_url
                                ? <img src={r.thumbnail_url} alt="" crossOrigin="anonymous" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                                : <span style={{ fontSize: 9, color: C.sub }}>{MEDIA_PT[r.media_type ?? ""] ?? "post"}</span>}
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontSize: 12, fontWeight: 600, color: C.ink }}>
                                {MEDIA_PT[r.media_type ?? ""] ?? r.media_type ?? "Post"} · {dtFmt(r.posted_at)}
                              </div>
                              <div style={{ fontSize: 11, color: C.sub }}>
                                {(Number(r.metrics?.reach) || 0).toLocaleString("pt-BR")} alcance · {(Number(r.metrics?.likes) || 0).toLocaleString("pt-BR")} curtidas · {(Number(r.metrics?.comments) || 0).toLocaleString("pt-BR")} coment.{views ? ` · ${views.toLocaleString("pt-BR")} views` : ""}
                              </div>
                            </div>
                            <div style={{ fontSize: 12, fontWeight: 700, color: C.brand, whiteSpace: "nowrap" }}>{engOf(r.metrics)} interações</div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* As peças que produzimos e o que renderam: mídia do IG × external_post vinculado */}
                {pieces.length > 0 && (
                  <div data-pdf-block style={{ marginTop: 18 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: C.ink, marginBottom: 8 }}>
                      As peças que produzimos e o que renderam ({pieces.length})
                    </div>
                    <div style={{ border: `1px solid ${C.line}`, borderRadius: 12, overflow: "hidden" }}>
                      {pieces.map((p, i) => (
                        <div key={i} data-pdf-block style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", borderTop: i === 0 ? "none" : `1px solid ${C.line}` }}>
                          <div style={{ width: 44, height: 44, borderRadius: 8, background: C.soft, overflow: "hidden", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                            {p.thumbnail_url
                              ? <img src={p.thumbnail_url} alt="" crossOrigin="anonymous" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                              : <span style={{ fontSize: 9, color: C.sub }}>{p.format ? (FORMAT_LABELS[p.format] ?? p.format) : "post"}</span>}
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 12, fontWeight: 600, color: C.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.title}</div>
                            <div style={{ fontSize: 11, color: C.sub }}>
                              {p.format ? (FORMAT_LABELS[p.format] ?? cap(p.format)) : "Post"}{p.posted_at ? ` · ${dtFmt(p.posted_at)}` : ""}
                            </div>
                          </div>
                          <div style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                            <div style={{ fontSize: 12, fontWeight: 700, color: C.ink }}>{p.reach.toLocaleString("pt-BR")} alcance</div>
                            <div style={{ fontSize: 11, color: C.sub }}>{p.saved.toLocaleString("pt-BR")} salvos · {p.interactions.toLocaleString("pt-BR")} inter.</div>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Camada 2: alcance médio real por formato (e hook) da peça produzida */}
                    {byProducedFormat.length > 0 && (
                      <div style={{ marginTop: 14 }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: C.ink, marginBottom: 8 }}>Alcance médio por formato que produzimos</div>
                        {(() => { const mx = Math.max(...byProducedFormat.map((r) => r.avg), 0); return byProducedFormat.map((r) => crossRow(FORMAT_LABELS[r.f] ?? cap(r.f), r.avg, r.n, mx)); })()}
                      </div>
                    )}
                    {byProducedHook.length > 0 && (
                      <div style={{ marginTop: 14 }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: C.ink, marginBottom: 8 }}>Alcance médio por hook que produzimos</div>
                        {(() => { const mx = Math.max(...byProducedHook.map((r) => r.avg), 0); return byProducedHook.map((r) => crossRow(r.h, r.avg, r.n, mx)); })()}
                      </div>
                    )}
                    <div style={{ fontSize: 10.5, color: C.sub, marginTop: 8 }}>
                      Cruzamento pelas peças que a agência produziu no Cria Post (formato e hook). Pilar não é registrado em posts externos, por isso fica de fora.
                    </div>
                  </div>
                )}

                {/* Direcionamento: conclusões pro cliente entender o que rende mais */}
                {crossHl.length > 0 && (
                  <div data-pdf-block style={{ marginTop: 18, padding: "14px 16px", border: `1px solid ${C.line}`, borderRadius: 12, background: C.soft }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: C.ink, marginBottom: 8 }}>Direcionamento do período</div>
                    <ul style={{ margin: 0, paddingLeft: 18 }}>
                      {crossHl.map((h, i) => (
                        <li key={i} style={{ fontSize: 12, color: C.ink, marginBottom: 5, lineHeight: 1.5 }}>{h}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Cruzamentos: alcance médio por formato, dia e horário */}
                {cross.hasData && (
                  <div data-pdf-block style={{ display: "flex", gap: 24, marginTop: 18, flexWrap: "wrap" }}>
                    {cross.byFormat.length > 0 && (
                      <div style={{ flex: 1, minWidth: 220 }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: C.ink, marginBottom: 8 }}>Alcance médio por formato</div>
                        {(() => { const mx = Math.max(...cross.byFormat.map((r) => r.avgReach), 0); return cross.byFormat.map((r) => crossRow(r.label, r.avgReach, r.count, mx)); })()}
                      </div>
                    )}
                    {cross.byWeekday.length > 1 && (
                      <div style={{ flex: 1, minWidth: 220 }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: C.ink, marginBottom: 8 }}>Alcance médio por dia</div>
                        {(() => { const mx = Math.max(...cross.byWeekday.map((r) => r.avgReach), 0); return cross.byWeekday.map((r) => crossRow(r.label, r.avgReach, r.count, mx)); })()}
                      </div>
                    )}
                    {cross.byTime.length > 1 && (
                      <div style={{ flex: 1, minWidth: 220 }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: C.ink, marginBottom: 8 }}>Alcance médio por período</div>
                        {(() => { const mx = Math.max(...cross.byTime.map((r) => r.avgReach), 0); return cross.byTime.map((r) => crossRow(r.label, r.avgReach, r.count, mx)); })()}
                      </div>
                    )}
                  </div>
                )}

                {/* Destaque de Reels por tempo médio assistido (retenção) */}
                {topReels.length > 0 && (
                  <div data-pdf-block style={{ marginTop: 18 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: C.ink, marginBottom: 8 }}>Reels com mais retenção (tempo médio assistido)</div>
                    <div style={{ border: `1px solid ${C.line}`, borderRadius: 12, overflow: "hidden" }}>
                      {topReels.map(({ r, watch, views }, i) => (
                        <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", borderTop: i === 0 ? "none" : `1px solid ${C.line}` }}>
                          <div style={{ width: 20, fontSize: 13, fontWeight: 800, color: C.brand, textAlign: "center" }}>{i + 1}</div>
                          <div style={{ width: 44, height: 44, borderRadius: 8, background: C.soft, overflow: "hidden", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                            {r.thumbnail_url
                              ? <img src={r.thumbnail_url} alt="" crossOrigin="anonymous" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                              : <span style={{ fontSize: 9, color: C.sub }}>Reels</span>}
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 12, fontWeight: 600, color: C.ink }}>{r.caption ? r.caption.slice(0, 60) : "Reels"}</div>
                            <div style={{ fontSize: 11, color: C.sub }}>{fmtWatch(watch)} assistidos em média{views ? ` · ${fmtNum(views)} views` : ""}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : metricShots.length === 0 ? (
              <div data-pdf-block style={{ marginTop: 20, padding: "14px 16px", border: `1px dashed ${C.line}`, borderRadius: 12, background: C.soft }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: C.ink }}>Métricas de alcance e engajamento</div>
                <div style={{ fontSize: 11, color: C.sub, marginTop: 4, lineHeight: 1.55 }}>
                  Este relatório cobre a produção e a entrega das peças. Alcance, visualizações, salvamentos e evolução de seguidores
                  vêm direto do Instagram e só podem ser lidos com o perfil conectado, o que ainda não foi feito. Assim que a conexão
                  for autorizada, esta seção passa a sair preenchida nos próximos relatórios.
                </div>
              </div>
            ) : null}

            {/* Métricas do Instagram por print: a social mídia sobe o print do app do
                IG (alcance, seguidores, etc) e ele entra aqui como imagem. Serve
                sobretudo pra cliente sem o perfil conectado. */}
            {metricShots.length > 0 && (
              <div data-pdf-block style={{ marginTop: 24 }}>
                {sectionTitle("Métricas do Instagram", C.azul)}
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  {metricShots.map((s) => (
                    <div key={s.path} data-pdf-block style={{ border: `1px solid ${C.line}`, borderRadius: 12, overflow: "hidden", background: "#fff" }}>
                      <img src={s.url} alt="Print das métricas do Instagram" crossOrigin="anonymous" style={{ display: "block", width: "100%", height: "auto" }} />
                    </div>
                  ))}
                </div>
                <div style={{ fontSize: 10.5, color: C.sub, marginTop: 8 }}>
                  Prints das métricas direto do Instagram no período.
                </div>
              </div>
            )}

            {/* Perfil de audiência: faixa etária, gênero, top cidades, top países */}
            {audience.hasData && (
              <div data-pdf-block style={{ marginTop: 24 }}>
                {sectionTitle(`Perfil de audiência${audience.source === "engaged" ? " (com base nos engajados)" : ""}`)}
                {(audience.age.length > 0 || audience.gender.length > 0) && (
                  <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
                    {audience.age.length > 0 && audienceCol("Faixa etária", audience.age)}
                    {audience.gender.length > 0 && audienceCol("Gênero", audience.gender)}
                  </div>
                )}
                {(audience.city.length > 0 || audience.country.length > 0) && (
                  <div style={{ display: "flex", gap: 24, marginTop: 14, flexWrap: "wrap" }}>
                    {audience.city.length > 0 && audienceCol("Principais cidades", audience.city)}
                    {audience.country.length > 0 && audienceCol("Principais países", audience.country)}
                  </div>
                )}
              </div>
            )}

            {/* Stories: alcance, alcance médio, respostas, taxa de resposta, navegação */}
            {stories.hasData && (
              <div data-pdf-block style={{ marginTop: 24 }}>
                {sectionTitle(`Stories (${stories.count} no período)`)}
                <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                  {statCard("Alcance", nb(stories.reach))}
                  {statCard("Alcance médio", nb(stories.avgReach))}
                  {statCard("Respostas", nb(stories.replies))}
                  {statCard("Taxa de resposta", `${stories.replyRate.toFixed(1).replace(".", ",")}%`)}
                  {stories.navigation > 0 && statCard("Navegação", nb(stories.navigation))}
                </div>
              </div>
            )}

            {/* Captação do período: o que foi a campo no mês (gravações). Puxado de
                agenda_captures pelo mesmo período; sempre com estado vazio honesto. */}
            <div data-pdf-block style={{ marginTop: 24 }}>
              {sectionTitle("Captação do período", C.rosa)}
              {!client.crm_client_id ? (
                <div style={{ fontSize: 12, color: C.sub, padding: "12px 14px", border: `1px dashed ${C.line}`, borderRadius: 12, background: C.soft }}>
                  Vincule este cliente ao cadastro central pra trazer as captações do período aqui.
                </div>
              ) : captureSummary.total === 0 ? (
                <div style={{ fontSize: 12, color: C.sub, padding: "12px 14px", border: `1px dashed ${C.line}`, borderRadius: 12, background: C.soft }}>
                  Nenhuma captação registrada neste período.
                </div>
              ) : (
                <>
                  <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                    {statCard(captureSummary.total === 1 ? "Captação" : "Captações", nb(captureSummary.total))}
                    {statCard("Concluídas", nb(captureSummary.done), C.green)}
                    {captureSummary.last && statCard("Última captação", parseDateOnly(captureSummary.last).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" }))}
                  </div>

                  {/* Lista das gravações do mês, cada uma com a nota/briefing que a
                      social mídia deixou na agenda (ex.: "Vídeos ADS Yasmin"). */}
                  <div style={{ marginTop: 12, border: `1px solid ${C.line}`, borderRadius: 12, overflow: "hidden" }}>
                    {captureList.map((c, i) => {
                      const st = c.status === "concluida" ? { t: "Concluída", cor: C.green }
                        : c.status === "cancelada" ? { t: "Cancelada", cor: C.sub }
                        : { t: "Agendada", cor: C.amber };
                      const dia = parseDateOnly(c.capture_date).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
                      const local = [c.location, c.team].filter(Boolean).join(" · ");
                      return (
                        <div key={c.id} data-pdf-block style={{ display: "flex", gap: 12, padding: "11px 14px", borderTop: i === 0 ? "none" : `1px solid ${C.line}`, opacity: c.status === "cancelada" ? 0.6 : 1 }}>
                          <div style={{ width: 58, flexShrink: 0 }}>
                            <div style={{ fontSize: 13, fontWeight: 800, color: C.ink }}>{dia}</div>
                            {c.capture_time && <div style={{ fontSize: 11, color: C.sub }}>{c.capture_time.slice(0, 5)}</div>}
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 13, color: C.ink, lineHeight: 1.45, whiteSpace: "pre-wrap" }}>
                              {c.note?.trim() ? c.note.trim() : <span style={{ color: C.sub, fontStyle: "italic" }}>Sem nota registrada.</span>}
                            </div>
                            {local && <div style={{ fontSize: 11, color: C.sub, marginTop: 3 }}>{local}</div>}
                          </div>
                          <div style={{ fontSize: 11, fontWeight: 700, color: st.cor, whiteSpace: "nowrap", flexShrink: 0 }}>{st.t}</div>
                        </div>
                      );
                    })}
                  </div>

                  {captureSummary.cancelled > 0 && (
                    <div style={{ fontSize: 10.5, color: C.sub, marginTop: 8 }}>
                      {captureSummary.cancelled === 1 ? "1 captação foi cancelada" : `${captureSummary.cancelled} captações foram canceladas`} no período.
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Rodapé branded (white-label). Protagonismo do cliente e da agência lá
                em cima; aqui embaixo o Cria entra só como assinatura discreta. */}
            <div data-pdf-block style={{ marginTop: 22, paddingTop: 14, borderTop: `1px solid ${C.line}` }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ fontSize: 11, color: C.sub }}>
                  {managerName ? `Preparado por ${managerName}` : "Relatório de gestão de conteúdo"}
                </div>
                <div style={{ fontSize: 11, color: C.sub }}>
                  Gerado em {new Date().toLocaleDateString("pt-BR")}
                </div>
              </div>
              <AssinaturaCria variante="rodape" tom="claro" style={{ marginTop: 10 }} />
            </div>
          </div>
        </div>

        {/* Compartilhar: link público do PDF + WhatsApp + e-mail */}
        <div className="mt-4 rounded-2xl border border-border bg-muted/30 p-3 sm:p-4">
          <p className="text-xs font-body font-semibold text-foreground">Compartilhar com o cliente</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={copyShareLink} disabled={sharing !== null}>
              {sharing === "link" ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Link2 className="h-3.5 w-3.5 mr-1.5" />} Copiar link
            </Button>
            <Button variant="outline" size="sm" onClick={sendWhatsApp} disabled={sharing !== null}>
              {sharing === "wa" ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <MessageCircle className="h-3.5 w-3.5 mr-1.5" />} Enviar por WhatsApp
            </Button>
            <Button variant="outline" size="sm" onClick={sendEmail} disabled={sharing !== null}>
              {sharing === "mail" ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Mail className="h-3.5 w-3.5 mr-1.5" />} Enviar por e-mail
            </Button>
          </div>
          <p className="text-[11px] font-body text-muted-foreground mt-2">
            O link publica o PDF deste período pra você mandar direto.
            {!waPhone && " Dica: cadastre o telefone na ficha do cliente pro WhatsApp abrir já na conversa dele."}
          </p>
        </div>

        <DialogFooter className="mt-4 sm:justify-between">
          <Button variant="outline" onClick={genAI} disabled={aiLoading} className="mr-auto">
            {aiLoading ? <><Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> Analisando…</> : <><Sparkles className="h-4 w-4 mr-1.5" /> Gerar análise (IA)</>}
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Fechar</Button>
            <Button onClick={download} disabled={downloading}>
              {downloading ? <><Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> Gerando…</> : <><Download className="h-4 w-4 mr-1.5" /> Baixar PDF</>}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
