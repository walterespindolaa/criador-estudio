import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useActiveAccount } from "@/contexts/AccountContext";
import { parseDateOnly, toISODateBR } from "@/lib/date-br";

// ── RELATÓRIO DE PRODUTIVIDADE DA OPERAÇÃO ───────────────────────────────────
// Números do que a gestora produziu num período (semana/mês): posts, captações,
// tarefas, criações e materiais. É contagem honesta do que JÁ existe no banco,
// sem métrica inventada. Cada fonte é buscada FILTRADA pelo período (nada de
// puxar a tabela inteira), no mesmo padrão agencyOwnerId + RLS do resto do app.
//
// Atribuição ao período (a regra que define "o que conta em agosto"):
//  - post      → scheduled_date (a data dele na agenda). Post sem data não entra.
//  - captação  → capture_date.
//  - tarefa    → criadas por created_at (dia BR); concluídas por due_date, porque
//                crm_tasks NÃO tem carimbo de conclusão (updated_at muda em
//                qualquer edição, seria mentira usar). Pelo mesmo motivo não
//                existe "concluída no prazo x atrasada" aqui.
//  - criação   → day.
//  - material  → due_date (o prazo é o que o coloca na agenda).

type AnyTable = (table: string) => ReturnType<typeof supabase.from>;
const sbFrom = supabase.from.bind(supabase) as unknown as AnyTable;

export type ProdPost = { id: string; title: string | null; platform: string | null; format: string | null; approval_status: string | null; scheduled_date: string; scheduled_time: string | null; external_client_id: string | null };
export type ProdCapture = {
  id: string;
  status: "agendada" | "concluida" | "cancelada";
  capture_date: string;
  capture_time: string | null;
  note: string | null;
  crm_client_id: string | null;
  client_name: string | null;
};
export type ProdTask = { id: string; status: string; due_date: string | null; created_at: string; crm_client_id: string | null };
export type ProdCreation = { id: string; day: string; crm_client_id: string | null; client_name: string | null };
export type ProdMaterial = { id: string; status: string; due_date: string; crm_client_id: string | null };

export type ProdutividadeRaw = {
  posts: ProdPost[];
  captures: ProdCapture[];
  tasks: ProdTask[];
  creations: ProdCreation[];
  materials: ProdMaterial[];
};

// Soma dias a uma data YYYY-MM-DD sem passar por UTC (parseDateOnly = meia-noite local).
function addDaysISO(iso: string, days: number): string {
  const d = parseDateOnly(iso);
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// Busca as cinco fontes do período de uma vez. `enabled` deixa o dialog só buscar
// quando está aberto (e o período anterior junto, pra comparação).
export function useProdutividadePeriodo(from: string, to: string, enabled: boolean) {
  const { agencyOwnerId } = useActiveAccount();
  return useQuery<ProdutividadeRaw>({
    queryKey: ["produtividade", agencyOwnerId, from, to],
    enabled: enabled && !!agencyOwnerId,
    staleTime: 60_000,
    queryFn: async () => {
      // created_at é timestamptz (UTC); o dia BR "to" só termina às 03:00 UTC do dia
      // seguinte. Folga de 2 dias no filtro do servidor e refino exato no cliente
      // via toISODateBR (ver computeProdStats).
      const toWide = addDaysISO(to, 2);
      const [posts, caps, tasks, cris, mats] = await Promise.all([
        sbFrom("posts")
          .select("id, title, platform, format, approval_status, scheduled_date, scheduled_time, external_client_id")
          .eq("user_id", agencyOwnerId!)
          .not("external_client_id", "is", null)
          .gte("scheduled_date", from).lte("scheduled_date", to),
        sbFrom("agenda_captures")
          .select("id, status, capture_date, capture_time, note, crm_client_id, client_name")
          .eq("manager_id", agencyOwnerId!)
          .gte("capture_date", from).lte("capture_date", to),
        sbFrom("crm_tasks")
          .select("id, status, due_date, created_at, crm_client_id")
          .eq("manager_id", agencyOwnerId!)
          .or(`and(due_date.gte.${from},due_date.lte.${to}),and(created_at.gte.${from},created_at.lte.${toWide})`),
        sbFrom("agenda_creations")
          .select("id, day, crm_client_id, client_name")
          .eq("manager_id", agencyOwnerId!)
          .gte("day", from).lte("day", to),
        sbFrom("client_materials")
          .select("id, status, due_date, crm_client_id")
          .eq("manager_id", agencyOwnerId!)
          .gte("due_date", from).lte("due_date", to),
      ]);
      const err = posts.error ?? caps.error ?? tasks.error ?? cris.error ?? mats.error;
      if (err) throw err;
      return {
        posts: (posts.data ?? []) as unknown as ProdPost[],
        captures: (caps.data ?? []) as unknown as ProdCapture[],
        tasks: (tasks.data ?? []) as unknown as ProdTask[],
        creations: (cris.data ?? []) as unknown as ProdCreation[],
        materials: (mats.data ?? []) as unknown as ProdMaterial[],
      };
    },
  });
}

export type ProdStats = {
  posts: { publicados: number; aprovados: number; emAprovacao: number; emProducao: number; total: number };
  /** Quantos de cada formato, do mais produzido pro menos. Só o que apareceu:
   *  listar sete formatos com seis zerados esconde o que interessa. */
  formatos: { code: string; publicados: number; total: number }[];
  capt: { concluidas: number; agendadas: number; canceladas: number; total: number };
  tarefas: { concluidas: number; criadas: number; noPeriodo: ProdTask[] };
  criacoes: number;
  materiais: { total: number; finalizados: number };
  temAlgo: boolean;
};

// Contagens puras a partir do bruto do período. Recebe from/to porque o refino das
// tarefas criadas (dia BR do created_at) acontece aqui, não no servidor.
export function computeProdStats(d: ProdutividadeRaw | undefined, from: string, to: string): ProdStats {
  const posts = d?.posts ?? [];
  const captures = d?.captures ?? [];
  const tasks = d?.tasks ?? [];
  const creations = d?.creations ?? [];
  const materials = d?.materials ?? [];

  const st = (s: string | null) => posts.filter((p) => p.approval_status === s).length;
  // approval_status null é tratado como "em produção" (post recém-criado sem status).
  const emProducao = st("em_producao") + st(null);
  const dentro = (iso: string) => iso >= from && iso <= to;

  const tarefasCriadas = tasks.filter((t) => dentro(toISODateBR(new Date(t.created_at)))).length;
  const tarefasConcluidas = tasks.filter((t) => t.status === "concluida" && !!t.due_date && dentro(t.due_date)).length;
  const tarefasNoPeriodo = tasks.filter((t) => !!t.due_date && dentro(t.due_date));

  const capt = {
    concluidas: captures.filter((c) => c.status === "concluida").length,
    agendadas: captures.filter((c) => c.status === "agendada").length,
    canceladas: captures.filter((c) => c.status === "cancelada").length,
    total: captures.length,
  };
  const materiais = { total: materials.length, finalizados: materials.filter((m) => m.status === "finalizado").length };

  /* O QUE FOI PRODUZIDO, POR FORMATO.
     "72 posts" não diz se o mês foi de reels ou de carrossel, e é essa a
     conversa da reunião com o cliente e do preço do pacote: reels custa tempo
     de gravação e edição, estático não. Sem formato gravado o post cai em
     "outros" em vez de sumir da conta. */
  const porFormato = new Map<string, { publicados: number; total: number }>();
  for (const p of posts) {
    /* minúsculo SEMPRE. O formato foi texto livre em versões antigas, então o
       banco tem "reels" e "Reels" convivendo, e sem normalizar cada grafia
       virava uma linha própria: a Gabriela viu "Reels 39" e "Reels 1" no mesmo
       relatório. Normalizar aqui junta as grafias sem mexer no dado gravado. */
    const code = (p.format ?? "").trim().toLowerCase() || "outros";
    const atual = porFormato.get(code) ?? { publicados: 0, total: 0 };
    atual.total += 1;
    if (p.approval_status === "postado") atual.publicados += 1;
    porFormato.set(code, atual);
  }
  const formatos = [...porFormato.entries()]
    .map(([code, v]) => ({ code, ...v }))
    .sort((a, b) => b.total - a.total || a.code.localeCompare(b.code));

  const temAlgo =
    posts.length > 0 || captures.length > 0 || creations.length > 0 || materials.length > 0 ||
    tarefasCriadas > 0 || tarefasNoPeriodo.length > 0;

  return {
    posts: {
      publicados: st("postado"),
      aprovados: st("aprovado"),
      emAprovacao: st("pendente") + st("ajuste_solicitado"),
      emProducao,
      total: posts.length,
    },
    formatos,
    capt,
    tarefas: { concluidas: tarefasConcluidas, criadas: tarefasCriadas, noPeriodo: tarefasNoPeriodo },
    criacoes: creations.length,
    materiais,
    temAlgo,
  };
}
