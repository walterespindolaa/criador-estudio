// Social mídia (manager) adiciona um cliente coberto pelos assentos da agência.
// Gated por seat_limit. Cria a conta de criadora, vincula e devolve link branded /ativar.
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...cors, "Content-Type": "application/json" } });

async function ensureUnsubscribeToken(svc: SupabaseClient, email: string): Promise<string> {
  const token = crypto.randomUUID();
  await svc.from("email_unsubscribe_tokens").upsert({ email, token }, { onConflict: "email", ignoreDuplicates: true });
  const { data } = await svc.from("email_unsubscribe_tokens").select("token").eq("email", email).single();
  return (data?.token as string) ?? token;
}

function emailHtml(opts: { title: string; paragraph: string; actionLink: string }): string {
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif;color:#1f2937">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="padding:32px 16px"><tr><td align="center">
    <table role="presentation" width="480" cellpadding="0" cellspacing="0" border="0" style="max-width:480px;width:100%;background:#ffffff;border-radius:16px;padding:40px 32px"><tr><td>
      <h1 style="margin:0 0 16px 0;font-size:22px;font-weight:700;color:#111827;line-height:1.3">${opts.title}</h1>
      <p style="margin:0 0 28px 0;font-size:15px;line-height:1.55;color:#4b5563">${opts.paragraph}</p>
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 20px 0"><tr><td style="border-radius:12px;background:#8B5CF6">
        <a href="${opts.actionLink}" style="display:inline-block;padding:12px 24px;color:#ffffff;font-size:15px;font-weight:600;text-decoration:none;border-radius:12px">Acessar minha conta</a>
      </td></tr></table>
      <p style="margin:0;font-size:13px;line-height:1.5;color:#9ca3af">Se o botão não funcionar, copie e cole no navegador:<br/><span style="word-break:break-all;color:#6b7280">${opts.actionLink}</span></p>
      <p style="margin:24px 0 0 0;font-size:12px;color:#9ca3af">cria · criasocialclub.com.br</p>
    </td></tr></table>
  </td></tr></table>
</body></html>`;
}

async function sendClientInvite(svc: SupabaseClient, email: string, agencyName: string, actionLink: string) {
  const paragraph = `${agencyName || "Sua social mídia"} criou sua conta no cria pra cuidar do seu conteúdo. Clique no botão pra acessar e definir sua senha.`;
  const html = emailHtml({ title: "Seu acesso ao cria está pronto", paragraph, actionLink });
  const messageId = crypto.randomUUID();
  const unsubscribeToken = await ensureUnsubscribeToken(svc, email);
  await svc.rpc("enqueue_email", {
    queue_name: "transactional_emails",
    payload: {
      to: email, subject: "Seu acesso ao cria", from: "cria <noreply@criasocialclub.com.br>",
      sender_domain: "notify.criasocialclub.com.br", purpose: "transactional",
      html, text: `Sua conta no cria está pronta. Acesse: ${actionLink}`,
      label: "manager_add_client", idempotency_key: messageId, unsubscribe_token: unsubscribeToken,
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

    const svc: SupabaseClient = createClient(
      Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // Caller precisa ser manager com assentos.
    const { data: caller } = await svc.from("profiles")
      .select("account_type, seat_limit, name").eq("id", user.id).single();
    if (caller?.account_type !== "manager") return json({ error: "forbidden_not_manager" }, 403);
    const seatLimit = Number(caller?.seat_limit ?? 0);
    if (seatLimit <= 0) return json({ error: "no_seats" }, 402);

    // Conta assentos usados (clientes cobertos por essa agência).
    const { count: used } = await svc.from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("agency_owner_id", user.id);
    if ((used ?? 0) >= seatLimit) return json({ error: "seats_full", used, seatLimit }, 409);

    const body = await req.json().catch(() => ({}));
    const name = String(body?.name ?? "").trim();
    const email = String(body?.email ?? "").trim().toLowerCase();
    if (!name || !email || !email.includes("@")) return json({ error: "missing_fields" }, 400);
    if (email === (user.email ?? "").toLowerCase()) return json({ error: "use_different_email" }, 400);

    const origin = req.headers.get("origin") ?? "https://app.criasocialclub.com.br";

    // Gera invite (cria o usuário). Se já existir, manda magiclink.
    const { data: list } = await svc.auth.admin.listUsers();
    const existing = list?.users?.find((u) => u.email?.toLowerCase() === email);
    const type: "magiclink" | "invite" = existing ? "magiclink" : "invite";
    const { data: linkData, error: linkErr } = await svc.auth.admin.generateLink({
      type, email, options: { redirectTo: origin + "/app" },
    });
    if (linkErr || !linkData?.properties?.action_link || !linkData.user) {
      return json({ error: "link_failed" }, 400);
    }
    const creatorId = linkData.user.id;
    const hashed = linkData.properties.hashed_token;
    const inviteLink = hashed
      ? `${origin}/ativar?th=${hashed}&type=${type}&to=${encodeURIComponent("/app")}`
      : linkData.properties.action_link;

    // Conta de criadora coberta pela agência (studio, acesso ativo, sem cobrança própria).
    await svc.from("profiles").update({
      name, plan: "studio", subscription_status: "active",
      agency_owner_id: user.id, must_change_password: true,
    }).eq("id", creatorId);

    // Vincula a social mídia como gestora.
    await svc.from("account_members").upsert({
      owner_id: creatorId, member_email: user.email, member_id: user.id,
      role: "manager", status: "active", accepted_at: new Date().toISOString(),
    }, { onConflict: "owner_id,member_email" });

    // E-mail automático pro cliente (best-effort — não bloqueia a resposta).
    try { await sendClientInvite(svc, email, String(caller?.name ?? ""), inviteLink); }
    catch (e) { console.error("[manager-add-client] email enqueue failed:", e); }

    return json({ ok: true, email, inviteLink, used: (used ?? 0) + 1, seatLimit });
  } catch (e) {
    console.error("[manager-add-client] error:", e);
    return json({ error: "internal_error" }, 500);
  }
});
