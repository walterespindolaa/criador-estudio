import { createClient } from "npm:@supabase/supabase-js@2";
import { registrarErro, mensagemDe } from "../_shared/log.ts";

/* ═══════════════════════════════════════════════════════════════════════════
   EXPORTAR MEUS DADOS (LGPD art. 18, portabilidade · pente fino 23/09/2026)

   Devolve um JSON com tudo que é da pessoa logada: perfil, ideias, posts,
   brandbook, personas, pilares, tarefas, hábitos, metas, clientes da
   agência, roteiros de captação, lançamentos do caixa. Cada tabela é lida
   pela coluna de dono dela; tabela que não existir (migration pendente) é
   pulada em vez de derrubar a exportação. Rate limit: 3 por dia por pessoa,
   porque é uma consulta pesada.
   ═══════════════════════════════════════════════════════════════════════════ */

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

// tabela -> coluna de dono
const TABELAS: [string, string][] = [
  ["ideas", "user_id"], ["posts", "user_id"], ["brand_items", "user_id"], ["personas", "user_id"],
  ["pillars", "user_id"], ["tasks", "user_id"], ["habits", "user_id"], ["habit_logs", "user_id"],
  ["goals", "user_id"], ["moodboard_entries", "user_id"], ["bio_links", "user_id"], ["bio_pages", "manager_id"],
  ["saved_refs", "user_id"], ["collabs", "user_id"], ["media_kit_profiles", "user_id"],
  ["crm_clients", "manager_id"], ["external_clients", "manager_id"], ["fin_records", "manager_id"],
  ["fin_monthly", "manager_id"], ["capture_scripts", "manager_id"], ["captures", "manager_id"],
  ["manager_members", "manager_id"], ["notifications", "user_id"],
];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const svc = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "unauthorized" }, 401);
    const userClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return json({ error: "unauthorized" }, 401);

    const { data: ok } = await svc.rpc("rate_touch", { _key: `export:${user.id}`, _limit: 3 });
    if (ok === false) return json({ error: "rate_limited", message: "Você já exportou 3 vezes hoje. Tenta amanhã." }, 429);

    const { data: perfil } = await svc.from("profiles").select("*").eq("id", user.id).maybeSingle();
    // Colunas de controle não são dado da pessoa.
    const perfilLimpo = perfil ? Object.fromEntries(Object.entries(perfil).filter(([k]) => !/stripe|storage_|must_change|role$/.test(k))) : null;

    const dados: Record<string, unknown> = {
      exportado_em: new Date().toISOString(),
      conta: { id: user.id, email: user.email, criada_em: user.created_at },
      perfil: perfilLimpo,
    };
    const puladas: string[] = [];
    for (const [tabela, dono] of TABELAS) {
      const { data, error } = await svc.from(tabela).select("*").eq(dono, user.id).limit(5000);
      if (error) { puladas.push(tabela); continue; }
      dados[tabela] = data ?? [];
    }
    if (puladas.length) dados._tabelas_indisponiveis = puladas;

    return new Response(JSON.stringify(dados, null, 2), {
      status: 200,
      headers: {
        ...cors,
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="meus-dados-cria-${new Date().toISOString().slice(0, 10)}.json"`,
      },
    });
  } catch (e) {
    await registrarErro(svc, "export-my-data", mensagemDe(e));
    return json({ error: "internal_error" }, 500);
  }
});
