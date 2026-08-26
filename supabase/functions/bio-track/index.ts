// Tracking público do Link na bio (visitas e cliques) com rate-limit por IP+slug.
// As RPCs increment_bio_* só são acessíveis via service_role, esta é a única porta.
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

// Allowlist (+ localhost/preview do Lovable), bloqueia origens aleatórias sem quebrar dev.
function isAllowedOrigin(origin: string): boolean {
  if (["https://app.criasocialclub.com.br", "https://criasocialclub.com.br", "https://www.criasocialclub.com.br"].includes(origin)) return true;
  if (/^https?:\/\/localhost(:\d+)?$/.test(origin)) return true;
  if (/^https:\/\/[a-z0-9-]+\.(lovableproject\.com|lovable\.app)$/.test(origin)) return true;
  return false;
}
function corsFor(req: Request) {
  const origin = req.headers.get("origin") ?? "";
  return {
    "Access-Control-Allow-Origin": isAllowedOrigin(origin) ? origin : "https://app.criasocialclub.com.br",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Vary": "Origin",
  };
}

serve(async (req) => {
  const cors = corsFor(req);
  const ok = (b: unknown = { ok: true }) =>
    new Response(JSON.stringify(b), { headers: { ...cors, "Content-Type": "application/json" } });
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const body = await req.json().catch(() => ({}));
    const type = String(body?.type ?? "");
    const slug = body?.slug ? String(body.slug).slice(0, 120) : "";
    const linkId = body?.linkId ? String(body.linkId) : "";
    // De onde a pessoa veio. A página manda um rótulo curto já resolvido; aqui
    // só cortamos o tamanho. Guardar o referrer cru seria guardar endereço de
    // terceiro sem precisar, e ninguém filtra relatório por isso.
    const origem = body?.origem ? String(body.origem).slice(0, 20) : "direto";
    if (type !== "view" && type !== "click" && type !== "lead") return ok({ ok: false });

    const ip = (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() || "unknown";
    const svc = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    /* O LEAD VEM ANTES do freio genérico de 30 eventos/min logo abaixo.
       Aquele balde é por IP+página e é compartilhado com visita e clique. Numa
       operadora móvel vários visitantes saem pelo MESMO IP, então uma bio com
       movimento estoura os 30 sem esforço. E o que ele devolve é `ok: true`,
       de propósito, porque perder uma métrica não é problema. Perder um LEAD é:
       o formulário dizia "Recebido!" e o contato não tinha sido gravado em
       lugar nenhum. O lead tem freio próprio, por IP, logo abaixo.

       ── LEAD ─────────────────────────────────────────────────────────────
       O envio do formulário passou a vir por aqui em vez de bater direto na
       RPC. Motivo: a RPC não enxerga o IP, então o único freio possível lá era
       por PÁGINA. Com freio por página, um robô sozinho enche a lista da
       gestora de contato falso E, ao estourar o teto, TRANCA o formulário pros
       visitantes de verdade, que passam a ver "não foi possível enviar" sem
       ninguém entender por quê.

       Aqui existe IP, então o freio é por pessoa: 3 envios por minuto. Quem
       está preenchendo de boa-fé nunca chega perto disso, e o robô para sem
       levar a página junto. */
    if (type === "lead") {
      if (!slug) return ok({ ok: false, erro: "slug" });
      const { data: podeLead, error: leadRlErr } = await svc.rpc("rate_touch", { _key: `bio_lead_ip:${ip}`, _limit: 3 });
      if (leadRlErr || podeLead === false) {
        return ok({ ok: false, erro: "muitas_tentativas" });
      }
      const nome = body?.name ? String(body.name).slice(0, 120).trim() : "";
      const email = body?.email ? String(body.email).slice(0, 160).trim() : "";
      const fone = body?.phone ? String(body.phone).slice(0, 40).trim() : "";
      const blocoId = body?.blockId ? String(body.blockId) : null;
      if (!email && !fone) return ok({ ok: false, erro: "vazio" });

      const fn = body?.daAgencia ? "submit_bio_page_lead" : "submit_bio_lead";
      const { error: erroLead } = await svc.rpc(fn, {
        _slug: slug,
        _name: nome || null,
        _email: email || null,
        _phone: fone || null,
        _block_id: blocoId,
      });
      if (erroLead) {
        console.error("[bio-track] lead falhou:", erroLead);
        return ok({ ok: false, erro: "falhou" });
      }
      return ok({ ok: true });
    }


    // 30 eventos/min por IP+alvo. Se estourar, ignora silenciosamente (não conta).
    // Fail-CLOSED: este endpoint é público e anônimo (verify_jwt = false), então
    // em erro do rate-limit (RPC/DB fora) a gente NÃO conta o evento. Liberar em
    // falha deixaria o contador da bio sem teto justo quando o freio quebrou -
    // exatamente a hora do abuso. Melhor perder uma métrica que abrir a porteira.
    const { data: allowed, error: rlErr } = await svc.rpc("rate_touch", { _key: `bio:${ip}:${slug || linkId}`, _limit: 30 });
    if (rlErr || allowed === false) return ok({ ok: true, throttled: true });

    if (type === "view" && slug) {
      // O endereço pode ser de um criador (profiles) ou de uma página que a
      // social mídia montou pra um cliente (bio_pages). O contador mora em
      // lugares diferentes, e a página diz qual é no `kind`. Sem o kind, tenta
      // os dois: só um deles vai encontrar o slug.
      const kind = String(body?.kind ?? "");
      if (kind !== "page") await svc.rpc("increment_bio_view", { _slug: slug });
      if (kind !== "profile") await svc.rpc("increment_bio_page_view", { _slug: slug });
    } else if (type === "click" && linkId) {
      // O id pode ser de um botão do formato antigo (bio_links) ou de um bloco
      // do formato novo (bio_blocks). Cada função só encontra o seu, então
      // chamar as duas soma uma vez só e evita a página ter que saber disso.
      await svc.rpc("increment_bio_link_click", { link_id: linkId });
      await svc.rpc("increment_bio_block_click", { _id: linkId });
    }

    // Além dos totais de sempre, guarda o evento no agregado por dia, bloco e
    // origem. É o que permite dizer "o cardápio puxou 203 cliques este mês" em
    // vez de só "736 cliques desde sempre". Best-effort: se a migration das
    // estatísticas ainda não rodou, o contador de cima já foi somado.
    if (slug) {
      try {
        await svc.rpc("bio_registrar_evento", {
          _slug: slug, _tipo: type, _block_id: type === "click" ? linkId : null, _origem: origem,
        });
      } catch (e) { console.error("[bio-track] estatística falhou:", e); }
    }
    return ok();
  } catch (e) {
    console.error("[bio-track] error:", e);
    return ok({ ok: false });
  }
});
