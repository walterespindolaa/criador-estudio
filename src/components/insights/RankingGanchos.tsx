import { useMemo, useState } from "react";
import { ExternalLink, Flame } from "lucide-react";
import { cn } from "@/lib/utils";
import { fmtNum } from "./insightsUtils";
import { rankingDeGanchos, type Janela, type MidiaIg } from "./ganchos";

/* ═══════════════════════════════════════════════════════════════════════════
   RANKING DE GANCHOS (Walter, 28/10/2026; mockup aprovado)

   Quais Reels seguraram mais gente nos 3 primeiros segundos (o contrário do
   "pulou" da Meta) e por quanto tempo, comparando cada um na mesma idade
   (24 h ou 7 dias). Serve pro criador e pra visão do cliente.
   ═══════════════════════════════════════════════════════════════════════════ */

const segs = (s: number | null) => (s == null ? "—" : s < 60 ? `${s.toFixed(1).replace(".", ",")}s` : `${Math.floor(s / 60)}m ${String(Math.round(s % 60)).padStart(2, "0")}s`);

function Abas<T extends string>({ valor, opcoes, onChange, rotulo }: { valor: T; opcoes: Array<[T, string]>; onChange: (v: T) => void; rotulo: string }) {
  return (
    <div role="tablist" aria-label={rotulo} className="flex gap-1 rounded-full bg-muted p-1">
      {opcoes.map(([k, nome]) => (
        <button key={k} type="button" role="tab" aria-selected={valor === k} onClick={() => onChange(k)}
          className={cn("h-8 px-3 rounded-full text-xs font-semibold", valor === k ? "bg-foreground text-background" : "text-foreground/80 hover:bg-background")}>
          {nome}
        </button>
      ))}
    </div>
  );
}

export function RankingGanchos({ media, ganchoDe, limite = 8 }: {
  media: MidiaIg[] | null | undefined;
  /** Gancho do post do Cria ligado (quando houver); senão usa a 1ª frase da legenda. */
  ganchoDe?: (m: MidiaIg) => string | null | undefined;
  limite?: number;
}) {
  const lista = useMemo(() => media ?? [], [media]);
  // Começa na foto de 24 h quando já há base; senão, nos números de hoje.
  const inicial: Janela = useMemo(() => (rankingDeGanchos(lista, "24h", "views").linhas.length >= 3 ? "24h" : "total"), [lista]);
  const [janela, setJanela] = useState<Janela | null>(null);
  const [ordem, setOrdem] = useState<"passou" | "tempo" | "views">("passou");
  const j = janela ?? inicial;
  const { linhas, semFoto } = useMemo(() => rankingDeGanchos(lista, j, ordem, ganchoDe), [lista, j, ordem, ganchoDe]);
  const top = linhas.slice(0, limite);
  const maxT = Math.max(1, ...top.map((l) => l.tempoMedioS ?? 0));

  if (!lista.some((m) => m.media_type === "REELS" || m.media_type === "VIDEO")) {
    return (
      <div className="rounded-2xl border border-dashed p-6 text-center">
        <Flame className="h-6 w-6 text-muted-foreground mx-auto mb-2" />
        <p className="text-sm font-medium">Sem Reels no período</p>
        <p className="text-xs text-muted-foreground mt-1">O ranking de ganchos aparece quando houver Reels com números do Instagram.</p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border bg-card p-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-base font-display font-extrabold flex items-center gap-2"><Flame className="h-4 w-4 text-primary" /> Ranking de ganchos</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Quantos passaram dos 3 primeiros segundos e quanto tempo ficaram{j === "total" ? " (números de hoje)" : `, comparando cada Reels nas primeiras ${j === "24h" ? "24 horas" : "7 dias"}`}.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Abas<Janela> rotulo="Janela" valor={j} onChange={setJanela} opcoes={[["24h", "24 horas"], ["7d", "7 dias"], ["total", "Hoje"]]} />
          <Abas<"passou" | "tempo" | "views"> rotulo="Ordenar por" valor={ordem} onChange={setOrdem} opcoes={[["passou", "Segurou mais"], ["tempo", "Tempo assistido"], ["views", "Visualizações"]]} />
        </div>
      </div>

      {top.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">
          Nenhum Reels com a foto de {j === "24h" ? "24 horas" : "7 dias"} ainda. A foto é tirada na primeira coleta depois dessa idade; Reels publicados antes desta versão só aparecem em "Hoje".
        </p>
      ) : (
        <div className="mt-4 space-y-2">
          {top.map((l, i) => (
            <div key={l.midia.id} className={cn("grid grid-cols-[28px_1fr] sm:grid-cols-[28px_minmax(180px,1.6fr)_minmax(130px,1fr)_minmax(130px,1fr)_80px] gap-x-3 gap-y-2 items-center rounded-xl px-3 py-2.5", i === 0 ? "bg-primary/5" : "bg-muted/40")}>
              <span className={cn("w-7 h-7 rounded-full grid place-items-center text-xs font-extrabold", i === 0 ? "bg-primary text-primary-foreground" : "bg-background")}>{i + 1}</span>
              <div className="min-w-0">
                <p className="font-display font-bold text-[13.5px] leading-snug line-clamp-2">"{l.gancho}"</p>
                <p className="text-[11px] text-muted-foreground mt-0.5 flex items-center gap-1.5">
                  {l.midia.posted_at ? new Date(l.midia.posted_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }) : ""}
                  {l.midia.permalink && <a href={l.midia.permalink} target="_blank" rel="noreferrer" aria-label="Abrir no Instagram" className="hover:text-primary"><ExternalLink className="h-3 w-3" /></a>}
                </p>
              </div>
              <div className="col-start-2 sm:col-start-auto">
                <div className="flex justify-between text-[11px] text-muted-foreground"><span>passou do início</span><b className="text-foreground">{l.passou == null ? "—" : `${Math.round(l.passou)}%`}</b></div>
                <div className="mt-1 h-2 rounded-full bg-background overflow-hidden">
                  {l.passou != null && <div className={cn("h-full rounded-full", l.passou >= 65 ? "bg-green-600" : l.passou >= 55 ? "bg-amber-500" : "bg-red-500")} style={{ width: `${l.passou}%` }} />}
                </div>
              </div>
              <div className="col-start-2 sm:col-start-auto">
                <div className="flex justify-between text-[11px] text-muted-foreground"><span>tempo médio</span><b className="text-foreground">{segs(l.tempoMedioS)}</b></div>
                <div className="mt-1 h-2 rounded-full bg-background overflow-hidden">
                  {l.tempoMedioS != null && <div className="h-full rounded-full bg-sky-600" style={{ width: `${(l.tempoMedioS / maxT) * 100}%` }} />}
                </div>
              </div>
              <div className="col-start-2 sm:col-start-auto sm:text-right">
                <p className="font-display font-extrabold text-base leading-none">{fmtNum(l.views)}</p>
                <p className="text-[10.5px] text-muted-foreground">visualizações</p>
              </div>
            </div>
          ))}
        </div>
      )}
      {(semFoto > 0 && j !== "total") && (
        <p className="mt-3 text-[11px] text-muted-foreground">{semFoto} {semFoto === 1 ? "Reels ficou" : "Reels ficaram"} de fora por não ter a foto dessa idade.</p>
      )}
      <p className="mt-2 text-[11px] text-muted-foreground">"Passou do início" é 100% menos a taxa de quem pulou nos 3 primeiros segundos, segundo o Instagram. A Meta ainda trata esse número como estimado.</p>
    </div>
  );
}
