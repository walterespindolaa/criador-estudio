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
import { molduraCria, REMETENTE_CRIA } from "../_shared/email-moldura.ts";
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
  /* SEM CURINGA DE PREVIEW (pente fino 23/09/2026, S1). Aceitar qualquer
     *.lovable.app vindo do Origin deixava um atacante mandar o link de senha
     da vítima pra um domínio dele. Preview do Lovable usa APP_URL ou cai no
     canônico, que também funciona. */
  return CANONICAL_APP_URL;
}

async function ensureUnsubscribeToken(svc: SupabaseClient, email: string): Promise<string> {
  const token = crypto.randomUUID();
  await svc.from("email_unsubscribe_tokens").upsert({ email, token }, { onConflict: "email", ignoreDuplicates: true });
  const { data } = await svc.from("email_unsubscribe_tokens").select("token").eq("email", email).single();
  return (data?.token as string) ?? token;
}

function emailHtml(actionLink: string): string {
  return molduraCria({
    tag: "Senha", tema: "laranja", titulo: "Bora criar uma senha nova",
    corpoHtml: "Recebemos um pedido pra trocar a senha da sua conta no Cria. Toque no botão e escolha a nova.",
    botao: { texto: "Criar nova senha", url: actionLink }, linkReserva: true,
    notaHtml: "Se não foi você que pediu, ignore este e-mail: sua senha atual continua a mesma.",
  });
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
        subject: "Redefina sua senha no Cria",
        from: REMETENTE_CRIA,
        sender_domain: "notify.criasocialclub.com.br",
        purpose: "transactional",
        html: emailHtml(actionLink),
        text: `Defina a sua nova senha no Cria: ${actionLink}`,
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
