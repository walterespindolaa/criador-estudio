import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient, SupabaseClient } from "npm:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

// Escapa valores interpolados no HTML do e-mail. (F12/F24)
function escapeHtml(v: unknown): string {
  return String(v ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// Origin confiável pro link de ativação (F13): APP_URL fixo ou allow-list, caindo
// no domínio canônico. Nunca monta o link só com o header Origin cru.
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
  const { data, error } = await svc.from("email_unsubscribe_tokens").select("token").eq("email", email).single();
  if (error || !data?.token) throw new Error("could_not_get_unsubscribe_token");
  return data.token as string;
}

function emailHtml(opts: {
  title: string;
  paragraph: string;
  buttonLabel: string;
  actionLink: string;
  secondary: string;
}): string {
  // Rodapé com o logo (e não com a palavra "cria" escrita).
  // Cuidados de e-mail: Gmail e Outlook bloqueiam imagem por padrão, então a URL
  // é absoluta e pública, width/height vão como ATRIBUTO (o Outlook ignora só o
  // CSS) e o alt="cria" segura a assinatura quando a imagem não carrega. O
  // endereço embaixo é texto de verdade, nunca some.
  return `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif;color:#1f2937">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="padding:32px 16px">
    <tr><td align="center">
      <table role="presentation" width="480" cellpadding="0" cellspacing="0" border="0" style="max-width:480px;width:100%;background:#ffffff;border-radius:16px;padding:40px 32px;box-shadow:0 1px 3px rgba(0,0,0,0.05)">
        <tr><td>
          <h1 style="margin:0 0 16px 0;font-size:22px;font-weight:700;color:#111827;line-height:1.3">${opts.title}</h1>
          <p style="margin:0 0 28px 0;font-size:15px;line-height:1.55;color:#4b5563">${opts.paragraph}</p>
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 20px 0">
            <tr><td style="border-radius:12px;background:#8B5CF6">
              <a href="${opts.actionLink}" style="display:inline-block;padding:12px 24px;color:#ffffff;font-size:15px;font-weight:600;text-decoration:none;border-radius:12px">${opts.buttonLabel}</a>
            </td></tr>
          </table>
          <p style="margin:0;font-size:13px;line-height:1.5;color:#9ca3af">${opts.secondary}</p>
        </td></tr>
      </table>
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin:24px auto 0"><tr><td align="center" style="font-family:system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif"><a href="https://criasocialclub.com.br" target="_blank" style="text-decoration:none"><img src="https://app.criasocialclub.com.br/logo-cria.png" width="104" height="57" alt="cria" style="display:block;border:0;outline:none;text-decoration:none;width:104px;height:57px;font-size:12px;color:#9ca3af" /></a><div style="margin:6px 0 0 0;font-size:12px;color:#9ca3af">criasocialclub.com.br</div></td></tr></table>
    </td></tr>
  </table>
</body></html>`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "unauthorized" }, 401);

    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return json({ error: "unauthorized" }, 401);

    const svc = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // Caller precisa ser admin
    const { data: caller } = await svc.from("profiles").select("role").eq("id", user.id).single();
    if (caller?.role !== "admin") return json({ error: "forbidden" }, 403);

    const { name, email, phone, plan, validity } = await req.json();
    if (!email || !name) return json({ error: "missing_fields" }, 400);
    const normEmail = String(email).trim().toLowerCase();
    const validPlans = ["free", "pro", "studio", "trial"];
    const chosenPlan = validPlans.includes(plan) ? plan : "trial";
    console.log("[admin-create-user] validity recebido:", validity, "plan:", chosenPlan);

    // Cortesia manual: mapeia chave do front pra dias (vitalício = null = sem expiração)
    const VALIDITY_DAYS: Record<string, number | null> = {
      "15d": 15, "1m": 30, "3m": 90, "6m": 180, "1y": 365, "lifetime": null,
    };

    // Gera invite link (Supabase cria o usuário como parte do generateLink type='invite')
    const origin = resolveAppUrl(req); // F13: origin validado, não o header cru
    const redirectTo = origin + "/app";
    const { data: linkData, error: linkErr } = await svc.auth.admin.generateLink({
      type: "invite",
      email: normEmail,
      options: { redirectTo },
    });
    if (linkErr || !linkData?.properties?.action_link || !linkData.user) {
      const msg = linkErr?.message ?? "";
      if (msg.toLowerCase().includes("already registered") || msg.toLowerCase().includes("already exists")) {
        return json({ error: "user_exists" }, 409);
      }
      console.error("[admin-create-user] generateLink failed:", linkErr);
      return json({ error: "link_failed" }, 400);
    }
    // Link branded do CRIA (não expõe supabase.co): /ativar autentica via token_hash.
    const hashed = linkData.properties.hashed_token;
    const actionLink = hashed
      ? `${origin}/ativar?th=${hashed}&type=invite&to=${encodeURIComponent("/app")}`
      : linkData.properties.action_link;
    const newId = linkData.user.id;

    // Ajusta o profile (o trigger de trial seta plan='trial'; sobrescrevemos com o escolhido)
    const patch: Record<string, unknown> = {
      name,
      phone: phone ?? null,
      plan: chosenPlan,
      must_change_password: true,
    };
    if (["pro", "studio"].includes(chosenPlan)) {
      patch.subscription_status = "active"; // acesso liberado (cortesia/manual)
      const key = typeof validity === "string" ? validity : "lifetime";
      const days = key in VALIDITY_DAYS ? VALIDITY_DAYS[key] : null;
      patch.access_expires_at = days === null
        ? null
        : new Date(Date.now() + days * 86400000).toISOString();
    }
    console.log("[admin-create-user] patch:", JSON.stringify(patch));
    await svc.from("profiles").update(patch).eq("id", newId);

    // Enfileira o e-mail (1 botão, sem senha visível)
    const html = emailHtml({
      title: "Sua conta está pronta",
      paragraph: "Criamos sua conta no cria. Clique no botão para acessar e definir sua senha.",
      buttonLabel: "Acessar minha conta",
      actionLink,
      secondary: `Se o botão não funcionar, copie e cole este link no navegador:<br/><span style="word-break:break-all;color:#6b7280">${escapeHtml(actionLink)}</span>`,
    });
    const messageId = crypto.randomUUID();
    const unsubscribeToken = await ensureUnsubscribeToken(svc, normEmail);
    await svc.rpc("enqueue_email", {
      queue_name: "transactional_emails",
      payload: {
        to: normEmail, subject: "Seu acesso ao cria",
        from: "cria <noreply@criasocialclub.com.br>",
        sender_domain: "notify.criasocialclub.com.br",
        purpose: "transactional",
        html, text: `Sua conta no cria está pronta. Acesse: ${actionLink}`,
        label: "admin_invite", idempotency_key: messageId, unsubscribe_token: unsubscribeToken,
        message_id: messageId, queued_at: new Date().toISOString(),
      },
    });

    return json({ ok: true, email: normEmail, inviteLink: actionLink });
  } catch (e) {
    console.error("[admin-create-user] unhandled error:", e);
    return json({ error: "internal_error" }, 500);
  }
});
