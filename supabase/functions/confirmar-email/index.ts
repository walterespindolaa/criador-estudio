// ============================================================
// CONFIRMAÇÃO DE E-MAIL DO CRIA (12/11/2026)
//
// Antes: a conta só nascia com login depois do clique no e-mail do Supabase.
// Quem não clicava nunca entrava (3 de 4 criadores perdidos em 60 dias).
// Agora a pessoa cadastra, entra e usa. A confirmação vira um e-mail nosso,
// pela mesma fila de todos os outros, e o app cobra a partir do 4º dia.
//
// Ações (POST, JSON):
//   { action: "enviar" }                  logado. Manda (ou reenvia) o e-mail.
//   { action: "corrigir", email: "..." }  logado e ainda sem confirmar. Troca
//                                         o e-mail da conta e manda de novo.
//   { action: "confirmar", token: "..." } sem login. Vem do botão da página
//                                         /email/confirmar (nunca do clique no
//                                         link: antivírus abre link sozinho).
//
// A tabela email_confirmacao não tem política nenhuma: só esta função (service
// role) escreve nela. O app lê o estado pela RPC email_confirmacao_status().
// ============================================================
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { molduraCria, REMETENTE_CRIA } from "../_shared/email-moldura.ts";
import { createClient, SupabaseClient } from "npm:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

const CANONICAL_APP_URL = "https://app.criasocialclub.com.br";
function resolveAppUrl(req: Request): string {
  const fixed = Deno.env.get("APP_URL");
  if (fixed) return fixed.replace(/\/+$/, "");
  const origin = req.headers.get("origin") ?? "";
  if (origin === CANONICAL_APP_URL) return origin;
  return CANONICAL_APP_URL;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

async function ensureUnsubscribeToken(svc: SupabaseClient, email: string): Promise<string> {
  const token = crypto.randomUUID();
  await svc.from("email_unsubscribe_tokens").upsert({ email, token }, { onConflict: "email", ignoreDuplicates: true });
  const { data } = await svc.from("email_unsubscribe_tokens").select("token").eq("email", email).single();
  return (data?.token as string) ?? token;
}

// Freio no banco. Erro no freio = deixa passar (melhor mandar o e-mail).
async function passou(svc: SupabaseClient, chave: string, limite: number): Promise<boolean> {
  try {
    const { data } = await svc.rpc("rate_touch_janela", { _key: chave, _limit: limite, _segundos: 3600 });
    return data !== false;
  } catch { return true; }
}

async function mandar(svc: SupabaseClient, email: string, link: string) {
  const messageId = crypto.randomUUID();
  const unsub = await ensureUnsubscribeToken(svc, email);
  await svc.rpc("enqueue_email", {
    queue_name: "transactional_emails",
    payload: {
      to: email,
      subject: "Confirme seu e-mail no Cria",
      from: REMETENTE_CRIA,
      sender_domain: "notify.criasocialclub.com.br",
      purpose: "transactional",
      html: molduraCria({
        tag: "Conta", tema: "laranja", titulo: "Confirme seu e-mail",
        corpoHtml: "Sua conta no Cria já está funcionando. Falta só confirmar que este e-mail é seu: é por ele que você recupera a senha e recebe os avisos da conta.",
        botao: { texto: "Confirmar meu e-mail", url: link }, linkReserva: true,
        notaHtml: "Se não foi você que criou a conta, ignore este e-mail.",
      }),
      text: `Confirme seu e-mail no Cria: ${link}`,
      label: "email_confirmacao",
      idempotency_key: messageId, unsubscribe_token: unsub, message_id: messageId,
      queued_at: new Date().toISOString(),
    },
  });
}

type Linha = { user_id: string; email: string; token: string; envios: number; confirmado_em: string | null };

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ ok: false }, 405);
  try {
    const body = (await req.json().catch(() => ({}))) as { action?: string; token?: string; email?: string };
    const svc = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const ip = (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() || "sem-ip";

    // ── Confirmar: sem login, só o token do e-mail ──
    if (body.action === "confirmar") {
      const token = String(body.token ?? "");
      if (!UUID.test(token)) return json({ ok: false, motivo: "invalido" });
      if (!(await passou(svc, `confirma:ip:${ip}`, 30))) return json({ ok: false, motivo: "muitas" });
      const { data: linha } = await svc.from("email_confirmacao").select("user_id, confirmado_em").eq("token", token).maybeSingle();
      if (!linha) return json({ ok: false, motivo: "invalido" });
      if (!linha.confirmado_em) {
        await svc.from("email_confirmacao").update({ confirmado_em: new Date().toISOString() }).eq("token", token);
      }
      return json({ ok: true });
    }

    // ── Daqui pra baixo, só logado ──
    const jwt = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
    const { data: quem } = jwt ? await svc.auth.getUser(jwt) : { data: { user: null } };
    const user = quem?.user;
    if (!user?.email) return json({ ok: false, motivo: "sem_login" }, 401);

    const { data: atual } = await svc.from("email_confirmacao").select("user_id, email, token, envios, confirmado_em").eq("user_id", user.id).maybeSingle();
    const linha = atual as Linha | null;
    if (linha?.confirmado_em) return json({ ok: true, confirmado: true });

    /* Conta que não nasceu pelo cadastro novo (criada pelo admin, pela agência,
       ou antiga) não entra nessa fila: nunca foi pedido a ela e não é agora que
       um clique perdido vai travar o acesso. */
    const marcada = (user.user_metadata as { confirmar_email?: string } | null)?.confirmar_email === "1";
    if (!linha && !marcada) return json({ ok: true, confirmado: true });

    const origin = resolveAppUrl(req);

    if (body.action === "enviar") {
      if (!(await passou(svc, `confirma:user:${user.id}`, 4))) return json({ ok: false, motivo: "muitas" });
      const email = user.email.toLowerCase();
      const token = linha && linha.email === email ? linha.token : crypto.randomUUID();
      const { error } = await svc.from("email_confirmacao").upsert({
        user_id: user.id, email, token, enviado_em: new Date().toISOString(), envios: (linha?.envios ?? 0) + 1,
      }, { onConflict: "user_id" });
      if (error) { console.error("[confirmar-email] upsert:", error.message); return json({ ok: false, motivo: "erro" }); }
      await mandar(svc, email, `${origin}/email/confirmar?t=${token}`);
      return json({ ok: true, email });
    }

    if (body.action === "corrigir") {
      const novo = String(body.email ?? "").trim().toLowerCase();
      if (!EMAIL.test(novo) || novo.length > 254) return json({ ok: false, motivo: "email_invalido" });
      if (novo === user.email.toLowerCase()) return json({ ok: false, motivo: "igual" });
      if (!(await passou(svc, `confirma:troca:${user.id}`, 3))) return json({ ok: false, motivo: "muitas" });
      /* Só troca enquanto NÃO confirmou (checado acima). É o mesmo que a pessoa
         ter digitado certo no cadastro; e-mail que já tem conta é recusado pelo
         próprio Auth. */
      const { error: eTroca } = await svc.auth.admin.updateUserById(user.id, { email: novo, email_confirm: true });
      if (eTroca) {
        const m = (eTroca.message || "").toLowerCase();
        return json({ ok: false, motivo: m.includes("already") || m.includes("registered") || m.includes("exists") ? "em_uso" : "erro" });
      }
      const token = crypto.randomUUID();
      const { error } = await svc.from("email_confirmacao").upsert({
        user_id: user.id, email: novo, token, enviado_em: new Date().toISOString(), envios: (linha?.envios ?? 0) + 1,
      }, { onConflict: "user_id" });
      if (error) { console.error("[confirmar-email] upsert troca:", error.message); return json({ ok: false, motivo: "erro" }); }
      await mandar(svc, novo, `${origin}/email/confirmar?t=${token}`);
      return json({ ok: true, email: novo });
    }

    return json({ ok: false, motivo: "acao" }, 400);
  } catch (e) {
    console.error("[confirmar-email] unhandled:", e);
    return json({ ok: false, motivo: "erro" });
  }
});
