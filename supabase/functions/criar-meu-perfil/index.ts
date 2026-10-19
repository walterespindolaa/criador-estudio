// CRIAR MEU PERFIL (decisão 18/10/2026, opção A)
//
// A social media que também cria conteúdo ganha um segundo profile, só dela,
// sem outro e-mail nem outra senha. Ele é aberto pelo mesmo mecanismo de
// "abrir o Cria de uma conta" e fica ligado pela coluna profiles.perfil_de.
//
// Regras:
//   - só quem atende clientes (account_type = manager) cria;
//   - um perfil por pessoa (índice único em perfil_de; aqui é idempotente);
//   - SEM linha em account_members: o perfil não vira cliente da carteira,
//     não conta assento e o time da agência não enxerga;
//   - o login dele é um usuário técnico sem senha, com e-mail num subdomínio
//     que ninguém usa. Ninguém entra por ele: quem abre é a dona, logada.
//   - 7 dias de teste (gatilho do cadastro) e, depois, plano próprio.
import { createClient } from "npm:@supabase/supabase-js@2";
import { getCorsHeaders } from "../_shared/cors.ts";

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const json = (b: unknown, s = 200) =>
    new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  try {
    const url = Deno.env.get("SUPABASE_URL");
    const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!url || !key) return json({ error: "config" }, 500);
    const admin = createClient(url, key);

    const jwt = (req.headers.get("Authorization") || "").replace("Bearer ", "");
    const { data: u, error: uErr } = await admin.auth.getUser(jwt);
    if (uErr || !u?.user) return json({ error: "unauthorized" }, 401);
    const donaId = u.user.id;

    const { data: dona } = await admin.from("profiles")
      .select("id, name, account_type, perfil_de").eq("id", donaId).maybeSingle();
    if (!dona) return json({ error: "profile_not_found" }, 404);
    if ((dona as { perfil_de: string | null }).perfil_de) {
      return json({ error: "perfil_nao_cria_perfil", message: "Este já é um perfil." }, 400);
    }
    if ((dona as { account_type: string | null }).account_type !== "manager") {
      return json({ error: "so_quem_atende_clientes", message: "O Meu perfil é pra quem atende clientes no Cria." }, 403);
    }

    // Idempotente: se já existe, devolve o mesmo.
    const { data: ja } = await admin.from("profiles").select("id").eq("perfil_de", donaId).maybeSingle();
    if (ja) return json({ id: (ja as { id: string }).id, criado: false });

    const corpo = await req.json().catch(() => ({}));
    const nomeBruto = typeof corpo?.nome === "string" ? corpo.nome : "";
    const nome = (nomeBruto.replace(/[<>]/g, "").trim() || (dona as { name: string | null }).name || "Meu perfil").slice(0, 80);

    const email = `perfil-${crypto.randomUUID()}@perfis.criasocialclub.com.br`;
    const { data: criado, error: cErr } = await admin.auth.admin.createUser({
      email,
      email_confirm: true,
      user_metadata: { name: nome, perfil_de: donaId },
    });
    if (cErr || !criado?.user) {
      console.error("[criar-meu-perfil] createUser", cErr?.message);
      return json({ error: "criar_falhou", message: "Não consegui criar o perfil agora." }, 500);
    }
    const perfilId = criado.user.id;

    // O gatilho do cadastro já criou o profile com 7 dias de teste. Aqui ele
    // vira "Meu perfil" da dona. Nasce SEM onboarding (Walter, 18/10/2026): na
    // primeira vez que ela abre, passa pelo onboarding de criadora, que grava
    // nome, @, nicho, pilares e metas no próprio perfil. Se falhar (ex.: corrida com outro clique),
    // apaga o usuário técnico pra não sobrar conta solta.
    const { error: upErr } = await admin.from("profiles")
      .update({ perfil_de: donaId, name: nome, account_type: null, onboarding_completed: false } as never)
      .eq("id", perfilId);
    if (upErr) {
      console.error("[criar-meu-perfil] vincular", upErr.message);
      await admin.auth.admin.deleteUser(perfilId);
      const { data: outro } = await admin.from("profiles").select("id").eq("perfil_de", donaId).maybeSingle();
      if (outro) return json({ id: (outro as { id: string }).id, criado: false });
      return json({ error: "vincular_falhou", message: "Não consegui criar o perfil agora." }, 500);
    }

    return json({ id: perfilId, criado: true });
  } catch (e) {
    console.error("[criar-meu-perfil] inesperado", String(e));
    return json({ error: "unexpected" }, 500);
  }
});
