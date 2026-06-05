import { useState } from "react";
import { useParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Check, RotateCcw, Loader2, ImageOff, Sparkles, Heart, MessageCircle, Send, Bookmark } from "lucide-react";
import { PostMediaCarousel } from "@/components/shared/PostMediaCarousel";
import { postAspect } from "@/lib/post-aspect";

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
type ClientHeader = { client_name: string; client_logo: string | null; manager_name: string | null };

const STATUS: Record<string, { label: string; cls: string }> = {
  pendente: { label: "Aguardando você", cls: "bg-amber-100 text-amber-700" },
  ajuste_solicitado: { label: "Ajuste solicitado", cls: "bg-orange-100 text-orange-700" },
  aprovado: { label: "Aprovado", cls: "bg-green-100 text-green-700" },
};
const STAGE_ORDER = ["tema", "conteudo", "midia", "legenda"] as const;
type Stage = (typeof STAGE_ORDER)[number];
const STAGE_LABEL: Record<Stage, string> = { tema: "Tema", conteudo: "Conteúdo", midia: "Mídia", legenda: "Legenda" };

function CardIG({ client, post }: { client: ClientHeader; post: PortalPost }) {
  const media = Array.isArray(post.media) ? post.media : [];
  const handle = (client.client_name || "perfil").toLowerCase().replace(/\s+/g, "");
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

      <PostMediaCarousel media={media} aspect={postAspect(post.platform, post.format)} />

      <div className="flex items-center gap-4 px-3.5 pt-3 pb-1.5 text-foreground">
        <Heart className="h-6 w-6" /><MessageCircle className="h-6 w-6" /><Send className="h-6 w-6" />
        <Bookmark className="h-6 w-6 ml-auto" />
      </div>
      {post.caption && (
        <p className="px-3.5 pb-4 text-[13.5px] leading-snug text-foreground"><span className="font-bold mr-1.5">{handle}</span>{post.caption}</p>
      )}
    </article>
  );
}

function StageContent({ post, stage }: { post: PortalPost; stage: Stage }) {
  const map: Record<Stage, { label: string; value: string; box: boolean }> = {
    tema: { label: "Tema · ideia do post", value: post.title || "—", box: false },
    conteudo: { label: "Conteúdo · roteiro", value: post.script || post.hook || "—", box: true },
    midia: { label: "Mídia", value: "Revise a mídia exibida no post ao lado.", box: false },
    legenda: { label: "Legenda", value: post.caption || "—", box: true },
  };
  const c = map[stage];
  return (
    <div className="mt-1">
      <p className="text-[10.5px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5">{c.label}</p>
      <p className={`text-sm leading-relaxed whitespace-pre-wrap ${c.box ? "bg-muted/50 rounded-xl p-3" : "text-foreground/90"}`}>{c.value}</p>
    </div>
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
  const stStatus = (s: Stage) => (post.approval_stages?.[s] ?? "pendente");
  const firstOpen = STAGE_ORDER.find((s) => stStatus(s) !== "aprovado") ?? "tema";
  const [tab, setTab] = useState<Stage>(firstOpen);
  const [adjOpen, setAdjOpen] = useState(false);
  const [comment, setComment] = useState("");
  const fullyApproved = post.approval_status === "aprovado";

  const openAdjust = () => { setAdjOpen(true); setComment(""); };
  const sendFast = () => { onAdjustFast(post.post_id, comment.trim()); setAdjOpen(false); setComment(""); };
  const sendStage = () => { onAdjustStage(post.post_id, tab, comment.trim()); setAdjOpen(false); setComment(""); };

  return (
    <div className="border-b border-border pb-9 mb-9 last:border-0 last:pb-0 last:mb-0">
      <div className="flex flex-col md:flex-row md:items-start gap-6 md:gap-7 md:justify-center">
        {/* esquerda: post */}
        <div className="w-full max-w-[420px] md:w-[372px] md:max-w-none md:shrink-0 mx-auto md:mx-0">
          <CardIG client={client} post={post} />
        </div>

        {/* direita: aprovação */}
        <div className="w-full max-w-[420px] md:flex-1 md:max-w-[420px] mx-auto md:mx-0">
          <div className="bg-card border border-border rounded-2xl p-5 md:sticky md:top-[88px]">
            {mode === "both" && (
              <div className="flex bg-muted rounded-xl p-1 mb-4">
                <button onClick={() => setView("fast")} className={`flex-1 text-xs font-body font-bold py-2 rounded-lg transition-colors ${view === "fast" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"}`}>Rápida</button>
                <button onClick={() => setView("flow")} className={`flex-1 text-xs font-body font-bold py-2 rounded-lg transition-colors ${view === "flow" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"}`}>Detalhada</button>
              </div>
            )}
            {!showFlow ? (
              <>
                <div className="flex items-center justify-between gap-2 mb-1">
                  <h3 className="text-base font-display font-extrabold text-foreground">Esta publicação</h3>
                  <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full ${STATUS[post.approval_status].cls}`}>{STATUS[post.approval_status].label}</span>
                </div>
                <p className="text-xs text-muted-foreground font-body mb-3">{post.format} · {post.platform}</p>
                {post.last_comment && post.last_comment_role === "cliente_externo" && (
                  <div className="text-xs font-body text-orange-700 bg-orange-50 border border-orange-100 rounded-xl px-3 py-2 mb-3">Você pediu: "{post.last_comment}"</div>
                )}
                {fullyApproved ? (
                  <div className="flex items-center gap-1.5 text-sm font-body font-semibold text-green-700"><Check className="h-4 w-4" /> Aprovado — obrigada!</div>
                ) : !adjOpen ? (
                  <div className="flex gap-2">
                    <Button className="flex-1 h-11 rounded-xl" onClick={() => onApproveFast(post.post_id)} disabled={busy}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Check className="h-4 w-4 mr-1.5" /> Aprovar</>}</Button>
                    <Button variant="outline" className="h-11 rounded-xl" onClick={openAdjust} disabled={busy}><RotateCcw className="h-4 w-4 mr-1.5" /> Pedir ajuste</Button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Textarea value={comment} onChange={(e) => setComment(e.target.value)} placeholder="O que você quer ajustar?" className="rounded-xl" rows={3} />
                    <div className="flex gap-2">
                      <Button className="flex-1 h-11 rounded-xl" disabled={busy || !comment.trim()} onClick={sendFast}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Enviar ajuste"}</Button>
                      <Button variant="ghost" className="h-11 rounded-xl" onClick={() => setAdjOpen(false)} disabled={busy}>Cancelar</Button>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <>
                <h3 className="text-base font-display font-extrabold text-foreground">Aprovação por etapas</h3>
                <p className="text-xs text-muted-foreground font-body mb-3">{STAGE_ORDER.filter((s) => stStatus(s) === "aprovado").length} de 4 etapas aprovadas</p>
                <div className="grid grid-cols-2 gap-2 mb-4">
                  {STAGE_ORDER.map((s) => {
                    const st = stStatus(s);
                    return (
                      <button key={s} onClick={() => { setTab(s); setAdjOpen(false); }}
                        className={`text-left rounded-xl border px-3 py-2 transition-colors ${tab === s ? "border-primary bg-primary/5" : "border-border bg-card hover:border-primary/30"}`}>
                        <span className="block text-[13px] font-bold text-foreground">{STAGE_LABEL[s]}</span>
                        <span className={`block text-[10.5px] font-bold mt-0.5 ${st === "aprovado" ? "text-green-700" : st === "ajuste_solicitado" ? "text-orange-700" : "text-amber-700"}`}>
                          {st === "aprovado" ? "✓ Aprovado" : st === "ajuste_solicitado" ? "↺ Em ajuste" : "⏳ Revisar"}
                        </span>
                      </button>
                    );
                  })}
                </div>

                <StageContent post={post} stage={tab} />

                {stStatus(tab) === "aprovado" ? (
                  <div className="mt-4 flex items-center gap-1.5 text-sm font-body font-semibold text-green-700"><Check className="h-4 w-4" /> Etapa aprovada</div>
                ) : !adjOpen ? (
                  <div className="flex gap-2 mt-4">
                    <Button className="flex-1 h-11 rounded-xl" onClick={() => onApproveStage(post.post_id, tab)} disabled={busy}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Check className="h-4 w-4 mr-1.5" /> Aprovar etapa</>}</Button>
                    <Button variant="outline" className="h-11 rounded-xl" onClick={openAdjust} disabled={busy}><RotateCcw className="h-4 w-4 mr-1.5" /> Ajuste</Button>
                  </div>
                ) : (
                  <div className="space-y-2 mt-4">
                    <Textarea value={comment} onChange={(e) => setComment(e.target.value)} placeholder={`O que ajustar em "${STAGE_LABEL[tab]}"?`} className="rounded-xl" rows={3} />
                    <div className="flex gap-2">
                      <Button className="flex-1 h-11 rounded-xl" disabled={busy || !comment.trim()} onClick={sendStage}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Enviar ajuste"}</Button>
                      <Button variant="ghost" className="h-11 rounded-xl" onClick={() => setAdjOpen(false)} disabled={busy}>Cancelar</Button>
                    </div>
                  </div>
                )}
                {fullyApproved && <div className="mt-4 flex items-center gap-1.5 text-sm font-body font-semibold text-green-700"><Check className="h-4 w-4" /> Tudo aprovado — obrigada!</div>}
              </>
            )}
          </div>
        </div>
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

  const c = clientQ.data;
  const posts = postsQ.data ?? [];

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card/60 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-5 py-3.5 flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-primary via-purple-600 to-pink-500 p-[2px] shrink-0">
            <div className="w-full h-full rounded-2xl bg-card overflow-hidden flex items-center justify-center">
              {c.client_logo ? <img src={c.client_logo} alt="" className="w-full h-full object-cover" /> : <span className="font-display font-extrabold text-primary">{(c.client_name || "?").charAt(0).toUpperCase()}</span>}
            </div>
          </div>
          <div className="min-w-0"><p className="font-display font-bold text-foreground truncate">{c.client_name}</p>{c.manager_name && <p className="text-xs text-muted-foreground font-body truncate">conteúdo por {c.manager_name}</p>}</div>
          <span className="ml-auto inline-flex items-center gap-1 text-[10px] font-body font-bold text-primary bg-primary/10 px-2 py-1 rounded-full shrink-0"><Sparkles className="h-3 w-3" /> cria post</span>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-5 py-7">
        <div className="text-center mb-7">
          <h1 className="font-display font-extrabold text-foreground text-xl sm:text-2xl">Aprove seus posts</h1>
          <p className="text-sm text-muted-foreground font-body mt-1">Revise o conteúdo e aprove ou peça ajustes.</p>
        </div>

        {postsQ.isLoading ? (
          <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
        ) : posts.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground font-body"><Check className="h-10 w-10 mx-auto mb-3 opacity-40" /><p className="font-medium text-foreground">Tudo em dia!</p><p className="text-sm mt-1">Nenhum post aguardando sua revisão agora.</p></div>
        ) : (
          posts.map((p) => (
            <PostApproval key={p.post_id} client={c} post={p} busy={busy}
              onApproveFast={(id) => approveFast.mutate(id)}
              onAdjustFast={(id, comment) => adjustFast.mutate({ id, comment })}
              onApproveStage={(id, stage) => approveStage.mutate({ id, stage })}
              onAdjustStage={(id, stage, comment) => adjustStage.mutate({ id, stage, comment })} />
          ))
        )}
        <p className="text-center text-[11px] text-muted-foreground font-body pt-6 pb-10">Powered by cria · criasocialclub.com.br</p>
      </main>
    </div>
  );
}
