import type { CSSProperties, ReactNode } from "react";
import { cn } from "@/lib/utils";
import { hojeBR } from "@/lib/date-br";
import type { CollabStatus, CollabWithDeliverables, ProposalStatus } from "@/hooks/useCollabs";

/* VISUAL DAS COLLABS (Walter, 06/11/2026, mockup aprovado "pasta de cliente").
   Cada collab é uma pasta com clipe; o orçamento vira ingresso e o cachê vira
   recibo com carimbo. As anotações à mão usam a Grand Hotel, que o app já
   carrega no index.html. */

export const MAO: CSSProperties = { fontFamily: "'Grand Hotel', cursive" };

export const STATUS_PILULA: Record<CollabStatus, string> = {
  lead: "#F1ECE2",
  negociando: "#FFE08A",
  fechado: "#DCE6FF",
  entregue: "#D8F2E0",
  pago: "#EDE7DB",
};

export const brl = (v?: number | null) =>
  v == null ? "a definir" : `R$ ${Number(v).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/** "R$ 1.400" (sem centavos quando é redondo), pra soma escrita à mão. */
export const brlCurto = (v: number) =>
  `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: v % 1 ? 2 : 0, maximumFractionDigits: 2 })}`;

export const dataCurta = (d: string) => {
  const [, m, dia] = d.split("-");
  return `${dia}/${m}`;
};

export function diasAte(d: string): number {
  const hoje = new Date(hojeBR() + "T00:00:00");
  const alvo = new Date(d + "T00:00:00");
  return Math.round((alvo.getTime() - hoje.getTime()) / 86400000);
}

const PROPOSTA_LINHA: Record<ProposalStatus, string> = {
  none: "sem orçamento",
  enviada: "orçamento enviado",
  vista: "orçamento visto",
  aceita: "orçamento aceito",
  recusada: "orçamento recusado",
  ajuste: "ajuste pedido",
};

export function linhaDaProposta(c: CollabWithDeliverables): string {
  if (c.status === "pago") return "recebido";
  if (c.status === "entregue" && c.total > 0 && c.done === c.total) return "tudo publicado";
  if (c.proposal_status === "vista" && c.proposal_viewed_at) {
    const d = diasAte(c.proposal_viewed_at.slice(0, 10));
    return d === 0 ? "orçamento visto hoje" : d === -1 ? "orçamento visto ontem" : PROPOSTA_LINHA.vista;
  }
  return PROPOSTA_LINHA[c.proposal_status];
}

/** O aviso escrito à mão no cartão: um só, o mais urgente. Mesma conta dos lembretes. */
export type AvisoPasta = { texto: string; tom: "atraso" | "prazo" | "pagar" | "pago" };
export function avisoDaPasta(c: CollabWithDeliverables): AvisoPasta | null {
  const falta = c.total - c.done;
  if (c.status === "pago") return { texto: `pago ${dataCurta(c.updated_at.slice(0, 10))}`, tom: "pago" };
  if (falta > 0 && c.deadline) {
    const d = diasAte(c.deadline);
    if (d < 0) return { texto: `${falta} ${falta === 1 ? "entrega atrasada" : "entregas atrasadas"}`, tom: "atraso" };
    if (d <= 8) return { texto: `faltam ${falta} em ${d === 0 ? "hoje" : `${d} ${d === 1 ? "dia" : "dias"}`}`.replace(" em hoje", " hoje"), tom: "prazo" };
  }
  if (c.total > 0 && falta === 0 && (c.status === "entregue" || c.status === "fechado")) return { texto: "esperando pagamento", tom: "pagar" };
  return null;
}

export const COR_AVISO: Record<AvisoPasta["tom"], string> = {
  atraso: "bg-[#FFE0D6] text-[#9A2A0A]",
  prazo: "bg-[#FFF3A8] text-[#5A4400]",
  pagar: "bg-[#FFE08A] text-[#5A4400]",
  pago: "",
};

/** Clipe de papel desenhado em SVG, no canto da pasta. */
export function Clipe({ className }: { className?: string }) {
  return (
    <svg aria-hidden viewBox="0 0 14 34" className={cn("pointer-events-none absolute", className)} width="14" height="34">
      <path d="M4 30V7a3 3 0 0 1 6 0v20a5 5 0 0 1-10 0V9" fill="none" stroke="#8A8378" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

/** Carimbo de borracha: "a receber" / "pago dd/mm". */
export function Carimbo({ children, cor = "#EB4918" }: { children: ReactNode; cor?: string }) {
  return (
    <span className="inline-block -rotate-6 rounded-lg border-2 px-2.5 py-0.5 text-[19px] leading-tight" style={{ ...MAO, color: cor, borderColor: cor }}>
      {children}
    </span>
  );
}

/** Quadradinhos dos entregáveis (até 6; o resto vira +N). */
export function Quadradinhos({ c }: { c: CollabWithDeliverables }) {
  if (c.total === 0) return null;
  const vis = c.deliverables.slice(0, 6);
  return (
    <span className="inline-flex items-center gap-1" aria-label={`${c.done} de ${c.total} entregáveis publicados`}>
      {vis.map((d) => (
        <span key={d.id} className={cn("h-3.5 w-3.5 rounded-[3px] border-[1.5px] border-foreground grid place-items-center",
          d.published && "bg-[#00A652] border-[#00A652]")}>
          {d.published && <svg viewBox="0 0 10 10" className="h-2.5 w-2.5"><path d="M2 5.2 4.2 7.4 8 3" fill="none" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" /></svg>}
        </span>
      ))}
      {c.total > vis.length && <span className="text-[10px] font-body font-bold text-muted-foreground">+{c.total - vis.length}</span>}
    </span>
  );
}
