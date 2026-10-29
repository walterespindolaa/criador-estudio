import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, Film, Image as ImageIcon, Plus, Send, Smartphone } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { hojeBR, parseDateOnly } from "@/lib/date-br";
import { getThumbnailUrl, isVideoMedia, type MediaLike } from "@/lib/driveMedia";
import { resumoFigurinhas, type OpcoesIg } from "@/hooks/usePublicarInstagram";
import type { ExternalPost } from "@/hooks/useCriaPost";

/* ═══════════════════════════════════════════════════════════════════════════
   STORIES DO CLIENTE (Walter, 29/10/2026; mockup aprovado)

   A semana de stories de UM cliente, em 7 colunas, em ordem de horário. Por
   trás são os mesmos cards do Cria Post com formato Story: nada novo pra
   cadastrar, e eles continuam no Kanban, na agenda e no relatório. A aba só
   organiza, mostra o estado de cada um e manda a semana pro cliente de uma vez.
   ═══════════════════════════════════════════════════════════════════════════ */

const DIAS = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];
const pad = (n: number) => String(n).padStart(2, "0");
const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const somaDias = (iso: string, n: number) => { const d = parseDateOnly(iso); d.setDate(d.getDate() + n); return ymd(d); };
const segundaDe = (iso: string) => { const d = parseDateOnly(iso); const w = (d.getDay() + 6) % 7; d.setDate(d.getDate() - w); return ymd(d); };
const ehStory = (f: string | null | undefined) => /^stor(y|ies)$/i.test(String(f ?? ""));

type PostStory = ExternalPost & { scheduled_time?: string | null; ig_opcoes?: OpcoesIg | null };

type Estado = { txt: string; cls: string };
function estadoDo(p: PostStory): Estado {
  const celular = !!p.ig_opcoes?.pelo_celular || !!p.ig_opcoes?.musica_celular;
  if (p.publish_status === "publicado" || p.approval_status === "postado") return { txt: "Publicado", cls: "bg-green-600 text-white" };
  if (p.publish_status === "erro") return { txt: "Não saiu", cls: "bg-amber-100 text-amber-900" };
  if (p.publish_status === "publicando") return { txt: "Publicando", cls: "bg-violet-100 text-violet-800" };
  if (p.publish_status === "na_fila" && p.auto_publish) return { txt: "Agendado", cls: "bg-sky-100 text-sky-800" };
  if (p.approval_status === "ajuste_solicitado") return { txt: "Ajuste pedido", cls: "bg-red-100 text-red-700" };
  if (p.approval_status === "pendente") return { txt: "Com o cliente", cls: "bg-amber-100 text-amber-800" };
  if (p.approval_status === "aprovado") return celular
    ? { txt: "Aprovado · pelo celular", cls: "bg-violet-100 text-violet-800" }
    : { txt: "Aprovado", cls: "bg-green-100 text-green-800" };
  return { txt: "Rascunho", cls: "bg-muted text-muted-foreground" };
}

export function StoriesDoCliente({ posts, podeEditar, onNovo, onAbrir, onEnviarSemana }: {
  posts: ExternalPost[];
  podeEditar: boolean;
  onNovo: (dia: string) => void;
  onAbrir: (p: ExternalPost) => void;
  /** Rascunhos da semana viram "com o cliente"; quem chama abre o link de aprovação. */
  onEnviarSemana: (ids: string[], inicio: string, fim: string) => void;
}) {
  const hoje = hojeBR();
  const [inicio, setInicio] = useState(() => segundaDe(hoje));
  const fim = somaDias(inicio, 6);
  const dias = useMemo(() => Array.from({ length: 7 }, (_, i) => somaDias(inicio, i)), [inicio]);
  const [diaCel, setDiaCel] = useState(() => (hoje >= inicio && hoje <= fim ? hoje : inicio));

  const stories = useMemo(() => (posts as PostStory[])
    .filter((p) => ehStory(p.format) && p.scheduled_date && p.scheduled_date >= inicio && p.scheduled_date <= fim)
    .sort((a, b) => (a.scheduled_date! + (a.scheduled_time ?? "99")).localeCompare(b.scheduled_date! + (b.scheduled_time ?? "99"))), [posts, inicio, fim]);
  const semData = (posts as PostStory[]).filter((p) => ehStory(p.format) && !p.scheduled_date && p.approval_status !== "postado");

  // Miniatura: a primeira mídia de cada story da semana.
  const ids = stories.map((p) => p.id).join(",");
  const { data: capas = {} } = useQuery({
    queryKey: ["stories-capas", ids],
    enabled: stories.length > 0,
    staleTime: 60_000,
    queryFn: async () => {
      const { data } = await (supabase.from as unknown as (t: string) => ReturnType<typeof supabase.from>)("external_media_refs")
        .select("post_id, provider, external_file_id, view_url, thumbnail_url, download_url, file_type, file_name, bunny_video_id, position, substituida")
        .in("post_id", stories.map((p) => p.id));
      const mapa: Record<string, { url: string | null; video: boolean }> = {};
      const linhas = ((data ?? []) as Array<MediaLike & { post_id: string; position: number | null; substituida?: boolean }>)
        .filter((m) => !m.substituida)
        .sort((a, b) => (a.position ?? 999) - (b.position ?? 999));
      for (const m of linhas) if (!mapa[m.post_id]) mapa[m.post_id] = { url: getThumbnailUrl(m, 360), video: isVideoMedia(m) };
      return mapa;
    },
  });

  const rascunhos = stories.filter((p) => !p.approval_status || p.approval_status === "em_producao");
  const n = (f: (p: PostStory) => boolean) => stories.filter(f).length;
  const resumo = [
    `${stories.length} ${stories.length === 1 ? "story" : "stories"} na semana`,
    n((p) => p.approval_status === "aprovado") ? `${n((p) => p.approval_status === "aprovado")} aprovados` : null,
    n((p) => p.approval_status === "pendente") ? `${n((p) => p.approval_status === "pendente")} com o cliente` : null,
    rascunhos.length ? `${rascunhos.length} rascunhos` : null,
    n((p) => !!p.ig_opcoes?.pelo_celular || !!p.ig_opcoes?.musica_celular) ? `${n((p) => !!p.ig_opcoes?.pelo_celular || !!p.ig_opcoes?.musica_celular)} pelo celular` : null,
  ].filter(Boolean).join(" · ");

  const fmtDia = (iso: string) => { const d = parseDateOnly(iso); return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}`; };
  const titulo = `${fmtDia(inicio)} a ${fmtDia(fim)}`;

  const Card = ({ p }: { p: PostStory }) => {
    const st = estadoDo(p);
    const capa = capas[p.id];
    const fig = resumoFigurinhas(p.ig_opcoes?.figurinhas);
    return (
      <button type="button" onClick={() => onAbrir(p)} className="w-full text-left rounded-xl bg-card p-1.5 shadow-sm border border-border/60 hover:border-primary/40 transition-colors">
        <div className="relative aspect-[9/16] rounded-lg overflow-hidden bg-muted grid place-items-center">
          {capa?.url ? <img src={capa.url} alt="" loading="lazy" className="w-full h-full object-cover" />
            : <ImageIcon className="h-5 w-5 text-muted-foreground/60" />}
          {p.scheduled_time && <span className="absolute left-1 top-1 rounded bg-black/65 px-1 text-[10px] font-bold text-white">{p.scheduled_time.slice(0, 5)}</span>}
          {capa && <span className="absolute right-1 top-1 rounded bg-white/90 px-1 text-[10px] font-bold text-foreground flex items-center gap-0.5">{capa.video ? <><Film className="h-2.5 w-2.5" />Vídeo</> : "Foto"}</span>}
          {fig && <span className="absolute inset-x-1 bottom-1 rounded bg-white/90 px-1 py-0.5 text-[9.5px] font-bold text-violet-800 truncate flex items-center gap-1"><Smartphone className="h-2.5 w-2.5 shrink-0" />{fig}</span>}
        </div>
        <p className="mt-1 px-0.5 text-[11.5px] font-body font-semibold leading-tight line-clamp-2 text-foreground">{p.title || "Story"}</p>
        <span className={cn("mt-1 inline-block rounded-full px-1.5 py-0.5 text-[10px] font-body font-bold", st.cls)}>{st.txt}</span>
      </button>
    );
  };

  const Coluna = ({ dia, i }: { dia: string; i: number }) => {
    const doDia = stories.filter((p) => p.scheduled_date === dia);
    const d = parseDateOnly(dia);
    return (
      <div className={cn("rounded-2xl bg-muted/40 p-2 min-h-[260px] flex flex-col gap-2", dia === hoje && "ring-2 ring-primary/40")}>
        <div className="flex items-center justify-between px-0.5">
          <span className="text-[11px] font-body font-bold uppercase tracking-wide text-muted-foreground">{DIAS[i]} {d.getDate()}</span>
          {podeEditar && (
            <button type="button" onClick={() => onNovo(dia)} aria-label={`Novo story em ${fmtDia(dia)}`}
              className="h-7 w-7 grid place-items-center rounded-lg text-primary hover:bg-primary/10"><Plus className="h-4 w-4" /></button>
          )}
        </div>
        {doDia.map((p) => <Card key={p.id} p={p} />)}
        {doDia.length === 0 && (
          <button type="button" disabled={!podeEditar} onClick={() => onNovo(dia)}
            className="rounded-xl border-2 border-dashed border-border px-2 py-5 text-center text-[11px] font-body text-muted-foreground hover:border-primary/40 disabled:hover:border-border">
            Nada ainda.{podeEditar && <><br />Toque pra criar.</>}
          </button>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        <p className="font-display font-bold text-lg mr-auto">{titulo}</p>
        <Button type="button" variant="outline" size="sm" className="rounded-full" onClick={() => { const x = somaDias(inicio, -7); setInicio(x); setDiaCel(x); }}>
          <ChevronLeft className="h-4 w-4" /><span className="hidden sm:inline ml-1">Semana anterior</span>
        </Button>
        <Button type="button" variant="outline" size="sm" className="rounded-full" onClick={() => { const x = segundaDe(hoje); setInicio(x); setDiaCel(hoje); }}>Hoje</Button>
        <Button type="button" variant="outline" size="sm" className="rounded-full" onClick={() => { const x = somaDias(inicio, 7); setInicio(x); setDiaCel(x); }}>
          <span className="hidden sm:inline mr-1">Próxima</span><ChevronRight className="h-4 w-4" />
        </Button>
        {podeEditar && (
          <Button type="button" size="sm" className="rounded-full" disabled={rascunhos.length === 0}
            title={rascunhos.length ? "Os rascunhos da semana vão pro cliente aprovar pelo link" : "Nenhum rascunho nesta semana"}
            onClick={() => onEnviarSemana(rascunhos.map((p) => p.id), inicio, fim)}>
            <Send className="h-3.5 w-3.5 mr-1.5" /> Enviar a semana pra aprovar{rascunhos.length ? ` (${rascunhos.length})` : ""}
          </Button>
        )}
      </div>
      <p className="text-[13px] font-body text-muted-foreground">{resumo}</p>

      {/* Computador: as 7 colunas. Celular: escolhe o dia e vê a lista. */}
      <div className="hidden md:grid grid-cols-7 gap-2">
        {dias.map((dia, i) => <Coluna key={dia} dia={dia} i={i} />)}
      </div>
      <div className="md:hidden space-y-2">
        <div className="flex gap-1.5 overflow-x-auto pb-1">
          {dias.map((dia, i) => {
            const qtd = stories.filter((p) => p.scheduled_date === dia).length;
            return (
              <button key={dia} type="button" onClick={() => setDiaCel(dia)}
                className={cn("shrink-0 rounded-xl px-3 py-2 text-center min-w-[52px]", diaCel === dia ? "bg-foreground text-background" : "bg-muted text-foreground")}>
                <span className="block text-[10px] font-bold uppercase">{DIAS[i]}</span>
                <span className="block text-[15px] font-display font-bold leading-tight">{parseDateOnly(dia).getDate()}</span>
                <span className={cn("block text-[10px]", diaCel === dia ? "opacity-80" : "text-muted-foreground")}>{qtd || "·"}</span>
              </button>
            );
          })}
        </div>
        <div className="grid grid-cols-2 gap-2">
          {stories.filter((p) => p.scheduled_date === diaCel).map((p) => <Card key={p.id} p={p} />)}
          {podeEditar && (
            <button type="button" onClick={() => onNovo(diaCel)}
              className="aspect-[9/16] rounded-xl border-2 border-dashed border-border grid place-items-center text-[12px] font-body text-muted-foreground">
              <span><Plus className="h-5 w-5 mx-auto mb-1" />Novo story</span>
            </button>
          )}
        </div>
      </div>

      {semData.length > 0 && (
        <div className="rounded-2xl border border-dashed border-border p-3">
          <p className="text-[12px] font-body font-bold text-muted-foreground mb-2">Stories sem data ({semData.length}): abra e escolha o dia pra entrarem na semana.</p>
          <div className="flex gap-2 overflow-x-auto">
            {semData.map((p) => (
              <button key={p.id} type="button" onClick={() => onAbrir(p)} className="shrink-0 rounded-xl bg-card border border-border px-3 py-2 text-[12px] font-body font-semibold max-w-[200px] truncate">{p.title || "Story"}</button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
