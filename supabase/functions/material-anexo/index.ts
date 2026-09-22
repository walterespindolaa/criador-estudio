// O CLIENTE ANEXA UM EXEMPLO NO PEDIDO DE MATERIAL (Gabriela, 21/09/2026:
// "tem como deixar pra ele adicionar anexo se quiser? se tiver algum exemplo
// do material que ele precisa, ou print por exemplo").
//
// O cliente não tem login: ele chega pelo token do link. Nenhum bucket do
// projeto aceita escrita anônima, e abrir um seria o tipo de coisa que a gente
// não desfaz depois. Então o upload passa por aqui: a edge confere o token,
// decide o caminho do arquivo (o cliente não escolhe onde grava) e sobe com a
// service role. Mesmo padrão das outras portas anônimas do portal.
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

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

// Só o que faz sentido como "exemplo do material": imagem e PDF. Nada de
// executável, zip ou vídeo, que não têm uso aqui e só aumentam a superfície.
const TIPOS_OK = new Set([
  "image/png", "image/jpeg", "image/jpg", "image/webp", "image/gif", "image/heic", "application/pdf",
]);
const MAX_BYTES = 8 * 1024 * 1024; // 8 MB: é print e PDF de briefing, não arquivo de arte.

const nomeSeguro = (n: string) =>
  (n || "anexo")
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase()
    .slice(-70) || "anexo";

serve(async (req) => {
  const cors = corsFor(req);
  const json = (b: unknown, s = 200) =>
    new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  try {
    const body = await req.json().catch(() => ({}));
    const token = String(body?.token ?? "").trim();
    const nome = String(body?.nome ?? "anexo");
    const tipo = String(body?.tipo ?? "").toLowerCase();
    const base64 = String(body?.base64 ?? "");
    if (!token || !base64) return json({ error: "faltou_dado" }, 400);
    if (!TIPOS_OK.has(tipo)) {
      return json({ error: "tipo_nao_aceito", message: "Mande imagem (PNG, JPG, WEBP) ou PDF." }, 400);
    }

    const svc = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // O token manda em tudo: é ele que diz de qual cliente é a pasta. Sem isso,
    // qualquer um escreveria em qualquer prefixo.
    const { data: tok } = await svc
      .from("approval_tokens")
      .select("external_client_id, active, expires_at")
      .eq("token", token)
      .maybeSingle();
    if (!tok || tok.active !== true || (tok.expires_at && new Date(tok.expires_at) < new Date())) {
      return json({ error: "link_invalido", message: "Este link não está mais ativo." }, 403);
    }

    // base64 -> bytes, medindo DEPOIS de decodificar: o limite é do arquivo
    // real, não do texto inflado em 33% que chega no corpo.
    const limpo = base64.includes(",") ? base64.slice(base64.indexOf(",") + 1) : base64;
    let bytes: Uint8Array;
    try {
      const bin = atob(limpo);
      bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    } catch {
      return json({ error: "arquivo_invalido" }, 400);
    }
    if (bytes.length === 0) return json({ error: "arquivo_vazio" }, 400);
    if (bytes.length > MAX_BYTES) {
      return json({ error: "muito_grande", message: "O arquivo passa de 8 MB. Mande um print ou um PDF menor." }, 400);
    }

    const caminho = `portal/${tok.external_client_id}/materiais/${Date.now()}-${nomeSeguro(nome)}`;
    const { error: upErr } = await svc.storage.from("media")
      .upload(caminho, bytes, { contentType: tipo, upsert: false, cacheControl: "31536000" });
    if (upErr) return json({ error: "upload_falhou", message: upErr.message }, 500);

    const { data: pub } = svc.storage.from("media").getPublicUrl(caminho);
    return json({ ok: true, anexo: { kind: "file", name: nome.slice(0, 120), url: pub.publicUrl, path: caminho, type: tipo, size: bytes.length } });
  } catch (e) {
    console.error("[material-anexo] falhou:", e);
    return json({ error: "erro", message: (e as Error).message }, 500);
  }
});
