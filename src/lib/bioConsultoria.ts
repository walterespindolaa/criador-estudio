/* ═══════════════════════════════════════════════════════════════════════════
   MODELO CONSULTORIA E SERVIÇOS (22/10/2026)

   Capa editorial, "é pra você se", serviços com o que inclui, etapas, FAQ e
   uma chamada final. O conteúdo de cada bloco mora no próprio bloco: nada de
   página de serviço separada, que era justamente o que confundia.
   ═══════════════════════════════════════════════════════════════════════════ */

import { lista, linkDoBotao, txt, bool, type DadosBloco } from "@/lib/bioBlocks";
import { linkWhats } from "@/lib/bioLoja";
import { ehMarcador } from "@/lib/bioMovimento";

const corta = (v: unknown, n: number) => String(v ?? "").trim().slice(0, n);

/** "Uma linha por item" vira lista, sem linha vazia e sem marcador na frente. */
export const linhas = (texto: unknown, max = 8, tam = 120) =>
  String(texto ?? "")
    .split(/\r?\n/)
    .map((l) => l.trim().replace(/^[•\-*·✓]\s*/, "").slice(0, tam))
    .filter(Boolean)
    .slice(0, max);

/* ── Capa editorial ── */
export type NumeroCapa = { valor: string; rotulo: string };

export function numerosDaCapa(d: DadosBloco): NumeroCapa[] {
  return lista<{ valor?: string; rotulo?: string }>(d, "numeros")
    .map((n) => ({ valor: corta(n?.valor, 16), rotulo: corta(n?.rotulo, 40) }))
    .filter((n) => n.valor && !ehMarcador(n.valor))
    .slice(0, 2);
}

/** Separa o título em pedaços pra pôr em itálico a palavra escolhida.
 *  Sem a palavra no título, devolve o título inteiro sem destaque. */
export function tituloComDestaque(titulo: string, destaque: string): { texto: string; marcado: boolean }[] {
  const d = destaque.trim();
  if (!d) return [{ texto: titulo, marcado: false }];
  const i = titulo.toLowerCase().indexOf(d.toLowerCase());
  if (i < 0) return [{ texto: titulo, marcado: false }];
  return [
    { texto: titulo.slice(0, i), marcado: false },
    { texto: titulo.slice(i, i + d.length), marcado: true },
    { texto: titulo.slice(i + d.length), marcado: false },
  ].filter((p) => p.texto);
}

/* ── Serviços ── */
export type Servico = {
  id: string; nome: string; duracao: string; resumo: string; inclui: string[]; preco: string; destaque: boolean;
};

export function lerServicos(d: DadosBloco): Servico[] {
  return lista<Record<string, unknown>>(d, "itens").slice(0, 6).map((s, n) => ({
    id: typeof s?.id === "string" && s.id ? s.id : `servico-${n}`,
    nome: corta(s?.nome, 60),
    duracao: corta(s?.duracao, 30),
    resumo: corta(s?.resumo, 240),
    inclui: linhas(s?.inclui, 8, 100),
    preco: precoLimpo(s?.preco),
    destaque: s?.destaque === true,
  })).filter((s) => s.nome);
}

/** "R$ 1.500" e "1.500" viram "1.500": o "R$" a página põe. Marcador some. */
export function precoLimpo(v: unknown): string {
  const t = corta(v, 24).replace(/^r\$\s*/i, "");
  return t && !ehMarcador(t) ? t : "";
}

/** Pra onde vai o "Quero esse": WhatsApp com o nome do serviço, ou a chamada
 *  final da página, ou o rodapé. Nunca um botão que não leva a lugar nenhum. */
export function destinoDoServico(nome: string, telefone: string, temChamada: boolean): string {
  const w = linkWhats(telefone, `Olá! Quero saber do serviço: ${nome}`);
  if (w) return w;
  return temChamada ? "#agendar" : "#contato";
}

/* ── Etapas ── */
export function lerEtapas(d: DadosBloco): { titulo: string; texto: string }[] {
  return lista<{ titulo?: string; texto?: string }>(d, "itens")
    .map((e) => ({ titulo: corta(e?.titulo, 70), texto: corta(e?.texto, 260) }))
    .filter((e) => e.titulo)
    .slice(0, 6);
}

/* ── É pra você se ── */
export function lerPraQuem(d: DadosBloco): string[] {
  return lista<unknown>(d, "itens").map((i) => corta(i, 140)).filter(Boolean).slice(0, 6);
}

/* ── Chamada final e botão fixo: o mesmo jeito de escolher o destino ── */
export type Destino = "whatsapp" | "link" | "secao";

export function destinoDoBotao(d: DadosBloco, telefonePadrao = ""): string {
  const destino = txt(d, "destino", "whatsapp") as Destino;
  if (destino === "secao") {
    const s = txt(d, "secao").replace(/^#/, "");
    return /^[a-z0-9_-]{1,40}$/i.test(s) ? `#${s}` : "";
  }
  if (destino === "link") return linkDoBotao(txt(d, "url"));
  return linkWhats(txt(d, "telefone") || telefonePadrao, txt(d, "mensagem") || "Olá! Vim pelo seu site.");
}

export const mostraNota = (d: DadosBloco) => bool(d, "mostrarNota", true) && !!txt(d, "nota").trim();

/** As partes da página que um botão pode alcançar (#id), na ordem da página.
 *  Mesmos ids que o SiteBio põe em cada seção. */
const ANCORAS: Record<string, { id: string; nome: string }> = {
  capa: { id: "topo", nome: "Topo" },
  apresentacao: { id: "topo", nome: "Topo" },
  perfil_criadora: { id: "topo", nome: "Topo" },
  sobre: { id: "sobre", nome: "Sobre" },
  cardapio: { id: "cardapio", nome: "Cardápio" },
  horarios: { id: "horarios", nome: "Horários" },
  produtos: { id: "servicos", nome: "Serviços" },
  servicos: { id: "servicos", nome: "Serviços" },
  blog: { id: "blog", nome: "Blog" },
  depoimentos: { id: "depoimentos", nome: "Depoimentos" },
  atendimento: { id: "atendimento", nome: "Onde atende" },
  faq: { id: "perguntas", nome: "Perguntas" },
  videos: { id: "conteudo", nome: "Últimos vídeos" },
  midiakit: { id: "midiakit", nome: "Mídia kit" },
  parceria: { id: "parceria", nome: "Proposta de parceria" },
  chamada: { id: "agendar", nome: "Chamada final" },
  contato: { id: "contato", nome: "Rodapé com contato" },
};

export function ancorasDaPagina(kinds: string[]): { id: string; nome: string }[] {
  const vistas = new Set<string>();
  const r: { id: string; nome: string }[] = [];
  for (const k of kinds) {
    const a = ANCORAS[k];
    if (a && !vistas.has(a.id)) { vistas.add(a.id); r.push(a); }
  }
  return r;
}
