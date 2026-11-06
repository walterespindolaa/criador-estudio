import { useEffect, useMemo, useState } from "react";
import { dataHoraCurta } from "@/lib/data-curta";
import { hojeBR, parseDateOnly } from "@/lib/date-br";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { useActiveAccount } from "@/contexts/AccountContext";
import { useActiveProfile } from "@/hooks/useActiveProfile";
import { useApprovals, usePostApprovalComments, type ApprovalPost } from "@/hooks/useApprovals";
import { FORMAT_LABELS } from "@/lib/constants";
import { PlatformIcon } from "@/components/shared/PlatformIcon";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { CheckCircle2, MessageCircle, RotateCcw, Calendar, Send, ShieldCheck, Search, Play, X } from "lucide-react";

/* ═══════════════════════════════════════════════════════════════════════════
   APROVAÇÕES EM LISTA (Walter, 06/11/2026, mockup aprovado)

   Era uma grade de cartões grandes em 4:5, quase todos com o ícone de imagem
   vazio (os posts da fila não tinham mídia nenhuma) e a data crua do banco.
   Agora é uma lista: miniatura pequena, título em destaque e só o que decide
   (situação, há quanto tempo espera, quando sai). O que está parado sobe.
   ═══════════════════════════════════════════════════════════════════════════ */

type FilterKey = "pendente" | "ajuste_solicitado" | "aprovado" | "todos";

const FILTERS: { key: FilterKey; label: string; curto: string }[] = [
  { key: "pendente", label: "Esperando", curto: "esperando" },
  { key: "ajuste_solicitado", label: "Em ajuste", curto: "em ajuste" },
  { key: "aprovado", label: "Aprovados", curto: "aprovados" },
  { key: "todos", label: "Todos", curto: "todos" },
];

/** Parado: a data de sair já passou ou espera há mais de 7 dias. */
const DIAS_PARADO = 7;

function statusOf(p: ApprovalPost): Exclude<FilterKey, "todos"> {
  if (p.approval_status === "aprovado") return "aprovado";
  if (p.approval_status === "ajuste_solicitado") return "ajuste_solicitado";
  return "pendente";
}

function StatusBadge({ p }: { p: ApprovalPost }) {
  const s = statusOf(p);
  if (s === "aprovado") return <Badge className="bg-green-100 text-green-800 border-green-200 hover:bg-green-100">Aprovado</Badge>;
  if (s === "ajuste_solicitado") return <Badge className="bg-orange-100 text-orange-800 border-orange-200 hover:bg-orange-100">Ajuste pedido</Badge>;
  return <Badge className="bg-yellow-100 text-yellow-900 border-yellow-300 hover:bg-yellow-100">Aguardando</Badge>;
}

const COR_FORMATO: Record<string, string> = {
  reels: "text-[#0061EE]", video: "text-[#0061EE]", carrossel: "text-[#EB4918]",
  estatico: "text-[#00A652]", foto: "text-[#00A652]", story: "text-[#E0458F]",
};
const DIA_SEMANA = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];

/** Dias desde que o post entrou na fila (ou foi mexido por último na aprovação). */
function diasEsperando(p: ApprovalPost, hoje: Date): number {
  const desde = p.approval_updated_at ?? p.updated_at ?? p.created_at;
  if (!desde) return 0;
  return Math.max(0, Math.floor((hoje.getTime() - new Date(desde).getTime()) / 86_400_000));
}

function diaCurto(iso: string): string {
  const d = parseDateOnly(iso);
  return `${DIA_SEMANA[d.getDay()]} ${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export default function Aprovacao() {
  const { activeAccountId } = useActiveAccount();
  const { profile } = useActiveProfile();
  const { queue, isLoading, isOwner, approve, requestAdjustment } = useApprovals();
  const [filter, setFilter] = useState<FilterKey>("pendente");
  const [busca, setBusca] = useState("");
  const [selected, setSelected] = useState<ApprovalPost | null>(null);

  const postIds = useMemo(() => queue.map((p) => p.id), [queue]);
  const { data: thumbs = {} } = useQuery<Record<string, string | null>>({
    queryKey: ["approval-thumbs", activeAccountId, postIds.slice().sort().join(",")],
    enabled: !!activeAccountId && postIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("external_media_refs")
        .select("post_id, thumbnail_url, created_at, position")
        .eq("user_id", activeAccountId!)
        .in("post_id", postIds)
        .eq("substituida", false) // capa nunca é a arte de uma versão substituída
        // Capa = PRIMEIRA da tira (position), não a mais antiga (27/09/2026: a
        // Gabriela reordenou o carrossel e o feed seguia mostrando o 2º slide).
        .order("position", { ascending: true, nullsFirst: true })
        .order("created_at");
      if (error) throw error;
      const map: Record<string, string | null> = {};
      for (const row of data ?? []) {
        if (!row.post_id || map[row.post_id]) continue;
        map[row.post_id] = row.thumbnail_url ?? null;
      }
      return map;
    },
  });
  // Prévia: primeira mídia do post; sem mídia, a capa do Reels (cover_url).
  const previa = (p: ApprovalPost): string | null => thumbs[p.id] ?? p.cover_url ?? null;

  const counts = useMemo(() => {
    const c = { pendente: 0, ajuste_solicitado: 0, aprovado: 0 };
    for (const p of queue) c[statusOf(p)]++;
    return c;
  }, [queue]);

  const hoje = useMemo(() => parseDateOnly(hojeBR()), []);
  const hojeIso = hojeBR();

  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return queue.filter((p) => (filter === "todos" || statusOf(p) === filter) && (!q || p.title.toLowerCase().includes(q)));
  }, [queue, filter, busca]);

  const ehParado = (p: ApprovalPost) =>
    statusOf(p) !== "aprovado" && ((!!p.scheduled_date && p.scheduled_date < hojeIso) || diasEsperando(p, hoje) > DIAS_PARADO);

  const grupos = useMemo(() => {
    const parados = filtrados.filter(ehParado).sort((a, b) => diasEsperando(b, hoje) - diasEsperando(a, hoje));
    const porData = (a: ApprovalPost, b: ApprovalPost) => (a.scheduled_date ?? "9999").localeCompare(b.scheduled_date ?? "9999");
    const proximos = filtrados.filter((p) => !ehParado(p) && statusOf(p) !== "aprovado").sort(porData);
    const aprovados = filtrados.filter((p) => statusOf(p) === "aprovado").sort(porData);
    return [
      { titulo: "Parados há mais tempo", itens: parados },
      { titulo: "Próximos a sair", itens: proximos },
      { titulo: "Aprovados", itens: aprovados },
    ].filter((g) => g.itens.length > 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtrados, hoje, hojeIso]);

  const aviso = useMemo(() => {
    const abertos = queue.filter((p) => statusOf(p) !== "aprovado");
    const parados = abertos.filter(ehParado).length;
    const semMidia = abertos.filter((p) => !previa(p)).length;
    return { parados, semMidia };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queue, thumbs, hojeIso]);

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 pb-24 md:pb-6">
      <header className="mb-4 md:hidden">
        <h1 className="text-2xl sm:text-3xl font-display font-extrabold text-foreground tracking-tight">Aprovações</h1>
        <p className="text-sm text-muted-foreground font-body mt-1">
          {isOwner
            ? "Revise os posts prontos e aprove ou peça ajustes."
            : `Acompanhe o que ${profile?.name ?? "o cliente"} já aprovou ou pediu ajuste. Apenas o cliente aprova.`}
        </p>
      </header>

      <div className="flex flex-col md:flex-row md:items-center gap-3 mb-4">
        {/* Celular: contadores lado a lado, sem rolar. Computador: abas. */}
        <div data-tour="aprovacao-filtros" className="grid grid-cols-4 gap-2 md:flex md:items-center md:gap-1 md:rounded-full md:border-2 md:border-foreground md:bg-card md:p-1 md:w-fit">
          {FILTERS.map((f) => {
            const n = f.key === "todos" ? queue.length : counts[f.key];
            const on = filter === f.key;
            return (
              <button key={f.key} type="button" onClick={() => setFilter(f.key)} aria-pressed={on}
                className={cn(
                  "min-w-0 rounded-xl border-2 border-foreground px-1 py-1.5 text-center font-body transition-colors md:rounded-full md:border-0 md:px-3.5 md:py-1.5 md:inline-flex md:items-center md:gap-1.5",
                  on ? "bg-[#FFCF03] text-foreground shadow-[2px_2px_0_hsl(var(--foreground))] md:bg-foreground md:text-background md:shadow-none" : "bg-card text-foreground md:bg-transparent md:text-muted-foreground md:hover:text-foreground",
                )}>
                <b className="block font-display text-[17px] leading-none md:hidden">{n}</b>
                <span className="block text-[10.5px] font-semibold leading-tight mt-0.5 md:hidden">{f.curto}</span>
                <span className="hidden md:inline text-[12.5px] font-bold">{f.label}</span>
                <span className="hidden md:inline text-[11px] font-bold opacity-70">{n}</span>
              </button>
            );
          })}
        </div>
        <div className="relative md:ml-auto md:w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar post"
            className="h-10 w-full rounded-full border-2 border-foreground bg-card pl-9 pr-9 text-sm font-body outline-none focus:border-primary" />
          {busca && (
            <button type="button" onClick={() => setBusca("")} aria-label="Limpar busca" className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-muted-foreground"><X className="h-3.5 w-3.5" /></button>
          )}
        </div>
      </div>

      {aviso.parados > 0 && (
        <div className="mb-5 rounded-2xl border-2 border-foreground bg-[#FFCF03] px-4 py-3 shadow-[3px_3px_0_hsl(var(--foreground))] text-[13px] font-body text-[#1D1B18]">
          <b>{aviso.parados} {aviso.parados === 1 ? "post está parado" : "posts estão parados"}</b>: a data já passou ou espera há mais de {DIAS_PARADO} dias.
          {aviso.semMidia > 0 && <> {aviso.semMidia} {aviso.semMidia === 1 ? "ainda está sem mídia" : "ainda estão sem mídia"}.</>}
        </div>
      )}

      {isLoading ? (
        <div className="grid md:grid-cols-2 gap-3">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-2xl" />)}
        </div>
      ) : grupos.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground font-body">
          <CheckCircle2 className="h-10 w-10 mx-auto mb-3 opacity-40" />
          <p>{busca ? "Nada com essa busca." : `Nenhum post ${filter === "todos" ? "em revisão" : "neste filtro"} por aqui.`}</p>
          {!busca && <p className="text-xs mt-1">Os posts que estão em edição no Criando aparecem aqui pra revisão.</p>}
        </div>
      ) : (
        <div data-tour="aprovacao-lista" className="space-y-5">
          {grupos.map((g) => (
            <section key={g.titulo}>
              <div className="flex items-center gap-3 mb-2.5">
                <h2 className="font-display font-extrabold text-[15px] text-foreground whitespace-nowrap">{g.titulo} <span className="text-muted-foreground font-body font-semibold text-[12px]">· {g.itens.length}</span></h2>
                <span className="h-px flex-1 bg-border" />
              </div>
              <div className="grid md:grid-cols-2 gap-3">
                {g.itens.map((p) => (
                  <LinhaAprovacao key={p.id} p={p} thumb={previa(p)} parado={ehParado(p)} dias={diasEsperando(p, hoje)} hojeIso={hojeIso} onAbrir={() => setSelected(p)} />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      <DetailDialog
        post={selected}
        thumb={selected ? previa(selected) : null}
        isOwner={isOwner}
        onClose={() => setSelected(null)}
        onApprove={async (id) => { await approve.mutateAsync(id); setSelected(null); }}
        onRequestAdjustment={async (id, comment) => { await requestAdjustment.mutateAsync({ postId: id, comment }); setSelected(null); }}
        approving={approve.isPending}
        requesting={requestAdjustment.isPending}
      />
    </div>
  );
}

function LinhaAprovacao({ p, thumb, parado, dias, hojeIso, onAbrir }: {
  p: ApprovalPost; thumb: string | null; parado: boolean; dias: number; hojeIso: string; onAbrir: () => void;
}) {
  const s = statusOf(p);
  const formato = FORMAT_LABELS[p.format] || p.format;
  const video = ["reels", "video"].includes(p.format);
  const passou = !!p.scheduled_date && p.scheduled_date < hojeIso;
  return (
    <button type="button" onClick={onAbrir}
      className="relative w-full text-left flex items-start gap-3 rounded-2xl border-2 border-foreground bg-card p-3 shadow-[3px_3px_0_hsl(var(--foreground))] transition-transform hover:-translate-y-0.5">
      {(parado || s === "ajuste_solicitado") && (
        <span className={cn("absolute -top-2.5 left-3 rotate-[-6deg] rounded-md border-2 px-1.5 text-[9.5px] font-body font-black uppercase tracking-wider bg-card",
          s === "ajuste_solicitado" ? "border-[#E0458F] text-[#E0458F]" : "border-[#0061EE] text-[#0061EE]")}>
          {s === "ajuste_solicitado" ? "ajuste" : "parado"}
        </span>
      )}
      <span className={cn("relative h-[72px] w-[56px] shrink-0 overflow-hidden rounded-lg",
        thumb ? "border-2 border-foreground bg-muted" : "border-2 border-dashed border-foreground/40 bg-[repeating-linear-gradient(45deg,#F2ECDD_0_6px,#EADFC8_6px_12px)] dark:bg-muted grid place-items-center")}>
        {thumb ? (
          <>
            <img src={thumb} alt="" loading="lazy" className="h-full w-full object-cover" onError={(e) => { e.currentTarget.style.display = "none"; }} />
            {video && <span className="absolute inset-0 grid place-items-center"><span className="grid h-6 w-6 place-items-center rounded-full bg-black/45 text-white"><Play className="h-3 w-3" fill="currentColor" /></span></span>}
          </>
        ) : (
          <span className="text-[9.5px] font-body font-bold text-muted-foreground text-center leading-tight">sem<br />mídia</span>
        )}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[10px] font-body font-bold uppercase tracking-wider text-muted-foreground">
          <span className={COR_FORMATO[p.format] ?? "text-foreground"}>{formato}</span> · {p.platform ?? "instagram"}
        </span>
        <span className="block mt-0.5 text-[14px] font-body font-extrabold leading-snug text-foreground line-clamp-2">{p.title}</span>
        <span className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11.5px] font-body text-muted-foreground">
          <span className={cn("rounded-full border px-2 py-[1px] text-[10.5px] font-bold",
            s === "aprovado" ? "border-green-700/40 bg-green-100 text-green-800" : s === "ajuste_solicitado" ? "border-[#E0458F]/40 bg-[#FFD3E8] text-[#8a1f52]" : "border-foreground/30 bg-[#FFF1A8] text-[#4a3a00]")}>
            {s === "aprovado" ? "aprovado" : s === "ajuste_solicitado" ? "ajuste pedido" : "esperando"}
          </span>
          {s !== "aprovado" && dias > 0 && (
            <span className={cn("font-semibold", parado ? "text-[#D93A12]" : "")}>há {dias} {dias === 1 ? "dia" : "dias"}</span>
          )}
          {p.scheduled_date && (
            <span>{passou && s !== "aprovado" ? `era pra ${dataHoraCurta(p.scheduled_date)}` : `sai ${diaCurto(p.scheduled_date)}`}</span>
          )}
        </span>
      </span>
      <span className="hidden sm:inline-block self-center shrink-0 rounded-full border-2 border-foreground bg-card px-3 py-1 text-[12px] font-body font-bold">
        {s === "ajuste_solicitado" ? "Ver ajuste" : "Abrir"}
      </span>
    </button>
  );
}

function DetailDialog({ post, thumb, isOwner, onClose, onApprove, onRequestAdjustment, approving, requesting }: {
  post: ApprovalPost | null;
  thumb: string | null;
  isOwner: boolean;
  onClose: () => void;
  onApprove: (id: string) => Promise<void>;
  onRequestAdjustment: (id: string, comment: string) => Promise<void>;
  approving: boolean;
  requesting: boolean;
}) {
  const { comments, addComment } = usePostApprovalComments(post?.id ?? null);
  const [text, setText] = useState("");
  useEffect(() => { setText(""); }, [post?.id]);

  const status = post ? statusOf(post) : "pendente";
  const canApprove = isOwner && status !== "aprovado";

  const handleReply = async () => {
    if (!text.trim()) return;
    await addComment.mutateAsync({ content: text.trim(), role: isOwner ? "cliente" : "social_media" });
    setText("");
  };

  return (
    <Dialog open={!!post} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        {post && (
          <>
            <DialogHeader><DialogTitle className="font-display">{post.title}</DialogTitle></DialogHeader>
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="aspect-[4/5] bg-muted rounded-xl overflow-hidden">
                {thumb ? (
                  <img src={thumb} alt={post.title} loading="lazy" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-sm font-body font-semibold text-muted-foreground">sem mídia</div>
                )}
              </div>
              <div className="space-y-3">
                <div className="flex items-center gap-2 flex-wrap">
                  <PlatformIcon platform={post.platform} size="sm" />
                  <span className="text-xs bg-muted px-2 py-0.5 rounded font-body">{FORMAT_LABELS[post.format] || post.format}</span>
                  <StatusBadge p={post} />
                </div>
                {post.scheduled_date && (
                  <p className="text-xs text-muted-foreground font-body inline-flex items-center gap-1"><Calendar className="h-3 w-3" /> {dataHoraCurta(post.scheduled_date, post.scheduled_time)}</p>
                )}
                {post.hook && <div><p className="text-[11px] uppercase tracking-wide text-muted-foreground font-body mb-0.5">Hook</p><p className="text-sm font-body">{post.hook}</p></div>}
                {post.caption && <div><p className="text-[11px] uppercase tracking-wide text-muted-foreground font-body mb-0.5">Legenda</p><p className="text-sm font-body whitespace-pre-wrap">{post.caption}</p></div>}
              </div>
            </div>

            <div className="mt-4 border-t border-border pt-4">
              <p className="text-xs uppercase tracking-wide text-muted-foreground font-body mb-2 inline-flex items-center gap-1"><MessageCircle className="h-3.5 w-3.5" /> Comentários</p>
              <div className="space-y-2 max-h-48 overflow-y-auto mb-3">
                {comments.length === 0 ? (
                  <p className="text-xs text-muted-foreground font-body">Nenhum comentário ainda.</p>
                ) : comments.map((c) => (
                  <div key={c.id} className="bg-muted/50 rounded-lg p-2.5">
                    <p className="text-[11px] font-body font-semibold text-foreground mb-0.5">{c.author_role === "cliente" ? "Cliente" : c.author_role === "social_media" ? "Social media" : "Sistema"}</p>
                    <p className="text-sm font-body text-foreground/90 whitespace-pre-wrap">{c.content}</p>
                  </div>
                ))}
              </div>
              <div className="flex items-end gap-2">
                <Textarea value={text} onChange={(e) => setText(e.target.value)} placeholder="Escreva um comentário..." className="min-h-[44px] text-sm" />
                <Button type="button" variant="outline" size="icon" onClick={handleReply} disabled={!text.trim() || addComment.isPending} aria-label="Enviar comentário"><Send className="h-4 w-4" /></Button>
              </div>
            </div>

            <div className="mt-4 border-t border-border pt-4">
              {canApprove ? (
                <>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <Button onClick={() => onApprove(post.id)} disabled={approving} className="flex-1 bg-green-600 hover:bg-green-700 text-white"><CheckCircle2 className="h-4 w-4 mr-1.5" /> Aprovar</Button>
                    <Button variant="outline" onClick={() => onRequestAdjustment(post.id, text.trim())} disabled={requesting} className="flex-1 border-orange-300 text-orange-700 hover:bg-orange-50"><RotateCcw className="h-4 w-4 mr-1.5" /> Pedir ajuste</Button>
                  </div>
                  <p className="text-[11px] text-muted-foreground font-body mt-2">Para pedir ajuste, escreva o motivo no comentário acima antes de clicar.</p>
                </>
              ) : isOwner && status === "aprovado" ? (
                <p className="text-sm text-green-700 font-body inline-flex items-center gap-1.5"><CheckCircle2 className="h-4 w-4" /> Você já aprovou este post.</p>
              ) : (
                <p className="text-sm text-muted-foreground font-body inline-flex items-center gap-1.5"><ShieldCheck className="h-4 w-4" /> Apenas o cliente pode aprovar. Você pode comentar acima.</p>
              )}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
