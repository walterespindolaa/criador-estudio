import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient, SupabaseClient } from "npm:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

const DEFAULT_MODULES = ["cria_post", "cria_gestao", "hub_cria", "agenda"];

// Escapa valores interpolados no HTML do e-mail (nome da agência etc.). (F12/F24)
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

function emailHtml(opts: { managerName: string; actionLink: string }): string {
  // Rodapé com o logo (e não com a palavra "cria" escrita).
  // Cuidados de e-mail: Gmail e Outlook bloqueiam imagem por padrão, então a URL
  // é absoluta e pública, width/height vão como ATRIBUTO (o Outlook ignora só o
  // CSS) e o alt="cria" segura a assinatura quando a imagem não carrega. O
  // endereço embaixo é texto de verdade, nunca some.
  return `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif;color:#1f2937">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="padding:32px 16px"><tr><td align="center">
    <table role="presentation" width="480" cellpadding="0" cellspacing="0" border="0" style="max-width:480px;width:100%;background:#fff;border-radius:16px;padding:40px 32px;box-shadow:0 1px 3px rgba(0,0,0,0.05)"><tr><td>
      <h1 style="margin:0 0 16px 0;font-size:22px;font-weight:700;color:#111827;line-height:1.3">Você foi adicionado à equipe</h1>
      <p style="margin:0 0 28px 0;font-size:15px;line-height:1.55;color:#4b5563">${escapeHtml(opts.managerName)} te convidou pra colaborar no cria. Clique pra acessar e definir sua senha, você já entra direto na conta da agência pra trabalhar.</p>
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 20px 0"><tr><td style="border-radius:12px;background:#8B5CF6">
        <a href="${opts.actionLink}" style="display:inline-block;padding:12px 24px;color:#fff;font-size:15px;font-weight:600;text-decoration:none;border-radius:12px">Acessar a equipe</a>
      </td></tr></table>
      <p style="margin:0;font-size:13px;line-height:1.5;color:#9ca3af">Se o botão não funcionar, copie: <span style="word-break:break-all;color:#6b7280">${opts.actionLink}</span></p>
    </td></tr></table>
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin:24px auto 0"><tr><td align="center" style="font-family:system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif"><a href="https://criasocialclub.com.br" target="_blank" style="text-decoration:none"><img src="https://app.criasocialclub.com.br/logo-cria.png" width="104" height="57" alt="cria" style="display:block;border:0;outline:none;text-decoration:none;width:104px;height:57px;font-size:12px;color:#9ca3af" /></a><div style="margin:6px 0 0 0;font-size:12px;color:#9ca3af">criasocialclub.com.br</div></td></tr></table>
  </td></tr></table>
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

    const body = await req.json().catch(() => ({}));
    const { email, name, modules, all_clients, client_ids } = body as {
      email?: string; name?: string; modules?: string[]; all_clients?: boolean; client_ids?: string[];
    };
    if (!email) return json({ error: "missing_email" }, 400);

    const normEmail = String(email).trim().toLowerCase();
    if (normEmail === user.email.toLowerCase()) return json({ error: "cannot_invite_self" }, 400);

    // ── Checa assento: 1 grátis + paid_collab_seats. Conta membros ATIVOS atuais. ──
    const { data: prof } = await svc.from("profiles").select("name, paid_collab_seats").eq("id", user.id).maybeSingle();
    const paidSeats = Math.max(0, Number((prof as { paid_collab_seats?: number } | null)?.paid_collab_seats) || 0);
    const allowed = 1 + paidSeats;
    // Parceiro (designer, editor, copy, tráfego) NÃO consome assento: ele entra
    // de graça e só enxerga o card atribuído a ele. Quem precisa de CRM,
    // financeiro e carteira continua sendo colaborador e continua custando.
    // São públicos diferentes, não dois preços pro mesmo acesso.
    const { count: activeCount } = await svc.from("manager_members")
      .select("id", { count: "exact", head: true })
      .eq("manager_id", user.id).eq("status", "ativo")
      .not("role", "in", "(designer,editor_video,copy,trafego)");
    if ((activeCount ?? 0) >= allowed) {
      return json({ error: "no_seats", allowed, used: activeCount ?? 0 }, 402);
    }

    // ── Já existe conta com esse email? magic link : convite ──
    const { data: list } = await svc.auth.admin.listUsers();
    const existing = list?.users?.find((u) => u.email?.toLowerCase() === normEmail);

    const origin = resolveAppUrl(req); // F13: origin validado, não o header cru
    const type: "magiclink" | "invite" = existing ? "magiclink" : "invite";
    const { data: linkData, error: linkErr } = await svc.auth.admin.generateLink({
      type, email: normEmail, options: { redirectTo: origin + "/socialmidia/dashboard" },
    });
    if (linkErr || !linkData?.user) {
      console.error("[manager-member-invite] generateLink failed:", linkErr);
      return json({ error: "link_failed" }, 400);
    }
    const memberId = linkData.user.id;
    const hashed = linkData.properties?.hashed_token;
    const actionLink = hashed
      ? `${origin}/ativar?th=${hashed}&type=${type}&to=${encodeURIComponent("/socialmidia/dashboard")}`
      : (linkData.properties?.action_link ?? origin);

    // ── Vínculo + permissões default (todos os clientes nos módulos escolhidos) ──
    const { data: memberRow, error: mErr } = await svc.from("manager_members").upsert({
      manager_id: user.id, member_id: memberId, name: name ?? null, email: normEmail, status: "ativo",
    }, { onConflict: "manager_id,member_id" }).select("id").single();
    if (mErr || !memberRow) {
      console.error("[manager-member-invite] member upsert failed:", mErr);
      return json({ error: "member_link_failed" }, 500);
    }
    const mods = Array.isArray(modules) && modules.length ? modules : DEFAULT_MODULES;
    // Escopo de clientes: "todos" (all_clients) ou lista específica (client_ids). Mesmo escopo p/ todos os módulos.
    const allCli = all_clients !== false; // default = todos
    const cliIds = !allCli && Array.isArray(client_ids) ? client_ids.filter((x) => typeof x === "string") : [];
    const perms = mods.map((code) => ({
      member_row_id: (memberRow as { id: string }).id, module_code: code, all_clients: allCli, client_ids: cliIds,
    }));
    await svc.from("manager_member_permissions").upsert(perms, { onConflict: "member_row_id,module_code" });

    // ── Email de convite ──
    const managerName = (prof as { name?: string } | null)?.name ?? "Sua agência";
    const messageId = crypto.randomUUID();
    const unsub = await ensureUnsubscribeToken(svc, normEmail);
    await svc.rpc("enqueue_email", {
      queue_name: "transactional_emails",
      payload: {
        to: normEmail,
        subject: "Você foi adicionado a uma equipe no cria",
        from: "cria <noreply@criasocialclub.com.br>",
        sender_domain: "notify.criasocialclub.com.br",
        purpose: "transactional",
        html: emailHtml({ managerName, actionLink }),
        text: `${managerName} te adicionou à equipe no cria: ${actionLink}`,
        label: existing ? "team_invite_existing" : "team_invite_new",
        idempotency_key: messageId, unsubscribe_token: unsub, message_id: messageId,
        queued_at: new Date().toISOString(),
      },
    });

    return json({ ok: true, member_id: memberId, existed: !!existing });
  } catch (e) {
    console.error("[manager-member-invite] unhandled:", e);
    return json({ error: "internal_error" }, 500);
  }
});
