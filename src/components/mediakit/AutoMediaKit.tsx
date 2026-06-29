import { forwardRef, type ReactNode } from "react";
import type { MediaKitProfile } from "@/hooks/useMediaKit";

export type KitStats = {
  followers: number;
  reachMonth: number;
  engagementPct: number;
  saves: number;
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
  kit: MediaKitProfile;
  stats: KitStats;
  posts: KitTopPost[];
};

const fmt = (n: number): string => {
  if (!n) return "0";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(".", ",")} mi`;
  if (n >= 1000) return `${(n / 1000).toFixed(1).replace(".", ",")} mil`;
  return String(Math.round(n));
};

const POST_GRADS = [
  "linear-gradient(160deg,#0F6E56,#1d9e75)",
  "linear-gradient(160deg,#DD2A7B,#F58529)",
  "linear-gradient(160deg,#515BD4,#1d9e75)",
];

export const AutoMediaKit = forwardRef<HTMLDivElement, Props>(function AutoMediaKit(
  { name, handle, niche, bio, kit, stats, posts },
  ref,
) {
  const accent = kit.accent || "#0F6E56";
  const tags = (niche || "")
    .split(/[,;]/)
    .map((t) => t.trim())
    .filter(Boolean)
    .slice(0, 3);
  const women = kit.gender?.women ?? 60;
  const men = kit.gender?.men ?? 40;

  return (
    <>
      <style>{`@media print { body * { visibility: hidden; } #media-kit-print, #media-kit-print * { visibility: visible; } #media-kit-print { position: absolute; left: 0; top: 0; width: 100%; box-shadow: none !important; border-radius: 0 !important; } }`}</style>

      <div id="media-kit-print" ref={ref} style={{ background: "#fff", borderRadius: 18, overflow: "hidden", border: "1px solid #e7ece9", fontFamily: "Inter, system-ui, sans-serif", color: "#1a2420" }}>
        {/* hero */}
        <div style={{ background: `linear-gradient(135deg, ${accent} 0%, #0c5947 55%, #1d9e75 100%)`, color: "#fff", padding: "30px 32px 26px", position: "relative" }}>
          <span style={{ position: "absolute", top: 20, right: 28, fontSize: 11, letterSpacing: ".14em", textTransform: "uppercase", opacity: .8, fontWeight: 600 }}>Media Kit · {new Date().getFullYear()}</span>
          <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
            <div style={{ width: 84, height: 84, borderRadius: "50%", background: "linear-gradient(135deg,#F58529,#DD2A7B,#515BD4)", border: "3px solid rgba(255,255,255,.6)", flexShrink: 0 }} />
            <div>
              <h1 style={{ fontFamily: "Sora, Inter, sans-serif", fontSize: 27, fontWeight: 800, letterSpacing: "-.02em", margin: 0 }}>{name || "Seu nome"}</h1>
              <div style={{ fontSize: 14, opacity: .9, marginTop: 2 }}>{handle} · Instagram</div>
              {tags.length > 0 && (
                <div style={{ marginTop: 11, display: "flex", gap: 7, flexWrap: "wrap" }}>
                  {tags.map((t) => (
                    <span key={t} style={{ background: "rgba(255,255,255,.16)", padding: "5px 11px", borderRadius: 999, fontSize: 12, fontWeight: 500 }}>{t}</span>
                  ))}
                </div>
              )}
            </div>
          </div>
          {bio && <p style={{ marginTop: 16, fontSize: 13.5, maxWidth: 560, opacity: .95, lineHeight: 1.6 }}>{bio}</p>}
        </div>

        {/* stats */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 1, background: "#e7ece9" }}>
          {[
            [fmt(stats.followers), "Seguidores"],
            [fmt(stats.reachMonth), "Alcance / mês"],
            [`${stats.engagementPct.toFixed(1).replace(".", ",")}%`, "Engajamento"],
            [fmt(stats.saves), "Salvamentos"],
          ].map(([n, l]) => (
            <div key={l} style={{ background: "#fff", padding: "18px 12px", textAlign: "center" }}>
              <div style={{ fontFamily: "Sora, Inter, sans-serif", fontSize: 24, fontWeight: 800, color: accent, letterSpacing: "-.02em" }}>{n}</div>
              <div style={{ fontSize: 10.5, color: "#6b7670", textTransform: "uppercase", letterSpacing: ".06em", marginTop: 4, fontWeight: 600 }}>{l}</div>
            </div>
          ))}
        </div>

        <div style={{ padding: "26px 32px 8px" }}>
          {/* audiência */}
          <Section title="Audiência" accent={accent}>
            <div style={{ display: "grid", gridTemplateColumns: "1.1fr 1fr", gap: 24, alignItems: "center" }}>
              <div>
                {(kit.audience ?? []).map((b) => (
                  <div key={b.label} style={{ marginBottom: 10 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, marginBottom: 4 }}>
                      <span>{b.label}</span><span style={{ color: "#6b7670", fontWeight: 600 }}>{b.pct}%</span>
                    </div>
                    <div style={{ height: 8, background: "#E1F5EE", borderRadius: 999, overflow: "hidden" }}>
                      <div style={{ height: "100%", width: `${Math.min(100, b.pct)}%`, background: accent, borderRadius: 999 }} />
                    </div>
                  </div>
                ))}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                <div style={{ width: 110, height: 110, borderRadius: "50%", background: `conic-gradient(${accent} 0 ${women}%, #1d9e75 ${women}% 100%)`, flexShrink: 0, position: "relative" }}>
                  <div style={{ position: "absolute", inset: 24, background: "#fff", borderRadius: "50%" }} />
                </div>
                <div style={{ fontSize: 12.5 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}><span style={{ width: 11, height: 11, borderRadius: 3, background: accent }} /> Mulheres · {women}%</div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}><span style={{ width: 11, height: 11, borderRadius: 3, background: "#1d9e75" }} /> Homens · {men}%</div>
                  {kit.cities && <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#6b7670" }}><span style={{ width: 11, height: 11, borderRadius: 3, background: "#cfe0d8" }} /> {kit.cities}</div>}
                </div>
              </div>
            </div>
          </Section>

          {/* melhores conteúdos */}
          {posts.length > 0 && (
            <Section title="Melhores conteúdos · 90 dias" accent={accent}>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12 }}>
                {posts.slice(0, 3).map((p, i) => (
                  <div key={i} style={{ border: "1px solid #e7ece9", borderRadius: 12, overflow: "hidden" }}>
                    <div style={{ aspectRatio: "4/5", background: p.thumbnail_url ? `center/cover no-repeat url(${p.thumbnail_url})` : POST_GRADS[i % 3], position: "relative" }}>
                      <span style={{ position: "absolute", top: 7, left: 7, background: "rgba(0,0,0,.45)", color: "#fff", fontSize: 10.5, padding: "3px 8px", borderRadius: 999 }}>{p.format}</span>
                    </div>
                    <div style={{ padding: "9px 11px", fontSize: 11.5 }}>
                      <div style={{ fontWeight: 600, marginBottom: 5, lineHeight: 1.35, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{p.title}</div>
                      <div style={{ display: "flex", gap: 10, color: "#6b7670" }}>
                        <span><b style={{ color: "#1a2420" }}>{fmt(p.reach)}</b> alcance</span>
                        <span><b style={{ color: "#1a2420" }}>{fmt(p.saves)}</b> salvos</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </Section>
          )}

          {/* serviços */}
          {(kit.services ?? []).length > 0 && (
            <Section title="Formatos de parceria" accent={accent}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13.5 }}>
                <tbody>
                  {(kit.services ?? []).map((s, i) => (
                    <tr key={i}>
                      <td style={{ padding: "12px 0", borderBottom: "1px solid #e7ece9" }}>
                        <div>{s.name}</div>
                        {s.desc && <div style={{ fontSize: 11.5, color: "#6b7670", marginTop: 2 }}>{s.desc}</div>}
                      </td>
                      <td style={{ padding: "12px 0", borderBottom: "1px solid #e7ece9", textAlign: "right", fontWeight: 700, color: "#085041", fontFamily: "Sora, Inter, sans-serif" }}>{s.price}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Section>
          )}
        </div>

        {/* cta */}
        <div style={{ background: "#E1F5EE", margin: "4px 32px 0", borderRadius: 14, padding: "20px 22px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 14, flexWrap: "wrap" }}>
          <div>
            <h3 style={{ fontFamily: "Sora, Inter, sans-serif", fontSize: 16, color: "#085041", margin: 0 }}>Vamos criar juntos?</h3>
            <p style={{ fontSize: 12.5, color: accent, marginTop: 3 }}>Aberta a campanhas alinhadas com o meu conteúdo.</p>
          </div>
          {kit.contact && <div style={{ background: accent, color: "#fff", padding: "11px 20px", borderRadius: 999, fontWeight: 600, fontSize: 13.5, whiteSpace: "nowrap" }}>{kit.contact}</div>}
        </div>

        <div style={{ padding: "20px 32px 26px", display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 11.5, color: "#6b7670", flexWrap: "wrap", gap: 8 }}>
          <span>Dados do Instagram · atualizados automaticamente.</span>
          <span style={{ fontFamily: "Sora, Inter, sans-serif", fontWeight: 800, color: accent, letterSpacing: ".04em" }}>feito com CRIA</span>
        </div>
      </div>
    </>
  );
});

function Section({ title, accent, children }: { title: string; accent: string; children: ReactNode }) {
  return (
    <div style={{ marginBottom: 26 }}>
      <h2 style={{ fontFamily: "Sora, Inter, sans-serif", fontSize: 14, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".08em", color: "#085041", marginBottom: 14, display: "flex", alignItems: "center", gap: 9 }}>
        <span style={{ width: 22, height: 3, background: accent, borderRadius: 2 }} /> {title}
      </h2>
      {children}
    </div>
  );
}
