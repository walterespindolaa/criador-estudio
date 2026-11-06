import { useRef, type CSSProperties } from "react";
import { Pencil, ArrowLeftRight, Video, Trash2, ExternalLink } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { getThumbnailUrl, type MediaLike } from "@/lib/driveMedia";
import { FORMAT_LABELS } from "@/lib/constants";
import { formatColorVars, FORMAT_TEXT_CLASS, corDoFormato } from "@/lib/format-colors";
import { dataHoraCurta } from "@/lib/data-curta";
import { SeloPublicacaoIg } from "@/components/shared/PublicarNoInstagram";
import type { Trava } from "@/lib/oQueTrava";

/* ═══════════════════════════════════════════════════════════════════════════
   O QUADRO DO CRIANDO (Walter e Gabriela, 06/11/2026, protótipo aprovado)

   A Gabi pediu "clean, fácil de ler, título em destaque, igual ao de social
   mídia, que lembra o Trello". Então o cartão tem só: FORMATO · REDE pequeno,
   o título forte, quem está fazendo, a data num campo e UM aviso quando há
   problema. A mídia é opcional (botão na barra, padrão oculta). O alfinete é
   o único enfeite.
   ═══════════════════════════════════════════════════════════════════════════ */

export const AVISO_TRAVA: Record<Trava, { txt: string; cor: string }> = {
  atrasado: { txt: "atrasado", cor: "text-[#D93A12] dark:text-[#FF8A63]" },
  aprovacao: { txt: "esperando aprovação", cor: "text-[#A06A00] dark:text-[#FFC24D]" },
  semmidia: { txt: "sem mídia", cor: "text-[#0061EE] dark:text-[#79ACFF]" },
};

const sbFrom = supabase.from.bind(supabase) as unknown as (t: string) => ReturnType<typeof supabase.from>;

const CORES_ALFINETE = ["#EB4918", "#0061EE", "#00A652", "#FF77B9", "#FFCF03"];
function corDoAlfinete(id: string) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return CORES_ALFINETE[h % CORES_ALFINETE.length];
}

const REDE: Record<string, string> = { instagram: "Instagram", tiktok: "TikTok", youtube: "YouTube", linkedin: "LinkedIn", facebook: "Facebook", pinterest: "Pinterest" };

/** Prévia de cada post: capa, senão a primeira mídia (a mesma conta dos Agendamentos). */
export function usePreviasDosPosts(ids: string[], ligado: boolean) {
  const chave = ids.join(",");
  return useQuery<Map<string, string>>({
    queryKey: ["criando-previas", chave, ligado],
    enabled: ids.length > 0,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const m = new Map<string, string>();
      // Em blocos: o .in() com centenas de ids estoura o tamanho da URL.
      for (let i = 0; i < ids.length; i += 150) {
        const { data } = await sbFrom("external_media_refs")
          .select("post_id,provider,external_file_id,file_type,thumbnail_url,view_url,download_url,position,created_at")
          .in("post_id", ids.slice(i, i + 150))
          .eq("substituida", false)
          .order("position", { ascending: true, nullsFirst: true })
          .order("created_at", { ascending: true });
        for (const r of ((data as unknown as (MediaLike & { post_id: string })[]) ?? [])) {
          if (m.has(r.post_id)) continue;
          // Sem a mídia ligada, só importa SABER que tem (pro aviso "sem mídia").
          m.set(r.post_id, ligado ? getThumbnailUrl(r, 360) ?? "" : "1");
        }
      }
      return m;
    },
  });
}

export type CartaoQuadroProps = {
  titulo: string;
  formato: string | null;
  plataforma: string | null;
  data: string | null;
  hora?: string | null;
  quem?: { nome: string; etapa: string | null } | null;
  tarefas?: { feitas: number; total: number } | null;
  pilar?: { nome: string; cor: string } | null;
  publishStatus?: string | null;
  autoPublish?: boolean | null;
  publicado?: boolean;
  travas: Trava[];
  previa?: string | null;
  mostrarMidia: boolean;
  apagado?: boolean;
  idDoPost: string;
  onEditar: () => void;
  onMover: () => void;
  /** Celular: segurar o cartão abre os atalhos embaixo dele. */
  onSegurar?: () => void;
};

export function CartaoQuadro(p: CartaoQuadroProps) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const segurou = useRef(false);
  const fmt = FORMAT_LABELS[p.formato ?? ""] || p.formato || "Post";
  const rede = REDE[(p.plataforma ?? "").toLowerCase()] ?? (p.plataforma ? p.plataforma : "");
  const aviso = p.travas[0] ? AVISO_TRAVA[p.travas[0]] : null;
  const entregue = p.quem?.etapa === "entregue";

  const comecar = () => {
    if (!p.onSegurar) return;
    segurou.current = false;
    timer.current = setTimeout(() => { segurou.current = true; p.onSegurar?.(); }, 500);
  };
  const parar = () => { if (timer.current) clearTimeout(timer.current); timer.current = null; };

  return (
    <div
      className={cn("relative transition-opacity", p.apagado ? "opacity-30" : p.publicado && "opacity-80")}
      onPointerDown={comecar} onPointerUp={parar} onPointerLeave={parar} onPointerCancel={parar}
      onClickCapture={(e) => { if (segurou.current) { e.stopPropagation(); e.preventDefault(); segurou.current = false; } }}
    >
      <span aria-hidden className="absolute -top-[15px] left-1/2 -ml-[5.5px] h-[11px] w-[11px] rounded-full shadow-[0_1.5px_0_rgba(0,0,0,.22)] pointer-events-none"
        style={{ background: `radial-gradient(circle at 35% 30%, rgba(255,255,255,.55) 0 18%, ${corDoAlfinete(p.idDoPost)} 22%)` }} />
      {p.mostrarMidia && p.previa && (
        <div className="mb-2 h-[84px] rounded-lg bg-muted overflow-hidden">
          <img src={p.previa} alt="" loading="lazy" className="h-full w-full object-cover" onError={(e) => { (e.currentTarget.parentElement as HTMLElement).style.display = "none"; }} />
        </div>
      )}
      <p className="text-[9.5px] font-body font-semibold uppercase tracking-[0.05em] text-muted-foreground pr-14 truncate">
        <b style={formatColorVars(p.formato)} className={cn("font-extrabold", FORMAT_TEXT_CLASS)}>{fmt}</b>
        {rede ? ` · ${rede}` : ""}
      </p>
      <p title={p.titulo} className="mt-1 mb-1.5 font-body font-extrabold text-[14.5px] leading-[1.3] text-foreground line-clamp-2 break-words">{p.titulo}</p>
      {(p.quem || p.pilar || (p.tarefas && p.tarefas.total > 0)) && (
        <p className="mb-1.5 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[11px] font-body font-semibold text-muted-foreground">
          {p.quem && (
            <span className="inline-flex items-center gap-1">
              {p.quem.nome}
              <span className={cn("rounded-full px-1.5 text-[9.5px] font-bold", entregue ? "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300" : "bg-violet-100 text-violet-800 dark:bg-violet-900/40 dark:text-violet-300")}>
                {entregue ? "entregue" : p.quem.etapa === "ajuste" ? "em ajuste" : "fazendo"}
              </span>
            </span>
          )}
          {p.pilar && <span className="inline-flex items-center gap-1"><i className="h-1.5 w-1.5 rounded-full" style={{ background: p.pilar.cor }} />{p.pilar.nome}</span>}
          {p.tarefas && p.tarefas.total > 0 && <span>tarefas {p.tarefas.feitas}/{p.tarefas.total}</span>}
        </p>
      )}
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="rounded-lg border border-border px-2 py-0.5 text-[11px] font-body tabular-nums text-foreground">
          {p.data ? dataHoraCurta(p.data, p.hora) : "sem data"}
        </span>
        <SeloPublicacaoIg status={p.publishStatus} autoPublish={p.autoPublish} className="text-[9.5px]" />
        {aviso && <span className={cn("text-[10.5px] font-body font-bold", aviso.cor)}>● {aviso.txt}</span>}
      </div>
      <div className="absolute -top-1 -right-1 flex items-center gap-0.5">
        <button type="button" aria-label="Editar post" onPointerDown={(e) => e.stopPropagation()} onClick={(e) => { e.stopPropagation(); p.onEditar(); }}
          className="grid h-6 w-6 place-items-center rounded-md bg-card/85 text-muted-foreground hover:bg-muted hover:text-foreground">
          <Pencil className="h-3.5 w-3.5" />
        </button>
        <button type="button" aria-label="Mover post" onPointerDown={(e) => e.stopPropagation()} onClick={(e) => { e.stopPropagation(); p.onMover(); }}
          className="grid h-6 w-6 place-items-center rounded-md bg-card/85 text-muted-foreground hover:bg-muted hover:text-foreground">
          <ArrowLeftRight className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

/* Painel que abre LOGO ABAIXO do cartão (Walter, 06/11/2026: "fica grudado na
   barra inferior, precisa aparecer logo abaixo do post pra não confundir"). */
export function PainelDoCartao({ tipo, colunas, atual, onMover, onAbrir, onPrompter, onExcluir, onFechar }: {
  tipo: "mover" | "acoes";
  colunas: { key: string; label: string; cor: string; ink: string }[];
  atual: string;
  onMover: (para: string) => void;
  onAbrir: () => void;
  onPrompter?: (() => void) | null;
  onExcluir: () => void;
  onFechar: () => void;
}) {
  const btn = "rounded-full border border-border bg-card px-2.5 py-1 text-[11.5px] font-body font-bold text-foreground hover:border-foreground/40";
  return (
    <div role="group" aria-label={tipo === "mover" ? "Mover post" : "Ações do post"}
      className="relative -mt-1 rounded-xl border-2 border-foreground bg-card p-2.5 shadow-[3px_3px_0_hsl(var(--foreground))]"
      onClick={(e) => e.stopPropagation()}>
      <span aria-hidden className="absolute -top-[8px] left-6 h-3 w-3 rotate-45 border-l-2 border-t-2 border-foreground bg-card" />
      {tipo === "mover" ? (
        <>
          <p className="mb-1.5 font-display text-[12.5px] font-extrabold">Mover pra</p>
          <div className="flex flex-wrap gap-1.5">
            {colunas.map((c) => (
              <button key={c.key} type="button" disabled={c.key === atual} onClick={() => onMover(c.key)}
                className="rounded-full px-2.5 py-1 text-[11.5px] font-body font-bold disabled:opacity-35"
                style={{ background: c.cor, color: c.ink }}>{c.label}</button>
            ))}
          </div>
        </>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          <button type="button" className={btn} onClick={onAbrir}><ExternalLink className="mr-1 inline h-3 w-3" />Abrir</button>
          <button type="button" className={btn} onClick={() => onMover("__escolher")}><ArrowLeftRight className="mr-1 inline h-3 w-3" />Mover pra...</button>
          {onPrompter && <button type="button" className={btn} onClick={onPrompter}><Video className="mr-1 inline h-3 w-3" />Gravar no Prompter</button>}
          <button type="button" className={cn(btn, "text-destructive")} onClick={onExcluir}><Trash2 className="mr-1 inline h-3 w-3" />Excluir</button>
        </div>
      )}
      <button type="button" onClick={onFechar} className="mt-1.5 text-[11.5px] font-body font-semibold text-muted-foreground underline">
        {tipo === "mover" ? "Cancelar" : "Fechar"}
      </button>
    </div>
  );
}

/* A FAIXA DO QUE TRAVA, a mesma conta do Início (src/lib/oQueTrava). */
export type FiltroQuadro = Trava | "semana";
const ROTULO_FAIXA: Record<FiltroQuadro, [string, string, string]> = {
  atrasado: ["atrasado", "atrasados", "bg-[#FFE0D6] text-[#5a1a06] dark:bg-[#5a1a06]/50 dark:text-[#FFD2C2]"],
  aprovacao: ["esperando aprovação", "esperando aprovação", "bg-[#FFF1A8] text-[#4a3a00] dark:bg-[#4a3a00]/60 dark:text-[#FFE98A]"],
  semmidia: ["sem mídia", "sem mídia", "bg-[#E3ECFF] text-[#0a2a6b] dark:bg-[#0a2a6b]/60 dark:text-[#CFE0FF]"],
  semana: ["sai esta semana", "saem esta semana", "bg-[#D8F2E0] text-[#0b4a25] dark:bg-[#0b4a25]/60 dark:text-[#C8F0D6]"],
};
const CURTO_FAIXA: Record<FiltroQuadro, string> = { atrasado: "atrasados", aprovacao: "aprovação", semmidia: "sem mídia", semana: "na semana" };
export function FaixaQuadro({ contagem, filtro, onFiltro }: { contagem: Record<FiltroQuadro, number>; filtro: FiltroQuadro | null; onFiltro: (f: FiltroQuadro | null) => void }) {
  const itens = (Object.keys(ROTULO_FAIXA) as FiltroQuadro[]).filter((k) => contagem[k] > 0 || filtro === k);
  if (itens.length === 0) return null;
  return (
    <div className="mb-3 grid [grid-template-columns:repeat(var(--n),minmax(0,1fr))] md:flex md:items-center md:flex-wrap gap-1.5 md:gap-2"
      style={{ ["--n" as string]: itens.length } as CSSProperties}>
      {itens.map((k) => {
        const [um, varios, cls] = ROTULO_FAIXA[k];
        const n = contagem[k];
        return (
          <button key={k} type="button" aria-pressed={filtro === k} onClick={() => onFiltro(filtro === k ? null : k)}
            className={cn("min-w-0 flex flex-col md:flex-row md:inline-flex items-center justify-center gap-0 md:gap-1.5 rounded-xl md:rounded-full border px-1.5 md:px-3 py-1.5 md:py-1 text-[11px] md:text-[12px] font-body font-semibold transition-colors leading-tight text-center", cls,
              filtro === k ? "border-foreground" : "border-transparent")}>
            <b className="font-extrabold text-[15px] md:text-[12px]">{n}</b>
            <span className="md:hidden">{CURTO_FAIXA[k]}</span>
            <span className="hidden md:inline">{n === 1 ? um : varios}</span>
          </button>
        );
      })}
      {filtro ? (
        <button type="button" onClick={() => onFiltro(null)} className="col-span-full md:col-auto justify-self-start shrink-0 text-[12px] font-body font-semibold text-muted-foreground underline">limpar</button>
      ) : (
        <span className="hidden md:inline text-[12px] font-body text-muted-foreground">toque pra filtrar</span>
      )}
    </div>
  );
}

/* VISÃO GERAL NO CELULAR: as 6 colunas na tela, 4 cartões em cada (os
   travados primeiro, com contorno laranja) e o resto num contador. */
export function VisaoGeralQuadro({ colunas, onAbrirColuna }: {
  colunas: { key: string; label: string; cor: string; ink: string; itens: { id: string; titulo: string; travado: boolean; corFormato: string }[] }[];
  onAbrirColuna: (i: number) => void;
}) {
  return (
    <div className="md:hidden">
      <p className="mb-2 text-[12px] font-body text-muted-foreground">O que trava aparece primeiro. Toque numa coluna pra abrir nela.</p>
      <div className="grid grid-cols-3 gap-2">
        {colunas.map((c, i) => {
          const ordem = [...c.itens].sort((a, b) => Number(b.travado) - Number(a.travado));
          return (
            <button key={c.key} type="button" onClick={() => onAbrirColuna(i)}
              className="min-w-0 rounded-xl bg-muted/60 p-1.5 text-left flex flex-col gap-1">
              <span className="flex items-center rounded-md px-1.5 py-0.5 text-[10.5px] font-body font-bold" style={{ background: c.cor, color: c.ink }}>
                <span className="truncate">{c.label}</span><b className="ml-auto pl-1 text-[9.5px]">{c.itens.length}</b>
              </span>
              {ordem.slice(0, 4).map((it) => (
                <span key={it.id} className={cn("flex items-center gap-1 rounded-md bg-card p-1", it.travado && "ring-2 ring-[#EB4918]")}>
                  <i className="h-4 w-1 shrink-0 rounded-full" style={{ background: it.corFormato }} />
                  <span className="text-[9px] font-body font-semibold leading-tight line-clamp-2 break-words">{it.titulo}</span>
                </span>
              ))}
              {c.itens.length > 4 && <span className="px-1 text-[9px] font-body font-semibold text-muted-foreground">+{c.itens.length - 4} · toque pra ver</span>}
              {c.itens.length === 0 && <span className="px-1 py-3 text-center text-[9.5px] font-body text-muted-foreground">vazia</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export { corDoFormato };
