import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

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
      <p style="margin:24px 0 0 0;font-size:12px;color:#9ca3af">cria · criasocialclub.com.br</p>
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
    const validPlans = ["free", "pro", "premium", "trial"];
    const chosenPlan = validPlans.includes(plan) ? plan : "trial";

    // Cortesia manual: mapeia chave do front pra dias (vitalício = null = sem expiração)
    const VALIDITY_DAYS: Record<string, number | null> = {
      "15d": 15, "1m": 30, "3m": 90, "6m": 180, "1y": 365, "lifetime": null,
    };

    // Gera invite link (Supabase cria o usuário como parte do generateLink type='invite')
    const redirectTo = (req.headers.get("origin") ?? "https://app.criasocialclub.com.br") + "/app";
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
    const actionLink = linkData.properties.action_link;
    const newId = linkData.user.id;

    // Ajusta o profile (o trigger de trial seta plan='trial'; sobrescrevemos com o escolhido)
    const patch: Record<string, unknown> = {
      name,
      phone: phone ?? null,
      plan: chosenPlan,
      must_change_password: true,
    };
    if (["pro", "premium"].includes(chosenPlan)) {
      patch.subscription_status = "active"; // acesso liberado (cortesia/manual)
      const key = typeof validity === "string" ? validity : "lifetime";
      const days = key in VALIDITY_DAYS ? VALIDITY_DAYS[key] : null;
      patch.access_expires_at = days === null
        ? null
        : new Date(Date.now() + days * 86400000).toISOString();
    }
    await svc.from("profiles").update(patch).eq("id", newId);

    // Enfileira o e-mail (1 botão, sem senha visível)
    const html = emailHtml({
      title: "Sua conta está pronta",
      paragraph: "Criamos sua conta no cria. Clique no botão para acessar e definir sua senha.",
      buttonLabel: "Acessar minha conta",
      actionLink,
      secondary: `Se o botão não funcionar, copie e cole este link no navegador:<br/><span style="word-break:break-all;color:#6b7280">${actionLink}</span>`,
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
