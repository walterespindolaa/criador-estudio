/* Dados do painel de cupons (admin_cupons_painel, admin_cupom_ficha e a edge
   cupom-admin). Ver supabase/migrations/20261109120000_cupons_painel.sql. */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { brlCentavos } from "@/lib/money";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const rpc = (fn: string, args?: Record<string, unknown>) => (supabase.rpc as any)(fn, args);

export type TipoDono = "parceira" | "assessor" | "agencia";
export type TipoRegra = "nenhuma" | "pct" | "fixo";

export type Cupom = {
  codigo: string; origem: "campanha" | "parceira"; partner_id: string | null;
  dias_gratis: number; desconto_pct: number; desconto_meses: number;
  planos: string[] | null; limite_usos: number | null; usos: number; valido_ate: string | null;
  status: "ativo" | "pausado" | "vencido" | "esgotado";
  comissao_tipo: TipoRegra; comissao_pct: number | null; comissao_fixo_cents: number | null;
  comissao_de: number; comissao_ate: number | null; criado_em: string;
  dono_nome: string | null; tipo_dono: TipoDono | null; dono_pix: string | null;
  clientes: number; pagantes: number; em_teste: number; receita_mes: number; a_pagar: number; pago: number;
};
export type APagar = {
  partner_id: string; nome: string | null; tipo: TipoDono; pix: string | null;
  competencia: string; fechado: boolean; mensalidades: number; total: number;
};
export type Dono = { id: string; nome: string | null; tipo: TipoDono; pix: string | null; tem_conta: boolean };
export type Painel = {
  mes: string;
  cupons: Cupom[];
  kpis: {
    a_pagar_fechado: number; a_pagar_total: number; pessoas_a_pagar: number;
    cupons_ativos: number; cupons_com_dono: number;
    clientes: number; pagantes: number; em_teste: number; receita_mes: number; previsto_3m: number;
  };
  previsao: { competencia: string; total: number }[];
  a_pagar: APagar[];
  donos: Dono[];
};
export type RegraCliente = { tipo: TipoRegra; pct: number | null; fixo_cents: number | null; de: number; ate: number | null };
export type ClienteFicha = {
  nome: string; plano: string | null; cupom: string | null; pagas: number;
  status: "ativo" | "teste" | "cancelado"; regra: RegraCliente | null; ultima: number;
  lancamentos: { seq: number; valor: number; status: "payable" | "paid" | "canceled" }[];
};
export type Ficha = {
  dono: { id: string; nome: string | null; tipo: TipoDono; pix: string | null; desde: string; tem_conta: boolean; cupons: string[] };
  totais: { a_pagar: number; pago: number };
  clientes: ClienteFicha[];
  pagamentos: { competencia: string; total: number; mensalidades: number; pago_em: string; comprovante: string | null; nota: string | null }[];
};
export type Solto = { codigo: string; usos: number; limite: number | null; pct: number | null; valor_cents: number | null; duracao: string; meses: number | null; vence: string | null };

export function usePainelCupons(ativo: boolean) {
  return useQuery<Painel | null>({
    queryKey: ["admin-cupons"],
    enabled: ativo,
    queryFn: async () => {
      const { data, error } = await rpc("admin_cupons_painel");
      if (error) {
        if (/does not exist|schema cache|could not find/i.test(error.message)) return null;
        throw error;
      }
      return (data ?? null) as Painel | null;
    },
  });
}

export function useFichaDono(partnerId: string | null) {
  return useQuery<Ficha | null>({
    queryKey: ["admin-cupom-ficha", partnerId],
    enabled: !!partnerId,
    queryFn: async () => {
      const { data, error } = await rpc("admin_cupom_ficha", { _partner_id: partnerId });
      if (error) throw error;
      return (data ?? null) as Ficha | null;
    },
  });
}

export function useSoltosNaStripe(ativo: boolean) {
  return useQuery<Solto[]>({
    queryKey: ["admin-cupons-stripe"],
    enabled: ativo,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("cupom-admin", { body: { acao: "stripe_soltos" } });
      if (error) return [];
      return ((data as { soltos?: Solto[] } | null)?.soltos ?? []);
    },
  });
}

export async function chamarCupomAdmin(body: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke("cupom-admin", { body });
  const d = data as { ok?: boolean; error?: string; message?: string } | null;
  if (error || !d?.ok) {
    // functions.invoke esconde o corpo do 4xx em error.context
    let msg = d?.message ?? d?.error ?? null;
    try {
      const ctx = (error as { context?: Response } | null)?.context;
      if (!msg && ctx) { const j = await ctx.json(); msg = j?.message ?? j?.error ?? null; }
    } catch { /* sem corpo */ }
    throw new Error(MENSAGENS[msg ?? ""] ?? msg ?? "Não deu certo. Tente de novo.");
  }
  return d;
}

const MENSAGENS: Record<string, string> = {
  codigo_invalido: "Use de 3 a 24 letras, números, - ou _.",
  codigo_em_uso: "Esse código já existe.",
  comissao_sem_dono: "Comissão precisa de um dono.",
  mensalidade_inicial_invalida: "A mensalidade inicial vai de 1 a 36.",
  mensalidade_final_invalida: "A mensalidade final precisa ser igual ou depois da inicial.",
  percentual_invalido: "O percentual vai de 1 a 100.",
  valor_fixo_invalido: "Coloque o valor fixo em reais.",
  nome_do_dono: "Coloque o nome do dono.",
  forbidden: "Só admin.",
};

export async function pagarCompetencia(partnerId: string, competencia: string, nota: string | null) {
  const { data, error } = await rpc("admin_pagar_competencia", {
    _partner_id: partnerId, _competencia: competencia, _note: nota,
  });
  if (error) throw new Error(error.message);
  const r = data as { ok?: boolean; motivo?: string; total_cents?: number };
  if (!r?.ok) throw new Error(r?.motivo ?? "não deu pra fechar");
  return r;
}

// ── Formatação ─────────────────────────────────────────────────────────
// Valores do painel vêm em centavos (Stripe): formato único do app.
export const brl = brlCentavos;
export const brlCurto = (c: number | null | undefined) => {
  const v = (c ?? 0) / 100;
  return v >= 100 ? `R$ ${Math.round(v).toLocaleString("pt-BR")}` : brl(c);
};
export const mesNome = (iso: string, curto = false) => {
  const [a, m] = iso.split("-").map(Number);
  return new Date(a, m - 1, 1).toLocaleDateString("pt-BR", { month: curto ? "short" : "long" }).replace(".", "");
};
export const dataBR = (iso: string | null | undefined) => {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", timeZone: "America/Sao_Paulo" });
};
export const iniciais = (nome: string | null | undefined) => {
  const p = (nome ?? "").trim().split(/\s+/).filter(Boolean);
  if (!p.length) return "?";
  return p.length === 1 ? `${p[0][0]}.` : `${p[0][0]}. ${p[p.length - 1][0]}.`;
};
export const mascararPix = (pix: string | null) => {
  if (!pix) return null;
  const so = pix.replace(/\D/g, "");
  if (so.length === 11) return `CPF ***.${so.slice(6, 9)}`;
  if (so.length === 14) return `CNPJ ***.${so.slice(8, 12)}`;
  if (pix.includes("@")) return `${pix.slice(0, 2)}***${pix.slice(pix.indexOf("@"))}`;
  return pix.length > 8 ? `***${pix.slice(-4)}` : pix;
};
export const ROTULO_DONO: Record<TipoDono, string> = { parceira: "Parceira", assessor: "Assessor", agencia: "Agência" };

export function textoDesconto(c: Pick<Cupom, "desconto_pct" | "desconto_meses" | "dias_gratis">) {
  const partes: string[] = [];
  const gratis = c.dias_gratis > 0 ? Math.max(1, Math.round(c.dias_gratis / 30)) : 0;
  if (gratis) partes.push(gratis === 1 ? "1 mês grátis" : `${gratis} meses grátis`);
  const pct = Number(c.desconto_pct);
  if (pct > 0) {
    const q = c.desconto_meses <= 1 ? "na 1ª mensalidade" : `por ${c.desconto_meses} meses`;
    partes.push(gratis ? `+ ${pct}% ${q.replace("na 1ª mensalidade", "na 1ª paga")}` : `${pct}% ${q}`);
  }
  return partes.join(" ") || "sem desconto";
}

export function textoRegra(r: { tipo: TipoRegra; pct: number | null; fixo_cents: number | null; de: number; ate: number | null } | null, curto = false) {
  if (!r || r.tipo === "nenhuma") return "sem comissão";
  const quanto = r.tipo === "fixo" ? `${brl(r.fixo_cents)} fixo` : `${Number(r.pct)}%`;
  const quando = r.de === r.ate ? `na ${r.de}ª` : `da ${r.de}ª à ${r.ate}ª`;
  return curto ? `${quanto} ${quando}` : `${quanto} ${quando} mensalidade`;
}

export const regraDoCupom = (c: Cupom) => ({
  tipo: c.comissao_tipo, pct: c.comissao_pct, fixo_cents: c.comissao_fixo_cents, de: c.comissao_de, ate: c.comissao_ate,
});
