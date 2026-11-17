/* ═══════════════════════════════════════════════════════════════════════════
   AVISO DO TESTE COMPLETO DA SOCIAL MÍDIA (Walter, 17/11/2026)

   Disparo único, aprovado pelo Walter: avisa cada social mídia em teste que a
   conta está com todos os módulos liberados (menos o Cria Radar) até o fim do
   teste dela. Roda chamado à mão pelo SQL Editor (mesmo segredo interno do
   lifecycle-emails). Rodar de novo não repete: cada conta recebe uma vez
   (emails_ciclo, tipo "aviso_teste_modulos").

   Body opcional: { "dry_run": true } só conta quem receberia, não envia.
   ═══════════════════════════════════════════════════════════════════════════ */

import { createClient } from "npm:@supabase/supabase-js@2";
import { enviarEmail, REMETENTE_PESSOAL, RESPOSTAS_PARA } from "../_shared/enviar-email.ts";
import { registrarErro, mensagemDe } from "../_shared/log.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-internal-secret",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

const TIPO = "aviso_teste_modulos";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const secret = req.headers.get("x-internal-secret");
    if (!secret || secret !== Deno.env.get("INTERNAL_PUSH_SECRET")) return json({ error: "unauthorized" }, 401);
    const body = await req.json().catch(() => ({})) as { dry_run?: boolean };

    const svc = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const APP = Deno.env.get("APP_URL") ?? "https://app.criasocialclub.com.br";
    const agora = Date.now();

    // Social mídias em teste (sem admin e sem teste longo da casa).
    const { data: perfis, error } = await svc.from("profiles")
      .select("id, name, trial_ends_at, role")
      .eq("account_type", "manager")
      .gt("trial_ends_at", new Date(agora).toISOString())
      .lte("trial_ends_at", new Date(agora + 9 * 86400000).toISOString());
    if (error) throw new Error("perfis: " + error.message);
    const alvo = ((perfis ?? []) as { id: string; name: string | null; trial_ends_at: string; role: string | null }[])
      .filter((p) => p.role !== "admin");

    const { data: ja } = await svc.from("emails_ciclo").select("user_id").eq("tipo", TIPO);
    const jaFoi = new Set(((ja ?? []) as { user_id: string }[]).map((r) => r.user_id));
    const pendentes = alvo.filter((p) => !jaFoi.has(p.id));

    const { data: emails, error: eErr } = pendentes.length
      ? await svc.rpc("emails_para", { _ids: pendentes.map((p) => p.id) })
      : { data: [], error: null };
    if (eErr) throw new Error("emails_para: " + eErr.message);
    const emailDe = new Map(((emails ?? []) as { id: string; email: string | null }[]).map((r) => [r.id, r.email]));

    if (body.dry_run) {
      return json({ ok: true, dry_run: true, em_teste: alvo.length, ja_avisadas: alvo.length - pendentes.length,
        receberiam: pendentes.filter((p) => !!emailDe.get(p.id)).length });
    }

    let enviados = 0, semEmail = 0, falhas = 0;
    for (const p of pendentes) {
      const para = emailDe.get(p.id);
      if (!para) { semEmail += 1; continue; }
      const ate = new Date(p.trial_ends_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", timeZone: "America/Sao_Paulo" });
      const ok = await enviarEmail(svc, {
        para, nome: p.name, etiqueta: TIPO,
        de: REMETENTE_PESSOAL(), responderPara: RESPOSTAS_PARA(),
        assunto: "Liberamos o Cria completo pra você testar",
        titulo: "Tudo liberado até " + ate, tag: "Seu teste", tema: "amarelo",
        paragrafos: [
          `A partir de hoje, sua conta no Cria está com tudo liberado por 7 dias, até ${ate}:`,
          "Cria Post: aprovação do cliente por link, sem print no WhatsApp.",
          "Cria Gestão: clientes, tarefas, contratos e propostas num lugar só.",
          "Cria Caixa: quanto entra, quanto sai e quanto sobra de cada cliente.",
          "Cria Captação: roteiros e agenda de gravação por cliente.",
          "Usa com seus clientes de verdade. O que você criar fica salvo depois do teste.",
          `Depois do dia ${ate}, sua conta continua grátis até 3 clientes, e você escolhe se quer manter algum módulo.`,
        ],
        botao: { texto: "Abrir o Cria", url: APP },
        assinatura: "Qualquer dúvida, é só responder este e-mail.\nGabi e Walter",
      });
      if (ok) {
        enviados += 1;
        await svc.from("emails_ciclo").insert({ user_id: p.id, tipo: TIPO, ref: p.trial_ends_at.slice(0, 10) });
      } else falhas += 1;
    }

    await svc.from("cron_runs").upsert({ job: TIPO, last_run_at: new Date().toISOString(), ok: falhas === 0,
      detail: JSON.stringify({ em_teste: alvo.length, enviados, sem_email: semEmail, falhas }) }, { onConflict: "job" });
    return json({ ok: true, em_teste: alvo.length, enviados, sem_email: semEmail, falhas });
  } catch (e) {
    try {
      const svcLog = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
      await registrarErro(svcLog as never, "aviso-teste-modulos", mensagemDe(e));
    } catch { /* log nunca derruba */ }
    return json({ ok: false, error: mensagemDe(e) }, 500);
  }
});
