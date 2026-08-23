import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { previaDeLink, type PreviaLink } from "@/lib/refPreview";
import { refLinkHref } from "@/lib/refLinks";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sbFrom = (table: string) => (supabase as any).from(table);

/* ═══════════════════════════════════════════════════════════════════════════
   CAPA DO LINK DE REFERÊNCIA

   O Instagram não entrega a capa por URL pública, então ela só existe se
   alguém for lá buscar. A edge `saved-fetch` (a mesma dos Salvos) faz isso via
   Apify e já guarda a imagem num bucket nosso, porque a URL do CDN expira.

   Como scrape custa, aqui tem duas regras:
   · UM link, UMA busca: o resultado vai pra tabela link_previews e vale pra
     conta inteira, pra sempre;
   · YouTube não passa por aqui: a capa dele sai de graça pela própria URL.
   ═══════════════════════════════════════════════════════════════════════════ */

export type CapaDeLink = { url: string; thumb: string | null; caption: string | null; author: string | null };

/** Chave do cache: sem querystring (o mesmo reel colado de dois lugares é um só). */
export function chaveDoLink(link: string): string {
  const u = refLinkHref(link);
  return u.split("?")[0].replace(/\/$/, "");
}

/** Precisa ir na internet pra ter capa? (YouTube resolve sozinho.) */
function precisaBuscar(p: PreviaLink): boolean {
  return (p.plataforma === "instagram" || p.plataforma === "tiktok") && !p.thumb;
}

/**
 * Capas dos links pedidos. Lê o cache; o que faltar é buscado uma vez só e
 * gravado. Devolve um mapa { chave -> capa }.
 */
export function useLinkPreviews(links: string[]) {
  const qc = useQueryClient();
  const chaves = Array.from(new Set(links.map(chaveDoLink).filter(Boolean)));
  const chave = chaves.slice().sort().join("|");

  const q = useQuery({
    queryKey: ["link-previews", chave],
    enabled: chaves.length > 0,
    staleTime: 1000 * 60 * 60,
    queryFn: async (): Promise<Record<string, CapaDeLink>> => {
      const { data, error } = await sbFrom("link_previews").select("*").in("url", chaves);
      if (error) return {};
      const mapa: Record<string, CapaDeLink> = {};
      for (const r of (data ?? []) as Array<{ url: string; thumb_url: string | null; caption: string | null; author: string | null }>) {
        mapa[r.url] = { url: r.url, thumb: r.thumb_url, caption: r.caption, author: r.author };
      }
      return mapa;
    },
  });

  // O que não está no cache e precisa de busca vai pra fila, um por vez, pra
  // não disparar dez scrapes juntos quando a tela abre.
  useEffect(() => {
    if (!q.data) return;
    const faltando = chaves.filter((k) => !q.data?.[k] && precisaBuscar(previaDeLink(k)));
    if (faltando.length === 0) return;

    let cancelado = false;
    (async () => {
      for (const url of faltando) {
        if (cancelado) return;
        try {
          const { data, error } = await supabase.functions.invoke("saved-fetch", { body: { url } });
          if (error) continue;
          const r = data as { thumbnail?: string | null; caption?: string | null; author?: string | null; platform?: string | null };
          await sbFrom("link_previews").upsert({
            url,
            platform: r?.platform ?? previaDeLink(url).plataforma,
            thumb_url: r?.thumbnail ?? null,
            caption: r?.caption ?? null,
            author: r?.author ?? null,
            fetched_at: new Date().toISOString(),
          }, { onConflict: "url" });
        } catch { /* link problemático não pode travar a tela */ }
      }
      if (!cancelado) void qc.invalidateQueries({ queryKey: ["link-previews", chave] });
    })();

    return () => { cancelado = true; };
    // chave resume a lista; q.data marca "cache já consultado".
  }, [chave, q.data, qc]); // eslint-disable-line react-hooks/exhaustive-deps

  return q.data ?? {};
}

/** Junta a prévia calculada do link com a capa que veio do cache. */
export function comCapa(link: string, capas: Record<string, CapaDeLink>): PreviaLink {
  const p = previaDeLink(link);
  const c = capas[chaveDoLink(link)];
  return c?.thumb ? { ...p, thumb: c.thumb } : p;
}
