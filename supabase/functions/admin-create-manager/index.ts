import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient, SupabaseClient } from "npm:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

async function ensureUnsubscribeToken(svc: SupabaseClient, email: string): Promise<string> {
  const token = crypto.randomUUID();
  await svc.from("email_unsubscribe_tokens").upsert({ email, token }, { onConflict: "email", ignoreDuplicates: true });
  const { data } = await svc.from("email_unsubscribe_tokens").select("token").eq("email", email).single();
  return (data?.token as string) ?? token;
}

function emailHtml(opts: { title: string; paragraph: string; buttonLabel: string; actionLink: string; secondary: string }): string {
  return `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif;color:#1f2937">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="padding:32px 16px"><tr><td align="center">
    <table role="presentation" width="480" cellpadding="0" cellspacing="0" border="0" style="max-width:480px;width:100%;background:#ffffff;border-radius:16px;padding:40px 32px;box-shadow:0 1px 3px rgba(0,0,0,0.05)"><tr><td>
      <h1 style="margin:0 0 16px 0;font-size:22px;font-weight:700;color:#111827;line-height:1.3">${opts.title}</h1>
      <p style="margin:0 0 28px 0;font-size:15px;line-height:1.55;color:#4b5563">${opts.paragraph}</p>
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 20px 0"><tr><td style="border-radius:12px;background:#8B5CF6">
        <a href="${opts.actionLink}" style="display:inline-block;padding:12px 24px;color:#ffffff;font-size:15px;font-weight:600;text-decoration:none;border-radius:12px">${opts.buttonLabel}</a>
      </td></tr></table>
      <p style="margin:0;font-size:13px;line-height:1.5;color:#9ca3af">${opts.secondary}</p>
    </td></tr></table>
    <p style="margin:24px 0 0 0;font-size:12px;color:#9ca3af">cria · criasocialclub.com.br</p>
  </td></tr></table>
</body></html>`;
}

async function inviteUser(svc: SupabaseClient, email: string, origin: string, redirectPath: string) {
  const { data: list } = await svc.auth.admin.listUsers();
  const existing = list?.users?.find((u) => u.email?.toLowerCase() === email);
  const type: "magiclink" | "invite" = existing ? "magiclink" : "invite";
  const { data: linkData, error } = await svc.auth.admin.generateLink({
    type, email, options: { redirectTo: origin + redirectPath },
  });
  if (error || !linkData?.properties?.action_link || !linkData.user) {
    return { error: (error?.message ?? "link_failed") };
  }
  // Link branded do CRIA (não expõe supabase.co): /ativar autentica via token_hash e redireciona.
  const hashed = linkData.properties.hashed_token;
  const branded = hashed
    ? `${origin}/ativar?th=${hashed}&type=${type}&to=${encodeURIComponent(redirectPath)}`
    : linkData.properties.action_link;
  return { actionLink: branded, userId: linkData.user.id, existed: !!existing };
}

async function sendInvite(svc: SupabaseClient, email: string, title: string, paragraph: string, actionLink: string) {
  const html = emailHtml({ title, paragraph, buttonLabel: "Acessar minha conta", actionLink,
    secondary: `Se o botão não funcionar, copie e cole este link no navegador:<br/><span style="word-break:break-all;color:#6b7280">${actionLink}</span>` });
  const messageId = crypto.randomUUID();
  const unsubscribeToken = await ensureUnsubscribeToken(svc, email);
  await svc.rpc("enqueue_email", {
    queue_name: "transactional_emails",
    payload: {
      to: email, subject: "Seu acesso ao cria", from: "cria <noreply@criasocialclub.com.br>",
      sender_domain: "notify.criasocialclub.com.br", purpose: "transactional",
      html, text: `Sua conta no cria está pronta. Acesse: ${actionLink}`,
      label: "admin_create_manager", idempotency_key: messageId, unsubscribe_token: unsubscribeToken,
      message_id: messageId, queued_at: new Date().toISOString(),
    },
  });
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
    const { data: caller } = await svc.from("profiles").select("role").eq("id", user.id).single();
    if (caller?.role !== "admin") return json({ error: "forbidden" }, 403);

    const body = await req.json();
    const { name, email, phone, modules, creator } = body as {
      name?: string; email?: string; phone?: string; modules?: string[];
      creator?: { email?: string; plan?: string } | null;
    };
    if (!email || !name) return json({ error: "missing_fields" }, 400);

    const origin = req.headers.get("origin") ?? "https://app.criasocialclub.com.br";
    const managerEmail = String(email).trim().toLowerCase();

    // 1) Cria a social media (manager)
    const mgr = await inviteUser(svc, managerEmail, origin, "/socialmidia/dashboard");
    if ("error" in mgr) {
      if (/already|exists/i.test(mgr.error)) return json({ error: "user_exists" }, 409);
      return json({ error: "link_failed" }, 400);
    }
    await svc.from("profiles").update({
      name, phone: phone ?? null, account_type: "manager", must_change_password: true,
    }).eq("id", mgr.userId);

    // 2) Pacotes (module_entitlements)
    const codes = Array.isArray(modules) ? modules.filter((c) => typeof c === "string" && c.trim()) : [];
    if (codes.length > 0) {
      await svc.from("module_entitlements").upsert(
        codes.map((code) => ({ manager_id: mgr.userId, module_code: code, status: "active" })),
        { onConflict: "manager_id,module_code" },
      );
    }
    await sendInvite(svc, managerEmail, "Sua conta de social media está pronta",
      "Criamos sua conta de gestão no cria. Clique no botão para acessar e definir sua senha.", mgr.actionLink);

    // 3) Conta de criadora (Cria normal) com outro e-mail (opcional)
    let creatorOut: { email: string; inviteLink: string } | null = null;
    if (creator?.email && creator.email.trim()) {
      const creatorEmail = creator.email.trim().toLowerCase();
      if (creatorEmail === managerEmail) return json({ error: "use_different_email" }, 400);
      const validPlans = ["free", "pro", "studio", "trial"];
      const plan = validPlans.includes(creator.plan ?? "") ? creator.plan! : "studio";

      const cr = await inviteUser(svc, creatorEmail, origin, "/app");
      if (!("error" in cr)) {
        await svc.from("profiles").update({
          name, plan, must_change_password: true,
          subscription_status: ["pro", "studio"].includes(plan) ? "active" : null,
        }).eq("id", cr.userId);
        // vincula a social media como gestora da conta de criadora
        await svc.from("account_members").upsert({
          owner_id: cr.userId, member_email: managerEmail, member_id: mgr.userId,
          role: "manager", status: "active",
        }, { onConflict: "owner_id,member_email" });
        await sendInvite(svc, creatorEmail, "Seu acesso de criadora no cria",
          "Criamos sua conta de criadora no cria. Clique no botão para acessar e definir sua senha.", cr.actionLink);
        creatorOut = { email: creatorEmail, inviteLink: cr.actionLink };
      }
    }

    return json({ ok: true, email: managerEmail, inviteLink: mgr.actionLink, creator: creatorOut });
  } catch (e) {
    console.error("[admin-create-manager] unhandled error:", e);
    return json({ error: "internal_error" }, 500);
  }
});
