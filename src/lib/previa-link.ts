/* ═══════════════════════════════════════════════════════════════════════════
   PRÉVIA DOS LINKS NO WHATSAPP (Walter, 19/10/2026; mockup aprovado)

   O WhatsApp não roda o app: lê só título, descrição e imagem. O middleware da
   Vercel (middleware.ts) e a imagem (api/og.ts) chamam a RPC link_previa e
   passam o resultado AQUI, que decide os textos. Nada é escrito à mão:
     · o mês sai do período do link (ou do mês do cronograma/roteiro/próximo
       horário livre), sempre calculado na hora;
     · o nome é o da conta dona do link (o mesmo que o portal mostra);
     · sem dado confiável, cai na prévia genérica do CRIA, sem inventar.
   Função pura, sem rede: é o que os testes cobrem (previa-link.test.ts).
   ═══════════════════════════════════════════════════════════════════════════ */

export type TipoLink =
  | "aprovar" | "materiais" | "roteiros" | "cronograma" | "proposta"
  | "agendar" | "cadastro" | "acessos" | "conectar" | "signup" | "indicacao";

/** O que a RPC link_previa devolve (null = link inválido, vencido ou revogado). */
export type DadosPrevia = {
  tipo?: string;
  conta_nome?: string | null;
  conta_logo?: string | null;
  cliente?: string | null;
  periodo_inicio?: string | null;
  periodo_fim?: string | null;
  mes?: string | null;
  contagem?: number | null;
  indicador?: string | null;
  desconto_pct?: number | null;
  meses?: number | null;
} | null;

export type Tema = "creme" | "azul" | "verde" | "lilas";

export type Previa = {
  titulo: string;
  descricao: string;
  arte: {
    tema: Tema;
    /** Nome no topo da arte (agência/criadora). Null = marca CRIA. */
    marca: string | null;
    logo: string | null;
    /** Frase grande. A palavra `destaque` sai em azul. */
    frase: string;
    destaque: string | null;
    linha: string | null;
    selo: string;
    pilula: string;
  };
};

const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho",
  "agosto", "setembro", "outubro", "novembro", "dezembro"];
const MESES_CURTOS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

/** "2026-12-15" vira {ano, mes(0-11)}. Só a parte da data, sem fuso: as datas
 *  do banco são dia de calendário, não instante. Inválida = null. */
function lerData(s: string | null | undefined): { ano: number; mes: number } | null {
  if (!s || typeof s !== "string") return null;
  const m = /^(\d{4})-(\d{2})(?:-(\d{2}))?/.exec(s.trim());
  if (!m) return null;
  const ano = Number(m[1]); const mes = Number(m[2]) - 1;
  if (!(ano >= 2000 && ano <= 2100) || !(mes >= 0 && mes <= 11)) return null;
  return { ano, mes };
}

/** Meses cobertos por um período, em ordem. Inválido, invertido ou maior que
 *  24 meses = null (não arrisca frase errada). */
export function mesesDoPeriodo(ini: string | null | undefined, fim: string | null | undefined): number[][] | null {
  const a = lerData(ini); const b = lerData(fim);
  if (!a || !b) return null;
  const ia = a.ano * 12 + a.mes; const ib = b.ano * 12 + b.mes;
  if (ib < ia || ib - ia > 23) return null;
  const out: number[][] = [];
  for (let i = ia; i <= ib; i++) out.push([Math.floor(i / 12), i % 12]);
  return out;
}

/** "de dezembro" · "de dezembro e janeiro" · "de dez a fev" · null. */
export function textoDosMeses(meses: number[][] | null): string | null {
  if (!meses || meses.length === 0) return null;
  if (meses.length === 1) return `de ${MESES[meses[0][1]]}`;
  if (meses.length === 2) return `de ${MESES[meses[0][1]]} e ${MESES[meses[1][1]]}`;
  return `de ${MESES_CURTOS[meses[0][1]]} a ${MESES_CURTOS[meses[meses.length - 1][1]]}`;
}

/** Mês por extenso de uma data solta (cronograma, roteiros, agenda). */
export function mesDeData(s: string | null | undefined): string | null {
  const d = lerData(s);
  return d ? MESES[d.mes] : null;
}

export function encurtar(s: string | null | undefined, max = 28): string | null {
  const t = (s ?? "").replace(/\s+/g, " ").trim();
  if (!t) return null;
  return t.length > max ? `${t.slice(0, max - 1).trimEnd()}…` : t;
}

function contagemPosts(n: number | null | undefined): string | null {
  if (typeof n !== "number" || !Number.isFinite(n) || n <= 0) return null;
  return n === 1 ? "1 post esperando seu ok" : `${Math.floor(n)} posts esperando seu ok`;
}

function juntar(...partes: (string | null | undefined)[]): string | null {
  const v = partes.filter((p): p is string => !!p && !!p.trim());
  return v.length ? v.join(" · ") : null;
}

/** Primeira letra maiúscula (o nome do cliente abre a frase do título). */
function cap(s: string): string { return s.charAt(0).toUpperCase() + s.slice(1); }

const PILULA_CLIENTE = "Toque pra ver · feito no CRIA";

/** Prévia da marca CRIA: signup e qualquer link sem dado confiável. */
export function previaGenerica(tipo: TipoLink | null = null): Previa {
  if (tipo === "signup" || tipo === "indicacao" || tipo === null) {
    return {
      titulo: "CRIA | Seu conteúdo inteiro, organizado. Numa aba só.",
      descricao: "Ideia, planejar, produzir, aprovar e publicar num lugar só. 7 dias grátis.",
      arte: { tema: "creme", marca: null, logo: null, frase: "Da ideia ao post.", destaque: "post.",
        linha: "Seu conteúdo inteiro, numa aba só.", selo: "sem fórmula mágica", pilula: "7 dias grátis · criasocialclub.com.br" },
    };
  }
  // Link de cliente que não deu pra ler (vencido, revogado ou fora do ar):
  // não oferece teste grátis pro cliente de ninguém, só a marca.
  return {
    titulo: "Cria Social Club",
    descricao: "Abra o link pra ver.",
    arte: { tema: "creme", marca: null, logo: null, frase: "Da ideia ao post.", destaque: "post.",
      linha: null, selo: "feito no CRIA", pilula: "criasocialclub.com.br" },
  };
}

export function montarPrevia(tipo: TipoLink, d: DadosPrevia): Previa {
  if (tipo === "signup") return previaGenerica("signup");

  if (tipo === "indicacao") {
    const nome = encurtar(d?.indicador, 20);
    if (!d || !nome) return previaGenerica("signup");
    const pct = typeof d.desconto_pct === "number" && d.desconto_pct > 0 ? Math.round(d.desconto_pct) : null;
    const meses = typeof d.meses === "number" && d.meses > 0 ? Math.floor(d.meses) : null;
    const beneficio = pct
      ? (meses === 1 ? `${pct}% off no 1º mês` : meses ? `${pct}% off por ${meses} meses` : `${pct}% off`)
      : null;
    return {
      titulo: `${nome} te convidou pro CRIA`,
      descricao: `Organize seu conteúdo da ideia ao post. 7 dias grátis${beneficio ? ` e ${beneficio} na assinatura` : ""}.`,
      arte: { tema: "creme", marca: null, logo: null, frase: `${nome} te convidou pro CRIA.`, destaque: nome,
        linha: beneficio ? `7 dias grátis + ${beneficio}` : "7 dias grátis pra testar",
        selo: "convite", pilula: "Toque pra ver · criasocialclub.com.br" },
    };
  }

  const conta = encurtar(d?.conta_nome, 28);
  if (!d || !conta) return previaGenerica(tipo);
  const logo = typeof d.conta_logo === "string" && /^https:\/\//.test(d.conta_logo) ? d.conta_logo : null;
  const cliente = encurtar(d.cliente, 28);
  const fim = conta.endsWith("…") ? "" : ".";
  const por = `Enviado por ${conta}${fim}`;
  const base = { marca: conta, logo, pilula: PILULA_CLIENTE };

  switch (tipo) {
    case "aprovar": {
      const mes = textoDosMeses(mesesDoPeriodo(d.periodo_inicio, d.periodo_fim));
      const destaque = mes ? mes.split(" ")[1] : "posts";
      return {
        titulo: `${cliente ? `${cliente}, seus` : "Seus"} posts ${mes ? `${mes} ` : ""}estão prontos`,
        descricao: `Veja, comente e aprove pelo celular. ${por}`,
        arte: { ...base, tema: "creme", frase: `Seus posts ${mes ? `${mes} ` : ""}chegaram.`, destaque,
          linha: juntar(cliente, contagemPosts(d.contagem)), selo: "pra você aprovar" },
      };
    }
    case "materiais":
      return {
        titulo: `${cliente ? `${cliente}, seus` : "Seus"} materiais estão aqui`,
        descricao: `Fotos, vídeos e arquivos num lugar só. ${por}`,
        arte: { ...base, tema: "verde", frase: "Seus materiais chegaram.", destaque: "materiais",
          linha: cliente, selo: "pra você ver" },
      };
    case "roteiros": {
      const m = mesDeData(d.mes);
      return {
        titulo: `${cliente ? `${cliente}, seus` : "Seus"} roteiros ${m ? `de ${m} ` : ""}chegaram`,
        descricao: `Leia, ajuste e aprove antes da gravação. ${por}`,
        arte: { ...base, tema: "lilas", frase: `Seus roteiros ${m ? `de ${m} ` : ""}chegaram.`, destaque: m ?? "roteiros",
          linha: cliente, selo: "pra você revisar" },
      };
    }
    case "cronograma": {
      const m = mesDeData(d.mes);
      return {
        titulo: `${cliente ? `${cliente}, seu` : "Seu"} cronograma ${m ? `de ${m} ` : ""}está pronto`,
        descricao: `Veja o que vai ao ar e comente por aqui. ${por}`,
        arte: { ...base, tema: "creme", frase: `Seu cronograma ${m ? `de ${m} ` : ""}está pronto.`, destaque: m ?? "cronograma",
          linha: cliente, selo: "pra você ver" },
      };
    }
    case "proposta":
      return {
        titulo: cliente ? `Proposta de collab pra ${cliente}` : "Sua proposta de collab chegou",
        descricao: `Veja as entregas e responda por aqui. Enviada por ${conta}${fim}`,
        arte: { ...base, tema: "lilas", frase: "Sua proposta chegou.", destaque: "proposta",
          linha: cliente, selo: "collab" },
      };
    case "agendar": {
      const m = mesDeData(d.mes);
      return {
        titulo: `${cliente ? `${cliente}, escolha` : "Escolha"} o dia da sua captação`,
        descricao: `${m ? `Datas livres de ${m}. ` : "Veja as datas livres. "}${por}`,
        arte: { ...base, tema: "azul", frase: "Bora marcar a captação?", destaque: "captação?",
          linha: juntar(cliente, m ? `datas livres de ${m}` : null), selo: "escolha o dia" },
      };
    }
    case "cadastro":
      return {
        titulo: `${cliente ? `${cliente}, falta` : "Falta"} pouco: seu cadastro`,
        descricao: `Preencha seus dados pra gente começar. ${por}`,
        arte: { ...base, tema: "verde", frase: "Falta pouco: seu cadastro.", destaque: "cadastro.",
          linha: cliente, selo: "pra começar" },
      };
    case "acessos":
      return {
        titulo: `${cliente ? `${cliente}, envie` : "Envie"} seus acessos com segurança`,
        descricao: `Sem mandar senha pelo WhatsApp. ${por}`,
        arte: { ...base, tema: "azul", frase: "Envio seguro de acessos.", destaque: "seguro",
          linha: cliente, selo: "seguro" },
      };
    case "conectar":
      return {
        titulo: `${cliente ? `${cliente}, conecte` : "Conecte"} seu Instagram`,
        descricao: `Pra acompanhar os resultados do seu perfil. ${por}`,
        arte: { ...base, tema: "lilas", frase: "Conecte seu Instagram.", destaque: "Instagram.",
          linha: cliente, selo: "pra conectar" },
      };
    default:
      return previaGenerica(tipo);
  }
}

/** Robôs que montam prévia de link. Só eles recebem o HTML da prévia; gente
 *  (inclusive o navegador de dentro do Instagram, Facebook, LinkedIn e X)
 *  segue direto pro app. Cuidado ao aumentar: "Instagram", "FBAN", "Twitter"
 *  e "LinkedInApp" são navegadores de gente, não robôs. */
const ROBOS = /(WhatsApp\/|facebookexternalhit|Facebot|Twitterbot|TelegramBot|Slackbot|Slack-ImgProxy|LinkedInBot|Discordbot|SkypeUriPreview|Applebot|redditbot|Pinterestbot|vkShare|Embedly|SignalBot|Iframely)/i;

export function ehRoboDePrevia(ua: string | null | undefined): boolean {
  return !!ua && ROBOS.test(ua);
}

/** Qual link é: /aprovar/abc → {tipo:"aprovar", token:"abc"}. */
export function lerRota(pathname: string): { tipo: TipoLink; token: string | null } | null {
  const p = pathname.replace(/\/+$/, "") || "/";
  if (p === "/signup") return { tipo: "signup", token: null };
  const m = /^\/(aprovar|materiais|roteiros|cronograma|proposta|agendar|cadastro|acessos|conectar|p)\/([^/?#]{4,200})$/.exec(p);
  if (!m) return null;
  let token = m[2];
  try { token = decodeURIComponent(token); } catch { return null; }
  return { tipo: m[1] === "p" ? "indicacao" : (m[1] as TipoLink), token };
}

export function escaparHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}
