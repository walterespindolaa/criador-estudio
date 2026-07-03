import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient, SupabaseClient } from "npm:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

const VALIDITY_DAYS: Record<string, number | null> = {
  "15d": 15, "1m": 30, "3m": 90, "6m": 180, "1y": 365, "lifetime": null,
};

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

    const body = await req.json();
    const { user_id, action } = body as { user_id?: string; action?: string };

    // Batch: emails dos usuários (auth) para o painel admin
    if (action === "get_emails") {
      const ids = ((body as { user_ids?: string[] }).user_ids ?? []).slice(0, 200);
      const emails: Record<string, string> = {};
      for (const id of ids) {
        const { data } = await svc.auth.admin.getUserById(id);
        if (data?.user?.email) emails[id] = data.user.email;
      }
      return json({ emails });
    }

    if (!user_id || !action) return json({ error: "missing_fields" }, 400);

    // Auto-proteção: admin não pode mexer/excluir a si mesmo (exceto reenviar próprio acesso)
    if (action !== "resend_access" && user_id === user.id) {
      return json({ error: "Você não pode alterar/excluir a própria conta admin." }, 400);
    }

    // Confirma que o alvo existe
    const { data: target } = await svc.from("profiles").select("id, plan, subscription_status").eq("id", user_id).single();
    if (!target) return json({ error: "user_not_found" }, 404);

    console.log("[admin-user-actions]", { action, user_id, caller: user.id });

    if (action === "set_validity") {
      const validity = (body as { validity?: string }).validity;
      const key = typeof validity === "string" && validity in VALIDITY_DAYS ? validity : "lifetime";
      const days = VALIDITY_DAYS[key];
      const access_expires_at = days === null ? null : new Date(Date.now() + days * 86400000).toISOString();
      const patch: Record<string, unknown> = { access_expires_at };
      if (["pro", "studio"].includes(target.plan ?? "") && target.subscription_status !== "active") {
        patch.subscription_status = "active";
      }
      console.log("[admin-user-actions] set_validity patch:", JSON.stringify(patch));
      const { error } = await svc.from("profiles").update(patch).eq("id", user_id);
      if (error) {
        console.error("[admin-user-actions] set_validity failed:", error);
        return json({ error: "update_failed" }, 500);
      }
      return json({ ok: true, access_expires_at });
    }

    if (action === "suspend") {
      const { error } = await svc.from("profiles").update({ subscription_status: "suspended" }).eq("id", user_id);
      if (error) { console.error("[admin-user-actions] suspend failed:", error); return json({ error: "update_failed" }, 500); }
      return json({ ok: true, subscription_status: "suspended" });
    }

    if (action === "reactivate") {
      const { error } = await svc.from("profiles").update({ subscription_status: "active" }).eq("id", user_id);
      if (error) { console.error("[admin-user-actions] reactivate failed:", error); return json({ error: "update_failed" }, 500); }
      return json({ ok: true, subscription_status: "active" });
    }

    if (action === "delete") {
      const { error } = await svc.auth.admin.deleteUser(user_id);
      if (error) {
        console.error("[admin-user-actions] delete failed:", error);
        return json({ error: "delete_failed" }, 500);
      }
      return json({ ok: true });
    }

    // Limpar conta: apaga TODO o conteúdo do usuário (posts, ideias, CRM, clientes,
    // cronograma, media kit, bio, hábitos, metas, personas, pilares, arquivos…) mas
    // MANTÉM a conta: login, plano, assinatura, cobrança, conexões (IG/Drive), push
    // e vínculos de agência. A função SQL descobre as tabelas em runtime.
    if (action === "wipe_data") {
      const { data: wiped, error } = await (svc.rpc as unknown as (
        fn: string, args: unknown,
      ) => Promise<{ data: unknown; error: unknown }>)(
        "admin_wipe_user_content", { _user_id: user_id },
      );
      if (error) {
        console.error("[admin-user-actions] wipe_data failed:", error);
        return json({ error: "wipe_failed" }, 500);
      }
      console.log("[admin-user-actions] wipe_data ok:", JSON.stringify(wiped));
      return json({ ok: true, result: wiped });
    }

    // Muda o plano do usuário (upgrade PF) e ativa se for plano pago.
    if (action === "set_plan") {
      const plan = String((body as { plan?: string }).plan ?? "");
      if (!["free", "trial", "pro", "studio", "agency"].includes(plan)) return json({ error: "invalid_plan" }, 400);
      const patch: Record<string, unknown> = { plan };
      if (["pro", "studio", "agency"].includes(plan)) patch.subscription_status = "active";
      const { error } = await svc.from("profiles").update(patch).eq("id", user_id);
      if (error) { console.error("[admin-user-actions] set_plan failed:", error); return json({ error: "update_failed" }, 500); }
      return json({ ok: true, plan });
    }

    // Lista os módulos + os que o usuário já tem ativos (pros toggles do admin).
    if (action === "get_modules") {
      const [{ data: mods }, { data: ent }] = await Promise.all([
        svc.from("modules").select("code, name, coming_soon").order("sort_order"),
        svc.from("module_entitlements").select("module_code, status").eq("manager_id", user_id),
      ]);
      const active = (ent ?? []).filter((e: { status?: string }) => e.status === "active").map((e: { module_code: string }) => e.module_code);
      return json({ modules: mods ?? [], active });
    }

    // Liga/desliga um módulo (add-on) pra conta.
    if (action === "set_module") {
      const moduleCode = String((body as { module_code?: string }).module_code ?? "");
      const enabled = (body as { enabled?: boolean }).enabled === true;
      if (!moduleCode) return json({ error: "missing_module" }, 400);
      const { data: ex } = await svc.from("module_entitlements").select("id").eq("manager_id", user_id).eq("module_code", moduleCode).maybeSingle();
      if (enabled) {
        if (ex) await svc.from("module_entitlements").update({ status: "active", updated_at: new Date().toISOString() }).eq("id", (ex as { id: string }).id);
        else await svc.from("module_entitlements").insert({ manager_id: user_id, module_code: moduleCode, status: "active" });
      } else if (ex) {
        await svc.from("module_entitlements").delete().eq("id", (ex as { id: string }).id);
      }
      return json({ ok: true, module_code: moduleCode, enabled });
    }

    if (action === "resend_access") {
      const { data: userData, error: getErr } = await svc.auth.admin.getUserById(user_id);
      if (getErr || !userData?.user?.email) {
        console.error("[admin-user-actions] getUserById failed:", getErr);
        return json({ error: "user_email_not_found" }, 404);
      }
      const email = userData.user.email;

      const origin = req.headers.get("origin") ?? "https://app.criasocialclub.com.br";
      const redirectTo = origin + "/app/trocar-senha";
      const { data: linkData, error: linkErr } = await svc.auth.admin.generateLink({
        type: "recovery",
        email,
        options: { redirectTo },
      });
      if (linkErr || !linkData?.properties?.action_link) {
        console.error("[admin-user-actions] generateLink failed:", linkErr);
        return json({ error: "link_failed" }, 500);
      }
      // Link branded do CRIA (não expõe supabase.co).
      const hashed = linkData.properties.hashed_token;
      const actionLink = hashed
        ? `${origin}/ativar?th=${hashed}&type=recovery&to=${encodeURIComponent("/app/trocar-senha")}`
        : linkData.properties.action_link;

      const html = emailHtml({
        title: "Redefina sua senha",
        paragraph: "O administrador do cria gerou um link para você definir uma nova senha. Clique no botão abaixo para continuar.",
        buttonLabel: "Definir nova senha",
        actionLink,
        secondary: `Se o botão não funcionar, copie e cole este link no navegador:<br/><span style="word-break:break-all;color:#6b7280">${actionLink}</span>`,
      });
      const messageId = crypto.randomUUID();
      const unsubscribeToken = await ensureUnsubscribeToken(svc, email);
      await svc.rpc("enqueue_email", {
        queue_name: "transactional_emails",
        payload: {
          to: email, subject: "Redefinir senha do cria",
          from: "cria <noreply@criasocialclub.com.br>",
          sender_domain: "notify.criasocialclub.com.br",
          purpose: "transactional",
          html, text: `Redefina sua senha: ${actionLink}`,
          label: "admin_resend_access", idempotency_key: messageId, unsubscribe_token: unsubscribeToken,
          message_id: messageId, queued_at: new Date().toISOString(),
        },
      });
      return json({ ok: true, email });
    }

    return json({ error: "unknown_action" }, 400);
  } catch (e) {
    console.error("[admin-user-actions] unhandled error:", e);
    return json({ error: "internal_error" }, 500);
  }
});
