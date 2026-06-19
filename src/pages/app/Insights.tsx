import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  Instagram, Users, Eye, Zap, UserPlus, RefreshCw, Unplug, Link2, Bookmark, Heart, Play, Image as ImageIcon, Images, Sparkles, Info, TrendingUp, BarChart3,
} from "lucide-react";
import { LineChart, Line, BarChart, Bar, XAxis, Tooltip, ResponsiveContainer } from "recharts";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  useSocialConnection, useDailyMetrics, useMediaInsights, useSyncInstagram, useDisconnectInstagram, useLinkMediaToPost,
  connectInstagram, type MediaInsight,
} from "@/hooks/useSocialInsights";

type AnyTable = (table: string) => ReturnType<typeof supabase.from>;
const sbFrom = supabase.from.bind(supabase) as unknown as AnyTable;

const fmt = (n: number | null | undefined) =>
  n == null ? "—" : n >= 1000 ? `${(n / 1000).toFixed(1).replace(".0", "")}k` : String(n);
const m = (mi: MediaInsight, k: string) => Number(mi.metrics?.[k] ?? 0);
const MEDIA_ICON = (t: string | null) => (t === "VIDEO" || t === "REELS" ? Play : t === "CAROUSEL_ALBUM" ? Images : ImageIcon);
const MEDIA_LABEL: Record<string, string> = { IMAGE: "Imagem", VIDEO: "Vídeo", REELS: "Reels", CAROUSEL_ALBUM: "Carrossel" };
const fmtType = (t: string | null) => (t ? MEDIA_LABEL[t] ?? t : "—");
const isVideo = (t: string | null) => t === "VIDEO" || t === "REELS";

export default function Insights() {
  const { data: conn, isLoading } = useSocialConnection();
  const { data: daily = [] } = useDailyMetrics(30);
  const { data: media = [] } = useMediaInsights();
  const sync = useSyncInstagram();
  const disconnect = useDisconnectInstagram();
  const link = useLinkMediaToPost();
  const [linkFor, setLinkFor] = useState<MediaInsight | null>(null);

  const kpis = useMemo(() => {
    const last = daily[daily.length - 1];
    const first = daily[0];
    // Alcance e interações somados dos posts (dado confiável da API por mídia)
    const reach = media.reduce((a, mi) => a + m(mi, "reach"), 0);
    const interactions = media.reduce((a, mi) => a + m(mi, "likes") + m(mi, "comments") + m(mi, "saved") + m(mi, "shares"), 0);
    if (!last && media.length === 0) return null;
    return {
      followers: last?.followers ?? null,
      followersDelta: (last?.followers ?? 0) - (first?.followers ?? 0),
      reach, interactions, profileViews: last?.profile_views ?? null,
    };
  }, [daily, media]);

  if (isLoading) return <div className="p-8 text-sm text-muted-foreground">Carregando…</div>;

  // ---- Desconectado ----
  if (!conn) {
    return (
      <div className="max-w-2xl">
        <div className="flex items-center gap-3 mb-6 md:hidden">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-fuchsia-500 to-purple-600 flex items-center justify-center shadow-sm shrink-0">
            <Instagram className="h-5 w-5 text-white" strokeWidth={1.75} />
          </div>
          <div>
            <h1 className="text-3xl font-display font-extrabold text-foreground tracking-tight">Insights</h1>
            <p className="text-muted-foreground font-body mt-0.5 text-sm">Métricas reais do seu Instagram.</p>
          </div>
        </div>
        <div className="bg-card border border-border rounded-2xl p-6 flex flex-col sm:flex-row items-start sm:items-center gap-5">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#F58529] via-[#DD2A7B] to-[#515BD4] grid place-items-center shrink-0">
            <Instagram className="h-7 w-7 text-white" />
          </div>
          <div className="flex-1">
            <h3 className="font-display font-bold text-foreground">Conecte seu Instagram</h3>
            <p className="text-sm text-muted-foreground font-body mt-1">
              Conta <b>Business</b> ou <b>Creator</b>. Puxamos alcance, seguidores e desempenho dos posts — só leitura, o CRIA não publica nada por você.
            </p>
          </div>
          <Button onClick={connectInstagram} className="gap-2 shrink-0 bg-gradient-to-r from-[#DD2A7B] to-[#8134AF] text-white hover:opacity-90">
            <Instagram className="h-4 w-4" /> Conectar
          </Button>
        </div>
      </div>
    );
  }

  // ---- Conectado ----
  const lastSync = conn.updated_at ? new Date(conn.updated_at).toLocaleString("pt-BR") : "—";
  const followerSeries = daily.filter((d) => d.followers != null).map((d) => ({ date: d.date.slice(5), v: d.followers ?? 0 }));
  const reachSeries = daily.filter((d) => d.reach != null).map((d) => ({ date: d.date.slice(5), v: d.reach ?? 0 }));

  // Drivers (proxies honestos a partir do que a API entrega)
  const byReach = [...media].sort((a, b) => m(b, "reach") - m(a, "reach"));
  const bySaves = [...media].sort((a, b) => (m(b, "saved") + m(b, "saves")) - (m(a, "saved") + m(a, "saves")));
  const fmtAvgReach: Record<string, { sum: number; n: number }> = {};
  media.forEach((mi) => {
    const t = mi.media_type ?? "—";
    fmtAvgReach[t] = fmtAvgReach[t] || { sum: 0, n: 0 };
    fmtAvgReach[t].sum += m(mi, "reach"); fmtAvgReach[t].n += 1;
  });
  const bestFormat = Object.entries(fmtAvgReach).map(([t, v]) => ({ t, avg: v.n ? v.sum / v.n : 0 })).sort((a, b) => b.avg - a.avg)[0];

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
      <div className="flex items-center gap-3 mb-6 md:hidden">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-fuchsia-500 to-purple-600 flex items-center justify-center shadow-sm shrink-0">
          <Instagram className="h-5 w-5 text-white" strokeWidth={1.75} />
        </div>
        <div>
          <h1 className="text-3xl font-display font-extrabold text-foreground tracking-tight">Insights</h1>
          <p className="text-muted-foreground font-body mt-0.5 text-sm">Métricas reais do seu Instagram.</p>
        </div>
      </div>

      {/* barra da conta */}
      <div className="bg-card border border-border rounded-2xl px-4 py-3 flex items-center gap-3 flex-wrap">
        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#F58529] via-[#DD2A7B] to-[#515BD4] grid place-items-center text-white font-bold shrink-0">
          {(conn.username ?? "?").charAt(0).toUpperCase()}
        </div>
        <div className="min-w-0">
          <p className="font-display font-bold text-sm">{conn.username ? `@${conn.username}` : "Conta conectada"}</p>
          <p className="text-xs text-muted-foreground flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-green-500" /> Conectado{conn.account_type ? ` · ${conn.account_type}` : ""}
          </p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <span className="text-xs text-muted-foreground hidden sm:inline">Atualizado {lastSync}</span>
          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => sync.mutate()} disabled={sync.isPending}>
            <RefreshCw className={`h-3.5 w-3.5 ${sync.isPending ? "animate-spin" : ""}`} /> Atualizar
          </Button>
          <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground" onClick={() => disconnect.mutate()}>
            <Unplug className="h-3.5 w-3.5" /> Desconectar
          </Button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-3">
        <Kpi icon={Users} label="Seguidores" value={fmt(kpis?.followers)} delta={kpis ? `${kpis.followersDelta >= 0 ? "▲" : "▼"} ${Math.abs(kpis.followersDelta)} (30d)` : undefined} up={(kpis?.followersDelta ?? 0) >= 0} />
        <Kpi icon={Eye} label="Alcance (30d)" value={fmt(kpis?.reach)} />
        <Kpi icon={Zap} label="Interações (30d)" value={fmt(kpis?.interactions)} />
        <Kpi icon={UserPlus} label="Visitas ao perfil" value={fmt(kpis?.profileViews)} />
      </div>

      {/* gráficos */}
      {(reachSeries.length > 1 || followerSeries.length > 1) ? (
        <div className="grid md:grid-cols-2 gap-3 mt-3">
          <div className="bg-card border border-border rounded-2xl p-4">
            <h4 className="text-sm font-bold">Alcance · 30 dias</h4>
            {reachSeries.length > 1 ? (
              <div className="h-[140px] mt-3">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={reachSeries}>
                    <XAxis dataKey="date" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
                    <Tooltip />
                    <Bar dataKey="v" fill="#C4B5F5" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : <p className="text-xs text-muted-foreground mt-3">Sem série de alcance ainda.</p>}
          </div>
          <div className="bg-card border border-border rounded-2xl p-4">
            <h4 className="text-sm font-bold">Seguidores · 30 dias</h4>
            {followerSeries.length > 1 ? (
              <div className="h-[140px] mt-3">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={followerSeries}>
                    <XAxis dataKey="date" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
                    <Tooltip />
                    <Line type="monotone" dataKey="v" stroke="#8B5CF6" strokeWidth={2.5} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            ) : <p className="text-xs text-muted-foreground mt-3">Preenche conforme acompanhamos sua conta dia a dia (o Instagram não devolve histórico de total de seguidores).</p>}
          </div>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground mt-4">Os gráficos aparecem conforme acumulamos métricas diárias. O de alcance preenche assim que o Instagram devolver o histórico.</p>
      )}

      {/* drivers */}
      {media.length > 0 && (
        <>
          <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mt-7 mb-3 flex items-center gap-2">
            O que mais gerou crescimento <span className="text-[10px] font-extrabold text-primary bg-primary/10 px-2 py-0.5 rounded-full">IA</span>
          </h2>
          <div className="grid sm:grid-cols-3 gap-3">
            <Driver icon={Eye} t="Mais alcance" big={byReach[0]?.caption?.slice(0, 40) ?? "—"} s={`${fmt(m(byReach[0], "reach"))} de alcance`} />
            <Driver icon={Bookmark} t="Mais salvos" big={bySaves[0]?.caption?.slice(0, 40) ?? "—"} s={`${fmt(m(bySaves[0], "saved") + m(bySaves[0], "saves"))} salvos`} />
            <Driver icon={BarChart3} t="Melhor formato" big={fmtType(bestFormat?.t ?? null)} s={`média de ${fmt(Math.round(bestFormat?.avg ?? 0))} de alcance`} />
          </div>
        </>
      )}

      {/* posts + vínculo manual */}
      <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mt-7 mb-3">Posts · vincule ao conteúdo do CRIA</h2>
      {media.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhum post coletado ainda. Clique em “Atualizar” após conectar.</p>
      ) : (
        <div className="grid md:grid-cols-2 gap-3">
          {media.map((mi) => {
            const MI = MEDIA_ICON(mi.media_type);
            return (
              <div key={mi.id} className="bg-card border border-border rounded-2xl p-3 flex gap-3">
                <div className="w-[74px] h-[74px] rounded-xl shrink-0 grid place-items-center bg-muted overflow-hidden">
                  {mi.thumbnail_url ? <img src={mi.thumbnail_url} alt="" className="w-full h-full object-cover" /> : <MI className="h-6 w-6 text-muted-foreground" />}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[12.5px] leading-snug line-clamp-2">{mi.caption || "(sem legenda)"}</p>
                  <div className="flex flex-wrap gap-3 mt-1.5 text-[11px] text-muted-foreground">
                    <span className="flex items-center gap-1"><Eye className="h-3 w-3" /> {fmt(m(mi, "reach"))}</span>
                    <span className="flex items-center gap-1"><Heart className="h-3 w-3" /> {fmt(m(mi, "likes"))}</span>
                    <span className="flex items-center gap-1"><Bookmark className="h-3 w-3" /> {fmt(m(mi, "saved") + m(mi, "saves"))}</span>
                    {isVideo(mi.media_type) && (m(mi, "views") + m(mi, "plays")) > 0 && (
                      <span className="flex items-center gap-1"><Play className="h-3 w-3" /> {fmt(m(mi, "views") + m(mi, "plays"))}</span>
                    )}
                  </div>
                  <div className="mt-2">
                    {mi.post_id && mi.posts ? (
                      <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-primary bg-primary/10 px-2.5 py-1 rounded-full">
                        <Link2 className="h-3 w-3" /> {[mi.posts.format, mi.posts.hook].filter(Boolean).join(" · ") || mi.posts.title || "Vinculado"}
                      </span>
                    ) : (
                      <button onClick={() => setLinkFor(mi)} className="inline-flex items-center gap-1.5 text-[11px] font-bold text-muted-foreground bg-background border border-dashed border-border px-2.5 py-1 rounded-full hover:border-primary/40 hover:text-primary">
                        <Link2 className="h-3 w-3" /> Vincular ao conteúdo do CRIA
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* leitura IA */}
      {media.length > 0 && bestFormat && (
        <div className="bg-card border border-border rounded-2xl p-4 mt-4">
          <h4 className="text-sm font-extrabold flex items-center gap-2"><Sparkles className="h-4 w-4 text-primary" /> Leitura da IA</h4>
          <ul className="mt-2.5 space-y-2 text-[13px]">
            <li className="flex gap-2"><TrendingUp className="h-4 w-4 text-green-600 shrink-0 mt-0.5" /><span>Seu formato <b>{bestFormat.t}</b> tem o maior alcance médio. Vale priorizar.</span></li>
            <li className="flex gap-2"><TrendingUp className="h-4 w-4 text-green-600 shrink-0 mt-0.5" /><span>Vincule mais posts ao conteúdo do CRIA pra cruzar roteiro, legenda e hook com o desempenho.</span></li>
          </ul>
          <p className="text-[11.5px] text-muted-foreground mt-3 flex gap-2"><Info className="h-3.5 w-3.5 shrink-0 mt-0.5" /><span>“Seguidores por post” é estimativa (cruza a data do post com a variação diária). Alcance, salvos e interações são dados diretos da API do Instagram.</span></p>
        </div>
      )}

      <LinkDialog insight={linkFor} onClose={() => setLinkFor(null)} onPick={(postId) => { if (linkFor) link.mutate({ insightId: linkFor.id, postId }); setLinkFor(null); }} />
    </motion.div>
  );
}

function Kpi({ icon: Icon, label, value, delta, up }: { icon: typeof Users; label: string; value: string; delta?: string; up?: boolean }) {
  return (
    <div className="bg-card border border-border rounded-2xl p-4">
      <div className="text-[11px] text-muted-foreground font-semibold flex items-center gap-1.5"><Icon className="h-3.5 w-3.5 text-primary" /> {label}</div>
      <div className="text-2xl font-display font-extrabold mt-1.5">{value}</div>
      {delta && <div className={`text-[11px] font-bold mt-0.5 ${up ? "text-green-600" : "text-red-600"}`}>{delta}</div>}
    </div>
  );
}

function Driver({ icon: Icon, t, big, s }: { icon: typeof Users; t: string; big: string; s: string }) {
  return (
    <div className="bg-card border border-border rounded-2xl p-4">
      <div className="text-[11px] text-muted-foreground font-bold uppercase tracking-wider flex items-center gap-1.5"><Icon className="h-3.5 w-3.5 text-primary" /> {t}</div>
      <div className="text-sm font-extrabold mt-2 leading-tight">{big}</div>
      <div className="text-xs text-muted-foreground mt-1">{s}</div>
    </div>
  );
}

// Dialog de vínculo manual: lista posts do CRIA pra ligar à mídia.
function LinkDialog({ insight, onClose, onPick }: { insight: MediaInsight | null; onClose: () => void; onPick: (postId: string) => void }) {
  const { user } = useAuth();
  const { data: posts = [] } = useQuery<{ id: string; title: string; format: string | null; published_at: string | null }[]>({
    queryKey: ["link-posts", user?.id],
    enabled: !!user?.id && !!insight,
    queryFn: async () => {
      const { data, error } = await sbFrom("posts")
        .select("id,title,format,published_at")
        .eq("user_id", user!.id)
        .order("published_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return (data ?? []) as unknown as { id: string; title: string; format: string | null; published_at: string | null }[];
    },
  });

  return (
    <Dialog open={!!insight} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md max-h-[80vh] overflow-y-auto">
        <DialogHeader><DialogTitle className="font-display">Vincular ao conteúdo do CRIA</DialogTitle></DialogHeader>
        <p className="text-xs text-muted-foreground -mt-1">Escolha o post do CRIA que originou esta publicação. Isso permite cruzar roteiro, legenda e hook com o desempenho.</p>
        <div className="mt-3 space-y-1.5">
          {posts.length === 0 && <p className="text-sm text-muted-foreground">Nenhum post encontrado.</p>}
          {posts.map((p) => (
            <button key={p.id} onClick={() => onPick(p.id)}
              className="w-full text-left px-3 py-2.5 rounded-xl border border-border hover:border-primary/40 hover:bg-primary/5 transition-colors">
              <span className="text-sm font-medium block truncate">{p.title || "(sem título)"}</span>
              <span className="text-[11px] text-muted-foreground">{[p.format, p.published_at?.slice(0, 10)].filter(Boolean).join(" · ")}</span>
            </button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
