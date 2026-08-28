// ============================================================
// RECUPERAÇÃO DE SENHA PELA FILA DO CRIA
//
// O "Esqueci a senha" chamava supabase.auth.resetPasswordForEmail, que dispara
// pelo mailer interno do Supabase Auth. Só que o Cria NÃO manda e-mail por lá:
// convite, aprovação e todo o resto saem pela fila própria (enqueue_email).
// Resultado: o mailer interno falhava ("Erro ao enviar email") e ninguém
// recebia nada. O PeJota ficou trancado do lado de fora exatamente assim.
//
// Aqui o link de recuperação nasce por admin.generateLink (tipo recovery) e o
// e-mail sai pela MESMA fila de todos os outros, com o mesmo remetente. O link
// aponta pra /ativar, que já sabe verificar token de recovery e seguir pro
// /reset-password.
// ============================================================
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient, SupabaseClient } from "npm:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

const CANONICAL_APP_URL = "https://app.criasocialclub.com.br";
function resolveAppUrl(req: Request): string {
  const fixed = Deno.env.get("APP_URL");
  if (fixed) return fixed.replace(/\/+$/, "");
  const origin = req.headers.get("origin") ?? "";
  const allow = [
    "https://app.criasocialclub.com.br",
    "https://criasocialclub.com.br",
    "https://www.criasocialclub.com.br",
  ];
  if (allow.includes(origin)) return origin;
  if (/^https:\/\/[a-z0-9-]+\.(lovableproject\.com|lovable\.app)$/.test(origin)) return origin;
  return CANONICAL_APP_URL;
}

async function ensureUnsubscribeToken(svc: SupabaseClient, email: string): Promise<string> {
  const token = crypto.randomUUID();
  await svc.from("email_unsubscribe_tokens").upsert({ email, token }, { onConflict: "email", ignoreDuplicates: true });
  const { data } = await svc.from("email_unsubscribe_tokens").select("token").eq("email", email).single();
  return (data?.token as string) ?? token;
}

function emailHtml(actionLink: string): string {
  return `<!doctype html>
<html><body style="margin:0;padding:0;background-color:#f4f4f5">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f4f4f5;padding:32px 16px"><tr><td align="center">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:480px;background:#ffffff;border-radius:16px;padding:32px;font-family:system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif">
      <tr><td>
      <h1 style="margin:0 0 12px;font-size:20px;color:#111827">Trocar a sua senha</h1>
      <p style="margin:0 0 20px;font-size:14px;line-height:1.6;color:#4b5563">Você pediu pra trocar a senha da sua conta no cria. Clique no botão e defina a nova. Se não foi você, ignore este e-mail: nada muda.</p>
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 20px 0"><tr><td style="border-radius:12px;background:#EA4918">
        <a href="${actionLink}" style="display:inline-block;padding:12px 24px;color:#fff;font-size:15px;font-weight:600;text-decoration:none;border-radius:12px">Definir nova senha</a>
      </td></tr></table>
      <p style="margin:0;font-size:13px;line-height:1.5;color:#9ca3af">Se o botão não funcionar, copie: <span style="word-break:break-all;color:#6b7280">${actionLink}</span></p>
      </td></tr>
    </table>
  </td></tr></table>
</body></html>`;
}

// Rate limit simples em memória por instância: segura rajada de robô sem
// depender de tabela. 5 pedidos por e-mail a cada 15 min.
const pedidos = new Map<string, number[]>();
function estourou(email: string): boolean {
  const agora = Date.now();
  const lista = (pedidos.get(email) ?? []).filter((t) => agora - t < 15 * 60 * 1000);
  lista.push(agora);
  pedidos.set(email, lista);
  return lista.length > 5;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const body = await req.json().catch(() => ({}));
    const email = String((body as { email?: string }).email ?? "").trim().toLowerCase();
    // Resposta SEMPRE ok pra quem chama: dizer "este e-mail não existe" é
    // entregar a lista de clientes pra quem estiver sondando.
    if (!email || !email.includes("@") || estourou(email)) return json({ ok: true });

    const svc = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const origin = resolveAppUrl(req);
    const { data: linkData, error: linkErr } = await svc.auth.admin.generateLink({
      type: "recovery", email, options: { redirectTo: origin + "/reset-password" },
    });
    // Conta inexistente cai aqui: responde ok do mesmo jeito, sem vazar.
    if (linkErr || !linkData?.user) return json({ ok: true });

    const hashed = linkData.properties?.hashed_token;
    const actionLink = hashed
      ? `${origin}/ativar?th=${hashed}&type=recovery&to=${encodeURIComponent("/reset-password")}`
      : (linkData.properties?.action_link ?? origin);

    const messageId = crypto.randomUUID();
    const unsub = await ensureUnsubscribeToken(svc, email);
    await svc.rpc("enqueue_email", {
      queue_name: "transactional_emails",
      payload: {
        to: email,
        subject: "Trocar a sua senha no cria",
        from: "cria <noreply@criasocialclub.com.br>",
        sender_domain: "notify.criasocialclub.com.br",
        purpose: "transactional",
        html: emailHtml(actionLink),
        text: `Defina a sua nova senha no cria: ${actionLink}`,
        label: "password_reset",
        idempotency_key: messageId, unsubscribe_token: unsub, message_id: messageId,
        queued_at: new Date().toISOString(),
      },
    });

    return json({ ok: true });
  } catch (e) {
    console.error("[password-reset] unhandled:", e);
    // Mesmo em erro interno a resposta é ok: o chamador não tem o que fazer
    // com o detalhe, e o log fica do nosso lado.
    return json({ ok: true });
  }
});
