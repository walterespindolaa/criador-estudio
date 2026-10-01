// ═══════════════════════════════════════════════════════════════════════════
// BUNNY-INGERIR-DRIVE (Walter, 01/10/2026)
//
// Leva o vídeo que a social mídia escolheu no Drive pro Bunny, PELO SERVIDOR.
//
// POR QUE: antes a passagem rodava no navegador de quem anexou (baixava o
// arquivo inteiro do Drive e subia de novo pro Bunny). Fechou a aba no meio,
// falhava sem aviso e o vídeo ficava preso no player do Drive, que escolhe a
// qualidade sozinho (baixa no card) e desenha a própria barra de controles.
// Num link de aprovação real, 5 de 6 Reels estavam presos assim.
//
// COMO: o Bunny tem "Fetch Video": a gente passa a URL e ELE baixa direto do
// Drive. Com o token do seletor do Drive (vale ~1h) o pedido sai autenticado;
// sem token, tenta o download público (arquivo "qualquer pessoa com o link").
// A peça continua tocando pelo Drive enquanto isso. Só quando o Bunny termina
// o encoding (status 4, 100%) a MESMA linha de mídia é promovida, então o
// cliente nunca vê "Processing video" nem perde o vídeo se der erro.
//
// DOIS JEITOS DE CHAMAR:
//   1. Usuário logado: { mediaId, driveToken? } -> começa a busca, ou confere
//      uma busca em andamento e promove se já terminou.
//   2. Robô (x-internal-secret): {} -> confere todas as buscas em andamento.
// ═══════════════════════════════════════════════════════════════════════════
import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-internal-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

// Mesma library da peça do Cria Post (chave, id e CDN são um TRIO).
const API_KEY = Deno.env.get("BUNNY_CRIAPOST_API_KEY") ?? Deno.env.get("BUNNY_STREAM_API_KEY") ?? "";
const LIBRARY = Deno.env.get("BUNNY_CRIAPOST_LIBRARY_ID") ?? Deno.env.get("BUNNY_STREAM_LIBRARY_ID") ?? "";
const CDN = Deno.env.get("BUNNY_CRIAPOST_CDN_HOSTNAME") ?? "vz-86788381-03e.b-cdn.net";
const BUNNY = `https://video.bunnycdn.com/library/${LIBRARY}/videos`;

// Prazos. Busca sem vídeo aparecendo no Bunny = o Drive recusou o download.
const SEM_VIDEO_MIN = 30;
// Teto do encoding inteiro: passou disso, desiste e a peça segue no Drive.
const TETO_HORAS = 6;
// Depois de um erro, só tenta de novo sozinho (sem token novo) após isso.
const ESPERA_ERRO_HORAS = 24;

type Midia = {
  id: string; provider: string | null; external_file_id: string | null; file_name: string | null;
  file_type: string | null; post_id: string | null; user_id: string | null;
  ingest_bunny_guid: string | null; ingest_status: string | null; ingest_tentado_em: string | null;
};
const COLS = "id, provider, external_file_id, file_name, file_type, post_id, user_id, ingest_bunny_guid, ingest_status, ingest_tentado_em";

const titulo = (mediaId: string) => `cria-${mediaId}`;
const horasDesde = (iso: string | null) => (iso ? (Date.now() - new Date(iso).getTime()) / 3_600_000 : Infinity);
const bunnyHeaders = { AccessKey: API_KEY, accept: "application/json", "Content-Type": "application/json" };

async function acharGuidPorTitulo(mediaId: string): Promise<string | null> {
  const r = await fetch(`${BUNNY}?page=1&itemsPerPage=5&search=${encodeURIComponent(titulo(mediaId))}`, { headers: bunnyHeaders });
  if (!r.ok) return null;
  const j = await r.json();
  const item = (j?.items ?? []).find((v: { title?: string }) => v.title === titulo(mediaId));
  return item?.guid ?? null;
}

async function apagarNoBunny(guid: string) {
  try { await fetch(`${BUNNY}/${guid}`, { method: "DELETE", headers: bunnyHeaders }); } catch { /* segue */ }
}

async function marcar(svc: SupabaseClient, id: string, campos: Record<string, unknown>) {
  await svc.from("external_media_refs").update(campos).eq("id", id);
}

/** Começa a busca no Bunny. */
async function iniciar(svc: SupabaseClient, m: Midia, driveToken: string | null) {
  const fileId = m.external_file_id!;
  const corpo = driveToken
    ? {
        url: `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?alt=media&supportsAllDrives=true`,
        headers: { Authorization: `Bearer ${driveToken}` },
        title: titulo(m.id),
      }
    : {
        url: `https://drive.usercontent.google.com/download?id=${encodeURIComponent(fileId)}&export=download&confirm=t`,
        title: titulo(m.id),
      };
  const r = await fetch(`${BUNNY}/fetch`, { method: "POST", headers: bunnyHeaders, body: JSON.stringify(corpo) });
  const resp = await r.json().catch(() => ({}));
  if (!r.ok || resp?.success === false) {
    const erro = `bunny recusou a busca (${r.status}): ${String(resp?.message ?? "").slice(0, 200)}`;
    await marcar(svc, m.id, { ingest_status: "erro", ingest_erro: erro, ingest_tentado_em: new Date().toISOString() });
    return { estado: "erro", erro };
  }
  // O Fetch não devolve o guid: ele é achado pelo título único.
  let guid: string | null = null;
  for (let i = 0; i < 6 && !guid; i++) {
    await new Promise((res) => setTimeout(res, 1500));
    guid = await acharGuidPorTitulo(m.id);
  }
  await marcar(svc, m.id, {
    ingest_status: "buscando", ingest_bunny_guid: guid, ingest_erro: null,
    ingest_tentado_em: new Date().toISOString(),
  });
  return { estado: "buscando", comToken: !!driveToken };
}

/** Confere uma busca em andamento e promove a mídia quando o Bunny termina. */
async function conferir(svc: SupabaseClient, m: Midia) {
  let guid = m.ingest_bunny_guid;
  if (!guid) {
    guid = await acharGuidPorTitulo(m.id);
    if (guid) await marcar(svc, m.id, { ingest_bunny_guid: guid });
    else if (horasDesde(m.ingest_tentado_em) * 60 > SEM_VIDEO_MIN) {
      await marcar(svc, m.id, { ingest_status: "erro", ingest_erro: "o Bunny não conseguiu baixar do Drive (arquivo sem acesso)" });
      return { estado: "erro" };
    } else return { estado: "buscando" };
  }
  const r = await fetch(`${BUNNY}/${guid}`, { headers: bunnyHeaders });
  if (!r.ok) {
    if (r.status === 404) {
      await marcar(svc, m.id, { ingest_status: "erro", ingest_erro: "vídeo sumiu do Bunny", ingest_bunny_guid: null });
      return { estado: "erro" };
    }
    return { estado: "buscando" };
  }
  const v = await r.json();
  // Bunny: 0 criado, 1 enviado, 2 processando, 3 transcodificando, 4 pronto, 5 erro, 6 falha no envio
  const status = typeof v.status === "number" ? v.status : -1;
  const progresso = typeof v.encodeProgress === "number" ? v.encodeProgress : 0;

  if (status === 5 || status === 6) {
    await apagarNoBunny(guid);
    await marcar(svc, m.id, { ingest_status: "erro", ingest_erro: `encoding falhou no Bunny (status ${status})`, ingest_bunny_guid: null });
    return { estado: "erro" };
  }
  if (status === 4 && progresso >= 100) {
    // Promove a MESMA linha (posição no carrossel preservada). download_url
    // continua sendo o link do Drive: saída de emergência e origem da limpeza.
    const { error } = await svc.from("external_media_refs").update({
      provider: "bunny_stream",
      external_file_id: guid,
      bunny_video_id: guid,
      view_url: `https://iframe.mediadelivery.net/embed/${LIBRARY}/${guid}`,
      thumbnail_url: `https://${CDN}/${guid}/thumbnail.jpg`,
      ingest_status: "pronto",
      ingest_erro: null,
    }).eq("id", m.id).eq("provider", "gdrive");
    if (error) return { estado: "buscando", erro: error.message };
    return { estado: "pronto", resolucoes: v.availableResolutions ?? null };
  }
  if (horasDesde(m.ingest_tentado_em) > TETO_HORAS) {
    await apagarNoBunny(guid);
    await marcar(svc, m.id, { ingest_status: "erro", ingest_erro: `encoding passou de ${TETO_HORAS}h`, ingest_bunny_guid: null });
    return { estado: "erro" };
  }
  return { estado: "buscando", progresso };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (!API_KEY || !LIBRARY) return json({ error: "Bunny secrets não configurados" }, 500);
  const svc = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  try {
    // ── Robô: confere todas as buscas em andamento ─────────────────────────
    const segredo = req.headers.get("x-internal-secret");
    if (segredo) {
      if (segredo !== Deno.env.get("INTERNAL_PUSH_SECRET")) return json({ error: "unauthorized" }, 401);
      const { data, error } = await svc.from("external_media_refs").select(COLS)
        .eq("ingest_status", "buscando").limit(50);
      if (error) throw error;
      const placar: Record<string, number> = {};
      for (const m of (data ?? []) as Midia[]) {
        const r = await conferir(svc, m);
        placar[r.estado] = (placar[r.estado] ?? 0) + 1;
      }
      await svc.from("cron_runs").upsert(
        { job: "bunny-ingerir-drive", last_run_at: new Date().toISOString(), ok: true, detail: JSON.stringify(placar) },
        { onConflict: "job" });
      return json({ ok: true, placar });
    }

    // ── Usuário logado ─────────────────────────────────────────────────────
    const auth = req.headers.get("Authorization") ?? "";
    const user = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: auth } } });
    const { data: u } = await user.auth.getUser();
    if (!u?.user) return json({ error: "Não autenticado" }, 401);

    const { mediaId, driveToken } = await req.json().catch(() => ({}));
    if (!mediaId) return json({ error: "mediaId ausente" }, 400);

    const { data: m } = await svc.from("external_media_refs").select(COLS).eq("id", mediaId).maybeSingle();
    if (!m) return json({ error: "mídia não encontrada" }, 404);
    const midia = m as Midia;

    // Mesmo critério de dono do resto do Cria Post: dono do post ou equipe dele.
    let dono = midia.user_id;
    if (midia.post_id) {
      const { data: p } = await svc.from("posts").select("user_id").eq("id", midia.post_id).maybeSingle();
      dono = (p as { user_id?: string } | null)?.user_id ?? dono;
    }
    if (!dono) return json({ error: "sem dono" }, 403);
    const { data: pode } = await user.rpc("acts_for", { target: dono });
    if (pode !== true) return json({ error: "sem acesso a esta mídia" }, 403);

    const ehVideo = (midia.file_type ?? "").startsWith("video/");
    if (midia.provider !== "gdrive" || !midia.external_file_id || !ehVideo) return json({ estado: "nada" });

    if (midia.ingest_status === "buscando") return json(await conferir(svc, midia));
    if (midia.ingest_status === "erro" && !driveToken && horasDesde(midia.ingest_tentado_em) < ESPERA_ERRO_HORAS)
      return json({ estado: "erro_recente" });

    return json(await iniciar(svc, midia, typeof driveToken === "string" && driveToken ? driveToken : null));
  } catch (e) {
    console.error("[bunny-ingerir-drive]", e);
    return json({ error: String(e) }, 500);
  }
});
