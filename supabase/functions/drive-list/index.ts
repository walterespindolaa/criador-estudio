// ═══════════════════════════════════════════════════════════════════════════
// DRIVE-LIST lista o conteúdo de uma pasta pública do Google Drive.
//
// A social mídia cola o LINK de uma pasta do Drive nos "links úteis" do cliente;
// aqui a gente lê o que existe DENTRO dessa pasta (subpastas + arquivos) e devolve
// pra ficha do cliente montar a listagem, igual o concorrente (Bagano).
//
// COMO FUNCIONA: usa a Google Drive API v3 com uma API KEY (sem OAuth). Isso só
// enxerga pastas compartilhadas como "qualquer pessoa com o link pode ver". Se a
// pasta for privada, a API responde 403/404 e a gente devolve mensagem clara.
// ═══════════════════════════════════════════════════════════════════════════
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": Deno.env.get("ALLOWED_ORIGIN") || "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const FOLDER_MIME = "application/vnd.google-apps.folder";

// Extrai o ID da pasta a partir da URL colada. Cobre os dois formatos comuns:
//   .../folders/{ID}          (link de pasta)
//   ...?id={ID} ou &id={ID}   (link antigo/open)
// Se vier só o ID cru, aceita também.
function extractFolderId(input: string): string | null {
  const s = (input || "").trim();
  if (!s) return null;
  const byFolders = s.match(/\/folders\/([a-zA-Z0-9_-]+)/);
  if (byFolders) return byFolders[1];
  const byId = s.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (byId) return byId[1];
  // ID cru (sem barras nem espaços): trata como o próprio folder_id.
  if (/^[a-zA-Z0-9_-]{10,}$/.test(s)) return s;
  return null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Auth do usuário (mesmo padrão das outras funções verify_jwt = true).
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Missing auth" }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!);
    const { data: { user }, error: authError } = await anonClient.auth.getUser(authHeader.replace("Bearer ", ""));
    if (authError || !user) return json({ error: "Unauthorized" }, 401);

    const body = await req.json().catch(() => ({}));
    const folderUrl: string = body?.folder_url ?? body?.folder_id ?? "";
    const folderId = extractFolderId(folderUrl);
    if (!folderId) {
      return json({ error: "invalid_url", message: "Link do Drive inválido. Cole o link de uma PASTA (com /folders/…)." }, 400);
    }

    const apiKey = Deno.env.get("GOOGLE_API_KEY");
    if (!apiKey) {
      return json({ error: "missing_key", message: "GOOGLE_API_KEY não configurada" }, 500);
    }

    // Monta a chamada da Drive API v3. supportsAllDrives/includeItemsFromAllDrives
    // cobrem também os Drives compartilhados; orderBy joga pasta antes de arquivo.
    const params = new URLSearchParams({
      q: `'${folderId}' in parents and trashed=false`,
      key: apiKey,
      fields: "files(id,name,mimeType,webViewLink,iconLink,modifiedTime)",
      orderBy: "folder,name",
      pageSize: "200",
      supportsAllDrives: "true",
      includeItemsFromAllDrives: "true",
    });
    const url = `https://www.googleapis.com/drive/v3/files?${params.toString()}`;

    const res = await fetch(url);
    if (!res.ok) {
      // 403/404 = pasta privada ou inexistente pra uma chamada por API key.
      if (res.status === 403 || res.status === 404) {
        return json({
          error: "not_public",
          message: "Pasta não encontrada ou não está compartilhada publicamente (defina como 'qualquer pessoa com o link').",
        }, 200);
      }
      let detail = `Drive API respondeu ${res.status}`;
      try {
        const b = await res.json();
        detail = b?.error?.message || detail;
      } catch { /* corpo não-JSON, mantém o genérico */ }
      console.error("[drive-list] Drive API error:", res.status, detail);
      return json({ error: "drive_error", message: detail }, 200);
    }

    const data = await res.json();
    const files = Array.isArray(data?.files) ? data.files : [];
    const items = files.map((f: Record<string, unknown>) => ({
      id: f.id,
      name: f.name,
      mimeType: f.mimeType,
      webViewLink: f.webViewLink ?? null,
      modifiedTime: f.modifiedTime ?? null,
      isFolder: f.mimeType === FOLDER_MIME,
    }));

    // Link raiz da pasta (pro botão "Abrir no Drive"), reconstruído do ID.
    const rootUrl = `https://drive.google.com/drive/folders/${folderId}`;

    return json({ folder_id: folderId, root_url: rootUrl, items });
  } catch (err) {
    console.error("[drive-list] unhandled error:", err);
    return json({ error: "internal_error", message: "Erro interno ao listar a pasta do Drive." }, 500);
  }
});
