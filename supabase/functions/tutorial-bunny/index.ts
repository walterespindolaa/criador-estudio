// ═══════════════════════════════════════════════════════════════════════════
// TUTORIAL-BUNNY (Walter, 02/10/2026) · só admin
//
// Sobe os vídeos tutoriais do Cria pra library própria do Bunny
// (cria-tutoriais) e mantém o catálogo public.tutoriais em dia.
// A chave fica nos segredos BUNNY_TUTORIAIS_API_KEY / BUNNY_TUTORIAIS_LIBRARY_ID
// e nunca sai do servidor: quem sobe o arquivo recebe só a assinatura TUS
// (vale 1h e serve só pra aquele vídeo).
//
// Ações:
//   { acao: "subir", slug, publico, modulo, modulo_nome, modulo_ordem, ordem,
//     titulo, descricao?, duracao_s?, rota?, substituir? }
//       -> grava/atualiza a linha do catálogo e cria o vídeo no Bunny.
//          Se o slug já tem vídeo e substituir != true, devolve { jaExiste }.
//          Com substituir, o vídeo no ar só é apagado quando o novo ficar pronto.
//   { acao: "sincronizar" }
//       -> pergunta ao Bunny como estão os vídeos em processamento; os prontos
//          viram status 'pronto' (numa troca, o que estava no ar sai do Bunny).
//   { acao: "listar" } -> catálogo inteiro, pra conferência.
// ═══════════════════════════════════════════════════════════════════════════
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });

async function sha256Hex(input: string): Promise<string> {
  const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

const PUBLICOS = ["social_midia", "criador", "parceiro"];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const apiKey = Deno.env.get("BUNNY_TUTORIAIS_API_KEY");
    const libraryId = Deno.env.get("BUNNY_TUTORIAIS_LIBRARY_ID");
    if (!apiKey || !libraryId) return json({ error: "BUNNY_TUTORIAIS_API_KEY / BUNNY_TUTORIAIS_LIBRARY_ID não configurados" }, 500);

    const auth = req.headers.get("Authorization") ?? "";
    const userClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: auth } } });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return json({ error: "unauthorized" }, 401);
    const svc = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: caller } = await svc.from("profiles").select("role").eq("id", user.id).single();
    if (caller?.role !== "admin") return json({ error: "forbidden" }, 403);

    const bunny = (path: string, init: RequestInit = {}) =>
      fetch(`https://video.bunnycdn.com/library/${libraryId}${path}`, {
        ...init,
        headers: { AccessKey: apiKey, accept: "application/json", "Content-Type": "application/json", ...(init.headers ?? {}) },
      });

    const body = await req.json().catch(() => ({}));

    if (body.acao === "listar") {
      const { data, error } = await svc.from("tutoriais").select("*").order("publico").order("modulo_ordem").order("ordem");
      if (error) return json({ error: error.message }, 500);
      return json({ tutoriais: data });
    }

    if (body.acao === "subir") {
      const b = body as Record<string, unknown>;
      const slug = String(b.slug ?? "");
      if (!/^[a-z0-9-]+$/.test(slug)) return json({ error: "slug inválido" }, 400);
      if (!PUBLICOS.includes(String(b.publico))) return json({ error: "publico inválido" }, 400);
      if (!b.modulo || !b.modulo_nome || !b.titulo) return json({ error: "modulo, modulo_nome e titulo são obrigatórios" }, 400);

      const { data: atual } = await svc.from("tutoriais").select("id, bunny_video_id, status").eq("slug", slug).maybeSingle();
      if (atual?.bunny_video_id && b.substituir !== true) {
        return json({ jaExiste: true, videoGuid: atual.bunny_video_id, status: atual.status });
      }

      const criado = await bunny("/videos", { method: "POST", body: JSON.stringify({ title: slug }) });
      if (!criado.ok) return json({ error: "Bunny recusou a criação", detalhe: (await criado.text()).slice(0, 300) }, 502);
      const videoGuid = (await criado.json()).guid as string;

      const noAr = atual?.status === "pronto";
      const linha: Record<string, unknown> = {
        slug,
        publico: String(b.publico),
        modulo: String(b.modulo),
        modulo_nome: String(b.modulo_nome),
        modulo_ordem: Number(b.modulo_ordem) || 0,
        ordem: Number(b.ordem) || 0,
        titulo: String(b.titulo),
        descricao: b.descricao ? String(b.descricao) : null,
        duracao_s: Number.isFinite(Number(b.duracao_s)) ? Math.round(Number(b.duracao_s)) : null,
        rota: b.rota ? String(b.rota) : null,
        bunny_library_id: libraryId,
        updated_at: new Date().toISOString(),
      };
      if (noAr) {
        // Troca de vídeo que já está no ar: o player segue no atual e o novo
        // espera em bunny_video_pendente até o Bunny terminar de processar.
        linha.bunny_video_pendente = videoGuid;
      } else {
        linha.bunny_video_id = videoGuid;
        linha.bunny_video_pendente = null;
        linha.status = "processando";
      }
      const { error: erroLinha } = await svc.from("tutoriais").upsert(linha, { onConflict: "slug" });
      if (erroLinha) {
        await bunny(`/videos/${videoGuid}`, { method: "DELETE" });
        return json({ error: "Falha ao gravar no catálogo", detalhe: erroLinha.message }, 500);
      }
      // Se o anterior nunca chegou a ficar no ar, não serve pra nada: sai já.
      if (!noAr && atual?.bunny_video_id) await bunny(`/videos/${atual.bunny_video_id}`, { method: "DELETE" });

      const expiration = Math.floor(Date.now() / 1000) + 3600;
      const signature = await sha256Hex(`${libraryId}${apiKey}${expiration}${videoGuid}`);
      return json({ videoGuid, libraryId, signature, expiration });
    }

    if (body.acao === "sincronizar") {
      const { data: linhas, error } = await svc.from("tutoriais")
        .select("id, slug, status, bunny_video_id, bunny_video_pendente")
        .or("status.eq.processando,bunny_video_pendente.not.is.null");
      if (error) return json({ error: error.message }, 500);

      const resultado: Record<string, string> = {};
      for (const l of linhas ?? []) {
        const troca = Boolean(l.bunny_video_pendente);
        const esperando = troca ? l.bunny_video_pendente : l.bunny_video_id;
        if (!esperando) continue;
        const r = await bunny(`/videos/${esperando}`);
        if (!r.ok) { resultado[l.slug] = `erro ${r.status}`; continue; }
        const v = await r.json();
        // Bunny: 0 criado, 1 enviado, 2 processando, 3 convertendo, 4 pronto, 5 erro, 6 upload falhou
        if (v.status === 4) {
          await svc.from("tutoriais").update({
            status: "pronto",
            bunny_video_id: esperando,
            bunny_video_pendente: null,
            duracao_s: Math.round(Number(v.length) || 0) || null,
            updated_at: new Date().toISOString(),
          }).eq("id", l.id);
          // Na troca, o que estava no ar sai do Bunny só agora.
          if (troca && l.bunny_video_id) await bunny(`/videos/${l.bunny_video_id}`, { method: "DELETE" });
          resultado[l.slug] = troca ? "trocado" : "pronto";
        } else if (v.status === 5 || v.status === 6) {
          resultado[l.slug] = "falhou no Bunny (suba de novo com --substituir)";
        } else {
          resultado[l.slug] = `processando (${v.encodeProgress ?? 0}%)`;
        }
      }
      return json({ resultado });
    }

    return json({ error: "acao desconhecida" }, 400);
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
