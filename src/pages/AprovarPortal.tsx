import { Logo } from "@/components/shared/Logo";
import { useEffect, useState, type CSSProperties } from "react";
import { useParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Check, RotateCcw, Loader2, ImageOff, Heart, MessageCircle, Send, Bookmark, Zap, ListChecks, ChevronDown, Clapperboard, CalendarDays, BarChart3, CheckSquare, AlertTriangle } from "lucide-react";
import { hexToHsl } from "@/lib/applyTheme";
import { PostMediaCarousel } from "@/components/shared/PostMediaCarousel";
import { StoryPreview } from "@/components/accounts/StoryPreview";
import { postAspect } from "@/lib/post-aspect";
import { EtapasChecklist, type Stage } from "@/components/aprovar/EtapasChecklist";
import { PortalCalendario } from "@/components/aprovar/PortalCalendario";
import { PortalRelatorio } from "@/components/aprovar/PortalRelatorio";
import { useForceLightTheme } from "@/hooks/useForceLightTheme";

type AnyRpc = (fn: string, args?: Record<string, unknown>) => ReturnType<typeof supabase.rpc>;
const sbRpc = supabase.rpc.bind(supabase) as unknown as AnyRpc;

type MediaItem = {
  provider: string | null; thumbnail_url: string | null; view_url: string | null;
  download_url: string | null; bunny_video_id: string | null; file_type: string | null; file_name: string | null;
};
export type PortalPost = {
  post_id: string; title: string; platform: string; format: string;
  caption: string | null; hook: string | null; script: string | null; content_blocks: unknown;
  approval_mode: "fast" | "flow" | "both"; approval_stages: Record<string, string> | null;
  approval_status: "pendente" | "ajuste_solicitado" | "aprovado";
  scheduled_date: string | null; scheduled_time?: string | null; media: MediaItem[];
  last_comment: string | null; last_comment_role: string | null;
};
type ClientHeader = { client_name: string; client_logo: string | null; manager_name: string | null; brand_color?: string | null; instagram_handle?: string | null };
type PortalSettings = { show_calendar?: boolean; show_report?: boolean };
type PortalTab = "aprovacoes" | "calendario" | "relatorio";

const STATUS: Record<string, { label: string; cls: string }> = {
  pendente: { label: "Aguardando você", cls: "bg-amber-100 text-amber-700" },
  ajuste_solicitado: { label: "Ajuste solicitado", cls: "bg-orange-100 text-orange-700" },
  aprovado: { label: "Aprovado", cls: "bg-green-100 text-green-700" },
};

// Escurece um hex (pct negativo) pra montar o gradiente do hero com a cor da marca.
function shadeHex(hex: string, pct: number): string {
  const clean = hex.replace("#", "");
  if (clean.length !== 6) return hex;
  const f = (i: number) => {
    const v = parseInt(clean.slice(i, i + 2), 16);
    const out = Math.min(255, Math.max(0, Math.round(v * (1 + pct / 100))));
    return out.toString(16).padStart(2, "0");
  };
  return `#${f(0)}${f(2)}${f(4)}`;
}

function CardIG({ client, post }: { client: ClientHeader; post: PortalPost }) {
  const media = Array.isArray(post.media) ? post.media : [];
  // @ do Instagram: usa o handle real quando existe; senão placeholder neutro
  // ("perfil"), NUNCA o nome do cadastro do cliente.
  const handle = client.instagram_handle ? client.instagram_handle.replace(/^@/, "") : "perfil";
  const aspect = postAspect(post.platform, post.format);
  const vertical = aspect === "9 / 16";
  const brand = client.brand_color ?? null;
  // Legenda: no modo "Ambas"/detalhado o texto vai pro campo de conteúdo (script),
  // então caímos nele quando a legenda estiver vazia — senão o cliente não vê nada.
  const legenda = post.caption || post.script || null;
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
          <div className="relative w-full h-full rounded-full bg-white flex items-center justify-center overflow-hidden">
            <span className="text-xs font-extrabold text-primary">{(client.client_name || "?").charAt(0).toUpperCase()}</span>
            {client.client_logo?.trim() && <img src={client.client_logo} alt="" onError={(e) => { e.currentTarget.style.display = "none"; }} className="absolute inset-0 w-full h-full object-cover" />}
          </div>
        </div>
        <div className="min-w-0"><p className="text-[13px] font-bold text-foreground truncate leading-tight">{handle}</p><p className="text-[11px] text-muted-foreground leading-tight">Original audio</p></div>
        <span className="ml-auto text-foreground font-bold tracking-widest">···</span>
      </div>

      {media.length === 0 ? (
        // Placeholder de mídia vazio: fundo com a cor da marca a 8% + aviso amigável.
        <div className="flex flex-col items-center justify-center gap-3"
          style={{ aspectRatio: aspect, background: brand ? `${brand}14` : "hsl(var(--primary) / 0.08)" }}>
          <div className="w-14 h-14 rounded-2xl bg-white/80 shadow-sm flex items-center justify-center">
            <Clapperboard className="h-6 w-6" style={{ color: brand ?? "hsl(var(--primary))" }} />
          </div>
          <p className="text-[13px] font-body font-semibold" style={{ color: brand ?? "hsl(var(--primary))" }}>Mídia em produção</p>
        </div>
      ) : vertical ? (
        <div className="relative">
          <PostMediaCarousel media={media} aspect={aspect} />
          <div className="absolute inset-x-0 bottom-0 h-2/5 bg-gradient-to-t from-black/70 to-transparent pointer-events-none" />
          <div className="absolute right-3 bottom-16 z-10 flex flex-col items-center gap-4 text-white pointer-events-none [filter:drop-shadow(0_1px_2px_rgba(0,0,0,.6))]">
            <Heart className="h-7 w-7" /><MessageCircle className="h-7 w-7" /><Send className="h-7 w-7" /><Bookmark className="h-7 w-7" />
          </div>
          {legenda && (
            <div className="absolute left-3.5 right-16 bottom-3.5 z-10 text-white text-[13px] leading-snug pointer-events-none line-clamp-3 [text-shadow:0_1px_3px_rgba(0,0,0,.6)]">
              <span className="font-bold mr-1.5">{handle}</span>{legenda}
            </div>
          )}
        </div>
      ) : (
        <>
          <PostMediaCarousel media={media} aspect={aspect} />
          <div className="flex items-center gap-4 px-3.5 pt-3 pb-1.5 text-foreground">
            <Heart className="h-6 w-6" /><MessageCircle className="h-6 w-6" /><Send className="h-6 w-6" /><Bookmark className="h-6 w-6 ml-auto" />
          </div>
          {legenda && <p className="px-3.5 pb-4 text-[13.5px] leading-snug text-foreground whitespace-pre-wrap"><span className="font-bold mr-1.5">{handle}</span>{legenda}</p>}
        </>
      )}
    </article>
  );
}

function PostApproval({ client, post, index, busy, onApproveFast, onAdjustFast, onApproveStage, onAdjustStage }: {
  client: ClientHeader; post: PortalPost; index: number; busy: boolean;
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
  const isStory = (post.format || "").toLowerCase() === "story";

  const openAdjust = () => { setAdjOpen(true); setComment(""); };
  const sendFast = () => { onAdjustFast(post.post_id, comment.trim()); setAdjOpen(false); setComment(""); };

  // O painel de aprovação é um só (estado único) e muda de casa via CSS:
  // no mobile fica abaixo do preview, no desktop vira a coluna da direita.
  const panel = (
    <>
      {mode === "both" && (
        <div className="flex bg-muted rounded-2xl p-1.5 mb-5">
          <button onClick={() => setView("fast")} className={`flex-1 flex items-center justify-center gap-1.5 text-sm font-body font-extrabold py-3 rounded-xl transition-colors ${view === "fast" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"}`}><Zap className="h-4 w-4" /> Rápida</button>
          <button onClick={() => setView("flow")} className={`flex-1 flex items-center justify-center gap-1.5 text-sm font-body font-extrabold py-3 rounded-xl transition-colors ${view === "flow" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"}`}><ListChecks className="h-4 w-4" /> Detalhada</button>
        </div>
      )}
      {!showFlow ? (
        <>
          {post.scheduled_date && (
            <div className="flex items-center gap-1.5 text-sm font-display font-bold text-foreground mb-2 capitalize">
              <CalendarDays className="h-4 w-4 text-primary shrink-0" />
              {new Date(post.scheduled_date + "T00:00:00").toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "short" })}
              {post.scheduled_time ? ` · ${String(post.scheduled_time).slice(0, 5)}` : ""}
            </div>
          )}
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
    </>
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: Math.min(index, 6) * 0.06, ease: "easeOut" }}
      className="mb-10 last:mb-0 lg:mb-8"
    >
      {/* Desktop (lg+): card horizontal com preview à esquerda e aprovação à direita.
          Mobile: mantém o feed em coluna, exatamente como antes. */}
      <div className="lg:grid lg:grid-cols-[360px_minmax(0,1fr)] lg:gap-8 lg:items-start lg:bg-white lg:border lg:border-border lg:rounded-3xl lg:p-6 lg:shadow-[0_8px_30px_rgba(27,26,24,0.06)]">
        <div className={`w-full mx-auto lg:mx-0 ${vertical ? "max-w-[330px] lg:max-w-[300px]" : "lg:max-w-[360px]"}`}>
          <CardIG client={client} post={post} />
        </div>
        <div className="min-w-0">
          {/* A legenda já aparece no card do post; sem repetir aqui. */}
          <div className="bg-card border border-border rounded-3xl p-4 sm:p-6 mt-3 shadow-[0_8px_30px_rgba(27,26,24,0.05)] lg:bg-transparent lg:border-0 lg:rounded-none lg:p-0 lg:mt-0 lg:shadow-none">
            {panel}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

export default function AprovarPortal() {
  const { token } = useParams<{ token: string }>();
  const qc = useQueryClient();
  const inv = () => qc.invalidateQueries({ queryKey: ["portal-posts", token] });
  // Página pública: força tema claro (o cliente pode estar no dark do sistema).
  useForceLightTheme();

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
  // Período do link (opcional). Se o social mídia gerou um link "só desse intervalo",
  // o portal mostra apenas os posts agendados dentro dele.
  const periodQ = useQuery({
    queryKey: ["portal-period", token], enabled: !!token,
    queryFn: async () => {
      const { data } = await sbRpc("get_token_period", { _token: token });
      const row = (data as { period_start: string | null; period_end: string | null }[] | null)?.[0];
      return row ?? { period_start: null, period_end: null };
    },
  });
  // Configuração do link feita pela gestora (abas extras do portal). Se a RPC ainda
  // não existir no banco, o portal segue só com a aba de aprovações (retrocompatível).
  const settingsQ = useQuery({
    queryKey: ["portal-settings", token], enabled: !!token,
    queryFn: async (): Promise<PortalSettings> => {
      const { data, error } = await sbRpc("get_portal_settings", { _token: token });
      if (error) return {};
      const row = (data as { settings: PortalSettings | null }[] | null)?.[0];
      return row?.settings ?? {};
    },
  });
  const postsQ = useQuery({
    queryKey: ["portal-posts", token, periodQ.data?.period_start, periodQ.data?.period_end],
    enabled: !!token && !!clientQ.data && !periodQ.isLoading,
    queryFn: async () => {
      const { data, error } = await sbRpc("list_posts_by_token", { _token: token });
      if (error) throw error;
      const all = (data as PortalPost[]) ?? [];
      const ps = periodQ.data?.period_start; const pe = periodQ.data?.period_end;
      if (!ps || !pe) return all;                       // sem período = tudo
      return all.filter((p) => !!p.scheduled_date && p.scheduled_date >= ps && p.scheduled_date <= pe);
    },
  });

  const approveFast = useMutation({ mutationFn: async (id: string) => { const { error } = await sbRpc("approve_post_by_token", { _token: token, _post_id: id }); if (error) throw error; }, onSuccess: () => { toast.success("Aprovado!"); inv(); }, onError: () => toast.error("Não foi possível aprovar.") });
  const adjustFast = useMutation({ mutationFn: async ({ id, comment }: { id: string; comment: string }) => { const { error } = await sbRpc("request_adjustment_by_token", { _token: token, _post_id: id, _comment: comment }); if (error) throw error; }, onSuccess: () => { toast.success("Ajuste enviado!"); inv(); }, onError: () => toast.error("Não foi possível enviar.") });
  const approveStage = useMutation({ mutationFn: async ({ id, stage }: { id: string; stage: Stage }) => { const { error } = await sbRpc("approve_stage_by_token", { _token: token, _post_id: id, _stage: stage }); if (error) throw error; }, onSuccess: () => { toast.success("Etapa aprovada!"); inv(); }, onError: () => toast.error("Não foi possível aprovar.") });
  const adjustStage = useMutation({ mutationFn: async ({ id, stage, comment }: { id: string; stage: Stage; comment: string }) => { const { error } = await sbRpc("request_stage_adjustment_by_token", { _token: token, _post_id: id, _stage: stage, _comment: comment }); if (error) throw error; }, onSuccess: () => { toast.success("Ajuste enviado!"); inv(); }, onError: () => toast.error("Não foi possível enviar.") });

  // Qual post está em ação AGORA. Só ele trava; os outros seguem clicáveis.
  let pendingId: string | null = null;
  if (approveFast.isPending && approveFast.variables) {
    pendingId = approveFast.variables;
  } else if (adjustFast.isPending && adjustFast.variables) {
    pendingId = adjustFast.variables.id;
  } else if (approveStage.isPending && approveStage.variables) {
    pendingId = approveStage.variables.id;
  } else if (adjustStage.isPending && adjustStage.variables) {
    pendingId = adjustStage.variables.id;
  }

  const [showApproved, setShowApproved] = useState(false);
  const [tab, setTab] = useState<PortalTab>("aprovacoes");

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
  const brand = c.brand_color ?? null;
  // Cor da marca do cliente vira o accent local da página (CSS vars no wrapper).
  const brandVars = (brand
    ? { "--primary": hexToHsl(brand), "--ring": hexToHsl(brand) }
    : {}) as CSSProperties;
  const heroBg = brand
    ? `linear-gradient(130deg, ${brand} 0%, ${shadeHex(brand, -32)} 100%)`
    : "linear-gradient(130deg, hsl(var(--primary)) 0%, hsl(var(--primary) / 0.75) 100%)";

  const settings = settingsQ.data ?? {};
  const tabs: { key: PortalTab; label: string; icon: typeof CheckSquare }[] = [
    { key: "aprovacoes", label: "Aprovações", icon: CheckSquare },
    ...(settings.show_calendar ? [{ key: "calendario" as const, label: "Calendário", icon: CalendarDays }] : []),
    ...(settings.show_report ? [{ key: "relatorio" as const, label: "Relatório", icon: BarChart3 }] : []),
  ];
  const activeTab: PortalTab = tabs.some((t) => t.key === tab) ? tab : "aprovacoes";

  const renderPost = (p: PortalPost, i: number) => (
    <PostApproval key={p.post_id} client={c} post={p} index={i} busy={pendingId === p.post_id}
      onApproveFast={(id) => approveFast.mutate(id)}
      onAdjustFast={(id, comment) => adjustFast.mutate({ id, comment })}
      onApproveStage={(id, stage) => approveStage.mutate({ id, stage })}
      onAdjustStage={(id, stage, comment) => adjustStage.mutate({ id, stage, comment })} />
  );

  const tabBar = (variant: "mobile" | "desktop") =>
    tabs.length > 1 && (
      <div className={variant === "mobile"
        ? "flex bg-muted/70 rounded-2xl p-1 mx-4 mb-2.5"
        : "inline-flex bg-white border border-border rounded-2xl p-1.5 shadow-[0_4px_20px_rgba(27,26,24,0.06)]"}>
        {tabs.map((t) => {
          const on = activeTab === t.key;
          const Icon = t.icon;
          return (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`flex-1 lg:flex-none flex items-center justify-center gap-1.5 text-[13px] font-body font-extrabold rounded-xl transition-colors ${variant === "mobile" ? "py-2" : "px-5 py-2.5"} ${on ? "bg-white text-primary shadow-sm lg:bg-primary/10" : "text-muted-foreground hover:text-foreground"}`}>
              <Icon className="h-4 w-4" /> {t.label}
            </button>
          );
        })}
      </div>
    );

  return (
    <div className="min-h-screen bg-background" style={brandVars}>
      {/* ── Header mobile: barra compacta e fixa (como sempre foi) ── */}
      <header className="lg:hidden border-b border-border bg-card/80 backdrop-blur-md sticky top-0 z-20">
        <div className="max-w-md mx-auto px-4 py-3 flex items-center gap-3">
          <div className="relative w-10 h-10 rounded-full bg-primary/10 ring-2 ring-primary/25 overflow-hidden flex items-center justify-center shrink-0">
            <span className="font-display font-extrabold text-primary">{(c.client_name || "?").charAt(0).toUpperCase()}</span>
            {c.client_logo?.trim() && <img src={c.client_logo} alt="" onError={(e) => { e.currentTarget.style.display = "none"; }} className="absolute inset-0 w-full h-full object-cover" />}
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
        {tabBar("mobile")}
        <div className="h-1 bg-primary/10">
          <div className="h-full bg-primary transition-all duration-500" style={{ width: total ? `${(aprovados.length / total) * 100}%` : "0%" }} />
        </div>
      </header>

      {/* ── Hero desktop: faixa com a cor da marca do cliente ── */}
      <div className="hidden lg:block" style={{ background: heroBg }}>
        <div className="max-w-5xl mx-auto px-8 pt-12 pb-10">
          <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45, ease: "easeOut" }} className="flex items-center gap-6">
            <div className="relative w-20 h-20 rounded-3xl bg-white shadow-lg overflow-hidden flex items-center justify-center shrink-0">
              <span className="font-display font-extrabold text-3xl" style={{ color: brand ?? "hsl(var(--primary))" }}>{(c.client_name || "?").charAt(0).toUpperCase()}</span>
              {c.client_logo?.trim() && <img src={c.client_logo} alt="" onError={(e) => { e.currentTarget.style.display = "none"; }} className="absolute inset-0 w-full h-full object-cover" />}
            </div>
            <div className="min-w-0 flex-1">
              <h1 className="font-display font-extrabold text-white text-3xl tracking-tight truncate">{c.client_name}</h1>
              {c.manager_name && <p className="text-sm text-white/80 font-body mt-0.5">conteúdo por {c.manager_name}</p>}
            </div>
            {total > 0 && (
              <div className="text-right shrink-0">
                <p className="text-3xl font-display font-extrabold text-white leading-tight">{aprovados.length}<span className="text-white/60 text-xl"> de {total}</span></p>
                <p className="text-[11px] text-white/80 font-body uppercase tracking-wider">posts aprovados</p>
              </div>
            )}
          </motion.div>
          {total > 0 && (
            <div className="mt-6 h-1.5 rounded-full bg-white/25 overflow-hidden">
              <motion.div initial={{ width: 0 }} animate={{ width: total ? `${(aprovados.length / total) * 100}%` : "0%" }} transition={{ duration: 0.7, ease: "easeOut" }} className="h-full rounded-full bg-white" />
            </div>
          )}
        </div>
      </div>

      {/* ── Abas desktop ── */}
      {tabs.length > 1 && (
        <div className="hidden lg:flex justify-center sticky top-0 z-20 -mt-6 pb-2">
          {tabBar("desktop")}
        </div>
      )}

      <main className={`mx-auto px-4 py-6 ${activeTab === "aprovacoes" ? "max-w-md lg:max-w-5xl lg:px-8 lg:py-10" : "max-w-md lg:max-w-4xl lg:px-8 lg:py-10"}`}>
        <AnimatePresence mode="wait">
          <motion.div key={activeTab} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2, ease: "easeOut" }}>
            {activeTab === "calendario" ? (
              <PortalCalendario posts={posts} brand={brand} />
            ) : activeTab === "relatorio" ? (
              <PortalRelatorio posts={posts} client={{ name: c.client_name, logo: c.client_logo, manager: c.manager_name }} brand={brand}
                periodStart={periodQ.data?.period_start ?? null} periodEnd={periodQ.data?.period_end ?? null} />
            ) : (
              <>
                <div className="text-center mb-6 lg:mb-10">
                  <h1 className="font-display font-extrabold text-foreground text-xl lg:text-2xl">Aprove seus posts</h1>
                  <p className="text-sm text-muted-foreground font-body mt-1">Revise o conteúdo e aprove ou peça ajustes.</p>
                </div>

                {postsQ.isLoading ? (
                  <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
                ) : postsQ.isError ? (
                  <div className="text-center py-16">
                    <div className="w-14 h-14 rounded-2xl bg-amber-100 flex items-center justify-center mx-auto mb-4"><AlertTriangle className="h-6 w-6 text-amber-600" /></div>
                    <p className="font-display font-bold text-foreground text-lg">Não consegui carregar seus posts</p>
                    <p className="text-sm text-muted-foreground font-body mt-1 mb-5">Parece que a conexão falhou. Verifique sua internet e tente de novo.</p>
                    <Button onClick={() => postsQ.refetch()} disabled={postsQ.isFetching}>
                      {postsQ.isFetching ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RotateCcw className="h-4 w-4 mr-2" />} Tentar de novo
                    </Button>
                  </div>
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
                      <section className="mt-2 lg:mt-6">
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
              </>
            )}
          </motion.div>
        </AnimatePresence>
        {/* Crédito de rodapé com a logo de verdade (esta página o CLIENTE vê). */}
        <div className="flex items-center justify-center gap-1.5 pt-8 pb-10">
          <span className="text-[11px] text-muted-foreground font-body">Feito com</span>
          <Logo className="h-3.5 w-auto opacity-80" />
        </div>
      </main>
    </div>
  );
}
