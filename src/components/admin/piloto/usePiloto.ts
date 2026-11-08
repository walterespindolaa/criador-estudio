/* ═══════════════════════════════════════════════════════════════════════════
   PILOTO DO ADMIN, ETAPA 2 (08/11/2026). Dados da aba Piloto: tudo sai da RPC
   piloto_resumo (etapa 1), que é só-admin. Atualiza sozinho de hora em hora e
   ao voltar pra aba do navegador.
   ═══════════════════════════════════════════════════════════════════════════ */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type Origem = "anuncio" | "bio" | "direto" | "organico";
export const ORIGENS: { valor: Origem; rotulo: string; cor: string }[] = [
  { valor: "anuncio", rotulo: "anúncio", cor: "#EA4918" },
  { valor: "bio", rotulo: "link na bio", cor: "#FF77B9" },
  { valor: "direto", rotulo: "direto", cor: "#0061EE" },
  { valor: "organico", rotulo: "orgânico", cor: "#00A652" },
];

export type HoraVisitas = { hora: string } & Record<Origem, number>;
export type Funil = {
  visitas: number; clicou_teste: number; cadastros: number; confirmou: number;
  onboarding: number; usou_funcao: number; assinou: number;
};
export type Cadastro = {
  id: string; name: string | null; criado_em: string;
  origem: "anuncio" | "bio" | "outro" | "sem_origem"; anuncio_id: string | null;
  confirmou: boolean; onboarding: boolean | null; plan: string | null;
  subscription_status: string | null; trial_ends_at: string | null;
  account_type: string | null; ultimo_uso: string | null;
};
export type Anuncio = {
  ad_id: string; ad_nome: string | null; campanha: string | null; gasto: number | null;
  cliques: number | null; visitas_lp: number | null; cadastros: number;
};
export type IaResumo = {
  total: { chamadas: number; custo_usd: number; tokens: number };
  por_funcao: { funcao: string; chamadas: number; custo_usd: number | null; falhas: number }[];
  por_conta: { conta: string | null; chamadas: number; custo_usd: number | null }[];
};
export type ErroGrupo = {
  assinatura: string; exemplo: string; vezes: number; contas: number;
  primeira: string; ultima: string; status: "novo" | "olhando" | "resolvido";
};
export type Resumo = {
  periodo: { desde: string; ate: string };
  visitas_por_hora: HoraVisitas[];
  funil: Funil;
  cadastros: Cadastro[];
  anuncios: Anuncio[];
  ia: IaResumo;
  erros: ErroGrupo[];
};

/** Origem do cadastro no mesmo vocabulário das visitas. */
export const origemDoCadastro = (c: Cadastro): Origem =>
  c.origem === "anuncio" ? "anuncio" : c.origem === "bio" ? "bio" : c.origem === "outro" ? "organico" : "direto";

// ── Período ─────────────────────────────────────────────────────────────────
export type PeriodoChave = "hoje" | "ontem" | "7d" | "30d" | "custom";
export type Intervalo = { desde: Date; ate: Date };
const HORA = 3600000;
const DIA = 24 * HORA;

/** Meia-noite de hoje no fuso de Brasília (UTC-3, sem horário de verão). */
function meiaNoiteBR(ref = new Date()): Date {
  const br = new Date(ref.getTime() - 3 * HORA);
  return new Date(Date.UTC(br.getUTCFullYear(), br.getUTCMonth(), br.getUTCDate()) + 3 * HORA);
}

export function intervaloDo(chave: PeriodoChave, custom?: { de: string; ate: string }): Intervalo {
  const agora = new Date();
  const hoje0 = meiaNoiteBR(agora);
  if (chave === "hoje") return { desde: hoje0, ate: agora };
  if (chave === "ontem") return { desde: new Date(hoje0.getTime() - DIA), ate: hoje0 };
  if (chave === "30d") return { desde: new Date(agora.getTime() - 30 * DIA), ate: agora };
  if (chave === "custom" && custom?.de && custom?.ate) {
    const de = new Date(`${custom.de}T00:00:00-03:00`);
    const ate = new Date(new Date(`${custom.ate}T00:00:00-03:00`).getTime() + DIA);
    if (!isNaN(de.getTime()) && !isNaN(ate.getTime()) && ate > de) return { desde: de, ate };
  }
  return { desde: new Date(agora.getTime() - 7 * DIA), ate: agora };
}

/** Mesmo tamanho, logo antes. */
export const anteriorDe = (i: Intervalo): Intervalo => {
  const t = i.ate.getTime() - i.desde.getTime();
  return { desde: new Date(i.desde.getTime() - t), ate: i.desde };
};

// ── Consulta ────────────────────────────────────────────────────────────────
type Rpc = (fn: string, args: Record<string, unknown>) => PromiseLike<{ data: unknown; error: { message: string } | null }>;
const rpc = supabase.rpc.bind(supabase) as unknown as Rpc;

async function buscarResumo(i: Intervalo): Promise<Resumo> {
  // await: o builder do rpc é preguiçoso, só manda o pedido quando alguém espera.
  const { data, error } = await rpc("piloto_resumo", { _desde: i.desde.toISOString(), _ate: i.ate.toISOString() });
  if (error) throw new Error(error.message);
  return data as Resumo;
}

/** Arredonda pro minuto pra a chave do cache não mudar a cada render. */
const chave = (i: Intervalo) => [Math.floor(i.desde.getTime() / 60000), Math.floor(i.ate.getTime() / 60000)];

export function useResumoPiloto(i: Intervalo, ativo = true) {
  return useQuery({
    queryKey: ["piloto-resumo", ...chave(i)],
    queryFn: () => buscarResumo(i),
    enabled: ativo,
    staleTime: 5 * 60000,
    refetchInterval: HORA,
    refetchOnWindowFocus: true,
  });
}

// ── Utilidades ──────────────────────────────────────────────────────────────
/** Câmbio aproximado pra mostrar o custo da IA em real (o banco guarda em dólar). */
export const USD_BRL = 5.4;

export const brl = (v: number | null | undefined) =>
  (v ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export const num = (v: number | null | undefined) => (v ?? 0).toLocaleString("pt-BR");

export function delta(atual: number, antes: number | undefined): { texto: string; sobe: boolean } | null {
  if (antes === undefined) return null;
  if (antes === 0) return atual === 0 ? { texto: "=", sobe: true } : { texto: "novo", sobe: true };
  const p = Math.round(((atual - antes) / antes) * 100);
  return { texto: `${p > 0 ? "+" : ""}${p}%`, sobe: p >= 0 };
}

export const iniciais = (nome: string | null | undefined) =>
  (nome ?? "?").trim().split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase() ?? "").join("") || "?";

export const diasDesde = (iso: string | null | undefined) =>
  iso ? Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / DIA)) : null;

/** Baixa uma tabela como CSV (separador ; pro Excel em português abrir certo). */
export function baixarCsv(nome: string, linhas: Record<string, unknown>[]) {
  if (!linhas.length) return;
  const cols = Object.keys(linhas[0]);
  const esc = (v: unknown) => {
    const s = v === null || v === undefined ? "" : String(v);
    return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const csv = [cols.join(";"), ...linhas.map((l) => cols.map((c) => esc(l[c])).join(";"))].join("\n");
  const url = URL.createObjectURL(new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = `${nome}.csv`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
