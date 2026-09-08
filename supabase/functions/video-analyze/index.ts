// ═══════════════════════════════════════════════════════════════════════════
// ANÁLISE PROFUNDA DE VÍDEO (TwelveLabs / Pegasus 1.5)
//
// O Radar já traz o reel do concorrente (Apify): legenda, números, capa e a
// transcrição do áudio. O que faltava era ENXERGAR o vídeo: cortes, texto na
// tela, enquadramento, ritmo, o que segura a atenção.
//
// VERSÃO 2 (08/09/2026, depois do primeiro teste real com o Walter).
// A v1 devolvia tudo como texto livre e a tela virava um muro de prosa: 40
// chips de "texto na tela" que eram a transcrição picotada, um resumo do áudio
// que repetia a transcrição logo abaixo, e um "como adaptar" genérico porque o
// prompt não sabia de que cliente estávamos falando. Três mudanças de fundo:
//
// 1. VOCABULÁRIO FECHADO. A função de cada bloco e a técnica do gancho saem
//    de uma lista fixa (pedida no prompt e NORMALIZADA aqui, porque modelo
//    nenhum obedece vocabulário 100%). Palavra fechada vira dado: dá pra
//    colorir uma linha do tempo, contar, filtrar e um dia dizer "4 dos 5 reels
//    que mais rodaram desse perfil abrem com número chocante".
// 2. NÚMERO EU CALCULO, NÃO PEÇO. Cortes por minuto, segundo em que o CTA
//    entra e quanto do vídeo é venda saem de conta, não do modelo. Conta não
//    alucina.
// 3. A ANÁLISE TERMINA EM TRABALHO FEITO. O modelo recebe o brandbook do
//    cliente e devolve o ROTEIRO ADAPTADO, bloco a bloco, cronometrado, com
//    fala e o que aparece na tela, mais a lista do que precisa ser gravado.
//    Ler análise não é entrega. Roteiro pronto é.
//
// Fluxo: start -> cria a linha (queued) -> responde na hora -> o trabalho
// pesado roda em EdgeRuntime.waitUntil. A tela faz polling em video_analyses.
//
// Fase 1: SÓ ADMIN. Sem cobrança, sem cota.
// ═══════════════════════════════════════════════════════════════════════════
import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";
import { VOZ_CRIA, humanizarDeep } from "../_shared/voz-cria.ts";

declare const EdgeRuntime: { waitUntil(p: Promise<unknown>): void } | undefined;

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...cors, "Content-Type": "application/json" } });

const TL_BASE = "https://api.twelvelabs.io/v1.3";
const MAX_BASE64_BYTES = 28 * 1024 * 1024; // teto da API é 30 MB em base64

// ═══════════════════════════════════════════════════════════════════════════
// VOCABULÁRIO FECHADO
// A tela lê estas chaves. O que vier fora da lista é normalizado abaixo.
// ═══════════════════════════════════════════════════════════════════════════

/* A função de cada bloco do roteiro (prender, provar, ensinar, tensionar,
   virar, vender, fechar). É o que colore a linha do tempo na tela.
   Sinônimos que o modelo usa na vida real. A ordem importa: varro a frase e
   fico com o termo que aparece PRIMEIRO, porque ele devolve coisas como
   "prender e provar" e a função de verdade é a que abre o bloco. */
const SINONIMOS_FUNCAO: Record<string, string[]> = {
  prender: ["prender", "gancho", "abertura", "abrir", "atencao", "hook", "chamar"],
  provar: ["provar", "prova", "dado", "numero", "evidencia", "credibilidade", "autoridade", "escalar"],
  ensinar: ["ensinar", "explicar", "educar", "detalhar", "contexto", "passo"],
  tensionar: ["tensionar", "tensao", "dor", "medo", "problema", "critica", "criticar", "antecipar", "alerta"],
  virar: ["virar", "virada", "transicao", "solucao", "reviravolta", "resposta", "posicionar"],
  vender: ["vender", "venda", "oferta", "produto", "convite", "pitch"],
  fechar: ["fechar", "fechamento", "cta", "chamada", "encerrar", "final"],
};

/** Como o gancho prende. Vira etiqueta e, somada, vira padrão do perfil. */
const SINONIMOS_TECNICA: Record<string, string[]> = {
  numero_choque: ["numero", "cifra", "estatistica", "dado chocante", "valor"],
  pergunta: ["pergunta", "questiona", "interroga"],
  contraste: ["contraste", "comparacao", "oposicao", "versus"],
  promessa: ["promessa", "beneficio", "resultado", "prometer"],
  dor: ["dor", "medo", "problema", "erro", "risco", "perda"],
  autoridade: ["autoridade", "credencial", "experiencia", "bastidor"],
  curiosidade: ["curiosidade", "misterio", "segredo", "loop", "ninguem te conta"],
  antes_depois: ["antes e depois", "antes/depois", "transformacao", "evolucao"],
  humor: ["humor", "piada", "meme", "engracado", "ironia"],
  historia: ["historia", "storytelling", "caso", "relato"],
  lista: ["lista", "top", "passos", "motivos"],
};

const SINONIMOS_CADENCIA: Record<string, string[]> = {
  lento: ["lento", "calmo", "devagar", "contemplativo"],
  medio: ["medio", "moderado", "equilibrado", "constante"],
  frenetico: ["frenetico", "rapido", "acelerado", "intenso", "picos"],
};

const SINONIMOS_ENQUADRAMENTO: Record<string, string[]> = {
  selfie: ["selfie", "mao", "braco estendido", "frontal proximo"],
  tripe: ["tripe", "tripod", "estatico", "camera parada", "plano medio", "plano fixo"],
  terceiro: ["terceiro", "cinegrafista", "operador", "camera na mao", "gimbal"],
  tela: ["tela", "screencast", "captura", "print", "gravacao de tela"],
};

const SINONIMOS_CTA: Record<string, string[]> = {
  link_bio: ["link na bio", "link da bio", "bio", "link"],
  comenta: ["comenta", "comentario", "escreva", "palavra-chave"],
  salva: ["salva", "salvar", "salve"],
  compartilha: ["compartilha", "envia", "manda pra"],
  segue: ["segue", "seguir", "me siga"],
  dm: ["direct", "dm", "chama no", "mensagem"],
  nenhum: ["nenhum", "sem cta", "nao tem"],
};

const SINONIMOS_FORMATO: Record<string, string[]> = {
  reels: ["reels", "reel", "video vertical", "tiktok"],
  carrossel: ["carrossel", "carousel", "slides"],
  story: ["story", "stories"],
  shorts: ["shorts", "youtube"],
};

const SINONIMOS_DIFICULDADE: Record<string, string[]> = {
  facil: ["facil", "simples", "baixa", "celular"],
  media: ["media", "medio", "moderada", "intermediaria"],
  dificil: ["dificil", "alta", "complexa", "producao", "equipe"],
};

/** Tira acento e baixa a caixa: comparação de texto de modelo tem que ser burra. */
function chave(s: unknown): string {
  return String(s ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

/**
 * Casa o texto do modelo com o vocabulário fechado. Fica com o termo que
 * aparece mais CEDO na frase (o modelo escreve "prender e provar" e a função
 * de verdade é a primeira). Sem match, devolve o padrão.
 */
function normalizar(texto: unknown, mapa: Record<string, string[]>, padrao: string): string {
  const t = chave(texto);
  if (!t) return padrao;
  let melhor = padrao;
  let onde = Number.POSITIVE_INFINITY;
  for (const [canonico, termos] of Object.entries(mapa)) {
    for (const termo of termos) {
      const i = t.indexOf(termo);
      if (i >= 0 && i < onde) { onde = i; melhor = canonico; }
    }
  }
  return melhor;
}

const num = (v: unknown, padrao = 0): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : padrao;
};

// ═══════════════════════════════════════════════════════════════════════════
// O PROMPT
// ═══════════════════════════════════════════════════════════════════════════

type ContextoCliente = {
  nome: string;
  segmento: string;
  oferta: string;
  publico: string;
  tom: string;
  temas: string;
  evitar: string;
};

/** Monta o pedaço do prompt que fala do cliente. Sem cliente, sem invenção. */
function blocoCliente(c: ContextoCliente | null): string {
  if (!c) {
    return `NÃO HÁ CLIENTE DEFINIDO nesta análise. No roteiro adaptado, escreva com um marcador [SEU CLIENTE] no lugar do nome e mantenha a estrutura e a direção concretas. Não invente nicho, produto nem público.`;
  }
  const linhas = [
    `Nome: ${c.nome}`,
    c.segmento && `Segmento: ${c.segmento}`,
    c.oferta && `O que vende: ${c.oferta}`,
    c.publico && `Para quem: ${c.publico}`,
    c.tom && `Tom de voz: ${c.tom}`,
    c.temas && `Temas que trabalha: ${c.temas}`,
    c.evitar && `O que evitar: ${c.evitar}`,
  ].filter(Boolean).join("\n");
  return `O CLIENTE PARA QUEM VOCÊ VAI ADAPTAR:\n${linhas}\n\nO roteiro adaptado é DESTE cliente. Use o assunto, o produto e o vocabulário dele. Se um dado numérico for necessário e você não souber, deixe um marcador claro como [NÚMERO DO SEU MERCADO] em vez de inventar.`;
}

function montarPrompt(c: ContextoCliente | null): string {
  return `Você é um diretor criativo sênior de conteúdo pra Instagram e TikTok. Uma social mídia brasileira está fazendo a engenharia reversa de um reel de concorrente pra reproduzir a FÓRMULA (nunca o conteúdo) com o cliente dela.

Assista ao vídeo inteiro prestando atenção em imagem, som, fala e texto na tela. Responda SEMPRE em português do Brasil, direto, sem enrolação, como quem explica pra uma colega de agência. Nada de elogio genérico: cada linha tem que ser algo que dá pra copiar ou evitar.

${blocoCliente(c)}

VOCABULÁRIO OBRIGATÓRIO (use exatamente estas palavras nestes campos):
- funcao de cada bloco: prender, provar, ensinar, tensionar, virar, vender, fechar. Uma palavra só por bloco, a principal.
- gancho.tecnica: numero_choque, pergunta, contraste, promessa, dor, autoridade, curiosidade, antes_depois, humor, historia, lista.
- ritmo.cadencia: lento, medio, frenetico.
- visual.enquadramento: selfie, tripe, terceiro, tela.
- cta.tipo: link_bio, comenta, salva, compartilha, segue, dm, nenhum.
- dificuldade.nivel: facil, media, dificil.
- formato_sugerido: reels, carrossel, story, shorts.

REGRAS DE CADA CAMPO:
- formula: a espinha do vídeo em uma linha curta, com ">" separando as etapas. Exemplo de forma (não de conteúdo): "número chocante > prova em cascata > crítica ao sistema > oferta com prazo". No máximo 12 palavras.
- resumo: uma frase dizendo do que é o vídeo e por que ele rodou.
- gancho.texto: o que literalmente aparece e é dito nos primeiros segundos.
- estrutura: os blocos do vídeo com tempo de início e fim em segundos. o_que_acontece é a ação, o_que_aparece é o que se vê na tela naquele bloco.
- letreiros: SOMENTE os textos GRANDES sobrepostos, aqueles que existem como peça gráfica. NÃO liste legenda automática nem transcrição da fala. Se o vídeo tem legenda dinâmica acompanhando a fala, isso vai no campo legendas, não aqui. Máximo 8 letreiros.
- legendas: escreva "dinamicas" se as legendas acompanham a fala palavra a palavra, "fixas" se são estáticas, "nenhuma" se não há.
- audio.tipo: fala direta pra câmera, narração em off, só música, trend de áudio.
- por_que_funciona: 3 a 5 razões concretas e específicas deste vídeo.
- dificuldade: o quanto dá trabalho reproduzir isso, e em o_que_precisa liste o que a social mídia vai ter que ter em mãos.
- o_que_gravar: a lista de gravação. Cada item é UMA tomada que precisa existir pra montar o vídeo adaptado. Fale como quem passa ordem pro cliente que vai gravar sozinho no celular.
- roteiro_adaptado: o roteiro JÁ ESCRITO pro cliente descrito acima, seguindo a mesma fórmula e a mesma cronometragem do original. Em cada bloco, fala é o que a pessoa DIZ (texto pronto pra ler, não instrução) e na_tela é o letreiro que entra. legenda_sugerida é a legenda do post.
- notas: de 0 a 10 pra gancho, ritmo, clareza e CTA.

${VOZ_CRIA}`;
}

const SCHEMA = {
  type: "object",
  properties: {
    formula: { type: "string" },
    resumo: { type: "string" },
    gancho: {
      type: "object",
      properties: {
        texto: { type: "string" },
        tecnica: { type: "string" },
        segundos: { type: "number" },
        por_que_prende: { type: "string" },
      },
      required: ["texto", "tecnica", "segundos", "por_que_prende"],
    },
    estrutura: {
      type: "array",
      items: {
        type: "object",
        properties: {
          inicio: { type: "number" },
          fim: { type: "number" },
          funcao: { type: "string" },
          o_que_acontece: { type: "string" },
          o_que_aparece: { type: "string" },
        },
        required: ["inicio", "fim", "funcao", "o_que_acontece", "o_que_aparece"],
      },
    },
    ritmo: {
      type: "object",
      properties: {
        cortes_estimados: { type: "integer" },
        cadencia: { type: "string" },
        onde_a_atencao_cai: { type: "string" },
      },
      required: ["cortes_estimados", "cadencia", "onde_a_atencao_cai"],
    },
    letreiros: { type: "array", items: { type: "string" } },
    legendas: { type: "string" },
    audio: {
      type: "object",
      properties: { tipo: { type: "string" }, musica: { type: "string" } },
      required: ["tipo", "musica"],
    },
    visual: {
      type: "object",
      properties: {
        enquadramento: { type: "string" },
        cenario: { type: "string" },
        luz_e_cores: { type: "string" },
        edicao: { type: "string" },
      },
      required: ["enquadramento", "cenario", "luz_e_cores", "edicao"],
    },
    cta: {
      type: "object",
      properties: { texto: { type: "string" }, tipo: { type: "string" }, segundo: { type: "number" } },
      required: ["texto", "tipo", "segundo"],
    },
    por_que_funciona: { type: "array", items: { type: "string" } },
    dificuldade: {
      type: "object",
      properties: { nivel: { type: "string" }, o_que_precisa: { type: "string" } },
      required: ["nivel", "o_que_precisa"],
    },
    o_que_gravar: { type: "array", items: { type: "string" } },
    roteiro_adaptado: {
      type: "object",
      properties: {
        titulo: { type: "string" },
        blocos: {
          type: "array",
          items: {
            type: "object",
            properties: {
              inicio: { type: "number" },
              fim: { type: "number" },
              funcao: { type: "string" },
              fala: { type: "string" },
              na_tela: { type: "string" },
            },
            required: ["inicio", "fim", "funcao", "fala", "na_tela"],
          },
        },
        legenda_sugerida: { type: "string" },
      },
      required: ["titulo", "blocos", "legenda_sugerida"],
    },
    notas: {
      type: "object",
      properties: {
        gancho: { type: "integer", minimum: 0, maximum: 10 },
        ritmo: { type: "integer", minimum: 0, maximum: 10 },
        clareza: { type: "integer", minimum: 0, maximum: 10 },
        cta: { type: "integer", minimum: 0, maximum: 10 },
      },
      required: ["gancho", "ritmo", "clareza", "cta"],
    },
    formato_sugerido: { type: "string" },
  },
  required: [
    "formula", "resumo", "gancho", "estrutura", "ritmo", "letreiros", "legendas", "audio",
    "visual", "cta", "por_que_funciona", "dificuldade", "o_que_gravar", "roteiro_adaptado",
    "notas", "formato_sugerido",
  ],
};

// ═══════════════════════════════════════════════════════════════════════════
// TRATAMENTO: de prosa solta pra dado utilizável
// ═══════════════════════════════════════════════════════════════════════════

type Bloco = { inicio: number; fim: number; funcao: string; o_que_acontece?: string; o_que_aparece?: string; fala?: string; na_tela?: string };

/** Blocos em ordem, sem tempo negativo, sem fim antes do início, sem buraco. */
function arrumarBlocos(bruto: unknown): Bloco[] {
  if (!Array.isArray(bruto)) return [];
  const blocos = bruto
    .map((b) => {
      const o = (b ?? {}) as Record<string, unknown>;
      const inicio = Math.max(0, num(o.inicio));
      const fim = Math.max(inicio, num(o.fim, inicio));
      return {
        inicio, fim,
        funcao: normalizar(o.funcao, SINONIMOS_FUNCAO, "ensinar"),
        o_que_acontece: o.o_que_acontece ? String(o.o_que_acontece) : undefined,
        o_que_aparece: o.o_que_aparece ? String(o.o_que_aparece) : undefined,
        fala: o.fala ? String(o.fala) : undefined,
        na_tela: o.na_tela ? String(o.na_tela) : undefined,
      };
    })
    .sort((a, b) => a.inicio - b.inicio);
  return blocos;
}

/**
 * Os números que a tela mostra saem daqui, de conta, não do modelo. Isto é o
 * que permite comparar dois reels sem confiar no chute de ninguém.
 */
function calcularMetricas(r: Record<string, unknown>, estrutura: Bloco[]) {
  const duracao = estrutura.length ? Math.max(...estrutura.map((b) => b.fim)) : 0;
  const ritmo = (r.ritmo ?? {}) as Record<string, unknown>;
  const cortes = Math.max(0, num(ritmo.cortes_estimados));
  const cta = (r.cta ?? {}) as Record<string, unknown>;

  // Tempo vendendo: os blocos de venda e fechamento somados.
  const vendendo = estrutura
    .filter((b) => b.funcao === "vender" || b.funcao === "fechar")
    .reduce((s, b) => s + (b.fim - b.inicio), 0);

  // Quando a venda começa: o segundo declarado no CTA ou, na falta dele, o
  // início do primeiro bloco de venda. É o número que diz se o vídeo entrega
  // valor antes de pedir algo (ou se pede antes de entregar).
  const primeiroVenda = estrutura.find((b) => b.funcao === "vender" || b.funcao === "fechar");
  const segCta = num(cta.segundo, -1) > 0 ? num(cta.segundo) : (primeiroVenda ? primeiroVenda.inicio : null);

  return {
    duracao: duracao || null,
    cortes_por_minuto: duracao > 0 ? Math.round((cortes / duracao) * 60) : null,
    segundos_ate_cta: segCta,
    // Quanto do vídeo é venda. Acima de ~35% costuma queimar alcance.
    pct_vendendo: duracao > 0 ? Math.round((vendendo / duracao) * 100) : null,
    blocos: estrutura.length,
  };
}

/** Passa o resultado bruto do modelo pelo vocabulário fechado e pelas contas. */
function tratar(bruto: Record<string, unknown>) {
  const estrutura = arrumarBlocos(bruto.estrutura);
  const gancho = (bruto.gancho ?? {}) as Record<string, unknown>;
  const ritmo = (bruto.ritmo ?? {}) as Record<string, unknown>;
  const visual = (bruto.visual ?? {}) as Record<string, unknown>;
  const cta = (bruto.cta ?? {}) as Record<string, unknown>;
  const dif = (bruto.dificuldade ?? {}) as Record<string, unknown>;
  const rot = (bruto.roteiro_adaptado ?? {}) as Record<string, unknown>;
  const notas = (bruto.notas ?? {}) as Record<string, unknown>;

  const nota = (v: unknown) => Math.min(10, Math.max(0, Math.round(num(v))));

  // Letreiro é peça gráfica, não legenda. Mesmo pedindo no prompt, o modelo
  // às vezes despeja a transcrição: corto no tamanho e no total aqui, porque
  // 40 chips na tela é ruído, não informação.
  const letreiros = (Array.isArray(bruto.letreiros) ? bruto.letreiros : [])
    .map((t) => String(t ?? "").trim())
    .filter((t) => t.length > 0 && t.length <= 90)
    .slice(0, 8);

  return {
    versao: 2,
    formula: String(bruto.formula ?? "").trim(),
    resumo: String(bruto.resumo ?? "").trim(),
    gancho: {
      texto: String(gancho.texto ?? ""),
      tecnica: normalizar(gancho.tecnica, SINONIMOS_TECNICA, "curiosidade"),
      segundos: Math.max(0, num(gancho.segundos, 3)),
      por_que_prende: String(gancho.por_que_prende ?? ""),
    },
    estrutura,
    ritmo: {
      cortes_estimados: Math.max(0, num(ritmo.cortes_estimados)),
      cadencia: normalizar(ritmo.cadencia, SINONIMOS_CADENCIA, "medio"),
      onde_a_atencao_cai: String(ritmo.onde_a_atencao_cai ?? ""),
    },
    letreiros,
    legendas: normalizar(bruto.legendas, {
      dinamicas: ["dinamica", "palavra a palavra", "animada"],
      fixas: ["fixa", "estatica"],
      nenhuma: ["nenhuma", "sem legenda", "nao"],
    }, "nenhuma"),
    audio: {
      tipo: String((bruto.audio as Record<string, unknown>)?.tipo ?? ""),
      musica: String((bruto.audio as Record<string, unknown>)?.musica ?? ""),
    },
    visual: {
      enquadramento: normalizar(visual.enquadramento, SINONIMOS_ENQUADRAMENTO, "tripe"),
      enquadramento_txt: String(visual.enquadramento ?? ""),
      cenario: String(visual.cenario ?? ""),
      luz_e_cores: String(visual.luz_e_cores ?? ""),
      edicao: String(visual.edicao ?? ""),
    },
    cta: {
      texto: String(cta.texto ?? ""),
      tipo: normalizar(cta.tipo, SINONIMOS_CTA, "nenhum"),
      segundo: num(cta.segundo, 0),
    },
    por_que_funciona: (Array.isArray(bruto.por_que_funciona) ? bruto.por_que_funciona : []).map(String).slice(0, 6),
    dificuldade: {
      nivel: normalizar(dif.nivel, SINONIMOS_DIFICULDADE, "media"),
      o_que_precisa: String(dif.o_que_precisa ?? ""),
    },
    o_que_gravar: (Array.isArray(bruto.o_que_gravar) ? bruto.o_que_gravar : []).map(String).slice(0, 10),
    roteiro_adaptado: {
      titulo: String(rot.titulo ?? ""),
      blocos: arrumarBlocos(rot.blocos),
      legenda_sugerida: String(rot.legenda_sugerida ?? ""),
    },
    notas: {
      gancho: nota(notas.gancho), ritmo: nota(notas.ritmo),
      clareza: nota(notas.clareza), cta: nota(notas.cta),
    },
    formato_sugerido: normalizar(bruto.formato_sugerido, SINONIMOS_FORMATO, "reels"),
    metricas: calcularMetricas(bruto, estrutura),
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// CONTEXTO DO CLIENTE
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Sem isto, "como adaptar" vira conselho de cartilha ("abra com um número
 * chocante"), que serve pra qualquer um e não ajuda ninguém. Com o brandbook
 * na mão, o modelo escreve o roteiro no assunto e no tom do cliente.
 */
async function contextoDoCliente(svc: SupabaseClient, crmClientId: string | null): Promise<ContextoCliente | null> {
  if (!crmClientId) return null;
  const { data } = await svc.from("crm_clients")
    .select("company_name, owner_name, segment, brand_core, persona").eq("id", crmClientId).maybeSingle();
  if (!data) return null;
  const bc = (data.brand_core ?? {}) as Record<string, unknown>;
  const p = Array.isArray(data.persona) ? (data.persona[0] ?? {}) as Record<string, unknown> : {};
  const txt = (v: unknown) => String(v ?? "").trim().slice(0, 400);
  return {
    nome: txt(data.company_name) || txt(data.owner_name) || "o cliente",
    segmento: txt(data.segment),
    oferta: txt(bc.offer) || txt(bc.mainProducts),
    publico: txt(bc.audience) || txt(p.pains),
    tom: txt(bc.toneOfVoice) || txt(bc.communicationStyle),
    temas: txt(bc.contentThemes),
    evitar: txt(bc.avoid),
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// Resolver o mp4
// O Radar guarda a url do POST, não do arquivo. O CDN do Instagram expira o
// link do mp4 em horas, então a gente pede um fresco ao Apify (run-sync, um
// post só, centavos) sempre que não vier um utilizável.
// ═══════════════════════════════════════════════════════════════════════════
async function resolverVideoUrl(postUrl: string, videoUrl: string | null, apifyToken: string | null): Promise<string | null> {
  if (videoUrl && await urlViva(videoUrl)) return videoUrl;
  if (!apifyToken) return null;
  try {
    const resp = await fetch(
      `https://api.apify.com/v2/acts/apify~instagram-scraper/run-sync-get-dataset-items?token=${apifyToken}&timeout=90`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ directUrls: [postUrl], resultsType: "posts", resultsLimit: 1 }),
        signal: AbortSignal.timeout(95000),
      },
    );
    if (!resp.ok) return null;
    const itens = await resp.json() as Array<Record<string, unknown>>;
    const it = Array.isArray(itens) ? itens[0] : null;
    const u = it ? String(it.videoUrl || it.video_url || "") : "";
    return u || null;
  } catch {
    return null;
  }
}

async function urlViva(u: string): Promise<boolean> {
  try {
    const r = await fetch(u, { method: "GET", headers: { Range: "bytes=0-0" }, signal: AbortSignal.timeout(8000) });
    return r.ok || r.status === 206;
  } catch {
    return false;
  }
}

// ── TwelveLabs ──────────────────────────────────────────────────────────────
async function analisar(apiKey: string, video: Record<string, string>, prompt: string) {
  const resp = await fetch(`${TL_BASE}/analyze`, {
    method: "POST",
    headers: { "x-api-key": apiKey, "Content-Type": "application/json" },
    body: JSON.stringify({
      model_name: "pegasus1.5",
      video,
      prompt,
      stream: false,
      temperature: 0.3,
      // O roteiro adaptado dobrou o tamanho da resposta: com 4000 vinha cortada.
      max_tokens: 6000,
      response_format: { type: "json_schema", json_schema: SCHEMA },
    }),
    signal: AbortSignal.timeout(170000),
  });
  const texto = await resp.text();
  if (!resp.ok) throw new Error(`twelvelabs ${resp.status}: ${texto.slice(0, 400)}`);
  const out = JSON.parse(texto) as { data?: string; finish_reason?: string; usage?: unknown; error?: { message?: string } };
  return out;
}

// Base64 de um arquivo remoto (fallback quando o TwelveLabs não consegue
// puxar a url do CDN do Instagram direto).
async function baixarBase64(u: string): Promise<string | null> {
  const r = await fetch(u, { signal: AbortSignal.timeout(60000) });
  if (!r.ok) return null;
  const buf = new Uint8Array(await r.arrayBuffer());
  if (buf.byteLength > MAX_BASE64_BYTES) return null;
  let bin = "";
  const chunk = 0x8000;
  for (let i = 0; i < buf.length; i += chunk) bin += String.fromCharCode(...buf.subarray(i, i + chunk));
  return btoa(bin);
}

function parseResultado(data: string | undefined): Record<string, unknown> | null {
  if (!data) return null;
  try { return JSON.parse(data); } catch { /* segue */ }
  const m = data.match(/\{[\s\S]*\}/);
  if (m) { try { return JSON.parse(m[0]); } catch { /* segue */ } }
  return null;
}

// ── O trabalho pesado (roda depois da resposta) ─────────────────────────────
async function processar(
  svc: SupabaseClient, id: string, postUrl: string, videoUrl: string | null,
  apiKey: string, apifyToken: string | null, crmClientId: string | null,
) {
  const falhar = async (msg: string) => {
    await svc.from("video_analyses").update({ status: "error", error: msg.slice(0, 500), finished_at: new Date().toISOString() }).eq("id", id);
  };
  try {
    await svc.from("video_analyses").update({ status: "running" }).eq("id", id);

    const ctx = await contextoDoCliente(svc, crmClientId);
    const prompt = montarPrompt(ctx);

    const mp4 = await resolverVideoUrl(postUrl, videoUrl, apifyToken);
    if (!mp4) { await falhar("Não consegui obter o arquivo do vídeo (link do Instagram expirado e sem Apify)."); return; }
    await svc.from("video_analyses").update({ video_url: mp4 }).eq("id", id);

    let out;
    try {
      out = await analisar(apiKey, { type: "url", url: mp4 }, prompt);
    } catch (e) {
      // O CDN do Instagram às vezes recusa o download feito pelo TwelveLabs.
      // Segundo tiro: a gente baixa e manda os bytes.
      console.warn("[video-analyze] url falhou, tentando base64:", (e as Error).message);
      const b64 = await baixarBase64(mp4);
      if (!b64) throw e;
      out = await analisar(apiKey, { type: "base64_string", base64_string: b64 }, prompt);
    }

    const bruto = parseResultado(out.data);
    if (!bruto) { await falhar(`Resposta fora do formato (${out.finish_reason ?? "?"}): ${(out.data ?? "").slice(0, 200)}`); return; }

    // humanizar ANTES de tratar: a limpeza de estilo mexe em texto, o
    // tratamento mexe em estrutura. Nesta ordem o vocabulário fechado é a
    // última palavra e não corre risco de ser reescrito.
    const resultado = tratar(humanizarDeep(bruto) as Record<string, unknown>);

    await svc.from("video_analyses").update({
      status: "done",
      result: resultado,
      usage: { ...(out.usage as Record<string, unknown> ?? {}), finish_reason: out.finish_reason ?? null, truncado: out.finish_reason === "length", com_cliente: !!ctx },
      finished_at: new Date().toISOString(),
    }).eq("id", id);
  } catch (e) {
    console.error("[video-analyze] falhou:", e);
    await falhar((e as Error).message || "erro desconhecido");
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "unauthorized" }, 401);
    const userClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return json({ error: "unauthorized" }, 401);

    const svc: SupabaseClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const apiKey = Deno.env.get("TWELVELABS_API_KEY");
    if (!apiKey) return json({ error: "twelvelabs_not_configured", message: "TWELVELABS_API_KEY não cadastrada." }, 500);
    const apifyToken = Deno.env.get("APIFY_TOKEN") ?? null;

    const body = await req.json().catch(() => ({})) as Record<string, unknown>;

    // Tenant efetivo: colaborador atua no gestor (mesma regra do apify-scrape).
    let mgr = user.id;
    const reqMgr = body.manager_id ? String(body.manager_id) : null;
    if (reqMgr && reqMgr !== user.id) {
      const { data: link } = await svc.from("manager_members")
        .select("id").eq("manager_id", reqMgr).eq("member_id", user.id).eq("status", "ativo").maybeSingle();
      if (!link) return json({ error: "forbidden_team" }, 403);
      mgr = reqMgr;
    }

    // FASE 1: só admin. Quem não é recebe 403 com mensagem clara; a tela nem
    // mostra o botão, isto é a trava de verdade.
    const { data: prof } = await svc.from("profiles").select("role").eq("id", user.id).single();
    if (prof?.role !== "admin") return json({ error: "forbidden", message: "Análise profunda em teste fechado." }, 403);

    const postUrl = String(body.post_url ?? "").trim();
    if (!/^https?:\/\//i.test(postUrl)) return json({ error: "post_url_invalida" }, 400);
    const videoUrl = body.video_url ? String(body.video_url) : null;
    const thumbnail = body.thumbnail ? String(body.thumbnail) : null;
    const crmClientId = body.crm_client_id ? String(body.crm_client_id) : null;
    const scrapeId = body.scrape_id ? String(body.scrape_id) : null;
    const origem = body.origem === "studio" ? "studio" : "radar";

    // O cliente tem que ser da carteira de quem pediu. Sem isto, um id chutado
    // no corpo da requisição viraria vazamento de brandbook alheio pro prompt.
    if (crmClientId) {
      const { data: dono } = await svc.from("crm_clients").select("id").eq("id", crmClientId).eq("manager_id", mgr).maybeSingle();
      if (!dono) return json({ error: "forbidden_client" }, 403);
    }

    // Uma linha por (gestor, post). Rodar de novo reaproveita a linha.
    const { data: linha, error: upErr } = await svc.from("video_analyses").upsert({
      manager_id: mgr, post_url: postUrl, video_url: videoUrl, thumbnail,
      crm_client_id: crmClientId, scrape_id: scrapeId, origem,
      status: "queued", error: null, result: null, usage: null, finished_at: null,
    }, { onConflict: "manager_id,post_url" }).select("id").single();
    if (upErr || !linha) return json({ error: "db", message: upErr?.message }, 500);

    const tarefa = processar(svc, linha.id, postUrl, videoUrl, apiKey, apifyToken, crmClientId);
    if (typeof EdgeRuntime !== "undefined" && EdgeRuntime?.waitUntil) EdgeRuntime.waitUntil(tarefa);
    else await tarefa; // ambiente sem waitUntil (local): roda inline

    return json({ ok: true, id: linha.id });
  } catch (e) {
    console.error("[video-analyze]", e);
    return json({ error: "internal", message: (e as Error).message }, 500);
  }
});
