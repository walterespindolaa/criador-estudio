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
  const { data } = await svc.from("email_unsubscribe_tokens").select("token").eq("email", email).single();
  return (data?.token as string) ?? token;
}

function emailHtml(opts: { title: string; paragraph: string; buttonLabel: string; actionLink: string; secondary: string }): string {
  // Rodapé com o logo (e não com a palavra "cria" escrita).
  // Cuidados de e-mail: Gmail e Outlook bloqueiam imagem por padrão, então a URL
  // é absoluta e pública, width/height vão como ATRIBUTO (o Outlook ignora só o
  // CSS) e o alt="cria" segura a assinatura quando a imagem não carrega. O
  // endereço embaixo é texto de verdade, nunca some.
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
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin:24px auto 0"><tr><td align="center" style="font-family:system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif"><a href="https://criasocialclub.com.br" target="_blank" style="text-decoration:none"><img src="https://app.criasocialclub.com.br/logo-cria.png" width="104" height="57" alt="cria" style="display:block;border:0;outline:none;text-decoration:none;width:104px;height:57px;font-size:12px;color:#9ca3af" /></a><div style="margin:6px 0 0 0;font-size:12px;color:#9ca3af">criasocialclub.com.br</div></td></tr></table>
  </td></tr></table>
</body></html>`;
}

async function inviteUser(svc: SupabaseClient, email: string, origin: string, redirectPath: string) {
  // Idempotente: tenta criar (invite) e, se o usuário JÁ existe (ex.: tentativa
  // anterior que ficou pela metade, ou conta que a pessoa mesma abriu), cai pro
  // magiclink e reaproveita a conta em vez de explodir.
  // Antes a detecção usava listUsers(), que é PAGINADO (50 por página): conta
  // existente fora da primeira página não era achada, o invite batia em
  // "already been registered" e a criação inteira morria com erro genérico.
  let existed = false;
  let attempt = await svc.auth.admin.generateLink({
    type: "invite", email, options: { redirectTo: origin + redirectPath },
  });
  if (attempt.error && /already|exists|registered/i.test(attempt.error.message ?? "")) {
    existed = true;
    attempt = await svc.auth.admin.generateLink({
      type: "magiclink", email, options: { redirectTo: origin + redirectPath },
    });
  }
  const { data: linkData, error } = attempt;
  if (error || !linkData?.properties?.action_link || !linkData.user) {
    return { error: (error?.message ?? "link_failed") };
  }
  // Link branded do CRIA (não expõe supabase.co): /ativar autentica via token_hash e redireciona.
  const type: "magiclink" | "invite" = existed ? "magiclink" : "invite";
  const hashed = linkData.properties.hashed_token;
  const branded = hashed
    ? `${origin}/ativar?th=${hashed}&type=${type}&to=${encodeURIComponent(redirectPath)}`
    : linkData.properties.action_link;
  return { actionLink: branded, userId: linkData.user.id, existed };
}

// E-mail de boas-vindas NUNCA pode derrubar a criação da conta: se falhar,
// devolve false e o chamador avisa o admin pra reenviar por "Ações".
async function sendInvite(svc: SupabaseClient, email: string, title: string, paragraph: string, actionLink: string): Promise<boolean> {
  try {
    const html = emailHtml({ title, paragraph, buttonLabel: "Acessar minha conta", actionLink,
      secondary: `Se o botão não funcionar, copie e cole este link no navegador:<br/><span style="word-break:break-all;color:#6b7280">${escapeHtml(actionLink)}</span>` });
    const messageId = crypto.randomUUID();
    const unsubscribeToken = await ensureUnsubscribeToken(svc, email);
    const { error } = await svc.rpc("enqueue_email", {
      queue_name: "transactional_emails",
      payload: {
        to: email, subject: "Seu acesso ao cria", from: "cria <noreply@criasocialclub.com.br>",
        sender_domain: "notify.criasocialclub.com.br", purpose: "transactional",
        html, text: `Sua conta no cria está pronta. Acesse: ${actionLink}`,
        label: "admin_create_manager", idempotency_key: messageId, unsubscribe_token: unsubscribeToken,
        message_id: messageId, queued_at: new Date().toISOString(),
      },
    });
    if (error) { console.error("[admin-create-manager] enqueue_email falhou:", error); return false; }
    return true;
  } catch (e) {
    console.error("[admin-create-manager] envio do convite falhou:", e);
    return false;
  }
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
    if (!email || !name) {
      return json({ error: "missing_fields", message: "Nome e e-mail são obrigatórios." }, 400);
    }

    const origin = resolveAppUrl(req); // F13: origin validado, não o header cru
    // Normaliza ANTES de qualquer uso: o auth do Supabase guarda minúsculo, e
    // e-mail digitado com maiúscula ("Beatriz...") não pode divergir em nada.
    const managerEmail = String(email).trim().toLowerCase();
    const creatorEmail = creator?.email?.trim().toLowerCase() || null;
    if (creatorEmail && creatorEmail === managerEmail) {
      // Validado antes de criar qualquer coisa (antes rodava depois da conta
      // de gestão já criada, deixando meio-criação pra trás).
      return json({ error: "use_different_email", message: "O e-mail de criadora precisa ser diferente do e-mail de gestão." }, 400);
    }

    // Avisos não-fatais: a conta foi criada, mas algo acessório falhou.
    const warnings: string[] = [];

    // 1) Cria a social media (manager)
    const mgr = await inviteUser(svc, managerEmail, origin, "/socialmidia/dashboard");
    if ("error" in mgr) {
      console.error("[admin-create-manager] inviteUser (gestão) falhou:", mgr.error);
      return json({ error: "link_failed", message: `Não consegui gerar o acesso de ${managerEmail}: ${mgr.error.slice(0, 200)}` }, 400);
    }
    // Upsert (não update): se a tentativa anterior criou o auth user mas o
    // perfil ficou pra trás, o update em cima de 0 linhas "passava" sem criar
    // nada e a conta nascia quebrada. O upsert cura a meia-criação.
    const { error: profErr } = await svc.from("profiles").upsert({
      id: mgr.userId, name, phone: phone ?? null, account_type: "manager", must_change_password: true,
    }, { onConflict: "id" });
    if (profErr) {
      console.error("[admin-create-manager] perfil (gestão) falhou:", profErr);
      return json({ error: "profile_failed", message: `O acesso foi criado, mas o perfil de gestão falhou: ${profErr.message.slice(0, 200)}. Tente de novo (a segunda tentativa reaproveita a conta).` }, 400);
    }

    // 2) Pacotes (module_entitlements)
    const codes = Array.isArray(modules) ? modules.filter((c) => typeof c === "string" && c.trim()) : [];
    if (codes.length > 0) {
      const { error: entErr } = await svc.from("module_entitlements").upsert(
        codes.map((code) => ({ manager_id: mgr.userId, module_code: code, status: "active" })),
        { onConflict: "manager_id,module_code" },
      );
      if (entErr) {
        console.error("[admin-create-manager] entitlements falharam:", entErr);
        warnings.push(`Conta criada, mas os pacotes não foram liberados (${entErr.message.slice(0, 120)}). Libere manualmente.`);
      }
    }
    const mailOk = await sendInvite(svc, managerEmail, "Sua conta de social media está pronta",
      "Criamos sua conta de gestão no cria. Clique no botão para acessar e definir sua senha.", mgr.actionLink);
    if (!mailOk) warnings.push("Conta criada, mas o e-mail de boas-vindas falhou: reenvie por Ações.");

    // 3) Conta de criadora (Cria normal) com outro e-mail (opcional)
    let creatorOut: { email: string; inviteLink: string } | null = null;
    if (creatorEmail) {
      const validPlans = ["free", "pro", "studio", "trial"];
      const plan = validPlans.includes(creator?.plan ?? "") ? creator!.plan! : "studio";

      const cr = await inviteUser(svc, creatorEmail, origin, "/app");
      if ("error" in cr) {
        // Falha na criadora não desfaz a gestão já criada: vira aviso.
        console.error("[admin-create-manager] inviteUser (criadora) falhou:", cr.error);
        warnings.push(`Conta de gestão criada, mas a conta de criadora falhou: ${cr.error.slice(0, 120)}`);
      } else {
        const { error: crProfErr } = await svc.from("profiles").upsert({
          id: cr.userId, name, plan, must_change_password: true,
          subscription_status: ["pro", "studio"].includes(plan) ? "active" : null,
        }, { onConflict: "id" });
        if (crProfErr) {
          console.error("[admin-create-manager] perfil (criadora) falhou:", crProfErr);
          warnings.push(`Conta de criadora criada, mas o perfil dela falhou: ${crProfErr.message.slice(0, 120)}`);
        }
        // vincula a social media como gestora da conta de criadora
        const { error: linkErr } = await svc.from("account_members").upsert({
          owner_id: cr.userId, member_email: managerEmail, member_id: mgr.userId,
          role: "manager", status: "active",
        }, { onConflict: "owner_id,member_email" });
        if (linkErr) {
          console.error("[admin-create-manager] vínculo gestora-criadora falhou:", linkErr);
          warnings.push(`Contas criadas, mas o vínculo gestora-criadora falhou: ${linkErr.message.slice(0, 120)}`);
        }
        const crMailOk = await sendInvite(svc, creatorEmail, "Seu acesso de criadora no cria",
          "Criamos sua conta de criadora no cria. Clique no botão para acessar e definir sua senha.", cr.actionLink);
        if (!crMailOk) warnings.push("Conta de criadora criada, mas o e-mail dela falhou: reenvie por Ações.");
        creatorOut = { email: creatorEmail, inviteLink: cr.actionLink };
      }
    }

    return json({ ok: true, email: managerEmail, inviteLink: mgr.actionLink, existed: mgr.existed, warnings, creator: creatorOut });
  } catch (e) {
    console.error("[admin-create-manager] unhandled error:", e);
    const msg = e instanceof Error ? e.message : String(e);
    return json({ error: "internal_error", message: `Erro inesperado no servidor: ${msg.slice(0, 200)}` }, 500);
  }
});
