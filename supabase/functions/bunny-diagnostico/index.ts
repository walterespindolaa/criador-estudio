import { createClient } from "npm:@supabase/supabase-js@2";

/* ═══════════════════════════════════════════════════════════════════════════
   DIAGNÓSTICO DOS VÍDEOS PRESOS NO PLAYER (14/09/2026)

   Dez vídeos de quatro semanas atrás continuavam mostrando "Processing video"
   pro cliente. Isso NÃO é lentidão: três semanas é tempo demais. Ou o encoding
   falhou, ou o arquivo nunca chegou inteiro, ou está pronto e o problema é só a
   miniatura. São três causas com três consertos diferentes, e até aqui a gente
   estava adivinhando.

   Esta função pergunta ao Bunny o estado REAL de cada vídeo e devolve a lista
   traduzida. Sem isso, a única saída era reanexar tudo no escuro.

   Códigos do Bunny: 0 criado · 1 enviado · 2 processando · 3 transcodificando
   4 pronto · 5 erro · 6 falha no envio.
   ═══════════════════════════════════════════════════════════════════════════ */

const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b, null, 2), { status: s, headers: { "Content-Type": "application/json" } });

const LEITURA: Record<number, string> = {
  0: "criado, nenhum byte chegou",
  1: "enviado, ainda não começou a processar",
  2: "processando",
  3: "transcodificando",
  4: "pronto",
  5: "ERRO no processamento",
  6: "FALHA no envio do arquivo",
};

Deno.serve(async (req) => {
  try {
    if (req.headers.get("x-cleanup-secret") !== Deno.env.get("CRIAPOST_CLEANUP_SECRET")) {
      return json({ error: "unauthorized" }, 401);
    }
    /* DUAS LIBRARIES (14/09/2026). A peça do Cria Post passa a viver na
       cria-criapost, e o que já existe está na do Cria. Procurar só numa dava
       "não encontrado" em tudo e levava ao diagnóstico errado. Aqui procura nas
       duas e DIZ em qual achou, que é a informação que importa. */
    const libs = [
      { nome: "criapost", id: Deno.env.get("BUNNY_CRIAPOST_LIBRARY_ID"), key: Deno.env.get("BUNNY_CRIAPOST_API_KEY") },
      { nome: "cria", id: Deno.env.get("BUNNY_STREAM_LIBRARY_ID"), key: Deno.env.get("BUNNY_STREAM_API_KEY") },
    ].filter((l) => l.id && l.key) as { nome: string; id: string; key: string }[];
    if (libs.length === 0) return json({ error: "Bunny secrets não configurados" }, 500);

    const svc = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Todos os vídeos que ainda dependem do Bunny, os mais recentes primeiro.
    const { data: refs, error } = await svc
      .from("external_media_refs")
      .select("id, bunny_video_id, file_name, post_id, created_at")
      .not("bunny_video_id", "is", null)
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) return json({ error: error.message }, 500);

    const linhas = [];
    for (const r of refs ?? []) {
      let status: number | null = null;
      let progresso: number | null = null;
      let tamanho: number | null = null;
      let ondeEsta: string | null = null;
      let erro: string | null = null;

      for (const l of libs) {
        try {
          const res = await fetch(
            `https://video.bunnycdn.com/library/${l.id}/videos/${r.bunny_video_id}`,
            { headers: { AccessKey: l.key, accept: "application/json" } },
          );
          if (res.status === 404) continue;          // não é desta, tenta a próxima
          if (!res.ok) { erro = `consulta falhou na library ${l.nome} (${res.status})`; continue; }
          const v = await res.json();
          status = typeof v.status === "number" ? v.status : null;
          progresso = typeof v.encodeProgress === "number" ? v.encodeProgress : null;
          tamanho = typeof v.storageSize === "number" ? v.storageSize : null;
          ondeEsta = l.nome;
          break;
        } catch (e) {
          erro = String(e);
        }
      }
      if (!ondeEsta && !erro) erro = "não está em nenhuma das duas libraries";

      linhas.push({
        arquivo: r.file_name,
        media_id: r.id,
        post_id: r.post_id,
        anexado_em: r.created_at,
        library: ondeEsta,
        status,
        leitura: status === null ? (erro ?? "sem resposta") : (LEITURA[status] ?? `código ${status}`),
        progresso,
        tamanho_bytes: tamanho,
      });
    }

    const resumo = linhas.reduce<Record<string, number>>((acc, l) => {
      acc[l.leitura] = (acc[l.leitura] ?? 0) + 1;
      return acc;
    }, {});

    return json({ ok: true, total: linhas.length, resumo, videos: linhas });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
