import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

function tempPassword(): string {
  const all = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%&*";
  const buf = new Uint32Array(14); crypto.getRandomValues(buf);
  let out = ""; for (let i = 0; i < 14; i++) out += all[buf[i] % all.length]; return out;
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
    const { email, name } = await req.json();
    if (!email) return json({ error: "missing_email" }, 400);
    const normEmail = String(email).trim().toLowerCase();

    // Dono não pode se convidar
    if (user.email?.toLowerCase() === normEmail) return json({ error: "cannot_invite_self" }, 400);

    const { data: owner } = await svc.from("profiles").select("name").eq("id", user.id).single();

    // Já existe usuário com esse e-mail?
    const { data: list } = await svc.auth.admin.listUsers();
    const existing = list?.users?.find((u) => u.email?.toLowerCase() === normEmail);

    // Upsert do vínculo
    const memberId = existing?.id ?? null;
    const status = existing ? "active" : "pending";
    await svc.from("account_members").upsert({
      owner_id: user.id, member_email: normEmail, member_id: memberId,
      status, role: "manager", accepted_at: existing ? new Date().toISOString() : null,
    }, { onConflict: "owner_id,member_email" });

    const loginUrl = (req.headers.get("origin") ?? "https://app.criasocialclub.com.br") + "/login";

    if (!existing) {
      // Cria conta do gerente com senha provisória (primeiro acesso)
      const pwd = tempPassword();
      const { data: created } = await svc.auth.admin.createUser({
        email: normEmail, password: pwd, email_confirm: true,
        user_metadata: { name: name ?? "Social Media" },
      });
      if (created?.user) {
        await svc.from("profiles").update({ must_change_password: true }).eq("id", created.user.id);
        // Liga o vínculo pendente ao usuário recém-criado (handle_new_user também faz, mas garantimos)
        await svc.from("account_members").update({ member_id: created.user.id, status: "active", accepted_at: new Date().toISOString() })
          .eq("owner_id", user.id).eq("member_email", normEmail);
      }
      const html = inviteHtml({ ownerName: owner?.name ?? "um criador", email: normEmail, pwd, loginUrl });
      await svc.rpc("enqueue_email", { queue_name: "transactional_emails", payload: {
        to: normEmail, subject: `${owner?.name ?? "Um criador"} convidou você para gerenciar a conta`,
        html, text: `Você foi convidado. Acesse ${loginUrl} com ${normEmail} e senha provisória ${pwd}.`,
        label: "manager_invite_new", message_id: crypto.randomUUID(), queued_at: new Date().toISOString() } });
    } else {
      const html = inviteExistingHtml({ ownerName: owner?.name ?? "um criador", loginUrl });
      await svc.rpc("enqueue_email", { queue_name: "transactional_emails", payload: {
        to: normEmail, subject: `Você agora gerencia a conta de ${owner?.name ?? "um criador"}`,
        html, text: `Você foi adicionado como social media. Acesse ${loginUrl} e selecione a conta.`,
        label: "manager_invite_existing", message_id: crypto.randomUUID(), queued_at: new Date().toISOString() } });
    }

    return json({ ok: true, status });
  } catch (e) {
    console.error("[account-invite] unhandled error:", e);
    return json({ error: "internal_error" }, 500);
  }
});

function inviteHtml(p: { ownerName: string; email: string; pwd: string; loginUrl: string }) {
  return `<!doctype html><html><body style="font-family:system-ui,Arial,sans-serif;color:#1f2937">
  <h2>${p.ownerName} convidou você como social media</h2>
  <p>Crie seu acesso ao cria para gerenciar a conta dele(a):</p>
  <p><b>E-mail:</b> ${p.email}<br/><b>Senha provisória:</b> <code>${p.pwd}</code></p>
  <p><a href="${p.loginUrl}" style="display:inline-block;background:#C4622D;color:#fff;padding:10px 18px;border-radius:10px;text-decoration:none">Acessar</a></p>
  <p style="color:#6b7280;font-size:13px">No primeiro acesso você troca a senha. Depois é só selecionar o cliente.</p>
  </body></html>`;
}
function inviteExistingHtml(p: { ownerName: string; loginUrl: string }) {
  return `<!doctype html><html><body style="font-family:system-ui,Arial,sans-serif;color:#1f2937">
  <h2>Novo cliente liberado</h2>
  <p>Você foi adicionado como social media da conta de <b>${p.ownerName}</b>.</p>
  <p><a href="${p.loginUrl}" style="display:inline-block;background:#C4622D;color:#fff;padding:10px 18px;border-radius:10px;text-decoration:none">Abrir cria</a> e selecione o cliente no seletor de contas.</p>
  </body></html>`;
}
