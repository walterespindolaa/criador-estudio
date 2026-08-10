// ═══════════════════════════════════════════════════════════════════════════
// DRIVE-FILE-META descobre o TIPO REAL de um arquivo do Google Drive.
//
// POR QUE EXISTE: quando a social mídia cola um "Link Drive" no Cria Post, o link
// não diz se aponta pra uma imagem ou pra um vídeo. Antes o app CHUTAVA vídeo, e
// uma arte estática aparecia com play gigante e botão "Assistir no Drive". Aqui a
// gente pergunta pro próprio Drive qual é o mimeType e grava isso em file_type, de
// uma vez só, na origem: prévia, download, portal do cliente e relatório passam a
// acertar sozinhos.
//
// COMO FUNCIONA: Drive API v3 files.get com a GOOGLE_API_KEY (a mesma do drive-list,
// sem OAuth). Isso enxerga arquivos compartilhados como "qualquer pessoa com o link",
// que é exatamente o que o Cria Post já exige pra prévia aparecer.
//
// POR QUE NÃO USAR O TOKEN OAUTH DO USUÁRIO: o seletor do Drive pede o escopo
// `drive.file`, que só dá acesso aos arquivos escolhidos NAQUELE seletor. Um link
// colado nunca passou pelo seletor, então o token do usuário não enxerga o arquivo.
// Além disso o link pode ser de outra conta do Google. Por isso: API key.
//
// QUANDO NÃO DÁ (arquivo privado / outra conta sem link público), devolve
// { ok: false, reason: "not_public" } e o app cai no ESTADO NEUTRO (miniatura sem
// play + atalho "Abrir no Drive"), sem chutar tipo nenhum.
// ═══════════════════════════════════════════════════════════════════════════
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": Deno.env.get("ALLOWED_ORIGIN") || "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

// Extrai o FILE_ID a partir da URL colada (ou aceita o ID cru).
// Cobre: /file/d/<id>/view · open?id=<id> · uc?id=<id> · ?id=<id>
function extractFileId(input: string): string | null {
  const s = (input || "").trim();
  if (!s) return null;
  // Link de PASTA não é arquivo: recusa explicitamente pra não pedir meta de pasta.
  if (/\/folders\//i.test(s)) return null;
  const byPath = s.match(/\/(?:file\/)?d\/([-\w]{20,})/);
  if (byPath) return byPath[1];
  const byParam = s.match(/[?&]id=([-\w]{20,})/);
  if (byParam) return byParam[1];
  if (/^[-\w]{20,}$/.test(s)) return s;
  return null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Auth do usuário (mesmo padrão do drive-list, verify_jwt = true).
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Missing auth" }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!);
    const { data: { user }, error: authError } = await anonClient.auth.getUser(authHeader.replace("Bearer ", ""));
    if (authError || !user) return json({ error: "Unauthorized" }, 401);

    const body = await req.json().catch(() => ({}));
    const raw: string = body?.file_url ?? body?.file_id ?? "";
    const fileId = extractFileId(raw);
    if (!fileId) {
      return json({ ok: false, reason: "invalid_url", message: "Link do Drive inválido. Cole o link de um ARQUIVO (…/file/d/…)." }, 200);
    }

    const apiKey = Deno.env.get("GOOGLE_API_KEY");
    if (!apiKey) {
      // Sem chave a gente NÃO chuta: devolve desconhecido e o app usa o estado neutro.
      console.error("[drive-file-meta] GOOGLE_API_KEY não configurada");
      return json({ ok: false, file_id: fileId, reason: "missing_key" }, 200);
    }

    const params = new URLSearchParams({
      key: apiKey,
      fields: "id,name,mimeType,thumbnailLink",
      supportsAllDrives: "true",
    });
    const res = await fetch(
      `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?${params.toString()}`,
    );

    if (!res.ok) {
      // 403/404 = arquivo privado, de outra conta ou inexistente pra uma chamada
      // por API key. Não é erro do app: é ambiguidade legítima.
      if (res.status === 403 || res.status === 404) {
        return json({ ok: false, file_id: fileId, reason: "not_public" }, 200);
      }
      let detail = `Drive API respondeu ${res.status}`;
      try {
        const b = await res.json();
        detail = b?.error?.message || detail;
      } catch { /* corpo não-JSON, mantém o genérico */ }
      console.error("[drive-file-meta] Drive API error:", res.status, detail);
      return json({ ok: false, file_id: fileId, reason: "drive_error", message: detail }, 200);
    }

    const data = await res.json();
    const mimeType: string = data?.mimeType ?? "";

    // Pasta ou documento do Google (Docs/Sheets/Slides) não é mídia de post.
    // Devolve o mime cru mesmo assim; quem chama decide o que fazer.
    return json({
      ok: true,
      file_id: fileId,
      mime_type: mimeType || null,
      name: data?.name ?? null,
      thumbnail_link: data?.thumbnailLink ?? null,
    });
  } catch (err) {
    console.error("[drive-file-meta] unhandled error:", err);
    return json({ ok: false, reason: "internal_error" }, 200);
  }
});
