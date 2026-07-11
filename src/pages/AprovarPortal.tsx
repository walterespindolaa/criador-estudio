import { useEffect, useState, type CSSProperties } from "react";
import { useParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Check, RotateCcw, Loader2, ImageOff, Heart, MessageCircle, Send, Bookmark, Zap, ListChecks, ChevronDown } from "lucide-react";
import { hexToHsl } from "@/lib/applyTheme";
import { PostMediaCarousel } from "@/components/shared/PostMediaCarousel";
import { StoryPreview } from "@/components/accounts/StoryPreview";
import { postAspect } from "@/lib/post-aspect";
import { EtapasChecklist, type Stage } from "@/components/aprovar/EtapasChecklist";

type AnyRpc = (fn: string, args?: Record<string, unknown>) => ReturnType<typeof supabase.rpc>;
const sbRpc = supabase.rpc.bind(supabase) as unknown as AnyRpc;

type MediaItem = {
  provider: string | null; thumbnail_url: string | null; view_url: string | null;
  download_url: string | null; bunny_video_id: string | null; file_type: string | null; file_name: string | null;
};
type PortalPost = {
  post_id: string; title: string; platform: string; format: string;
  caption: string | null; hook: string | null; script: string | null; content_blocks: unknown;
  approval_mode: "fast" | "flow" | "both"; approval_stages: Record<string, string> | null;
  approval_status: "pendente" | "ajuste_solicitado" | "aprovado";
  scheduled_date: string | null; media: MediaItem[];
  last_comment: string | null; last_comment_role: string | null;
};
type ClientHeader = { client_name: string; client_logo: string | null; manager_name: string | null; brand_color?: string | null; instagram_handle?: string | null };

const STATUS: Record<string, { label: string; cls: string }> = {
  pendente: { label: "Aguardando você", cls: "bg-amber-100 text-amber-700" },
  ajuste_solicitado: { label: "Ajuste solicitado", cls: "bg-orange-100 text-orange-700" },
  aprovado: { label: "Aprovado", cls: "bg-green-100 text-green-700" },
};

function CardIG({ client, post }: { client: ClientHeader; post: PortalPost }) {
  const media = Array.isArray(post.media) ? post.media : [];
  const handle = client.instagram_handle ? client.instagram_handle.replace(/^@/, "") : (client.client_name || "perfil").toLowerCase().replace(/\s+/g, "");
  const aspect = postAspect(post.platform, post.format);
  const vertical = aspect === "9 / 16";
  // Story tem preview próprio: tela cheia 9:16, sem legenda e sem ações de feed.
  if ((post.format || "").toLowerCase() === "story") {
    return (
      <article className="rounded-3xl overflow-hidden shadow-[0_8px_30px_rgba(27,26,24,0.07)]">
        <StoryPreview media={media} handle={handle} avatarUrl={client.client_logo} />
      </article>
    );
  }
  return (
    <article className="bg-white border border-border rounded-3xl overflow-hidden shadow-[0_8px_30px_rgba(27,26,24,0.07)]">
      <div className="flex items-center gap-2.5 px-3.5 py-3">
        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-primary via-purple-600 to-pink-500 p-[2px] shrink-0">
          <div className="w-full h-full rounded-full bg-white flex items-center justify-center overflow-hidden">
            {client.client_logo ? <img src={client.client_logo} alt="" className="w-full h-full object-cover" /> : <span className="text-xs font-extrabold text-primary">{(client.client_name || "?").charAt(0).toUpperCase()}</span>}
          </div>
        </div>
        <div className="min-w-0"><p className="text-[13px] font-bold text-foreground truncate leading-tight">{handle}</p><p className="text-[11px] text-muted-foreground leading-tight">Original audio</p></div>
        <span className="ml-auto text-foreground font-bold tracking-widest">···</span>
      </div>

      {vertical ? (
        <div className="relative">
          <PostMediaCarousel media={media} aspect={aspect} />
          <div className="absolute inset-x-0 bottom-0 h-2/5 bg-gradient-to-t from-black/70 to-transparent pointer-events-none" />
          <div className="absolute right-3 bottom-16 z-10 flex flex-col items-center gap-4 text-white pointer-events-none [filter:drop-shadow(0_1px_2px_rgba(0,0,0,.6))]">
            <Heart className="h-7 w-7" /><MessageCircle className="h-7 w-7" /><Send className="h-7 w-7" /><Bookmark className="h-7 w-7" />
          </div>
          {post.caption && (
            <div className="absolute left-3.5 right-16 bottom-3.5 z-10 text-white text-[13px] leading-snug pointer-events-none line-clamp-3 [text-shadow:0_1px_3px_rgba(0,0,0,.6)]">
              <span className="font-bold mr-1.5">{handle}</span>{post.caption}
            </div>
          )}
        </div>
      ) : (
        <>
          <PostMediaCarousel media={media} aspect={aspect} />
          <div className="flex items-center gap-4 px-3.5 pt-3 pb-1.5 text-foreground">
            <Heart className="h-6 w-6" /><MessageCircle className="h-6 w-6" /><Send className="h-6 w-6" /><Bookmark className="h-6 w-6 ml-auto" />
          </div>
          {post.caption && <p className="px-3.5 pb-4 text-[13.5px] leading-snug text-foreground whitespace-pre-wrap"><span className="font-bold mr-1.5">{handle}</span>{post.caption}</p>}
        </>
      )}
    </article>
  );
}

function PostApproval({ client, post, busy, onApproveFast, onAdjustFast, onApproveStage, onAdjustStage }: {
  client: ClientHeader; post: PortalPost; busy: boolean;
  onApproveFast: (id: string) => void; onAdjustFast: (id: string, comment: string) => void;
  onApproveStage: (id: string, stage: Stage) => void; onAdjustStage: (id: string, stage: Stage, comment: string) => void;
}) {
  const mode = post.approval_mode ?? "fast";
  const [view, setView] = useState<"fast" | "flow">(mode === "flow" ? "flow" : "fast");
  const showFlow = view === "flow";
  const [adjOpen, setAdjOpen] = useState(false);
  const [comment, setComment] = useState("");
  const fullyApproved = post.approval_status === "aprovado";
  const vertical = postAspect(post.platform, post.format) === "9 / 16";

  const openAdjust = () => { setAdjOpen(true); setComment(""); };
  const sendFast = () => { onAdjustFast(post.post_id, comment.trim()); setAdjOpen(false); setComment(""); };

  return (
    <div className="mb-10 last:mb-0">
      <div className={`w-full mx-auto ${vertical ? "max-w-[330px]" : ""}`}>
        <CardIG client={client} post={post} />
      </div>
      <div className="bg-card border border-border rounded-3xl p-4 sm:p-6 mt-3 shadow-[0_8px_30px_rgba(27,26,24,0.05)]">
            {mode === "both" && (
              <div className="flex bg-muted rounded-2xl p-1.5 mb-5">
                <button onClick={() => setView("fast")} className={`flex-1 flex items-center justify-center gap-1.5 text-sm font-body font-extrabold py-3 rounded-xl transition-colors ${view === "fast" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"}`}><Zap className="h-4 w-4" /> Rápida</button>
                <button onClick={() => setView("flow")} className={`flex-1 flex items-center justify-center gap-1.5 text-sm font-body font-extrabold py-3 rounded-xl transition-colors ${view === "flow" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"}`}><ListChecks className="h-4 w-4" /> Detalhada</button>
              </div>
            )}
            {!showFlow ? (
              <>
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <h3 className="text-lg font-display font-extrabold text-foreground">Esta publicação</h3>
                  <span className={`text-[11px] font-bold px-3 py-1 rounded-full ${STATUS[post.approval_status].cls}`}>{STATUS[post.approval_status].label}</span>
                </div>
                <p className="text-xs text-muted-foreground font-body mb-4 capitalize">{post.format} · {post.platform}</p>
                {post.last_comment && post.last_comment_role === "cliente_externo" && (
                  <div className="text-xs font-body text-orange-700 bg-orange-50 border border-orange-100 rounded-xl px-3 py-2.5 mb-4">Você pediu: "{post.last_comment}"</div>
                )}
                {fullyApproved ? (
                  <div className="flex items-center gap-2 text-sm font-body font-bold text-green-700 bg-green-50 rounded-2xl px-4 py-3.5"><Check className="h-5 w-5" /> Aprovado, obrigada!</div>
                ) : !adjOpen ? (
                  <div className="flex gap-3">
                    <Button className="flex-1 h-14 rounded-2xl text-base font-bold shadow-lg shadow-primary/25" onClick={() => onApproveFast(post.post_id)} disabled={busy}>{busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <><Check className="h-5 w-5 mr-1.5" /> Aprovar</>}</Button>
                    <Button variant="secondary" className="h-14 rounded-2xl px-5" onClick={openAdjust} disabled={busy}><RotateCcw className="h-4 w-4 mr-1.5" /> Ajuste</Button>
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    <Textarea value={comment} onChange={(e) => setComment(e.target.value)} placeholder="O que você quer ajustar?" className="rounded-2xl" rows={3} />
                    <div className="flex gap-2.5">
                      <Button className="flex-1 h-12 rounded-2xl" disabled={busy || !comment.trim()} onClick={sendFast}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Enviar ajuste"}</Button>
                      <Button variant="ghost" className="h-12 rounded-2xl" onClick={() => setAdjOpen(false)} disabled={busy}>Cancelar</Button>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <EtapasChecklist
                post={post}
                busy={busy}
                onApproveStage={(stage) => onApproveStage(post.post_id, stage)}
                onAdjustStage={(stage, stageComment) => onAdjustStage(post.post_id, stage, stageComment)}
              />
            )}
      </div>
    </div>
  );
}

export default function AprovarPortal() {
  const { token } = useParams<{ token: string }>();
  const qc = useQueryClient();
  const inv = () => qc.invalidateQueries({ queryKey: ["portal-posts", token] });

  const clientQ = useQuery({
    queryKey: ["portal-client", token], enabled: !!token,
    queryFn: async () => {
      const { data, error } = await sbRpc("get_external_client_by_token", { _token: token });
      if (error) throw error;
      return ((data as ClientHeader[]) ?? [])[0] ?? null;
    },
  });
  const handleQ = useQuery({
    queryKey: ["portal-handle", token], enabled: !!token,
    queryFn: async () => {
      const { data } = await sbRpc("get_external_handle_by_token", { _token: token });
      return (typeof data === "string" ? data : null) as string | null;
    },
  });
  const postsQ = useQuery({
    queryKey: ["portal-posts", token], enabled: !!token && !!clientQ.data,
    queryFn: async () => {
      const { data, error } = await sbRpc("list_posts_by_token", { _token: token });
      if (error) throw error;
      return (data as PortalPost[]) ?? [];
    },
  });

  const approveFast = useMutation({ mutationFn: async (id: string) => { const { error } = await sbRpc("approve_post_by_token", { _token: token, _post_id: id }); if (error) throw error; }, onSuccess: () => { toast.success("Aprovado!"); inv(); }, onError: () => toast.error("Não foi possível aprovar.") });
  const adjustFast = useMutation({ mutationFn: async ({ id, comment }: { id: string; comment: string }) => { const { error } = await sbRpc("request_adjustment_by_token", { _token: token, _post_id: id, _comment: comment }); if (error) throw error; }, onSuccess: () => { toast.success("Ajuste enviado!"); inv(); }, onError: () => toast.error("Não foi possível enviar.") });
  const approveStage = useMutation({ mutationFn: async ({ id, stage }: { id: string; stage: Stage }) => { const { error } = await sbRpc("approve_stage_by_token", { _token: token, _post_id: id, _stage: stage }); if (error) throw error; }, onSuccess: () => { toast.success("Etapa aprovada!"); inv(); }, onError: () => toast.error("Não foi possível aprovar.") });
  const adjustStage = useMutation({ mutationFn: async ({ id, stage, comment }: { id: string; stage: Stage; comment: string }) => { const { error } = await sbRpc("request_stage_adjustment_by_token", { _token: token, _post_id: id, _stage: stage, _comment: comment }); if (error) throw error; }, onSuccess: () => { toast.success("Ajuste enviado!"); inv(); }, onError: () => toast.error("Não foi possível enviar.") });

  const busy = approveFast.isPending || adjustFast.isPending || approveStage.isPending || adjustStage.isPending;

  const [showApproved, setShowApproved] = useState(false);

  // Registra que o cliente abriu o portal (fire and forget, não bloqueia nada).
  useEffect(() => {
    if (!token) return;
    sbRpc("portal_mark_viewed", { _token: token }).then(() => undefined, () => undefined);
  }, [token]);

  if (clientQ.isLoading) return <div className="min-h-screen bg-background flex items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
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

  const c: ClientHeader = { ...clientQ.data, instagram_handle: handleQ.data ?? null };
  const posts = postsQ.data ?? [];
  // Ordem do feed: pendentes primeiro, depois em ajuste; aprovados ficam num grupo colapsado.
  const pendentes = posts.filter((p) => p.approval_status === "pendente");
  const emAjuste = posts.filter((p) => p.approval_status === "ajuste_solicitado");
  const aprovados = posts.filter((p) => p.approval_status === "aprovado");
  const fila = [...pendentes, ...emAjuste];
  const total = posts.length;
  // Cor da marca do cliente vira o accent local da página (CSS vars no wrapper).
  const brandVars = (c.brand_color
    ? { "--primary": hexToHsl(c.brand_color), "--ring": hexToHsl(c.brand_color) }
    : {}) as CSSProperties;

  const renderPost = (p: PortalPost) => (
    <PostApproval key={p.post_id} client={c} post={p} busy={busy}
      onApproveFast={(id) => approveFast.mutate(id)}
      onAdjustFast={(id, comment) => adjustFast.mutate({ id, comment })}
      onApproveStage={(id, stage) => approveStage.mutate({ id, stage })}
      onAdjustStage={(id, stage, comment) => adjustStage.mutate({ id, stage, comment })} />
  );

  return (
    <div className="min-h-screen bg-background" style={brandVars}>
      <header className="border-b border-border bg-card/80 backdrop-blur-md sticky top-0 z-10">
        <div className="max-w-md mx-auto px-4 py-3 flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-primary/10 ring-2 ring-primary/25 overflow-hidden flex items-center justify-center shrink-0">
            {c.client_logo ? <img src={c.client_logo} alt="" className="w-full h-full object-cover" /> : <span className="font-display font-extrabold text-primary">{(c.client_name || "?").charAt(0).toUpperCase()}</span>}
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-display font-bold text-foreground truncate leading-tight">{c.client_name}</p>
            {c.manager_name && <p className="text-[11px] text-muted-foreground font-body truncate">conteúdo por {c.manager_name}</p>}
          </div>
          {total > 0 && (
            <div className="text-right shrink-0">
              <p className="text-sm font-display font-extrabold text-primary leading-tight">{aprovados.length} de {total}</p>
              <p className="text-[10px] text-muted-foreground font-body">aprovados</p>
            </div>
          )}
        </div>
        <div className="h-1 bg-primary/10">
          <div className="h-full bg-primary transition-all duration-500" style={{ width: total ? `${(aprovados.length / total) * 100}%` : "0%" }} />
        </div>
      </header>

      <main className="max-w-md mx-auto px-4 py-6">
        <div className="text-center mb-6">
          <h1 className="font-display font-extrabold text-foreground text-xl">Aprove seus posts</h1>
          <p className="text-sm text-muted-foreground font-body mt-1">Revise o conteúdo e aprove ou peça ajustes.</p>
        </div>

        {postsQ.isLoading ? (
          <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
        ) : total === 0 ? (
          <div className="text-center py-16 text-muted-foreground font-body"><Check className="h-10 w-10 mx-auto mb-3 opacity-40" /><p className="font-medium text-foreground">Tudo em dia!</p><p className="text-sm mt-1">Nenhum post aguardando sua revisão agora.</p></div>
        ) : (
          <>
            {fila.length === 0 ? (
              <div className="text-center bg-green-50 border border-green-100 rounded-3xl px-4 py-8 mb-6">
                <div className="w-12 h-12 rounded-full bg-green-500 text-white flex items-center justify-center mx-auto mb-3"><Check className="h-6 w-6" strokeWidth={3} /></div>
                <p className="font-display font-extrabold text-green-800">Tudo aprovado, obrigado!</p>
                <p className="text-[13px] font-body text-green-700 mt-1">Nenhum post esperando sua revisão agora.</p>
              </div>
            ) : (
              fila.map(renderPost)
            )}

            {aprovados.length > 0 && (
              <section className="mt-2">
                <button type="button" onClick={() => setShowApproved((v) => !v)} aria-expanded={showApproved}
                  className="w-full min-h-[48px] flex items-center justify-between gap-2 bg-card border border-border rounded-2xl px-4 py-3 hover:bg-muted/40 transition-colors">
                  <span className="flex items-center gap-2.5 text-sm font-body font-bold text-foreground">
                    <span className="w-6 h-6 rounded-full bg-green-500 text-white flex items-center justify-center shrink-0"><Check className="h-3.5 w-3.5" strokeWidth={3} /></span>
                    Aprovados ({aprovados.length})
                  </span>
                  <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${showApproved ? "rotate-180" : ""}`} />
                </button>
                {showApproved && <div className="mt-6">{aprovados.map(renderPost)}</div>}
              </section>
            )}
          </>
        )}
        <p className="text-center text-[11px] text-muted-foreground font-body pt-8 pb-10">Feito com <span className="font-extrabold text-primary">CRIA</span></p>
      </main>
    </div>
  );
}
