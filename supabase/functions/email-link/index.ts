import { createClient } from "npm:@supabase/supabase-js@2";

/* ═══════════════════════════════════════════════════════════════════════════
   LINKS DE UM CLIQUE DOS E-MAILS (30/10/2026)

   Antivírus de e-mail (Outlook, Gmail corporativo) ABRE os links pra checar.
   Se o GET gravasse, todo motivo viraria "Ficou caro" (o primeiro link) e
   gente seria descadastrada sem clicar. Por isso:
     GET  ?a=m|s&t=..&m=..  só redireciona pra /email/pronto, que mostra o
                            que vai acontecer e tem o botão de confirmar;
     POST { t, m }          é o que grava (motivo ou "sair da lista");
     GET  ?a=c&t=..         confirmar e-mail: gera NA HORA um link de entrada
                            (que confirma o e-mail ao abrir) e redireciona.
                            Se um robô gastar um, o clique da pessoa gera outro.
   Nada de dado pessoal na URL: só o token.
   ═══════════════════════════════════════════════════════════════════════════ */

const APP = () => Deno.env.get("APP_URL") ?? "https://app.criasocialclub.com.br";
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const ir = (url: string) => new Response(null, { status: 302, headers: { Location: url, "Cache-Control": "no-store" } });
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MOTIVOS = ["caro", "sem_tempo", "faltou_funcao", "outra_ferramenta", "outro"];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const svc = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  try {
    if (req.method === "POST") {
      const b = await req.json().catch(() => ({}));
      const t = typeof b?.t === "string" ? b.t : "";
      const m = typeof b?.m === "string" && MOTIVOS.includes(b.m) ? b.m : null;
      if (!UUID.test(t)) return json({ r: "invalido" });
      const { data, error } = await svc.rpc("email_link_usar", { _token: t, _valor: m });
      if (error) { console.error("[email-link]", error.message); return json({ r: "invalido" }); }
      const r = String(data ?? "invalido");
      return json({ r: r === "saiu" || r === "obrigado" ? r : "invalido" });
    }
    if (req.method !== "GET") return json({ error: "method" }, 405);

    const u = new URL(req.url);
    const a = u.searchParams.get("a") ?? "";
    const t = u.searchParams.get("t") ?? "";
    const m = u.searchParams.get("m") ?? "";
    if (!UUID.test(t)) return ir(`${APP()}/email/pronto?r=invalido`);

    if (a === "m" || a === "s") {
      const q = new URLSearchParams({ a, t, ...(a === "m" && MOTIVOS.includes(m) ? { m } : {}) });
      return ir(`${APP()}/email/pronto?${q}`);
    }
    if (a === "c") {
      const { data } = await svc.rpc("email_link_usar", { _token: t, _valor: null });
      const r = String(data ?? "");
      if (!r.startsWith("confirmar:")) return ir(`${APP()}/email/pronto?r=invalido`);
      const { data: usr } = await svc.auth.admin.getUserById(r.slice("confirmar:".length));
      const email = usr?.user?.email;
      if (!email || usr.user.email_confirmed_at) return ir(`${APP()}/login`);
      const { data: link, error } = await svc.auth.admin.generateLink({ type: "magiclink", email, options: { redirectTo: `${APP()}/app` } });
      if (error || !link?.properties?.action_link) { console.error("[email-link] generateLink", error?.message); return ir(`${APP()}/login`); }
      return ir(link.properties.action_link);
    }
    return ir(`${APP()}/email/pronto?r=invalido`);
  } catch (e) {
    console.error("[email-link]", e);
    return req.method === "POST" ? json({ r: "invalido" }) : ir(`${APP()}/email/pronto?r=invalido`);
  }
});
