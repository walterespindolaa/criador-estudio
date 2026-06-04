import { useState } from "react";
import { useParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Check, RotateCcw, Loader2, ImageOff, Sparkles } from "lucide-react";

type AnyRpc = (fn: string, args?: Record<string, unknown>) => ReturnType<typeof supabase.rpc>;
const sbRpc = supabase.rpc.bind(supabase) as unknown as AnyRpc;

type MediaItem = {
  provider: string | null; thumbnail_url: string | null; view_url: string | null;
  download_url: string | null; bunny_video_id: string | null; file_type: string | null; file_name: string | null;
};
type PortalPost = {
  post_id: string; title: string; platform: string; format: string;
  caption: string | null; hook: string | null; content_blocks: unknown;
  approval_status: "pendente" | "ajuste_solicitado" | "aprovado";
  scheduled_date: string | null; media: MediaItem[];
  last_comment: string | null; last_comment_role: string | null;
};
type ClientHeader = { client_name: string; client_logo: string | null; manager_name: string | null };

const STATUS: Record<string, { label: string; cls: string }> = {
  pendente: { label: "Aguardando sua aprovação", cls: "bg-amber-100 text-amber-700" },
  ajuste_solicitado: { label: "Ajuste solicitado", cls: "bg-orange-100 text-orange-700" },
  aprovado: { label: "Aprovado", cls: "bg-green-100 text-green-700" },
};

function Media({ item }: { item: MediaItem }) {
  const isVideo = (item.file_type?.startsWith("video")) || !!item.bunny_video_id;
  const src = item.view_url || item.thumbnail_url || item.download_url || "";
  if (isVideo && item.view_url) {
    return <iframe src={item.view_url} className="w-full aspect-square bg-black" allow="autoplay; fullscreen; picture-in-picture" loading="lazy" title={item.file_name || "vídeo"} />;
  }
  if (src) return <img src={src} alt={item.file_name || ""} className="w-full aspect-square object-cover bg-muted" loading="lazy" />;
  return <div className="w-full aspect-square bg-muted flex items-center justify-center text-muted-foreground"><ImageOff className="h-8 w-8" /></div>;
}

function PostCard({ post, onApprove, onRequest, busy }: {
  post: PortalPost; busy: boolean;
  onApprove: (id: string) => void; onRequest: (id: string, comment: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [comment, setComment] = useState("");
  const st = STATUS[post.approval_status] ?? STATUS.pendente;
  const approved = post.approval_status === "aprovado";
  const media = Array.isArray(post.media) ? post.media : [];

  return (
    <article className="bg-card border border-border rounded-3xl overflow-hidden shadow-sm">
      {media.length > 1 ? (
        <div className="flex overflow-x-auto snap-x snap-mandatory">
          {media.map((m, i) => <div key={i} className="w-full shrink-0 snap-center">{<Media item={m} />}</div>)}
        </div>
      ) : media.length === 1 ? <Media item={media[0]} /> : (
        <div className="w-full aspect-square bg-muted flex items-center justify-center text-muted-foreground"><ImageOff className="h-8 w-8" /></div>
      )}

      <div className="p-5">
        <div className="flex items-center justify-between gap-2 mb-2">
          <span className="text-[11px] font-body font-semibold text-muted-foreground uppercase tracking-wide">{post.format} · {post.platform}</span>
          <span className={`text-[11px] font-body font-bold px-2.5 py-1 rounded-full ${st.cls}`}>{st.label}</span>
        </div>
        {post.title && <h3 className="font-display font-bold text-foreground mb-1">{post.title}</h3>}
        {post.caption && <p className="text-sm font-body text-foreground/90 whitespace-pre-wrap">{post.caption}</p>}

        {post.last_comment && post.last_comment_role === "cliente_externo" && (
          <div className="mt-3 text-xs font-body text-orange-700 bg-orange-50 border border-orange-100 rounded-xl px-3 py-2">
            Você pediu ajuste: "{post.last_comment}"
          </div>
        )}

        {!approved && (
          <div className="mt-4">
            {!open ? (
              <div className="flex gap-2">
                <Button className="flex-1 h-11 rounded-xl" onClick={() => onApprove(post.post_id)} disabled={busy}>
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Check className="h-4 w-4 mr-1.5" /> Aprovar</>}
                </Button>
                <Button variant="outline" className="h-11 rounded-xl" onClick={() => setOpen(true)} disabled={busy}>
                  <RotateCcw className="h-4 w-4 mr-1.5" /> Pedir ajuste
                </Button>
              </div>
            ) : (
              <div className="space-y-2">
                <Textarea value={comment} onChange={(e) => setComment(e.target.value)} placeholder="O que você quer ajustar nesse post?" className="rounded-xl" rows={3} />
                <div className="flex gap-2">
                  <Button className="flex-1 h-11 rounded-xl" disabled={busy || !comment.trim()}
                    onClick={() => { onRequest(post.post_id, comment.trim()); setOpen(false); setComment(""); }}>
                    {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Enviar ajuste"}
                  </Button>
                  <Button variant="ghost" className="h-11 rounded-xl" onClick={() => { setOpen(false); setComment(""); }} disabled={busy}>Cancelar</Button>
                </div>
              </div>
            )}
          </div>
        )}
        {approved && <div className="mt-4 flex items-center gap-1.5 text-sm font-body font-semibold text-green-700"><Check className="h-4 w-4" /> Aprovado — obrigada!</div>}
      </div>
    </article>
  );
}

export default function AprovarPortal() {
  const { token } = useParams<{ token: string }>();
  const qc = useQueryClient();

  const clientQ = useQuery({
    queryKey: ["portal-client", token],
    enabled: !!token,
    queryFn: async () => {
      const { data, error } = await sbRpc("get_external_client_by_token", { _token: token });
      if (error) throw error;
      const rows = (data as ClientHeader[]) ?? [];
      return rows[0] ?? null;
    },
  });

  const postsQ = useQuery({
    queryKey: ["portal-posts", token],
    enabled: !!token && !!clientQ.data,
    queryFn: async () => {
      const { data, error } = await sbRpc("list_posts_by_token", { _token: token });
      if (error) throw error;
      return (data as PortalPost[]) ?? [];
    },
  });

  const approve = useMutation({
    mutationFn: async (postId: string) => {
      const { error } = await sbRpc("approve_post_by_token", { _token: token, _post_id: postId });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Post aprovado!"); qc.invalidateQueries({ queryKey: ["portal-posts", token] }); },
    onError: () => toast.error("Não foi possível aprovar. Atualize a página."),
  });

  const requestAdj = useMutation({
    mutationFn: async ({ postId, comment }: { postId: string; comment: string }) => {
      const { error } = await sbRpc("request_adjustment_by_token", { _token: token, _post_id: postId, _comment: comment });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Ajuste enviado!"); qc.invalidateQueries({ queryKey: ["portal-posts", token] }); },
    onError: () => toast.error("Não foi possível enviar. Tente de novo."),
  });

  if (clientQ.isLoading) {
    return <div className="min-h-screen bg-background flex items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  }
  if (clientQ.isError || !clientQ.data) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-6">
        <div className="text-center max-w-sm">
          <div className="w-14 h-14 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-4"><ImageOff className="h-6 w-6 text-muted-foreground" /></div>
          <h1 className="font-display font-bold text-foreground text-lg">Link inválido ou expirado</h1>
          <p className="text-sm text-muted-foreground font-body mt-1">Peça um novo link de aprovação pra quem cuida do seu conteúdo.</p>
        </div>
      </div>
    );
  }

  const c = clientQ.data;
  const posts = postsQ.data ?? [];
  const busy = approve.isPending || requestAdj.isPending;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card/60 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-lg mx-auto px-5 py-4 flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-primary via-purple-600 to-pink-500 p-[2px] shrink-0">
            <div className="w-full h-full rounded-2xl bg-card overflow-hidden flex items-center justify-center">
              {c.client_logo ? <img src={c.client_logo} alt="" className="w-full h-full object-cover" />
                : <span className="font-display font-extrabold text-primary">{(c.client_name || "?").charAt(0).toUpperCase()}</span>}
            </div>
          </div>
          <div className="min-w-0">
            <p className="font-display font-bold text-foreground truncate">{c.client_name}</p>
            {c.manager_name && <p className="text-xs text-muted-foreground font-body truncate">conteúdo por {c.manager_name}</p>}
          </div>
          <span className="ml-auto inline-flex items-center gap-1 text-[10px] font-body font-bold text-primary bg-primary/10 px-2 py-1 rounded-full shrink-0"><Sparkles className="h-3 w-3" /> cria post</span>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-5 py-6 space-y-5">
        <div className="text-center mb-2">
          <h1 className="font-display font-extrabold text-foreground text-xl">Aprove seus posts</h1>
          <p className="text-sm text-muted-foreground font-body mt-1">Revise cada conteúdo e aprove ou peça ajustes.</p>
        </div>

        {postsQ.isLoading ? (
          <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
        ) : posts.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground font-body">
            <Check className="h-10 w-10 mx-auto mb-3 opacity-40" />
            <p className="font-medium text-foreground">Tudo em dia!</p>
            <p className="text-sm mt-1">Nenhum post aguardando sua revisão agora.</p>
          </div>
        ) : (
          posts.map((p) => (
            <PostCard key={p.post_id} post={p} busy={busy}
              onApprove={(id) => approve.mutate(id)}
              onRequest={(id, comment) => requestAdj.mutate({ postId: id, comment })} />
          ))
        )}

        <p className="text-center text-[11px] text-muted-foreground font-body pt-4 pb-8">Powered by cria · criasocialclub.com.br</p>
      </main>
    </div>
  );
}
