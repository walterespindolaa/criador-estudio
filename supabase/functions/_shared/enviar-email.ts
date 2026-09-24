/* ═══════════════════════════════════════════════════════════════════════════
   E-MAIL TRANSACIONAL DO CRIA (pente fino 23/09/2026)

   Cada edge montava o próprio HTML e chamava `enqueue_email` na mão, com
   remetente e domínio copiados (e às vezes diferentes: "criasocialclub" num,
   "cria" noutro). Aqui é uma função só: recebe o texto, veste a moldura do
   Cria, enfileira na mesma fila `transactional_emails` que o
   process-email-queue já entrega pelo Resend. Nunca lança: e-mail que falha
   vai pro log, não derruba a ação que o disparou.
   ═══════════════════════════════════════════════════════════════════════════ */

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
};

const APP_URL = () => Deno.env.get("APP_URL") ?? "https://app.criasocialclub.com.br";

function esc(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export function montarHtml(e: EmailCria): string {
  const ps = e.paragrafos.map((p) => `<p style="margin:0 0 14px;font-size:15px;line-height:1.55;color:#1a1a2e">${esc(p)}</p>`).join("");
  const botao = e.botao
    ? `<p style="margin:22px 0"><a href="${e.botao.url}" style="display:inline-block;background:#EA4918;color:#fff;padding:13px 22px;border-radius:12px;text-decoration:none;font-weight:bold;font-size:15px">${esc(e.botao.texto)}</a></p>`
    : "";
  const rodape = e.rodape ? `<p style="margin:26px 0 0;font-size:12px;line-height:1.5;color:#6b7280">${esc(e.rodape)}</p>` : "";
  return `<div style="background:#faf7f2;padding:28px 12px">
  <div style="font-family:Arial,Helvetica,sans-serif;max-width:540px;margin:0 auto;background:#fff;border-radius:18px;padding:30px 28px;border:1px solid #efe9da">
    <p style="margin:0 0 20px;font-size:22px;font-weight:800;color:#EA4918;letter-spacing:-0.5px">cria</p>
    <p style="margin:0 0 14px;font-size:15px;line-height:1.55;color:#1a1a2e">Oi${e.nome ? `, ${esc(e.nome.split(" ")[0])}` : ""}.</p>
    ${ps}${botao}${rodape}
    <p style="margin:26px 0 0;font-size:12px;color:#9ca3af">Cria Social Club · <a href="${APP_URL()}/privacidade" style="color:#9ca3af">privacidade</a></p>
  </div>
</div>`;
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
        from: "Cria <noreply@criasocialclub.com.br>",
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
