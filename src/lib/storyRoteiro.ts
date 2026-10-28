/* ═══════════════════════════════════════════════════════════════════════════
   ROTEIRO DO STORY EM PARTES (28/10/2026, mockup aprovado)

   Antes o roteiro do story era um texto só ("o que gravar + texto da tela") e o
   Prompter lia tudo, inclusive a instrução. Agora o story tem um TIPO (falado,
   figurinha, foto/vídeo pronto, texto na tela) e o roteiro vem em partes com
   rótulo, uma por linha:

     Mostrar: o set montado enquanto fala
     Fala: Três coisas que eu faço antes de gravar e ninguém vê.
     Na tela: roteiro aberto = zero travada
     Fechamento: Me conta na caixinha qual é a sua trava

   No banco continua sendo um texto só (story_slots.script e posts.script), então
   o Criando, a publicação e os gatilhos de sincronia não mudam. Texto antigo sem
   rótulo continua valendo: vira a parte 1 inteira.
   ═══════════════════════════════════════════════════════════════════════════ */

export type TipoStory = "falado" | "figurinha" | "midia" | "texto";

export const TIPOS_STORY: TipoStory[] = ["falado", "figurinha", "midia", "texto"];

/** Rótulo que a pessoa vê em cada um dos 3 blocos do roteiro, por tipo. */
export const ROTULOS_STORY: Record<TipoStory, [string, string, string]> = {
  falado: ["O que falar", "O que aparece na tela", "Fechamento"],
  figurinha: ["Pergunta da figurinha", "Opções ou resposta esperada", "O que fazer com as respostas"],
  midia: ["Qual mídia", "Texto por cima", "Fechamento"],
  texto: ["Frase principal", "Complemento", "Fechamento"],
};

/** Chave gravada no texto, por tipo e bloco. */
const CHAVES: Record<TipoStory, [string, string, string]> = {
  falado: ["Fala", "Na tela", "Fechamento"],
  figurinha: ["Figurinha", "Opções", "Depois"],
  midia: ["Mídia", "Texto por cima", "Fechamento"],
  texto: ["Frase", "Complemento", "Fechamento"],
};

const BLOCO_DA_CHAVE: Record<string, 0 | 1 | 2 | "mostrar"> = {
  fala: 0, figurinha: 0, midia: 0, frase: 0,
  "na tela": 1, opcoes: 1, "texto por cima": 1, complemento: 1,
  fechamento: 2, depois: 2,
  mostrar: "mostrar",
};

const semAcento = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

const RE_ROTULO = /^\s*(fala|figurinha|m[ií]dia|frase|na tela|op[cç][oõ]es|texto por cima|complemento|fechamento|depois|mostrar)\s*:\s*(.*)$/i;

export function storyComFigurinha(formato: string | null | undefined): boolean {
  return /(enquete|caixinha|quiz|contagem|sticker|figurinha|link|dm|pergunta|teste|votac)/.test((formato ?? "").toLowerCase());
}

/** Story falado = vai pro Prompter. "falado" é o formato que o Novo story grava;
 *  os outros vêm dos planos antigos e da curadoria. Espelha public.story_falado. */
export function storyFalado(formato: string | null | undefined): boolean {
  const f = (formato ?? "").toLowerCase();
  if (storyComFigurinha(f)) return false;
  return /(falad|talking|bastidor|tutorial|pov|video|sequencia|depoimento|vlog|rotina)/.test(f);
}

export function tipoDoFormato(formato: string | null | undefined): TipoStory {
  const f = (formato ?? "").toLowerCase();
  if (storyComFigurinha(f)) return "figurinha";
  if (storyFalado(f)) return "falado";
  if (/(texto|frase|aviso|lista)/.test(f)) return "texto";
  return "midia";
}

/** Formato gravado pro tipo escolhido no Novo story. Figurinha guarda o tipo
 *  dela quando já se sabe (enquete, quiz...), pro selo ficar certo. */
export function formatoDoTipo(tipo: TipoStory, formatoAtual?: string | null): string {
  if (tipo === "figurinha") return storyComFigurinha(formatoAtual) ? String(formatoAtual) : "figurinha";
  if (tipo === "falado") return storyFalado(formatoAtual) ? String(formatoAtual) : "falado";
  if (tipo === "texto") return "texto";
  return tipoDoFormato(formatoAtual) === "midia" && formatoAtual ? String(formatoAtual) : "foto";
}

export type PartesStory = { b1: string; b2: string; b3: string; mostrar: string; estruturado: boolean };

export function lerRoteiro(script: string | null | undefined): PartesStory {
  const out: PartesStory = { b1: "", b2: "", b3: "", mostrar: "", estruturado: false };
  const txt = (script ?? "").trim();
  if (!txt) return out;
  let atual: 0 | 1 | 2 | "mostrar" = 0;
  const partes: Record<string, string[]> = { 0: [], 1: [], 2: [], mostrar: [] };
  for (const linha of txt.split(/\r?\n/)) {
    const m = linha.match(RE_ROTULO);
    if (m) {
      const k = BLOCO_DA_CHAVE[semAcento(m[1]).replace(/\s+/g, " ")];
      if (k !== undefined) {
        out.estruturado = true;
        atual = k;
        if (m[2].trim()) partes[String(atual)].push(m[2].trim());
        continue;
      }
    }
    if (linha.trim()) partes[String(atual)].push(linha.trim());
  }
  out.b1 = partes["0"].join("\n");
  out.b2 = partes["1"].join("\n");
  out.b3 = partes["2"].join("\n");
  out.mostrar = partes.mostrar.join(" ");
  return out;
}

export function montarRoteiro(tipo: TipoStory, p: { b1?: string; b2?: string; b3?: string; mostrar?: string }): string {
  const [k1, k2, k3] = CHAVES[tipo];
  const linhas: string[] = [];
  const add = (k: string, v?: string) => {
    const t = (v ?? "").trim();
    if (t) linhas.push(`${k}: ${t.replace(/\s*\n\s*/g, " ")}`);
  };
  add("Mostrar", p.mostrar);
  add(k1, p.b1);
  add(k2, p.b2);
  add(k3, p.b3);
  return linhas.join("\n");
}

/** O que o Prompter rola num story: só o que é FALADO (fala + fechamento).
 *  "Mostrar" e "Na tela" viram etiquetas fora da rolagem. Texto antigo sem
 *  rótulo vai inteiro, como antes. */
export function falaDoStory(script: string | null | undefined): { fala: string; mostrar: string; tela: string } {
  const p = lerRoteiro(script);
  if (!p.estruturado) return { fala: (script ?? "").trim(), mostrar: "", tela: "" };
  return {
    fala: [p.b1, p.b3].filter((x) => x.trim()).join("\n"),
    mostrar: p.mostrar,
    tela: p.b2,
  };
}

/** Story gerado pela Cria IA (op story-plan-generate / story-escrever). */
export type StoryIA = {
  dia?: number; horario?: string; titulo?: string; tipo?: string; formato?: string;
  fala?: string; tela?: string; fechamento?: string; mostrar?: string; roteiro?: string;
};

export function storyDaIA(s: StoryIA): { tipo: TipoStory; format: string; script: string; title: string } {
  const tipoIA = TIPOS_STORY.includes(s.tipo as TipoStory) ? (s.tipo as TipoStory) : tipoDoFormato(s.formato);
  const format = formatoDoTipo(tipoIA, s.formato);
  const temPartes = [s.fala, s.tela, s.fechamento, s.mostrar].some((x) => typeof x === "string" && x.trim());
  const script = temPartes
    ? montarRoteiro(tipoIA, { b1: s.fala, b2: s.tela, b3: s.fechamento, mostrar: s.mostrar })
    : String(s.roteiro ?? "").trim();
  return { tipo: tipoIA, format, script: script.slice(0, 2000), title: String(s.titulo || "Story").slice(0, 200) };
}

export const NOME_TIPO: Record<TipoStory, string> = {
  falado: "Falado", figurinha: "Com figurinha", midia: "Foto ou vídeo", texto: "Texto na tela",
};
