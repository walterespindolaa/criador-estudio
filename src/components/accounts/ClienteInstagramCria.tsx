import { useMemo } from "react";
import { Instagram, Heart, MessageCircle, Eye, Bookmark, Users, Play, Image as ImageIcon, Images, ExternalLink, RefreshCw } from "lucide-react";
import { useCriaClientInstagram, type CriaClientIgMedia } from "@/hooks/useManagerClientCria";

// Aba Instagram da ficha do cliente que USA O CRIA: mostra os dados que o pipeline
// do próprio cliente já sincronizou (social_metrics_daily + social_insights), em
// modo leitura. Nada de sync novo aqui, quem atualiza é o cliente no CRIA dele.

const fmt = (n: number | null | undefined) =>
  n == null ? "-" : n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1).replace(".0", "")}M` : n >= 1000 ? `${(n / 1000).toFixed(1).replace(".0", "")}k` : String(n);
const m = (mi: CriaClientIgMedia, k: string) => Number(mi.metrics?.[k] ?? 0);
const MEDIA_ICON = (t: string | null) => (t === "VIDEO" || t === "REELS" ? Play : t === "CAROUSEL_ALBUM" ? Images : ImageIcon);
const MEDIA_LABEL: Record<string, string> = { IMAGE: "Foto", VIDEO: "Vídeo", REELS: "Reels", CAROUSEL_ALBUM: "Carrossel" };

export function ClienteInstagramCria({ criaOwnerId, clientName }: { criaOwnerId: string; clientName?: string }) {
  const { data, isLoading, isError } = useCriaClientInstagram(criaOwnerId);

  const kpis = useMemo(() => {
    if (!data?.connected) return null;
    const daily = data.daily ?? [];
    const media = data.media ?? [];
    const withFollowers = daily.filter((d) => d.followers != null);
    const followers = withFollowers.length ? withFollowers[withFollowers.length - 1].followers : null;
    const followersDelta = withFollowers.length > 1
      ? (withFollowers[withFollowers.length - 1].followers ?? 0) - (withFollowers[0].followers ?? 0)
      : 0;
    // Mesmo cálculo da tela Insights do criador: alcance/interações somados dos posts.
    const reach = media.reduce((a, mi) => a + m(mi, "reach"), 0);
    const interactions = media.reduce((a, mi) => a + m(mi, "likes") + m(mi, "comments") + m(mi, "saved") + m(mi, "shares"), 0);
    return { followers, followersDelta, reach, interactions };
  }, [data]);

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[0, 1, 2, 3].map((i) => <div key={i} className="h-24 rounded-2xl bg-muted animate-pulse" />)}
      </div>
    );
  }

  if (isError) {
    return (
      <div className="rounded-2xl border border-border bg-card p-6 text-center">
        <p className="text-sm font-body text-muted-foreground">Não foi possível carregar os insights agora. Tente de novo em instantes.</p>
      </div>
    );
  }

  // Cliente ainda não conectou o Instagram na conta CRIA dele.
  if (!data?.connected) {
    return (
      <div className="rounded-2xl border border-dashed border-border p-10 text-center">
        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#F58529] via-[#DD2A7B] to-[#515BD4] grid place-items-center mx-auto mb-3">
          <Instagram className="h-7 w-7 text-white" />
        </div>
        <p className="text-sm font-body text-foreground font-medium">Instagram ainda não conectado</p>
        <p className="text-xs text-muted-foreground font-body mt-1 max-w-sm mx-auto">
          Peça pro cliente conectar o Instagram no CRIA dele (menu Insights). Assim que ele conectar, os números aparecem aqui automaticamente.
        </p>
      </div>
    );
  }

  const media = data.media ?? [];
  const hasData = media.length > 0 || (data.daily ?? []).length > 0;
  const lastSync = data.last_sync ? new Date(data.last_sync).toLocaleString("pt-BR") : null;

  return (
    <div className="space-y-4">
      {/* Cabeçalho: conta conectada + última atualização */}
      <div className="flex items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3 flex-wrap">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-fuchsia-500 to-purple-600 grid place-items-center shrink-0 overflow-hidden">
          {data.profile_picture_url
            ? <img src={data.profile_picture_url} alt="" className="w-full h-full object-cover" />
            : <Instagram className="h-4 w-4 text-white" />}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-display font-bold text-foreground truncate">@{data.username ?? clientName ?? "conta"}</p>
          <p className="text-[11px] font-body text-muted-foreground flex items-center gap-1">
            <RefreshCw className="h-3 w-3" /> {lastSync ? `Atualizado em ${lastSync}` : "Aguardando primeira sincronização"} · sincronizado pelo cliente no CRIA dele
          </p>
        </div>
      </div>

      {!hasData ? (
        <div className="rounded-2xl border border-dashed border-border p-8 text-center">
          <p className="text-sm font-body text-foreground font-medium">Conectado, mas ainda sem dados</p>
          <p className="text-xs text-muted-foreground font-body mt-1 max-w-sm mx-auto">
            O Instagram está conectado, só falta o cliente abrir a tela Insights no CRIA dele e clicar em "Atualizar" pra puxar os primeiros números.
          </p>
        </div>
      ) : (
        <>
          {/* Cards de resumo */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <KpiCard icon={Users} label="Seguidores" value={fmt(kpis?.followers)}
              sub={kpis && kpis.followersDelta !== 0 ? `${kpis.followersDelta > 0 ? "+" : ""}${fmt(kpis.followersDelta)} no período` : undefined} />
            <KpiCard icon={Eye} label="Alcance (posts)" value={fmt(kpis?.reach)} />
            <KpiCard icon={Heart} label="Interações" value={fmt(kpis?.interactions)} />
            <KpiCard icon={ImageIcon} label="Posts sincronizados" value={String(media.length)} />
          </div>

          {/* Últimos posts com métricas */}
          {media.length > 0 && (
            <div>
              <p className="text-sm font-display font-bold text-foreground mb-2">Últimos posts</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {media.map((mi) => {
                  const Icon = MEDIA_ICON(mi.media_type);
                  return (
                    <div key={mi.id} className="bg-card border border-border rounded-2xl overflow-hidden flex flex-col">
                      <div className="relative aspect-square bg-muted">
                        {mi.thumbnail_url && (
                          <img src={mi.thumbnail_url} alt="" loading="lazy" className="absolute inset-0 w-full h-full object-cover"
                            onError={(e) => { e.currentTarget.style.display = "none"; }} />
                        )}
                        <span className="absolute top-2 left-2 flex items-center gap-1 text-[10px] font-body font-semibold px-1.5 py-0.5 rounded-full bg-black/55 text-white">
                          <Icon className="h-3 w-3" /> {mi.media_type ? (MEDIA_LABEL[mi.media_type] ?? mi.media_type) : "Post"}
                        </span>
                        {mi.permalink && (
                          <a href={mi.permalink} target="_blank" rel="noreferrer" aria-label="Abrir no Instagram"
                            className="absolute top-2 right-2 grid h-6 w-6 place-items-center rounded-full bg-black/55 text-white hover:bg-black/75 transition-colors">
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        )}
                      </div>
                      <div className="p-3 flex flex-col gap-2 flex-1">
                        <p className="text-xs font-body text-foreground line-clamp-2 flex-1">{mi.caption || "(sem legenda)"}</p>
                        <div className="flex items-center gap-3 text-[11px] font-body text-muted-foreground flex-wrap">
                          <span className="flex items-center gap-1"><Heart className="h-3 w-3" />{fmt(m(mi, "likes"))}</span>
                          <span className="flex items-center gap-1"><MessageCircle className="h-3 w-3" />{fmt(m(mi, "comments"))}</span>
                          <span className="flex items-center gap-1"><Eye className="h-3 w-3" />{fmt(m(mi, "reach"))}</span>
                          <span className="flex items-center gap-1"><Bookmark className="h-3 w-3" />{fmt(m(mi, "saved") + m(mi, "saves"))}</span>
                        </div>
                        {mi.posted_at && <p className="text-[10px] font-body text-muted-foreground/70">{new Date(mi.posted_at).toLocaleDateString("pt-BR")}</p>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function KpiCard({ icon: Icon, label, value, sub }: { icon: typeof Users; label: string; value: string; sub?: string }) {
  return (
    <div className="bg-card border border-border rounded-2xl p-4">
      <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
        <Icon className="h-3.5 w-3.5" />
        <p className="text-[11px] font-body uppercase tracking-wide">{label}</p>
      </div>
      <p className="text-xl font-display font-extrabold text-foreground">{value}</p>
      {sub && <p className="text-[11px] font-body text-emerald-600 mt-0.5">{sub}</p>}
    </div>
  );
}
