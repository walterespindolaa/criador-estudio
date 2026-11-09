import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import Stripe from "npm:stripe@14";

/* ═══════════════════════════════════════════════════════════════════════════
   CUPOM-ADMIN  (Walter, 09/11/2026, painel de cupons aprovado)

   O painel "Cupons e parceiros" do admin cria e mexe em cupom por aqui.

   criar      · dono (existente, novo sem conta no Cria, ou nenhum), o que o
                cliente ganha (% por N meses e/ou meses grátis, planos, limite,
                validade) e o que o dono recebe (% da mensalidade, valor fixo
                ou nada, da X até a Y). Grava em cupons_campanha e já cria o
                coupon na Stripe com o mesmo id que o create-checkout procura,
                então o primeiro checkout não precisa criar nada.
   pausar / reativar · liga e desliga o código (cupom do painel).
   regra      · troca a regra de comissão. Vale pras próximas mensalidades;
                o que já foi lançado não muda.
   stripe_soltos · códigos ativos que existem só na Stripe (criados na mão lá,
                como o ASSESSORXP). Aparecem no painel pra não ficarem invisíveis.

   O cupom antigo de parceira (em `partners`) continua no partner-manage.
   ═══════════════════════════════════════════════════════════════════════════ */

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

const PLANOS = ["essencial", "pro", "studio"];
const TIPOS_DONO = ["parceira", "assessor", "agencia"];

type Regra = { tipo: "nenhuma" | "pct" | "fixo"; pct?: number | null; fixo_cents?: number | null; de?: number; ate?: number | null };

function validarRegra(r: Regra, temDono: boolean): string | null {
  if (!r || !["nenhuma", "pct", "fixo"].includes(r.tipo)) return "regra_invalida";
  if (r.tipo === "nenhuma") return null;
  if (!temDono) return "comissao_sem_dono";
  const de = Number(r.de), ate = Number(r.ate);
  if (!Number.isInteger(de) || de < 1 || de > 36) return "mensalidade_inicial_invalida";
  if (!Number.isInteger(ate) || ate < de || ate > 60) return "mensalidade_final_invalida";
  if (r.tipo === "pct" && !(Number(r.pct) > 0 && Number(r.pct) <= 100)) return "percentual_invalido";
  if (r.tipo === "fixo" && !(Number.isInteger(Number(r.fixo_cents)) && Number(r.fixo_cents) > 0)) return "valor_fixo_invalido";
  return null;
}
function colunasRegra(r: Regra) {
  return {
    comissao_tipo: r.tipo,
    comissao_pct: r.tipo === "pct" ? Number(r.pct) : null,
    comissao_fixo_cents: r.tipo === "fixo" ? Number(r.fixo_cents) : null,
    comissao_de: r.tipo === "nenhuma" ? 1 : Number(r.de),
    comissao_ate: r.tipo === "nenhuma" ? null : Number(r.ate),
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "unauthorized" }, 401);
    const userClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return json({ error: "unauthorized" }, 401);

    const svc = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: caller } = await svc.from("profiles").select("role").eq("id", user.id).single();
    if ((caller as { role?: string } | null)?.role !== "admin") return json({ error: "forbidden" }, 403);

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, {
      apiVersion: "2024-06-20", httpClient: Stripe.createFetchHttpClient(),
    });

    const body = await req.json().catch(() => ({}));
    const acao = body?.acao as string;

    // ── Códigos que só existem na Stripe ───────────────────────────────
    if (acao === "stripe_soltos") {
      const promos = await stripe.promotionCodes.list({ active: true, limit: 100, expand: ["data.coupon"] });
      const [{ data: p }, { data: c }] = await Promise.all([
        svc.from("partners").select("coupon_code").not("coupon_code", "is", null),
        svc.from("cupons_campanha").select("codigo"),
      ]);
      const conhecidos = new Set([
        ...((p ?? []) as { coupon_code: string }[]).map((x) => x.coupon_code.toUpperCase()),
        ...((c ?? []) as { codigo: string }[]).map((x) => x.codigo.toUpperCase()),
      ]);
      const soltos = promos.data
        .filter((pc) => !conhecidos.has(pc.code.toUpperCase()))
        .map((pc) => {
          const cp = pc.coupon as Stripe.Coupon;
          return {
            codigo: pc.code, usos: pc.times_redeemed, limite: pc.max_redemptions,
            pct: cp.percent_off, valor_cents: cp.amount_off, duracao: cp.duration,
            meses: cp.duration_in_months, vence: pc.expires_at ? new Date(pc.expires_at * 1000).toISOString() : null,
          };
        });
      return json({ ok: true, soltos });
    }

    // ── Criar ──────────────────────────────────────────────────────────
    if (acao === "criar") {
      const codigo = String(body?.codigo ?? "").trim().toUpperCase();
      if (!/^[A-Z0-9_-]{3,24}$/.test(codigo)) return json({ error: "codigo_invalido", message: "Use de 3 a 24 letras, números, - ou _." }, 400);

      // Código único no Cria e na Stripe (um promotion code com o mesmo texto
      // confundiria quem digita na página da Stripe).
      const [{ data: emParceira }, { data: emCampanha }] = await Promise.all([
        svc.from("partners").select("id").ilike("coupon_code", codigo.replace(/([\\%_])/g, "\\$1")).maybeSingle(),
        svc.from("cupons_campanha").select("id").ilike("codigo", codigo.replace(/([\\%_])/g, "\\$1")).maybeSingle(),
      ]);
      const naStripe = await stripe.promotionCodes.list({ code: codigo, limit: 1 });
      if (emParceira || emCampanha || naStripe.data.length) return json({ error: "codigo_em_uso", message: "Esse código já existe." }, 409);

      // O que o cliente ganha
      const pct = Number(body?.desconto_pct ?? 0);
      const meses = Number(body?.desconto_meses ?? 0);
      const mesesGratis = Number(body?.meses_gratis ?? 0);
      if (!(pct >= 0 && pct <= 100)) return json({ error: "desconto_invalido" }, 400);
      if (!Number.isInteger(meses) || meses < 0 || meses > 36) return json({ error: "meses_invalidos" }, 400);
      if (!Number.isInteger(mesesGratis) || mesesGratis < 0 || mesesGratis > 12) return json({ error: "gratis_invalido" }, 400);
      if (pct > 0 && meses === 0) return json({ error: "meses_invalidos", message: "Diga por quantas mensalidades vale o desconto." }, 400);
      if (pct === 0 && mesesGratis === 0) return json({ error: "sem_beneficio", message: "O cupom precisa dar desconto ou meses grátis." }, 400);
      const planos = Array.isArray(body?.planos) ? (body.planos as string[]).filter((p) => PLANOS.includes(p)) : [];
      const limite = body?.limite_usos ? Number(body.limite_usos) : null;
      if (limite !== null && !(Number.isInteger(limite) && limite > 0)) return json({ error: "limite_invalido" }, 400);
      const validoAte = body?.valido_ate ? new Date(`${body.valido_ate}T23:59:59-03:00`) : null;
      if (validoAte && (isNaN(validoAte.getTime()) || validoAte.getTime() < Date.now())) return json({ error: "validade_invalida" }, 400);

      // Dono
      let partnerId: string | null = null;
      const dono = body?.dono as { id?: string; novo?: { nome?: string; tipo?: string; pix?: string } } | null;
      if (dono?.id) {
        const { data: d } = await svc.from("partners").select("id, status").eq("id", dono.id).maybeSingle();
        if (!d) return json({ error: "dono_nao_encontrado" }, 404);
        partnerId = (d as { id: string }).id;
      }

      const regra = (body?.regra ?? { tipo: "nenhuma" }) as Regra;
      const erroRegra = validarRegra(regra, !!(partnerId || dono?.novo));
      if (erroRegra) return json({ error: erroRegra }, 400);

      if (!partnerId && dono?.novo) {
        const nome = String(dono.novo.nome ?? "").trim();
        const tipo = String(dono.novo.tipo ?? "");
        if (nome.length < 2) return json({ error: "nome_do_dono" }, 400);
        if (!TIPOS_DONO.includes(tipo)) return json({ error: "tipo_do_dono" }, 400);
        const { data: novo, error: eNovo } = await svc.from("partners").insert({
          user_id: null, status: "approved", full_name: nome, tipo_dono: tipo,
          pix_key: String(dono.novo.pix ?? "").trim() || null,
          approved_by: user.id, approved_at: new Date().toISOString(),
          notes: "Dono de cupom criado pelo painel de cupons (sem conta no Cria).",
        }).select("id").single();
        if (eNovo) return json({ error: "dono_nao_criado", message: eNovo.message }, 500);
        partnerId = (novo as { id: string }).id;
      }

      // Stripe: mesmo id e mesma duração que o create-checkout usa (meses
      // grátis + meses de desconto), pra ele achar e reaproveitar.
      let stripeCouponId: string | null = null;
      if (pct > 0) {
        const duracao = meses + mesesGratis;
        const id = `camp_${codigo.toLowerCase().replace(/[^a-z0-9_-]/g, "")}`;
        try {
          const cp = await stripe.coupons.create({
            id, name: `${codigo} ${pct}% por ${meses} meses`.slice(0, 40),
            percent_off: pct, duration: "repeating", duration_in_months: duracao,
            metadata: { app: "cria", campanha: codigo },
          });
          stripeCouponId = cp.id;
        } catch (e) {
          // Sobra de um cupom antigo com o mesmo código: o checkout cria um com
          // a regra no id quando precisar.
          console.warn("[cupom-admin] coupon na Stripe", (e as Error).message);
        }
      }

      const { error: eIns } = await svc.from("cupons_campanha").insert({
        codigo, dias_gratis: mesesGratis * 30, desconto_pct: pct, desconto_meses: meses,
        planos: planos.length && planos.length < PLANOS.length ? planos : null,
        limite_usos: limite, valido_ate: validoAte ? validoAte.toISOString() : null,
        stripe_coupon_id: stripeCouponId, ativo: true,
        partner_id: partnerId, criado_por: user.id, ...colunasRegra(regra),
      });
      if (eIns) return json({ error: "nao_salvou", message: eIns.message }, 500);
      return json({ ok: true, codigo, stripe_coupon_id: stripeCouponId, partner_id: partnerId });
    }

    // ── Pausar / reativar / regra ──────────────────────────────────────
    const codigo = String(body?.codigo ?? "").trim().toUpperCase();
    if (!codigo) return json({ error: "sem_codigo" }, 400);
    const { data: cupom } = await svc.from("cupons_campanha").select("id, partner_id").eq("codigo", codigo).maybeSingle();
    if (!cupom) return json({ error: "cupom_nao_encontrado" }, 404);
    const c = cupom as { id: string; partner_id: string | null };

    if (acao === "pausar" || acao === "reativar") {
      const { error } = await svc.from("cupons_campanha").update({ ativo: acao === "reativar" }).eq("id", c.id);
      if (error) return json({ error: "nao_salvou", message: error.message }, 500);
      return json({ ok: true });
    }

    if (acao === "regra") {
      const regra = body?.regra as Regra;
      const erro = validarRegra(regra, !!c.partner_id);
      if (erro) return json({ error: erro }, 400);
      const { error } = await svc.from("cupons_campanha").update(colunasRegra(regra)).eq("id", c.id);
      if (error) return json({ error: "nao_salvou", message: error.message }, 500);
      return json({ ok: true });
    }

    return json({ error: "acao_invalida" }, 400);
  } catch (err) {
    console.error("[cupom-admin]", err);
    return json({ error: "internal_error" }, 500);
  }
});
