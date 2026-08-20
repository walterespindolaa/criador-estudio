import { useMemo, useState } from "react";
import { Instagram, Heart, MessageCircle, Eye, Bookmark, Users, Play, Image as ImageIcon, Images, ExternalLink, RefreshCw, Zap, Link2, Layers, TrendingUp, X, Check, Loader2, CalendarDays } from "lucide-react";
import { toast } from "sonner";
import {
  useCriaClientInstagram, useLinkClientMedia, type CriaClientIgMedia, type CriaClientIgDaily,
  useManagedClientInstagram, useLinkManagedMedia, useSyncManagedInstagram,
} from "@/hooks/useManagerClientCria";
import { connectInstagram } from "@/hooks/useSocialInsights";
import { useExternalPosts } from "@/hooks/useCriaPost";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { AudienceBreakdown } from "@/components/insights/AudienceBreakdown";
import { StoriesSummary } from "@/components/insights/StoriesSummary";
import { ReelsRanking } from "@/components/insights/ReelsRanking";
import { ContentCrossAnalysis } from "@/components/insights/ContentCrossAnalysis";
import type { CrossItem } from "@/components/insights/insightsUtils";

// Aba Instagram da ficha do cliente que USA O CRIA: mostra os dados que o pipeline
// do próprio cliente já sincronizou (social_metrics_daily + social_insights), em
// modo leitura. Aqui o social mídia também VINCULA cada publicação ao post que ele
// fez no Cria Post, pra cruzar o resultado real com o que foi produzido.

const fmt = (n: number | null | undefined) =>
  n == null ? "-" : n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1).replace(".0", "")}M` : n >= 1000 ? `${(n / 1000).toFixed(1).replace(".0", "")}k` : String(n);
const m = (mi: CriaClientIgMedia, k: string) => Number(mi.metrics?.[k] ?? 0);
const interactionsOf = (mi: CriaClientIgMedia) => m(mi, "likes") + m(mi, "comments") + m(mi, "saved") + m(mi, "saves") + m(mi, "shares");
const engOf = (mi: CriaClientIgMedia) => { const r = m(mi, "reach"); return r > 0 ? (interactionsOf(mi) / r) * 100 : 0; };
const MEDIA_ICON = (t: string | null) => (t === "VIDEO" || t === "REELS" ? Play : t === "CAROUSEL_ALBUM" ? Images : ImageIcon);
const MEDIA_LABEL: Record<string, string> = { IMAGE: "Foto", VIDEO: "Vídeo", REELS: "Reels", CAROUSEL_ALBUM: "Carrossel" };
const dataBR = (s: string | null) => (s ? new Date(s).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" }) : null);

// DOIS MODOS, um painel só:
// - criaOwnerId: cliente que USA o Cria (dados sincronizados por ele, via RPC);
// - crmClientId: cliente SEM Cria cuja conta a social mídia conectou aqui
//   (social_connections com crm_client_id; ela mesma sincroniza e vincula).
export function ClienteInstagramCria({ criaOwnerId, crmClientId, clientName, extClientId }: { criaOwnerId?: string | null; crmClientId?: string | null; clientName?: string; extClientId?: string | null }) {
  const gerenciado = !criaOwnerId && !!crmClientId;
  const criaQ = useCriaClientInstagram(criaOwnerId ?? null);
  const managedQ = useManagedClientInstagram(gerenciado ? crmClientId : null);
  const { data, isLoading, isError } = gerenciado ? managedQ : criaQ;
  const { posts: criaPosts } = useExternalPosts(extClientId ?? null);
  const linkCria = useLinkClientMedia(criaOwnerId ?? null);
  const linkManaged = useLinkManagedMedia(gerenciado ? crmClientId : null);
  const link = gerenciado ? linkManaged : linkCria;
  const syncManaged = useSyncManagedInstagram(gerenciado ? crmClientId : null);
  const [linkingMedia, setLinkingMedia] = useState<CriaClientIgMedia | null>(null);

  const atualizarAgora = async () => {
    try {
      const r = await syncManaged.mutateAsync();
      if (r?.reconnect) toast.warning("A conexão com o Instagram expirou. Reconecte a conta do cliente.", { duration: 10000 });
      else toast.success("Insights do cliente atualizados!");
    } catch { toast.error("Não consegui atualizar agora."); }
  };

  // Mapa post_id -> post do Cria (pra badge "Feito no Cria" e análise por formato).
  const postById = useMemo(() => {
    const mm: Record<string, { title: string; format: string; hook: string | null }> = {};
    criaPosts.forEach((p) => { mm[p.id] = { title: p.title, format: p.format, hook: p.hook }; });
    return mm;
  }, [criaPosts]);

  // ── FILTRO DE PERÍODO ──
  // O painel mostrava sempre "tudo que veio". A Gabriela quer olhar o mês
  // passado, os últimos 7 dias etc. O recorte vale pra TUDO: KPIs, formatos,
  // destaques, cruzamentos e a análise por post. Detalhe honesto: a série de
  // seguidores nasce no dia em que a conta foi conectada (o Instagram não
  // entrega histórico retroativo de seguidores), então períodos anteriores à
  // conexão só têm os POSTS, não a linha de seguidores.
  type PeriodoKey = "7d" | "30d" | "90d" | "mes-passado" | "este-mes";
  const [periodo, setPeriodo] = useState<PeriodoKey>("30d");
  const range = useMemo(() => {
    const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
    const amanha = new Date(hoje); amanha.setDate(amanha.getDate() + 1);
    if (periodo === "este-mes") return { de: new Date(hoje.getFullYear(), hoje.getMonth(), 1), ate: amanha };
    if (periodo === "mes-passado") return { de: new Date(hoje.getFullYear(), hoje.getMonth() - 1, 1), ate: new Date(hoje.getFullYear(), hoje.getMonth(), 1) };
    const dias = periodo === "7d" ? 7 : periodo === "30d" ? 30 : 90;
    const de = new Date(hoje); de.setDate(de.getDate() - (dias - 1));
    return { de, ate: amanha };
  }, [periodo]);
  const noRange = (iso: string | null | undefined) => {
    if (!iso) return false;
    const t = new Date(iso).getTime();
    return t >= range.de.getTime() && t < range.ate.getTime();
  };
  const PERIODOS: Array<[PeriodoKey, string]> = [
    ["7d", "7 dias"], ["30d", "30 dias"], ["90d", "90 dias"], ["mes-passado", "Mês passado"], ["este-mes", "Este mês"],
  ];

  const mediaTotal = data?.media ?? [];
  const media = useMemo(() => mediaTotal.filter((mi) => noRange(mi.posted_at)), [mediaTotal, range]); // eslint-disable-line react-hooks/exhaustive-deps
  const dailyPeriodo = useMemo(
    () => (data?.daily ?? []).filter((d) => noRange(d.date + "T12:00:00")),
    [data?.daily, range], // eslint-disable-line react-hooks/exhaustive-deps
  );
  const storiesPeriodo = useMemo(
    () => (data?.stories ?? []).filter((st) => noRange(st.posted_at)),
    [data?.stories, range], // eslint-disable-line react-hooks/exhaustive-deps
  );

  const kpis = useMemo(() => {
    if (!data?.connected) return null;
    const daily = dailyPeriodo;
    const withFollowers = daily.filter((d) => d.followers != null);
    const followers = withFollowers.length ? withFollowers[withFollowers.length - 1].followers : null;
    const followersDelta = withFollowers.length > 1
      ? (withFollowers[withFollowers.length - 1].followers ?? 0) - (withFollowers[0].followers ?? 0)
      : 0;
    const reach = media.reduce((a, mi) => a + m(mi, "reach"), 0);
    const interactions = media.reduce((a, mi) => a + interactionsOf(mi), 0);
    const eng = reach > 0 ? (interactions / reach) * 100 : 0;
    return { followers, followersDelta, reach, interactions, eng };
  }, [data, media, dailyPeriodo]);

  // Alcance médio por formato direto do tipo da mídia do IG (não depende de vínculo).
  const fmtLabel = (t: string | null) => (t === "VIDEO" || t === "REELS" ? "Reels" : t === "CAROUSEL_ALBUM" ? "Carrossel" : t === "IMAGE" ? "Foto" : "Outro");
  const porFormato = useMemo(() => {
    const acc: Record<string, { soma: number; n: number }> = {};
    media.forEach((mi) => {
      const f = fmtLabel(mi.media_type);
      acc[f] = acc[f] ?? { soma: 0, n: 0 };
      acc[f].soma += m(mi, "reach"); acc[f].n += 1;
    });
    const rows = Object.entries(acc).map(([f, v]) => ({ f, media: Math.round(v.soma / v.n), n: v.n }));
    rows.sort((a, b) => b.media - a.media);
    return { rows, max: rows.length ? rows[0].media : 0 };
  }, [media]);

  // Destaques: melhor alcance, melhor engajamento e pior alcance do período.
  const destaques = useMemo(() => {
    if (!media.length) return null;
    const comReach = media.filter((mi) => m(mi, "reach") > 0);
    const best = [...media].sort((a, b) => m(b, "reach") - m(a, "reach"))[0];
    const bestEng = [...media].sort((a, b) => engOf(b) - engOf(a))[0];
    const worst = comReach.length > 1 ? [...comReach].sort((a, b) => m(a, "reach") - m(b, "reach"))[0] : null;
    return { best, bestEng, worst };
  }, [media]);

  const vinculados = media.filter((mi) => mi.post_id && postById[mi.post_id!]).length;

  // Cruzamentos pro direcionamento: formato/dia/horário (sempre) + hook do post do
  // Cria vinculado (quando houver). Pilar não vem no feed do cliente, fica de fora.
  const crossItems = useMemo<CrossItem[]>(() =>
    media.map((mi) => ({
      media_type: mi.media_type,
      posted_at: mi.posted_at,
      reach: m(mi, "reach"),
      interactions: interactionsOf(mi),
      pillar: null,
      hook: mi.post_id ? (postById[mi.post_id]?.hook ?? null) : null,
    })),
  [media, postById]);

  const doLink = async (postId: string | null) => {
    if (!linkingMedia) return;
    try {
      await link.mutateAsync({ mediaId: linkingMedia.id, postId });
      toast.success(postId ? "Publicação vinculada ao post do Cria!" : "Vínculo removido.");
      setLinkingMedia(null);
    } catch (e) { toast.error((e as Error)?.message ?? "Não foi possível vincular."); }
  };
  const unlink = async (mi: CriaClientIgMedia) => {
    try { await link.mutateAsync({ mediaId: mi.id, postId: null }); toast.success("Vínculo removido."); }
    catch (e) { toast.error((e as Error)?.message ?? "Erro ao remover."); }
  };

  if (isLoading) {
    return <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">{[0, 1, 2, 3].map((i) => <div key={i} className="h-24 rounded-2xl bg-muted animate-pulse" />)}</div>;
  }
  if (isError) {
    return <div className="rounded-2xl border border-border bg-card p-6 text-center"><p className="text-sm font-body text-muted-foreground">Não foi possível carregar os insights agora. Tente de novo em instantes.</p></div>;
  }
  if (!data?.connected) {
    return (
      <div className="rounded-2xl border border-dashed border-border p-10 text-center">
        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#F58529] via-[#DD2A7B] to-[#515BD4] grid place-items-center mx-auto mb-3"><Instagram className="h-7 w-7 text-white" /></div>
        <p className="text-sm font-body text-foreground font-medium">Instagram ainda não conectado</p>
        {gerenciado ? (
          <>
            <p className="text-xs text-muted-foreground font-body mt-1 mb-4 max-w-sm mx-auto">Este cliente não usa o CRIA. Conecte o Instagram dele aqui (com o acesso da conta) pra puxar alcance, audiência e stories pros relatórios.</p>
            <button onClick={() => void connectInstagram(crmClientId)} className="inline-flex items-center gap-2 rounded-full bg-gradient-to-br from-[#F58529] via-[#DD2A7B] to-[#515BD4] px-5 py-2.5 text-sm font-display font-bold text-white hover:opacity-90 transition-opacity">
              <Instagram className="h-4 w-4" /> Conectar Instagram
            </button>
          </>
        ) : (
          <p className="text-xs text-muted-foreground font-body mt-1 max-w-sm mx-auto">Peça pro cliente conectar o Instagram no CRIA dele (menu Insights). Assim que ele conectar, os números aparecem aqui automaticamente.</p>
        )}
      </div>
    );
  }

  const hasData = mediaTotal.length > 0 || (data.daily ?? []).length > 0;
  const lastSync = data.last_sync ? new Date(data.last_sync).toLocaleString("pt-BR") : null;

  return (
    <div className="space-y-4">
      {/* Cabeçalho: conta conectada + última atualização */}
      <div className="flex items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3 flex-wrap">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-fuchsia-500 to-pink-400 grid place-items-center shrink-0 overflow-hidden">
          {data.profile_picture_url ? <img src={data.profile_picture_url} alt="" className="w-full h-full object-cover" /> : <Instagram className="h-4 w-4 text-white" />}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-display font-bold text-foreground truncate">@{data.username ?? clientName ?? "conta"}</p>
          <p className="text-[11px] font-body text-muted-foreground flex items-center gap-1">
            <RefreshCw className="h-3 w-3" /> {lastSync ? `Atualizado em ${lastSync}` : "Aguardando primeira sincronização"}
            {gerenciado ? " · conectado por você" : " · sincronizado pelo cliente no CRIA dele"}
          </p>
        </div>
        {/* No modo gerenciado, quem atualiza é a social mídia, daqui mesmo. */}
        {gerenciado && (
          <button onClick={() => void atualizarAgora()} disabled={syncManaged.isPending}
            className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3.5 py-1.5 text-[12px] font-display font-bold text-foreground hover:border-primary hover:text-primary transition-colors disabled:opacity-50 shrink-0">
            {syncManaged.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />} Atualizar
          </button>
        )}
      </div>

      {/* Filtro de período: recorta KPIs, formatos, destaques, stories e a
          análise por post. */}
      {hasData && (
        <div className="flex flex-wrap gap-1.5">
          {PERIODOS.map(([k, rotulo]) => (
            <button key={k} type="button" onClick={() => setPeriodo(k)}
              className={`px-3 py-1.5 rounded-full text-xs font-body font-semibold border transition-colors ${periodo === k ? "bg-primary text-primary-foreground border-primary" : "bg-card border-border text-muted-foreground hover:text-foreground"}`}>
              {rotulo}
            </button>
          ))}
        </div>
      )}

      {/* Evolução de seguidores no período (série diária do nosso snapshot).
          O Instagram não dá histórico retroativo: a linha começa no dia em que
          a conta foi conectada e engorda um ponto por dia. */}
      {hasData && <EvolucaoSeguidores daily={dailyPeriodo} />}

      {!hasData ? (
        <div className="rounded-2xl border border-dashed border-border p-8 text-center">
          <p className="text-sm font-body text-foreground font-medium">Conectado, mas ainda sem dados</p>
          {gerenciado ? (
            <>
              <p className="text-xs text-muted-foreground font-body mt-1 mb-4 max-w-sm mx-auto">Clique em atualizar pra puxar os primeiros números do Instagram do cliente.</p>
              <button onClick={() => void atualizarAgora()} disabled={syncManaged.isPending}
                className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-display font-bold text-primary-foreground hover:opacity-90 transition-opacity disabled:opacity-50">
                {syncManaged.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />} Puxar os dados agora
              </button>
            </>
          ) : (
            <p className="text-xs text-muted-foreground font-body mt-1 max-w-sm mx-auto">O Instagram está conectado, só falta o cliente abrir a tela Insights no CRIA dele e clicar em "Atualizar" pra puxar os primeiros números.</p>
          )}
        </div>
      ) : (
        <>
          {/* KPIs (com engajamento) */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <KpiCard icon={Users} label="Seguidores" value={fmt(kpis?.followers)} sub={kpis && kpis.followersDelta !== 0 ? `${kpis.followersDelta > 0 ? "+" : ""}${fmt(kpis.followersDelta)} no período` : undefined} />
            <KpiCard icon={Eye} label="Alcance (posts)" value={fmt(kpis?.reach)} />
            <KpiCard icon={Heart} label="Interações" value={fmt(kpis?.interactions)} />
            <KpiCard icon={Zap} label="Engajamento" value={kpis && kpis.reach > 0 ? `${kpis.eng.toFixed(1)}%` : "-"} sub="interações ÷ alcance" />
          </div>

          {/* Análise: o que funciona pra este cliente (formato) + destaques */}
          {porFormato.rows.length > 0 && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              <div className="rounded-2xl border border-border bg-card p-4">
                <div className="flex items-center gap-2 mb-1"><TrendingUp className="h-4 w-4 text-primary" /><p className="text-sm font-display font-bold text-foreground">Alcance médio por formato</p></div>
                <p className="text-[11.5px] font-body text-muted-foreground mb-3">
                  Média de alcance de cada formato publicado.{vinculados > 0 ? ` ${vinculados} vinculado${vinculados > 1 ? "s" : ""} ao Cria.` : " Vincule ao Cria pra cruzar com o que você produziu."}
                </p>
                <div className="space-y-2.5">
                  {porFormato.rows.map((r) => (
                    <div key={r.f} className="flex items-center gap-3">
                      <span className="w-20 text-[12.5px] font-body font-semibold text-foreground shrink-0 truncate">{r.f}</span>
                      <span className="flex-1 h-2 rounded-full bg-muted overflow-hidden"><span className="block h-full rounded-full bg-primary" style={{ width: `${porFormato.max > 0 ? Math.max(4, (r.media / porFormato.max) * 100) : 0}%` }} /></span>
                      <span className="w-24 text-right text-[12px] font-body shrink-0"><b className="text-foreground">{fmt(r.media)}</b> <span className="text-muted-foreground">· {r.n}</span></span>
                    </div>
                  ))}
                </div>
              </div>

              {destaques && (
                <div className="rounded-2xl border border-border bg-card p-4">
                  <div className="flex items-center gap-2 mb-3"><Zap className="h-4 w-4 text-primary" /><p className="text-sm font-display font-bold text-foreground">Destaques</p></div>
                  <div className="space-y-1">
                    <DestaqueRow bg="#01A652" ico="↑" titulo="Maior alcance" cap={destaques.best.caption} extra={`${fmt(m(destaques.best, "reach"))} de alcance`} />
                    <DestaqueRow bg="#EA4918" ico="⚡" titulo="Mais engajou" cap={destaques.bestEng.caption} extra={`${engOf(destaques.bestEng).toFixed(1)}% de engajamento`} />
                    {destaques.worst && <DestaqueRow bg="#c0392b" ico="↓" titulo="Menor alcance" cap={destaques.worst.caption} extra={`${fmt(m(destaques.worst, "reach"))} de alcance`} />}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Direcionamento: cruzamentos (o que postar mais, formato, dia, horário) */}
          {media.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-display font-bold text-foreground">O que postar mais</p>
              <ContentCrossAnalysis items={crossItems} />
            </div>
          )}

          {/* Reels por retenção */}
          {media.some((mi) => mi.media_type === "REELS" || mi.media_type === "VIDEO") && (
            <ReelsRanking media={media} />
          )}

          {/* Perfil de audiência do cliente */}
          <div className="space-y-2">
            <p className="text-sm font-display font-bold text-foreground">Quem acompanha o cliente</p>
            <AudienceBreakdown rows={data.audience} />
          </div>

          {/* Stories do cliente */}
          <div className="space-y-2">
            <p className="text-sm font-display font-bold text-foreground">Stories</p>
            <StoriesSummary stories={storiesPeriodo} />
          </div>

          {/* Análise por post */}
          {media.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
                <p className="text-sm font-display font-bold text-foreground">Análise por post</p>
                {extClientId && <p className="text-[11px] font-body text-muted-foreground">Vincule cada publicação ao post que você fez no Cria pra cruzar o resultado.</p>}
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2.5">
                {media.map((mi) => {
                  const Icon = MEDIA_ICON(mi.media_type);
                  const eng = engOf(mi);
                  const linked = mi.post_id ? postById[mi.post_id] : null;
                  return (
                    <div key={mi.id} className="bg-card border border-border rounded-xl overflow-hidden flex flex-col">
                      <div className="relative aspect-square bg-muted">
                        {mi.thumbnail_url && <img src={mi.thumbnail_url} referrerPolicy="no-referrer" alt="" loading="lazy" className="absolute inset-0 w-full h-full object-cover" onError={(e) => { e.currentTarget.style.display = "none"; }} />}
                        <span className="absolute top-1.5 left-1.5 flex items-center gap-1 text-[9px] font-body font-semibold px-1.5 py-0.5 rounded-full bg-black/55 text-white"><Icon className="h-2.5 w-2.5" /> {mi.media_type ? (MEDIA_LABEL[mi.media_type] ?? mi.media_type) : "Post"}</span>
                        {mi.metrics?.reach != null && <span className="absolute bottom-1.5 left-1.5 text-[9px] font-body font-bold px-1.5 py-0.5 rounded-full bg-black/60 text-white">{eng.toFixed(1)}%</span>}
                        {mi.permalink && <a href={mi.permalink} target="_blank" rel="noreferrer" aria-label="Abrir no Instagram" className="absolute top-1.5 right-1.5 grid h-5 w-5 place-items-center rounded-full bg-black/55 text-white hover:bg-black/75 transition-colors"><ExternalLink className="h-2.5 w-2.5" /></a>}
                      </div>
                      <div className="p-2 flex flex-col gap-1.5 flex-1">
                        {mi.posted_at && <p className="text-[10px] font-body font-semibold text-foreground flex items-center gap-1"><CalendarDays className="h-3 w-3 text-primary shrink-0" /> {dataBR(mi.posted_at)}</p>}
                        <p className="text-[10.5px] font-body text-muted-foreground line-clamp-1">{mi.caption || "(sem legenda)"}</p>
                        <div className="flex items-center gap-2 text-[10px] font-body text-muted-foreground flex-wrap">
                          <span className="flex items-center gap-0.5"><Heart className="h-2.5 w-2.5" />{fmt(m(mi, "likes"))}</span>
                          <span className="flex items-center gap-0.5"><MessageCircle className="h-2.5 w-2.5" />{fmt(m(mi, "comments"))}</span>
                          <span className="flex items-center gap-0.5"><Eye className="h-2.5 w-2.5" />{fmt(m(mi, "reach"))}</span>
                          <span className="flex items-center gap-0.5"><Bookmark className="h-2.5 w-2.5" />{fmt(m(mi, "saved") + m(mi, "saves"))}</span>
                        </div>
                        {/* Vínculo com o post do Cria */}
                        {extClientId && (linked ? (
                          <div className="flex items-center gap-1 rounded-md bg-primary/8 px-1.5 py-1">
                            <Layers className="h-3 w-3 text-primary shrink-0" />
                            <span className="text-[9.5px] font-body font-semibold text-foreground truncate flex-1">Cria · {MEDIA_LABEL[linked.format] ?? linked.format}</span>
                            <button onClick={() => unlink(mi)} title="Desvincular" aria-label="Desvincular" className="text-muted-foreground/60 hover:text-destructive"><X className="h-3 w-3" /></button>
                          </div>
                        ) : (
                          <button onClick={() => setLinkingMedia(mi)} className="flex items-center gap-1 rounded-md border border-dashed border-border px-1.5 py-1 text-[9.5px] font-body font-semibold text-muted-foreground hover:text-foreground hover:border-primary/40 transition-colors">
                            <Link2 className="h-3 w-3 shrink-0" /> Vincular ao Cria
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}

      {/* Modal de vínculo */}
      <Dialog open={!!linkingMedia} onOpenChange={(o) => !o && setLinkingMedia(null)}>
        <DialogContent className="sm:max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="font-display">Vincular ao post do Cria</DialogTitle>
            <DialogDescription className="font-body text-sm">Escolha qual post que você produziu no Cria Post virou esta publicação. O resultado real volta pro post e entra na análise.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2 mt-1 max-h-[52vh] overflow-y-auto">
            {criaPosts.length === 0 ? (
              <p className="text-sm font-body text-muted-foreground py-6 text-center">Nenhum post no Cria Post deste cliente ainda.</p>
            ) : criaPosts.map((p) => (
              <button key={p.id} onClick={() => doLink(p.id)} disabled={link.isPending}
                className="w-full flex items-center gap-3 rounded-xl border border-border p-3 text-left hover:border-primary/50 hover:bg-primary/5 transition-colors disabled:opacity-60">
                <span className="grid h-9 w-9 place-items-center rounded-lg bg-primary/10 text-primary text-[10px] font-display font-bold shrink-0">{(MEDIA_LABEL[p.format] ?? p.format ?? "POST").slice(0, 4).toUpperCase()}</span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[13px] font-body font-semibold text-foreground truncate">{p.title || "Post"}</span>
                  <span className="block text-[11px] font-body text-muted-foreground truncate">{MEDIA_LABEL[p.format] ?? p.format}{p.scheduled_date ? ` · ${new Date(p.scheduled_date + "T00:00:00").toLocaleDateString("pt-BR")}` : ""}</span>
                </span>
                {link.isPending ? <Loader2 className="h-4 w-4 animate-spin text-muted-foreground shrink-0" /> : <Check className="h-4 w-4 text-muted-foreground/40 shrink-0" />}
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Linha de seguidores do período, em SVG puro (sem lib de gráfico): delta em
// destaque + a curva dia a dia. Com menos de 2 pontos, explica a limitação em
// vez de mostrar um gráfico vazio.
function EvolucaoSeguidores({ daily }: { daily: CriaClientIgDaily[] }) {
  const pts = daily.filter((d) => d.followers != null) as Array<CriaClientIgDaily & { followers: number }>;
  const first = pts[0]; const last = pts[pts.length - 1];
  const delta = pts.length > 1 ? last.followers - first.followers : 0;
  const W = 600, H = 64, PAD = 4;
  const linha = (() => {
    if (pts.length < 2) return null;
    const min = Math.min(...pts.map((p) => p.followers));
    const max = Math.max(...pts.map((p) => p.followers));
    const span = Math.max(1, max - min);
    return pts.map((p, i) => {
      const x = PAD + (i / (pts.length - 1)) * (W - 2 * PAD);
      const y = H - PAD - ((p.followers - min) / span) * (H - 2 * PAD);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    }).join(" ");
  })();
  const diaBR = (s: string) => new Date(s + "T12:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="flex items-center justify-between gap-2 flex-wrap mb-1">
        <div className="flex items-center gap-2"><Users className="h-4 w-4 text-primary" /><p className="text-sm font-display font-bold text-foreground">Seguidores no período</p></div>
        {pts.length > 1 && (
          <span className={`text-[12px] font-display font-bold px-2 py-0.5 rounded-full ${delta > 0 ? "bg-emerald-500/15 text-emerald-700" : delta < 0 ? "bg-red-500/10 text-red-600" : "bg-muted text-muted-foreground"}`}>
            {delta > 0 ? "+" : ""}{fmt(delta)} no período
          </span>
        )}
      </div>
      {pts.length < 2 ? (
        <p className="text-[12px] font-body text-muted-foreground leading-relaxed">
          A linha de seguidores é montada dia a dia a partir da conexão (o Instagram não entrega o histórico pra trás).
          {pts.length === 1 ? ` Primeiro ponto registrado: ${fmt(pts[0].followers)} seguidores em ${diaBR(pts[0].date)}. Amanhã já dá pra ver a variação.` : " Sincronize pra registrar o primeiro ponto."}
        </p>
      ) : (
        <>
          <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-16" preserveAspectRatio="none" aria-hidden="true">
            <polyline points={linha!} fill="none" stroke="currentColor" strokeWidth="2.5" className="text-primary" strokeLinejoin="round" strokeLinecap="round" />
          </svg>
          <div className="flex items-center justify-between text-[11px] font-body text-muted-foreground">
            <span>{diaBR(first.date)} · {fmt(first.followers)}</span>
            <span>{diaBR(last.date)} · <b className="text-foreground">{fmt(last.followers)}</b></span>
          </div>
        </>
      )}
    </div>
  );
}

function DestaqueRow({ bg, ico, titulo, cap, extra }: { bg: string; ico: string; titulo: string; cap: string | null; extra: string }) {
  return (
    <div className="flex items-start gap-2.5 py-2 border-b border-dashed border-border last:border-none">
      <span className="grid h-6 w-6 place-items-center rounded-lg text-white text-[13px] font-bold shrink-0" style={{ background: bg }}>{ico}</span>
      <div className="min-w-0 flex-1">
        <p className="text-[12.5px] font-body font-bold text-foreground">{titulo} <span className="font-normal text-muted-foreground">· {extra}</span></p>
        <p className="text-[11.5px] font-body text-muted-foreground truncate">{cap || "(sem legenda)"}</p>
      </div>
    </div>
  );
}

function KpiCard({ icon: Icon, label, value, sub }: { icon: typeof Users; label: string; value: string; sub?: string }) {
  return (
    <div className="bg-card border border-border rounded-2xl p-4">
      <div className="flex items-center gap-1.5 text-muted-foreground mb-1"><Icon className="h-3.5 w-3.5" /><p className="text-[11px] font-body uppercase tracking-wide">{label}</p></div>
      <p className="text-xl font-display font-extrabold text-foreground">{value}</p>
      {sub && <p className="text-[11px] font-body text-muted-foreground mt-0.5">{sub}</p>}
    </div>
  );
}
