import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient, SupabaseClient } from "npm:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

// Escapa valores interpolados no HTML do e-mail (nome do usuário etc.): sem isso,
// um nome com "<script>" ou "onerror=" seria injetado no template. (F12/F24)
function escapeHtml(v: unknown): string {
  return String(v ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// Origin confiável pro link de ativação (F13): usa APP_URL fixo se definido; senão
// valida o header Origin contra a allow-list, caindo no domínio canônico. Nunca
// monta o link só com o Origin cru da request (dá pra forjar → link malicioso).
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
    const { email, name: _ignored } = await req.json();
    if (!email) return json({ error: "missing_email" }, 400);
    const normEmail = String(email).trim().toLowerCase();

    // Dono não pode se convidar
    if (user.email?.toLowerCase() === normEmail) return json({ error: "cannot_invite_self" }, 400);

    const { data: owner } = await svc.from("profiles").select("name").eq("id", user.id).single();
    const ownerName = owner?.name ?? "um criador";

    // Existe?
    const { data: list } = await svc.auth.admin.listUsers();
    const existing = list?.users?.find((u) => u.email?.toLowerCase() === normEmail);

    // Gera o link conforme o caso (origin validado, nunca o header cru F13)
    const origin = resolveAppUrl(req);
    const redirectTo = origin + "/app";
    const type: "magiclink" | "invite" = existing ? "magiclink" : "invite";
    const { data: linkData, error: linkErr } = await svc.auth.admin.generateLink({
      type,
      email: normEmail,
      options: { redirectTo },
    });
    if (linkErr || !linkData?.properties?.action_link || !linkData.user) {
      console.error("[account-invite] generateLink failed:", linkErr);
      return json({ error: "link_failed" }, 400);
    }
    // Link branded do CRIA (não expõe supabase.co).
    const hashed = linkData.properties.hashed_token;
    const actionLink = hashed
      ? `${origin}/ativar?th=${hashed}&type=${type}&to=${encodeURIComponent("/app")}`
      : linkData.properties.action_link;
    const targetUser = linkData.user;

    // Vincula o gerente à conta do dono. Status já 'active': clicar no link é a ativação.
    await svc.from("account_members").upsert({
      owner_id: user.id,
      member_email: normEmail,
      member_id: targetUser.id,
      status: "active",
      role: "manager",
      accepted_at: new Date().toISOString(),
    }, { onConflict: "owner_id,member_email" });

    /* O CONVITE PARAVA NO MEIO (bug do Walter, 01/09): o vínculo entrava em
       account_members (a social mídia ganhava o ACESSO), mas a tela Clientes
       dela lê o CRM (crm_clients), e nenhuma ficha era criada. A Gabi aceitou
       o convite e "não caiu o Cria" pra ela. Agora o convite entrega a ficha:
       reaproveita uma ficha solta com o mesmo e-mail (sem duplicar, mesma
       regra do Importar do Cria) ou cria uma nova já com o vínculo. */
    try {
      const { data: fichaLigada } = await svc.from("crm_clients")
        .select("id")
        .eq("manager_id", targetUser.id)
        .eq("cria_owner_id", user.id)
        .limit(1).maybeSingle();
      if (!fichaLigada) {
        const ownerEmail = user.email?.toLowerCase() ?? "";
        const { data: soltas } = await svc.from("crm_clients")
          .select("id, email")
          .eq("manager_id", targetUser.id)
          .is("cria_owner_id", null)
          .is("deleted_at", null)
          .limit(200);
        const candidata = (soltas ?? []).find(
          (f) => !!ownerEmail && String(f.email ?? "").trim().toLowerCase() === ownerEmail,
        );
        if (candidata) {
          await svc.from("crm_clients").update({ cria_owner_id: user.id }).eq("id", candidata.id);
        } else {
          await svc.from("crm_clients").insert({
            manager_id: targetUser.id,
            cria_owner_id: user.id,
            name: ownerName,
            email: user.email ?? null,
          });
        }
      }
    } catch (e) {
      // A ficha é conveniência; o acesso já está de pé. Se o CRM falhar, o
      // convite segue e a social mídia ainda pode usar o "Importar do Cria".
      console.error("[account-invite] ficha do CRM falhou:", e);
    }

    // Se for usuário novo (recém-criado pelo invite), marca como social media
    // e pula o fluxo de criadora (onboarding, trial, plano).
    if (!existing) {
      await svc.from("profiles").update({
        account_type: "manager",
        onboarding_completed: true,
        must_change_password: true,
        trial_started_at: null,
        trial_ends_at: null,
        plan: "manager",
        subscription_status: null,
      }).eq("id", targetUser.id);
    }

    const html = emailHtml({
      title: "Você foi convidado",
      paragraph: `${escapeHtml(ownerName)} convidou você para gerenciar a conta dele(a) no cria como social media. Clique no botão abaixo para acessar, você define sua senha e já entra direto.`,
      buttonLabel: "Aceitar convite e acessar",
      actionLink,
      secondary: "Depois de entrar, selecione o cliente no seletor de contas no topo.",
    });
    const messageId = crypto.randomUUID();
    const unsubscribeToken = await ensureUnsubscribeToken(svc, normEmail);
    await svc.rpc("enqueue_email", {
      queue_name: "transactional_emails",
      payload: {
        to: normEmail,
        subject: `${ownerName} convidou você para gerenciar uma conta no cria`,
        from: "cria <noreply@criasocialclub.com.br>",
        sender_domain: "notify.criasocialclub.com.br",
        purpose: "transactional",
        html,
        text: `${ownerName} convidou você para gerenciar a conta dele(a) no cria. Acesse: ${actionLink}`,
        label: existing ? "manager_invite_existing" : "manager_invite_new",
        idempotency_key: messageId,
        unsubscribe_token: unsubscribeToken,
        message_id: messageId,
        queued_at: new Date().toISOString(),
      },
    });

    return json({ ok: true, status: "active" });
  } catch (e) {
    console.error("[account-invite] unhandled error:", e);
    return json({ error: "internal_error" }, 500);
  }
});
