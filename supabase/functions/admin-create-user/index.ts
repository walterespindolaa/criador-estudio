import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { molduraCria, REMETENTE_CRIA } from "../_shared/email-moldura.ts";
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
  /* SEM CURINGA DE PREVIEW (pente fino 23/09/2026, S1). Aceitar qualquer
     *.lovable.app vindo do Origin deixava um atacante mandar o link de senha
     da vítima pra um domínio dele. Preview do Lovable usa APP_URL ou cai no
     canônico, que também funciona. */
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
  return molduraCria({
    tag: "Seu acesso", tema: "verde", titulo: opts.title,
    corpoHtml: opts.paragraph,
    botao: { texto: opts.buttonLabel, url: opts.actionLink }, linkReserva: true,
    notaHtml: opts.secondary,
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
      paragraph: "Criamos sua conta no Cria. Clique no botão para acessar e definir sua senha.",
      buttonLabel: "Acessar minha conta",
      actionLink,
      secondary: `Se o botão não funcionar, copie e cole este link no navegador:<br/><span style="word-break:break-all;color:#6b7280">${escapeHtml(actionLink)}</span>`,
    });
    const messageId = crypto.randomUUID();
    const unsubscribeToken = await ensureUnsubscribeToken(svc, normEmail);
    await svc.rpc("enqueue_email", {
      queue_name: "transactional_emails",
      payload: {
        to: normEmail, subject: "Seu acesso ao Cria",
        from: REMETENTE_CRIA,
        sender_domain: "notify.criasocialclub.com.br",
        purpose: "transactional",
        html, text: `Sua conta no Cria está pronta. Acesse: ${actionLink}`,
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
