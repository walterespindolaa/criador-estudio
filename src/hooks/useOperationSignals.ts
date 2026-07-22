import { useMemo } from "react";
import { useCrmClients } from "@/hooks/useCrm";
import { useAllExternalPosts, useExternalClients } from "@/hooks/useCriaPost";
import { useFinRecords } from "@/hooks/useFinance";
import { hojeBR, parseDateOnly } from "@/lib/date-br";

// ── MOTOR DE SINAIS DA HOME (copiloto de operação) ──
// Calcula, a partir dos dados que já existem, o feed "Sua operação hoje" e a
// saúde de cada cliente. Regra de ouro: dado que não existe NÃO gera sinal
// (sem susto por informação faltando). Ver memória cria-home-copiloto.
export type OpDomain = "conteudo" | "financeiro" | "relacionamento" | "prazo";
export type OpUrgency = "hi" | "mid" | "ok";
export type OpSignal = {
  id: string;
  clientId: string;
  clientName: string;
  clientColor: string | null;
  domain: OpDomain;
  title: string;
  sub: string;
  urgency: OpUrgency;
  actionLabel: string;
  to: string;
  priority: number; // maior = mais urgente
};
export type HealthLevel = "g" | "y" | "r";
export type ClientHealth = {
  clientId: string; name: string; color: string | null; logo: string | null;
  level: HealthLevel; reason: string;
};

const DOMAIN: Record<OpDomain, string> = { conteudo: "#EA4918", financeiro: "#0061EE", relacionamento: "#FF77B9", prazo: "#FFCF03" };
export const DOMAIN_HEX = DOMAIN;

function daysUntil(dateStr: string, today: Date): number {
  return Math.floor((parseDateOnly(dateStr).getTime() - today.getTime()) / 86400000);
}
function daysSince(iso: string): number {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
}

export function useOperationSignals() {
  const { data: crmClients = [] } = useCrmClients();
  const { data: allPosts = [] } = useAllExternalPosts();
  const { clients: extClients } = useExternalClients();
  const { data: finRecords = [] } = useFinRecords();

  return useMemo(() => {
    const todayStr = hojeBR();
    const today = parseDateOnly(todayStr);
    const todayDay = today.getDate();
    const ym = todayStr.slice(0, 7);
    const in7 = new Date(today); in7.setDate(in7.getDate() + 7);
    const in7Str = `${in7.getFullYear()}-${String(in7.getMonth() + 1).padStart(2, "0")}-${String(in7.getDate()).padStart(2, "0")}`;

    // crm_client_id -> external client (Cria Post)
    const extByCrm = new Map<string, { id: string; color: string | null }>();
    extClients.forEach((e) => { if (e.crm_client_id) extByCrm.set(e.crm_client_id, { id: e.id, color: e.color ?? null }); });
    // external_client_id -> posts
    const postsByExt = new Map<string, typeof allPosts>();
    allPosts.forEach((p) => { const a = postsByExt.get(p.external_client_id) ?? []; a.push(p); postsByExt.set(p.external_client_id, a); });
    // pagamento recebido no mês, por cliente
    const paidThisMonth = new Set<string>();
    finRecords.forEach((r) => { if (r.crm_client_id && r.type === "entrada" && r.status === "pago" && r.date.startsWith(ym)) paidThisMonth.add(r.crm_client_id); });

    const signals: OpSignal[] = [];
    const health: ClientHealth[] = [];

    for (const c of crmClients) {
      if ((c.status ?? "ativo") === "inativo") continue;
      const color = (c as { color?: string | null }).color ?? extByCrm.get(c.id)?.color ?? null;
      const push = (s: Omit<OpSignal, "clientId" | "clientName" | "clientColor">) =>
        signals.push({ ...s, clientId: c.id, clientName: c.name, clientColor: color });
      let worst: HealthLevel = "g"; let reason = "Tudo em dia";
      const bump = (lvl: HealthLevel, why: string, pr: number) => {
        const rank = (l: HealthLevel) => (l === "r" ? 2 : l === "y" ? 1 : 0);
        if (rank(lvl) > rank(worst) || (rank(lvl) === rank(worst) && pr >= 0)) {
          if (rank(lvl) >= rank(worst)) { worst = lvl; reason = why; }
        }
      };

      // 1) Conteúdo: aprovação parada
      const ext = extByCrm.get(c.id);
      const posts = ext ? (postsByExt.get(ext.id) ?? []) : [];
      if (ext) {
        const pend = posts.filter((p) => p.approval_status === "pendente");
        if (pend.length) {
          const age = Math.max(...pend.map((p) => daysSince(p.approval_updated_at ?? p.created_at)));
          if (age >= 5) {
            push({ id: `apr-${c.id}`, domain: "conteudo", urgency: "hi", priority: 95,
              title: `Aprovação parada há ${age} dias`, sub: "O cliente ainda não abriu o link",
              actionLabel: "Abrir aprovações", to: `/socialmidia/clientes/${c.id}/posts` });
            bump("r", `Aprovação parada há ${age} dias`, 95);
          } else if (age >= 3) {
            push({ id: `apr-${c.id}`, domain: "conteudo", urgency: "mid", priority: 60,
              title: `Aprovação esperando há ${age} dias`, sub: "Vale cutucar o cliente",
              actionLabel: "Abrir aprovações", to: `/socialmidia/clientes/${c.id}/posts` });
            bump("y", `Aprovação esperando há ${age} dias`, 60);
          }
        }
        // ajuste antigo
        const ajuste = posts.filter((p) => p.approval_status === "ajuste_solicitado");
        if (ajuste.length) {
          const age = Math.max(...ajuste.map((p) => daysSince(p.approval_updated_at ?? p.created_at)));
          if (age >= 5) {
            push({ id: `aju-${c.id}`, domain: "conteudo", urgency: "mid", priority: 55,
              title: `Ajuste pendente há ${age} dias`, sub: "O cliente pediu alteração e ainda não voltou",
              actionLabel: "Abrir posts", to: `/socialmidia/clientes/${c.id}/posts` });
            bump("y", `Ajuste pendente há ${age} dias`, 55);
          }
        }
        // silêncio: sem post agendado nos próximos 7 dias
        const agendadoProx = posts.some((p) => p.scheduled_date && p.scheduled_date >= todayStr && p.scheduled_date <= in7Str);
        if (!agendadoProx) {
          push({ id: `sil-${c.id}`, domain: "conteudo", urgency: "mid", priority: 40,
            title: "Sem post agendado essa semana", sub: "Planeje o conteúdo pra não abrir buraco",
            actionLabel: "Planejar", to: `/socialmidia/clientes/${c.id}/cronograma` });
          bump("y", "Sem post agendado essa semana", 40);
        }
      }

      // 2) Financeiro: mensalidade
      const payDay = Number(c.payment_day) || 0;
      const monthly = Number(c.monthly_value) || 0;
      if (payDay > 0 && monthly > 0 && !paidThisMonth.has(c.id)) {
        if (todayDay > payDay) {
          push({ id: `pag-${c.id}`, domain: "financeiro", urgency: "hi", priority: 90,
            title: "Mensalidade vencida", sub: `Venceu dia ${payDay} e não consta paga`,
            actionLabel: "Ver financeiro", to: `/socialmidia/clientes/${c.id}/financeiro` });
          bump("r", "Mensalidade vencida", 90);
        } else if (payDay - todayDay <= 3) {
          const n = payDay - todayDay;
          push({ id: `pag-${c.id}`, domain: "financeiro", urgency: "mid", priority: 58,
            title: n === 0 ? "Mensalidade vence hoje" : `Mensalidade vence em ${n} ${n === 1 ? "dia" : "dias"}`, sub: `Dia ${payDay}`,
            actionLabel: "Ver financeiro", to: `/socialmidia/clientes/${c.id}/financeiro` });
          bump("y", n === 0 ? "Mensalidade vence hoje" : `Mensalidade vence em ${n} dias`, 58);
        }
      }

      // 3) Prazo: contrato (alerta graduado 15/7/1)
      if (c.renewal_date) {
        const d = daysUntil(c.renewal_date, today);
        if (d < 0) {
          push({ id: `con-${c.id}`, domain: "prazo", urgency: "hi", priority: 85,
            title: "Contrato venceu", sub: "Fale hoje sobre renovar",
            actionLabel: "Ver cliente", to: `/socialmidia/clientes/${c.id}/visao-geral` });
          bump("r", "Contrato venceu", 85);
        } else if (d <= 1) {
          push({ id: `con-${c.id}`, domain: "prazo", urgency: "hi", priority: 84,
            title: d === 0 ? "Contrato termina hoje" : "Contrato termina amanhã", sub: "Fale com o cliente sobre renovar",
            actionLabel: "Ver cliente", to: `/socialmidia/clientes/${c.id}/visao-geral` });
          bump("r", d === 0 ? "Contrato termina hoje" : "Contrato termina amanhã", 84);
        } else if (d <= 7) {
          push({ id: `con-${c.id}`, domain: "prazo", urgency: "mid", priority: 52,
            title: `Contrato termina em ${d} dias`, sub: "Hora de puxar a renovação",
            actionLabel: "Ver cliente", to: `/socialmidia/clientes/${c.id}/visao-geral` });
          bump("y", `Contrato termina em ${d} dias`, 52);
        } else if (d <= 15) {
          push({ id: `con-${c.id}`, domain: "prazo", urgency: "ok", priority: 30,
            title: `Contrato termina em ${d} dias`, sub: "Comece a pensar na renovação",
            actionLabel: "Ver cliente", to: `/socialmidia/clientes/${c.id}/visao-geral` });
          bump("y", `Contrato termina em ${d} dias`, 30);
        }
      }

      health.push({ clientId: c.id, name: c.name, color, logo: c.logo ?? null, level: worst, reason });
    }

    signals.sort((a, b) => b.priority - a.priority);
    // saúde: pior primeiro (vermelho, amarelo, verde)
    const rank = (l: HealthLevel) => (l === "r" ? 0 : l === "y" ? 1 : 2);
    health.sort((a, b) => rank(a.level) - rank(b.level) || a.name.localeCompare(b.name));

    const counts = {
      total: signals.length,
      red: signals.filter((s) => s.urgency === "hi").length,
      yellow: signals.filter((s) => s.urgency === "mid").length,
    };
    return { signals, health, counts };
  }, [crmClients, allPosts, extClients, finRecords]);
}
