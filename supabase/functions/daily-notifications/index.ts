import { createClient } from "npm:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-internal-secret",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    // Só o agendador (cron) chama, com o segredo interno.
    const secret = req.headers.get("x-internal-secret");
    if (!secret || secret !== Deno.env.get("INTERNAL_PUSH_SECRET")) return json({ error: "unauthorized" }, 401);

    const svc = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const dayMs = 86400000;
    const now = Date.now();
    const iso = (ms: number) => new Date(ms).toISOString();
    // 1) Re-engajamento: sumiram há ~5 dias. 2) Acesso vencendo (~3 dias antes).
    const [goneRes, expRes] = await Promise.all([
      svc.from("profiles").select("id")
        .gte("last_seen_at", iso(now - 6 * dayMs)).lte("last_seen_at", iso(now - 5 * dayMs)),
      svc.from("profiles").select("id")
        .gte("access_expires_at", iso(now + 2 * dayMs)).lte("access_expires_at", iso(now + 3 * dayMs)),
    ]);
    const goneIds = ((goneRes.data ?? []) as { id: string }[]).map((p) => p.id);
    const expIds = ((expRes.data ?? []) as { id: string }[]).map((p) => p.id);

    // Dedup: não repetir quem já recebeu esse tipo nas últimas 48h (caso o cron rode 2x).
    const candidates = [...new Set([...goneIds, ...expIds])];
    const already = new Set<string>();
    if (candidates.length) {
      const { data: recent } = await svc.from("notifications")
        .select("user_id, type")
        .in("user_id", candidates)
        .in("type", ["volte", "acesso_vencendo"])
        .gte("created_at", iso(now - 2 * dayMs));
      for (const r of (recent ?? []) as { user_id: string; type: string }[]) already.add(`${r.user_id}:${r.type}`);
    }

    const rows: Record<string, unknown>[] = [];
    for (const id of goneIds) {
      if (already.has(`${id}:volte`)) continue;
      rows.push({ user_id: id, type: "volte", title: "Sentimos sua falta!", description: "Que tal voltar e planejar seu conteúdo da semana?", link: "/app" });
    }
    for (const id of expIds) {
      if (already.has(`${id}:acesso_vencendo`)) continue;
      rows.push({ user_id: id, type: "acesso_vencendo", title: "Seu acesso vence em breve", description: "Renove pra não perder seus conteúdos e o acesso à Cria IA.", link: "/app/configuracoes" });
    }

    // ── Aniversário de cliente: avisa o social mídia no dia (e 3 dias antes, pra dar tempo de preparar) ──
    const brNow = new Date(Date.now() - 3 * 60 * 60 * 1000); // UTC-3
    const mmdd = (d: Date) => `${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    const in3 = new Date(brNow); in3.setDate(in3.getDate() + 3);
    const alvos = new Map<string, "hoje" | "em3">([[mmdd(brNow), "hoje"], [mmdd(in3), "em3"]]);

    const { data: bdays } = await svc.from("crm_clients")
      .select("id, manager_id, name, birthday, status")
      .not("birthday", "is", null)
      .neq("status", "inativo")
      .is("deleted_at", null);

    // Não repete no mesmo dia.
    const { data: sentToday } = await svc.from("notifications")
      .select("user_id, link").eq("type", "aniversario_cliente").gte("created_at", iso(now - dayMs));
    const already2 = new Set((sentToday ?? []).map((r: { user_id: string; link: string }) => `${r.user_id}:${r.link}`));

    for (const c of (bdays ?? []) as { id: string; manager_id: string; name: string; birthday: string }[]) {
      const quando = alvos.get(c.birthday.slice(5)); // "MM-DD"
      if (!quando) continue;
      const link = `/socialmidia/criacrm/${c.id}`;
      if (already2.has(`${c.manager_id}:${link}`)) continue;
      rows.push({
        user_id: c.manager_id,
        type: "aniversario_cliente",
        title: quando === "hoje" ? `🎂 Hoje é aniversário de ${c.name}` : `🎂 ${c.name} faz aniversário em 3 dias`,
        description: quando === "hoje" ? "Mande uma mensagem ou um post de parabéns." : "Dá tempo de preparar um conteúdo especial.",
        link,
      });
    }

    // ── Lembrete na véspera da captação: avisa a social mídia (o manager dono) no
    //    dia ANTERIOR. Uma notificação AGREGADA por manager/dia (menos spam que uma
    //    por captação), com a lista das captações de amanhã. Só captações agendadas
    //    (não canceladas, não concluídas). Dedupe: uma por manager por dia. ──────────
    const fmtBR = new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit",
    });
    // "Amanhã" no fuso BR: soma 24h ao agora e formata no fuso (o Brasil não tem mais
    // horário de verão, então o deslocamento de 24h é seguro pra achar o dia seguinte).
    const amanhaBR = fmtBR.format(new Date(now + dayMs));

    const { data: capsAmanha } = await svc.from("agenda_captures")
      .select("id, manager_id, crm_client_id, client_name, capture_time, location")
      .eq("capture_date", amanhaBR)
      .eq("status", "agendada");

    const capsList = (capsAmanha ?? []) as {
      id: string; manager_id: string; crm_client_id: string | null;
      client_name: string | null; capture_time: string | null; location: string | null;
    }[];

    if (capsList.length) {
      // Nome do cliente: display_name (apelido do gestor) > name; senão o client_name livre.
      const crmIds = [...new Set(capsList.map((c) => c.crm_client_id).filter((x): x is string => !!x))];
      const nomeById = new Map<string, string>();
      if (crmIds.length) {
        const { data: crm } = await svc.from("crm_clients").select("id, name, display_name").in("id", crmIds);
        for (const c of (crm ?? []) as { id: string; name: string | null; display_name: string | null }[]) {
          nomeById.set(c.id, c.display_name?.trim() || c.name?.trim() || "Cliente");
        }
      }
      const nomeDe = (c: { crm_client_id: string | null; client_name: string | null }) =>
        (c.crm_client_id ? nomeById.get(c.crm_client_id) : null) || c.client_name?.trim() || "Cliente";

      // Agrupa por manager (uma notificação por social mídia, agregando o dia).
      const porManager = new Map<string, typeof capsList>();
      for (const c of capsList) {
        (porManager.get(c.manager_id) ?? porManager.set(c.manager_id, []).get(c.manager_id)!).push(c);
      }

      // Dedupe por dia: não repete a véspera pro mesmo manager (caso o cron rode 2x).
      const managerIds = [...porManager.keys()];
      const { data: sentVespera } = await svc.from("notifications")
        .select("user_id").eq("type", "captacao_amanha")
        .in("user_id", managerIds).gte("created_at", iso(now - dayMs));
      const jaAvisado = new Set((sentVespera ?? []).map((r: { user_id: string }) => r.user_id));

      const hora = (t: string | null) => (t ? t.slice(0, 5) : null);
      for (const [managerId, caps] of porManager) {
        if (jaAvisado.has(managerId)) continue;
        caps.sort((a, b) => (a.capture_time ?? "99:99").localeCompare(b.capture_time ?? "99:99"));
        let title: string;
        let description: string;
        if (caps.length === 1) {
          const c = caps[0];
          const h = hora(c.capture_time);
          const partes = [nomeDe(c)];
          if (h) partes.push(`às ${h}`);
          if (c.location?.trim()) partes.push(`em ${c.location.trim()}`);
          title = "📹 Amanhã você tem captação";
          description = `${partes.join(" ")}. Roteiro pronto?`;
        } else {
          title = `📹 Amanhã: ${caps.length} captações`;
          description = `${caps.map((c) => {
            const h = hora(c.capture_time);
            return `${nomeDe(c)}${h ? ` (${h})` : ""}`;
          }).join(", ")}. Roteiros prontos?`;
        }
        rows.push({ user_id: managerId, type: "captacao_amanha", title, description, link: "/socialmidia/captacao" });
      }
    }

    // ── RESUMO DO DIA (pente fino 04/09). A LP promete "post do dia, prazo
    //    chegando e resumo diário no celular", mas até aqui o lembrete de post
    //    só nascia quando a pessoa ABRIA o app (client-side). Quem não abria,
    //    nunca era lembrado: o oposto do prometido. Agora o robô monta, por
    //    usuário, UMA notificação de manhã com: posts agendados pra hoje,
    //    tarefas vencendo hoje (ou atrasadas) e, pra social mídia, posts de
    //    clientes esperando aprovação. Uma por pessoa por dia (dedupe). ──────
    const hojeBR = fmtBR.format(new Date(now));
    const [postsHoje, tarefasHoje, aprovPend] = await Promise.all([
      svc.from("posts").select("user_id, title, status")
        .eq("scheduled_date", hojeBR).is("deleted_at", null)
        .not("status", "in", "(publicado)"),
      svc.from("tasks").select("user_id, title, due_date")
        .lte("due_date", hojeBR).neq("status", "concluida").neq("status", "done"),
      // Posts em "Pronto" com cliente externo e aprovação pendente: cobra a social mídia.
      svc.from("posts").select("user_id, title")
        .eq("status", "editando").is("deleted_at", null)
        .not("external_client_id", "is", null)
        .or("approval_status.is.null,approval_status.eq.pendente"),
    ]);
    type Agg = { posts: string[]; tarefas: string[]; atrasadas: number; aprov: number };
    const porUser = new Map<string, Agg>();
    const pega = (id: string) => porUser.get(id) ?? porUser.set(id, { posts: [], tarefas: [], atrasadas: 0, aprov: 0 }).get(id)!;
    for (const p of (postsHoje.data ?? []) as { user_id: string; title: string }[]) pega(p.user_id).posts.push(p.title);
    for (const t of (tarefasHoje.data ?? []) as { user_id: string; title: string; due_date: string }[]) {
      const a = pega(t.user_id);
      if (t.due_date === hojeBR) a.tarefas.push(t.title); else a.atrasadas++;
    }
    for (const p of (aprovPend.data ?? []) as { user_id: string }[]) pega(p.user_id).aprov++;

    if (porUser.size) {
      const ids = [...porUser.keys()];
      const { data: jaResumo } = await svc.from("notifications")
        .select("user_id").eq("type", "resumo_dia")
        .in("user_id", ids).gte("created_at", iso(now - 20 * 60 * 60 * 1000));
      const jaTem = new Set((jaResumo ?? []).map((r: { user_id: string }) => r.user_id));
      const corta = (s: string, n = 42) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);
      for (const [uid, a] of porUser) {
        if (jaTem.has(uid)) continue;
        const partes: string[] = [];
        if (a.posts.length === 1) partes.push(`post de hoje: "${corta(a.posts[0])}"`);
        else if (a.posts.length > 1) partes.push(`${a.posts.length} posts agendados pra hoje`);
        if (a.tarefas.length === 1) partes.push(`tarefa: "${corta(a.tarefas[0])}"`);
        else if (a.tarefas.length > 1) partes.push(`${a.tarefas.length} tarefas vencem hoje`);
        if (a.atrasadas) partes.push(`${a.atrasadas} tarefa${a.atrasadas > 1 ? "s" : ""} atrasada${a.atrasadas > 1 ? "s" : ""}`);
        if (a.aprov) partes.push(`${a.aprov} post${a.aprov > 1 ? "s" : ""} esperando aprovação de cliente`);
        if (!partes.length) continue;
        const title = a.posts.length
          ? "📌 Seu dia no CRIA: tem post pra sair hoje"
          : a.aprov ? "📌 Seu dia no CRIA: aprovação pendente" : "📌 Seu dia no CRIA";
        const descricao = partes.join(" · ");
        rows.push({
          user_id: uid, type: "resumo_dia", title,
          description: descricao.charAt(0).toUpperCase() + descricao.slice(1) + ".",
          link: a.posts.length ? "/app/criando" : a.aprov ? "/app/aprovacao" : "/app/tarefas",
        });
      }
    }

    // Insert em lote (1 chamada), o trigger de push dispara por linha.
    // Checa o erro: sem isso, uma falha no insert passava batido e o cron
    // reportava "created:N" sem ter criado nada (e o heartbeat dizia ok:true).
    if (rows.length) {
      const { error: insErr } = await svc.from("notifications").insert(rows);
      if (insErr) {
        console.error("[daily-notifications] insert error:", insErr);
        await svc.from("cron_runs").upsert({ job: "daily-notifications", last_run_at: new Date().toISOString(), ok: false, detail: insErr.message }, { onConflict: "job" });
        return json({ ok: false, error: insErr.message }, 500);
      }
    }

    // Heartbeat de SUCESSO só depois do insert dar certo (honesto no admin).
    await svc.from("cron_runs").upsert({ job: "daily-notifications", last_run_at: new Date().toISOString(), ok: true, detail: null }, { onConflict: "job" });
    return json({ ok: true, created: rows.length });
  } catch (e) {
    console.error("[daily-notifications] error:", e);
    // Heartbeat de FALHA: registra que a rodada quebrou (visível no admin).
    try {
      const svc2 = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
      await svc2.from("cron_runs").upsert({ job: "daily-notifications", last_run_at: new Date().toISOString(), ok: false, detail: String(e) }, { onConflict: "job" });
    } catch (_) { /* heartbeat é best-effort */ }
    return json({ error: "internal_error" }, 500);
  }
});
