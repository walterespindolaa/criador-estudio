/* ═══════════════════════════════════════════════════════════════════════════
   MODELO LOJA E NEGÓCIO LOCAL (22/10/2026)

   Regras puras do cardápio com sacola, dos horários com "aberto agora" e do
   pedido que vai pronto pro WhatsApp. Tudo aqui é testável sem tela.

   O pedido NÃO passa por pagamento: o WhatsApp da loja é o caixa. O site só
   monta a mensagem com os itens e o total; preço e entrega a loja combina.
   ═══════════════════════════════════════════════════════════════════════════ */

import { txt, lista, bool, type DadosBloco } from "@/lib/bioBlocks";

export type ItemCardapio = {
  id: string;
  nome: string;
  desc: string;
  /** Descrição longa que aparece na foto grande. */
  detalhe: string;
  preco: number | null;
  cat: string;
  foto: string;
  ativo: boolean;
};

export type Cardapio = {
  titulo: string;
  categorias: string[];
  itens: ItemCardapio[];
  /** Com pedido ligado e telefone válido, aparece o "+" e a sacola. */
  pedidos: boolean;
  telefone: string;
};

const LIMITE_ITENS = 60;

const numero = (v: unknown): number | null => {
  if (typeof v === "number" && Number.isFinite(v) && v >= 0) return Math.round(v * 100) / 100;
  if (typeof v === "string" && v.trim()) {
    const n = Number(v.replace(/[^\d,.-]/g, "").replace(/\.(?=\d{3}(\D|$))/g, "").replace(",", "."));
    return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) / 100 : null;
  }
  return null;
};

export function lerCardapio(d: DadosBloco): Cardapio {
  const itens = lista<Record<string, unknown>>(d, "itens").slice(0, LIMITE_ITENS).map((i, n) => ({
    id: typeof i?.id === "string" && i.id ? i.id : `item-${n}`,
    nome: String(i?.nome ?? "").slice(0, 80),
    desc: String(i?.desc ?? "").slice(0, 120),
    detalhe: String(i?.detalhe ?? "").slice(0, 600),
    preco: numero(i?.preco),
    cat: String(i?.cat ?? "").slice(0, 40),
    foto: String(i?.foto ?? ""),
    ativo: i?.ativo !== false,
  }));
  const categorias = lista<unknown>(d, "categorias").map((c) => String(c ?? "").trim().slice(0, 40)).filter(Boolean);
  return {
    titulo: txt(d, "titulo", "Cardápio"),
    categorias: Array.from(new Set(categorias)),
    itens,
    pedidos: bool(d, "pedidos", true),
    telefone: txt(d, "telefone"),
  };
}

/** Só os itens que o visitante vê: no ar e com nome. */
export const itensVisiveis = (c: Cardapio) => c.itens.filter((i) => i.ativo && i.nome.trim());

export const real = (n: number) =>
  "R$ " + n.toFixed(2).replace(".", ",").replace(/\B(?=(\d{3})+(?!\d))/g, ".");

/** Telefone pro wa.me: só dígitos, com 55 na frente. Inválido vira "". */
export function foneWhats(tel: string): string {
  let d = (tel ?? "").replace(/\D/g, "");
  if (d.startsWith("55") && d.length >= 12) d = d.slice(2);
  if (d.length < 10 || d.length > 11) return "";
  return "55" + d;
}

export type Sacola = Record<string, number>;

export type LinhaPedido = { id: string; nome: string; qtd: number; preco: number | null };

export function linhasDaSacola(c: Cardapio, s: Sacola): LinhaPedido[] {
  return itensVisiveis(c)
    .filter((i) => (s[i.id] ?? 0) > 0)
    .map((i) => ({ id: i.id, nome: i.nome, qtd: Math.min(99, s[i.id]), preco: i.preco }));
}

export const totalDoPedido = (l: LinhaPedido[]) =>
  l.reduce((t, i) => t + (i.preco ?? 0) * i.qtd, 0);

export const qtdDoPedido = (l: LinhaPedido[]) => l.reduce((t, i) => t + i.qtd, 0);

/** A mensagem que vai pronta pro WhatsApp. Item sem preço entra sem valor, e o
 *  total só aparece quando todos têm preço (total pela metade engana). */
export function mensagemDoPedido(l: LinhaPedido[]): string {
  const todosComPreco = l.every((i) => i.preco !== null);
  const linhas = l.map((i) => `• ${i.qtd}x ${i.nome}` + (i.preco !== null ? ` (${real(i.preco * i.qtd)})` : ""));
  return ["Olá! Quero fazer um pedido:", ...linhas, ...(todosComPreco && l.length ? [`Total: ${real(totalDoPedido(l))}`] : [])].join("\n");
}

export function linkWhats(tel: string, mensagem: string): string {
  const f = foneWhats(tel);
  return f ? `https://wa.me/${f}?text=${encodeURIComponent(mensagem)}` : "";
}

/* ── HORÁRIOS ── */

export const DIAS = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"] as const;

export type Dia = { aberto: boolean; abre: string; fecha: string };
export type Horarios = { titulo: string; dias: Dia[]; observacao: string };

const hora = (v: unknown, padrao: string) =>
  typeof v === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(v) ? v : padrao;

/** Os 7 dias, de domingo (0) a sábado (6), igual ao getDay(). */
export function lerHorarios(d: DadosBloco): Horarios {
  const crus = lista<Record<string, unknown>>(d, "dias");
  const dias = Array.from({ length: 7 }, (_, i) => {
    const c = crus[i] ?? {};
    return { aberto: crus.length ? c.aberto === true : i !== 0, abre: hora(c.abre, "08:00"), fecha: hora(c.fecha, "18:00") };
  });
  return { titulo: txt(d, "titulo", "Horários"), dias, observacao: txt(d, "observacao") };
}

const minutos = (h: string) => Number(h.slice(0, 2)) * 60 + Number(h.slice(3, 5));
const hBonita = (h: string) => (h.endsWith(":00") ? `${Number(h.slice(0, 2))}h` : `${Number(h.slice(0, 2))}h${h.slice(3)}`);

export const faixaDoDia = (d: Dia) => (d.aberto ? `${hBonita(d.abre)} às ${hBonita(d.fecha)}` : "Fechado");

/** Dia da semana e minuto do dia no fuso de Brasília, seja onde for que a
 *  pessoa esteja: a loja abre no horário DELA, não no do visitante. */
export function agoraEmBrasilia(agora: Date = new Date()): { dia: number; min: number } {
  const p = new Intl.DateTimeFormat("en-US", { timeZone: "America/Sao_Paulo", weekday: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23" })
    .formatToParts(agora);
  const wd = p.find((x) => x.type === "weekday")?.value ?? "Sun";
  const dia = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(wd);
  const h = Number(p.find((x) => x.type === "hour")?.value ?? 0);
  const m = Number(p.find((x) => x.type === "minute")?.value ?? 0);
  return { dia: dia < 0 ? 0 : dia, min: h * 60 + m };
}

export type StatusLoja = { aberto: boolean; texto: string } | null;

/** "Aberto agora · fecha às 19h" ou "Fechado · abre amanhã às 6h".
 *  Horário que vira a meia-noite (18h às 2h) conta como aberto até as 2h. */
export function statusAgora(h: Horarios, agora: { dia: number; min: number }): StatusLoja {
  if (!h.dias.some((d) => d.aberto)) return null;
  const { dia, min } = agora;
  const hoje = h.dias[dia];
  const ontem = h.dias[(dia + 6) % 7];
  // Madrugada de um horário que começou ontem.
  if (ontem.aberto && minutos(ontem.fecha) < minutos(ontem.abre) && min < minutos(ontem.fecha)) {
    return { aberto: true, texto: `Aberto agora · fecha às ${hBonita(ontem.fecha)}` };
  }
  if (hoje.aberto) {
    const a = minutos(hoje.abre), f = minutos(hoje.fecha);
    const viraNoite = f < a;
    if (min >= a && (viraNoite || min < f)) return { aberto: true, texto: `Aberto agora · fecha às ${hBonita(hoje.fecha)}` };
    if (min < a) return { aberto: false, texto: `Fechado · abre hoje às ${hBonita(hoje.abre)}` };
  }
  for (let i = 1; i <= 7; i++) {
    const d = h.dias[(dia + i) % 7];
    if (d.aberto) {
      const quando = i === 1 ? "amanhã" : DIAS[(dia + i) % 7].toLowerCase();
      return { aberto: false, texto: `Fechado · abre ${quando} às ${hBonita(d.abre)}` };
    }
  }
  return null;
}

/* ── COLAR UMA LISTA ──
   Quem já tem o cardápio num bloco de notas ou no WhatsApp cola tudo de uma
   vez: uma linha por item, "Nome - preço - categoria". A ordem do preço e da
   categoria tanto faz; o pedaço que tem número vira preço. */
export type ItemColado = { nome: string; preco: number | null; cat: string };

export function lerListaColada(texto: string): ItemColado[] {
  return (texto ?? "")
    .split(/\r?\n/)
    .map((l) => l.trim().replace(/^[•\-*·]\s*/, ""))
    .filter(Boolean)
    .slice(0, LIMITE_ITENS)
    .map((l) => {
      const partes = l.split(/\s+[-–|;]\s+|\t/).map((x) => x.trim()).filter(Boolean);
      const nome = (partes.shift() ?? "").slice(0, 80);
      let preco: number | null = null;
      let cat = "";
      for (const p of partes) {
        if (preco === null && /\d/.test(p)) preco = numero(p);
        else if (!cat) cat = p.slice(0, 40);
      }
      return { nome, preco, cat };
    })
    .filter((i) => i.nome);
}

export const LIMITE_DO_CARDAPIO = LIMITE_ITENS;

/** O WhatsApp da página: o primeiro número válido entre Contato, botão fixo e
 *  bloco de WhatsApp. É o que pedido, serviço e chamada usam quando o bloco
 *  não tem número próprio. */
export function telefoneDaPagina(blocos: { kind: string; data?: DadosBloco | null }[]): string {
  for (const k of ["contato", "acao_fixa", "whatsapp"]) {
    const t = txt(blocos.find((b) => b.kind === k)?.data ?? {}, "telefone");
    if (t.replace(/\D/g, "").length >= 10) return t;
  }
  return "";
}
