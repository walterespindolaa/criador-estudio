/* ═══════════════════════════════════════════════════════════════════════════
   E-MAILS DO TESTE COM CARTÃO (Walter, 03/11/2026, mockup aprovado:
   CRIA/3-produto/mockups/mockup-emails-teste.html)

     teste_d5    5º dia: o que a pessoa já fez, como fica a cobrança e uma
                 sugestão do que ela ainda não usou
     teste_d6    véspera da cobrança: curto, com o cancelamento fácil de achar
     assinatura_boas_vindas   primeira cobrança depois do teste: recibo em 3
                 linhas e o guia do primeiro mês em 4 passos

   Os três saem de "Gabi e Walter, do Cria" e a resposta cai no Admin.
   Tudo o que vem de usuário passa por esc() antes de entrar no HTML.
   ═══════════════════════════════════════════════════════════════════════════ */

import type { EmailCria } from "./enviar-email.ts";

const FT = "'Baloo 2','Arial Rounded MT Bold','Arial Black',Arial,sans-serif";
const F = "Arial,Helvetica,sans-serif";
const BASE = "https://app.criasocialclub.com.br";

function esc(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export const NOME_PLANO: Record<string, string> = { essencial: "Essencial", pro: "Pro", studio: "Studio" };
/** Preço de tabela, só de reserva quando o Stripe não responde. */
export const PRECO_TABELA: Record<string, number> = { essencial: 1990, pro: 3290, studio: 4990 };

export const reais = (centavos: number) =>
  "R$ " + (centavos / 100).toFixed(2).replace(".", ",").replace(/\B(?=(\d{3})+(?!\d))/g, ".");

/** dd/mm no fuso de Brasília. */
export function diaMes(d: Date): string {
  return new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit" }).format(d);
}
/** "quarta, 10/11" no fuso de Brasília. */
export function diaSemanaMes(d: Date): string {
  const sem = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", weekday: "long" }).format(d).replace("-feira", "");
  return `${sem}, ${diaMes(d)}`;
}

function p(html: string, extra = "") {
  return `<p style="margin:0 0 16px;${extra}">${html}</p>`;
}
const b = (t: string) => `<b style="color:#1E1A17;">${t}</b>`;

function caixa(linhas: [string, string][], fundo = "#FBF6EC", borda = "#EDE5DA") {
  const rows = linhas.map(([a, v], i) => {
    const sep = i ? "border-top:1px dashed #E4D9C9;" : "";
    return `<tr><td style="padding:10px 0;${sep}font-family:${F};font-size:14px;color:#8A7F76;">${esc(a)}</td>`
      + `<td align="right" style="padding:10px 0;${sep}font-family:${F};font-size:15px;font-weight:700;color:#1E1A17;">${esc(v)}</td></tr>`;
  }).join("");
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${fundo};border:1px solid ${borda};border-radius:18px;margin:4px 0 18px;"><tr><td style="padding:8px 20px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${rows}</table></td></tr></table>`;
}

function numeros(itens: [number, string][]) {
  const tds = itens.map(([n, t], i) =>
    `<td width="33%" align="center" style="padding:14px 6px;background:#FBF6EC;border-radius:16px;"><div style="font-family:${FT};font-size:30px;font-weight:800;line-height:1;color:#CE4A1D;">${n}</div><div style="font-family:${F};font-size:12.5px;line-height:1.3;color:#8A7F76;margin-top:6px;">${esc(t)}</div></td>`
    + (i < itens.length - 1 ? '<td width="8"></td>' : "")).join("");
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:2px 0 20px;"><tr>${tds}</tr></table>`;
}

function passo(n: number, cor: string, titulo: string, tempo: string, texto: string, link: string, url: string) {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 12px;border:1px solid #EDE5DA;border-radius:18px;"><tr>
<td width="58" valign="top" style="padding:16px 0 16px 16px;"><div style="width:40px;height:40px;border-radius:50%;background:${cor};color:#FFFFFF;font-family:${FT};font-size:20px;font-weight:800;line-height:42px;text-align:center;">${n}</div></td>
<td valign="top" style="padding:16px 18px 16px 6px;">
<div style="font-family:${FT};font-size:19px;font-weight:800;line-height:1.15;color:#1E1A17;">${esc(titulo)} <span style="font-family:${F};font-size:12px;font-weight:400;color:#8A7F76;">· ${esc(tempo)}</span></div>
<div style="font-family:${F};font-size:14.5px;line-height:1.55;color:#3A332E;margin-top:4px;">${esc(texto)}</div>
<div style="margin-top:8px;"><a href="${url}" style="font-family:${F};font-size:13.5px;font-weight:700;color:#CE4A1D;text-decoration:none;">${esc(link)} &rarr;</a></div>
</td></tr></table>`;
}

const ASSINATURA = "Qualquer dúvida, é só responder este e-mail. Quem lê somos nós.\nGabi e Walter, do Cria";

export type DadosCobranca = {
  plano: string;            // essencial | pro | studio
  valorCentavos: number;    // valor da próxima cobrança (com desconto, se tiver)
  cartaoFinal: string | null;
  cobrancaEm: Date;         // fim do teste
};

/* ── 5º dia ──────────────────────────────────────────────────────────────── */
export type UsoDoTeste = { ideias: number; postsCalendario: number; roteiros: number };

export function emailTesteD5(nome: string | null, c: DadosCobranca, uso: UsoDoTeste, app: string): Omit<EmailCria, "para" | "etiqueta"> {
  const nomePlano = NOME_PLANO[c.plano] ?? c.plano;
  const data = diaMes(c.cobrancaEm);
  const vespera = diaMes(new Date(c.cobrancaEm.getTime() - 86400000));
  const usou = uso.ideias + uso.postsCalendario + uso.roteiros > 0;
  // Sugestão do fim: o que ela ainda não usou, na ordem do caminho do Cria.
  const sugestao = uso.postsCalendario === 0
    ? { txt: `${b("Ainda não testou?")} O Cria Plano monta o seu mês a partir do Brandbook: você abre, ajusta e aprova. Vale dar uma olhada antes do teste acabar.`, botao: "Montar meu mês no Cria Plano", url: `${app}/app/autopilot` }
    : uso.roteiros === 0
      ? { txt: `${b("Ainda não testou?")} No Criando, cada post ganha roteiro, legenda e capa com a CrIA escrevendo na sua voz. Escolhe um post do calendário e testa.`, botao: "Abrir o Criando", url: `${app}/app/criando` }
      : c.plano === "studio"
        ? { txt: `${b("Ainda não testou?")} O Cria Prompter vira teleprompter com o seu roteiro, com comando de voz. Grava o próximo vídeo por lá.`, botao: "Abrir o Cria Prompter", url: `${app}/app/prompter` }
        : { txt: `${b("Uma dica:")} teve ideia no meio da rua? Grava um áudio nas Ideias e o Cria transcreve pra você.`, botao: "Ir pras Ideias", url: `${app}/app/ideias` };
  const linhas: [string, string][] = [["Plano", nomePlano], ["Valor", `${reais(c.valorCentavos)} por mês`], ["Primeira cobrança", data]];
  if (c.cartaoFinal) linhas.push(["Cartão", `final ${c.cartaoFinal}`]);
  const html =
    (usou
      ? p("Passou rápido, né? Olha o que você já fez no Cria nesses 5 dias:")
        + numeros([[uso.ideias, "ideias guardadas"], [uso.postsCalendario, "posts no calendário"], [uso.roteiros, "roteiros prontos"]])
      : p("Passou rápido, né? Ainda dá tempo de ver o Cria trabalhando por você antes do teste acabar."))
    + p(`No dia ${b(esc(data))} o teste vira assinatura. Fica assim:`)
    + caixa(linhas)
    + p(sugestao.txt, "margin-bottom:0;");
  return {
    assunto: `${nome ? nome.split(" ")[0] + ", f" : "F"}altam 2 dias do seu teste no Cria`,
    titulo: "Faltam 2 dias do seu teste", tag: "Seu teste", tema: "amarelo",
    nome, paragrafos: [], blocosHtml: html,
    blocosTexto: [
      usou ? `Nesses 5 dias: ${uso.ideias} ideias guardadas, ${uso.postsCalendario} posts no calendário, ${uso.roteiros} roteiros prontos.` : "Ainda dá tempo de ver o Cria trabalhando por você antes do teste acabar.",
      `No dia ${data} o teste vira assinatura: plano ${nomePlano}, ${reais(c.valorCentavos)} por mês${c.cartaoFinal ? `, no cartão final ${c.cartaoFinal}` : ""}.`,
    ],
    botao: { texto: sugestao.botao, url: sugestao.url },
    rodape: `Se quiser trocar de plano ou cancelar, é em Configurações > Assinatura, em 2 cliques. Cancelando até ${vespera}, não cobramos nada.\n\n${ASSINATURA}`,
  };
}

/* ── 6º dia (véspera) ────────────────────────────────────────────────────── */
export function emailTesteD6(nome: string | null, c: DadosCobranca, app: string): Omit<EmailCria, "para" | "etiqueta"> {
  const nomePlano = NOME_PLANO[c.plano] ?? c.plano;
  const quando = diaSemanaMes(c.cobrancaEm);
  const linhas: [string, string][] = [["Plano", nomePlano], ["Valor", `${reais(c.valorCentavos)} por mês`]];
  if (c.cartaoFinal) linhas.push(["Cartão", `final ${c.cartaoFinal}`]);
  const html =
    p(`Passando só pra lembrar: ${b(`amanhã, ${esc(quando)}`)}, cobramos a primeira mensalidade do Cria.`)
    + caixa(linhas, "#FFF3F8", "#F8D3E4")
    + p(`${b("Quer continuar?")} Não precisa fazer nada. Tudo o que você criou no teste continua no lugar.`)
    + p(`${b("Mudou de ideia?")} Cancela hoje pelo botão abaixo e não cobramos nada. Sem ligação, sem formulário.`, "margin-bottom:0;");
  return {
    assunto: "Amanhã começa sua assinatura do Cria",
    titulo: "Amanhã seu teste vira assinatura", tag: "Amanhã", tema: "rosa",
    nome, paragrafos: [], blocosHtml: html,
    blocosTexto: [
      `Amanhã, ${quando}, cobramos a primeira mensalidade do Cria: plano ${nomePlano}, ${reais(c.valorCentavos)} por mês${c.cartaoFinal ? `, no cartão final ${c.cartaoFinal}` : ""}.`,
      "Quer continuar? Não precisa fazer nada.",
      "Mudou de ideia? Cancela hoje e não cobramos nada.",
    ],
    botao: { texto: "Ver minha assinatura", url: `${app}/app/configuracoes?aba=assinatura` },
    rodape: ASSINATURA,
  };
}

/* ── Primeira cobrança: boas-vindas de verdade ───────────────────────────── */
export type Recibo = { plano: string; pagoCentavos: number; cartaoFinal: string | null; proxima: Date | null; reciboUrl: string | null };

export function emailBoasVindasAssinatura(nome: string | null, r: Recibo, app: string): Omit<EmailCria, "para" | "etiqueta"> {
  const nomePlano = NOME_PLANO[r.plano] ?? r.plano;
  const linhas: [string, string][] = [[`Plano ${nomePlano}`, `${reais(r.pagoCentavos)} pago`]];
  if (r.cartaoFinal) linhas.push(["Cartão", `final ${r.cartaoFinal}`]);
  if (r.proxima) linhas.push(["Próxima cobrança", diaMes(r.proxima)]);
  const passo4 = r.plano === "studio"
    ? passo(4, "#3E9152", "Grave com o Cria Prompter", "no seu ritmo",
      "O roteiro vira teleprompter com comando de voz: você grava olhando pra câmera, sem decorar. Pronto, é só marcar como postado e acompanhar nas Metas.",
      "Abrir o Cria Prompter", `${app}/app/prompter`)
    : passo(4, "#3E9152", "Produza no Criando", "no seu ritmo",
      "Cada post tem roteiro, legenda e capa no mesmo lugar, com a CrIA ajudando na sua voz. Pronto, é só marcar como postado e acompanhar nas Metas.",
      "Abrir o Criando", `${app}/app/criando`);
  const html =
    p("Seu teste acabou e a assinatura começou. Obrigado por escolher o Cria pra organizar o seu conteúdo. A gente fez ele pra você parar de travar na hora de postar, então bora deixar ele no jeito.")
    + caixa(linhas, "#EEF7F0", "#CFE6D5")
    + (r.reciboUrl ? p(`<a href="${esc(r.reciboUrl)}" style="font-size:13.5px;font-weight:700;color:#CE4A1D;text-decoration:none;">Ver o recibo desta cobrança &rarr;</a>`, "margin-top:-6px;") : "")
    + `<div style="font-family:${FT};font-size:23px;font-weight:800;line-height:1.15;color:#1E1A17;margin:26px 0 4px;">Seu primeiro mês em 4 passos</div>`
    + p("Na ordem, que um puxa o outro.", "font-size:14px;color:#8A7F76;")
    + passo(1, "#CE4A1D", "Complete o Brandbook", "10 min",
      "Conte quem você é, pra quem fala e como fala. É dele que o Cria tira a sua voz em toda legenda, roteiro e ideia. Quanto mais completo, menos você edita depois.",
      "Abrir o Brandbook", `${app}/app/brandbook`)
    + passo(2, "#1D5FE0", "Encha o banco de Ideias", "5 min por dia",
      "Teve uma ideia no meio da rua? Grava um áudio e o Cria transcreve. Sem ideia nenhuma? Pede pra CrIA sugerir a partir do seu nicho. Toda ideia vira post com um clique.",
      "Ir pras Ideias", `${app}/app/ideias`)
    + passo(3, "#F27EB5", "Monte o mês no Cria Plano", "15 min",
      "O Cria Plano distribui os posts na semana seguindo as suas metas. Você ajusta, aprova e eles caem no Calendário com data e formato.",
      "Montar meu mês", `${app}/app/autopilot`)
    + passo4
    + `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:14px 0 4px;background:#1E1A17;border-radius:18px;"><tr>
<td width="74" valign="middle" style="padding:16px 0 16px 16px;"><img src="${BASE}/stickers/criatura-lampada.png" width="58" alt="" style="display:block;width:58px;height:auto;border:0;"></td>
<td valign="middle" style="padding:16px 20px 16px 10px;font-family:${F};font-size:14.5px;line-height:1.55;color:#F4EFE3;"><b style="font-family:${FT};font-size:16px;color:#F2C21E;">Dica da Gabi</b><br>Reserve um horário fixo por semana pra gravar tudo de uma vez. Fica muito mais leve do que gravar no dia de postar.</td></tr></table>`;
  return {
    assunto: `Agora é oficial: boas-vindas ao Cria${nome ? `, ${nome.split(" ")[0]}` : ""}`,
    // montarHtml já escapa o título: aqui vai o nome cru.
    titulo: `Agora é oficial${nome ? `, ${nome.split(" ")[0]}` : ""}. Boas-vindas ao Cria!`,
    tag: "Boas-vindas", tema: "verde",
    nome, paragrafos: [], blocosHtml: html,
    blocosTexto: [
      `Sua assinatura do plano ${nomePlano} começou: ${reais(r.pagoCentavos)} pago${r.cartaoFinal ? ` no cartão final ${r.cartaoFinal}` : ""}${r.proxima ? `, próxima cobrança em ${diaMes(r.proxima)}` : ""}.`,
      ...(r.reciboUrl ? [`Recibo: ${r.reciboUrl}`] : []),
      "Seu primeiro mês em 4 passos:",
      `1. Complete o Brandbook: ${app}/app/brandbook`,
      `2. Encha o banco de Ideias: ${app}/app/ideias`,
      `3. Monte o mês no Cria Plano: ${app}/app/autopilot`,
      r.plano === "studio" ? `4. Grave com o Cria Prompter: ${app}/app/prompter` : `4. Produza no Criando: ${app}/app/criando`,
    ],
    botao: { texto: "Abrir o Cria", url: `${app}/app` },
    rodape: `Tem vídeo curto de cada tela em Tutoriais, dentro do app. Recibos ficam em Configurações > Assinatura.\n\n${ASSINATURA}`,
  };
}
