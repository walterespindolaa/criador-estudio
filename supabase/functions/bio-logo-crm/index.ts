// Logo do cliente do CRM na página pública do Link na bio (22/10/2026).
//
// A logo mora na pasta privada "crm". Antes a ficha guardava um link assinado
// com prazo (1 ano nos envios novos): vencido o prazo, a logo sumia da página
// sem aviso. Agora a página aponta pra cá, e cada visita ganha um link novo de
// 1 hora. Quem decide QUAL arquivo pode sair é o banco
// (bio_logo_crm_caminho): só a logo daquele cliente, enviada por alguém da
// agência dele. Nada de documento, fonte ou arquivo de outro cliente.
import { createClient } from "npm:@supabase/supabase-js@2";

const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
  auth: { persistSession: false },
});

Deno.serve(async (req) => {
  if (req.method !== "GET" && req.method !== "HEAD") return new Response(null, { status: 405 });
  const nada = () => new Response(null, { status: 404, headers: { "Cache-Control": "public, max-age=300" } });
  const slug = (new URL(req.url).searchParams.get("slug") ?? "").trim().slice(0, 120);
  if (!/^[A-Za-z0-9._-]+$/.test(slug)) return nada();
  const { data: caminho, error } = await sb.rpc("bio_logo_crm_caminho", { _slug: slug });
  if (error || typeof caminho !== "string" || !caminho) return nada();
  const { data, error: e2 } = await sb.storage.from("crm").createSignedUrl(caminho, 60 * 60);
  if (e2 || !data?.signedUrl) return nada();
  return new Response(null, {
    status: 302,
    headers: { Location: data.signedUrl, "Cache-Control": "public, max-age=1800", "Access-Control-Allow-Origin": "*" },
  });
});
