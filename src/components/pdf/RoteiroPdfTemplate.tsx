import { forwardRef } from "react";

interface Section {
  text: string;
  captacao?: string;
  driveFileId?: string | null;
}

interface RoteiroPdfProps {
  title: string;
  format: string;
  hook?: string;
  caption?: string;
  sections: Section[];
  referenceLink?: string;
  userName?: string;
  platform?: string;
}

const FORMAT_BADGE_COLORS: Record<string, string> = {
  reels: "#8B5CF6",
  shorts: "#EF4444",
  carrossel: "#F59E0B",
  video: "#3B82F6",
  live: "#EC4899",
  story: "#10B981",
  foto: "#6B7280",
};

const SECTION_LABELS: Record<string, string> = {
  reels: "CENAS PARA GRAVAR",
  shorts: "CENAS PARA GRAVAR",
  video: "CENAS PARA GRAVAR",
  carrossel: "LÂMINAS DO CARROSSEL",
  story: "SEQUÊNCIA DE STORIES",
};

const FORMAT_LABELS: Record<string, string> = {
  reels: "REELS",
  shorts: "SHORTS",
  carrossel: "CARROSSEL",
  video: "VÍDEO",
  live: "LIVE",
  story: "STORY",
  foto: "FOTO",
};

export const RoteiroPdfTemplate = forwardRef<HTMLDivElement, RoteiroPdfProps>(
  ({ title, format, hook, caption, sections, referenceLink, userName }, ref) => {
    const badgeColor = FORMAT_BADGE_COLORS[format] || "#6B7280";
    const sectionLabel = SECTION_LABELS[format] || "CENAS";
    const filledSections = sections.filter(s => s.text.trim() || s.captacao?.trim());

    return (
      <div ref={ref} style={{ width: 794, background: "#fff", fontFamily: "Inter, Arial, sans-serif", wordBreak: "break-word" }}>
        <div style={{ padding: "48px 56px", boxSizing: "border-box" }}>
          {/* Header */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 32 }}>
            <div>
              <p style={{ fontSize: 10, letterSpacing: 3, textTransform: "uppercase", color: "#999", marginBottom: 6, margin: 0 }}>
                ROTEIRO
              </p>
              <h1 style={{ fontSize: 22, fontWeight: 700, color: "#1a1a1a", margin: "6px 0 4px 0", lineHeight: 1.3 }}>
                {title || "Sem título"}
              </h1>
              {userName && (
                <p style={{ fontSize: 11, color: "#999", margin: 0 }}>{userName} · {FORMAT_LABELS[format] || format}</p>
              )}
            </div>
            <div style={{
              background: badgeColor,
              color: "#fff",
              padding: "6px 14px",
              borderRadius: 20,
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: 1,
              whiteSpace: "nowrap",
            }}>
              {sectionLabel}
            </div>
          </div>

          {/* Hook */}
          {hook && (
            <div style={{ background: "#f9f9f9", borderLeft: `3px solid ${badgeColor}`, padding: "10px 14px", marginBottom: 24, borderRadius: "0 6px 6px 0" }}>
              <p style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: 2, color: "#999", margin: "0 0 4px 0" }}>Hook</p>
              <p style={{ fontSize: 13, color: "#1a1a1a", margin: 0, fontStyle: "italic", whiteSpace: "pre-wrap" }}>"{hook}"</p>
            </div>
          )}

          {/* Scenes — vertical layout per block */}
          {filledSections.length > 0 && (
            <div style={{ marginBottom: 24 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <p style={{ fontSize: 10, letterSpacing: 2, textTransform: "uppercase", color: "#1a1a1a", fontWeight: 700, margin: 0 }}>
                  ROTEIRO
                </p>
                <p style={{ fontSize: 10, letterSpacing: 2, textTransform: "uppercase", color: "#999", margin: 0 }}>
                  CAPTAÇÃO
                </p>
              </div>
              <div style={{ borderTop: "2px solid #1a1a1a", marginBottom: 0 }} />

              {filledSections.map((sec, i) => (
                <div key={i} style={{ borderBottom: "1px solid #e5e5e5" }}>
                  <div style={{ display: "flex", gap: 0 }}>
                    {/* Roteiro */}
                    <div style={{
                      flex: "0 0 55%",
                      padding: "14px 20px 14px 0",
                      fontSize: 12,
                      color: "#222",
                      lineHeight: 1.7,
                      wordBreak: "break-word",
                      whiteSpace: "pre-wrap",
                    }}>
                      {sec.text || "—"}
                    </div>
                    {/* Vertical separator */}
                    <div style={{ width: 1, background: "#e5e5e5", flexShrink: 0 }} />
                    {/* Captação */}
                    <div style={{
                      flex: "0 0 45%",
                      padding: "14px 0 14px 20px",
                      fontSize: 12,
                      color: "#666",
                      lineHeight: 1.7,
                      wordBreak: "break-word",
                      whiteSpace: "pre-wrap",
                    }}>
                      {sec.captacao || "—"}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Caption */}
          {caption && (
            <div style={{ marginBottom: 20 }}>
              <p style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: 2, color: "#999", margin: "0 0 6px 0" }}>Legenda</p>
              <p style={{ fontSize: 12, color: "#333", lineHeight: 1.6, margin: 0, whiteSpace: "pre-wrap" }}>{caption}</p>
            </div>
          )}

          {/* Footer */}
          <div style={{ borderTop: "1px solid #eee", paddingTop: 16, marginTop: 16, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            {referenceLink ? (
              <div>
                <p style={{ fontSize: 9, textTransform: "uppercase", letterSpacing: 2, color: "#bbb", margin: "0 0 2px 0" }}>Referência</p>
                <p style={{ fontSize: 10, color: "#3B82F6", margin: 0, wordBreak: "break-all" }}>{referenceLink}</p>
              </div>
            ) : <div />}
            <p style={{ fontSize: 9, color: "#ccc", margin: 0 }}>CreatorsFlow · {new Date().toLocaleDateString("pt-BR")}</p>
          </div>
        </div>
      </div>
    );
  }
);
RoteiroPdfTemplate.displayName = "RoteiroPdfTemplate";
