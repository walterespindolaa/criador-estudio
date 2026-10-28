import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, ExternalLink, Table2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { ehReels, ganchoDaLegenda, type MidiaIg } from "./ganchos";

/* ═══════════════════════════════════════════════════════════════════════════
   TODOS OS POSTS (Walter, 28/10/2026; mockup aprovado)

   Uma tabela com todos os números de cada post, ordenável por qualquer
   coluna. Reposts e ações no perfil (toque no link da bio, ligar, e-mail,
   rota) são números que a Meta passou a dar e o Cria não mostrava.
   ═══════════════════════════════════════════════════════════════════════════ */

type Col = { k: string; nome: string; valor: (m: Record<string, unknown>) => number | null };
const n = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);
const COLS: Col[] = [
  { k: "views", nome: "Visualiz.", valor: (m) => n(m.views) },
  { k: "reach", nome: "Alcance", valor: (m) => n(m.reach) },
  { k: "likes", nome: "Curtidas", valor: (m) => n(m.likes) },
  { k: "comments", nome: "Coment.", valor: (m) => n(m.comments) },
  { k: "saved", nome: "Salvos", valor: (m) => n(m.saved) ?? n(m.saves) },
  { k: "shares", nome: "Compart.", valor: (m) => n(m.shares) },
  { k: "reposts", nome: "Reposts", valor: (m) => n(m.reposts) },
  { k: "profile_activity", nome: "Ações no perfil", valor: (m) => n(m.profile_activity) },
  { k: "follows", nome: "Seguidores", valor: (m) => n(m.follows) },
];

export function TabelaPosts({ media, limite = 30 }: { media: MidiaIg[] | null | undefined; limite?: number }) {
  const [col, setCol] = useState("views");
  const [desc, setDesc] = useState(true);
  const linhas = useMemo(() => {
    const c = COLS.find((x) => x.k === col) ?? COLS[0];
    return [...(media ?? [])]
      .sort((a, b) => {
        const va = c.valor((a.metrics ?? {}) as Record<string, unknown>) ?? -1;
        const vb = c.valor((b.metrics ?? {}) as Record<string, unknown>) ?? -1;
        return desc ? vb - va : va - vb;
      })
      .slice(0, limite);
  }, [media, col, desc, limite]);

  if (!linhas.length) return null;
  const clicar = (k: string) => { if (k === col) setDesc(!desc); else { setCol(k); setDesc(true); } };

  return (
    <div className="rounded-2xl border bg-card p-4">
      <p className="text-base font-display font-extrabold flex items-center gap-2"><Table2 className="h-4 w-4 text-primary" /> Todos os posts</p>
      <p className="text-xs text-muted-foreground mt-0.5">Toque no título da coluna pra ordenar. "Ações no perfil" soma toques no link da bio, ligar, e-mail e rota depois de ver o post.</p>
      <div className="mt-3 overflow-x-auto -mx-4 px-4">
        <table className="w-full min-w-[920px] text-[12.5px]">
          <thead>
            <tr className="text-right text-muted-foreground">
              <th className="text-left font-semibold py-2 pr-2">Post</th>
              {COLS.map((c) => (
                <th key={c.k} className="py-1 px-0.5">
                  <button type="button" onClick={() => clicar(c.k)} aria-sort={col === c.k ? (desc ? "descending" : "ascending") : undefined}
                    className={cn("inline-flex items-center gap-0.5 rounded-md px-1.5 py-1 font-semibold", col === c.k ? "bg-muted text-foreground" : "hover:bg-muted/60")}>
                    {c.nome}{col === c.k && (desc ? <ArrowDown className="h-3 w-3" /> : <ArrowUp className="h-3 w-3" />)}
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {linhas.map((m) => {
              const met = (m.metrics ?? {}) as Record<string, unknown>;
              const tipo = ehReels(m.media_type) ? "Reels" : m.media_type === "CAROUSEL_ALBUM" ? "Carrossel" : "Foto";
              return (
                <tr key={m.id} className="border-t text-right">
                  <td className="text-left py-2 pr-2">
                    <div className="flex items-center gap-2 max-w-[280px]">
                      <span className="w-8 h-10 rounded-md bg-muted overflow-hidden shrink-0">
                        {m.thumbnail_url && <img src={m.thumbnail_url} alt="" loading="lazy" referrerPolicy="no-referrer" className="w-full h-full object-cover" onError={(e) => { e.currentTarget.style.display = "none"; }} />}
                      </span>
                      <span className="min-w-0">
                        <span className="block font-semibold truncate">{ganchoDaLegenda(m.caption) || "(sem legenda)"}</span>
                        <span className="block text-[11px] text-muted-foreground">
                          {tipo}{m.posted_at ? ` · ${new Date(m.posted_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}` : ""}
                          {m.permalink && <a href={m.permalink} target="_blank" rel="noreferrer" className="ml-1 inline-flex align-middle hover:text-primary" aria-label="Abrir no Instagram"><ExternalLink className="h-3 w-3" /></a>}
                        </span>
                      </span>
                    </div>
                  </td>
                  {COLS.map((c) => {
                    const v = c.valor(met);
                    return <td key={c.k} className="px-2 tabular-nums">{v == null ? <span className="text-muted-foreground/60">—</span> : c.k === "follows" ? `+${v}` : v.toLocaleString("pt-BR")}</td>;
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-[11px] text-muted-foreground">— = o Instagram não dá esse número pra esse formato (ex.: seguidores e ações no perfil não existem pra Reels).</p>
    </div>
  );
}
