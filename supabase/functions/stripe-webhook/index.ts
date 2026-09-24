import { createClient } from "npm:@supabase/supabase-js@2";
import Stripe from "npm:stripe@14";
import { enviarEmail } from "../_shared/enviar-email.ts";
import { registrarErro, mensagemDe } from "../_shared/log.ts";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, {
  apiVersion: "2024-06-20",
  httpClient: Stripe.createFetchHttpClient(),
});

const DEDUCTION_PCT_FALLBACK = 10; // fallback se partner_program_config não tiver linha

// Mantém em sincronia com STORAGE_BYTES do src/lib/plans.ts (runtime Deno não importa o frontend)
const STORAGE_BY_PLAN: Record<string, number> = {
  essencial: 524288000,   // 500 MB
  pro: 5368709120,        // 5 GB
  studio: 16106127360,    // 15 GB
};

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

async function sha256(input: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input.trim().toLowerCase()));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

// supabase-js NÃO lança em erro de DB (retorna { error }). Sem isto, uma gravação
// que falha passa despercebida e o webhook responde 200 → cliente paga e não ativa.
// Lançar aqui faz o handler retornar 500 e o Stripe reentregar o evento.
function must<T>(res: { error: unknown; data?: T }, label: string): { error: unknown; data?: T } {
  if (res.error) throw new Error(`${label}: ${JSON.stringify(res.error)}`);
  return res;
}

// Purchase server-side no Meta CAPI (fonte da verdade: só dispara quando o Stripe confirma).
// event_id = purchase-<session_id> → o Meta deduplica com o Purchase do navegador (/app/obrigado).
async function sendMetaPurchase(s: Stripe.Checkout.Session): Promise<void> {
  const PIXEL_ID = Deno.env.get("META_PIXEL_ID");
  const TOKEN = Deno.env.get("META_CAPI_TOKEN");
  if (!PIXEL_ID || !TOKEN) return;
  try {
    const value = (s.amount_total ?? 0) / 100;
    const currency = (s.currency ?? "brl").toUpperCase();
    const email = s.customer_details?.email ?? undefined;
    const user_data: Record<string, unknown> = {};
    if (email) user_data.em = [await sha256(email)];
    const payload = {
      data: [{
        event_name: "Purchase",
        event_time: Math.floor(Date.now() / 1000),
        event_id: `purchase-${s.id}`,
        action_source: "website",
        event_source_url: "https://app.criasocialclub.com.br/app/obrigado",
        user_data,
        custom_data: { value, currency },
      }],
    };
    // Timeout: o CAPI roda inline no handler; um hang do Graph não pode atrasar a
    // resposta ao Stripe (senão o Stripe marca falha e reentrega o evento).
    const ac = new AbortController();
    const t = setTimeout(() => ac.abort(), 8000);
    try {
      const res = await fetch(`https://graph.facebook.com/v19.0/${PIXEL_ID}/events?access_token=${encodeURIComponent(TOKEN)}`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload), signal: ac.signal,
      });
      if (!res.ok) console.error("[stripe-webhook] meta capi purchase error", res.status, await res.text());
    } finally { clearTimeout(t); }
  } catch (e) { console.error("[stripe-webhook] meta capi purchase failed", e); }
}

/** Mapeia o price do Stripe pro nome do plano. Null quando não é plano de criador. */
function planFromPrice(priceId: string): string | null {
  if (!priceId) return null;
  if (priceId === Deno.env.get("STRIPE_PRICE_ESSENCIAL")) return "essencial";
  if (priceId === Deno.env.get("STRIPE_PRICE_PRO")) return "pro";
  if (priceId === Deno.env.get("STRIPE_PRICE_STUDIO")) return "studio";
  return null;
}

/* E-MAIL DE PAGAMENTO FALHOU (pente fino 23/09/2026, B6). Antes o cliente
   inadimplente descobria quando a IA parava. Vai pela mesma fila dos outros
   transacionais. Falha aqui nunca derruba o webhook. */
async function avisarPagamentoFalhou(email: string, nome: string | null, valorCents: number, moeda: string) {
  try {
    const valor = (valorCents / 100).toLocaleString("pt-BR", { style: "currency", currency: (moeda || "brl").toUpperCase() });
    const appUrl = Deno.env.get("APP_URL") ?? "https://app.criasocialclub.com.br";
    const link = `${appUrl}/app/assinar`;
    const html = `<div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;color:#1a1a2e">
      <p>Oi${nome ? `, ${nome}` : ""}.</p>
      <p>Tentamos cobrar a sua assinatura do Cria (${valor}) e o pagamento não passou. Isso acontece por limite do cartão, cartão vencido ou bloqueio do banco.</p>
      <p>O Stripe vai tentar de novo nos próximos dias. Se preferir resolver agora, atualize o cartão por aqui:</p>
      <p><a href="${link}" style="display:inline-block;background:#EA4918;color:#fff;padding:12px 20px;border-radius:12px;text-decoration:none;font-weight:bold">Atualizar forma de pagamento</a></p>
      <p style="color:#6b7280;font-size:13px">Enquanto isso, seu acesso continua. Se a cobrança não passar depois das tentativas, a assinatura é pausada.</p>
    </div>`;
    const messageId = crypto.randomUUID();
    await supabase.rpc("enqueue_email", {
      queue_name: "transactional_emails",
      payload: {
        to: email,
        subject: "Não conseguimos cobrar sua assinatura do Cria",
        from: "cria <noreply@criasocialclub.com.br>",
        sender_domain: "notify.criasocialclub.com.br",
        purpose: "transactional",
        html,
        text: `Tentamos cobrar sua assinatura do Cria (${valor}) e o pagamento não passou. Atualize o cartão em ${link}`,
        label: "payment_failed",
        idempotency_key: messageId,
        message_id: messageId,
        queued_at: new Date().toISOString(),
      },
    });
  } catch (e) {
    console.error("[webhook] avisarPagamentoFalhou", e);
  }
}

Deno.serve(async (req) => {
  const signature = req.headers.get("stripe-signature");
  const body = await req.text();
  const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET")!;

  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(body, signature!, webhookSecret);
  } catch (err) {
    console.error("[stripe-webhook] signature verification failed:", err);
    return new Response("Webhook Error", { status: 400 });
  }

  const obj = event.data.object as Record<string, unknown>;

  // ── Filtro de app: ignora eventos que não são do cria ──
  const appTag = (obj?.metadata as Record<string, string> | undefined)?.app;
  if (appTag && appTag !== "cria") {
    return new Response(JSON.stringify({ received: true, ignored: true }), { status: 200 });
  }

  // ── Idempotência ATÔMICA: reivindica o evento inserindo ANTES de processar.
  // O UNIQUE(gateway, event_id) garante que duas entregas concorrentes do mesmo
  // evento não sejam processadas em paralelo (a 2ª bate em 23505 e sai como duplicata).
  const { error: claimErr } = await supabase.from("billing_events").insert({
    gateway: "stripe",
    event_id: event.id,
    type: event.type,
    payload: obj,
  });
  if (claimErr) {
    // 23505 = unique_violation → já processado (ou processando agora). Idempotente.
    if ((claimErr as { code?: string }).code === "23505") {
      return new Response(JSON.stringify({ received: true, duplicate: true }), { status: 200 });
    }
    console.error("[stripe-webhook] billing_events claim error:", claimErr);
    return new Response("Handler Error", { status: 500 }); // Stripe reentrega
  }

  try {
    switch (event.type) {
      case "checkout.session.completed":
      case "checkout.session.async_payment_succeeded": {
        const s = event.data.object as Stripe.Checkout.Session;
        /* SÓ LIBERA O QUE FOI PAGO (pente fino 23/09/2026, S6). Com boleto ou
           outro meio assíncrono, o `checkout.session.completed` chega ANTES do
           dinheiro. Liberar aqui era dar acesso de graça até o boleto vencer.
           Quando o pagamento assíncrono confirma, o Stripe manda
           `async_payment_succeeded`, que cai neste mesmo bloco e libera. */
        if (s.payment_status !== "paid" && s.payment_status !== "no_payment_required") {
          console.log("[webhook] checkout ainda nao pago, aguardando:", s.id, s.payment_status);
          break;
        }
        // ── ASSENTOS DE COLABORADOR: provisiona paid_collab_seats ──
        if (s.metadata?.kind === "collab_seats") {
          const managerId = s.metadata?.manager_id;
          const seats = Math.max(0, Math.floor(Number(s.metadata?.seats) || 0));
          if (managerId) {
            must(await supabase.from("profiles").update({
              paid_collab_seats: seats,
              collab_seats_subscription_id: s.subscription as string,
            }).eq("id", managerId), "profiles collab_seats activate");
          }
          break;
        }
        // ── PACOTES DE CLIENTES: provisiona paid_client_packs (carteira CRM) ──
        if (s.metadata?.kind === "client_packs") {
          const managerId = s.metadata?.manager_id;
          const packs = Math.max(0, Math.floor(Number(s.metadata?.packs) || 0));
          if (managerId) {
            must(await supabase.from("profiles").update({
              paid_client_packs: packs,
              client_packs_subscription_id: s.subscription as string,
            }).eq("id", managerId), "profiles client_packs activate");
          }
          break;
        }
        // ── MÓDULO PAGO: cria o entitlement e NÃO toca na assinatura-base ──
        if (s.metadata?.kind === "module") {
          const moduleCode = s.metadata?.module_code;
          const managerId = s.metadata?.manager_id;
          if (moduleCode && managerId) {
            must(await supabase.from("module_entitlements").upsert({
              manager_id: managerId,
              module_code: moduleCode,
              status: "active",
              stripe_customer_id: s.customer as string,
              stripe_subscription_id: s.subscription as string,
              updated_at: new Date().toISOString(),
            /* A UNICIDADE DA TABELA É (manager_id, module_code) (pente fino
               23/09/2026, B2). Com onConflict pelo subscription_id, recomprar um
               módulo cancelado dava INSERT em cima da linha antiga, violava a
               unicidade, o must() lançava, o evento era desfeito e o Stripe
               reenviava pra sempre: a pessoa pagava e não recebia. */
            }, { onConflict: "manager_id,module_code" }), "module_entitlements upsert");
            // Módulo traz ESPAÇO junto (3 GB base + 3 GB por módulo). Sem este
            // recálculo ela compra o módulo e continua com os 500 MB de trial 
            // bate numa parede invisível no meio da operação, com cliente esperando.
            await supabase.rpc("recalc_manager_storage", { _manager: managerId });
            // E-mail de confirmação da compra do módulo (pente fino 23/09/2026).
            const { data: dono } = await supabase.from("profiles").select("email, name").eq("id", managerId).maybeSingle();
            const NOME_MODULO: Record<string, string> = { aprovapost_externo: "Cria Post", crm: "Cria Gestão", financeiro: "Cria Caixa", hub_cria: "Hub Cria", cria_captacao: "Cria Captação" };
            if (dono?.email) {
              await enviarEmail(supabase, {
                para: dono.email, nome: dono.name, etiqueta: "modulo_comprado",
                assunto: `${NOME_MODULO[moduleCode] ?? "Módulo"} ativado na sua conta`,
                paragrafos: [
                  `O ${NOME_MODULO[moduleCode] ?? "módulo"} já está liberado no seu painel. A cobrança é mensal e aparece no Stripe como "Cria".`,
                  "Pra cancelar ou trocar o cartão, é em Configurações > Gerenciar cobrança, sem precisar falar com ninguém.",
                ],
                botao: { texto: "Abrir o painel", url: `${Deno.env.get("APP_URL") ?? "https://app.criasocialclub.com.br"}/socialmidia/dashboard` },
              });
            }
          }
          break;
        }
        // ── COMPRA DIRETA PELA LP (Payment Link): a sessão não tem os metadados
        //    do app porque a pessoa pode nem ter conta ainda. Guarda a compra
        //    por e-mail + session_id; o cadastro reivindica via claim-purchase.
        //    Se já existir conta com o e-mail do pagador, ativa na hora. ──
        if (!s.metadata?.user_id && s.payment_link && s.subscription) {
          const email = (s.customer_details?.email ?? "").toLowerCase();
          let plinkPlan: string | null = null;
          try {
            const sub = await stripe.subscriptions.retrieve(s.subscription as string);
            const priceId = sub.items?.data?.[0]?.price?.id ?? "";
            if (priceId === Deno.env.get("STRIPE_PRICE_ESSENCIAL")) plinkPlan = "essencial";
            else if (priceId === Deno.env.get("STRIPE_PRICE_PRO")) plinkPlan = "pro";
            else if (priceId === Deno.env.get("STRIPE_PRICE_STUDIO")) plinkPlan = "studio";
          } catch (e) { console.error("[webhook] plink sub retrieve", e); }
          if (!plinkPlan) { console.error("[webhook] plink sem plano mapeado", s.id); break; }

          await supabase.from("pending_purchases").upsert({
            session_id: s.id,
            email,
            plan: plinkPlan,
            stripe_customer_id: s.customer as string,
            stripe_subscription_id: s.subscription as string,
            status: "pending",
          }, { onConflict: "session_id" });

          const { data: uid } = await supabase.rpc("get_user_id_by_email", { _email: email });
          if (uid) {
            must(await supabase.from("profiles").update({
              subscription_status: "active",
              stripe_customer_id: s.customer as string,
              stripe_subscription_id: s.subscription as string,
              plan: plinkPlan,
              storage_quota_bytes: STORAGE_BY_PLAN[plinkPlan] ?? 524288000,
            }).eq("id", uid as unknown as string), "profiles plink activate");
            await supabase.from("pending_purchases").update({
              status: "claimed", claimed_by: uid as unknown as string, claimed_at: new Date().toISOString(),
            }).eq("session_id", s.id);
            try {
              await stripe.subscriptions.update(s.subscription as string, {
                metadata: { app: "cria", user_id: String(uid), plan: plinkPlan },
              });
            } catch { /* fallback por stripe_subscription_id cobre */ }
          }
          await sendMetaPurchase(s);
          break;
        }

        const userId = s.metadata?.user_id;
        const plan = s.metadata?.plan;
        if (!userId || !plan) break;

        // Plano de agência: provisiona assentos (não mexe no plano pessoal de criação).
        if (plan === "agency") {
          const seats = Math.max(1, Math.floor(Number(s.metadata?.seats) || 1));
          must(await supabase.from("profiles").update({
            subscription_status: "active",
            stripe_customer_id: s.customer as string,
            stripe_subscription_id: s.subscription as string,
            account_type: "manager",
            seat_limit: seats,
          }).eq("id", userId), "profiles agency activate");
          break;
        }

        must(await supabase.from("profiles").update({
          subscription_status: "active",
          stripe_customer_id: s.customer as string,
          stripe_subscription_id: s.subscription as string,
          plan,
          storage_quota_bytes: STORAGE_BY_PLAN[plan] ?? 524288000,
        }).eq("id", userId), "profiles activate");

        // Purchase server-side no Meta (fonte da verdade da compra confirmada).
        await sendMetaPurchase(s);

        // Self-subscribe (F28): ativa SÓ a linha pendente do manager que este
        // checkout carregou. A PF (owner_id) consentiu ao concluir o checkout que a
        // gestora montou (metadata self_subscribe_manager_id). Sem esse metadado
        // (ex.: PF pagando a própria assinatura normal), NÃO ativamos vínculo nenhum
        // antes, qualquer pagamento da PF acordava toda linha pendente do dono,
        // o que permitia takeover por vínculo armado por terceiro.
        const selfSubMgr = s.metadata?.self_subscribe_manager_id;
        if (selfSubMgr) {
          await supabase.from("account_members")
            .update({
              status: "active",
              pending_self_subscribe: false,
              accepted_at: new Date().toISOString(),
            })
            .eq("owner_id", userId)
            .eq("member_id", selfSubMgr)
            .eq("pending_self_subscribe", true);
        }
        break;
      }

      case "customer.subscription.updated": {
        const sub = event.data.object as Stripe.Subscription;
        // ── ASSENTOS DE COLABORADOR: sincroniza a quantidade paga ──
        if (sub.metadata?.kind === "collab_seats") {
          const managerId = sub.metadata?.manager_id;
          const qty = Math.max(0, Math.floor(Number(sub.items?.data?.[0]?.quantity) || Number(sub.metadata?.seats) || 0));
          const active = sub.status === "active" || sub.status === "trialing";
          if (managerId) {
            await supabase.from("profiles").update({
              paid_collab_seats: active ? qty : 0,
              collab_seats_subscription_id: sub.id,
            }).eq("id", managerId);
          }
          break;
        }
        // ── PACOTES DE CLIENTES: sincroniza a quantidade paga ──
        if (sub.metadata?.kind === "client_packs") {
          const managerId = sub.metadata?.manager_id;
          const qty = Math.max(0, Math.floor(Number(sub.items?.data?.[0]?.quantity) || Number(sub.metadata?.packs) || 0));
          const active = sub.status === "active" || sub.status === "trialing";
          if (managerId) {
            await supabase.from("profiles").update({
              paid_client_packs: active ? qty : 0,
              client_packs_subscription_id: sub.id,
            }).eq("id", managerId);
          }
          break;
        }
        // ── MÓDULO PAGO: sincroniza status do entitlement ──
        if (sub.metadata?.kind === "module") {
          const moduleCode = sub.metadata?.module_code;
          const managerId = sub.metadata?.manager_id;
          const mstatus =
            sub.status === "active" ? "active" :
            sub.status === "trialing" ? "active" :
            sub.status === "past_due" ? "past_due" :
            sub.status === "unpaid" ? "past_due" :
            sub.status === "canceled" ? "canceled" : sub.status;
          const periodEnd = sub.current_period_end
            ? new Date(sub.current_period_end * 1000).toISOString() : null;
          if (moduleCode && managerId) {
            await supabase.from("module_entitlements").upsert({
              manager_id: managerId,
              module_code: moduleCode,
              status: mstatus,
              stripe_customer_id: sub.customer as string,
              stripe_subscription_id: sub.id,
              current_period_end: periodEnd,
              updated_at: new Date().toISOString(),
            }, { onConflict: "manager_id,module_code" });
            await supabase.rpc("recalc_manager_storage", { _manager: managerId });
          }
          break;
        }
        const userId = sub.metadata?.user_id;
        /* O PLANO VEM DO PREÇO, NÃO DO METADATA (pente fino 23/09/2026, S13).
           Quem troca de plano pelo Customer Portal do Stripe muda o price, mas
           o metadata fica o antigo: a pessoa pagava Studio e continuava
           Essencial no app (ou o contrário). O metadata só serve de reserva
           pra assinatura de agência, que não tem price de plano. */
        const plan = planFromPrice(sub.items?.data?.[0]?.price?.id ?? "") ?? sub.metadata?.plan;

        const status =
          sub.status === "active" ? "active" :
          sub.status === "past_due" ? "past_due" :
          sub.status === "canceled" ? "canceled" :
          sub.status === "unpaid" ? "past_due" :
          sub.status;

        if (plan === "agency") {
          // Atualiza assentos pela quantidade atual da assinatura.
          const qty = Math.max(0, Math.floor(Number(sub.items?.data?.[0]?.quantity) || Number(sub.metadata?.seats) || 0));
          if (userId) {
            must(await supabase.from("profiles").update({
              subscription_status: status,
              seat_limit: status === "active" ? qty : 0,
            }).eq("id", userId), "profiles agency update");
            // Se o limite caiu abaixo do uso, pausa os clientes excedentes (inventário).
            await supabase.rpc("reconcile_agency_seats", { _manager: userId });
          }
          break;
        }

        if (userId) {
          const update: Record<string, string | number> = { subscription_status: status };
          if (plan) update.plan = plan;
          if (plan && status === "active") update.storage_quota_bytes = STORAGE_BY_PLAN[plan] ?? 524288000;
          must(await supabase.from("profiles").update(update).eq("id", userId), "profiles status update");
        } else {
          // fallback: casa pelo stripe_subscription_id
          const { data: p } = await supabase.from("profiles")
            .select("id").eq("stripe_subscription_id", sub.id).maybeSingle();
          if (p) must(await supabase.from("profiles")
            .update({ subscription_status: status }).eq("id", p.id), "profiles status update (fallback)");
        }
        break;
      }

      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        // ── ASSENTOS DE COLABORADOR: zera os assentos pagos ──
        if (sub.metadata?.kind === "collab_seats") {
          const managerId = sub.metadata?.manager_id;
          if (managerId) {
            await supabase.from("profiles")
              .update({ paid_collab_seats: 0, collab_seats_subscription_id: null }).eq("id", managerId);
          }
          break;
        }
        // ── PACOTES DE CLIENTES: zera os pacotes pagos. Cliente nenhum é apagado:
        //    quem ficar acima do teto só não consegue ADICIONAR novos (trigger). ──
        if (sub.metadata?.kind === "client_packs") {
          const managerId = sub.metadata?.manager_id;
          if (managerId) {
            await supabase.from("profiles")
              .update({ paid_client_packs: 0, client_packs_subscription_id: null }).eq("id", managerId);
          }
          break;
        }
        // ── MÓDULO PAGO: revoga o entitlement ──
        if (sub.metadata?.kind === "module") {
          await supabase.from("module_entitlements")
            .update({ status: "canceled", updated_at: new Date().toISOString() })
            .eq("stripe_subscription_id", sub.id);
          // Cancelou módulo → recalcula o espaço. (A função nunca DIMINUI abaixo
          // do que ela já usa; ela só ajusta a cota arquivo nenhum é apagado.)
          const mid = sub.metadata?.manager_id;
          if (mid) await supabase.rpc("recalc_manager_storage", { _manager: mid });
          break;
        }
        const userId = sub.metadata?.user_id;
        if (sub.metadata?.plan === "agency" && userId) {
          await supabase.from("profiles")
            .update({ subscription_status: "canceled", seat_limit: 0 }).eq("id", userId);
          // Cancelou o plano de agência: todos os clientes cobertos vão pro inventário.
          await supabase.rpc("reconcile_agency_seats", { _manager: userId });
          break;
        }
        let canceladoId: string | null = null;
        if (userId) {
          await supabase.from("profiles")
            .update({ subscription_status: "canceled" }).eq("id", userId);
          canceladoId = userId;
        } else {
          const { data: p } = await supabase.from("profiles")
            .select("id").eq("stripe_subscription_id", sub.id).maybeSingle();
          if (p) {
            await supabase.from("profiles")
              .update({ subscription_status: "canceled" }).eq("id", p.id);
            canceladoId = p.id;
          }
        }
        // Confirmação de cancelamento (pente fino 23/09/2026): a pessoa
        // cancelava e não recebia nada; dias depois perguntava se "deu certo".
        if (canceladoId) {
          const { data: pc } = await supabase.from("profiles").select("email, name").eq("id", canceladoId).maybeSingle();
          if (pc?.email) {
            await enviarEmail(supabase, {
              para: pc.email, nome: pc.name, etiqueta: "assinatura_cancelada",
              assunto: "Sua assinatura do Cria foi cancelada",
              paragrafos: [
                "Confirmado: a assinatura foi cancelada e não vai ter nova cobrança.",
                "Seus dados (ideias, posts, brandbook, clientes) ficam guardados por 60 dias. Se quiser voltar nesse prazo, é só assinar de novo e está tudo lá.",
                "Se cancelou por algum problema, responde este e-mail: a gente lê tudo.",
              ],
              botao: { texto: "Voltar quando quiser", url: `${Deno.env.get("APP_URL") ?? "https://app.criasocialclub.com.br"}/app/assinar` },
            });
          }
        }
        // B.2, cancelamento antes da liberação anula só 'pending'.
        // 'payable' (sobreviveu à carência) e 'paid' (já pagamos) são mantidos.
        await supabase.from("partner_referrals")
          .update({
            status: "canceled",
            canceled_at: new Date().toISOString(),
            cancel_reason: "subscription_canceled",
          })
          .eq("stripe_subscription_id", sub.id)
          .eq("status", "pending");
        break;
      }

      case "invoice.paid": {
        const inv = event.data.object as Stripe.Invoice;
        const subId = inv.subscription as string | null;
        if (!subId) break;

        // metadata de atribuição vive na SUBSCRIPTION, não na invoice
        const sub = await stripe.subscriptions.retrieve(subId);
        const md = sub.metadata || {};
        // módulo pago não gera comissão de parceira
        if (md.kind === "module") break;
        const partnerId = md.partner_id;
        const referredUserId = md.user_id;
        const selfSub = md.self_subscribe === "1";

        // sem atribuição ou self-subscribe → sem comissão
        if (!partnerId || !referredUserId || selfSub) break;

        // dono do cupom, usado pelas duas checagens abaixo
        const { data: partnerRow } = await supabase
          .from("partners").select("user_id").eq("id", partnerId).maybeSingle();
        const ownerOfCoupon = partnerRow ? (partnerRow as { user_id: string }).user_id : null;

        // proteção auto-indicação: partner.user_id === quem assinou
        if (ownerOfCoupon && ownerOfCoupon === referredUserId) break;

        // proteção defensiva self-subscribe: não confiar só na metadata.
        // Se a conta PF (referredUserId) é gerenciada pelo dono do cupom → self-assinatura
        // da manager (não importa se o front esqueceu a flag self_subscribe="1").
        if (ownerOfCoupon) {
          const { data: amLink } = await supabase
            .from("account_members")
            .select("id")
            .eq("owner_id", referredUserId)
            .eq("member_id", ownerOfCoupon)
            .maybeSingle();
          if (amLink) break; // self-subscribe por vínculo → sem comissão
        }

        const billingReason = inv.billing_reason;
        const amountPaid = inv.amount_paid ?? 0; // centavos, valor real (com desconto)

        const { data: cfg } = await supabase
          .from("partner_program_config").select("deduction_pct").eq("id", true).maybeSingle();
        const deductionPct = cfg
          ? Number((cfg as { deduction_pct: number }).deduction_pct)
          : DEDUCTION_PCT_FALLBACK;

        const { data: existing } = await supabase
          .from("partner_referrals").select("*").eq("stripe_subscription_id", subId).maybeSingle();

        /* ═══════════════════════════════════════════════════════════════════
           COMISSÃO RECORRENTE DE VERDADE (Walter, 22/09/2026)

           Antes: uma linha por assinatura, valor gravado UMA vez na primeira
           fatura. Renovação só incrementava um contador, então uma assinatura
           de 24 meses pagava o mesmo que uma de 2, enquanto quatro telas
           prometiam "comissão todo mês enquanto a pessoa seguir assinante".

           Agora: a linha da assinatura é só o VÍNCULO (quem indicou quem), e
           CADA fatura paga que cai dentro da regra vira um lançamento próprio
           em partner_commission_entries.

           A regra vem do banco, não daqui: percentual, teto de meses e a
           fatura em que começa. Global em partner_program_config, com override
           por parceira. Padrão: 20%, 12 meses, começando na 3ª fatura.

           Por que a 3ª: sem cliente firme, sem comissão. Mata o incentivo de
           trazer cadastro ruim só pra bater volume.

           A idempotência saiu do código e foi pro banco: unique no
           stripe_invoice_id. O Stripe reentrega webhook, e antes o
           check-then-act daqui podia adiantar comissão em entregas
           concorrentes (classificado como CRÍTICO na auditoria). Agora a
           segunda tentativa bate no unique e não faz nada.
           ═══════════════════════════════════════════════════════════════════ */
        const seqDaFatura = billingReason === "subscription_create"
          ? 1
          : ((existing as { paid_invoices_count?: number } | null)?.paid_invoices_count ?? 1) + 1;

        let referralId = (existing as { id?: string } | null)?.id ?? null;

        if (billingReason === "subscription_create") {
          if (!existing) {
            // net_amount_cents fica zerado de propósito: quem guarda valor
            // agora é o lançamento. Manter aqui seria ter duas fontes.
            const { data: novo } = await supabase.from("partner_referrals").insert({
              partner_id: partnerId,
              referred_user_id: referredUserId,
              stripe_customer_id: inv.customer as string,
              stripe_subscription_id: subId,
              first_invoice_id: inv.id,
              gross_amount_cents: amountPaid,
              deduction_pct: deductionPct,
              net_amount_cents: 0,
              currency: inv.currency || "brl",
              paid_invoices_count: 1,
              status: "payable",
            }).select("id").maybeSingle();
            referralId = (novo as { id?: string } | null)?.id ?? null;
          }
        } else if (billingReason === "subscription_cycle" && existing) {
          const e = existing as { id: string; paid_invoices_count: number; status: string };
          await supabase.from("partner_referrals").update({
            paid_invoices_count: seqDaFatura,
            // "pending" era o estado de carência do modelo antigo. Quem manda
            // na carência agora é a fatura de início da regra.
            status: e.status === "pending" ? "payable" : e.status,
            unlocked_at: e.status === "pending" ? new Date().toISOString() : undefined,
          }).eq("id", e.id);
        }

        /* INDICAÇÃO LEGADA NÃO RECEBE DUAS VEZES (pente fino 23/09/2026, B4).
           Quem já ganhou o pagamento único do modelo antigo (90% da 1ª fatura)
           virou lançamento no backfill de 22/09. Se entrar também na regra
           recorrente, a parceira recebe pelo mesmo cliente nos dois modelos.
           A coluna `modelo` marca essas linhas; o webhook pula a recorrência. */
        const modeloLegado = (existing as { modelo?: string } | null)?.modelo === "legado";
        if (modeloLegado) console.log("[webhook] indicacao legada, sem lancamento recorrente:", referralId);

        if (referralId && amountPaid > 0 && !modeloLegado) {
          const { data: regra } = await supabase.rpc("partner_regra", { _partner_id: partnerId });
          const r = (Array.isArray(regra) ? regra[0] : regra) as
            { pct?: number; meses?: number; fatura_inicial?: number } | null;
          const pct = Number(r?.pct ?? 20);
          const meses = Number(r?.meses ?? 12);
          const inicio = Number(r?.fatura_inicial ?? 3);

          // Dentro da janela? Da fatura de início até (início + meses - 1).
          const dentro = seqDaFatura >= inicio && seqDaFatura <= (inicio + meses - 1);
          if (dentro) {
            const valor = Math.round(amountPaid * (pct / 100));
            // Competência no fuso de Brasília, que é o do caixa dele. Sem isso,
            // fatura paga dia 1 às 00h30 cairia no mês anterior.
            const agoraBR = new Date(Date.now() - 3 * 60 * 60 * 1000);
            const competencia = `${agoraBR.getUTCFullYear()}-${String(agoraBR.getUTCMonth() + 1).padStart(2, "0")}-01`;
            const { error: eIns } = await supabase.from("partner_commission_entries").insert({
              referral_id: referralId,
              partner_id: partnerId,
              stripe_invoice_id: inv.id,
              stripe_subscription_id: subId,
              invoice_seq: seqDaFatura,
              gross_cents: amountPaid,
              commission_pct: pct,
              amount_cents: valor,
              currency: inv.currency || "brl",
              competencia,
              status: "payable",
            });
            // Violação de unique = reentrega do Stripe. É o caminho feliz.
            if (eIns && !/duplicate key|unique/i.test(eIns.message ?? "")) {
              console.error("[stripe-webhook] lançamento de comissão falhou:", eIns.message);
            }
          }
        }
        break;
      }

      case "invoice.payment_failed": {
        const inv = event.data.object as Stripe.Invoice;
        const email = (inv.customer_email ?? "").toLowerCase();
        if (!email) break;
        const nome = (inv.customer_name ?? "").split(" ")[0] || null;
        await avisarPagamentoFalhou(email, nome, inv.amount_due ?? 0, inv.currency ?? "brl");
        break;
      }

      case "charge.refunded": {
        // estorno total → anula comissão pending OU payable. Não toca em 'paid' (já transferimos).
        const charge = event.data.object as Stripe.Charge;
        const invId = charge.invoice as string | null;
        if (!invId) break;
        const inv = await stripe.invoices.retrieve(invId);
        const subId = inv.subscription as string | null;
        if (!subId) break;

        const fullRefund = charge.refunded === true || (charge.amount_refunded >= charge.amount);
        if (!fullRefund) break;

        /* REEMBOLSO TOTAL ENCERRA O ACESSO (pente fino 23/09/2026, S13). Antes só
           a comissão era cancelada; o acesso ficava até o `subscription.deleted`,
           que pode nunca chegar se o reembolso foi feito na mão sem cancelar.
           Cancelar a assinatura no Stripe dispara o `deleted`, e é ele quem
           marca o perfil: uma fonte de verdade só. */
        try {
          const subAtual = await stripe.subscriptions.retrieve(subId);
          if (subAtual.status !== "canceled") await stripe.subscriptions.cancel(subId);
        } catch (e) { console.error("[webhook] cancelar assinatura apos reembolso", e); }

        await supabase.from("partner_referrals")
          .update({
            status: "canceled",
            canceled_at: new Date().toISOString(),
            cancel_reason: "refund",
          })
          .eq("stripe_subscription_id", subId)
          .in("status", ["pending", "payable"]);

        /* O ESTORNO TEM QUE ALCANÇAR O LANÇAMENTO (22/09/2026). Só cancelar o
           vínculo deixaria a comissão daquela fatura de pé, e ela seria paga
           no fechamento do mês em cima de dinheiro que voltou pro cliente.
           Cancela só o lançamento DAQUELA fatura, e só se ainda não foi pago:
           o que já saiu por PIX não dá pra desfazer daqui. */
        await supabase.from("partner_commission_entries")
          .update({ status: "canceled", canceled_reason: "refund" })
          .eq("stripe_invoice_id", invId)
          .eq("status", "payable");
        break;
      }

      default:
        // outros eventos: ignora silenciosamente (já registrados na reivindicação)
        break;
    }
  } catch (err) {
    // Fica visível no Admin > Logs (antes só no console do Supabase). O retry
    // do Stripe vai tentar de novo; se falhar 3x, é hora de olhar o log.
    await registrarErro(supabase, "stripe-webhook", mensagemDe(err), { event_type: event.type, event_id: event.id });
    // Desfaz a reivindicação para que o retry do Stripe possa reprocessar o evento.
    await supabase.from("billing_events")
      .delete().eq("gateway", "stripe").eq("event_id", event.id);
    return new Response("Handler Error", { status: 500 });
  }

  return new Response(JSON.stringify({ received: true }), { status: 200 });
});
