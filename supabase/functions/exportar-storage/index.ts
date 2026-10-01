// ═══════════════════════════════════════════════════════════════════════════
// EXPORTAR-STORAGE (01/10/2026) · TEMPORÁRIA, só admin · apagar depois da migração
//
// A exportação da Lovable leva o banco, mas não os arquivos dos buckets. Esta
// função lista os buckets e os arquivos de cada um e devolve links assinados
// (válidos por 6h) pra cópia ser feita pro projeto novo da Supabase. Nenhuma
// chave sai do servidor: quem baixa usa só os links.
//
//   { acao: "buckets" }                         -> buckets (id, public)
//   { acao: "listar", bucket, pasta? }          -> arquivos da pasta + subpastas
//   { acao: "assinar", bucket, caminhos[] }     -> links assinados (até 200)
// ═══════════════════════════════════════════════════════════════════════════
import { createClient } from "npm:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const auth = req.headers.get("Authorization") ?? "";
    const uc = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: auth } } });
    const { data: { user } } = await uc.auth.getUser();
    if (!user) return json({ error: "unauthorized" }, 401);
    const svc = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: caller } = await svc.from("profiles").select("role").eq("id", user.id).single();
    if (caller?.role !== "admin") return json({ error: "forbidden" }, 403);

    const b = await req.json().catch(() => ({}));
    if (b.acao === "buckets") {
      const { data, error } = await svc.storage.listBuckets();
      if (error) throw error;
      return json({ buckets: (data ?? []).map((x) => ({ id: x.id, public: x.public, file_size_limit: x.file_size_limit, allowed_mime_types: x.allowed_mime_types })) });
    }
    if (b.acao === "listar") {
      const pasta = (b.pasta ?? "") as string;
      const arquivos: { caminho: string; tamanho: number | null; tipo: string | null }[] = [];
      const pastas: string[] = [];
      for (let offset = 0; ; offset += 1000) {
        const { data, error } = await svc.storage.from(b.bucket).list(pasta, { limit: 1000, offset });
        if (error) throw error;
        for (const it of data ?? []) {
          const caminho = pasta ? `${pasta}/${it.name}` : it.name;
          if (it.id === null) pastas.push(caminho);
          else arquivos.push({ caminho, tamanho: (it.metadata as { size?: number } | null)?.size ?? null, tipo: (it.metadata as { mimetype?: string } | null)?.mimetype ?? null });
        }
        if (!data || data.length < 1000) break;
      }
      return json({ arquivos, pastas });
    }
    if (b.acao === "assinar") {
      const caminhos = (b.caminhos ?? []).slice(0, 200) as string[];
      const { data, error } = await svc.storage.from(b.bucket).createSignedUrls(caminhos, 6 * 3600);
      if (error) throw error;
      return json({ links: (data ?? []).map((x) => ({ caminho: x.path, url: x.signedUrl, erro: x.error })) });
    }
    return json({ error: "ação inválida" }, 400);
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
