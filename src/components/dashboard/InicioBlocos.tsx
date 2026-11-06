import { useMemo, useState, type ReactNode } from "react";
import { Check, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { parseDateOnly } from "@/lib/date-br";
import { somarDias, travasDoPost, saiu, type PostTrava, type Trava } from "@/lib/oQueTrava";

/* ═══════════════════════════════════════════════════════════════════════════
   BLOCOS DO INÍCIO DO CRIADOR (06/11/2026, mockup aprovado)

   ALINHAMENTO É REGRA (Walter: "receio do dashboard não ficar bem alinhado").
   Todo bloco é um CardInicio: mesma borda, mesmo raio, mesma sombra, cabeçalho
   de altura fixa (h-14) e corpo com o mesmo padding (p-5). Assim os títulos de
   blocos lado a lado caem na mesma linha e as bordas batem. A altura de blocos
   da mesma linha vem do grid (h-full), nunca de número mágico.
   ═══════════════════════════════════════════════════════════════════════════ */

export const CARTAO_INICIO =
  "flex flex-col min-w-0 h-full overflow-hidden rounded-[20px] border-2 border-foreground bg-card shadow-[4px_4px_0_hsl(var(--foreground))]";

export function CardInicio({ titulo, direita, faixa, corpo, children, className, ...rest }: {
  titulo: ReactNode;
  direita?: ReactNode;
  /** Cabeçalho pintado (o "Hoje" é laranja). */
  faixa?: string;
  /** Classe extra do corpo (fundo do post-it, por exemplo). */
  corpo?: string;
  children: ReactNode;
  className?: string;
} & React.HTMLAttributes<HTMLElement>) {
  return (
    <section className={cn(CARTAO_INICIO, className)} {...rest}>
      <header className={cn("h-14 shrink-0 px-5 flex items-center gap-3 border-b-2 border-foreground", faixa ? "text-white" : "bg-card")}
        style={faixa ? { background: faixa } : undefined}>
        <h3 className="font-display font-extrabold text-[16px] leading-none truncate">{titulo}</h3>
        {direita && <div className={cn("ml-auto shrink-0 text-[12px] font-body", faixa ? "text-white/85" : "text-muted-foreground")}>{direita}</div>}
      </header>
      <div className={cn("flex-1 min-h-0 p-5", corpo)}>{children}</div>
    </section>
  );
}

/* ─── O QUE TRAVA ─── */
const TRAVA_INFO: Record<Trava, { um: string; varios: string; cor: string }> = {
  atrasado: { um: "atrasado", varios: "atrasados", cor: "#FFE0D6" },
  aprovacao: { um: "esperando aprovação", varios: "esperando aprovação", cor: "#FFF1A8" },
  semmidia: { um: "sem mídia", varios: "sem mídia", cor: "#E3ECFF" },
};

export function FaixaTrava({ contagem, onAbrir }: { contagem: Record<Trava, number>; onAbrir: (t: Trava) => void }) {
  const itens = (Object.keys(TRAVA_INFO) as Trava[]).filter((k) => contagem[k] > 0);
  if (!itens.length) {
    return <p className="text-[13px] font-body text-muted-foreground"><b className="text-foreground">Nada travado.</b> Todos os posts estão andando.</p>;
  }
  return (
    <div className="flex items-center gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden -mx-1 px-1 py-1">
      <span className="hidden sm:inline shrink-0 text-[12.5px] font-body italic text-muted-foreground">o que trava:</span>
      {itens.map((k) => (
        <button key={k} type="button" onClick={() => onAbrir(k)}
          className="shrink-0 inline-flex items-center gap-1.5 rounded-xl border-2 border-foreground px-3 h-9 text-[12.5px] font-body font-semibold text-foreground hover:-translate-y-0.5 transition-transform"
          style={{ background: TRAVA_INFO[k].cor }}>
          <b className="font-display text-[16px] leading-none">{contagem[k]}</b>
          {contagem[k] === 1 ? TRAVA_INFO[k].um : TRAVA_INFO[k].varios}
        </button>
      ))}
    </div>
  );
}

/* ─── SAI ESTA SEMANA ───
   7 colunas lado a lado só a partir de xl (1280): em 1024 cada dia ficava com
   60px e o título quebrava letra a letra. Abaixo disso, os dias arrastam. */
const DIA_CURTO = ["DOM", "SEG", "TER", "QUA", "QUI", "SEX", "SÁB"];
const FORMATO: Record<string, string> = { reels: "reels", carrossel: "carrossel", foto: "foto", story: "story", video: "vídeo", shorts: "shorts", estatico: "estático" };

export type PostSemana = PostTrava & { title: string; format: string; scheduled_time: string | null; pillar_id: string | null };

export function SemanaDoCriador({ posts, comMidia, thumbs, hoje, linha, pilares, onAbrirPost, onNovo }: {
  posts: PostSemana[];
  comMidia: Set<string>;
  thumbs: Map<string, string>;
  hoje: string;
  linha: Record<string, string> | null | undefined;
  pilares: { id: string; name: string; color: string | null }[];
  onAbrirPost: () => void;
  onNovo: (pilarNome: string | null) => void;
}) {
  const dias = useMemo(() => Array.from({ length: 7 }, (_, i) => {
    const iso = somarDias(hoje, i);
    const d = parseDateOnly(iso);
    const curto = DIA_CURTO[d.getDay()];
    const pilarId = linha?.[curto];
    const pilar = pilarId ? pilares.find((p) => p.id === pilarId) ?? null : null;
    const doDia = posts
      .filter((p) => p.scheduled_date?.slice(0, 10) === iso)
      .sort((a, b) => (a.scheduled_time ?? "99") < (b.scheduled_time ?? "99") ? -1 : 1);
    return { iso, curto, num: d.getDate(), hoje: i === 0, pilar, doDia };
  }), [posts, hoje, linha, pilares]);

  return (
    <div className="flex xl:grid xl:grid-cols-7 gap-2 overflow-x-auto xl:overflow-visible snap-x snap-mandatory [scrollbar-width:none] [&::-webkit-scrollbar]:hidden -mx-5 px-5 xl:mx-0 xl:px-0 h-full">
      {dias.map((d) => (
        <div key={d.iso}
          className={cn("snap-start shrink-0 w-[38%] sm:w-[24%] lg:w-[23%] xl:w-auto min-w-0 rounded-xl p-2 flex flex-col gap-1.5 min-h-[196px]",
            d.hoje ? "bg-[#FFF1A8] border-2 border-foreground" : "bg-muted/45 border-2 border-transparent")}>
          <div className="flex items-center text-[10.5px] font-body font-extrabold tracking-wide">
            <span>{d.curto} {d.num}</span>
            {d.hoje && <span className="ml-auto">HOJE</span>}
          </div>
          <span className="h-[18px]">
            {d.pilar && (
              <span className="inline-block max-w-full truncate rounded-full px-2 py-[1px] text-[9.5px] font-body font-bold text-white align-top"
                style={{ background: d.pilar.color || "#6F675C" }}>{d.pilar.name}</span>
            )}
          </span>
          {d.doDia.length === 0 ? (
            <button type="button" onClick={() => onNovo(d.pilar?.name ?? null)}
              className="rounded-lg border-2 border-dashed border-foreground/25 px-1.5 py-2 text-[10.5px] font-body font-semibold text-muted-foreground hover:text-foreground hover:border-foreground/50 text-center leading-tight">
              {d.pilar ? <>nada marcado<br />+ ideia do pilar</> : <>nada marcado<br />+ ideia</>}
            </button>
          ) : (
            <>
              {d.doDia.slice(0, 2).map((p) => {
                const tv = travasDoPost(p, comMidia.has(p.id), hoje);
                const th = thumbs.get(p.id) ?? p.cover_url ?? null;
                const meta = saiu(p) ? "saiu" : tv.includes("atrasado") ? "atrasado" : tv.includes("semmidia") ? "sem mídia"
                  : tv.includes("aprovacao") ? "aprovação" : [FORMATO[p.format] ?? p.format, p.scheduled_time?.slice(0, 5).replace(/:00$/, "h")].filter(Boolean).join(" · ");
                return (
                  <button key={p.id} type="button" onClick={onAbrirPost}
                    className={cn("text-left rounded-lg bg-card p-1.5 shadow-[0_1px_0_rgba(0,0,0,.12)] min-w-0",
                      tv.length ? "outline outline-2 outline-[#EB4918] -outline-offset-1" : "", saiu(p) && "opacity-60")}>
                    <span className="block h-11 rounded-md bg-muted overflow-hidden">
                      {th ? <img src={th} alt="" loading="lazy" className="h-full w-full object-cover" onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} />
                        : <span className="block h-full w-full bg-[repeating-linear-gradient(45deg,#F2ECDD_0_6px,#EADFC8_6px_12px)]" />}
                    </span>
                    <span className="mt-1 block text-[11px] font-body font-bold leading-tight line-clamp-2">{p.title || "Sem título"}</span>
                    <span className={cn("block text-[10px] font-body truncate", tv.length ? "text-[#C2410C] font-semibold" : "text-muted-foreground")}>{meta}</span>
                  </button>
                );
              })}
              {d.doDia.length > 2 && <button type="button" onClick={onAbrirPost} className="text-[10.5px] font-body font-semibold text-muted-foreground hover:text-foreground">+{d.doDia.length - 2} no dia</button>}
            </>
          )}
        </div>
      ))}
    </div>
  );
}

/* ─── HOJE (o mesmo bloco do dia das Tarefas) ─── */
export type TarefaHoje = { id: string; title: string; status: string; due_date: string | null; priority: string };

export function HojeDoCriador({ tarefas, hoje, onAlternar, onCriar, habitos, onHabito, onVerTodas }: {
  tarefas: TarefaHoje[];
  hoje: string;
  onAlternar: (id: string) => void;
  onCriar: (titulo: string) => Promise<void>;
  habitos: { id: string; name: string; feito: boolean }[];
  onHabito: (id: string) => void;
  onVerTodas: () => void;
}) {
  const [nova, setNova] = useState("");
  const [salvando, setSalvando] = useState(false);
  const ontem = somarDias(hoje, -1);
  const visiveis = tarefas.slice(0, 6);
  const criar = async () => {
    const t = nova.trim();
    if (!t || salvando) return;
    setSalvando(true);
    try { await onCriar(t); setNova(""); } finally { setSalvando(false); }
  };
  return (
    <div className="flex h-full flex-col">
      <ul className="-mt-1">
        {visiveis.map((t) => {
          const feita = t.status === "concluida";
          const atras = !feita && !!t.due_date && t.due_date < hoje;
          return (
            <li key={t.id} className="flex items-center gap-2.5 h-10 border-b border-dashed border-foreground/15">
              <button type="button" onClick={() => onAlternar(t.id)} aria-label={feita ? "Desmarcar" : "Marcar como feita"}
                className={cn("grid h-5 w-5 shrink-0 place-items-center rounded-md border-2 border-foreground", feita && "bg-[#00A652] text-white")}>
                {feita && <Check className="h-3.5 w-3.5" strokeWidth={3} />}
              </button>
              <span className={cn("min-w-0 flex-1 truncate text-[13.5px] font-body", feita && "line-through text-muted-foreground")}>{t.title}</span>
              {!feita && (t.priority === "alta" || t.priority === "urgente") && (
                <span className="shrink-0 rounded-full border-[1.5px] border-foreground bg-[#FFCF03] px-2 text-[10px] font-body font-bold">{t.priority}</span>
              )}
              {atras && <span className="shrink-0 rounded-full border-[1.5px] border-foreground bg-[#FFE0D6] px-2 text-[10px] font-body font-bold">{t.due_date === ontem ? "ontem" : "atrasada"}</span>}
            </li>
          );
        })}
        <li className="flex items-center gap-2.5 h-10 border-b border-dashed border-foreground/15">
          <span className="h-5 w-5 shrink-0 rounded-md border-2 border-dashed border-foreground/40" />
          <input value={nova} onChange={(e) => setNova(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") void criar(); }}
            disabled={salvando} placeholder="Escreva e aperte Enter" aria-label="Nova tarefa para hoje"
            className="min-w-0 flex-1 bg-transparent text-[13.5px] font-body outline-none placeholder:text-muted-foreground" />
        </li>
      </ul>
      {tarefas.length > visiveis.length && (
        <button type="button" onClick={onVerTodas} className="mt-2 self-start text-[12px] font-body font-semibold text-muted-foreground underline">
          Ver as {tarefas.length} tarefas de hoje
        </button>
      )}
      {habitos.length > 0 && (
        <div className="mt-auto pt-4 flex flex-wrap gap-1.5">
          {habitos.map((h) => (
            <button key={h.id} type="button" onClick={() => onHabito(h.id)}
              className={cn("inline-flex items-center gap-1 rounded-full border-[1.5px] border-foreground px-2.5 h-7 text-[11.5px] font-body font-semibold",
                h.feito ? "bg-[#D8F2E0]" : "bg-card")}>
              {h.feito && <Check className="h-3 w-3" strokeWidth={3} />}{h.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ─── ATALHO DO TOPO ─── */
/** No celular os três atalhos dividem a largura: ícone em cima e o nome curto embaixo. */
export function AtalhoInicio({ cor, titulo, curto, sub, onClick, icone }: { cor: string; titulo: string; curto: string; sub?: string; onClick: () => void; icone?: ReactNode }) {
  return (
    <button type="button" onClick={onClick} aria-label={titulo}
      className="min-w-0 flex flex-col items-center justify-center gap-0.5 sm:flex-row sm:justify-start sm:gap-2 rounded-xl border-2 border-foreground px-2 sm:px-3.5 h-14 sm:h-11 text-center sm:text-left shadow-[2px_3px_0_hsl(var(--foreground))] hover:-translate-y-0.5 transition-transform text-[#141210]"
      style={{ background: cor }}>
      {icone ?? <Plus className="h-4 w-4 shrink-0" />}
      <span className="min-w-0 max-w-full">
        <b className="block truncate text-[12.5px] sm:text-[13px] font-body font-extrabold leading-tight"><span className="sm:hidden">{curto}</span><span className="hidden sm:inline">{titulo}</span></b>
        {sub && <small className="hidden sm:block truncate text-[10.5px] font-body leading-tight opacity-80">{sub}</small>}
      </span>
    </button>
  );
}
