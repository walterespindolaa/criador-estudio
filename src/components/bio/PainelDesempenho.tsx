import { useMemo, useState } from "react";
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis } from "recharts";
import { useBioStats } from "@/hooks/useBioStats";
import { useBioBlocks } from "@/hooks/useBioBlocks";
import { metaDoBloco, txt } from "@/lib/bioBlocks";
import { cn } from "@/lib/utils";

/* ═══════════════════════════════════════════════════════════════════════════
   DESEMPENHO

   O que a social mídia precisa poder dizer na reunião do cliente: o que puxou
   clique, o que ninguém tocou, e de onde veio a visita. Três totais desde
   sempre (que era o que tínhamos) não sustentam nenhuma dessas frases.
   ═══════════════════════════════════════════════════════════════════════════ */

const PERIODOS: { dias: number; rotulo: string }[] = [
  { dias: 7, rotulo: "7 dias" },
  { dias: 30, rotulo: "30 dias" },
  { dias: 90, rotulo: "90 dias" },
];

const NOME_ORIGEM: Record<string, string> = {
  instagram: "Instagram", whatsapp: "WhatsApp", qr: "QR impresso",
  facebook: "Facebook", google: "Google", tiktok: "TikTok",
  direto: "Direto", outro: "Outros",
};

const diaCurto = (iso: string) => {
  const [, m, d] = iso.split("-");
  return `${d}/${m}`;
};

function Variacao({ agora, antes }: { agora: number; antes: number }) {
  if (antes === 0) {
    // Sem base de comparação, inventar "+100%" seria mentir. Melhor dizer que
    // ainda não dá pra comparar.
    return <span className="text-[11px] font-body text-muted-foreground">sem período anterior</span>;
  }
  const p = Math.round(((agora - antes) / antes) * 100);
  if (p === 0) return <span className="text-[11px] font-body text-muted-foreground">igual ao período anterior</span>;
  return (
    <span className={cn("text-[11px] font-body font-semibold", p > 0 ? "text-emerald-600" : "text-orange-600")}>
      {p > 0 ? "+" : ""}{p}% vs. período anterior
    </span>
  );
}

function Numero({ rotulo, valor, children }: { rotulo: string; valor: string; children?: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-border bg-muted/25 p-3.5">
      <p className="text-[10px] font-body font-semibold uppercase tracking-wider text-muted-foreground">{rotulo}</p>
      <p className="font-display font-extrabold text-2xl leading-tight text-foreground tabular-nums">{valor}</p>
      {children}
    </div>
  );
}

export function PainelDesempenho({ estilo }: { estilo: "classico" | "site" }) {
  const [dias, setDias] = useState(30);
  const { data: s } = useBioStats(dias);
  const { blocos } = useBioBlocks(estilo);

  const ranking = useMemo(() => {
    if (!s) return [];
    const total = Object.values(s.porBloco).reduce((a, b) => a + b, 0);
    return Object.entries(s.porBloco)
      .map(([id, cliques]) => {
        const b = blocos.find((x) => x.id === id);
        const meta = b ? metaDoBloco(b.kind) : null;
        return {
          id, cliques,
          nome: b ? (txt(b.data ?? {}, "titulo") || meta?.nome || "Bloco") : "Bloco removido",
          emoji: meta?.emoji ?? "🔗",
          fatia: total > 0 ? Math.round((cliques / total) * 100) : 0,
        };
      })
      .sort((a, b) => b.cliques - a.cliques);
  }, [s, blocos]);

  const origens = useMemo(() => {
    if (!s) return [];
    const total = Object.values(s.porOrigem).reduce((a, b) => a + b, 0);
    return Object.entries(s.porOrigem)
      .map(([k, v]) => ({ nome: NOME_ORIGEM[k] ?? k, pct: total > 0 ? Math.round((v / total) * 100) : 0, v }))
      .sort((a, b) => b.v - a.v);
  }, [s]);

  // Blocos ligados que ninguém tocou: é a informação mais acionável da tela.
  const parados = useMemo(
    () => blocos.filter((b) => b.is_active && metaDoBloco(b.kind).clicavel && !(s?.porBloco[b.id] ?? 0)),
    [blocos, s],
  );

  const conversao = s && s.visitas > 0 ? Math.round((s.cliques / s.visitas) * 100) : 0;
  const semDados = !s || (s.visitas === 0 && s.cliques === 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h3 className="font-display font-semibold text-foreground">Desempenho</h3>
          <p className="text-xs font-body text-muted-foreground">Visitas contam uma vez por pessoa na sessão.</p>
        </div>
        <div className="flex gap-1.5">
          {PERIODOS.map((p) => (
            <button key={p.dias} type="button" onClick={() => setDias(p.dias)}
              className={cn("rounded-full px-3 py-1.5 text-xs font-body font-semibold border transition-all",
                dias === p.dias ? "bg-primary text-primary-foreground border-primary" : "border-border hover:border-primary/40")}>
              {p.rotulo}
            </button>
          ))}
        </div>
      </div>

      {semDados ? (
        <div className="rounded-2xl border border-dashed border-border p-8 text-center">
          <p className="text-sm font-body font-medium text-foreground">Nenhuma visita neste período</p>
          <p className="text-xs font-body text-muted-foreground mt-1 max-w-sm mx-auto">
            Assim que o link entrar na bio do Instagram, os números começam a aparecer aqui.
          </p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
            <Numero rotulo="Visitas" valor={String(s.visitas)}><Variacao agora={s.visitas} antes={s.visitasAntes} /></Numero>
            <Numero rotulo="Cliques" valor={String(s.cliques)}><Variacao agora={s.cliques} antes={s.cliquesAntes} /></Numero>
            <Numero rotulo="Conversão" valor={`${conversao}%`}>
              <span className="text-[11px] font-body text-muted-foreground">quantas visitas tocam em algo</span>
            </Numero>
            <Numero rotulo="Blocos parados" valor={String(parados.length)}>
              <span className="text-[11px] font-body text-muted-foreground">
                {parados.length === 0 ? "todos receberam clique" : "no ar e sem nenhum clique"}
              </span>
            </Numero>
          </div>

          <div className="rounded-2xl border border-border bg-card p-3.5">
            <p className="text-[11px] font-body font-semibold uppercase tracking-wider text-muted-foreground mb-2">Visitas por dia</p>
            <div className="h-[150px] -ml-2">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={s.porDia} margin={{ top: 4, right: 6, left: 6, bottom: 0 }}>
                  <defs>
                    <linearGradient id="grad-bio" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.35} />
                      <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="dia" tickFormatter={diaCurto} tickLine={false} axisLine={false}
                    tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                    interval={Math.max(0, Math.floor(s.porDia.length / 6) - 1)} />
                  <Tooltip
                    contentStyle={{ borderRadius: 12, border: "1px solid hsl(var(--border))", fontSize: 12 }}
                    labelFormatter={(v) => diaCurto(String(v))}
                    formatter={(v: number, n: string) => [v, n === "visitas" ? "visitas" : "cliques"]} />
                  <Area type="monotone" dataKey="visitas" stroke="hsl(var(--primary))" strokeWidth={2} fill="url(#grad-bio)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {ranking.length > 0 && (
            <div className="rounded-2xl border border-border bg-card p-3.5">
              <p className="text-[11px] font-body font-semibold uppercase tracking-wider text-muted-foreground mb-2.5">
                Qual bloco puxa o clique
              </p>
              <div className="space-y-2">
                {ranking.map((r) => (
                  <div key={r.id} className="flex items-center gap-2.5">
                    <span className="text-base shrink-0" aria-hidden>{r.emoji}</span>
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] font-body font-medium text-foreground truncate">{r.nome}</p>
                      <div className="h-1.5 rounded-full bg-muted mt-1 overflow-hidden">
                        <div className="h-full rounded-full bg-primary" style={{ width: `${r.fatia}%` }} />
                      </div>
                    </div>
                    <span className="text-[12px] font-body tabular-nums text-muted-foreground shrink-0 w-16 text-right">
                      {r.cliques} · {r.fatia}%
                    </span>
                  </div>
                ))}
              </div>
              {parados.length > 0 && (
                <p className="text-[11.5px] font-body text-muted-foreground mt-3 pt-3 border-t border-border">
                  Sem nenhum clique no período: {parados.map((b) => txt(b.data ?? {}, "titulo") || metaDoBloco(b.kind).nome).join(", ")}.
                  Vale trocar o texto, subir de posição ou tirar do ar.
                </p>
              )}
            </div>
          )}

          {origens.length > 0 && (
            <div className="rounded-2xl border border-border bg-card p-3.5">
              <p className="text-[11px] font-body font-semibold uppercase tracking-wider text-muted-foreground mb-2.5">
                De onde veio a visita
              </p>
              <div className="flex flex-wrap gap-2">
                {origens.map((o) => (
                  <div key={o.nome} className="rounded-xl border border-border bg-muted/25 px-3 py-2">
                    <p className="font-display font-bold text-base leading-none">{o.pct}%</p>
                    <p className="text-[11px] font-body text-muted-foreground mt-0.5">{o.nome}</p>
                  </div>
                ))}
              </div>
              <p className="text-[11px] font-body text-muted-foreground mt-2.5">
                Pra separar o material impresso, coloque <code className="font-mono">?src=qr</code> no fim do endereço do QR Code.
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
