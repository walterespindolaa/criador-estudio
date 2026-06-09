import { useEffect, useMemo, useState } from "react";
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
import { CheckCircle2, MessageCircle, RotateCcw, Calendar, ImageIcon, Send, ShieldCheck } from "lucide-react";

type FilterKey = "todos" | "pendente" | "ajuste_solicitado" | "aprovado";

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: "todos", label: "Todos" },
  { key: "pendente", label: "Pendentes" },
  { key: "ajuste_solicitado", label: "Em ajuste" },
  { key: "aprovado", label: "Aprovados" },
];

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

export default function Aprovacao() {
  const { activeAccountId } = useActiveAccount();
  const { profile } = useActiveProfile();
  const { queue, isLoading, isOwner, approve, requestAdjustment } = useApprovals();
  const [filter, setFilter] = useState<FilterKey>("todos");
  const [selected, setSelected] = useState<ApprovalPost | null>(null);

  const postIds = useMemo(() => queue.map((p) => p.id), [queue]);
  const { data: thumbs = {} } = useQuery<Record<string, string | null>>({
    queryKey: ["approval-thumbs", activeAccountId, postIds.slice().sort().join(",")],
    enabled: !!activeAccountId && postIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("external_media_refs")
        .select("post_id, thumbnail_url, created_at")
        .eq("user_id", activeAccountId!)
        .in("post_id", postIds)
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

  const filtered = useMemo(
    () => (filter === "todos" ? queue : queue.filter((p) => statusOf(p) === filter)),
    [queue, filter]
  );

  const counts = useMemo(() => {
    const c = { pendente: 0, ajuste_solicitado: 0, aprovado: 0 };
    for (const p of queue) c[statusOf(p)]++;
    return c;
  }, [queue]);

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 pb-24 md:pb-6">
      <header className="mb-6">
        <h1 className="text-2xl sm:text-3xl font-display font-extrabold text-foreground tracking-tight">Aprovações</h1>
        <p className="text-sm text-muted-foreground font-body mt-1">
          {isOwner
            ? "Revise os posts prontos e aprove ou peça ajustes."
            : `Acompanhe o que ${profile?.name ?? "o cliente"} já aprovou ou pediu ajuste. Apenas o cliente aprova.`}
        </p>
      </header>

      <div className="flex items-center gap-1 bg-card rounded-xl border border-border p-1 mb-5 w-fit overflow-x-auto">
        {FILTERS.map((f) => {
          const n = f.key === "todos" ? queue.length : counts[f.key];
          return (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-body border transition-colors whitespace-nowrap ${
                filter === f.key ? "bg-primary text-primary-foreground border-primary" : "bg-transparent border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              {f.label} <span className="opacity-70">({n})</span>
            </button>
          );
        })}
      </div>

      {isLoading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-56 rounded-2xl" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground font-body">
          <CheckCircle2 className="h-10 w-10 mx-auto mb-3 opacity-40" />
          <p>Nenhum post {filter === "todos" ? "em revisão" : "neste filtro"} por aqui.</p>
          <p className="text-xs mt-1">Posts movidos para "Pronto" no Criando aparecem aqui automaticamente.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {filtered.map((p) => {
            const thumb = thumbs[p.id];
            return (
              <button key={p.id} onClick={() => setSelected(p)}
                className="text-left bg-card rounded-2xl border border-border shadow-warm-sm hover:shadow-warm-md hover:scale-[1.01] transition-all overflow-hidden">
                <div className="aspect-[4/5] bg-muted relative">
                  {thumb ? (
                    <img src={thumb} alt={p.title} loading="lazy" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-muted-foreground/40"><ImageIcon className="h-8 w-8" /></div>
                  )}
                  <div className="absolute top-2 left-2"><StatusBadge p={p} /></div>
                </div>
                <div className="p-3">
                  <p className="font-body font-medium text-sm text-foreground line-clamp-2 mb-1.5">{p.title}</p>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <PlatformIcon platform={p.platform} size="sm" />
                    <span className="text-[11px] bg-muted px-1.5 py-0.5 rounded font-body">{FORMAT_LABELS[p.format] || p.format}</span>
                    {p.scheduled_date && (
                      <span className="text-[11px] text-muted-foreground font-body inline-flex items-center gap-1"><Calendar className="h-3 w-3" />{p.scheduled_date}</span>
                    )}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}

      <DetailDialog
        post={selected}
        thumb={selected ? (thumbs[selected.id] ?? null) : null}
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
                  <div className="w-full h-full flex items-center justify-center text-muted-foreground/40"><ImageIcon className="h-10 w-10" /></div>
                )}
              </div>
              <div className="space-y-3">
                <div className="flex items-center gap-2 flex-wrap">
                  <PlatformIcon platform={post.platform} size="sm" />
                  <span className="text-xs bg-muted px-2 py-0.5 rounded font-body">{FORMAT_LABELS[post.format] || post.format}</span>
                  <StatusBadge p={post} />
                </div>
                {post.scheduled_date && (
                  <p className="text-xs text-muted-foreground font-body inline-flex items-center gap-1"><Calendar className="h-3 w-3" /> {post.scheduled_date}{post.scheduled_time ? ` às ${post.scheduled_time}` : ""}</p>
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
