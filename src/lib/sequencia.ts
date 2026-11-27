import { toISODateBR } from "@/lib/date-br";
import { somarDias } from "@/lib/oQueTrava";

/* ═══════════════════════════════════════════════════════════════════════════
   SEQUÊNCIA DE SEMANAS (Walter, 27/11/2026: "acho que a opcao A", mockup de
   retorno aprovado com "Aprovado, constrói").

   Uma semana conta quando a pessoa publica pelo menos a meta semanal
   (profiles.weekly_goal). A semana vai de segunda a domingo no fuso de São
   Paulo: o post publicado domingo às 23h de Brasília é do domingo, mesmo que
   em UTC já seja segunda.

   Regras:
   · Perder uma semana zera a sequência.
   · A semana atual, ainda aberta, não quebra: se ela ainda não bateu, a
     sequência conta a partir da semana passada. Se já bateu, entra na conta.
   · A maior sequência olha o histórico inteiro, inclusive a semana atual.

   Antes a conta vivia só dentro de Relatórios e valia "pelo menos 1 post na
   semana". Agora as duas telas usam esta mesma função.

   Tudo trabalha com dia de calendário (AAAA-MM-DD) e aritmética em UTC, pra
   não depender do fuso do aparelho.
   ═══════════════════════════════════════════════════════════════════════════ */

const DIA_MS = 86400000;

const paraMs = (dia: string) => {
  const [y, m, d] = dia.split("-").map(Number);
  return Date.UTC(y, (m ?? 1) - 1, d ?? 1);
};

/** Soma (ou subtrai) dias a um AAAA-MM-DD. */
export const somarDiasISO = (dia: string, n: number): string => somarDias(dia, n);

/** Diferença em dias de calendário (b - a). */
export function diferencaDias(a: string, b: string): number {
  return Math.round((paraMs(b) - paraMs(a)) / DIA_MS);
}

/** Segunda-feira (AAAA-MM-DD) da semana daquele dia. */
export function segundaDaSemana(dia: string): string {
  const dow = new Date(paraMs(dia)).getUTCDay(); // 0 = domingo
  return somarDiasISO(dia, -((dow + 6) % 7));
}

export type SemanaSeq = {
  /** Segunda-feira da semana. */
  inicio: string;
  total: number;
  batida: boolean;
  /** A semana de hoje, ainda em andamento. */
  atual: boolean;
};

export type Sequencia = {
  /** Semanas seguidas batendo a meta. */
  atual: number;
  /** A maior sequência do histórico. */
  maior: number;
  meta: number;
  /** Últimas N semanas, da mais antiga pra atual. */
  semanas: SemanaSeq[];
  feitosSemana: number;
  faltamSemana: number;
};

/**
 * @param publicadosEm instantes (timestamptz) de publicação dos posts publicados
 * @param meta posts por semana; menor que 1 vira 1
 * @param hoje AAAA-MM-DD no fuso BR
 */
export function calcularSequencia(publicadosEm: string[], meta: number, hoje: string, ultimas = 8): Sequencia {
  const m = Math.max(1, Math.floor(meta || 1));
  const porSemana = new Map<string, number>();
  for (const ts of publicadosEm) {
    if (!ts) continue;
    const t = Date.parse(ts);
    if (Number.isNaN(t)) continue;
    const s = segundaDaSemana(toISODateBR(new Date(t)));
    porSemana.set(s, (porSemana.get(s) ?? 0) + 1);
  }
  const bateu = (s: string) => (porSemana.get(s) ?? 0) >= m;
  const estaSemana = segundaDaSemana(hoje);

  // Sequência atual: a semana aberta só entra se já bateu; se não, não quebra.
  let atual = 0;
  let cursor = bateu(estaSemana) ? estaSemana : somarDiasISO(estaSemana, -7);
  while (bateu(cursor)) {
    atual += 1;
    cursor = somarDiasISO(cursor, -7);
  }

  // Maior sequência: varre as semanas batidas em ordem.
  const batidas = [...porSemana.keys()].filter((s) => bateu(s) && s <= estaSemana).sort();
  let maior = 0;
  let corrida = 0;
  let anterior: string | null = null;
  for (const s of batidas) {
    corrida = anterior && diferencaDias(anterior, s) === 7 ? corrida + 1 : 1;
    maior = Math.max(maior, corrida);
    anterior = s;
  }
  maior = Math.max(maior, atual);

  const semanas: SemanaSeq[] = [];
  for (let i = ultimas - 1; i >= 0; i--) {
    const inicio = somarDiasISO(estaSemana, -7 * i);
    const total = porSemana.get(inicio) ?? 0;
    semanas.push({ inicio, total, batida: total >= m, atual: i === 0 });
  }

  const feitosSemana = porSemana.get(estaSemana) ?? 0;
  return { atual, maior, meta: m, semanas, feitosSemana, faltamSemana: Math.max(0, m - feitosSemana) };
}

/** Datas de publicação dos posts que contam (status publicado com published_at). */
export function datasPublicadas(posts: { status?: string | null; published_at?: string | null }[]): string[] {
  return posts.filter((p) => p.status === "publicado" && !!p.published_at).map((p) => p.published_at as string);
}

/**
 * Dias fora do app (peça "O que travou?", 27/11/2026): hoje menos o último dia
 * em uso_telas ANTES de hoje. O dia de hoje é ignorado de propósito, porque a
 * abertura de hoje pode já ter sido registrada quando a conta roda.
 * Sem nenhum dia anterior (conta nova), devolve null: não é volta.
 */
export function diasFora(diasDeUso: string[], hoje: string): number | null {
  const antes = diasDeUso.filter((d) => d && d < hoje).sort();
  const ultimo = antes[antes.length - 1];
  return ultimo ? diferencaDias(ultimo, hoje) : null;
}
