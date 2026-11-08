import { createClient } from "npm:@supabase/supabase-js@2";
import { enviarEmail, REMETENTE_PESSOAL, RESPOSTAS_PARA } from "../_shared/enviar-email.ts";
import { registrarErro, mensagemDe } from "../_shared/log.ts";
import Stripe from "npm:stripe@14";
import { emailTesteD5, emailTesteD6, PRECO_TABELA } from "../_shared/emails-assinatura.ts";

/* ═══════════════════════════════════════════════════════════════════════════
   E-MAILS DO CICLO DE VIDA (pente fino 23/09/2026)

   Roda uma vez por dia (cron, mesmo segredo do daily-notifications). Cada
   envio fica em `emails_ciclo` (user_id, tipo, ref) com UNIQUE, então rodar
   duas vezes não manda duas vezes.

     boas_vindas        conta criada nas últimas 72 h, texto por persona
     trial_d2           trial acaba em ~2 dias e não tem assinatura ativa
     trial_d0           trial acabou ontem/hoje e não tem assinatura ativa
     aprovacao_parada   social mídia com posts aguardando o cliente há 3+ dias
     re_*               e-mails pra quem parou (30/10/2026), bloco 6 abaixo

   Falha em um e-mail não para os outros.

   E-MAIL VEM DO auth.users (conserto de 18/10/2026). profiles NÃO tem coluna
   email: o robô pedia profiles.email, a consulta voltava erro, o erro era
   ignorado e NENHUM e-mail saía desde o começo (emails_ciclo vazio, todos os
   contadores zerados). Agora o e-mail vem do RPC emails_para (só service
   role), e erro de consulta derruba a rodada e aparece no cron_runs.
   Meu perfil (perfil_de) não tem e-mail próprio: o aviso vai pra dona.
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
    const enviados = { boas_vindas: 0, trial_d2: 0, trial_d1: 0, trial_d0: 0, teste_d5: 0, teste_d6: 0, aprovacao_parada: 0 };

    // Já mandados: um Set "user:tipo:ref" pra não repetir.
    const { data: jaRows } = await svc.from("emails_ciclo").select("user_id, tipo, ref").gte("sent_at", iso(now - 40 * dayMs));
    const ja = new Set(((jaRows ?? []) as { user_id: string; tipo: string; ref: string | null }[]).map((r) => `${r.user_id}:${r.tipo}:${r.ref ?? ""}`));
    // E-mail de cada conta (auth.users). Meu perfil cai no e-mail da dona.
    const emailsDe = async (ids: string[]) => {
      const m = new Map<string, { email: string | null; meuPerfil: boolean }>();
      if (!ids.length) return m;
      const { data, error } = await svc.rpc("emails_para", { _ids: ids });
      if (error) throw new Error("emails_para: " + error.message);
      for (const r of (data ?? []) as { id: string; email: string | null; eh_meu_perfil: boolean }[]) {
        m.set(r.id, { email: r.email, meuPerfil: r.eh_meu_perfil });
      }
      return m;
    };
    const comEmail = async <T extends { id: string }>(linhas: T[]) => {
      const m = await emailsDe(linhas.map((l) => l.id));
      return linhas.map((l) => ({ ...l, email: m.get(l.id)?.email ?? null, meuPerfil: m.get(l.id)?.meuPerfil ?? false }));
    };
    const marcar = async (user_id: string, tipo: string, ref: string | null) => {
      ja.add(`${user_id}:${tipo}:${ref ?? ""}`);
      await svc.from("emails_ciclo").insert({ user_id, tipo, ref });
    };

    // ── 1. Boas-vindas por persona (conta criada nas últimas 72 h) ──
    const { data: novos, error: novosErr } = await svc.from("profiles")
      .select("id, name, account_type, plan, subscription_status, trial_ends_at, created_at")
      .gte("created_at", iso(now - 3 * dayMs));
    if (novosErr) throw new Error("novos: " + novosErr.message);
    for (const p of await comEmail((novos ?? []) as Omit<Perfil, "email">[])) {
      // Meu perfil não ganha boas-vindas: a dona já é cliente do Cria.
      if (!p.email || p.meuPerfil || ja.has(`${p.id}:boas_vindas:`)) continue;
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
          : !p.trial_ends_at && p.subscription_status !== "active"
          /* Criador do cadastro novo (03/11/2026): ainda não escolheu o plano,
             então o app abre na tela de planos. O e-mail leva direto pra lá. */
          ? {
            assunto: "Seu Cria está quase pronto: falta escolher o plano",
            paragrafos: [
              "Sua conta está criada. Pra abrir o Cria, escolha o plano e comece os 7 dias grátis: você só paga no 8º dia, e a gente avisa por e-mail 2 dias antes e na véspera.",
              "Dá pra pagar com cartão, Apple Pay ou Google Pay, e cancelar quando quiser, em 2 cliques.",
            ],
            botao: { texto: "Começar meus 7 dias grátis", url: `${APP}/app/assinar` },
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
    const { data: trials, error: trialsErr } = await svc.from("profiles")
      .select("id, name, account_type, plan, subscription_status, trial_ends_at, created_at")
      .not("trial_ends_at", "is", null)
      .gte("trial_ends_at", iso(now - 1 * dayMs))
      .lte("trial_ends_at", iso(now + 3 * dayMs));
    if (trialsErr) throw new Error("trials: " + trialsErr.message);
    for (const p of await comEmail((trials ?? []) as Omit<Perfil, "email">[])) {
      if (!p.email || p.subscription_status === "active") continue; // já assinou: não tem trial pra lembrar
      if (p.account_type === "parceiro") continue;
      const fim = new Date(p.trial_ends_at!).getTime();
      const ref = p.trial_ends_at!.slice(0, 10);
      /* DIAS DE CALENDÁRIO NO FUSO BR (08/11/2026). Antes era "faltam até 24 h":
         como o robô roda 1x por dia às 10h, quem terminava às 10:39 recebia o
         "termina amanhã" 40 minutos antes de acabar, e quem terminava amanhã
         recebia "em 2 dias". Agora conta pela data: fim amanhã = véspera,
         fim depois de amanhã = 2 dias, fim hoje = "termina hoje". */
      const diaBR = (ms: number) => new Date(ms).toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
      const dias = Math.round((Date.parse(diaBR(fim)) - Date.parse(diaBR(now))) / dayMs);
      if (fim > now && dias <= 1 && !ja.has(`${p.id}:trial_d1:${ref}`)) {
        const hoje = dias <= 0;
        const ok = await enviarEmail(svc, {
          para: p.email, nome: p.name, etiqueta: "trial_d1",
          assunto: p.meuPerfil
            ? `O teste do seu perfil de criadora termina ${hoje ? "hoje" : "amanhã"}`
            : `Seu teste do Cria termina ${hoje ? "hoje" : "amanhã"}`,
          paragrafos: [
            `${hoje ? "Hoje" : "Amanhã"} acaba o seu teste. Tudo o que você criou fica guardado na sua conta, mesmo se você não assinar agora.`,
            "Pra seguir sem interrupção, escolhe um plano hoje: leva 1 minuto e você cancela quando quiser, direto no app.",
          ],
          botao: { texto: "Escolher meu plano", url: `${APP}/app/assinar` },
        });
        if (ok) { enviados.trial_d1 += 1; await marcar(p.id, "trial_d1", ref); }
      } else if (fim > now && dias === 2 && !ja.has(`${p.id}:trial_d2:${ref}`)) {
        const ok = await enviarEmail(svc, {
          para: p.email, nome: p.name, etiqueta: "trial_d2",
          assunto: p.meuPerfil ? "O teste do seu perfil de criadora termina em 2 dias" : "Seu teste do Cria termina em 2 dias",
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
          assunto: p.meuPerfil ? "O teste do seu perfil de criadora terminou (está tudo guardado)" : "Seu teste do Cria terminou (seus dados estão guardados)",
          paragrafos: [
            "O período de teste acabou. Nada foi apagado: ideias, posts, brandbook e clientes continuam na sua conta esperando você voltar.",
            "Pra retomar de onde parou, é só escolher um plano. Cancela quando quiser, direto no app.",
          ],
          botao: { texto: "Retomar meu Cria", url: `${APP}/app/assinar` },
        });
        if (ok) { enviados.trial_d0 += 1; await marcar(p.id, "trial_d0", ref); }
      }
    }

    // ── 3b. TESTE COM CARTÃO: 5º dia (faltam 2) e véspera (03/11/2026) ──
    /* Quem está no teste da assinatura tem assinatura_teste_ate (gravado pelo
       stripe-webhook). Dias que faltam contados por calendário de Brasília:
       2 = 5º dia, 1 = véspera. Rodar duas vezes no dia não repete (emails_ciclo).
       Valor e cartão vêm do Stripe; se ele não responder, vai o preço de tabela
       e o e-mail sai sem a linha do cartão. */
    {
      const { data: emTeste, error: tErr } = await svc.from("profiles")
        .select("id, name, plan, stripe_subscription_id, assinatura_teste_ate, perfil_de")
        .not("assinatura_teste_ate", "is", null)
        .gt("assinatura_teste_ate", iso(now))
        .lte("assinatura_teste_ate", iso(now + 3 * dayMs));
      if (tErr) throw new Error("teste_cartao: " + tErr.message);
      const diaBR = (ms: number) => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date(ms));
      const hojeBR = Date.parse(diaBR(now));
      const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
      const stripe = stripeKey ? new Stripe(stripeKey, { apiVersion: "2024-06-20", httpClient: Stripe.createFetchHttpClient() }) : null;
      type Teste = { id: string; name: string | null; plan: string | null; stripe_subscription_id: string | null; assinatura_teste_ate: string; perfil_de: string | null };
      for (const t of await comEmail((emTeste ?? []) as Teste[])) {
        if (!t.email || t.perfil_de) continue;
        const fimMs = new Date(t.assinatura_teste_ate).getTime();
        const faltam = Math.round((Date.parse(diaBR(fimMs)) - hojeBR) / dayMs);
        const tipo = faltam === 2 ? "teste_d5" : faltam === 1 ? "teste_d6" : null;
        const ref = t.assinatura_teste_ate.slice(0, 10);
        if (!tipo || ja.has(`${t.id}:${tipo}:${ref}`)) continue;
        // Valor da próxima cobrança (com desconto, se tiver) e final do cartão.
        const plano = t.plan ?? "pro";
        let valor = PRECO_TABELA[plano] ?? PRECO_TABELA.pro;
        let cartao: string | null = null;
        if (stripe && t.stripe_subscription_id) {
          try {
            const prox = await stripe.invoices.retrieveUpcoming({ subscription: t.stripe_subscription_id });
            if (typeof prox.amount_due === "number") valor = prox.amount_due;
            const sub = await stripe.subscriptions.retrieve(t.stripe_subscription_id, { expand: ["default_payment_method"] });
            const pm = sub.default_payment_method as { card?: { last4?: string } } | null;
            cartao = pm?.card?.last4 ?? null;
          } catch (e) { console.warn("[lifecycle] stripe teste", t.id, mensagemDe(e)); }
        }
        const cobranca = { plano, valorCentavos: valor, cartaoFinal: cartao, cobrancaEm: new Date(fimMs) };
        let conteudo;
        if (tipo === "teste_d5") {
          const desde = iso(now - 8 * dayMs);
          const [ideias, cal, rot] = await Promise.all([
            svc.from("ideas").select("id", { count: "exact", head: true }).eq("user_id", t.id).gte("created_at", desde),
            svc.from("posts").select("id", { count: "exact", head: true }).eq("user_id", t.id).is("deleted_at", null).not("scheduled_date", "is", null),
            svc.from("posts").select("id", { count: "exact", head: true }).eq("user_id", t.id).is("deleted_at", null).not("script", "is", null).neq("script", ""),
          ]);
          conteudo = emailTesteD5(t.name, cobranca, { ideias: ideias.count ?? 0, postsCalendario: cal.count ?? 0, roteiros: rot.count ?? 0 }, APP);
        } else {
          conteudo = emailTesteD6(t.name, cobranca, APP);
        }
        const ok = await enviarEmail(svc, { para: t.email, etiqueta: tipo, de: REMETENTE_PESSOAL(), responderPara: RESPOSTAS_PARA(), ...conteudo });
        if (ok) { enviados[tipo] += 1; await marcar(t.id, tipo, ref); }
      }
    }

    // ── 4. Aprovação parada: posts esperando o cliente há 3+ dias ──
    const { data: parados, error: paradosErr } = await svc.from("posts")
      .select("user_id, title, updated_at")
      .eq("approval_status", "pendente").is("deleted_at", null)
      .not("external_client_id", "is", null)
      .lte("updated_at", iso(now - 3 * dayMs));
    if (paradosErr) throw new Error("parados: " + paradosErr.message);
    const porGestora = new Map<string, string[]>();
    for (const r of (parados ?? []) as { user_id: string; title: string | null }[]) {
      const arr = porGestora.get(r.user_id) ?? [];
      arr.push(r.title || "post sem título"); porGestora.set(r.user_id, arr);
    }
    if (porGestora.size > 0) {
      const ids = [...porGestora.keys()];
      const { data: gestorasSem, error: gErr } = await svc.from("profiles").select("id, name").in("id", ids);
      if (gErr) throw new Error("gestoras: " + gErr.message);
      const gestoras = await comEmail((gestorasSem ?? []) as { id: string; name: string | null }[]);
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
      const { data: donosSem, error: dErr } = await svc.from("profiles").select("id, name").in("id", [...porAgencia.keys()]);
      if (dErr) throw new Error("donos: " + dErr.message);
      const donos = await comEmail((donosSem ?? []) as { id: string; name: string | null }[]);
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

    // ── 6. E-MAILS PRA QUEM PAROU (30/10/2026, mockup aprovado) ──
    /* Assinados por Gabi e Walter, em primeira pessoa, com a resposta indo
       pra caixa do Admin (email-entrada). Regras:
         - no máximo UM re_* por pessoa a cada 7 dias (a confirmação de e-mail
           não conta: sem ela a pessoa nem entra);
         - quem assina sai da base (reengajamento_base só traz quem não está
           ativo) e quem volta a usar sai dos grupos de "sumiu"/"não usou";
         - "Descadastre aqui" desliga só estes e-mails (prefs.reengajamento).
       Cada pessoa cai em no máximo um grupo por rodada, na ordem abaixo. */
    const re = { re_confirmar: 0, re_comeco: 0, re_nao_usou: 0, re_trial: 0, re_sumiu: 0, re_volta_cancelou: 0 };
    {
      const SUPA = Deno.env.get("SUPABASE_URL")!;
      const { data: base, error: bErr } = await svc.rpc("reengajamento_base");
      if (bErr) throw new Error("reengajamento_base: " + bErr.message);
      type Base = {
        id: string; name: string | null; account_type: string | null; parceiro_role: string | null;
        created_at: string; last_seen_at: string | null; onboarding_completed: boolean;
        subscription_status: string | null; trial_ends_at: string | null; plan: string | null; access_expires_at: string | null;
        email: string | null; email_confirmado: boolean; n_ideias: number; n_posts: number; n_clientes: number; quer_receber: boolean;
      };
      // Último re_* de cada pessoa (trava de 7 dias) e quando cancelou.
      const { data: recentes } = await svc.from("emails_ciclo").select("user_id, tipo, sent_at")
        .or("tipo.like.re_%,tipo.eq.cancelou").gte("sent_at", iso(now - 60 * dayMs));
      const ultimoRe = new Map<string, number>();
      const cancelouEm = new Map<string, number>();
      for (const r of (recentes ?? []) as { user_id: string; tipo: string; sent_at: string }[]) {
        const t = Date.parse(r.sent_at);
        if (r.tipo === "cancelou") cancelouEm.set(r.user_id, Math.max(cancelouEm.get(r.user_id) ?? 0, t));
        else if (r.tipo !== "re_confirmar") ultimoRe.set(r.user_id, Math.max(ultimoRe.get(r.user_id) ?? 0, t));
      }
      const { data: jaRe } = await svc.from("emails_ciclo").select("user_id, tipo, ref").like("tipo", "re_%");
      const enviadoRe = new Set(((jaRe ?? []) as { user_id: string; tipo: string; ref: string | null }[]).map((r) => `${r.user_id}:${r.tipo}:${r.ref ?? ""}`));
      const dias = (s: string) => (now - Date.parse(s)) / dayMs;
      const link = async (user_id: string, tipo: "sair_da_lista" | "confirmar") => {
        const { data } = await svc.from("email_links").insert({ user_id, tipo }).select("token").single();
        const t = (data as { token: string } | null)?.token;
        return t ? `${SUPA}/functions/v1/email-link?a=${tipo === "confirmar" ? "c" : "s"}&t=${t}` : null;
      };
      const ASSINA = "Um abraço,\nGabi e Walter, do Cria";
      const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`;

      for (const b of (base ?? []) as Base[]) {
        if (!b.email) continue;
        const persona: "criador" | "sm" | "parceiro" =
          b.account_type === "manager" ? "sm" : b.account_type === "parceiro" ? "parceiro" : "criador";
        const dCriada = dias(b.created_at);
        const dVisto = b.last_seen_at ? dias(b.last_seen_at) : dCriada;
        const usou = persona === "sm" ? b.n_clientes > 0 || b.n_posts > 0 : b.n_ideias > 1 || b.n_posts > 0;
        const fimTeste = b.trial_ends_at ? Date.parse(b.trial_ends_at) : null;
        const planoLiberado = !!b.plan && !["free", "trial"].includes(b.plan)
          && (!b.access_expires_at || Date.parse(b.access_expires_at) > now);
        const temAcesso = persona !== "criador" || planoLiberado || (fimTeste !== null && fimTeste > now);

        // Escolhe UM grupo.
        let tipo: string | null = null, ref: string | null = null;
        if (!b.email_confirmado) {
          if (dCriada >= 1 && dCriada < 3) { tipo = "re_confirmar"; ref = "d1"; }
          else if (dCriada >= 3 && dCriada < 6) { tipo = "re_confirmar"; ref = "d3"; }
        } else if (b.quer_receber && now - (ultimoRe.get(b.id) ?? 0) >= 7 * dayMs) {
          const cancelou = cancelouEm.get(b.id);
          if (b.subscription_status === "canceled") {
            if (cancelou && dias(new Date(cancelou).toISOString()) >= 30 && dias(new Date(cancelou).toISOString()) < 45) {
              tipo = "re_volta_cancelou"; ref = new Date(cancelou).toISOString().slice(0, 10);
            }
          } else if (persona !== "parceiro" && !usou && !b.onboarding_completed && dCriada >= 1 && dCriada < 4) {
            tipo = "re_comeco";
          } else if (persona !== "parceiro" && !usou && temAcesso && dCriada < 45 && dVisto >= 7 && enviadoRe.has(`${b.id}:re_nao_usou:d3`)) {
            tipo = "re_nao_usou"; ref = "d7";
          } else if (persona !== "parceiro" && !usou && temAcesso && dCriada < 30 && dVisto >= 3) {
            tipo = "re_nao_usou"; ref = "d3";
          } else if (persona === "criador" && !planoLiberado && fimTeste !== null && fimTeste <= now) {
            const dFim = (now - fimTeste) / dayMs;
            if (dFim >= 21 && dFim < 40) { tipo = "re_trial"; ref = "d21:" + b.trial_ends_at!.slice(0, 10); }
            else if (dFim >= 7 && dFim < 20) { tipo = "re_trial"; ref = "d7:" + b.trial_ends_at!.slice(0, 10); }
          } else if (persona !== "parceiro" && usou && temAcesso && b.last_seen_at) {
            const visto = b.last_seen_at.slice(0, 10);
            if (dVisto >= 30 && dVisto < 60) { tipo = "re_sumiu"; ref = "30:" + visto; }
            else if (dVisto >= 14 && dVisto < 30) { tipo = "re_sumiu"; ref = "14:" + visto; }
          }
        }
        if (!tipo || enviadoRe.has(`${b.id}:${tipo}:${ref ?? ""}`)) continue;

        const sm = persona === "sm";
        const casa = sm ? `${APP}/socialmidia/dashboard` : `${APP}/app`;
        const sair = tipo === "re_confirmar" ? null : await link(b.id, "sair_da_lista");
        const pessoal = { de: REMETENTE_PESSOAL(), responderPara: RESPOSTAS_PARA(), assinatura: ASSINA, sairUrl: sair };
        let ok = false;

        if (tipo === "re_confirmar") {
          const url = await link(b.id, "confirmar");
          if (!url) continue;
          ok = await enviarEmail(svc, {
            para: b.email, nome: b.name, etiqueta: "re_confirmar_" + ref,
            assunto: "Falta um clique pra sua conta abrir", titulo: "Sua conta ainda está fechada", tag: "Quase lá", tema: "amarelo",
            paragrafos: [
              "Você criou sua conta no Cria, mas o e-mail de confirmação ficou parado. Sem ele, a gente não consegue abrir seus 7 dias grátis.",
              "É só tocar no botão: ele confirma o seu e-mail e já entra na sua conta.",
            ],
            botao: { texto: "Abrir minha conta", url },
            rodape: "Não foi você que criou a conta? Ignore este e-mail.",
          });
        } else if (tipo === "re_comeco") {
          ok = await enviarEmail(svc, {
            para: b.email, nome: b.name, etiqueta: "re_comeco_" + persona, ...pessoal,
            assunto: "Seu Cria ficou pela metade", titulo: "Faltam só as telas do começo", tag: "Começo", tema: "azul",
            paragrafos: sm
              ? ["Você entrou no Cria, mas as telas do começo ficaram pela metade. São elas que montam a sua área de clientes do jeito que você trabalha.",
                "Leva uns 3 minutos. A conta de social mídia é grátis até 3 clientes."]
              : ["Você entrou no Cria, mas as telas do começo ficaram pela metade. São elas que contam pra Cria IA o seu nicho e o seu jeito de falar, e é isso que faz as ideias saírem com a sua cara.",
                "Leva uns 3 minutos, e seus 7 dias grátis continuam correndo."],
            botao: { texto: "Terminar meu começo", url: casa },
          });
        } else if (tipo === "re_nao_usou") {
          const d7 = ref === "d7";
          const c = sm
            ? d7
              ? { assunto: "O link de aprovação que acaba com o print no WhatsApp", titulo: "Testa com um post só",
                paragrafos: ["Faz uma semana que sua área de social mídia está vazia. Um jeito rápido de ver se o Cria serve pra você: cadastra um cliente, sobe um post e manda o link de aprovação.",
                  "O cliente abre no celular, aprova ou marca o ajuste em cima da imagem, e você vê tudo num lugar só. A conta é grátis até 3 clientes.",
                  "Se alguma coisa travou, responde este e-mail e conta pra gente."],
                botao: { texto: "Cadastrar meu primeiro cliente", url: `${APP}/socialmidia/clientes` } }
              : { assunto: "Seu primeiro cliente no Cria, em 5 minutos", titulo: "Comece por um cliente só",
                paragrafos: ["Não precisa migrar a carteira inteira. Põe um cliente, sobe 3 posts e manda o link pra ele aprovar pelo celular. É aí que o Cria mostra o que faz: acabou o \"aprovou no áudio\".",
                  "A conta de social mídia é grátis até 3 clientes."],
                botao: { texto: "Cadastrar meu primeiro cliente", url: `${APP}/socialmidia/clientes` } }
            : d7
              ? { assunto: "Ainda dá tempo de testar o Cria de verdade", titulo: "Uma ideia vira post em 10 minutos",
                paragrafos: ["Faz uma semana que você criou sua conta e ela ainda está vazia. Sem pressão: a gente sabe que começar ferramenta nova cansa.",
                  "Um teste que vale: escolhe um assunto que você já domina, pede 5 ideias pra Cria IA e leva a melhor pro quadro. Em 10 minutos você tem gancho, roteiro e legenda.",
                  "Se travou em alguma coisa, responde este e-mail e conta. A gente lê e responde."],
                botao: { texto: "Pedir minhas 5 ideias", url: `${APP}/app/ideias` } }
              : { assunto: "Sua primeira ideia leva 2 minutos", titulo: "Bora tirar uma ideia da cabeça?",
                paragrafos: ["O jeito mais rápido de sentir o Cria é guardar uma ideia que está rondando sua cabeça. Escreve do jeito que vier: a Cria IA transforma em gancho, roteiro e legenda no seu tom.",
                  "São 2 minutos, e seus 7 dias grátis continuam correndo."],
                botao: { texto: "Guardar minha primeira ideia", url: `${APP}/app/ideias` } };
          ok = await enviarEmail(svc, { para: b.email, nome: b.name, etiqueta: `re_nao_usou_${ref}_${persona}`, tag: "Começo", tema: "azul", ...pessoal, ...c });
        } else if (tipo === "re_trial") {
          if (ref!.startsWith("d21")) {
            ok = await enviarEmail(svc, {
              para: b.email, nome: b.name, etiqueta: "re_trial_d21", ...pessoal,
              assunto: "50% no primeiro mês, se quiser voltar", titulo: "A porta continua aberta", tag: "Volta", tema: "laranja",
              paragrafos: [
                "Passaram três semanas desde o fim do seu teste. Se o Cria ainda faz sentido pra sua rotina, deixamos um cupom: VOLTA50 dá 50% de desconto no primeiro mês de qualquer plano.",
                "O cupom já vai preenchido no botão. Depois do primeiro mês o plano segue no preço normal, e dá pra cancelar quando quiser, direto no app.",
                "E se não faz mais sentido, tudo bem. Se puder contar o porquê, responde este e-mail: ajuda muito a gente.",
              ],
              botao: { texto: "Usar meu cupom", url: `${APP}/app/assinar?cupom=VOLTA50` },
            });
          } else {
            const guardado = usou
              ? `Seu teste acabou, mas tudo ficou guardado: ${plural(b.n_ideias, "ideia", "ideias")}, ${plural(b.n_posts, "post", "posts")} e o seu Brandbook. É só assinar pra continuar de onde parou.`
              : "Seu teste acabou antes de dar tempo de usar, né? Acontece, a rotina engole. Sua conta continua aqui, do jeito que você deixou.";
            ok = await enviarEmail(svc, {
              para: b.email, nome: b.name, etiqueta: "re_trial_d7", ...pessoal,
              assunto: usou ? "Suas ideias continuam aqui" : "O que faltou pra você testar o Cria?",
              titulo: "Nada do que você criou sumiu", tag: "Seu Cria", tema: "verde",
              paragrafos: [guardado, "Uma pergunta rápida: o que faltou pra você ficar? Responde este e-mail com uma frase. A gente lê tudo."],
              botao: { texto: "Voltar pro meu Cria", url: `${APP}/app/assinar` },
            });
          }
        } else if (tipo === "re_sumiu") {
          const trinta = ref!.startsWith("30");
          ok = await enviarEmail(svc, {
            para: b.email, nome: b.name, etiqueta: `re_sumiu_${trinta ? 30 : 14}_${persona}`, ...pessoal,
            tag: "Saudade", tema: "rosa",
            ...(trinta
              ? { assunto: "Faz um mês. Tá tudo bem por aí?", titulo: "Seu Cria está guardado",
                paragrafos: ["Faz um mês que você não aparece no Cria. Tudo o que você montou continua lá, do jeito que deixou.",
                  "Se o Cria deixou de servir, conta pra gente o motivo respondendo este e-mail. É a resposta que mais nos ajuda a melhorar.",
                  sm ? "Se só faltou tempo, começa pelo cliente que mais te cobra: um post na aprovação já põe a semana pra andar."
                     : "Se só faltou tempo, um post por semana já mantém o perfil vivo. Começa pelo mais fácil."] }
              : { assunto: sm ? "Sua semana de clientes está parada no Cria" : "Sua semana de conteúdo está em branco", titulo: "Volta com uma coisa só",
                paragrafos: sm
                  ? ["Faz duas semanas que você não passa no Cria. Se a carteira voltou toda pro WhatsApp, a gente entende: rotina de social mídia engole.",
                    "Pra voltar sem peso: abre a agenda da semana e manda um post pra aprovação. O resto vem atrás."]
                  : ["Faz duas semanas que você não passa no Cria. Acontece, a rotina engole.",
                    "Pra voltar sem peso: abre o banco de ideias, escolhe a que mais te anima e manda pra Cria IA montar o post."] }),
            botao: { texto: sm ? "Abrir minha agenda" : "Ver minhas ideias", url: sm ? casa : `${APP}/app/ideias` },
          });
        } else if (tipo === "re_volta_cancelou") {
          ok = await enviarEmail(svc, {
            para: b.email, nome: b.name, etiqueta: "re_volta_cancelou", ...pessoal,
            assunto: "Um mês depois: 50% pra você voltar", titulo: "Seus dados ainda estão aqui", tag: "Volta", tema: "laranja",
            paragrafos: [
              "Faz um mês que você cancelou. Seus dados continuam guardados por mais um mês e, se quiser voltar, deixamos um cupom: VOLTA50 dá 50% de desconto no primeiro mês.",
              "O cupom já vai preenchido no botão, e dá pra cancelar quando quiser, direto no app.",
              "Se você saiu por alguma coisa que a gente pode resolver, responde este e-mail e conta.",
            ],
            botao: { texto: "Voltar com 50%", url: `${APP}/app/assinar?cupom=VOLTA50` },
          });
        }
        if (ok) {
          re[tipo as keyof typeof re] += 1;
          enviadoRe.add(`${b.id}:${tipo}:${ref ?? ""}`);
          if (tipo !== "re_confirmar") ultimoRe.set(b.id, now);
          await svc.from("emails_ciclo").insert({ user_id: b.id, tipo, ref });
        }
      }
    }

    await svc.from("cron_runs").upsert({ job: "lifecycle-emails", last_run_at: new Date().toISOString(), ok: true, detail: JSON.stringify({ ...enviados, inventario_vencendo: inventario, ...re }) }, { onConflict: "job" });
    return json({ ok: true, enviados, re });
  } catch (e) {
    const svcLog = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    await registrarErro(svcLog, "lifecycle-emails", mensagemDe(e));
    await svcLog.from("cron_runs").upsert({ job: "lifecycle-emails", last_run_at: new Date().toISOString(), ok: false, detail: mensagemDe(e) }, { onConflict: "job" });
    return json({ error: "internal_error" }, 500);
  }
});
