import { forwardRef, type ReactNode, type SyntheticEvent } from "react";
import type { MediaKitProfile } from "@/hooks/useMediaKit";
import { AssinaturaCria } from "@/components/publico/AssinaturaCria";
import { DesenhoCapaCria } from "@/components/criakut/CapaCriakut";
import { estiloCapa, lerMostrar, linkDoContato, type MostrarKit } from "@/lib/mediaKitCapas";

/* MEDIA KIT NO PADRÃO DO CRIA (Walter, 06/11/2026; mockup aprovado).
   O mesmo componente desenha a prévia da tela, a página pública do link e o
   PDF. Tudo em estilo inline (o html2canvas fotografa o que está pintado) e o
   layout do celular sai por container query: no PDF a largura é de folha A4,
   então ele sempre sai no layout largo. */

export type KitStats = {
  followers: number;
  reachMonth: number;
  engagementPct: number;
  saves: number;
  profileViews?: number;
  accountsEngaged?: number;
  interactions?: number;
  postsCount?: number;
  avgReach?: number;
  followersGrowth?: number;
};

export type KitTopPost = {
  title: string;
  format: string;
  reach: number;
  saves: number;
  thumbnail_url?: string | null;
};

type Props = {
  name: string;
  handle: string;
  niche: string;
  bio: string;
  avatarUrl?: string | null;
  kit: Pick<MediaKitProfile, "audience" | "gender" | "cities" | "services" | "contact"> & { accent?: string | null };
  /** null = bloco de números desligado. */
  stats: KitStats | null;
  posts: KitTopPost[];
  /** Data (já formatada) em que os números foram puxados do Instagram. */
  updatedAt?: string | null;
  capa?: string | null;
  mostrar?: Partial<MostrarKit> | null;
  /** Na página pública o botão do contato abre e-mail ou WhatsApp. */
  contatoClicavel?: boolean;
};

const hideImg = (e: SyntheticEvent<HTMLImageElement>) => { e.currentTarget.style.display = "none"; };

export const fmtKit = (n: number): string => {
  if (!n) return "0";
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(".", ",")} mi`;
  if (abs >= 1000) return `${(n / 1000).toFixed(1).replace(".", ",")} mil`;
  return String(Math.round(n));
};

const PRETO = "#0A0A0A";
const BORDA = `2px solid ${PRETO}`;
const DISPLAY = "'Baloo 2', Roboto, sans-serif";
const CORPO = "Roboto, system-ui, sans-serif";
const MUDO = "#6E675A";

const CSS = `
.mk-raiz{container-type:inline-size;container-name:mk}
@container mk (max-width: 600px){
  .mk-capa{flex-direction:column !important;align-items:flex-start !important;padding:20px 18px 52px !important}
  .mk-foto{width:76px !important;height:76px !important}
  .mk-mancha{width:190px !important;height:170px !important;right:-60px !important;top:-60px !important}
  .mk-nome{font-size:28px !important}
  .mk-nums{grid-template-columns:repeat(2,1fr) !important}
  .mk-nums > div:nth-child(2){border-right:0 !important}
  .mk-nums > div:nth-child(-n+2){border-bottom:1.5px solid #eee}
  .mk-corpo{grid-template-columns:1fr !important;padding:16px !important}
  .mk-rod{flex-direction:column;align-items:stretch !important}
  .mk-rod a, .mk-rod span.mk-btn{text-align:center}
  .mk-des{grid-template-columns:repeat(2,1fr) !important}
}
@media print { body * { visibility: hidden; } #media-kit-print, #media-kit-print * { visibility: visible; } #media-kit-print { position: absolute; left: 0; top: 0; width: 100%; } }
`;

export const AutoMediaKit = forwardRef<HTMLDivElement, Props>(function AutoMediaKit(
  { name, handle, niche, bio, avatarUrl, kit, stats, posts, updatedAt, capa, mostrar, contatoClicavel },
  ref,
) {
  const e = estiloCapa(capa, kit.accent);
  const m = lerMostrar(mostrar);
  const tags = (niche || "").split(/[,;]/).map((t) => t.trim()).filter(Boolean).slice(0, 3);
  const women = kit.gender?.women ?? 60;
  const men = kit.gender?.men ?? 40;
  const audiencia = (kit.audience ?? []).filter((b) => b.label);
  const servicos = (kit.services ?? []).filter((s) => s.name);
  const linkContato = contatoClicavel ? linkDoContato(kit.contact, name) : null;

  const extra: Array<[string, string]> = [];
  if (stats && m.desempenho) {
    if (stats.followersGrowth) extra.push([`${stats.followersGrowth > 0 ? "+" : ""}${fmtKit(stats.followersGrowth)}`, "Novos seguidores"]);
    if (stats.profileViews) extra.push([fmtKit(stats.profileViews), "Visitas ao perfil"]);
    if (stats.accountsEngaged) extra.push([fmtKit(stats.accountsEngaged), "Contas engajadas"]);
    if (stats.interactions) extra.push([fmtKit(stats.interactions), "Interações"]);
    if (stats.avgReach) extra.push([fmtKit(stats.avgReach), "Alcance médio/post"]);
    if (stats.postsCount) extra.push([String(stats.postsCount), "Posts no período"]);
  }
  const temAudiencia = m.audiencia && (audiencia.length > 0 || !!kit.cities);
  const temValores = m.valores && servicos.length > 0;

  return (
    <div ref={ref} id="media-kit-print" className="mk-raiz" style={{ fontFamily: CORPO, color: PRETO }}>
      <style>{CSS}</style>
      <div style={{ background: "#fff", border: BORDA, borderRadius: 22, overflow: "hidden", boxShadow: `8px 8px 0 ${PRETO}`, marginRight: 8, marginBottom: 8 }}>
        {/* CAPA */}
        <div data-pdf-block className="mk-capa" style={{ position: "relative", overflow: "hidden", background: e.fundo, color: e.texto, padding: "26px 28px 30px", display: "flex", gap: 20, alignItems: "center" }}>
          {e.desenho && <DesenhoCapaCria tipo={e.desenho} style={{ opacity: 0.9 }} />}
          {e.mancha && <span aria-hidden className="mk-mancha" style={{ position: "absolute", right: -70, top: -80, width: 300, height: 270, borderRadius: "48% 52% 40% 60%", background: e.mancha }} />}
          <div className="mk-foto" style={{ position: "relative", zIndex: 1, width: 104, height: 104, borderRadius: "50%", border: `5px solid ${e.aro}`, background: "#E6E1D6", flexShrink: 0, overflow: "hidden", display: "grid", placeItems: "center", fontFamily: DISPLAY, fontWeight: 800, fontSize: 34, color: PRETO }}>
            {avatarUrl ? <img src={avatarUrl} alt="" referrerPolicy="no-referrer" onError={hideImg} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : (name || "?").trim().charAt(0).toUpperCase()}
          </div>
          <div style={{ position: "relative", zIndex: 1, minWidth: 0 }}>
            <div style={{ fontFamily: "'Grand Hotel', cursive", fontSize: 30, lineHeight: 1, color: e.script }}>media kit</div>
            <h1 className="mk-nome" style={{ fontFamily: DISPLAY, fontSize: 36, fontWeight: 800, lineHeight: 1.02, margin: "2px 0 0", letterSpacing: "-.01em" }}>{name || "Seu nome"}</h1>
            <div style={{ fontSize: 13.5, marginTop: 4, opacity: 0.92 }}>{handle} · Instagram</div>
            {tags.length > 0 && (
              <div style={{ marginTop: 8, display: "flex", gap: 6, flexWrap: "wrap" }}>
                {tags.map((t) => (
                  <span key={t} style={{ background: "#fff", color: PRETO, border: `1.5px solid ${PRETO}`, padding: "3px 11px", borderRadius: 999, fontSize: 11.5, fontWeight: 700 }}>{t}</span>
                ))}
              </div>
            )}
            {bio && <p style={{ marginTop: 10, fontSize: 13, maxWidth: 520, lineHeight: 1.5, opacity: 0.95 }}>{bio}</p>}
          </div>
          {updatedAt && (
            <span style={{ position: "absolute", right: 20, bottom: 14, zIndex: 2, background: e.selo.fundo, color: e.selo.texto, border: BORDA, borderRadius: 999, padding: "5px 12px", fontSize: 11, fontWeight: 800, transform: "rotate(-3deg)" }}>
              atualizado em {updatedAt}
            </span>
          )}
        </div>

        {/* NÚMEROS */}
        {stats && m.numeros && (
          <div data-pdf-block className="mk-nums" style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", borderTop: BORDA, borderBottom: BORDA }}>
            {[
              [fmtKit(stats.followers), "Seguidores"],
              [fmtKit(stats.reachMonth), "Alcance / mês"],
              [`${stats.engagementPct.toFixed(1).replace(".", ",")}%`, "Engajamento"],
              [fmtKit(stats.saves), "Salvamentos"],
            ].map(([n, l], i) => (
              <div key={l} style={{ padding: "16px 10px", textAlign: "center", borderRight: i < 3 ? "1.5px solid #eee" : 0 }}>
                <div style={{ fontFamily: DISPLAY, fontSize: 30, fontWeight: 800, lineHeight: 1 }}>{n}</div>
                <div style={{ fontSize: 10, color: MUDO, textTransform: "uppercase", letterSpacing: ".07em", marginTop: 5, fontWeight: 700 }}>{l}</div>
              </div>
            ))}
          </div>
        )}

        <div className="mk-corpo" style={{ padding: "20px 22px", display: "grid", gridTemplateColumns: temAudiencia && temValores ? "1fr 1fr" : "1fr", gap: 16, borderTop: stats && m.numeros ? 0 : BORDA }}>
          {temAudiencia && (
            <Caixa titulo="Quem me assiste">
              {audiencia.map((b) => (
                <div key={b.label} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, margin: "6px 0" }}>
                  <span style={{ width: 68, flexShrink: 0 }}>{b.label}</span>
                  <span style={{ flex: 1, height: 8, borderRadius: 999, background: "#EEE", overflow: "hidden" }}>
                    <span style={{ display: "block", height: "100%", width: `${Math.min(100, b.pct)}%`, background: e.destaque, borderRadius: 999 }} />
                  </span>
                  <b style={{ width: 34, textAlign: "right" }}>{b.pct}%</b>
                </div>
              ))}
              <div style={{ fontSize: 12, marginTop: 8 }}>Mulheres {women}% · Homens {men}%</div>
              {kit.cities && <div style={{ fontSize: 12, marginTop: 4, color: MUDO }}>{kit.cities}</div>}
            </Caixa>
          )}
          {temValores && (
            <Caixa titulo="Formatos e valores">
              {servicos.map((s, i) => (
                <div key={i} style={{ display: "flex", justifyContent: "space-between", gap: 10, padding: "7px 0", borderBottom: i < servicos.length - 1 ? "1.5px dashed #DDD" : 0 }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>{s.name}</div>
                    {s.desc && <div style={{ fontSize: 11, color: MUDO, marginTop: 1 }}>{s.desc}</div>}
                  </div>
                  <b style={{ fontSize: 13.5, whiteSpace: "nowrap" }}>{s.price}</b>
                </div>
              ))}
            </Caixa>
          )}

          {extra.length >= 2 && (
            <div data-pdf-block style={{ gridColumn: "1 / -1" }}>
              <Titulo>Desempenho · últimos 30 dias</Titulo>
              <div className="mk-des" style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8 }}>
                {extra.map(([n, l]) => (
                  <div key={l} style={{ border: `1.5px solid ${PRETO}`, borderRadius: 14, padding: "10px 12px" }}>
                    <div style={{ fontFamily: DISPLAY, fontSize: 21, fontWeight: 800, color: e.destaque, lineHeight: 1.05 }}>{n}</div>
                    <div style={{ fontSize: 11, color: MUDO, marginTop: 2 }}>{l}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {m.conteudos && posts.length > 0 && (
            <div data-pdf-block style={{ gridColumn: "1 / -1" }}>
              <Titulo>Melhores conteúdos · 90 dias</Titulo>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8 }}>
                {posts.slice(0, 3).map((p, i) => (
                  <div key={i}>
                    <div style={{ aspectRatio: "4/5", borderRadius: 14, border: `1.5px solid ${PRETO}`, background: "linear-gradient(160deg,#d9d2c4,#a49b8a)", position: "relative", overflow: "hidden" }}>
                      {p.thumbnail_url && <img src={p.thumbnail_url} alt="" referrerPolicy="no-referrer" onError={hideImg} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />}
                      <span style={{ position: "absolute", left: 6, top: 6, background: "rgba(0,0,0,.55)", color: "#fff", fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 999 }}>{p.format}</span>
                      <span style={{ position: "absolute", left: 6, bottom: 6, background: "#fff", color: PRETO, border: `1.5px solid ${PRETO}`, fontSize: 10.5, fontWeight: 800, padding: "1px 8px", borderRadius: 999 }}>{fmtKit(p.reach)} alcance</span>
                    </div>
                    <div style={{ fontSize: 11.5, fontWeight: 600, marginTop: 6, lineHeight: 1.3, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{p.title}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* RODAPÉ */}
        <div data-pdf-block className="mk-rod" style={{ background: "#F5F3E7", borderTop: BORDA, padding: "12px 22px", display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <span style={{ fontSize: 12.5, fontWeight: 600 }}>{kit.contact ? `Contato: ${kit.contact}` : "Aberta a campanhas alinhadas com o meu conteúdo."}</span>
          {linkContato ? (
            <a href={linkContato} target="_blank" rel="noopener noreferrer" style={{ marginLeft: "auto", ...btn(e.destaque) }}>Quero fechar uma publi</a>
          ) : (
            <span className="mk-btn" style={{ marginLeft: "auto", ...btn(e.destaque) }}>Quero fechar uma publi</span>
          )}
        </div>
        <div style={{ padding: "10px 22px 14px", display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 11, color: MUDO, flexWrap: "wrap", gap: 8 }}>
          <span>Dados do Instagram{updatedAt ? ` · puxados em ${updatedAt}` : " · atualizados automaticamente"}.</span>
          <AssinaturaCria variante="rodape" tom="claro" altura={22} style={{ width: "auto", alignItems: "flex-end" }} />
        </div>
      </div>
    </div>
  );
});

function btn(cor: string) {
  return {
    display: "inline-block", background: cor, color: "#fff", border: BORDA, borderRadius: 999,
    padding: "8px 16px", fontSize: 12.5, fontWeight: 800, boxShadow: `0 3px 0 ${PRETO}`, textDecoration: "none", whiteSpace: "nowrap" as const,
  };
}

function Titulo({ children }: { children: ReactNode }) {
  return <h4 style={{ fontFamily: DISPLAY, fontSize: 15, fontWeight: 800, margin: "0 0 8px" }}>{children}</h4>;
}

function Caixa({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <div data-pdf-block style={{ border: `1.5px solid ${PRETO}`, borderRadius: 16, padding: "12px 14px" }}>
      <Titulo>{titulo}</Titulo>
      {children}
    </div>
  );
}
