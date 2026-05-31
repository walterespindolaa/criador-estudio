import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

function tempPassword(): string {
  const A = "ABCDEFGHJKLMNPQRSTUVWXYZ", a = "abcdefghijkmnpqrstuvwxyz", n = "23456789", s = "!@#$%&*";
  const all = A + a + n + s; const buf = new Uint32Array(14); crypto.getRandomValues(buf);
  let out = A[buf[0] % A.length] + a[buf[1] % a.length] + n[buf[2] % n.length] + s[buf[3] % s.length];
  for (let i = 4; i < 14; i++) out += all[buf[i] % all.length];
  return out;
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

    // 1) Caller precisa ser admin (checado no servidor, nunca confiar no client)
    const { data: caller } = await svc.from("profiles").select("role").eq("id", user.id).single();
    if (caller?.role !== "admin") return json({ error: "forbidden" }, 403);

    const { name, email, phone, plan } = await req.json();
    if (!email || !name) return json({ error: "missing_fields" }, 400);
    const validPlans = ["free", "pro", "premium", "trial"];
    const chosenPlan = validPlans.includes(plan) ? plan : "trial";

    // 2) Cria usuário no auth com senha provisória
    const pwd = tempPassword();
    const { data: created, error: cErr } = await svc.auth.admin.createUser({
      email, password: pwd, email_confirm: true,
      user_metadata: { name },
    });
    if (cErr || !created.user) {
      console.error("[admin-create-user] createUser failed:", cErr);
      return json({ error: "create_failed" }, 400);
    }
    const newId = created.user.id;

    // 3) Ajusta o profile DEPOIS dos triggers (o trigger de trial seta plan='trial';
    //    aqui sobrescrevemos com o plano escolhido pelo admin)
    const patch: Record<string, unknown> = { name, phone: phone ?? null, plan: chosenPlan, must_change_password: true };
    if (["pro", "premium"].includes(chosenPlan)) {
      patch.subscription_status = "active"; // acesso liberado (cortesia/manual)
    }
    await svc.from("profiles").update(patch).eq("id", newId);

    // 4) Enfileira e-mail com credenciais provisórias
    const loginUrl = (req.headers.get("origin") ?? "https://app.criasocialclub.com.br") + "/login";
    const html = credentialsEmailHtml({ name, email, pwd, loginUrl });
    await svc.rpc("enqueue_email", {
      queue_name: "transactional_emails",
      payload: {
        to: email, subject: "Seu acesso ao cria",
        from: "cria <noreply@criasocialclub.com.br>",
        sender_domain: "notify.criasocialclub.com.br",
        purpose: "transactional",
        html, text: `Olá ${name}. Acesse ${loginUrl} com e-mail ${email} e senha provisória ${pwd}.`,
        label: "admin_invite", message_id: crypto.randomUUID(), queued_at: new Date().toISOString(),
      },
    });

    // 5) Retorna credenciais para o popup do admin (senha provisória mostrada 1x)
    return json({ ok: true, email, tempPassword: pwd, loginUrl, userId: newId });
  } catch (e) {
    console.error("[admin-create-user] unhandled error:", e);
    return json({ error: "internal_error" }, 500);
  }
});

function credentialsEmailHtml(p: { name: string; email: string; pwd: string; loginUrl: string }): string {
  return `<!doctype html><html><body style="font-family:system-ui,Arial,sans-serif;color:#1f2937">
  <h2>Bem-vindo(a) ao cria, ${p.name}!</h2>
  <p>Sua conta foi criada. Use as credenciais provisórias abaixo no primeiro acesso:</p>
  <p><b>E-mail:</b> ${p.email}<br/><b>Senha provisória:</b> <code>${p.pwd}</code></p>
  <p><a href="${p.loginUrl}" style="display:inline-block;background:#C4622D;color:#fff;padding:10px 18px;border-radius:10px;text-decoration:none">Entrar</a></p>
  <p style="color:#6b7280;font-size:13px">No primeiro login você será solicitado a trocar a senha.</p>
  </body></html>`;
}
