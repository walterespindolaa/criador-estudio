import { createClient } from "npm:@supabase/supabase-js@2";
import { enviarEmail } from "../_shared/enviar-email.ts";
import { registrarErro, mensagemDe } from "../_shared/log.ts";

/* ═══════════════════════════════════════════════════════════════════════════
   E-MAILS DO CICLO DE VIDA (pente fino 23/09/2026)

   Roda uma vez por dia (cron, mesmo segredo do daily-notifications). Cada
   envio fica em `emails_ciclo` (user_id, tipo, ref) com UNIQUE, então rodar
   duas vezes não manda duas vezes.

     boas_vindas        conta criada nas últimas 72 h, texto por persona
     trial_d2           trial acaba em ~2 dias e não tem assinatura ativa
     trial_d0           trial acabou ontem/hoje e não tem assinatura ativa
     aprovacao_parada   social mídia com posts aguardando o cliente há 3+ dias

   Falha em um e-mail não para os outros. Sem `profiles.email` a pessoa é
   pulada (o cadastro antigo pode não ter espelhado o e-mail no perfil).
   ═══════════════════════════════════════════════════════════════════════════ */

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-internal-secret",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

type Perfil = {
  id: string; email: string | null; name: string | null; account_type: string | null;
  plan: string | null; subscription_status: string | null; trial_ends_at: string | null; created_at: string;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const secret = req.headers.get("x-internal-secret");
    if (!secret || secret !== Deno.env.get("INTERNAL_PUSH_SECRET")) return json({ error: "unauthorized" }, 401);

    const svc = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const APP = Deno.env.get("APP_URL") ?? "https://app.criasocialclub.com.br";
    const dayMs = 86400000;
    const now = Date.now();
    const iso = (ms: number) => new Date(ms).toISOString();
    const enviados = { boas_vindas: 0, trial_d2: 0, trial_d0: 0, aprovacao_parada: 0 };

    // Já mandados: um Set "user:tipo:ref" pra não repetir.
    const { data: jaRows } = await svc.from("emails_ciclo").select("user_id, tipo, ref").gte("sent_at", iso(now - 40 * dayMs));
    const ja = new Set(((jaRows ?? []) as { user_id: string; tipo: string; ref: string | null }[]).map((r) => `${r.user_id}:${r.tipo}:${r.ref ?? ""}`));
    const marcar = async (user_id: string, tipo: string, ref: string | null) => {
      ja.add(`${user_id}:${tipo}:${ref ?? ""}`);
      await svc.from("emails_ciclo").insert({ user_id, tipo, ref });
    };

    // ── 1. Boas-vindas por persona (conta criada nas últimas 72 h) ──
    const { data: novos } = await svc.from("profiles")
      .select("id, email, name, account_type, plan, subscription_status, trial_ends_at, created_at")
      .gte("created_at", iso(now - 3 * dayMs));
    for (const p of (novos ?? []) as Perfil[]) {
      if (!p.email || ja.has(`${p.id}:boas_vindas:`)) continue;
      const persona = p.account_type === "manager" ? "agencia" : p.account_type === "parceiro" ? "parceiro" : "criador";
      const conteudo = persona === "agencia"
        ? {
          assunto: "Bem-vinda ao Cria: o primeiro post pra aprovação em 5 minutos",
          paragrafos: [
            "Sua área de agência está aberta. O caminho mais curto pra sentir o Cria funcionando: cadastre um cliente, monte um post e mande o link de aprovação. O cliente abre no celular, aprova ou pede ajuste, e você para de caçar print no WhatsApp.",
            "Depois disso, o Cria Captação organiza os dias de gravação, o Caixa cuida das mensalidades e o relatório sai com a sua logo.",
          ],
          botao: { texto: "Abrir minha área", url: `${APP}/socialmidia/dashboard` },
        }
        : persona === "parceiro"
          ? {
            assunto: "Bem-vindo ao Cria: sua fila de demandas",
            paragrafos: [
              "Sua conta de parceiro está pronta. Quando uma social mídia delegar um post pra você, ele aparece na sua fila com briefing, prazo e material, e o aviso chega no celular.",
              "Ainda não está vinculado a nenhuma agência? Em Minhas Demandas tem o seu código: manda pra social mídia e ela te adiciona em dois toques.",
            ],
            botao: { texto: "Ver minha fila", url: `${APP}/socialmidia/demandas` },
          }
          : {
            assunto: "Bem-vindo ao Cria: comece pelas ideias",
            paragrafos: [
              "Sua conta está pronta. O jeito mais rápido de ver o Cria trabalhando por você: gere 5 ideias com a IA (ela já conhece o seu nicho), escolha uma e leve pro quadro de produção.",
              "Conectar o Instagram deixa a IA mais afiada e liga o relatório de desempenho. Dá pra fazer em Configurações quando quiser.",
            ],
            botao: { texto: "Gerar minhas primeiras ideias", url: `${APP}/app/ideias` },
          };
      const ok = await enviarEmail(svc, { para: p.email, nome: p.name, etiqueta: "boas_vindas_" + persona, rodape: "Você recebe este e-mail porque criou uma conta no Cria.", ...conteudo });
      if (ok) { enviados.boas_vindas += 1; await marcar(p.id, "boas_vindas", null); }
    }

    // ── 2 e 3. Trial acabando / acabou (só quem não assinou) ──
    const { data: trials } = await svc.from("profiles")
      .select("id, email, name, account_type, plan, subscription_status, trial_ends_at, created_at")
      .not("trial_ends_at", "is", null)
      .gte("trial_ends_at", iso(now - 1 * dayMs))
      .lte("trial_ends_at", iso(now + 2 * dayMs));
    for (const p of (trials ?? []) as Perfil[]) {
      if (!p.email || p.subscription_status === "active") continue; // já assinou: não tem trial pra lembrar
      if (p.account_type === "parceiro") continue;
      const fim = new Date(p.trial_ends_at!).getTime();
      const ref = p.trial_ends_at!.slice(0, 10);
      if (fim > now && !ja.has(`${p.id}:trial_d2:${ref}`)) {
        const ok = await enviarEmail(svc, {
          para: p.email, nome: p.name, etiqueta: "trial_d2",
          assunto: "Seu teste do Cria termina em 2 dias",
          paragrafos: [
            "Faltam dois dias de teste. Tudo o que você criou (ideias, posts, brandbook, clientes) fica guardado; o que muda é o acesso às ferramentas.",
            "Se o Cria já virou parte da sua rotina, escolha um plano e segue sem interrupção. Se ainda está em dúvida, responde este e-mail e conta o que faltou.",
          ],
          botao: { texto: "Ver planos", url: `${APP}/app/assinar` },
        });
        if (ok) { enviados.trial_d2 += 1; await marcar(p.id, "trial_d2", ref); }
      } else if (fim <= now && !ja.has(`${p.id}:trial_d0:${ref}`)) {
        const ok = await enviarEmail(svc, {
          para: p.email, nome: p.name, etiqueta: "trial_d0",
          assunto: "Seu teste do Cria terminou (seus dados estão guardados)",
          paragrafos: [
            "O período de teste acabou. Nada foi apagado: ideias, posts, brandbook e clientes continuam na sua conta esperando você voltar.",
            "Pra retomar de onde parou, é só escolher um plano. Cancela quando quiser, direto no app.",
          ],
          botao: { texto: "Retomar meu Cria", url: `${APP}/app/assinar` },
        });
        if (ok) { enviados.trial_d0 += 1; await marcar(p.id, "trial_d0", ref); }
      }
    }

    // ── 4. Aprovação parada: posts esperando o cliente há 3+ dias ──
    const { data: parados } = await svc.from("posts")
      .select("user_id, title, updated_at")
      .eq("approval_status", "pendente").is("deleted_at", null)
      .not("external_client_id", "is", null)
      .lte("updated_at", iso(now - 3 * dayMs));
    const porGestora = new Map<string, string[]>();
    for (const r of (parados ?? []) as { user_id: string; title: string | null }[]) {
      const arr = porGestora.get(r.user_id) ?? [];
      arr.push(r.title || "post sem título"); porGestora.set(r.user_id, arr);
    }
    if (porGestora.size > 0) {
      const ids = [...porGestora.keys()];
      const { data: gestoras } = await svc.from("profiles").select("id, email, name").in("id", ids);
      const semana = new Date(now).toISOString().slice(0, 10).slice(0, 7) + "-w" + Math.ceil(new Date(now).getDate() / 7);
      for (const g of (gestoras ?? []) as { id: string; email: string | null; name: string | null }[]) {
        if (!g.email || ja.has(`${g.id}:aprovacao_parada:${semana}`)) continue;
        const titulos = porGestora.get(g.id) ?? [];
        const ok = await enviarEmail(svc, {
          para: g.email, nome: g.name, etiqueta: "aprovacao_parada",
          assunto: `${titulos.length} post${titulos.length > 1 ? "s" : ""} esperando aprovação há mais de 3 dias`,
          paragrafos: [
            `Tem ${titulos.length} post${titulos.length > 1 ? "s" : ""} parado${titulos.length > 1 ? "s" : ""} na aprovação do cliente: ${titulos.slice(0, 5).join("; ")}${titulos.length > 5 ? " e outros" : ""}.`,
            "Vale mandar o link de novo pelo WhatsApp, ou ligar. Post que não é aprovado não é publicado, e o calendário do mês desanda.",
          ],
          botao: { texto: "Ver aprovações", url: `${APP}/socialmidia/aprovacoes` },
          rodape: "Este lembrete sai no máximo uma vez por semana.",
        });
        if (ok) { enviados.aprovacao_parada += 1; await marcar(g.id, "aprovacao_parada", semana); }
      }
    }

    // ── 5. Inventário da agência vencendo: clientes estacionados que o cron
    //      apaga em 7 dias. A agência recebe UM aviso, com nomes. ──
    const { data: estacionados } = await svc.from("profiles")
      .select("id, name, agency_owner_id, parked_until")
      .not("agency_owner_id", "is", null)
      .not("parked_until", "is", null)
      .gte("parked_until", iso(now + 5 * dayMs))
      .lte("parked_until", iso(now + 7 * dayMs));
    const porAgencia = new Map<string, string[]>();
    for (const c of (estacionados ?? []) as { id: string; name: string | null; agency_owner_id: string; parked_until: string }[]) {
      const arr = porAgencia.get(c.agency_owner_id) ?? [];
      arr.push(c.name || "cliente sem nome"); porAgencia.set(c.agency_owner_id, arr);
    }
    let inventario = 0;
    if (porAgencia.size > 0) {
      const { data: donos } = await svc.from("profiles").select("id, email, name").in("id", [...porAgencia.keys()]);
      const refSemana = new Date(now).toISOString().slice(0, 10);
      for (const d of (donos ?? []) as { id: string; email: string | null; name: string | null }[]) {
        if (!d.email || ja.has(`${d.id}:inventario_vencendo:${refSemana}`)) continue;
        const nomes = porAgencia.get(d.id) ?? [];
        const ok = await enviarEmail(svc, {
          para: d.email, nome: d.name, etiqueta: "inventario_vencendo",
          assunto: `${nomes.length} conta${nomes.length > 1 ? "s" : ""} de cliente ser${nomes.length > 1 ? "ão apagadas" : "á apagada"} em 7 dias`,
          paragrafos: [
            `Quando a sua carteira diminuiu, as contas de ${nomes.slice(0, 6).join(", ")}${nomes.length > 6 ? " e outras" : ""} ficaram estacionadas no inventário. O prazo de 60 dias está acabando: em 7 dias elas são apagadas de vez, com os posts e o brandbook.`,
            "Se quiser manter alguma, libere um assento e reative pelo painel de Contas antes do prazo.",
          ],
          botao: { texto: "Ver inventário", url: `${APP}/socialmidia/contas` },
        });
        if (ok) { inventario += 1; await marcar(d.id, "inventario_vencendo", refSemana); }
      }
    }

    await svc.from("cron_runs").upsert({ job: "lifecycle-emails", last_run_at: new Date().toISOString(), ok: true, detail: JSON.stringify({ ...enviados, inventario_vencendo: inventario }) }, { onConflict: "job" });
    return json({ ok: true, enviados });
  } catch (e) {
    const svcLog = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    await registrarErro(svcLog, "lifecycle-emails", mensagemDe(e));
    await svcLog.from("cron_runs").upsert({ job: "lifecycle-emails", last_run_at: new Date().toISOString(), ok: false, detail: mensagemDe(e) }, { onConflict: "job" });
    return json({ error: "internal_error" }, 500);
  }
});
