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
    if (!user || !user.email) return json({ error: "unauthorized" }, 401);

    const svc = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // Caller precisa ser manager
    const { data: caller } = await svc.from("profiles").select("name, account_type").eq("id", user.id).single();
    if (caller?.account_type !== "manager") return json({ error: "forbidden_not_manager" }, 403);

    const body = await req.json();
    const { email, plan, partner_code } = body as { email?: string; plan?: string; partner_code?: string };
    if (!email || !plan) return json({ error: "missing_fields" }, 400);

    const normEmail = String(email).trim().toLowerCase();
    const managerEmail = user.email.toLowerCase();
    if (normEmail === managerEmail) {
      return json({ error: "use_different_email" }, 400);
    }

    const validPlans = ["pro", "studio"];
    if (!validPlans.includes(plan)) return json({ error: "invalid_plan" }, 400);

    console.log("[manager-self-subscribe] start", { manager: user.id, pfEmail: normEmail, plan });

    // Existe?
    const { data: list } = await svc.auth.admin.listUsers();
    const existing = list?.users?.find((u) => u.email?.toLowerCase() === normEmail);

    const redirectTo = (req.headers.get("origin") ?? "https://app.criasocialclub.com.br") + "/app/assinar";
    const type: "magiclink" | "invite" = existing ? "magiclink" : "invite";
    const { data: linkData, error: linkErr } = await svc.auth.admin.generateLink({
      type,
      email: normEmail,
      options: { redirectTo },
    });
    if (linkErr || !linkData?.properties?.action_link || !linkData.user) {
      console.error("[manager-self-subscribe] generateLink failed:", linkErr);
      return json({ error: "link_failed" }, 400);
    }
    const actionLink = linkData.properties.action_link;
    const pfUserId = linkData.user.id;

    // Vínculo PENDENTE: manager gerencia a conta PF (PF é owner_id; manager fica em member_*).
    // O webhook do Stripe ativa quando o pagamento confirmar.
    const { error: upsertErr } = await svc.from("account_members").upsert({
      owner_id: pfUserId,
      member_email: managerEmail,
      member_id: user.id,
      role: "manager",
      status: "pending",
      pending_self_subscribe: true,
    }, { onConflict: "owner_id,member_email" });
    if (upsertErr) {
      console.error("[manager-self-subscribe] account_members upsert failed:", upsertErr);
      return json({ error: "link_membership_failed" }, 500);
    }

    // Salvar partner_code preferido no metadata da PF — o checkout vai ler isso depois.
    if (partner_code) {
      await svc.auth.admin.updateUserById(pfUserId, {
        user_metadata: {
          ...(linkData.user.user_metadata ?? {}),
          self_subscribe_partner_code: partner_code,
          self_subscribe_plan: plan,
        },
      });
    } else {
      await svc.auth.admin.updateUserById(pfUserId, {
        user_metadata: {
          ...(linkData.user.user_metadata ?? {}),
          self_subscribe_plan: plan,
        },
      });
    }

    // Email pra PF com magic link → cai em /app/assinar pra completar checkout
    const html = emailHtml({
      title: "Confirme seu acesso e finalize a assinatura",
      paragraph:
        "Você (ou sua social media) iniciou uma assinatura do cria pra essa conta. Clique no botão pra acessar e finalizar o pagamento — você define sua senha e cai direto na tela de assinatura.",
      buttonLabel: "Acessar e assinar",
      actionLink,
      secondary: `Se o botão não funcionar, copie este link no navegador:<br/><span style="word-break:break-all;color:#6b7280">${actionLink}</span>`,
    });
    const messageId = crypto.randomUUID();
    const unsubscribeToken = await ensureUnsubscribeToken(svc, normEmail);
    await svc.rpc("enqueue_email", {
      queue_name: "transactional_emails",
      payload: {
        to: normEmail,
        subject: "Finalize sua assinatura no cria",
        from: "cria <noreply@criasocialclub.com.br>",
        sender_domain: "notify.criasocialclub.com.br",
        purpose: "transactional",
        html,
        text: `Confirme seu acesso e finalize a assinatura no cria: ${actionLink}`,
        label: existing ? "self_subscribe_existing" : "self_subscribe_new",
        idempotency_key: messageId,
        unsubscribe_token: unsubscribeToken,
        message_id: messageId,
        queued_at: new Date().toISOString(),
      },
    });

    console.log("[manager-self-subscribe] ok", { pfUserId, existing: !!existing });
    return json({ ok: true, email: normEmail, pf_user_id: pfUserId, existed: !!existing });
  } catch (e) {
    console.error("[manager-self-subscribe] unhandled error:", e);
    return json({ error: "internal_error" }, 500);
  }
});
