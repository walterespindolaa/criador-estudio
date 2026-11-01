import { createClient } from "npm:@supabase/supabase-js@2";
import { lerResposta, type Conta } from "../_shared/resposta-ia.ts";

/* ═══════════════════════════════════════════════════════════════════════════
   CAIXA DE RESPOSTAS (30/10/2026)

   Walter: "ngm vai ler esses emails a não ser que criamos algum lugar no
   painel admin". Os e-mails assinados por Gabi e Walter saem com reply-to
   num domínio que o Resend RECEBE. Cada resposta chega aqui pelo webhook
   `email.received`:
     1. confere a assinatura (svix, segredo RESEND_WEBHOOK_SECRET);
     2. busca o corpo na API do Resend (o webhook só traz o cabeçalho);
     3. corta o histórico citado ("Em ... escreveu:") e liga à conta pelo e-mail;
     4. a IA classifica, resume e escreve um rascunho de resposta;
     5. grava em email_respostas e avisa os admins no sino.
   O rascunho NUNCA sai sozinho: quem responde é uma pessoa, no Admin.
   ═══════════════════════════════════════════════════════════════════════════ */

const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { "Content-Type": "application/json" } });

async function assinaturaOk(req: Request, corpo: string): Promise<boolean> {
  const segredo = Deno.env.get("RESEND_WEBHOOK_SECRET");
  if (!segredo) return false;
  const id = req.headers.get("svix-id"), ts = req.headers.get("svix-timestamp"), sig = req.headers.get("svix-signature");
  if (!id || !ts || !sig) return false;
  if (Math.abs(Date.now() / 1000 - Number(ts)) > 300) return false; // 5 min: barra reenvio velho
  const chave = Uint8Array.from(atob(segredo.replace(/^whsec_/, "")), (c) => c.charCodeAt(0));
  const k = await crypto.subtle.importKey("raw", chave, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const mac = new Uint8Array(await crypto.subtle.sign("HMAC", k, new TextEncoder().encode(`${id}.${ts}.${corpo}`)));
  const esperado = btoa(String.fromCharCode(...mac));
  return sig.split(" ").some((p) => {
    const v = p.split(",")[1] ?? "";
    if (v.length !== esperado.length) return false;
    let d = 0; for (let i = 0; i < v.length; i++) d |= v.charCodeAt(i) ^ esperado.charCodeAt(i);
    return d === 0;
  });
}

/** "Ana Souza <ana@x.com>" → { nome, email } */
function separar(de: string): { nome: string | null; email: string } {
  const m = de.match(/^\s*"?([^"<]*?)"?\s*<([^>]+)>\s*$/);
  if (m) return { nome: m[1].trim() || null, email: m[2].trim().toLowerCase() };
  return { nome: null, email: de.trim().toLowerCase() };
}

/** Tira o histórico citado que o Gmail/Outlook/Apple Mail anexam embaixo. */
function soAResposta(t: string): string {
  const linhas = t.replace(/\r\n/g, "\n").split("\n");
  const corte = linhas.findIndex((l) =>
    /^\s*(Em .{4,120} escreveu:|On .{4,120} wrote:|-{2,}\s*(Mensagem original|Original Message)|De: .+|From: .+@)/i.test(l)
  );
  const util = (corte >= 0 ? linhas.slice(0, corte) : linhas).filter((l) => !/^\s*>/.test(l));
  return util.join("\n").replace(/\n{3,}/g, "\n\n").trim().slice(0, 6000);
}

function textoDoHtml(h: string): string {
  return h.replace(/<style[\s\S]*?<\/style>/gi, "").replace(/<br\s*\/?>/gi, "\n").replace(/<\/p>/gi, "\n\n")
    .replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">");
}


Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "method" }, 405);
  const corpo = await req.text();
  if (!(await assinaturaOk(req, corpo))) return json({ error: "assinatura" }, 401);

  let ev: { type?: string; data?: { email_id?: string; from?: string; subject?: string } };
  try { ev = JSON.parse(corpo); } catch { return json({ error: "json" }, 400); }
  if (ev.type !== "email.received" || !ev.data?.email_id) return json({ ignorado: true });

  const svc = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const resendId = String(ev.data.email_id);
  const { data: ja } = await svc.from("email_respostas").select("id").eq("resend_id", resendId).maybeSingle();
  if (ja) return json({ ok: true, repetido: true }); // o Resend reenvia se demorarmos

  // Corpo completo (o webhook não traz).
  let assunto = ev.data.subject ?? null, de = ev.data.from ?? "", texto = "";
  try {
    const r = await fetch(`https://api.resend.com/emails/receiving/${encodeURIComponent(resendId)}`, {
      headers: { Authorization: `Bearer ${Deno.env.get("RESEND_API_KEY")}` },
    });
    if (r.ok) {
      const m = await r.json() as { from?: string; subject?: string; text?: string | null; html?: string | null };
      de = m.from ?? de; assunto = m.subject ?? assunto;
      texto = m.text ?? (m.html ? textoDoHtml(m.html) : "");
    } else console.error("[email-entrada] resend", r.status, (await r.text()).slice(0, 200));
  } catch (e) { console.error("[email-entrada] resend", e); }

  const { nome, email } = separar(de);
  if (!email.includes("@")) return json({ ignorado: "sem remetente" });
  const resposta = soAResposta(texto) || "(e-mail sem texto)";

  // Liga à conta pelo e-mail (só service role).
  const { data: conta } = await svc.rpc("conta_por_email", { _email: email });
  const c = (Array.isArray(conta) ? conta[0] : conta) as Conta | undefined;

  // IA: categoria, resumo de uma linha e rascunho em primeira pessoa.
  let categoria = "outro", resumo: string | null = null, sugestao: string | null = null;
  try {
    ({ categoria, resumo, sugestao } = await lerResposta({ assunto, nome, texto: resposta, conta: c ?? null }));
  } catch (e) { console.error("[email-entrada] ia", e); }

  const { error } = await svc.from("email_respostas").insert({
    resend_id: resendId, de_email: email, de_nome: nome ?? c?.name ?? null, user_id: c?.id ?? null,
    assunto: assunto?.slice(0, 300) ?? null, texto: resposta, categoria, resumo, sugestao,
  });
  if (error && !/duplicate/i.test(error.message)) {
    console.error("[email-entrada] insert", error.message);
    return json({ error: "insert" }, 500); // 500 faz o Resend tentar de novo
  }

  // Sino dos admins.
  const { data: admins } = await svc.from("profiles").select("id").eq("role", "admin");
  if (admins?.length) {
    await svc.from("notifications").insert((admins as { id: string }[]).map((a) => ({
      user_id: a.id, type: "resposta_email",
      title: `${nome ?? c?.name ?? email} respondeu um e-mail`,
      description: resumo ?? resposta.slice(0, 140),
      link: "/app/cf-admin-panel?aba=respostas",
    })));
  }
  return json({ ok: true });
});
