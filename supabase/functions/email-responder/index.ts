import { createClient } from "npm:@supabase/supabase-js@2";
import { REMETENTE_PESSOAL, RESPOSTAS_PARA } from "../_shared/enviar-email.ts";

/* ═══════════════════════════════════════════════════════════════════════════
   RESPONDER PELA CAIXA DO ADMIN (30/10/2026)

   POST { id, texto }. Só admin. Manda o texto como e-mail simples (sem a
   moldura: resposta de gente parece e-mail de gente), de "Gabi e Walter, do
   Cria", com reply-to na mesma caixa, então a conversa continua. Marca a
   resposta como respondida e guarda o que foi mandado.
   ═══════════════════════════════════════════════════════════════════════════ */

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const auth = req.headers.get("Authorization") ?? "";
    const quem = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: auth } } });
    const { data: u } = await quem.auth.getUser();
    if (!u?.user) return json({ error: "unauthorized" }, 401);
    const svc = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: p } = await svc.from("profiles").select("role").eq("id", u.user.id).single();
    if ((p as { role?: string } | null)?.role !== "admin") return json({ error: "forbidden" }, 403);

    const body = await req.json().catch(() => ({}));
    const id = typeof body?.id === "string" ? body.id : "";
    const texto = typeof body?.texto === "string" ? body.texto.trim().slice(0, 5000) : "";
    if (!id || texto.length < 2) return json({ error: "dados" }, 400);

    const { data: r } = await svc.from("email_respostas").select("id, de_email, assunto, status").eq("id", id).single();
    const resp = r as { id: string; de_email: string; assunto: string | null; status: string } | null;
    if (!resp) return json({ error: "nao_encontrada" }, 404);

    const assunto = resp.assunto ? (/^re:/i.test(resp.assunto) ? resp.assunto : `Re: ${resp.assunto}`) : "Resposta do Cria";
    const html = `<div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.6;color:#1E1A17;">${
      texto.split(/\n{2,}/).map((par) => `<p style="margin:0 0 14px;">${esc(par).replace(/\n/g, "<br>")}</p>`).join("")
    }</div>`;
    const mid = crypto.randomUUID();
    const { error } = await svc.rpc("enqueue_email", {
      queue_name: "transactional_emails",
      payload: {
        to: resp.de_email, subject: assunto.slice(0, 180), from: REMETENTE_PESSOAL(),
        ...(RESPOSTAS_PARA() ? { reply_to: RESPOSTAS_PARA() } : {}),
        sender_domain: "notify.criasocialclub.com.br", purpose: "transactional",
        html, text: texto, label: "resposta_admin", idempotency_key: mid, message_id: mid,
        queued_at: new Date().toISOString(),
      },
    });
    if (error) return json({ error: "fila", detalhe: error.message }, 500);

    await svc.from("email_respostas").update({
      status: "respondida", resposta: texto, respondido_em: new Date().toISOString(), respondido_por: u.user.id,
    }).eq("id", id);
    return json({ ok: true });
  } catch (e) {
    console.error("[email-responder]", e);
    return json({ error: "internal_error" }, 500);
  }
});
