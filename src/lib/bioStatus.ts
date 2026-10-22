/* ═══════════════════════════════════════════════════════════════════════════
   O ESTADO DE CADA SEÇÃO NO EDITOR (22/10/2026)

   Cada seção diz uma coisa só: Pronta, Texto de exemplo, Falta X ou
   Escondida. Com isso a tela sabe quanto da página está pronta e qual é o
   próximo passo, e a pessoa não precisa adivinhar o que falta.

   "Texto de exemplo" é o texto que veio do modelo e ninguém trocou. A gente
   reconhece comparando com os textos dos próprios modelos: se é igual, é
   exemplo. Rótulo curto ("Serviços", "Quero esse") não conta, porque serve
   do jeito que veio.
   ═══════════════════════════════════════════════════════════════════════════ */

import { faltaNoBloco, lista, metaDoBloco, txt, type DadosBloco } from "@/lib/bioBlocks";
import { MODELOS } from "@/lib/bioTemplates";
import { NICHOS, blocosDoNicho } from "@/lib/bioEspecialista";
import { foneWhats } from "@/lib/bioLoja";

/** Chaves que nunca contam como exemplo: são texto de serviço, não de marca. */
const CHAVES_LIVRES = new Set(["consentimento", "mensagem", "botao", "botao1", "botao2", "botaoPdf", "rotulo", "url", "url1", "url2", "secao", "destino", "layout", "fundo", "tema", "icone"]);
const MINIMO = 24;

function juntarTextos(v: unknown, chave: string, saida: Set<string>) {
  if (CHAVES_LIVRES.has(chave)) return;
  if (typeof v === "string") { if (v.trim().length >= MINIMO) saida.add(v.trim()); return; }
  if (Array.isArray(v)) { v.forEach((x) => juntarTextos(x, chave, saida)); return; }
  if (v && typeof v === "object") for (const [k, x] of Object.entries(v)) juntarTextos(x, k, saida);
}

let cache: Set<string> | null = null;
/** Todos os textos de exemplo dos modelos (incluindo os oito ramos do
 *  especialista). Calculado uma vez. */
export function textosDeExemplo(): Set<string> {
  if (cache) return cache;
  const s = new Set<string>();
  for (const m of MODELOS) for (const b of m.blocos) juntarTextos(b.data, "", s);
  for (const n of NICHOS) for (const b of blocosDoNicho(n)) juntarTextos(b.data, "", s);
  cache = s;
  return s;
}

/** O primeiro texto de exemplo que ainda está no bloco, ou null. */
export function exemploNoBloco(d: DadosBloco): string | null {
  const exemplos = textosDeExemplo();
  const achados = new Set<string>();
  juntarTextos(d, "", achados);
  for (const t of achados) if (exemplos.has(t)) return t;
  return null;
}

export type TipoStatus = "pronta" | "exemplo" | "falta" | "escondida";
export type StatusSecao = { tipo: TipoStatus; texto: string };

const primeiraMaiuscula = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);

/** Faltas que o faltaNoBloco não enxerga porque dependem da página inteira
 *  (o WhatsApp do Contato) ou são de capricho (foto no item). */
function faltaDaPagina(b: { kind: string; data: DadosBloco }, telefonePagina: string): string | null {
  const d = b.data ?? {};
  const semWhats = (proprio: string) => !foneWhats(proprio || telefonePagina);
  switch (b.kind) {
    case "cardapio": {
      if (d.pedidos !== false && semWhats(txt(d, "telefone"))) return "falta o WhatsApp dos pedidos";
      const semFoto = lista<{ nome?: string; foto?: string; ativo?: boolean }>(d, "itens")
        .filter((i) => i?.ativo !== false && (i?.nome ?? "").trim() && !(i?.foto ?? "").trim()).length;
      return semFoto ? `falta foto em ${semFoto} ${semFoto === 1 ? "item" : "itens"}` : null;
    }
    case "acao_fixa":
    case "chamada":
    case "destaque":
      return txt(d, "destino", "whatsapp") === "whatsapp" && semWhats(txt(d, "telefone")) ? "falta o WhatsApp" : null;
    case "capa":
      return ["foto_cheia", "editorial"].includes(txt(d, "layout")) && !txt(d, "imagem").trim() ? "falta a foto" : null;
    case "depoimentos":
      return lista<{ texto?: string }>(d, "itens").some((i) => (i?.texto ?? "").trim()) ? null : "falta um depoimento";
    case "faq":
      return lista<{ p?: string; r?: string }>(d, "itens").some((i) => (i?.p ?? "").trim() && (i?.r ?? "").trim()) ? null : "falta responder as perguntas";
    default:
      return null;
  }
}

export function statusDaSecao(
  b: { kind: string; data: DadosBloco; is_active: boolean },
  telefonePagina = "",
): StatusSecao {
  if (!b.is_active) return { tipo: "escondida", texto: "Escondida da página" };
  const falta = faltaNoBloco(b) ?? faltaDaPagina(b, telefonePagina);
  if (falta) return { tipo: "falta", texto: primeiraMaiuscula(falta) };
  if (exemploNoBloco(b.data ?? {})) return { tipo: "exemplo", texto: "Texto de exemplo" };
  return { tipo: "pronta", texto: "Pronta" };
}

export type Progresso = {
  pct: number;
  /** O próximo passo: qual seção abrir e o que dizer no botão. */
  proximo: { id: string | "negocio"; texto: string } | null;
};

/** Quanto da página está pronta. "Seu negócio" conta como um passo: sem
 *  WhatsApp, pedido, botão fixo e serviços não têm pra onde mandar. */
export function progressoDaPagina(
  blocos: { id: string; kind: string; data: DadosBloco; is_active: boolean }[],
  telefonePagina: string,
): Progresso {
  const visiveis = blocos.filter((b) => b.is_active);
  const negocioOk = !!foneWhats(telefonePagina);
  const total = visiveis.length + 1;
  let prontas = negocioOk ? 1 : 0;
  let proximo: Progresso["proximo"] = negocioOk ? null : { id: "negocio", texto: "colocar o WhatsApp em Seu negócio" };
  for (const b of visiveis) {
    const s = statusDaSecao(b, telefonePagina);
    if (s.tipo === "pronta") { prontas++; continue; }
    if (!proximo) {
      const nome = metaDoBloco(b.kind).nome;
      proximo = { id: b.id, texto: s.tipo === "exemplo" ? `trocar o texto de exemplo em ${nome}` : `${nome}, ${s.texto.toLowerCase()}` };
    }
  }
  if (!visiveis.length) return { pct: 0, proximo: { id: "modelos", texto: "escolher um modelo" } };
  return { pct: Math.round((prontas / total) * 100), proximo };
}
