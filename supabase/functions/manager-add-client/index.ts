// Social mídia (manager) adiciona um cliente coberto pelos assentos da agência.
// Gated por seat_limit. Cria a conta de criadora, vincula e devolve link branded /ativar.
//
// ── POR QUE ESTA FUNÇÃO MEXE NO CRM ──
// Antes ela só criava a conta e ia embora. A ficha do cliente no CRM continuava
// sem saber que aquela conta existe, e o botão "Importar do Cria" (que só compara
// por cria_owner_id) criava uma SEGUNDA ficha com o mesmo nome. A gestora ficava
// com dois cards, dois financeiros e duas agendas do mesmo negócio, e as duas
// linhas ocupando vaga na carteira.
//
// Agora tem dois caminhos, e os dois terminam com UMA ficha só:
//   · crm_client_id veio → a ficha já existe, a gente só carimba cria_owner_id
//     nela (e completa o e-mail se estava vazio). Nada de linha nova.
//   · crm_client_id não veio → cria a conta E a ficha, já vinculadas.
// O trigger trg_crm_clients_guard_cria_owner deixa passar porque aqui é
// service_role (auth.uid() nulo).
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...cors, "Content-Type": "application/json" } });

// Rate limit por usuário/minuto via RPC existente. Fail-open: erro não bloqueia.
async function rateOk(svc: SupabaseClient, userId: string, scope: string, limit: number): Promise<boolean> {
  try {
    const windowKey = new Date().toISOString().slice(0, 16); // bucket por minuto
    const { data, error } = await svc.rpc("check_and_increment_rate_limit", {
      _user_id: userId, _scope: scope, _window_key: windowKey, _limit: limit,
    });
    if (error) return true;
    return data !== false;
  } catch { return true; }
}

async function ensureUnsubscribeToken(svc: SupabaseClient, email: string): Promise<string> {
  const token = crypto.randomUUID();
  await svc.from("email_unsubscribe_tokens").upsert({ email, token }, { onConflict: "email", ignoreDuplicates: true });
  const { data } = await svc.from("email_unsubscribe_tokens").select("token").eq("email", email).single();
  return (data?.token as string) ?? token;
}

// Escapa valores interpolados no HTML do e-mail (F12/F24): nome do usuário
// ou da agência não pode injetar markup no template.
function escapeHtml(v: unknown): string {
  return String(v ?? "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

// Origin confiável pro link (F13): APP_URL fixo ou allow-list, caindo no
// canônico. Nunca monta o link só com o header Origin cru.
const CANONICAL_APP_URL = "https://app.criasocialclub.com.br";
function resolveAppUrl(req: Request): string {
  const fixed = Deno.env.get("APP_URL");
  if (fixed) return fixed.replace(/\/+$/, "");
  const origin = req.headers.get("origin") ?? "";
  const allow = ["https://app.criasocialclub.com.br", "https://criasocialclub.com.br", "https://www.criasocialclub.com.br"];
  if (allow.includes(origin)) return origin;
  if (/^https:\/\/[a-z0-9-]+\.(lovableproject\.com|lovable\.app)$/.test(origin)) return origin;
  return CANONICAL_APP_URL;
}

function emailHtml(opts: { title: string; paragraph: string; actionLink: string }): string {
  // Rodapé com o logo (e não com a palavra "cria" escrita).
  // Cuidados de e-mail: Gmail e Outlook bloqueiam imagem por padrão, então a URL
  // é absoluta e pública, width/height vão como ATRIBUTO (o Outlook ignora só o
  // CSS) e o alt="cria" segura a assinatura quando a imagem não carrega. O
  // endereço embaixo é texto de verdade, nunca some.
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
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin:24px auto 0"><tr><td align="center" style="font-family:system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif"><a href="https://criasocialclub.com.br" target="_blank" style="text-decoration:none"><img src="https://app.criasocialclub.com.br/logo-cria.png" width="104" height="57" alt="cria" style="display:block;border:0;outline:none;text-decoration:none;width:104px;height:57px;font-size:12px;color:#9ca3af" /></a><div style="margin:6px 0 0 0;font-size:12px;color:#9ca3af">criasocialclub.com.br</div></td></tr></table>
    </td></tr></table>
  </td></tr></table>
</body></html>`;
}

async function sendClientInvite(svc: SupabaseClient, email: string, agencyName: string, actionLink: string) {
  const paragraph = `${escapeHtml(agencyName || "Sua social mídia")} criou sua conta no cria pra cuidar do seu conteúdo. Clique no botão pra acessar e definir sua senha.`;
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

    // Rate limit: no máx. 10 criações de cliente por minuto por manager.
    if (!(await rateOk(svc, user.id, "manager-add-client", 10))) {
      return json({ error: "rate_limited", message: "Muitas tentativas. Aguarde um minuto." }, 429);
    }

    // Caller precisa ser manager com assentos.
    const { data: caller } = await svc.from("profiles")
      .select("account_type, seat_limit, name").eq("id", user.id).single();
    if (caller?.account_type !== "manager") return json({ error: "forbidden_not_manager" }, 403);
    const seatLimit = Number(caller?.seat_limit ?? 0);
    if (seatLimit <= 0) return json({ error: "no_seats" }, 402);

    // Conta assentos usados (clientes cobertos por essa agência).
    // Cliente pausado NÃO ocupa assento: é a mesma regra da RPC agency_seats_used
    // que a tela usa. Sem o filtro, a tela mostrava "1 livre" e a chamada aqui
    // respondia "assentos esgotados".
    const { count: used } = await svc.from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("agency_owner_id", user.id)
      .is("parked_at", null);
    if ((used ?? 0) >= seatLimit) return json({ error: "seats_full", used, seatLimit }, 409);

    const body = await req.json().catch(() => ({}));
    const name = String(body?.name ?? "").trim();
    const email = String(body?.email ?? "").trim().toLowerCase();
    if (!name || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return json({ error: "missing_fields" }, 400);
    if (email === (user.email ?? "").toLowerCase()) return json({ error: "use_different_email" }, 400);

    // Ficha do CRM escolhida pela gestora (opcional). Valida ANTES de criar a
    // conta: recusar depois deixaria um login órfão no ar.
    const crmClientId = String(body?.crm_client_id ?? "").trim() || null;
    let crmEmailVazio = false;
    if (crmClientId) {
      const { data: ficha } = await svc.from("crm_clients")
        .select("id, email, cria_owner_id, manager_id, deleted_at")
        .eq("id", crmClientId).maybeSingle();
      const f = ficha as { email?: string | null; cria_owner_id?: string | null; manager_id?: string; deleted_at?: string | null } | null;
      if (!f || f.manager_id !== user.id || f.deleted_at) {
        return json({ error: "crm_client_not_found", message: "Não achei essa ficha na sua carteira." }, 404);
      }
      if (f.cria_owner_id) {
        return json({ error: "crm_client_already_linked", message: "Esse cliente já tem uma conta do Cria vinculada." }, 409);
      }
      crmEmailVazio = !String(f.email ?? "").trim();
    }

    const origin = resolveAppUrl(req);

    // SEGURANÇA (F2/F4/F5/F6/F7): este endpoint só cria conta NOVA. Se o e-mail já
    // tem conta no CRIA, NÃO degradamos pra magiclink nem devolvemos link/token de
    // uma conta que o chamador não possui, e NÃO reescrevemos plan/agency_owner_id/
    // must_change_password de perfil preexistente. Isso era takeover total.
    //
    // Detecção confiável: tentamos o invite (que cria o usuário). Se falhar porque
    // o e-mail já existe, confirmamos direto por e-mail (listUsers é paginado e não
    // confiável) e recusamos com mensagem clara.
    const { data: linkData, error: linkErr } = await svc.auth.admin.generateLink({
      type: "invite", email, options: { redirectTo: origin + "/app" },
    });
    if (linkErr || !linkData?.properties?.action_link || !linkData.user) {
      // O invite pode ter falhado porque a conta já existe. Confirma por e-mail.
      const { data: existingUid } = await svc.rpc("get_user_id_by_email", { _email: email });
      if (existingUid) {
        const { data: victim } = await svc.from("profiles")
          .select("agency_owner_id").eq("id", existingUid as string).maybeSingle();
        // Só informa "já é seu cliente" quando o chamador DE FATO possui a conta.
        if ((victim as { agency_owner_id?: string } | null)?.agency_owner_id === user.id) {
          return json({ error: "already_your_client", message: "Esse cliente já está vinculado à sua conta." }, 409);
        }
        // Conta de terceiro: recusa. Nunca devolve link/token de conta alheia.
        return json({
          error: "email_already_registered",
          message: "Esse e-mail já tem conta no CRIA. Peça pra pessoa aceitar o vínculo.",
        }, 409);
      }
      return json({ error: "link_failed" }, 400);
    }
    // Daqui pra baixo é SEMPRE conta nova criada por esta chamada.
    const creatorId = linkData.user.id;
    const hashed = linkData.properties.hashed_token;
    const inviteLink = hashed
      ? `${origin}/ativar?th=${hashed}&type=invite&to=${encodeURIComponent("/app")}`
      : linkData.properties.action_link;

    // Conta de criadora coberta pela agência (studio, acesso ativo, sem cobrança própria).
    // Seguro: creatorId é a conta recém-criada por esta chamada.
    await svc.from("profiles").update({
      name, plan: "studio", subscription_status: "active",
      agency_owner_id: user.id, must_change_password: true,
    }).eq("id", creatorId);

    // Vincula a social mídia como gestora.
    await svc.from("account_members").upsert({
      owner_id: creatorId, member_email: user.email, member_id: user.id,
      role: "manager", status: "active", accepted_at: new Date().toISOString(),
    }, { onConflict: "owner_id,member_email" });

    // ── A ficha do CRM ──
    // Best-effort de propósito: se der ruim aqui, a conta do cliente já existe e
    // funciona. Devolvemos o motivo pra tela avisar em vez de fingir sucesso.
    let crmStatus: "vinculado" | "criado" | "carteira_cheia" | "falhou" = "falhou";
    try {
      if (crmClientId) {
        const patch: Record<string, unknown> = { cria_owner_id: creatorId };
        if (crmEmailVazio) patch.email = email;
        const { error } = await svc.from("crm_clients").update(patch).eq("id", crmClientId);
        crmStatus = error ? "falhou" : "vinculado";
        if (error) console.error("[manager-add-client] crm link failed:", error);
      } else {
        const { error } = await svc.from("crm_clients")
          .insert({ manager_id: user.id, cria_owner_id: creatorId, name, email });
        if (!error) crmStatus = "criado";
        else {
          crmStatus = /limite_clientes_atingido/.test(error.message ?? "") ? "carteira_cheia" : "falhou";
          console.error("[manager-add-client] crm insert failed:", error);
        }
      }
    } catch (e) { console.error("[manager-add-client] crm step threw:", e); }

    // E-mail automático pro cliente (best-effort, não bloqueia a resposta).
    try { await sendClientInvite(svc, email, String(caller?.name ?? ""), inviteLink); }
    catch (e) { console.error("[manager-add-client] email enqueue failed:", e); }

    return json({ ok: true, email, inviteLink, used: (used ?? 0) + 1, seatLimit, crmStatus });
  } catch (e) {
    console.error("[manager-add-client] error:", e);
    return json({ error: "internal_error" }, 500);
  }
});
