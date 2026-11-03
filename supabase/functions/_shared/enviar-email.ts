/* ═══════════════════════════════════════════════════════════════════════════
   E-MAIL TRANSACIONAL DO CRIA (pente fino 23/09/2026)

   Cada edge montava o próprio HTML e chamava `enqueue_email` na mão, com
   remetente e domínio copiados (e às vezes diferentes: "criasocialclub" num,
   "cria" noutro). Aqui é uma função só: recebe o texto, veste a moldura do
   Cria, enfileira na mesma fila `transactional_emails` que o
   process-email-queue já entrega pelo Resend. Nunca lança: e-mail que falha
   vai pro log, não derruba a ação que o disparou.
   ═══════════════════════════════════════════════════════════════════════════ */

import { molduraCria, REMETENTE_CRIA, type TemaCria } from "./email-moldura.ts";

// deno-lint-ignore no-explicit-any
type Svc = { rpc: (fn: string, args: Record<string, unknown>) => Promise<{ error: { message: string } | null }> } & Record<string, any>;

export type EmailCria = {
  para: string;
  assunto: string;
  /** Primeiro nome (vai no "Oi, Fulano."). */
  nome?: string | null;
  /** Parágrafos do corpo, em texto simples. */
  paragrafos: string[];
  /** Botão principal. */
  botao?: { texto: string; url: string } | null;
  /** Linha pequena no rodapé (ex.: "Você recebe isto porque..."). */
  rodape?: string | null;
  /** Etiqueta pra métrica/dedupe no process-email-queue. */
  etiqueta: string;
  /** Visual (12/10/2026): título grande, etiqueta e cor da faixa. Sem eles,
   *  o título é o assunto, a etiqueta é "Recado do Cria" e a cor é azul. */
  titulo?: string;
  tag?: string;
  tema?: TemaCria;
  /** E-MAILS PRA QUEM PAROU (30/10/2026). Remetente em primeira pessoa
   *  ("Gabi e Walter, do Cria <...>") e endereço que recebe a resposta. */
  de?: string;
  responderPara?: string | null;
  /** Links de um clique, em pílulas (ex.: os motivos de saída). */
  links?: { texto: string; url: string }[];
  /** Fecho em primeira pessoa, depois dos parágrafos. */
  assinatura?: string;
  /** Link de "não quero mais receber" no rodapé. */
  sairUrl?: string | null;
  /** Blocos visuais prontos (caixa de cobrança, números, passos), já em HTML
   *  escapado por quem monta (_shared/emails-assinatura.ts). Entram depois dos
   *  parágrafos. `blocosTexto` é o mesmo conteúdo na versão só texto. */
  blocosHtml?: string;
  blocosTexto?: string[];
  /** Parágrafos depois dos blocos (o fecho de quem tem blocos no meio). */
  paragrafosDepois?: string[];
};

/** Remetente dos e-mails assinados por gente (reengajamento). */
export const REMETENTE_PESSOAL = () =>
  Deno.env.get("EMAIL_REMETENTE_PESSOAL") ?? "Gabi e Walter, do Cria <oi@criasocialclub.com.br>";
/** Endereço que recebe as respostas (domínio com recebimento no Resend). */
export const RESPOSTAS_PARA = () => Deno.env.get("EMAIL_RESPOSTAS_PARA") ?? null;

const APP_URL = () => Deno.env.get("APP_URL") ?? "https://app.criasocialclub.com.br";

function esc(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export function montarHtml(e: EmailCria): string {
  const oi = `<p style="margin:0 0 14px;">Oi${e.nome ? `, ${esc(e.nome.split(" ")[0])}` : ""}.</p>`;
  const ps = e.paragrafos.map((p) => `<p style="margin:0 0 14px;">${esc(p)}</p>`).join("");
  const links = e.links?.length
    ? `<p style="margin:4px 0 14px;line-height:2.6;">${e.links.map((l) =>
      `<a href="${l.url}" style="display:inline-block;margin:0 6px 0 0;padding:8px 14px;border:1px solid #E2D8CB;border-radius:999px;background:#F7F3EE;color:#1E1A17;font-weight:bold;text-decoration:none;font-size:14px;line-height:1.2;">${esc(l.texto)}</a>`).join("")}</p>`
    : "";
  const depois = (e.paragrafosDepois ?? []).map((p) => `<p style="margin:0 0 14px;">${esc(p)}</p>`).join("");
  const fecho = e.assinatura ? `<p style="margin:18px 0 0;">${esc(e.assinatura).replace(/\n/g, "<br>")}</p>` : "";
  const sair = e.sairUrl ? ` <a href="${e.sairUrl}" style="color:#8A7F76;">Não quer mais receber? Descadastre aqui.</a>` : "";
  const nota = (e.rodape ? esc(e.rodape).replace(/\n/g, "<br>") : "") + sair;
  return molduraCria({
    tag: e.tag ?? "Recado do Cria",
    tema: e.tema ?? "azul",
    titulo: esc(e.titulo ?? e.assunto),
    corpoHtml: oi + ps + (e.blocosHtml ?? "") + depois + links + fecho,
    botao: e.botao ? { texto: esc(e.botao.texto), url: e.botao.url } : null,
    notaHtml: nota.trim() || null,
  });
}

export function montarTexto(e: EmailCria): string {
  const linhas = [`Oi${e.nome ? `, ${e.nome.split(" ")[0]}` : ""}.`, "", ...e.paragrafos];
  if (e.blocosTexto?.length) linhas.push("", ...e.blocosTexto);
  if (e.paragrafosDepois?.length) linhas.push("", ...e.paragrafosDepois);
  if (e.links?.length) linhas.push("", ...e.links.map((l) => `${l.texto}: ${l.url}`));
  if (e.assinatura) linhas.push("", e.assinatura);
  if (e.botao) linhas.push("", `${e.botao.texto}: ${e.botao.url}`);
  if (e.rodape) linhas.push("", e.rodape);
  if (e.sairUrl) linhas.push(`Não quer mais receber? ${e.sairUrl}`);
  return linhas.join("\n");
}

/** Enfileira. Devolve true se entrou na fila. */
export async function enviarEmail(svc: Svc, e: EmailCria): Promise<boolean> {
  try {
    if (!e.para || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e.para)) return false;
    const messageId = crypto.randomUUID();
    const { error } = await svc.rpc("enqueue_email", {
      queue_name: "transactional_emails",
      payload: {
        to: e.para,
        subject: e.assunto,
        from: e.de ?? REMETENTE_CRIA,
        ...(e.responderPara ? { reply_to: e.responderPara } : {}),
        sender_domain: "notify.criasocialclub.com.br",
        purpose: "transactional",
        html: montarHtml(e),
        text: montarTexto(e),
        label: e.etiqueta,
        idempotency_key: messageId,
        message_id: messageId,
        queued_at: new Date().toISOString(),
      },
    });
    if (error) { console.error("[enviar-email]", e.etiqueta, error.message); return false; }
    return true;
  } catch (err) {
    console.error("[enviar-email]", e.etiqueta, err);
    return false;
  }
}
