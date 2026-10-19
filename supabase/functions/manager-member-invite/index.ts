import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { molduraCria, REMETENTE_CRIA } from "../_shared/email-moldura.ts";
import { createClient, SupabaseClient } from "npm:@supabase/supabase-js@2";
import { registrarErro, mensagemDe } from "../_shared/log.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

const DEFAULT_MODULES = ["cria_post", "cria_gestao", "hub_cria", "agenda"];

// Escapa valores interpolados no HTML do e-mail (nome da agência etc.). (F12/F24)
function escapeHtml(v: unknown): string {
  return String(v ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// Origin confiável pro link de ativação (F13): APP_URL fixo ou allow-list, caindo
// no domínio canônico. Nunca monta o link só com o header Origin cru.
const CANONICAL_APP_URL = "https://app.criasocialclub.com.br";
function resolveAppUrl(req: Request): string {
  const fixed = Deno.env.get("APP_URL");
  if (fixed) return fixed.replace(/\/+$/, "");
  const origin = req.headers.get("origin") ?? "";
  const allow = [
    "https://app.criasocialclub.com.br",
    "https://criasocialclub.com.br",
    "https://www.criasocialclub.com.br",
  ];
  if (allow.includes(origin)) return origin;
  /* SEM CURINGA DE PREVIEW (pente fino 23/09/2026, S1). Aceitar qualquer
     *.lovable.app vindo do Origin deixava um atacante mandar o link de senha
     da vítima pra um domínio dele. Preview do Lovable usa APP_URL ou cai no
     canônico, que também funciona. */
  return CANONICAL_APP_URL;
}

async function ensureUnsubscribeToken(svc: SupabaseClient, email: string): Promise<string> {
  const token = crypto.randomUUID();
  await svc.from("email_unsubscribe_tokens").upsert({ email, token }, { onConflict: "email", ignoreDuplicates: true });
  const { data } = await svc.from("email_unsubscribe_tokens").select("token").eq("email", email).single();
  return (data?.token as string) ?? token;
}

function emailHtml(opts: { managerName: string; actionLink: string; existing: boolean; parceiro: boolean }): string {
  // Quem já tem conta recebe magiclink (não define senha nenhuma) e o parceiro
  // não "entra na conta da agência": entra na fila dele (auditoria 07/09).
  const acao = opts.existing
    ? "Toque no botão pra entrar com a sua conta de sempre"
    : "Toque no botão pra acessar e definir sua senha";
  const onde = opts.parceiro
    ? "as demandas que ela te mandar já aparecem na sua fila, com prazo e material."
    : "você já entra direto na conta da agência pra trabalhar.";
  return molduraCria({
    tag: "Equipe", tema: "azul", titulo: "Você entrou pra equipe",
    corpoHtml: `<b>${escapeHtml(opts.managerName)}</b> te convidou pra colaborar no Cria. ${acao}: ${onde}`,
    botao: { texto: "Acessar a equipe", url: opts.actionLink }, linkReserva: true,
  });
}

// Convite por email, usado pelos dois caminhos (colaborador e parceiro).
// deno-lint-ignore no-explicit-any
async function enviarEmailConvite(svc: any, prof: unknown, normEmail: string, actionLink: string, existing: unknown, parceiro = false) {
  const managerName = (prof as { name?: string } | null)?.name ?? "Sua agência";
  const messageId = crypto.randomUUID();
  const unsub = await ensureUnsubscribeToken(svc, normEmail);
  await svc.rpc("enqueue_email", {
    queue_name: "transactional_emails",
    payload: {
      to: normEmail,
      subject: "Você entrou pra uma equipe no Cria",
      from: REMETENTE_CRIA,
      sender_domain: "notify.criasocialclub.com.br",
      purpose: "transactional",
      html: emailHtml({ managerName, actionLink, existing: !!existing, parceiro }),
      text: `${managerName} te adicionou à equipe no Cria: ${actionLink}`,
      label: existing ? "team_invite_existing" : "team_invite_new",
      idempotency_key: messageId, unsubscribe_token: unsub, message_id: messageId,
      queued_at: new Date().toISOString(),
    },
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "unauthorized" }, 401);

    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user || !user.email) return json({ error: "unauthorized" }, 401);

    const svc = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const body = await req.json().catch(() => ({}));
    const { email, name, modules, all_clients, client_ids, role, manager_id } = body as {
      email?: string; name?: string; modules?: string[]; all_clients?: boolean; client_ids?: string[]; role?: string;
      manager_id?: string;
    };
    if (!email) return json({ error: "missing_email" }, 400);

    /* QUEM GERENCIA A EQUIPE (19/10/2026): a colaboradora com a chave
       "Pode gerenciar a equipe" convida em nome da conta (manager_id). O
       banco confere com a sessão dela (pode_gerir_equipe); sem a chave, 403.
       Sem manager_id, é a própria dona convidando, como sempre foi. */
    let managerId = user.id;
    if (typeof manager_id === "string" && manager_id && manager_id !== user.id) {
      const { data: pode, error: podeErr } = await userClient.rpc("pode_gerir_equipe", { _manager: manager_id });
      if (podeErr || pode !== true) return json({ error: "forbidden" }, 403);
      managerId = manager_id;
    }

    // Papel do vínculo. Lista fechada: qualquer coisa fora dela vira o
    // colaborador padrão, nunca um papel inventado pelo chamador.
    const PAPEIS = ["social_media", "designer", "editor_video", "copy", "trafego", "filmmaker"];
    const papel = PAPEIS.includes(role ?? "") ? (role as string) : "social_media";
    const ehParceiro = papel !== "social_media";

    const normEmail = String(email).trim().toLowerCase();
    if (normEmail === user.email.toLowerCase()) return json({ error: "cannot_invite_self" }, 400);

    // ── Checa assento: 1 grátis + paid_collab_seats. Conta membros ATIVOS atuais. ──
    const { data: prof } = await svc.from("profiles").select("name, paid_collab_seats").eq("id", managerId).maybeSingle();
    const paidSeats = Math.max(0, Number((prof as { paid_collab_seats?: number } | null)?.paid_collab_seats) || 0);
    const allowed = 1 + paidSeats;
    // Parceiro (designer, editor, copy, tráfego) NÃO consome assento: ele entra
    // de graça e só enxerga o card atribuído a ele. Quem precisa de CRM,
    // financeiro e carteira continua sendo colaborador e continua custando.
    // São públicos diferentes, não dois preços pro mesmo acesso.
    const { count: activeCount } = await svc.from("manager_members")
      .select("id", { count: "exact", head: true })
      .eq("manager_id", managerId).eq("status", "ativo")
      .not("role", "in", "(designer,editor_video,copy,trafego,filmmaker)");
    if (!ehParceiro && (activeCount ?? 0) >= allowed) {
      return json({ error: "no_seats", allowed, used: activeCount ?? 0 }, 402);
    }

    // ── Já existe conta com esse email? magic link : convite ──
    const { data: list } = await svc.auth.admin.listUsers();
    const existing = list?.users?.find((u) => u.email?.toLowerCase() === normEmail);
    // A dona da conta não entra como membro da própria conta.
    if (existing && existing.id === managerId) return json({ error: "cannot_invite_self" }, 400);

    const origin = resolveAppUrl(req); // F13: origin validado, não o header cru
    // O destino depende do papel: parceiro cai direto na fila dele, não no
    // dashboard da agência (que ele nem consegue usar).
    const destino = ehParceiro ? "/socialmidia/demandas" : "/socialmidia/dashboard";
    const type: "magiclink" | "invite" = existing ? "magiclink" : "invite";
    const { data: linkData, error: linkErr } = await svc.auth.admin.generateLink({
      type, email: normEmail, options: { redirectTo: origin + destino },
    });
    if (linkErr || !linkData?.user) {
      console.error("[manager-member-invite] generateLink failed:", linkErr);
      return json({ error: "link_failed" }, 400);
    }
    const memberId = linkData.user.id;
    const hashed = linkData.properties?.hashed_token;
    const actionLink = hashed
      ? `${origin}/ativar?th=${hashed}&type=${type}&to=${encodeURIComponent(destino)}`
      : (linkData.properties?.action_link ?? origin);

    // ── Vínculo + permissões default (todos os clientes nos módulos escolhidos) ──
    const { data: memberRow, error: mErr } = await svc.from("manager_members").upsert({
      manager_id: managerId, member_id: memberId, name: name ?? null, email: normEmail, status: "ativo",
      role: papel,
    }, { onConflict: "manager_id,member_id" }).select("id").single();
    if (mErr || !memberRow) {
      console.error("[manager-member-invite] member upsert failed:", mErr);
      return json({ error: "member_link_failed" }, 500);
    }
    if (ehParceiro) {
      // Conta que NASCE de convite de parceiro não é uma conta de criador em
      // trial: sem isto, o trigger de perfil dava 7 dias de Studio e o designer
      // caia num dashboard com "todos os modulos ativos" que nao eram dele.
      // Conta que JA EXISTIA (criador que tambem produz pra agencia) fica como
      // esta: virar parceiro nao pode derrubar o plano de ninguem.
      if (!existing) {
        // O parceiro JA NASCE conta de gestao (account_type manager): a area
        // dele e uma secao do painel de gestao, nao outro mundo. Sem trial de
        // criador (o trigger de perfil dava 7 dias de Studio).
        // O perfil nasce por trigger no auth.users; se o trigger ainda não
        // tiver corrido, o update não acha linha e o parceiro cairia como
        // criador em trial. Confere e tenta de novo uma vez (auditoria 07/09).
        // must_change_password: o e-mail diz "defina sua senha", mas o link
        // mágico entrava sem senha nenhuma e, expirada a sessão, a pessoa não
        // voltava mais. Com a flag, o app leva pra /app/trocar-senha na entrada.
        const ajuste = { plan: "free", trial_started_at: null, trial_ends_at: null, account_type: "manager", must_change_password: true };
        let { data: upd, error: updErr } = await svc.from("profiles").update(ajuste).eq("id", memberId).select("id");
        if (updErr || !upd?.length) {
          await new Promise((r) => setTimeout(r, 1500));
          ({ data: upd, error: updErr } = await svc.from("profiles").update(ajuste).eq("id", memberId).select("id"));
        }
        if (updErr || !upd?.length) console.error("[manager-member-invite] perfil do parceiro não ajustado:", updErr?.message ?? "sem linha");
      }
      // Parceiro não recebe módulo nenhum: o acesso dele é por card, via as
      // RPCs parceiro_*. Dar módulo aqui seria abrir o CRM pra quem só produz.
      await enviarEmailConvite(svc, prof, normEmail, actionLink, existing, true);
      return json({ ok: true, member_id: memberId, existed: !!existing, role: papel });
    }

    // Colaborador novo (social mídia da equipe) também entra por link mágico
    // sem senha: mesma trava, define a senha na primeira entrada.
    if (!existing) {
      const { error: senhaErr } = await svc.from("profiles").update({ must_change_password: true }).eq("id", memberId);
      if (senhaErr) console.warn("[manager-member-invite] must_change_password não marcado:", senhaErr.message);
    }

    const mods = Array.isArray(modules) && modules.length ? modules : DEFAULT_MODULES;
    // Escopo de clientes: "todos" (all_clients) ou lista específica (client_ids). Mesmo escopo p/ todos os módulos.
    const allCli = all_clients !== false; // default = todos
    const cliIds = !allCli && Array.isArray(client_ids) ? client_ids.filter((x) => typeof x === "string") : [];
    const perms = mods.map((code) => ({
      member_row_id: (memberRow as { id: string }).id, module_code: code, all_clients: allCli, client_ids: cliIds,
    }));
    await svc.from("manager_member_permissions").upsert(perms, { onConflict: "member_row_id,module_code" });

    // ── Email de convite ──
    await enviarEmailConvite(svc, prof, normEmail, actionLink, existing);

    return json({ ok: true, member_id: memberId, existed: !!existing });
  } catch (e) {
    await registrarErro(createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!), "manager-member-invite", mensagemDe(e));
    return json({ error: "internal_error" }, 500);
  }
});
