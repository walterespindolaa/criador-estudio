import { forwardRef } from "react";

interface BrandPdfProps {
  profile: any;
  brandItems: any[];
  persona: any;
}

export const BrandPdfTemplate = forwardRef<HTMLDivElement, BrandPdfProps>(
  ({ profile, brandItems, persona }, ref) => {
    const tom = brandItems.find(b => b.type === "tom")?.name;
    const arquetipo = brandItems.find(b => b.type === "arquetipo")?.name;
    const expressoes = brandItems.filter(b => b.type === "expressao").map(b => b.name);
    const evitar = brandItems.filter(b => b.type === "evitar").map(b => b.name);

    return (
      <div ref={ref} style={{ width: 794, fontFamily: "Inter, sans-serif", background: "#fff", color: "#1a1a1a" }}>
        {/* Página 1 — Identidade */}
        <div style={{ width: 794, minHeight: 1123, padding: 64, boxSizing: "border-box", position: "relative" }}>
          {/* Header */}
          <div style={{ borderBottom: "2px solid #1a1a1a", paddingBottom: 24, marginBottom: 40 }}>
            <p style={{ fontSize: 11, letterSpacing: 3, textTransform: "uppercase", color: "#666", marginBottom: 8 }}>
              {profile.niche || "Creator de Conteúdo"}
            </p>
            <h1 style={{ fontSize: 36, fontWeight: 700, color: "#1a1a1a", margin: 0 }}>
              {profile.name}
            </h1>
            <p style={{ fontSize: 13, color: "#888", marginTop: 6 }}>
              Identidade de Marca · {new Date().toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}
            </p>
          </div>

          {/* Grid 2 colunas */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 32 }}>
            {/* Plataformas */}
            <div>
              <h3 style={{ fontSize: 10, letterSpacing: 2, textTransform: "uppercase", color: "#888", marginBottom: 12 }}>Plataformas</h3>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {(profile.platforms || []).map((p: string) => (
                  <span key={p} style={{ padding: "4px 12px", border: "1px solid #1a1a1a", borderRadius: 100, fontSize: 12 }}>
                    {p === "instagram" ? "Instagram" : p === "tiktok" ? "TikTok" : "YouTube"}
                  </span>
                ))}
              </div>
            </div>

            {/* Meta semanal */}
            <div>
              <h3 style={{ fontSize: 10, letterSpacing: 2, textTransform: "uppercase", color: "#888", marginBottom: 12 }}>Meta Semanal</h3>
              <p style={{ fontSize: 28, fontWeight: 700, color: "#1a1a1a" }}>{profile.weekly_goal || 3} posts/semana</p>
            </div>

            {/* Tom de voz */}
            {tom && (
              <div style={{ gridColumn: "1 / -1" }}>
                <h3 style={{ fontSize: 10, letterSpacing: 2, textTransform: "uppercase", color: "#888", marginBottom: 12 }}>Tom de Voz</h3>
                <p style={{ fontSize: 18, fontWeight: 600, color: "#1a1a1a" }}>{tom}</p>
              </div>
            )}

            {/* Arquétipo */}
            {arquetipo && (
              <div>
                <h3 style={{ fontSize: 10, letterSpacing: 2, textTransform: "uppercase", color: "#888", marginBottom: 12 }}>Arquétipo</h3>
                <p style={{ fontSize: 16, fontWeight: 600, color: "#1a1a1a" }}>{arquetipo}</p>
              </div>
            )}

            {/* Expressões */}
            {expressoes.length > 0 && (
              <div>
                <h3 style={{ fontSize: 10, letterSpacing: 2, textTransform: "uppercase", color: "#888", marginBottom: 12 }}>Expressões que usa</h3>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {expressoes.map((e, i) => (
                    <span key={i} style={{ padding: "3px 10px", background: "#f5f5f5", borderRadius: 4, fontSize: 12 }}>{e}</span>
                  ))}
                </div>
              </div>
            )}

            {/* Evitar */}
            {evitar.length > 0 && (
              <div style={{ gridColumn: "1 / -1" }}>
                <h3 style={{ fontSize: 10, letterSpacing: 2, textTransform: "uppercase", color: "#888", marginBottom: 12 }}>Evitar</h3>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {evitar.map((e, i) => (
                    <span key={i} style={{ padding: "3px 10px", background: "#fef2f2", color: "#dc2626", borderRadius: 4, fontSize: 12 }}>{e}</span>
                  ))}
                </div>
              </div>
            )}

            {/* Persona */}
            {persona && (
              <div style={{ gridColumn: "1 / -1", background: "#f9f9f9", padding: 20, borderRadius: 8 }}>
                <h3 style={{ fontSize: 10, letterSpacing: 2, textTransform: "uppercase", color: "#888", marginBottom: 16 }}>Público-alvo</h3>
                <p style={{ fontWeight: 600, fontSize: 14, marginBottom: 8 }}>{persona.name || "Persona principal"}</p>
                {persona.age_range && <p style={{ fontSize: 12, color: "#666", marginBottom: 4 }}>Faixa etária: {persona.age_range}</p>}
                {persona.pain_points?.length > 0 && (
                  <div style={{ marginTop: 8 }}>
                    <p style={{ fontSize: 11, color: "#888", marginBottom: 4 }}>Principais dores:</p>
                    {persona.pain_points.map((d: string, i: number) => (
                      <p key={i} style={{ fontSize: 12, color: "#333", paddingLeft: 12 }}>· {d}</p>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Footer */}
          <div style={{ position: "absolute", bottom: 40, left: 64, right: 64, borderTop: "1px solid #eee", paddingTop: 16, display: "flex", justifyContent: "space-between" }}>
            <p style={{ fontSize: 10, color: "#bbb" }}>Criado com CreatorsFlow</p>
            <p style={{ fontSize: 10, color: "#bbb" }}>{new Date().toLocaleDateString("pt-BR")}</p>
          </div>
        </div>
      </div>
    );
  }
);
BrandPdfTemplate.displayName = "BrandPdfTemplate";
