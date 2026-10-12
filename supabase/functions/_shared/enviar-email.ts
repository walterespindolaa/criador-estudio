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
};

const APP_URL = () => Deno.env.get("APP_URL") ?? "https://app.criasocialclub.com.br";

function esc(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export function montarHtml(e: EmailCria): string {
  const oi = `<p style="margin:0 0 14px;">Oi${e.nome ? `, ${esc(e.nome.split(" ")[0])}` : ""}.</p>`;
  const ps = e.paragrafos.map((p) => `<p style="margin:0 0 14px;">${esc(p)}</p>`).join("");
  return molduraCria({
    tag: e.tag ?? "Recado do Cria",
    tema: e.tema ?? "azul",
    titulo: esc(e.titulo ?? e.assunto),
    corpoHtml: oi + ps,
    botao: e.botao ? { texto: esc(e.botao.texto), url: e.botao.url } : null,
    notaHtml: e.rodape ? esc(e.rodape) : null,
  });
}

export function montarTexto(e: EmailCria): string {
  const linhas = [`Oi${e.nome ? `, ${e.nome.split(" ")[0]}` : ""}.`, "", ...e.paragrafos];
  if (e.botao) linhas.push("", `${e.botao.texto}: ${e.botao.url}`);
  if (e.rodape) linhas.push("", e.rodape);
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
        from: REMETENTE_CRIA,
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
