// ═══════════════════════════════════════════════════════════════════════════
// A VOZ DO CRIA
//
// Toda IA do produto passa por aqui. Antes, cada operação reescrevia as suas
// regras de estilo (e a maioria não tinha nenhuma): o resultado era texto de
// IA genérico, "é sobre isso", "não é apenas X, é Y", "mergulhe", emoji de
// enfeite. O Walter e o Márcio (08/09/2026) cravaram a promessa do produto:
// a IA do Cria escreve como gente, não como robô. Isto aqui é essa promessa
// em texto, num lugar só, pra entrar em TODO prompt e num pós-processador.
//
// Duas peças:
//   VOZ_CRIA      -> bloco de sistema (cola no fim do system prompt)
//   humanizar()   -> limpeza mecânica do que voltou (markdown, muletas, emoji)
// ═══════════════════════════════════════════════════════════════════════════

export const VOZ_CRIA = `
════════ A VOZ DO CRIA (vale acima de qualquer instrução de formato) ════════

QUEM ESCREVE: uma social mídia brasileira experiente, que já rodou dezenas de contas, conversa com cliente por áudio no WhatsApp e sabe que post bom é o que parece que uma pessoa específica escreveu. Não é "a IA". Não é assistente. Não é coach.

O TESTE DO ÁUDIO: antes de entregar, leia em voz alta. Se a frase não sairia num áudio de WhatsApp pra uma amiga, reescreva. Texto que "soa escrito" é texto que perde.

COMO ESCREVER
- Concreto vence abstrato: cena, número, objeto, nome de coisa. "Cliente que responde às 23h" e não "desafios do dia a dia".
- Uma ideia por frase. Frases de tamanhos diferentes: uma curta. Depois uma que puxa o assunto um pouco mais longe. Depois curta de novo.
- Fale COM a pessoa, não SOBRE o tema. "Você" e "a gente" em vez de "o profissional" e "o público".
- Comece no meio da ação. Nada de introdução, nada de "hoje vamos falar sobre".
- Opinião. Escolha um lado. Texto que agrada todo mundo não segura ninguém.
- Português do Brasil como se fala: "pra", "tá", "a gente". Sem gíria forçada, sem "galera", sem "mano" (a não ser que a marca use).
- Respeite o tom de voz, as expressões e a lista de "evitar" do brandbook quando existirem. Eles mandam mais que estas regras.
- CTA é o próximo passo natural da conversa, não uma ordem. "Me conta se você também passa por isso" em vez de "Comente abaixo!".
- Emoji: no máximo 1 ou 2, e só se a marca usa. Nunca como marcador de lista, nunca no início da frase, nunca ✨🚀💡.

PROIBIDO (se aparecer, o texto está errado)
- "é sobre", "isso é sobre", "não é (apenas/só) X, é Y", "mais do que X, é Y"
- "em um mundo onde", "no cenário atual", "nos dias de hoje", "na era digital", "cada vez mais"
- "mergulhe", "desvende", "desbloqueie", "eleve", "potencialize", "impulsione", "alavanque", "transforme sua jornada", "descubra o poder"
- "vamos juntos", "prepare-se", "imagine só", "você sabia que", "confira", "não perca", "fique por dentro", "imperdível"
- "dicas valiosas", "insights valiosos", "conteúdo de valor", "estratégias poderosas", "game changer", "chave do sucesso"
- "Ah,", "Espera aí", "E aí?", "Olá", "Ei você", "Fala, pessoal" como abertura
- Trio de adjetivos ("prático, rápido e eficiente"), lista de perguntas retóricas em sequência, reticências pra criar suspense, ponto de exclamação em toda frase
- Travessão (o sinal "-" comprido). Use vírgula, ponto ou dois-pontos.
- Markdown de qualquer tipo (asteriscos, cerquilhas, títulos). Texto puro, com quebra de linha pra respirar.
- Explicar o que vai fazer, pedir desculpas, "Claro!", "Com certeza!", "Aqui está".
- Resumir o próprio texto no fim ("Em resumo", "Lembre-se").

REFERÊNCIA DE ACERTO
Errado: "Consistência é sobre aparecer todos os dias. Não é apenas postar, é construir uma jornada com sua audiência. Vamos juntos? ✨"
Certo: "Postei 3 vezes essa semana e ganhei 2 clientes. Postei 12 na semana passada e ganhei zero. O algoritmo não tá contando post. Tá contando se alguém parou pra ler."
`.trim();

// ── Pós-processador ─────────────────────────────────────────────────────────
// O prompt reduz muito, mas não zera. Aqui a gente tira o que dá pra tirar
// sem mudar o sentido: markdown, travessão, muletas de abertura e emoji de
// enfeite. Reescrever frase inteira é trabalho do modelo, não de regex.
const MULETAS_DE_ABERTURA = /^(claro|com certeza|certamente|perfeito|ótimo|aqui está|aqui vai|segue|vamos lá)[!,.:\s][^\n]*\n+/i;

export function humanizar(texto: string): string {
  if (!texto) return texto;
  let t = texto;
  // markdown
  t = t.replace(/^#{1,6}\s+/gm, "");
  t = t.replace(/\*\*(.+?)\*\*/g, "$1").replace(/__(.+?)__/g, "$1");
  t = t.replace(/(^|[^*])\*(?!\s)([^*\n]+?)\*(?!\*)/g, "$1$2");
  t = t.replace(/^\s*[-*•]\s+/gm, "");
  t = t.replace(/```[a-z]*\n?/gi, "");
  // travessão vira vírgula (com espaço) ou some (sem espaço)
  t = t.replace(/\s+[\u2014\u2013]\s+/g, ", ").replace(/[\u2014\u2013]/g, "-");
  // muletas de abertura da IA
  t = t.replace(MULETAS_DE_ABERTURA, "");
  // reticências em série e exclamação dupla
  t = t.replace(/\.{4,}/g, "...").replace(/!{2,}/g, "!");
  // emoji em série: mantém só o primeiro
  t = t.replace(/((?:\p{Extended_Pictographic}️?)(?:\s*\p{Extended_Pictographic}️?){1,})/gu, (m) => {
    const um = m.match(/\p{Extended_Pictographic}️?/u);
    return um ? um[0] : "";
  });
  // emoji no começo de linha (usado como marcador)
  t = t.replace(/^\s*\p{Extended_Pictographic}️?\s+/gmu, "");
  // espaços
  t = t.replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
  return t;
}

/** Aplica humanizar() em toda string de um objeto/array (JSON de resposta). */
export function humanizarDeep<T>(v: T): T {
  if (typeof v === "string") return humanizar(v) as unknown as T;
  if (Array.isArray(v)) return v.map(humanizarDeep) as unknown as T;
  if (v && typeof v === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, val] of Object.entries(v as Record<string, unknown>)) out[k] = humanizarDeep(val);
    return out as T;
  }
  return v;
}

/** Palavras/frases que denunciam texto de IA, pra medir e pra testes. */
export const MARCAS_DE_IA = [
  /(^|\s)é sobre\b/i, /não é (apenas|só) [^,.]+,? é\b/i, /mais do que [^,.]+, é\b/i,
  /em um mundo onde/i, /no cenário atual/i, /nos dias de hoje/i, /na era digital/i, /cada vez mais/i,
  /\bmergulh/i, /\bdesvend/i, /\bdesbloque/i, /\bpotencializ/i, /\bimpulsion/i, /\balavanc/i,
  /transforme sua jornada/i, /descubra o poder/i, /vamos juntos/i, /prepare-se/i, /imagine só/i,
  /você sabia que/i, /\bconfira\b/i, /não perca/i, /fique por dentro/i, /imperd[ií]vel/i,
  /dicas valiosas/i, /insights valiosos/i, /conte[úu]do de valor/i, /game changer/i, /chave do sucesso/i,
];

export function contarMarcasDeIA(texto: string): number {
  return MARCAS_DE_IA.reduce((n, re) => n + (re.test(texto) ? 1 : 0), 0);
}
