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
    const apiKey = Deno.env.get("BUNNY_STREAM_API_KEY");
    const lib = Deno.env.get("BUNNY_STREAM_LIBRARY_ID");
    if (!apiKey || !lib) return json({ error: "Bunny secrets não configurados" }, 500);

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
      let erro: string | null = null;
      try {
        const res = await fetch(
          `https://video.bunnycdn.com/library/${lib}/videos/${r.bunny_video_id}`,
          { headers: { AccessKey: apiKey, accept: "application/json" } },
        );
        if (res.status === 404) {
          erro = "não existe mais nesta library do Bunny";
        } else if (!res.ok) {
          erro = `consulta falhou (${res.status})`;
        } else {
          const v = await res.json();
          status = typeof v.status === "number" ? v.status : null;
          progresso = typeof v.encodeProgress === "number" ? v.encodeProgress : null;
        }
      } catch (e) {
        erro = String(e);
      }
      linhas.push({
        arquivo: r.file_name,
        media_id: r.id,
        post_id: r.post_id,
        anexado_em: r.created_at,
        status,
        leitura: status === null ? (erro ?? "sem resposta") : (LEITURA[status] ?? `código ${status}`),
        progresso,
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
