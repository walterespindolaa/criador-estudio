// ═══════════════════════════════════════════════════════════════════════════
// IMPORTAR-STORAGE (12/10/2026) · TEMPORÁRIA · apagar depois da migração
//
// Roda no projeto NOVO. Puxa os arquivos dos buckets do projeto velho (Lovable)
// e grava no mesmo caminho aqui. Quem autoriza é o projeto velho: a função
// recebe o token de login do admin NO VELHO e chama a `exportar-storage` de lá,
// que só responde pra admin. Sem token válido de admin, nada acontece.
// Nenhuma chave sai daqui: o download usa links assinados de 6h.
//
//   { tokenVelho, bucket, inicio?, quantos? }
//   -> { total, feitos, falhas[], proximo }   (proximo = null quando acabou)
// ═══════════════════════════════════════════════════════════════════════════
import { createClient } from "npm:@supabase/supabase-js@2";

const VELHO = "https://exuxlwdnkgmhtnwoyvwo.supabase.co/functions/v1/exportar-storage";
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

type Arquivo = { caminho: string; tamanho: number | null; tipo: string | null };

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const { tokenVelho, bucket, inicio = 0, quantos = 25 } = await req.json().catch(() => ({}));
    if (!tokenVelho || !bucket) return json({ error: "faltam tokenVelho e bucket" }, 400);

    const velho = async (corpo: unknown) => {
      const r = await fetch(VELHO, {
        method: "POST",
        headers: { Authorization: `Bearer ${tokenVelho}`, "Content-Type": "application/json" },
        body: JSON.stringify(corpo),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(`projeto velho respondeu ${r.status}: ${j?.error ?? ""}`);
      return j;
    };

    // Lista o bucket inteiro (com subpastas), sempre na mesma ordem.
    const todos: Arquivo[] = [];
    const fila = [""];
    while (fila.length) {
      const pasta = fila.shift()!;
      const l = await velho({ acao: "listar", bucket, pasta });
      todos.push(...(l.arquivos ?? []));
      fila.push(...(l.pastas ?? []));
    }
    todos.sort((a, b) => a.caminho.localeCompare(b.caminho));

    const lote = todos.slice(inicio, inicio + quantos);
    if (lote.length === 0) return json({ total: todos.length, feitos: 0, falhas: [], proximo: null });

    const { links } = await velho({ acao: "assinar", bucket, caminhos: lote.map((a) => a.caminho) });
    const svc = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const falhas: { caminho: string; erro: string }[] = [];

    for (const l of (links ?? []) as { caminho: string; url: string | null; erro: string | null }[]) {
      try {
        if (l.erro || !l.url) throw new Error(l.erro ?? "sem link");
        const r = await fetch(l.url);
        if (!r.ok) throw new Error(`download ${r.status}`);
        const blob = await r.blob();
        const tipo = lote.find((a) => a.caminho === l.caminho)?.tipo || blob.type || undefined;
        const { error } = await svc.storage.from(bucket).upload(l.caminho, blob, { upsert: true, contentType: tipo });
        if (error) throw error;
      } catch (e) {
        falhas.push({ caminho: l.caminho, erro: String((e as Error)?.message ?? e) });
      }
    }
    const fim = inicio + quantos;
    return json({ total: todos.length, feitos: lote.length - falhas.length, falhas, proximo: fim < todos.length ? fim : null });
  } catch (e) {
    return json({ error: String((e as Error)?.message ?? e) }, 500);
  }
});
